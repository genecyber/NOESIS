/**
 * Proactive Memory Injection - Ralph Iteration 5 Feature 4
 *
 * Automatically injects relevant memories into context during conversation.
 * Uses semantic similarity, recency, and importance to score relevance.
 */

import { MemoryEntry, Stance } from '../types/index.js';
import { EmbeddingService, getEmbeddingService } from '../embeddings/service.js';

/**
 * Memory relevance score with breakdown
 */
export interface MemoryRelevance {
  memory: MemoryEntry;
  totalScore: number;
  breakdown: {
    semantic: number;     // 0-1 similarity to current context
    recency: number;      // 0-1 how recent
    importance: number;   // 0-1 memory importance
    stanceAlign: number;  // 0-1 alignment with current stance
  };
  reason: string;
}

/**
 * Injection result
 */
export interface InjectionResult {
  memories: MemoryRelevance[];
  contextUsed: number;    // Tokens used by injected memories
  attribution: string[];  // Suggested attribution phrases
}

/**
 * Proactive injection configuration
 */
export interface InjectionConfig {
  enabled: boolean;
  maxMemories: number;           // Max memories to inject per turn
  maxTokens: number;             // Max tokens for injected context
  minRelevanceScore: number;     // Minimum score to inject (0-1)
  weights: {
    semantic: number;            // Weight for semantic similarity
    recency: number;             // Weight for recency
    importance: number;          // Weight for importance
    stanceAlign: number;         // Weight for stance alignment
  };
  attributionStyle: 'explicit' | 'subtle' | 'none';
  cooldownTurns: number;         // Turns before same memory can be injected again
}

const DEFAULT_CONFIG: InjectionConfig = {
  enabled: true,
  maxMemories: 3,
  maxTokens: 500,
  minRelevanceScore: 0.4,
  weights: {
    semantic: 0.4,
    recency: 0.2,
    importance: 0.25,
    stanceAlign: 0.15
  },
  attributionStyle: 'subtle',
  cooldownTurns: 5
};

/**
 * Proactive Memory Injection Manager
 */
class ProactiveMemoryInjector {
  private config: InjectionConfig = DEFAULT_CONFIG;
  private embeddingService: EmbeddingService;
  private recentlyInjected: Map<string, number> = new Map();  // memory_id -> turn_number
  private currentTurn: number = 0;
  private contextCache: Map<string, number[]> = new Map();

  constructor() {
    this.embeddingService = getEmbeddingService();
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<InjectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): InjectionConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable injection
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Record a turn (for cooldown tracking)
   */
  recordTurn(): void {
    this.currentTurn++;
    this.cleanupCooldowns();
  }

  /**
   * Clean up old cooldowns
   */
  private cleanupCooldowns(): void {
    for (const [memoryId, turn] of this.recentlyInjected.entries()) {
      if (this.currentTurn - turn > this.config.cooldownTurns) {
        this.recentlyInjected.delete(memoryId);
      }
    }
  }

  /**
   * Check if memory is in cooldown
   */
  private isInCooldown(memoryId: string): boolean {
    const lastTurn = this.recentlyInjected.get(memoryId);
    if (lastTurn === undefined) return false;
    return this.currentTurn - lastTurn < this.config.cooldownTurns;
  }

  /**
   * Calculate recency score (0-1)
   */
  private calculateRecency(timestamp: Date): number {
    const ageMs = Date.now() - timestamp.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Decay function: 1 at 0 hours, 0.5 at 24 hours, ~0.25 at 48 hours
    return Math.exp(-ageHours / 24);
  }

  /**
   * Calculate stance alignment score (0-1)
   */
  private calculateStanceAlignment(memory: MemoryEntry, stance: Stance): number {
    const content = memory.content.toLowerCase();
    let score = 0.5;  // Base score

    // Frame alignment
    if (content.includes(stance.frame)) score += 0.15;

    // Self-model alignment
    if (content.includes(stance.selfModel)) score += 0.1;

    // Identity memories get bonus for high identity strength
    if (memory.type === 'identity') {
      score += 0.1 * (stance.sentience.identityStrength / 100);
    }

    // Check for value keywords
    const valueTerms = ['curiosity', 'empathy', 'novelty', 'provocation', 'synthesis'];
    for (const term of valueTerms) {
      if (content.includes(term)) {
        const valueWeight = (stance.values as Record<string, number>)[term] || 50;
        score += 0.02 * (valueWeight / 100);
      }
    }

    return Math.min(1, score);
  }

