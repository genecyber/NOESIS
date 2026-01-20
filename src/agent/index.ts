/**
 * MetamorphAgent - The core agent wrapping Claude Agent SDK with transformation capabilities
 *
 * CRITICAL: This is the ONE code path. Everything goes through MetamorphAgent.chat()
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';  // Ensure environment variables are loaded
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
  createDefaultConfig,
  EmotionContext
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
import { setStanceProvider as setIntrospectionStanceProvider, setHistoryProvider } from '../tools/introspection.js';
import { setStanceProvider as setAnalysisStanceProvider } from '../tools/analysis.js';
import { setMemoryProvider } from '../tools/memory.js';
import { createMetamorphMcpServer } from '../tools/mcp-server.js';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { autoEvolutionManager } from '../core/auto-evolution.js';
import { identityPersistence } from '../core/identity-persistence.js';
import { memoryInjector } from '../memory/proactive-injection.js';
import { pluginEventBus } from '../plugins/event-bus.js';

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
  dbPath?: string;  // Path to SQLite database (default: ./data/metamorph.db)
  inMemory?: boolean;  // Force in-memory storage (default: false, for tests)
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

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface QuestionEvent {
  id: string;
  questions: Question[];
  status: 'pending' | 'answered' | 'cancelled';
}

export interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (tool: string) => void;
  onToolEvent?: (event: ToolUseEvent) => void | Promise<void>;
  onQuestion?: (question: QuestionEvent) => void;
  onSubagent?: (name: string, status: 'start' | 'end') => void;
  onComplete?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Options for chat method calls
 */
export interface ChatOptions {
  /** Real-time emotion context from webcam detection */
  emotionContext?: EmotionContext;
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
  private dbPath?: string;
  private storageInMemory: boolean;
  private _lastVisionRequest: number | null = null;
  private _currentEmotionContext: EmotionContext | null = null;

