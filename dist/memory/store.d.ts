/**
 * MemoryStore - SQLite-based persistent memory for conversations and identity
 */
import { MemoryEntry, IdentityState, Conversation, Stance } from '../types/index.js';
export interface MemoryStoreOptions {
    dbPath?: string;
    inMemory?: boolean;
}
export declare class MemoryStore {
    private db;
    constructor(options?: MemoryStoreOptions);
    private initSchema;
    saveConversation(conversation: Conversation): void;
    loadConversation(id: string): Conversation | null;
    listConversations(): Array<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        messageCount: number;
    }>;
    deleteConversation(id: string): boolean;
    saveIdentity(identity: IdentityState): void;
    loadIdentity(id?: string): IdentityState | null;
    /**
     * Create identity state from a stance
     */
    createIdentityFromStance(stance: Stance): IdentityState;
    addMemory(entry: Omit<MemoryEntry, 'id'>): string;
    getMemory(id: string): MemoryEntry | null;
    searchMemories(query: {
        type?: 'episodic' | 'semantic' | 'identity';
        minImportance?: number;
        limit?: number;
    }): MemoryEntry[];
    /**
     * Apply decay to all memories
     */
    applyDecay(decayFactor?: number): void;
    /**
     * Add memory with embedding
     */
    addMemoryWithEmbedding(entry: Omit<MemoryEntry, 'id'>, embedding: number[]): string;
    /**
     * Get all memories with embeddings for semantic search
     */
    getMemoriesWithEmbeddings(): Array<MemoryEntry & {
        embedding: number[];
    }>;
    /**
     * Semantic similarity search using cosine similarity
     */
    semanticSearch(queryEmbedding: number[], options?: {
        type?: 'episodic' | 'semantic' | 'identity';
        minSimilarity?: number;
        limit?: number;
    }): Array<MemoryEntry & {
        similarity: number;
    }>;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Find similar memories to a given text (requires external embedding)
     */
    findSimilarByContent(content: string, existingMemories: Array<{
        content: string;
        embedding: number[];
    }>): number[] | null;
    /**
     * Save an evolution snapshot
     */
    saveEvolutionSnapshot(conversationId: string, stance: Stance, trigger: 'drift_threshold' | 'frame_shift' | 'manual' | 'session_end'): string;
    /**
     * Get the latest evolution snapshot for a conversation
     */
    getLatestSnapshot(conversationId: string): {
        stance: Stance;
        trigger: string;
        timestamp: Date;
    } | null;
    /**
     * Get the latest snapshot across all conversations (for session resume)
     */
    getGlobalLatestSnapshot(): {
        conversationId: string;
        stance: Stance;
        trigger: string;
        timestamp: Date;
    } | null;
    /**
     * Get evolution timeline for a conversation
     */
    getEvolutionTimeline(conversationId: string, limit?: number): Array<{
        id: string;
        stance: Stance;
        trigger: string;
        driftAtSnapshot: number;
        timestamp: Date;
    }>;
    /**
     * Check if a snapshot should be auto-saved (based on drift threshold)
     */
    shouldAutoSnapshot(conversationId: string, currentDrift: number, threshold?: number): boolean;
    /**
     * Session info returned by list/get operations
     */
    getSessionInfo(sessionId: string): SessionInfo | null;
    /**
     * Create or update a session
     */
    saveSession(session: {
        id: string;
        name?: string;
        conversationId?: string;
        messageCount?: number;
        currentFrame?: string;
        currentDrift?: number;
    }): void;
    /**
     * List all sessions with metadata
     */
    listSessions(options?: {
        limit?: number;
        search?: string;
    }): SessionInfo[];
    /**
     * Rename a session
     */
    renameSession(sessionId: string, newName: string): boolean;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): boolean;
    /**
     * Get most recently accessed session
     */
    getMostRecentSession(): SessionInfo | null;
    /**
     * Record operator performance for learning
     */
    recordOperatorPerformance(entry: {
        operatorName: string;
        triggerType: string;
        transformationScore: number;
        coherenceScore: number;
        driftCost: number;
    }): string;
    /**
     * Get operator performance statistics
     */
    getOperatorStats(operatorName?: string): OperatorStats[];
    /**
     * Get weighted operator score for Bayesian selection
     */
    getOperatorWeight(operatorName: string, triggerType: string): number;
    /**
     * Cache a subagent result
     */
    cacheSubagentResult(entry: {
        subagentName: string;
        task: string;
        response: string;
        keyFindings?: string[];
        relevance: number;
        conversationId?: string;
        expiryHours?: number;
    }): string;
    /**
     * Search for relevant cached subagent results
     */
    searchSubagentCache(query: {
        subagentName?: string;
        task?: string;
        minRelevance?: number;
        limit?: number;
    }): SubagentResult[];
    /**
     * Clean expired subagent results
     */
    cleanExpiredSubagentResults(): number;
    close(): void;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
}
export interface SessionInfo {
    id: string;
    name?: string;
    conversationId?: string;
    lastAccessed: Date;
    createdAt: Date;
    messageCount: number;
    currentFrame?: string;
    currentDrift: number;
}
export interface OperatorStats {
    operatorName: string;
    triggerType: string;
    usageCount: number;
    avgEffectiveness: number;
    avgTransformation: number;
    avgCoherence: number;
    avgDrift: number;
}
export interface SubagentResult {
    id: string;
    subagentName: string;
    task: string;
    response: string;
    keyFindings?: string[];
    relevance: number;
    conversationId?: string;
    timestamp: Date;
    expiry?: Date;
}
//# sourceMappingURL=store.d.ts.map