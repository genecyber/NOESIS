/**
 * MetamorphAgent - The core agent wrapping Claude Agent SDK with transformation capabilities
 *
 * CRITICAL: This is the ONE code path. Everything goes through MetamorphAgent.chat()
 */
import { Stance, ModeConfig, AgentResponse, PlannedOperation, TurnScores, ConversationMessage, TransformationHooks } from '../types/index.js';
import { type SubagentDefinition } from './subagents/index.js';
import { MemoryStore } from '../memory/index.js';
import type { MemoryEntry } from '../types/index.js';
import { type CommandResult } from '../commands/index.js';
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
    enableTransformation?: boolean;
    maxRegenerationAttempts?: number;
    disallowedTools?: string[];
}
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
 * MetamorphAgent - Transformation-maximizing AI agent
 *
 * Wraps Claude via @anthropic-ai/claude-agent-sdk with:
 * - Pre-turn hooks: Detect triggers, plan operators, build transformed system prompt
 * - Post-turn hooks: Score response, update stance, check coherence
 */
export declare class MetamorphAgent {
    private stanceController;
    private conversationId;
    private config;
    private hooks;
    private verbose;
    private workingDirectory;
    private sessionId;
    private transformationHistory;
    private memoryStore;
    private coherenceWarnings;
    private disallowedTools;
    constructor(options?: MetamorphAgentOptions);
    /**
     * Set transformation hooks for pre/post turn processing
     */
    setHooks(hooks: TransformationHooks): void;
    /**
     * Get the current stance
     */
    getCurrentStance(): Stance;
    /**
     * Get conversation history
     */
    getHistory(): ConversationMessage[];
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ModeConfig>): void;
    /**
     * Main chat method - THE single code path for all interactions
     */
    chat(message: string): Promise<AgentResponse>;
    /**
     * Streaming chat method with callbacks
     */
    chatStream(message: string, callbacks: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Export conversation state for persistence
     */
    exportState(): string;
    /**
     * Resume from exported state
     */
    static fromState(json: string, options?: MetamorphAgentOptions): MetamorphAgent;
    /**
     * Get the conversation ID
     */
    getConversationId(): string;
    /**
     * Get current config
     */
    getConfig(): ModeConfig;
    /**
     * Get the session ID (for resuming conversations)
     */
    getSessionId(): string | undefined;
    /**
     * Get the memory store (Ralph Iteration 2 - Feature 2)
     */
    getMemoryStore(): MemoryStore;
    /**
     * Get available subagent names
     */
    getAvailableSubagents(): string[];
    /**
     * Get subagent definitions for the current stance
     */
    getSubagentDefinitions(): SubagentDefinition[];
    /**
     * Get a specific subagent definition
     */
    getSubagentDefinition(name: string): SubagentDefinition | undefined;
    /**
     * Invoke a specific subagent directly
     *
     * This allows programmatic invocation of subagents for specific tasks:
     * - explorer: Deep investigation of a topic
     * - verifier: Validate an output
     * - reflector: Self-reflection on behavior
     * - dialectic: Thesis/antithesis/synthesis reasoning
     */
    invokeSubagent(subagentName: string, task: string, callbacks?: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Run the explorer subagent for autonomous investigation
     */
    explore(topic: string, callbacks?: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Run the verifier subagent to check an output
     */
    verify(output: string, context?: string, callbacks?: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Run the reflector subagent for self-analysis
     */
    reflect(focus?: string, callbacks?: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Run the dialectic subagent for thesis/antithesis/synthesis
     */
    dialectic(thesis: string, callbacks?: StreamCallbacks): Promise<AgentResponse>;
    /**
     * Get transformation history
     */
    getTransformationHistory(): TransformationHistoryEntry[];
    /**
     * Record a transformation in history
     */
    private recordTransformation;
    /**
     * Detect and execute auto-invoked commands based on message content
     */
    private executeAutoCommands;
    /**
     * Manually invoke a command (for agent tool use)
     */
    invokeCommand(command: string, args?: string[]): CommandResult | null;
    /**
     * List available commands for agent use
     */
    listCommands(): Array<{
        name: string;
        description: string;
        aliases: string[];
    }>;
    /**
     * Initialize memory store if not already initialized
     */
    private ensureMemoryStore;
    /**
     * Store a memory
     */
    storeMemory(content: string, type?: 'episodic' | 'semantic' | 'identity', importance?: number): string;
    /**
     * Search memories
     */
    searchMemories(query?: {
        type?: 'episodic' | 'semantic' | 'identity';
        minImportance?: number;
        limit?: number;
    }): MemoryEntry[];
    /**
     * Get all memories
     */
    getAllMemories(limit?: number): MemoryEntry[];
    /**
     * Set a persistent memory store path
     */
    setMemoryStorePath(dbPath: string): void;
    /**
     * Enable evolution persistence with auto-snapshotting
     */
    enableEvolutionPersistence(dbPath?: string): void;
    /**
     * Check and auto-snapshot if drift threshold exceeded
     */
    private checkAndAutoSnapshot;
    /**
     * Save an evolution snapshot manually
     */
    saveEvolutionSnapshot(trigger?: 'manual' | 'session_end'): string | null;
    /**
     * Get evolution timeline for current conversation
     */
    getEvolutionTimeline(limit?: number): Array<{
        id: string;
        stance: Stance;
        trigger: string;
        driftAtSnapshot: number;
        timestamp: Date;
    }>;
    /**
     * Resume from the latest evolution snapshot
     */
    static resumeFromEvolution(dbPath: string, options?: MetamorphAgentOptions): MetamorphAgent | null;
    /**
     * Get coherence warnings from this session
     */
    getCoherenceWarnings(): Array<{
        timestamp: Date;
        score: number;
        floor: number;
    }>;
    /**
     * Check if the current coherence floor is being violated frequently
     */
    getCoherenceHealth(): {
        warningCount: number;
        averageScore: number | null;
        isHealthy: boolean;
    };
    /**
     * Clear coherence warnings (e.g., after adjusting the floor)
     */
    clearCoherenceWarnings(): void;
}
//# sourceMappingURL=index.d.ts.map