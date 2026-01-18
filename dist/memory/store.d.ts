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
//# sourceMappingURL=store.d.ts.map