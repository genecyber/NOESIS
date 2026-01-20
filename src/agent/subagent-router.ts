/**
 * Subagent Router
 * Uses semantic embeddings to automatically route messages to appropriate subagents
 * based on intent matching.
 */

import { getEmbeddingService, type EmbeddingService } from '../embeddings/service.js';
import type { ModeConfig } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type SubagentType = 'explorer' | 'verifier' | 'reflector' | 'dialectic';

export interface SubagentIntentDefinition {
  /** Subagent type identifier */
  subagent: SubagentType;

  /** Example phrases representing this intent */
  intents: string[];

  /** Description of what this subagent does */
  description: string;
}

export interface SubagentRouteResult {
  /** The detected subagent to invoke */
  subagent: SubagentType;

  /** Confidence of the match (0-1) */
  confidence: number;

  /** The intent phrase that matched best */
  matchedIntent: string;
}

interface IntentEmbedding {
  intent: string;
  embedding: number[];
  subagent: SubagentType;
}

// ============================================================================
// Intent Definitions for Each Subagent
// ============================================================================

export const SUBAGENT_INTENTS: SubagentIntentDefinition[] = [
  {
    subagent: 'explorer',
    description: 'Autonomous exploration agent for deep investigation of topics, code, and concepts',
    intents: [
      'investigate this topic deeply',
      'research this in depth',
      'explore this topic thoroughly',
      'analyze in depth',
      'dig deeper into this',
      'I want to understand this better',
      'can you explore this further',
      'research deeply',
      'investigate more',
      'what more can you find about this',
      'do a deep dive on this',
      'look into this comprehensively'
    ]
  },
  {
    subagent: 'verifier',
    description: 'Output validation agent for coherence, correctness, and quality checking',
    intents: [
      'check this for errors',
      'verify this is correct',
      'is this correct',
      'validate this',
      'can you confirm this',
      'double check this',
      'is this accurate',
      'fact check this',
      'verify the accuracy',
      'are there any mistakes',
      'review this for correctness',
      'check if this is right'
    ]
  },
  {
    subagent: 'reflector',
    description: 'Self-reflection agent for analyzing behavior patterns and identity evolution',
    intents: [
      'reflect on your behavior',
      'analyze my behavior patterns',
      'what patterns do you see',
      'reflect on this conversation',
      'how have you changed',
      'what have you learned about yourself',
      'self-reflection time',
      'analyze yourself',
      'what do you notice about your responses',
      'reflect on your evolution',
      'introspect about this',
      'examine your own thinking'
    ]
  },
  {
    subagent: 'dialectic',
    description: 'Thesis/antithesis/synthesis reasoning agent for deep exploration of ideas',
    intents: [
      'argue both sides of this',
      'thesis antithesis synthesis',
      'show the opposing view',
      'play devil\'s advocate',
      'what is the counter-argument',
      'present both perspectives',
      'dialectical analysis',
      'argue against your own position',
      'what would the opposite view say',
      'synthesize these opposing views',
      'explore the tension between these ideas',
      'give me the contrarian view'
    ]
  }
];

// ============================================================================
// Subagent Router
// ============================================================================

export class SubagentRouter {
  private embeddingService: EmbeddingService;
  private intentEmbeddings: IntentEmbedding[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService || getEmbeddingService();
  }

  /**
   * Pre-compute embeddings for all subagent intents
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    console.log('[SubagentRouter] Pre-computing subagent intent embeddings...');

    const allIntents: string[] = [];
    const intentMetadata: Array<{ subagent: SubagentType; intentIndex: number }> = [];

    // Collect all intents
    for (const definition of SUBAGENT_INTENTS) {
      for (const intent of definition.intents) {
        intentMetadata.push({
          subagent: definition.subagent,
          intentIndex: allIntents.length,
        });
        allIntents.push(intent);
      }
    }

    if (allIntents.length === 0) {
      console.log('[SubagentRouter] No intents to initialize');
      this.initialized = true;
      return;
    }

    // Batch embed all intents
    const embeddings = await this.embeddingService.embedBatch(allIntents);

    // Store with metadata
    this.intentEmbeddings = intentMetadata.map((meta, idx) => ({
      intent: allIntents[meta.intentIndex],
      embedding: embeddings[idx],
      subagent: meta.subagent,
    }));

    this.initialized = true;
    console.log(`[SubagentRouter] Initialized ${this.intentEmbeddings.length} subagent intent embeddings`);
  }

  /**
   * Check if router is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Detect which subagent should handle a message based on semantic similarity
   *
   * @param message - The user message to analyze
   * @param config - Mode configuration with threshold settings
   * @returns SubagentRouteResult if a match is found above threshold, null otherwise
   */
  async detectSubagentIntent(
    message: string,
    config?: Partial<ModeConfig>
  ): Promise<SubagentRouteResult | null> {
    if (!this.initialized || this.intentEmbeddings.length === 0) {
      // Try to initialize if not already
      await this.initialize();

      if (this.intentEmbeddings.length === 0) {
        return null;
      }
    }

    // Use configurable threshold, default to 0.6
    const threshold = config?.autoSubagentThreshold ?? 0.6;

    // Embed the message
    const messageEmbedding = await this.embeddingService.embed(message);

    // Find best match per subagent
    const subagentMatches: Map<SubagentType, { similarity: number; intent: string }> = new Map();

    for (const intentEmbed of this.intentEmbeddings) {
      const similarity = this.embeddingService.cosineSimilarity(
        messageEmbedding,
        intentEmbed.embedding
      );

      // Keep best match per subagent
      const existing = subagentMatches.get(intentEmbed.subagent);
      if (!existing || similarity > existing.similarity) {
        subagentMatches.set(intentEmbed.subagent, {
          similarity,
          intent: intentEmbed.intent
        });
      }
    }

    // Find the overall best match above threshold
    let bestMatch: SubagentRouteResult | null = null;
    let bestSimilarity = threshold;

    for (const [subagent, match] of subagentMatches) {
      if (match.similarity > bestSimilarity) {
        bestSimilarity = match.similarity;
        bestMatch = {
          subagent,
          confidence: match.similarity,
          matchedIntent: match.intent
        };
      }
    }

    return bestMatch;
  }

  /**
   * Get statistics about loaded intents
   */
  getStats(): {
    subagentCount: number;
    intentCount: number;
    initialized: boolean;
    subagents: Array<{ name: SubagentType; intentCount: number }>;
  } {
    const subagentCounts = new Map<SubagentType, number>();

    for (const intent of this.intentEmbeddings) {
      const count = subagentCounts.get(intent.subagent) || 0;
      subagentCounts.set(intent.subagent, count + 1);
    }

    return {
      subagentCount: subagentCounts.size,
      intentCount: this.intentEmbeddings.length,
      initialized: this.initialized,
      subagents: Array.from(subagentCounts.entries()).map(([name, intentCount]) => ({
        name,
        intentCount
      }))
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalSubagentRouter: SubagentRouter | null = null;

/**
 * Get or create the global subagent router instance
 */
export function getSubagentRouter(): SubagentRouter {
  if (!globalSubagentRouter) {
    globalSubagentRouter = new SubagentRouter();
  }
  return globalSubagentRouter;
}

/**
 * Reset the global subagent router (for testing)
 */
export function resetSubagentRouter(): void {
  globalSubagentRouter = null;
}
