/**
 * StanceController - Manages stance creation, updates, and drift tracking
 */
import { Stance, StanceDelta, ModeConfig, Conversation, ConversationMessage } from '../types/index.js';
export declare class StanceController {
    private conversations;
    /**
     * Create a new conversation with default stance
     */
    createConversation(config?: Partial<ModeConfig>): Conversation;
    /**
     * Get a conversation by ID
     */
    getConversation(id: string): Conversation | undefined;
    /**
     * Get the current stance for a conversation
     */
    getCurrentStance(conversationId: string): Stance;
    /**
     * Apply a stance delta and return the new stance
     * Respects drift budget and constraints
     */
    applyDelta(conversationId: string, delta: StanceDelta): Stance;
    /**
     * Add a message to the conversation history
     */
    addMessage(conversationId: string, message: ConversationMessage): void;
    /**
     * Get conversation history
     */
    getHistory(conversationId: string): ConversationMessage[];
    /**
     * Update the configuration for a conversation
     */
    updateConfig(conversationId: string, config: Partial<ModeConfig>): void;
    /**
     * Calculate the magnitude of a stance delta
     */
    private calculateDriftMagnitude;
    /**
     * Scale a delta to fit within drift budget
     */
    private scaleDelta;
    /**
     * Merge value weights
     */
    private mergeValues;
    /**
     * Clamp a number to a range
     */
    private clamp;
    /**
     * Export a conversation for persistence
     */
    exportConversation(conversationId: string): string;
    /**
     * Import a conversation from JSON
     */
    importConversation(json: string): Conversation;
    /**
     * List all conversation IDs
     */
    listConversations(): string[];
    /**
     * Delete a conversation
     */
    deleteConversation(conversationId: string): boolean;
}
//# sourceMappingURL=stance-controller.d.ts.map