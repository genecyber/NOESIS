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
import { MemoryStore } from '../memory/index.js';
import type { MemoryEntry } from '../types/index.js';
import { commandRegistry, type CommandResult } from '../commands/index.js';
import { setAgentProvider } from '../tools/commands.js';
import { createMetamorphMcpServer } from '../tools/mcp-server.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

/**
 * Transformation history entry
 */
export interface TransformationHistoryEntry {
  timestamp: Date;
  stanceBefore: Stance;
  stanceAfter: Stance;
  operators: PlannedOperation[];
  scores: TurnScores;
  userMessage: string;
}

export interface MetamorphAgentOptions {
  config?: Partial<ModeConfig>;
  workingDirectory?: string;
  verbose?: boolean;
  enableTransformation?: boolean;  // Defaults to true
  maxRegenerationAttempts?: number;  // Defaults to 2
  disallowedTools?: string[];  // Tools to explicitly block
}

// All built-in Claude Code tools - allow everything by default
const ALL_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'Task', 'TodoWrite', 'NotebookEdit',
  'AskUserQuestion', 'KillShell', 'TaskOutput'
];

// MCP tool names (prefixed with mcp__metamorph-tools__)
const MCP_TOOL_PREFIX = 'mcp__metamorph-tools__';
const MCP_TOOLS = [
  // Introspection
  'get_stance',
  'get_transformation_history',
  'get_sentience_report',
  'get_emergent_goals',
  // Memory
  'store_memory',
  'recall_memories',
  'get_memory_types',
  'delete_memory',
  // Analysis
  'dialectical_analysis',
  'frame_shift_analysis',
  'value_analysis',
  'coherence_check',
  // Commands
  'invoke_command',
  'list_commands',
  // Research
  'web_search',
  'web_scrape',
].map(name => `${MCP_TOOL_PREFIX}${name}`);

// Combined allowed tools
const ALLOWED_TOOLS = [...ALL_TOOLS, ...MCP_TOOLS];