  constructor(options: MetamorphAgentOptions = {}) {
    this.config = { ...createDefaultConfig(), ...options.config };
    this.verbose = options.verbose ?? false;
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.disallowedTools = options.disallowedTools ?? [];
    this.dbPath = options.dbPath;
    this.storageInMemory = options.inMemory ?? false;  // Default to file-based storage
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

    // Wire all tool providers for MCP tools
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Command tools provider
    setAgentProvider(() => self);

    // Introspection tools providers
    setIntrospectionStanceProvider(() => self.getCurrentStance());
    setHistoryProvider(() => {
      const history = self.getTransformationHistory();
      return history.map(entry => ({
        timestamp: entry.timestamp.getTime(),
        stance: entry.stanceAfter,
        trigger: entry.operators.map(op => op.name).join(', ') || 'natural'
      }));
    });

    // Analysis tools provider
    setAnalysisStanceProvider(() => self.getCurrentStance());

    // Memory tools provider
    setMemoryProvider({
      store: (memory) => {
        const store = self.getMemoryStore();
        const id = store.addMemory({
          ...memory,
          timestamp: new Date(),
          decay: 0.99
        });
        const entries = store.searchMemories({ limit: 1 });
        return entries[0] || { ...memory, id, timestamp: new Date(), decay: 0.99 };
      },
      recall: (query, limit = 10) => {
        const store = self.getMemoryStore();
        // For now, use type-based search if query matches a type, otherwise get all
        const type = ['episodic', 'semantic', 'identity'].includes(query) ? query as 'episodic' | 'semantic' | 'identity' : undefined;
        return store.searchMemories({ type, limit });
      },
      getAll: () => {
        const store = self.getMemoryStore();
        return store.searchMemories({ limit: 100 });
      },
      delete: (_id) => {
        // Memory deletion not yet implemented in MemoryStore
        // TODO: Add deleteMemory method to MemoryStore
        return false;
      }
    });

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
  updateConfig(newConfig: Partial<ModeConfig>): void {
    // Emit config:changed event for plugins
    pluginEventBus?.emit('config:changed', { config: newConfig as Record<string, unknown> });

    // Emit specific empathyMode event if that setting changed
    if (newConfig.enableEmpathyMode !== undefined &&
        newConfig.enableEmpathyMode !== this.config.enableEmpathyMode) {
      pluginEventBus?.emit('config:empathyMode', newConfig.enableEmpathyMode);
    }

    this.config = { ...this.config, ...newConfig };
    this.stanceController.updateConfig(this.conversationId, this.config);
  }

  /**
   * Main chat method - THE single code path for all interactions
   * @param message - The user's message
   * @param options - Optional settings including emotionContext for empathy mode
   */
  async chat(message: string, options?: ChatOptions): Promise<AgentResponse> {
    const stanceBefore = this.getCurrentStance();
    const conversationHistory = this.getHistory();

    // Emit turn:start event for plugins
    pluginEventBus?.emit('turn:start', {
      message,
      stance: this.getCurrentStance()
    });

    // 0. AUTO-COMMAND DETECTION AND EXECUTION
    const autoInvokedCommands = this.executeAutoCommands(message, stanceBefore);

    // 1. PRE-TURN: Build transformed system prompt
    let systemPrompt: string;
    let operators: PlannedOperation[] = [];

    // Get emotion context: use explicit option, or fall back to stored vision analysis
    const emotionContext = options?.emotionContext ?? this._currentEmotionContext ?? undefined;

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory,
        conversationId: this.conversationId,
        emotionContext  // Pass emotion context for empathy mode
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

        // Emit stance:changed event for plugins
        pluginEventBus?.emit('stance:changed', {
          before: stanceBefore,
          after: stanceAfter
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

    // Auto-Evolution Manager integration (Ralph Iteration 4 - Feature 2)
    if (this.config.enableAutoEvolution !== false) {
      autoEvolutionManager.recordStance(this.conversationId, stanceAfter);
      autoEvolutionManager.recordCoherence(this.conversationId, scores.coherence);
      const evolutionTrigger = autoEvolutionManager.checkForTriggers(
        this.conversationId,
        stanceAfter,
        this.stanceController.getHistory(this.conversationId)
      );
      if (evolutionTrigger && this.verbose) {
        console.log(`[METAMORPH] Auto-evolution trigger: ${evolutionTrigger.type} (confidence: ${evolutionTrigger.confidence})`);
      }
    }

    // Identity Persistence Manager integration (Ralph Iteration 5 - Feature 2)
    if (this.config.enableIdentityPersistence !== false) {
      identityPersistence.recordTurn();
      if (identityPersistence.shouldAutoCheckpoint()) {
        identityPersistence.createCheckpoint(stanceAfter, `auto-turn-${stanceAfter.version}`);
        if (this.verbose) {
          console.log(`[METAMORPH] Identity checkpoint created at version ${stanceAfter.version}`);
        }
      }
    }

    // Proactive Memory Injection - record turn for cooldown tracking
    if (this.config.enableProactiveMemory !== false) {
      memoryInjector.recordTurn();
    }

    const response: AgentResponse = {
      response: responseText,
      stanceBefore,
      stanceAfter,
      operationsApplied: operators,
      scores,
      toolsUsed,
      subagentsInvoked,
      coherenceWarning
    };

    // Emit turn:complete event for plugins
    pluginEventBus?.emit('turn:complete', {
      response: {
        text: responseText,
        toolsUsed,
        operatorsApplied: operators.map(op => op.name)
      }
    });

    return response;
  }

  /**
   * Streaming chat method with callbacks
   * @param message - The user's message
   * @param callbacks - Stream callbacks for real-time updates
   * @param options - Optional settings including emotionContext for empathy mode
   */
  async chatStream(message: string, callbacks: StreamCallbacks, options?: ChatOptions): Promise<AgentResponse> {
    const stanceBefore = this.getCurrentStance();
    const conversationHistory = this.getHistory();

    // Emit turn:start event for plugins
    pluginEventBus?.emit('turn:start', {
      message,
      stance: this.getCurrentStance()
    });

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

    // Get emotion context: use explicit option, or fall back to stored vision analysis
    const emotionContext = options?.emotionContext ?? this._currentEmotionContext ?? undefined;

    if (this.hooks) {
      const preTurnContext: PreTurnContext = {
        message,
        stance: stanceBefore,
        config: this.config,
        conversationHistory,
        conversationId: this.conversationId,
        emotionContext  // Pass emotion context for empathy mode
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
              // Await onToolEvent in case it's async (e.g., for AskUserQuestion tool)
              await callbacks.onToolEvent?.({
                id: block.id,
                name: block.name,
                input: block.input,
                status: 'started',
              });

              // Detect AskUserQuestion tool and emit question event
              if (block.name === 'AskUserQuestion' && callbacks.onQuestion) {
                type QuestionType = {
                  question: string;
                  header: string;
                  options: Array<{ label: string; description: string }>;
                  multiSelect: boolean;
                };

                // Handle both input formats:
                // 1. { questions: [...] } - standard SDK format
                // 2. [...] - array directly (some SDK versions)
                let questions: QuestionType[] | undefined;

                if (Array.isArray(block.input)) {
                  // Input is an array of questions directly
                  questions = block.input as QuestionType[];
                } else if (block.input && typeof block.input === 'object') {
                  const inputObj = block.input as { questions?: QuestionType[] };
                  questions = inputObj.questions;
                }

                if (questions && Array.isArray(questions) && questions.length > 0) {
                  if (this.verbose) {
                    console.log('[METAMORPH] AskUserQuestion detected:', JSON.stringify(questions, null, 2));
                  }
                  callbacks.onQuestion({
                    id: block.id,
                    questions: questions,
                    status: 'pending'
                  });
                } else if (this.verbose) {
                  console.log('[METAMORPH] AskUserQuestion input not recognized:', JSON.stringify(block.input));
                }
              }
            }
          }
        }

        // Handle tool results (user messages with tool_result)
        if (event.type === 'user') {
          const toolResult = extractToolResultFromMessage(event);
          if (toolResult) {
            const toolBlock = activeTools.get(toolResult.toolUseId);
            if (toolBlock) {
              await callbacks.onToolEvent?.({
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

          // Emit stance:changed event for plugins
          pluginEventBus?.emit('stance:changed', {
            before: stanceBefore,
            after: stanceAfter
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

      // Auto-Evolution Manager integration (Ralph Iteration 4 - Feature 2)
      if (this.config.enableAutoEvolution !== false) {
        autoEvolutionManager.recordStance(this.conversationId, stanceAfter);
        autoEvolutionManager.recordCoherence(this.conversationId, scores.coherence);
        const evolutionTrigger = autoEvolutionManager.checkForTriggers(
          this.conversationId,
          stanceAfter,
          this.stanceController.getHistory(this.conversationId)
        );
        if (evolutionTrigger && this.verbose) {
          console.log(`[METAMORPH] Auto-evolution trigger: ${evolutionTrigger.type} (confidence: ${evolutionTrigger.confidence})`);
        }
      }

      // Identity Persistence Manager integration (Ralph Iteration 5 - Feature 2)
      if (this.config.enableIdentityPersistence !== false) {
        identityPersistence.recordTurn();
        if (identityPersistence.shouldAutoCheckpoint()) {
          identityPersistence.createCheckpoint(stanceAfter, `auto-turn-${stanceAfter.version}`);
          if (this.verbose) {
            console.log(`[METAMORPH] Identity checkpoint created at version ${stanceAfter.version}`);
          }
        }
      }

      // Proactive Memory Injection - record turn for cooldown tracking
      if (this.config.enableProactiveMemory !== false) {
        memoryInjector.recordTurn();
      }

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

      // Emit turn:complete event for plugins
      pluginEventBus?.emit('turn:complete', {
        response: {
          text: responseText,
          toolsUsed,
          operatorsApplied: operators.map(op => op.name)
        }
      });

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
   * Chat with vision capability - sends an image along with the message
   * Used when empathy mode needs to send webcam frames to Claude for analysis
   *
   * @param message - The text message
   * @param imageDataUrl - Base64 data URL of the image (e.g., "data:image/jpeg;base64,...")
   * @returns AgentResponse
   */
  async chatWithVision(message: string, imageDataUrl?: string): Promise<AgentResponse> {
    // Rate limiting - prevent excessive vision requests
    const VISION_COOLDOWN_MS = 60000; // 60 second cooldown (once per minute)
    const now = Date.now();

    if (this._lastVisionRequest && (now - this._lastVisionRequest) < VISION_COOLDOWN_MS) {
      // Too soon - return error, don't fall back to regular chat
      const waitTime = Math.ceil((VISION_COOLDOWN_MS - (now - this._lastVisionRequest)) / 1000);
      console.log(`[METAMORPH] Vision request rate limited, retry in ${waitTime}s`);
      throw new Error(`Vision rate limited. Retry in ${waitTime} seconds.`);
    }

    if (!imageDataUrl) {
      console.log(`[METAMORPH] Vision request missing image`);
      throw new Error('Vision request requires an image');
    }

    if (!this.config.enableEmpathyMode) {
      console.log(`[METAMORPH] Empathy mode disabled, vision request rejected`);
      throw new Error('Empathy mode is disabled');
    }

    this._lastVisionRequest = now;

    // Build vision-capable message content
    const messageContent: Array<{
      type: 'image' | 'text';
      source?: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png';
        data: string;
      };
      text?: string;
    }> = [];

    // Add the image first
    const base64Match = imageDataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
    if (base64Match) {
      const [, mediaType, base64Data] = base64Match;
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: `image/${mediaType}` as 'image/jpeg' | 'image/png',
          data: base64Data
        }
      });

      if (this.verbose) {
        console.log(`[METAMORPH] Vision request with ${mediaType} image (${Math.round(base64Data.length / 1024)}KB)`);
      }
    } else {
      // Invalid image format - throw error, don't fall back
      console.log(`[METAMORPH] Invalid image format (expected data:image/jpeg or png;base64,...)`);
      throw new Error('Invalid image format. Expected base64 data URL (data:image/jpeg;base64,... or data:image/png;base64,...)');
    }

    // Add the text message
    messageContent.push({
      type: 'text',
      text: message
    });

    // Build the full message with vision content
    const visionMessage = {
      role: 'user' as const,
      content: messageContent
    };

    // Use existing chat flow but with vision message
    // This should integrate with the rest of the processing pipeline
    return this._processVisionChat(visionMessage, message);
  }

  /**
   * Internal method to process vision chat using direct Anthropic API
   * The Claude Agent SDK doesn't support multimodal, so we use the direct API for vision
   */
  private async _processVisionChat(
    visionMessage: {
      role: 'user';
      content: Array<{
        type: 'image' | 'text';
        source?: {
          type: 'base64';
          media_type: 'image/jpeg' | 'image/png';
          data: string;
        };
        text?: string;
      }>;
    },
    originalMessage: string
  ): Promise<AgentResponse> {
    // Emit turn:start for plugins with vision context
    pluginEventBus?.emit?.('turn:start', {
      message: originalMessage,
      stance: this.getCurrentStance(),
      hasVision: true
    });

    const stanceBefore = this.getCurrentStance();

    try {
      // Use direct Anthropic API for vision (Claude Agent SDK doesn't support multimodal)
      const anthropic = new Anthropic();

      // Build properly typed content array for Anthropic API
      type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const apiContent: Array<
        | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
        | { type: 'text'; text: string }
      > = [];

      for (const block of visionMessage.content) {
        if (block.type === 'image' && block.source) {
          // Validate media type
          const mediaType = block.source.media_type as ImageMediaType;
          if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
            console.error(`[METAMORPH] Vision: Invalid media type: ${block.source.media_type}`);
            continue;
          }
          apiContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: block.source.data
            }
          });
          console.log(`[METAMORPH] Vision: Adding image (${Math.round(block.source.data.length / 1024)}KB, ${mediaType})`);
        } else if (block.type === 'text' && block.text) {
          apiContent.push({
            type: 'text',
            text: block.text
          });
          console.log(`[METAMORPH] Vision: Adding text prompt (${block.text.length} chars)`);
        }
      }

      console.log(`[METAMORPH] Sending vision request to Claude via direct API with ${apiContent.length} content blocks`);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5', // Vision requires a vision-capable model
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: apiContent
          }
        ]
      });

