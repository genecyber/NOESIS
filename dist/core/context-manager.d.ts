/**
 * Context Window Management - Ralph Iteration 4 Feature 4
 *
 * Intelligent conversation summarization and context preservation
 * to maximize effective use of the context window.
 */
import { Stance, ConversationMessage } from '../types/index.js';
/**
 * Context importance levels
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low' | 'disposable';
/**
 * Message with importance scoring
 */
export interface ScoredMessage {
    message: ConversationMessage;
    importance: ImportanceLevel;
    score: number;
    reasons: string[];
    isCompacted: boolean;
}
/**
 * Context budget allocation
 */
export interface ContextBudget {
    totalTokens: number;
    usedTokens: number;
    availableTokens: number;
    systemReserve: number;
    memoryReserve: number;
    conversationAllocation: number;
}
/**
 * Compaction result
 */
export interface CompactionResult {
    originalMessages: number;
    compactedMessages: number;
    tokensSaved: number;
    summaries: string[];
    preservedCritical: number;
}
/**
 * Context window configuration
 */
export interface ContextConfig {
    maxTokens: number;
    systemReserveRatio: number;
    memoryReserveRatio: number;
    compressionThreshold: number;
    minPreservedTurns: number;
    summaryMaxLength: number;
}
/**
 * Context window manager
 */
declare class ContextWindowManager {
    private config;
    private conversationBuffer;
    private compactionHistory;
    /**
     * Set configuration
     */
    setConfig(config: Partial<ContextConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ContextConfig;
    /**
     * Estimate token count (rough approximation: ~4 chars per token)
     */
    estimateTokens(text: string): number;
    /**
     * Calculate context budget
     */
    calculateBudget(currentMessages: ConversationMessage[]): ContextBudget;
    /**
     * Score message importance
     */
    scoreMessage(message: ConversationMessage, stance: Stance, turnNumber: number): ScoredMessage;
    /**
     * Process conversation and score all messages
     */
    processConversation(conversationId: string, messages: ConversationMessage[], stance: Stance): ScoredMessage[];
    /**
     * Check if compaction is needed
     */
    needsCompaction(messages: ConversationMessage[]): boolean;
    /**
     * Generate summary for a group of messages
     */
    private summarizeMessages;
    /**
     * Compact conversation to fit within budget
     */
    compactConversation(conversationId: string, messages: ConversationMessage[], stance: Stance): {
        messages: ConversationMessage[];
        result: CompactionResult;
    };
    /**
     * Get context status for a conversation
     */
    getContextStatus(messages: ConversationMessage[]): {
        budget: ContextBudget;
        usagePercentage: number;
        needsCompaction: boolean;
        recommendation: string;
    };
    /**
     * Get compaction history for a conversation
     */
    getCompactionHistory(conversationId: string): CompactionResult[];
    /**
     * Extract key insights for long-term memory
     */
    extractKeyInsights(messages: ConversationMessage[], stance: Stance): string[];
    /**
     * Clear state for a conversation
     */
    clearState(conversationId: string): void;
}
export declare const contextManager: ContextWindowManager;
export {};
//# sourceMappingURL=context-manager.d.ts.map