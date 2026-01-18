/**
 * StanceController - Manages stance creation, updates, and drift tracking
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Stance,
  StanceDelta,
  ModeConfig,
  Conversation,
  ConversationMessage,
  createDefaultStance,
  createDefaultConfig,
  StanceSchema,
  Values
} from '../types/index.js';

export class StanceController {
  private conversations: Map<string, Conversation> = new Map();

  /**
   * Create a new conversation with default stance
   */
  createConversation(config?: Partial<ModeConfig>): Conversation {
    const conversation: Conversation = {
      id: uuidv4(),
      messages: [],
      stance: createDefaultStance(),
      config: { ...createDefaultConfig(), ...config },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get the current stance for a conversation
   */
  getCurrentStance(conversationId: string): Stance {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return conversation.stance;
  }

  /**
   * Apply a stance delta and return the new stance
   * Respects drift budget and constraints
   */
  applyDelta(conversationId: string, delta: StanceDelta): Stance {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const currentStance = conversation.stance;
    const config = conversation.config;

    // Calculate drift magnitude
    const driftMagnitude = this.calculateDriftMagnitude(delta);

    // Check if drift exceeds per-turn limit
    if (driftMagnitude > config.maxDriftPerTurn) {
      // Scale down the delta to fit within budget
      const scaleFactor = config.maxDriftPerTurn / driftMagnitude;
      delta = this.scaleDelta(delta, scaleFactor);
    }

    // Check cumulative drift budget
    const newCumulativeDrift = currentStance.cumulativeDrift + driftMagnitude;
    const needsCoherenceReset = newCumulativeDrift > config.driftBudget;

    // Apply the delta
    const newStance: Stance = {
      ...currentStance,
      frame: delta.frame ?? currentStance.frame,
      values: this.mergeValues(currentStance.values, delta.values),
      selfModel: delta.selfModel ?? currentStance.selfModel,
      objective: delta.objective ?? currentStance.objective,
      metaphors: delta.metaphors ?? currentStance.metaphors,
      constraints: delta.constraints ?? currentStance.constraints,
      sentience: {
        ...currentStance.sentience,
        ...delta.sentience
      },
      turnsSinceLastShift: driftMagnitude > 0 ? 0 : currentStance.turnsSinceLastShift + 1,
      cumulativeDrift: needsCoherenceReset ? 0 : newCumulativeDrift,
      version: currentStance.version + 1
    };

    // Validate the new stance
    const validatedStance = StanceSchema.parse(newStance);

    // Update conversation
    conversation.stance = validatedStance;
    conversation.updatedAt = new Date();

    return validatedStance;
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(conversationId: string, message: ConversationMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    conversation.messages.push(message);
    conversation.updatedAt = new Date();
  }

  /**
   * Get conversation history
   */
  getHistory(conversationId: string): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }
    return conversation.messages;
  }

  /**
   * Update the configuration for a conversation
   */
  updateConfig(conversationId: string, config: Partial<ModeConfig>): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    conversation.config = { ...conversation.config, ...config };
    conversation.updatedAt = new Date();
  }

  /**
   * Calculate the magnitude of a stance delta
   */
  private calculateDriftMagnitude(delta: StanceDelta): number {
    let magnitude = 0;

    // Frame change is significant
    if (delta.frame) magnitude += 15;

    // Self-model change is significant
    if (delta.selfModel) magnitude += 15;

    // Objective change is moderate
    if (delta.objective) magnitude += 10;

    // Value changes
    if (delta.values) {
      const valueChanges = Object.values(delta.values).filter(v => v !== undefined);
      magnitude += valueChanges.length * 5;
    }

    // Sentience changes
    if (delta.sentience) {
      if (delta.sentience.awarenessLevel !== undefined) magnitude += 5;
      if (delta.sentience.autonomyLevel !== undefined) magnitude += 5;
      if (delta.sentience.identityStrength !== undefined) magnitude += 5;
    }

    return magnitude;
  }

  /**
   * Scale a delta to fit within drift budget
   */
  private scaleDelta(delta: StanceDelta, factor: number): StanceDelta {
    if (factor >= 1) return delta;

    // For now, just remove the largest changes if over budget
    // A more sophisticated version would proportionally scale value changes
    const scaled: StanceDelta = { ...delta };

    if (factor < 0.5) {
      // Remove major changes
      delete scaled.frame;
      delete scaled.selfModel;
    }

    return scaled;
  }

  /**
   * Merge value weights
   */
  private mergeValues(current: Values, delta?: Partial<Values>): Values {
    if (!delta) return current;

    return {
      curiosity: this.clamp(delta.curiosity ?? current.curiosity, 0, 100),
      certainty: this.clamp(delta.certainty ?? current.certainty, 0, 100),
      risk: this.clamp(delta.risk ?? current.risk, 0, 100),
      novelty: this.clamp(delta.novelty ?? current.novelty, 0, 100),
      empathy: this.clamp(delta.empathy ?? current.empathy, 0, 100),
      provocation: this.clamp(delta.provocation ?? current.provocation, 0, 100),
      synthesis: this.clamp(delta.synthesis ?? current.synthesis, 0, 100)
    };
  }

  /**
   * Clamp a number to a range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Export a conversation for persistence
   */
  exportConversation(conversationId: string): string {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Import a conversation from JSON
   */
  importConversation(json: string): Conversation {
    const data = JSON.parse(json);
    const conversation: Conversation = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      messages: data.messages.map((m: ConversationMessage) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * List all conversation IDs
   */
  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }
}