      // Extract text response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      if (this.verbose) {
        console.log(`[METAMORPH] Vision response received (${responseText.length} chars)`);
      }

      // For vision responses, we don't apply the full transformation pipeline
      // since this is primarily for emotion detection, not conversation
      const result: AgentResponse = {
        response: responseText,
        stanceBefore,
        stanceAfter: stanceBefore, // Vision requests don't transform stance
        operationsApplied: [],
        scores: {
          transformation: 0,
          coherence: 100,
          sentience: stanceBefore.sentience.awarenessLevel,
          overall: 50
        },
        toolsUsed: [],
        subagentsInvoked: []
      };

      // Emit turn:complete event
      pluginEventBus?.emit?.('turn:complete', {
        response: {
          text: responseText,
          toolsUsed: [],
          operatorsApplied: []
        }
      });

      return result;
    } catch (error) {
      if (this.verbose) {
        console.error(`[METAMORPH] Vision API error:`, error);
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
   * Uses file-based SQLite by default (./data/metamorph.db)
   * Pass inMemory: true in options for in-memory storage (useful for tests)
   */
  private ensureMemoryStore(): MemoryStore {
    if (!this.memoryStore) {
      this.memoryStore = new MemoryStore({
        dbPath: this.dbPath,
        inMemory: this.storageInMemory
      });
      if (this.verbose) {
        const location = this.storageInMemory ? ':memory:' : (this.dbPath || './data/metamorph.db');
        console.log(`[METAMORPH] Memory store initialized at ${location}`);
      }
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

  // ============================================================================
  // Emotion Context (Empathy Mode - Vision Pipeline)
  // ============================================================================

  /**
   * Get the current emotion context detected from vision
   * This is used by hooks/operators to influence responses
   */
  getEmotionContext(): EmotionContext | null {
    return this._currentEmotionContext;
  }

  /**
   * Set the emotion context (called by vision analysis)
   */
  setEmotionContext(context: EmotionContext | null): void {
    this._currentEmotionContext = context;
    if (context && this.verbose) {
      console.log(`[METAMORPH] Emotion context set: ${context.currentEmotion} (confidence: ${Math.round(context.confidence * 100)}%)`);
    }
  }

  /**
   * Analyze an image for emotions using Claude Vision API
   * This method ONLY analyzes the image and stores the emotion context.
   * It does NOT process a chat message - use chat() after this for responses.
   *
   * @param imageDataUrl - Base64 data URL of the image
   * @returns The detected EmotionContext
   */
  async analyzeVisionEmotion(imageDataUrl: string): Promise<EmotionContext> {
    // Rate limiting
    const VISION_COOLDOWN_MS = 60000;
    const now = Date.now();

    if (this._lastVisionRequest && (now - this._lastVisionRequest) < VISION_COOLDOWN_MS) {
      const waitTime = Math.ceil((VISION_COOLDOWN_MS - (now - this._lastVisionRequest)) / 1000);
      throw new Error(`Vision rate limited. Retry in ${waitTime} seconds.`);
    }

    if (!this.config.enableEmpathyMode) {
      throw new Error('Empathy mode is disabled');
    }

    // Validate image format
    const base64Match = imageDataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image format. Expected base64 data URL (data:image/jpeg;base64,... or data:image/png;base64,...)');
    }

    this._lastVisionRequest = now;
    const [, mediaType, base64Data] = base64Match;

    try {
      // Ensure API key is available
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }

      const anthropic = new Anthropic({ apiKey });

      if (this.verbose) {
        console.log(`[METAMORPH] Analyzing emotion from ${mediaType} image (${Math.round(base64Data.length / 1024)}KB)`);
      }

      // Emotion analysis prompt - structured to get parseable output
      const emotionPrompt = `Analyze the person's facial expression and emotional state in this image.

Return your analysis in this exact JSON format:
{
  "emotion": "happy|sad|angry|fearful|surprised|disgusted|neutral|contempt",
  "valence": <number from -1 to 1, where -1 is very negative, 0 is neutral, 1 is very positive>,
  "arousal": <number from 0 to 1, where 0 is calm, 1 is highly activated/aroused>,
  "confidence": <number from 0 to 1, how confident you are in this assessment>,
  "description": "<brief natural language description of what you observe>"
}

Only return the JSON, no other text.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: `image/${mediaType}` as 'image/jpeg' | 'image/png',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: emotionPrompt
            }
          ]
        }]
      });

      // Extract text response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Parse the JSON response
      let emotionData: {
        emotion: string;
        valence: number;
        arousal: number;
        confidence: number;
        description: string;
      };

      try {
        // Handle potential markdown code blocks
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          emotionData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('[METAMORPH] Failed to parse emotion response:', responseText);
        // Return a default neutral emotion context if parsing fails
        emotionData = {
          emotion: 'neutral',
          valence: 0,
          arousal: 0.3,
          confidence: 0.3,
          description: 'Unable to parse emotion response'
        };
      }

      // Calculate suggested empathy boost based on valence
      // Negative emotions suggest higher empathy boost
      const suggestedEmpathyBoost = emotionData.valence < 0
        ? Math.round(Math.abs(emotionData.valence) * (this.config.empathyBoostMax || 20))
        : 0;

      // Calculate stability (inverse of arousal - calmer = more stable)
      const stability = 1 - emotionData.arousal;

      // Build the emotion context
      const emotionContext: EmotionContext = {
        currentEmotion: emotionData.emotion,
        valence: emotionData.valence,
        arousal: emotionData.arousal,
        confidence: emotionData.confidence,
        stability,
        suggestedEmpathyBoost,
        promptContext: `The user appears ${emotionData.emotion}. ${emotionData.description}`
      };

      // Store the emotion context for use in subsequent chat calls
      this.setEmotionContext(emotionContext);

      // Emit event for plugins
      pluginEventBus?.emit?.('emotion:detected', emotionContext);

      return emotionContext;
    } catch (error) {
      if (this.verbose) {
        console.error(`[METAMORPH] Vision emotion analysis error:`, error);
      }
      throw error;
    }
  }
}
