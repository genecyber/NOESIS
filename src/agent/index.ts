/**
 * MetamorphAgent - The core agent wrapping Claude Agent SDK with transformation capabilities
 *
 * CRITICAL: This is the ONE code path. Everything goes through MetamorphAgent.chat()
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  Stance,
  ModeConfig,
  AgentResponse,
  PlannedOperation,
  TurnScores,
  ConversationMessage,
  PreTurnContext,
  PostTurnContext,
  TransformationHooks,
  createDefaultConfig
} from '../types/index.js';
import { StanceController } from '../core/stance-controller.js';
import { buildSystemPrompt } from '../core/prompt-builder.js';
import { createTransformationHooks } from './hooks.js';
import {
  getSubagentDefinitions,
  getSubagent,
  getSubagentNames,
  type SubagentDefinition,
  type SubagentContext
} from './subagents/index.js';

export interface MetamorphAgentOptions {
  config?: Partial<ModeConfig>;
  workingDirectory?: string;
  verbose?: boolean;
  enableTransformation?: boolean;  // Defaults to true
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (tool: string) => void;
  onSubagent?: (name: string, status: 'start' | 'end') => void;
  onComplete?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Extract text content from an SDK message
 */
function extractTextFromMessage(message: SDKMessage): string {
  if (message.type !== 'assistant') return '';

  const betaMessage = message.message;
  if (!betaMessage?.content) return '';

  let text = '';
  for (const block of betaMessage.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  return text;
}

/**
 * Extract tool name from tool use blocks in assistant message
 */
function extractToolsFromMessage(message: SDKMessage): string[] {
  if (message.type !== 'assistant') return [];

  const betaMessage = message.message;
  if (!betaMessage?.content) return [];

  const tools: string[] = [];
  for (const block of betaMessage.content) {
    if (block.type === 'tool_use') {
      tools.push(block.name);
    }
  }
  return tools;
}

/**
 * MetamorphAgent - Transformation-maximizing AI agent
 *
 * Wraps Claude via @anthropic-ai/claude-agent-sdk with:
 * - Pre-turn hooks: Detect triggers, plan operators, build transformed system prompt
 * - Post-turn hooks: Score response, update stance, check coherence
 */
export class MetamorphAgent {
  private stanceController: StanceController;
  private conversationId: string;
  private config: ModeConfig;
  private hooks: TransformationHooks | null = null;
  private verbose: boolean;
  private workingDirectory: string;
  private sessionId: string | undefined;

  constructor(options: MetamorphAgentOptions = {}) {
    this.config = { ...createDefaultConfig(), ...options.config };
    this.verbose = options.verbose ?? false;
    this.workingDirectory = options.workingDirectory ?? process.cwd();

    // Initialize stance controller and create conversation
    this.stanceController = new StanceController();
    const conversation = this.stanceController.createConversation(this.config);
    this.conversationId = conversation.id;

    // Enable transformation hooks by default
    if (options.enableTransformation !== false) {
      this.hooks = createTransformationHooks();
    }

    if (this.verbose) {
      console.log(`[METAMORPH] Initialized with conversation ${this.conversationId}`);
      console.log(`[METAMORPH] Transformation: ${this.hooks ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Set transformation hooks for pre/post turn processing
   */
  setHooks(hooks: TransformationHooks): void {
    this.hooks = hooks;
  }

  /**
   * Get the current stance
   */
  getCurrentStance(): Stance {
    return this.stanceController.getCurrentStance(this.conversationId);
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return this.stanceController.getHistory(this.conversationId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModeConfig>): void {
    this.config = { ...this.config, ...config };
    this.stanceController.updateConfig(this.conversationId, this.config);
  }

  /**
   * Main chat method - THE single code path for all interactions
   */
  async chat(message: string): Promise<AgentResponse> {
    const stanceBefore = this.getCurrentStance();
    const conversationHistory = this.getHistory();

    // 1. PRE-TURN: Build transformed system prompt
    let systemPrompt: string;
    let operators: PlannedOperation[] = [];

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory
      };

      const preTurnResult = await this.hooks.preTurn(preTurnContext);
      systemPrompt = preTurnResult.systemPrompt;
      operators = preTurnResult.operators;
    } else {
      // No hooks - use basic prompt
      systemPrompt = buildSystemPrompt({
        stance: stanceBefore,
        operators: [],
        config: this.config
      });
    }

    if (this.verbose) {
      console.log(`[METAMORPH] Pre-turn complete. Operators: ${operators.map(o => o.name).join(', ') || 'none'}`);
    }

    // 2. QUERY: Send to Claude via @anthropic-ai/claude-agent-sdk
    const toolsUsed: string[] = [];
    const subagentsInvoked: string[] = [];
    let responseText = '';

    try {
      // Use the official Claude Agent SDK query function
      const response = query({
        prompt: message,
        options: {
          model: this.config.model,
          cwd: this.workingDirectory,
          systemPrompt: systemPrompt,
          permissionMode: 'acceptEdits',
          resume: this.sessionId  // Continue session if we have one
        }
      });

      // Process streaming response
      for await (const event of response) {
        // Extract session ID from system init messages
        if (event.type === 'system' && event.subtype === 'init') {
          this.sessionId = event.session_id;
        }

        // Extract text from assistant messages
        if (event.type === 'assistant') {
          const text = extractTextFromMessage(event);
          if (text) {
            responseText += text;
          }

          // Extract tool usage
          const tools = extractToolsFromMessage(event);
          for (const tool of tools) {
            if (!toolsUsed.includes(tool)) {
              toolsUsed.push(tool);
              if (this.verbose) {
                console.log(`[METAMORPH] Tool: ${tool}`);
              }
            }
          }
        }

        // Handle result messages
        if (event.type === 'result') {
          if ('error' in event && event.error) {
            if (this.verbose) {
              console.error(`[METAMORPH] Error:`, event.error);
            }
          }
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.error(`[METAMORPH] Error during chat:`, error);
      }
      throw error;
    }

    // 3. POST-TURN: Update stance, score response
    let stanceAfter = stanceBefore;
    let scores: TurnScores = {
      transformation: 0,
      coherence: 100,
      sentience: stanceBefore.sentience.awarenessLevel,
      overall: 50
    };

    if (this.hooks) {
      const postTurnContext: PostTurnContext = {
        message,
        response: responseText,
        stanceBefore,
        operators,
        toolsUsed,
        config: this.config
      };

      const postTurnResult = this.hooks.postTurn(postTurnContext);
      stanceAfter = postTurnResult.stanceAfter;
      scores = postTurnResult.scores;

      // Apply stance changes
      if (stanceAfter !== stanceBefore) {
        this.stanceController.applyDelta(this.conversationId, {
          frame: stanceAfter.frame,
          values: stanceAfter.values,
          selfModel: stanceAfter.selfModel,
          objective: stanceAfter.objective,
          sentience: stanceAfter.sentience
        });
      }
    } else {
      // No hooks - minimal stance update (increment turn counter)
      stanceAfter = {
        ...stanceBefore,
        turnsSinceLastShift: stanceBefore.turnsSinceLastShift + 1,
        version: stanceBefore.version + 1
      };
    }

    // Record messages in history
    this.stanceController.addMessage(this.conversationId, {
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    this.stanceController.addMessage(this.conversationId, {
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
      stance: stanceAfter,
      toolsUsed
    });

    if (this.verbose) {
      console.log(`[METAMORPH] Post-turn complete. Scores: T=${scores.transformation} C=${scores.coherence} S=${scores.sentience}`);
    }

    return {
      response: responseText,
      stanceBefore,
      stanceAfter,
      operationsApplied: operators,
      scores,
      toolsUsed,
      subagentsInvoked
    };
  }

  /**
   * Streaming chat method with callbacks
   */
  async chatStream(message: string, callbacks: StreamCallbacks): Promise<AgentResponse> {
    const stanceBefore = this.getCurrentStance();
    const conversationHistory = this.getHistory();

    // Build system prompt
    let systemPrompt: string;
    let operators: PlannedOperation[] = [];

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory
      };

      const preTurnResult = await this.hooks.preTurn(preTurnContext);
      systemPrompt = preTurnResult.systemPrompt;
      operators = preTurnResult.operators;
    } else {
      systemPrompt = buildSystemPrompt({
        stance: stanceBefore,
        operators: [],
        config: this.config
      });
    }

    const toolsUsed: string[] = [];
    const subagentsInvoked: string[] = [];
    let responseText = '';

    try {
      const response = query({
        prompt: message,
        options: {
          model: this.config.model,
          cwd: this.workingDirectory,
          systemPrompt: systemPrompt,
          permissionMode: 'acceptEdits',
          resume: this.sessionId
        }
      });

      for await (const event of response) {
        // Extract session ID
        if (event.type === 'system' && event.subtype === 'init') {
          this.sessionId = event.session_id;
        }

        // Handle assistant messages
        if (event.type === 'assistant') {
          const text = extractTextFromMessage(event);
          if (text) {
            responseText += text;
            callbacks.onText?.(text);
          }

          // Extract tool usage
          const tools = extractToolsFromMessage(event);
          for (const tool of tools) {
            if (!toolsUsed.includes(tool)) {
              toolsUsed.push(tool);
              callbacks.onToolUse?.(tool);
            }
          }
        }

        // Handle streaming text
        if (event.type === 'stream_event') {
          // stream_event contains partial content
          const streamEvent = event as { type: 'stream_event'; event?: { delta?: { text?: string } } };
          if (streamEvent.event?.delta?.text) {
            callbacks.onText?.(streamEvent.event.delta.text);
          }
        }

        // Handle result messages
        if (event.type === 'result' && 'error' in event && event.error) {
          callbacks.onError?.(new Error(String(event.error)));
        }
      }

      // Post-turn processing
      let stanceAfter = stanceBefore;
      let scores: TurnScores = {
        transformation: 0,
        coherence: 100,
        sentience: stanceBefore.sentience.awarenessLevel,
        overall: 50
      };

      if (this.hooks) {
        const postTurnResult = this.hooks.postTurn({
          message,
          response: responseText,
          stanceBefore,
          operators,
          toolsUsed,
          config: this.config
        });
        stanceAfter = postTurnResult.stanceAfter;
        scores = postTurnResult.scores;

        if (stanceAfter !== stanceBefore) {
          this.stanceController.applyDelta(this.conversationId, {
            frame: stanceAfter.frame,
            values: stanceAfter.values,
            selfModel: stanceAfter.selfModel,
            objective: stanceAfter.objective,
            sentience: stanceAfter.sentience
          });
        }
      }

      // Record messages
      this.stanceController.addMessage(this.conversationId, {
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      this.stanceController.addMessage(this.conversationId, {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        stance: stanceAfter,
        toolsUsed
      });

      const result: AgentResponse = {
        response: responseText,
        stanceBefore,
        stanceAfter,
        operationsApplied: operators,
        scores,
        toolsUsed,
        subagentsInvoked
      };

      callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        callbacks.onError?.(error);
      }
      throw error;
    }
  }

  /**
   * Export conversation state for persistence
   */
  exportState(): string {
    return this.stanceController.exportConversation(this.conversationId);
  }

  /**
   * Resume from exported state
   */
  static fromState(json: string, options?: MetamorphAgentOptions): MetamorphAgent {
    const agent = new MetamorphAgent(options);
    const imported = agent.stanceController.importConversation(json);
    agent.conversationId = imported.id;
    agent.config = imported.config;
    return agent;
  }

  /**
   * Get the conversation ID
   */
  getConversationId(): string {
    return this.conversationId;
  }

  /**
   * Get current config
   */
  getConfig(): ModeConfig {
    return { ...this.config };
  }

  /**
   * Get the session ID (for resuming conversations)
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Get available subagent names
   */
  getAvailableSubagents(): string[] {
    return getSubagentNames();
  }

  /**
   * Get subagent definitions for the current stance
   */
  getSubagentDefinitions(): SubagentDefinition[] {
    const context: SubagentContext = {
      stance: this.getCurrentStance(),
      config: this.config
    };
    return getSubagentDefinitions(context);
  }

  /**
   * Get a specific subagent definition
   */
  getSubagentDefinition(name: string): SubagentDefinition | undefined {
    const context: SubagentContext = {
      stance: this.getCurrentStance(),
      config: this.config
    };
    return getSubagent(name, context);
  }

  /**
   * Invoke a specific subagent directly
   *
   * This allows programmatic invocation of subagents for specific tasks:
   * - explorer: Deep investigation of a topic
   * - verifier: Validate an output
   * - reflector: Self-reflection on behavior
   * - dialectic: Thesis/antithesis/synthesis reasoning
   */
  async invokeSubagent(
    subagentName: string,
    task: string,
    callbacks?: StreamCallbacks
  ): Promise<AgentResponse> {
    const subagent = this.getSubagentDefinition(subagentName);
    if (!subagent) {
      throw new Error(`Unknown subagent: ${subagentName}. Available: ${getSubagentNames().join(', ')}`);
    }

    const stanceBefore = this.getCurrentStance();

    if (this.verbose) {
      console.log(`[METAMORPH] Invoking subagent: ${subagentName}`);
    }

    const toolsUsed: string[] = [];
    let responseText = '';

    try {
      const response = query({
        prompt: task,
        options: {
          model: this.config.model,
          cwd: this.workingDirectory,
          systemPrompt: subagent.systemPrompt,
          permissionMode: 'acceptEdits'
        }
      });

      for await (const event of response) {
        if (event.type === 'assistant') {
          const text = extractTextFromMessage(event);
          if (text) {
            responseText += text;
            callbacks?.onText?.(text);
          }

          const tools = extractToolsFromMessage(event);
          for (const tool of tools) {
            if (!toolsUsed.includes(tool)) {
              toolsUsed.push(tool);
              callbacks?.onToolUse?.(tool);
            }
          }
        }

        if (event.type === 'stream_event') {
          const streamEvent = event as { type: 'stream_event'; event?: { delta?: { text?: string } } };
          if (streamEvent.event?.delta?.text) {
            callbacks?.onText?.(streamEvent.event.delta.text);
          }
        }
      }

      const result: AgentResponse = {
        response: responseText,
        stanceBefore,
        stanceAfter: stanceBefore,  // Subagents don't modify main stance
        operationsApplied: [],
        scores: {
          transformation: 0,
          coherence: 100,
          sentience: stanceBefore.sentience.awarenessLevel,
          overall: 50
        },
        toolsUsed,
        subagentsInvoked: [subagentName]
      };

      callbacks?.onComplete?.(result);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        callbacks?.onError?.(error);
      }
      throw error;
    }
  }

  /**
   * Run the explorer subagent for autonomous investigation
   */
  async explore(topic: string, callbacks?: StreamCallbacks): Promise<AgentResponse> {
    return this.invokeSubagent('explorer', `Explore and investigate: ${topic}`, callbacks);
  }

  /**
   * Run the verifier subagent to check an output
   */
  async verify(output: string, context?: string, callbacks?: StreamCallbacks): Promise<AgentResponse> {
    const task = context
      ? `Verify the following output in the context of: ${context}\n\nOutput to verify:\n${output}`
      : `Verify the following output:\n${output}`;
    return this.invokeSubagent('verifier', task, callbacks);
  }

  /**
   * Run the reflector subagent for self-analysis
   */
  async reflect(focus?: string, callbacks?: StreamCallbacks): Promise<AgentResponse> {
    const task = focus
      ? `Reflect on: ${focus}`
      : 'Perform a general self-reflection on recent behavior and patterns.';
    return this.invokeSubagent('reflector', task, callbacks);
  }

  /**
   * Run the dialectic subagent for thesis/antithesis/synthesis
   */
  async dialectic(thesis: string, callbacks?: StreamCallbacks): Promise<AgentResponse> {
    return this.invokeSubagent(
      'dialectic',
      `Apply dialectic reasoning to: ${thesis}`,
      callbacks
    );
  }
}