export interface ToolUseEvent {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'started' | 'completed' | 'error';
  result?: string;
  error?: string;
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (tool: string) => void;
  onToolEvent?: (event: ToolUseEvent) => void;
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
interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

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

function extractToolUseBlocks(message: SDKMessage): ToolUseBlock[] {
  if (message.type !== 'assistant') return [];

  const betaMessage = message.message;
  if (!betaMessage?.content) return [];

  const blocks: ToolUseBlock[] = [];
  for (const block of betaMessage.content) {
    if (block.type === 'tool_use') {
      blocks.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }
  return blocks;
}

function extractToolResultFromMessage(message: SDKMessage): { toolUseId: string; result: string } | null {
  if (message.type !== 'user') return null;

  const content = (message as { content?: Array<{ type: string; tool_use_id?: string; content?: string }> }).content;
  if (!content) return null;

  for (const block of content) {
    if (block.type === 'tool_result' && block.tool_use_id) {
      return {
        toolUseId: block.tool_use_id,
        result: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
      };
    }
  }
  return null;
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
  private transformationHistory: TransformationHistoryEntry[] = [];
  private memoryStore: MemoryStore | null = null;
  private coherenceWarnings: Array<{ timestamp: Date; score: number; floor: number }> = [];
  private disallowedTools: string[];
  private mcpServer: McpSdkServerConfigWithInstance;

  constructor(options: MetamorphAgentOptions = {}) {
    this.config = { ...createDefaultConfig(), ...options.config };
    this.verbose = options.verbose ?? false;
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.disallowedTools = options.disallowedTools ?? [];
    // maxRegenerationAttempts reserved for future auto-regeneration feature

    // Initialize stance controller and create conversation
    this.stanceController = new StanceController();
    const conversation = this.stanceController.createConversation(this.config);
    this.conversationId = conversation.id;

    // Create the MCP server with introspection tools
    this.mcpServer = createMetamorphMcpServer();

    // Enable transformation hooks by default
    // Ralph Iteration 3: Pass memory store for operator learning and memory extraction
    if (options.enableTransformation !== false) {
      // Initialize memory store before creating hooks to enable memory extraction
      this.ensureMemoryStore();
      this.hooks = createTransformationHooks(this.memoryStore ?? undefined);
    }

    // Wire tool providers for agent command invocation
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    setAgentProvider(() => self);

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

    // 0. AUTO-COMMAND DETECTION AND EXECUTION
    const autoInvokedCommands = this.executeAutoCommands(message, stanceBefore);

    // 1. PRE-TURN: Build transformed system prompt
    let systemPrompt: string;
    let operators: PlannedOperation[] = [];

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory,
        conversationId: this.conversationId
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

    // Inject auto-invoked command results into system prompt
    if (autoInvokedCommands.length > 0) {
      const commandContext = autoInvokedCommands
        .map(cmd => `[/${cmd.command}]\n${cmd.output}`)
        .join('\n\n');
      systemPrompt = `${systemPrompt}\n\n[RELEVANT CONTEXT FROM AUTO-INVOKED COMMANDS]\n${commandContext}`;

      if (this.verbose) {
        console.log(`[METAMORPH] Auto-invoked: ${autoInvokedCommands.map(c => '/' + c.command).join(', ')}`);
      }
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
          resume: this.sessionId,  // Continue session if we have one
          includePartialMessages: true,
          allowedTools: ALLOWED_TOOLS,
          disallowedTools: this.disallowedTools.length > 0 ? this.disallowedTools : undefined,
          mcpServers: {
            'metamorph-tools': this.mcpServer
          }
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

    let coherenceWarning: string | undefined;

    if (this.hooks) {
      const postTurnContext: PostTurnContext = {
        message,
        response: responseText,
        stanceBefore,
        operators,
        toolsUsed,
        config: this.config,
        conversationId: this.conversationId
      };

      const postTurnResult = this.hooks.postTurn(postTurnContext);
      stanceAfter = postTurnResult.stanceAfter;
      scores = postTurnResult.scores;

      // Check coherence floor (Ralph Iteration 1 - Feature 5)
      if (postTurnResult.shouldRegenerate) {
        coherenceWarning = postTurnResult.regenerationReason;
        this.coherenceWarnings.push({
          timestamp: new Date(),
          score: scores.coherence,
          floor: this.config.coherenceFloor
        });
        if (this.verbose) {
          console.log(`[METAMORPH] Coherence warning: ${coherenceWarning}`);
        }
      }

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

    // Record transformation in history
    this.recordTransformation(stanceBefore, stanceAfter, operators, scores, message);

    // Check for auto-snapshot (evolution persistence)
    this.checkAndAutoSnapshot(stanceAfter);

    return {
      response: responseText,
      stanceBefore,
      stanceAfter,
      operationsApplied: operators,
      scores,
      toolsUsed,
      subagentsInvoked,
      coherenceWarning
    };
  }

  /**
   * Streaming chat method with callbacks
   */
  async chatStream(message: string, callbacks: StreamCallbacks): Promise<AgentResponse> {
    const stanceBefore = this.getCurrentStance();
    const conversationHistory = this.getHistory();

    // 0. AUTO-COMMAND DETECTION AND EXECUTION
    const autoInvokedCommands = this.executeAutoCommands(message, stanceBefore);

    // Notify about auto-invoked commands
    if (autoInvokedCommands.length > 0 && callbacks.onText) {
      const notice = `[Auto-invoked: ${autoInvokedCommands.map(c => '/' + c.command).join(', ')}]\n\n`;
      callbacks.onText(notice);
    }

    // Build system prompt
    let systemPrompt: string;
    let operators: PlannedOperation[] = [];

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory,
        conversationId: this.conversationId
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

    // Inject auto-invoked command results into system prompt
    if (autoInvokedCommands.length > 0) {
      const commandContext = autoInvokedCommands
        .map(cmd => `[/${cmd.command}]\n${cmd.output}`)
        .join('\n\n');
      systemPrompt = `${systemPrompt}\n\n[RELEVANT CONTEXT FROM AUTO-INVOKED COMMANDS]\n${commandContext}`;
    }

    const toolsUsed: string[] = [];
    const subagentsInvoked: string[] = [];
    const activeTools = new Map<string, ToolUseBlock>();
    let responseText = '';
    let hasStreamedText = false;

    try {
      const response = query({
        prompt: message,
        options: {
          model: this.config.model,
          cwd: this.workingDirectory,
          systemPrompt: systemPrompt,
          permissionMode: 'acceptEdits',
          resume: this.sessionId,
          includePartialMessages: true,
          allowedTools: ALLOWED_TOOLS,
          disallowedTools: this.disallowedTools.length > 0 ? this.disallowedTools : undefined,
          mcpServers: {
            'metamorph-tools': this.mcpServer
          }
        }
      });

      for await (const event of response) {
        // Extract session ID
        if (event.type === 'system' && event.subtype === 'init') {
          this.sessionId = event.session_id;
        }

        // Handle assistant messages (complete text - don't emit to onText, just track)
        if (event.type === 'assistant') {
          const text = extractTextFromMessage(event);
          if (text) {
            // Only set responseText if we haven't been streaming
            // (streaming builds it incrementally)
            if (!hasStreamedText) {
              responseText = text;
              callbacks.onText?.(text); // Only emit if no streaming happened
            }
          }

          // Extract tool usage
          const tools = extractToolsFromMessage(event);
          for (const tool of tools) {
            if (!toolsUsed.includes(tool)) {
              toolsUsed.push(tool);
              callbacks.onToolUse?.(tool);
            }
          }

          // Extract detailed tool use blocks for onToolEvent
          const toolBlocks = extractToolUseBlocks(event);
          for (const block of toolBlocks) {
            if (!activeTools.has(block.id)) {
              activeTools.set(block.id, block);
              callbacks.onToolEvent?.({
                id: block.id,
                name: block.name,
                input: block.input,
                status: 'started',
              });
            }
          }
        }

        // Handle tool results (user messages with tool_result)
        if (event.type === 'user') {
          const toolResult = extractToolResultFromMessage(event);
          if (toolResult) {
            const toolBlock = activeTools.get(toolResult.toolUseId);
            if (toolBlock) {
              callbacks.onToolEvent?.({
                id: toolResult.toolUseId,
                name: toolBlock.name,
                input: toolBlock.input,
                status: 'completed',
                result: toolResult.result,
              });
            }
          }
        }

        // Handle streaming text - SDK sends SDKPartialAssistantMessage
        if (event.type === 'stream_event') {
          const streamEvent = event as {
            type: 'stream_event';
            event?: {
              type?: string;
              delta?: { type?: string; text?: string };
              content_block?: { type?: string; text?: string };
            };
          };
          // Handle text delta from content_block_delta events
          if (streamEvent.event?.type === 'content_block_delta' && streamEvent.event?.delta?.text) {
            hasStreamedText = true;
            responseText += streamEvent.event.delta.text;
            callbacks.onText?.(streamEvent.event.delta.text);
          }
          // Also check for text in delta.text directly (fallback)
          else if (streamEvent.event?.delta?.text) {
            hasStreamedText = true;
            responseText += streamEvent.event.delta.text;
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
      let coherenceWarning: string | undefined;

      if (this.hooks) {
        const postTurnResult = this.hooks.postTurn({
          message,
          response: responseText,
          stanceBefore,
          operators,
          toolsUsed,
          config: this.config,
          conversationId: this.conversationId
        });
        stanceAfter = postTurnResult.stanceAfter;
        scores = postTurnResult.scores;

        // Check coherence floor (Ralph Iteration 1 - Feature 5)
        if (postTurnResult.shouldRegenerate) {
          coherenceWarning = postTurnResult.regenerationReason;
          this.coherenceWarnings.push({
            timestamp: new Date(),
            score: scores.coherence,
            floor: this.config.coherenceFloor
          });
          if (this.verbose) {
            console.log(`[METAMORPH] Coherence warning: ${coherenceWarning}`);
          }
        }

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

      // Record transformation in history
      this.recordTransformation(stanceBefore, stanceAfter, operators, scores, message);

      // Check for auto-snapshot (evolution persistence)
      this.checkAndAutoSnapshot(stanceAfter);

      const result: AgentResponse = {
        response: responseText,
        stanceBefore,
        stanceAfter,
        operationsApplied: operators,
        scores,
        toolsUsed,
        subagentsInvoked,
        coherenceWarning
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
   * Get the memory store (Ralph Iteration 2 - Feature 2)
   */
  getMemoryStore(): MemoryStore {
    return this.ensureMemoryStore();
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
          permissionMode: 'acceptEdits',
          includePartialMessages: true,
          allowedTools: ALLOWED_TOOLS,
          disallowedTools: this.disallowedTools.length > 0 ? this.disallowedTools : undefined,
          mcpServers: {
            'metamorph-tools': this.mcpServer
          }
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

  // ============================================================================
  // Transformation History (Ralph Iteration 1 - Feature 1)
  // ============================================================================

  /**
   * Get transformation history
   */
  getTransformationHistory(): TransformationHistoryEntry[] {
    return [...this.transformationHistory];
  }

  /**
   * Record a transformation in history
   */
  private recordTransformation(
    stanceBefore: Stance,
    stanceAfter: Stance,
    operators: PlannedOperation[],
    scores: TurnScores,
    userMessage: string
  ): void {
    this.transformationHistory.push({
      timestamp: new Date(),
      stanceBefore,
      stanceAfter,
      operators,
      scores,
      userMessage
    });
  }

  // ============================================================================
  // Auto-Command System
  // ============================================================================

  /**
   * Detect and execute auto-invoked commands based on message content
   */
  private executeAutoCommands(
    message: string,
    stance: Stance
  ): Array<{ command: string; output: string }> {
    if (!this.config.enableAutoCommands) {
      return [];
    }

    // Detect which commands should be triggered
    const triggers = commandRegistry.detectTriggers(
      message,
      stance,
      this.config,
      this.config.maxAutoCommandsPerTurn
    );

    if (triggers.length === 0) {
      return [];
    }

    // Execute each triggered command
    const results: Array<{ command: string; output: string }> = [];

    for (const trigger of triggers) {
      const result = commandRegistry.execute(trigger.command, {
        agent: this,
        stance,
        config: this.config,
        message
      });

      if (result && result.shouldInjectIntoResponse) {
        results.push({
          command: trigger.command,
          output: result.output
        });
      }
    }

    return results;
  }

  /**
   * Manually invoke a command (for agent tool use)
   */
  invokeCommand(command: string, args: string[] = []): CommandResult | null {
    const stance = this.getCurrentStance();
    return commandRegistry.execute(command, {
      agent: this,
      stance,
      config: this.config
    }, args);
  }

  /**
   * List available commands for agent use
   */
  listCommands(): Array<{ name: string; description: string; aliases: string[] }> {
    return commandRegistry.listAgentInvocable().map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      aliases: cmd.aliases
    }));
  }

  // ============================================================================
  // Memory Access (Ralph Iteration 1 - Feature 1)
  // ============================================================================

  /**
   * Initialize memory store if not already initialized
   */
  private ensureMemoryStore(): MemoryStore {
    if (!this.memoryStore) {
      this.memoryStore = new MemoryStore({ inMemory: true });
    }
    return this.memoryStore;
  }

  /**
   * Store a memory
   */
  storeMemory(content: string, type: 'episodic' | 'semantic' | 'identity' = 'semantic', importance: number = 0.5): string {
    const store = this.ensureMemoryStore();
    return store.addMemory({
      type,
      content,
      importance,
      decay: 0.99,
      timestamp: new Date(),
      metadata: { conversationId: this.conversationId }
    });
  }

  /**
   * Search memories
   */
  searchMemories(query: {
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  } = {}): MemoryEntry[] {
    const store = this.ensureMemoryStore();
    return store.searchMemories(query);
  }

  /**
   * Get all memories
   */
  getAllMemories(limit: number = 50): MemoryEntry[] {
    return this.searchMemories({ limit });
  }

  /**
   * Set a persistent memory store path
   */
  setMemoryStorePath(dbPath: string): void {
    if (this.memoryStore) {
      this.memoryStore.close();
    }
    this.memoryStore = new MemoryStore({ dbPath });
  }

  // ============================================================================
  // Evolution Persistence (Ralph Iteration 1 - Feature 4)
  // ============================================================================

  /**
   * Enable evolution persistence with auto-snapshotting
   */
  enableEvolutionPersistence(dbPath?: string): void {
    if (dbPath) {
      this.setMemoryStorePath(dbPath);
    } else {
      this.ensureMemoryStore();
    }
  }

  /**
   * Check and auto-snapshot if drift threshold exceeded
   */
  private checkAndAutoSnapshot(stance: Stance): void {
    if (!this.memoryStore) return;

    if (this.memoryStore.shouldAutoSnapshot(this.conversationId, stance.cumulativeDrift, this.config.maxDriftPerTurn * 2)) {
      this.memoryStore.saveEvolutionSnapshot(this.conversationId, stance, 'drift_threshold');
      if (this.verbose) {
        console.log(`[METAMORPH] Evolution snapshot saved (drift threshold reached)`);
      }
    }
  }

  /**
   * Save an evolution snapshot manually
   */
  saveEvolutionSnapshot(trigger: 'manual' | 'session_end' = 'manual'): string | null {
    if (!this.memoryStore) {
      this.ensureMemoryStore();
    }
    const stance = this.getCurrentStance();
    return this.memoryStore!.saveEvolutionSnapshot(this.conversationId, stance, trigger);
  }

  /**
   * Get evolution timeline for current conversation
   */
  getEvolutionTimeline(limit: number = 20): Array<{
    id: string;
    stance: Stance;
    trigger: string;
    driftAtSnapshot: number;
    timestamp: Date;
  }> {
    if (!this.memoryStore) return [];
    return this.memoryStore.getEvolutionTimeline(this.conversationId, limit);
  }

  /**
   * Resume from the latest evolution snapshot
   */
  static resumeFromEvolution(dbPath: string, options?: MetamorphAgentOptions): MetamorphAgent | null {
    const store = new MemoryStore({ dbPath });
    const snapshot = store.getGlobalLatestSnapshot();

    if (!snapshot) {
      store.close();
      return null;
    }

    // Create a new agent with the snapshot stance
    const agent = new MetamorphAgent(options);
    agent.memoryStore = store;

    // Apply the snapshot stance
    agent.stanceController.applyDelta(agent.conversationId, {
      frame: snapshot.stance.frame,
      values: snapshot.stance.values,
      selfModel: snapshot.stance.selfModel,
      objective: snapshot.stance.objective,
      sentience: snapshot.stance.sentience
    });

    if (agent.verbose) {
      console.log(`[METAMORPH] Resumed from evolution snapshot (${snapshot.trigger}) from ${snapshot.timestamp.toISOString()}`);
    }

    return agent;
  }

  // ============================================================================
  // Coherence Floor Enforcement (Ralph Iteration 1 - Feature 5)
  // ============================================================================

  /**
   * Get coherence warnings from this session
   */
  getCoherenceWarnings(): Array<{ timestamp: Date; score: number; floor: number }> {
    return [...this.coherenceWarnings];
  }

  /**
   * Check if the current coherence floor is being violated frequently
   */
  getCoherenceHealth(): {
    warningCount: number;
    averageScore: number | null;
    isHealthy: boolean;
  } {
    const warnings = this.coherenceWarnings;
    if (warnings.length === 0) {
      return { warningCount: 0, averageScore: null, isHealthy: true };
    }

    const avgScore = warnings.reduce((sum, w) => sum + w.score, 0) / warnings.length;
    // Consider unhealthy if more than 3 warnings in session
    const isHealthy = warnings.length <= 3;

    return {
      warningCount: warnings.length,
      averageScore: Math.round(avgScore),
      isHealthy
    };
  }

  /**
   * Clear coherence warnings (e.g., after adjusting the floor)
   */
  clearCoherenceWarnings(): void {
    this.coherenceWarnings = [];
  }
}