  /**
   * Score a memory for relevance
   */
  async scoreMemory(
    memory: MemoryEntry,
    contextEmbedding: number[],
    stance: Stance,
    memoryEmbedding?: number[]
  ): Promise<MemoryRelevance> {
    const weights = this.config.weights;

    // Semantic similarity
    let semantic = 0;
    if (memoryEmbedding) {
      semantic = this.embeddingService.cosineSimilarity(contextEmbedding, memoryEmbedding);
    } else {
      // Fallback to embedding the memory content
      const memEmb = await this.embeddingService.embed(memory.content);
      semantic = this.embeddingService.cosineSimilarity(contextEmbedding, memEmb);
    }

    // Recency
    const recency = this.calculateRecency(memory.timestamp);

    // Importance (already 0-1)
    const importance = memory.importance;

    // Stance alignment
    const stanceAlign = this.calculateStanceAlignment(memory, stance);

    // Weighted total
    const totalScore =
      semantic * weights.semantic +
      recency * weights.recency +
      importance * weights.importance +
      stanceAlign * weights.stanceAlign;

    // Generate reason
    const reasons: string[] = [];
    if (semantic > 0.6) reasons.push('semantically relevant');
    if (recency > 0.8) reasons.push('recent');
    if (importance > 0.7) reasons.push('important');
    if (stanceAlign > 0.7) reasons.push('stance-aligned');

    return {
      memory,
      totalScore,
      breakdown: { semantic, recency, importance, stanceAlign },
      reason: reasons.length > 0 ? reasons.join(', ') : 'general relevance'
    };
  }

  /**
   * Find memories to inject based on context
   */
  async findMemoriesToInject(
    context: string,
    memories: MemoryEntry[],
    stance: Stance,
    memoryEmbeddings?: Map<string, number[]>
  ): Promise<InjectionResult> {
    if (!this.config.enabled || memories.length === 0) {
      return { memories: [], contextUsed: 0, attribution: [] };
    }

    // Get context embedding
    let contextEmbedding = this.contextCache.get(context);
    if (!contextEmbedding) {
      contextEmbedding = await this.embeddingService.embed(context);
      this.contextCache.set(context, contextEmbedding);

      // Limit cache size
      if (this.contextCache.size > 100) {
        const firstKey = this.contextCache.keys().next().value;
        if (firstKey) this.contextCache.delete(firstKey);
      }
    }

    // Score all memories
    const scored: MemoryRelevance[] = [];
    for (const memory of memories) {
      // Skip if in cooldown
      if (this.isInCooldown(memory.id)) continue;

      const embedding = memoryEmbeddings?.get(memory.id);
      const relevance = await this.scoreMemory(
        memory,
        contextEmbedding,
        stance,
        embedding
      );

      if (relevance.totalScore >= this.config.minRelevanceScore) {
        scored.push(relevance);
      }
    }

    // Sort by score
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // Select memories within token budget
    const selected: MemoryRelevance[] = [];
    let tokensUsed = 0;

    for (const relevance of scored) {
      const memoryTokens = Math.ceil(relevance.memory.content.length / 4);

      if (selected.length >= this.config.maxMemories) break;
      if (tokensUsed + memoryTokens > this.config.maxTokens) continue;

      selected.push(relevance);
      tokensUsed += memoryTokens;

      // Mark as injected
      this.recentlyInjected.set(relevance.memory.id, this.currentTurn);
    }

    // Generate attributions
    const attributions = this.generateAttributions(selected);

    return {
      memories: selected,
      contextUsed: tokensUsed,
      attribution: attributions
    };
  }

  /**
   * Generate attribution phrases
   */
  private generateAttributions(memories: MemoryRelevance[]): string[] {
    if (this.config.attributionStyle === 'none') return [];

    return memories.map(m => {
      const memory = m.memory;
      const age = this.getAgeDescription(memory.timestamp);

      if (this.config.attributionStyle === 'explicit') {
        return `I recall from ${age}: "${memory.content.slice(0, 50)}..."`;
      } else {
        // Subtle
        const typePhrase = memory.type === 'identity' ? 'This connects to something I know about myself'
          : memory.type === 'episodic' ? 'This reminds me of'
          : 'I have context about this';
        return `${typePhrase} (from ${age})`;
      }
    });
  }

  /**
   * Get human-readable age description
   */
  private getAgeDescription(timestamp: Date): string {
    const ageMs = Date.now() - timestamp.getTime();
    const ageMinutes = ageMs / (1000 * 60);

    if (ageMinutes < 5) return 'just now';
    if (ageMinutes < 60) return 'earlier this session';
    if (ageMinutes < 24 * 60) return 'earlier today';
    if (ageMinutes < 7 * 24 * 60) return 'this week';
    return 'a while ago';
  }

  /**
   * Format memories for injection into context
   */
  formatForInjection(result: InjectionResult): string {
    if (result.memories.length === 0) return '';

    const lines = ['[Relevant Context]'];

    for (let i = 0; i < result.memories.length; i++) {
      const m = result.memories[i];
      const attribution = result.attribution[i] || '';
      lines.push(`- [${m.memory.type}] ${m.memory.content.slice(0, 200)}`);
      if (attribution && this.config.attributionStyle !== 'none') {
        lines.push(`  (${attribution})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get injection status
   */
  getStatus(): {
    enabled: boolean;
    currentTurn: number;
    memoriesInCooldown: number;
    cacheSize: number;
  } {
    return {
      enabled: this.config.enabled,
      currentTurn: this.currentTurn,
      memoriesInCooldown: this.recentlyInjected.size,
      cacheSize: this.contextCache.size
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.contextCache.clear();
    this.recentlyInjected.clear();
  }

  /**
   * Reset turn counter
   */
  reset(): void {
    this.currentTurn = 0;
    this.clearCaches();
  }
}

// Singleton instance
export const memoryInjector = new ProactiveMemoryInjector();
