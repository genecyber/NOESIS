/**
 * Semantic Trigger Detector
 * Uses embeddings to detect command triggers based on semantic similarity
 */

import type { EmbeddingService } from './service.js';
import type { TriggerType, StanceCondition, DetectedTrigger } from '../commands/registry.js';
import type { Stance, ModeConfig } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface SemanticTrigger {
  /** Trigger type identifier */
  type: TriggerType;

  /** Example phrases representing this intent */
  intents: string[];

  /** Cosine similarity threshold (0-1) for triggering */
  threshold: number;

  /** Optional stance conditions */
  stanceConditions?: StanceCondition[];
}

export interface SemanticCommandDefinition {
  name: string;
  semanticTriggers?: SemanticTrigger[];
}

interface IntentEmbedding {
  intent: string;
  embedding: number[];
  trigger: SemanticTrigger;
  commandName: string;
}

// ============================================================================
// Semantic Trigger Detector
// ============================================================================

export class SemanticTriggerDetector {
  private embeddingService: EmbeddingService;
  private intentEmbeddings: IntentEmbedding[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Pre-compute embeddings for all command intents
   */
  async initialize(commands: SemanticCommandDefinition[]): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize(commands);
    await this.initPromise;
  }

  private async _initialize(commands: SemanticCommandDefinition[]): Promise<void> {
    console.log('Pre-computing semantic trigger embeddings...');

    const allIntents: string[] = [];
    const intentMetadata: Array<{ commandName: string; trigger: SemanticTrigger; intentIndex: number }> = [];

    // Collect all intents
    for (const command of commands) {
      if (!command.semanticTriggers) continue;

      for (const trigger of command.semanticTriggers) {
        for (const intent of trigger.intents) {
          intentMetadata.push({
            commandName: command.name,
            trigger,
            intentIndex: allIntents.length,
          });
          allIntents.push(intent);
        }
      }
    }

    if (allIntents.length === 0) {
      console.log('No semantic triggers to initialize');
      this.initialized = true;
      return;
    }

    // Batch embed all intents
    const embeddings = await this.embeddingService.embedBatch(allIntents);

    // Store with metadata
    this.intentEmbeddings = intentMetadata.map((meta, idx) => ({
      intent: allIntents[meta.intentIndex],
      embedding: embeddings[idx],
      trigger: meta.trigger,
      commandName: meta.commandName,
    }));

    this.initialized = true;
    console.log(`Initialized ${this.intentEmbeddings.length} semantic trigger intents`);
  }

  /**
   * Check if detector is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Detect triggers based on semantic similarity
   */
  async detectTriggers(
    message: string,
    stance: Stance,
    config: ModeConfig,
    maxTriggers: number = 2
  ): Promise<DetectedTrigger[]> {
    if (!this.initialized || this.intentEmbeddings.length === 0) {
      return [];
    }

    const threshold = config.semanticTriggerThreshold ?? config.autoCommandThreshold ?? 0.6;
    const whitelist = config.autoCommandWhitelist || [];
    const blacklist = config.autoCommandBlacklist || [];

    // Embed the message
    const messageEmbedding = await this.embeddingService.embed(message);

    // Find matches grouped by command
    const commandMatches: Map<string, { similarity: number; intent: IntentEmbedding }> = new Map();

    for (const intentEmbed of this.intentEmbeddings) {
      // Check whitelist/blacklist
      if (whitelist.length > 0 && !whitelist.includes(intentEmbed.commandName)) {
        continue;
      }
      if (blacklist.includes(intentEmbed.commandName)) {
        continue;
      }

      const similarity = this.embeddingService.cosineSimilarity(
        messageEmbedding,
        intentEmbed.embedding
      );

      // Keep best match per command
      const existing = commandMatches.get(intentEmbed.commandName);
      if (!existing || similarity > existing.similarity) {
        commandMatches.set(intentEmbed.commandName, { similarity, intent: intentEmbed });
      }
    }

    // Filter by threshold and stance conditions
    const detected: DetectedTrigger[] = [];

    for (const [commandName, match] of commandMatches) {
      const { similarity, intent } = match;

      // Check threshold
      if (similarity < intent.trigger.threshold && similarity < threshold) {
        continue;
      }

      // Check stance conditions
      if (intent.trigger.stanceConditions) {
        if (!this.checkStanceConditions(stance, intent.trigger.stanceConditions)) {
          continue;
        }
      }

      detected.push({
        command: commandName,
        trigger: {
          type: intent.trigger.type,
          patterns: [], // Not used for semantic
          confidence: similarity,
        },
        confidence: similarity,
        matchedPattern: intent.intent,
      });
    }

    // Sort by confidence and limit
    return detected
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTriggers);
  }

  /**
   * Check if stance matches conditions
   */
  private checkStanceConditions(stance: Stance, conditions: StanceCondition[]): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(stance, condition.field);

      switch (condition.operator) {
        case 'lt':
          if (typeof value !== 'number' || value >= (condition.value as number)) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (condition.value as number)) return false;
          break;
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'contains':
          if (Array.isArray(value)) {
            if (!value.includes(condition.value as string)) return false;
          } else if (typeof value === 'string') {
            if (!value.includes(condition.value as string)) return false;
          } else {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Get statistics about loaded intents
   */
  getStats(): { commandCount: number; intentCount: number; initialized: boolean } {
    const commandNames = new Set(this.intentEmbeddings.map(i => i.commandName));
    return {
      commandCount: commandNames.size,
      intentCount: this.intentEmbeddings.length,
      initialized: this.initialized,
    };
  }
}
