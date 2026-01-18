/**
 * Stance-Aware Memory Prioritization (Ralph Iteration 11, Feature 2)
 *
 * Memory importance scoring based on stance, forgetting curves,
 * stance-aligned retrieval, emotional salience, and memory consolidation.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PrioritizationConfig {
  enablePrioritization: boolean;
  forgettingRate: number;  // 0-1, higher = faster forgetting
  emotionalWeight: number;
  stanceAlignmentWeight: number;
  recencyWeight: number;
  frequencyWeight: number;
  consolidationThreshold: number;
}

export interface PrioritizedMemory {
  id: string;
  content: string;
  type: MemoryType;
  priority: number;  // 0-100
  salience: SalienceScore;
  decay: DecayInfo;
  stanceAlignment: StanceAlignmentInfo;
  consolidation: ConsolidationInfo;
  metadata: MemoryMetadata;
}

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'emotional';

export interface SalienceScore {
  emotional: number;
  contextual: number;
  novelty: number;
  utility: number;
  overall: number;
}

export interface DecayInfo {
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  decayRate: number;
  currentStrength: number;  // 0-1
  predictedForgetting: Date | null;
}

export interface StanceAlignmentInfo {
  alignedFrames: Frame[];
  alignedValues: string[];
  alignmentScore: number;  // -1 to 1
  relevanceByFrame: Record<string, number>;
}

export interface ConsolidationInfo {
  isConsolidated: boolean;
  consolidatedAt: Date | null;
  linkedMemories: string[];
  strengthenedBy: string[];
  abstractionLevel: number;  // 0 = concrete, 1 = abstract
}

export interface MemoryMetadata {
  source: string;
  tags: string[];
  embedding?: number[];
  relatedStance: Partial<Stance> | null;
}

export interface RetrievalQuery {
  text?: string;
  stance?: Stance;
  type?: MemoryType;
  minPriority?: number;
  maxAge?: number;  // milliseconds
  limit?: number;
}

export interface RetrievalResult {
  memories: PrioritizedMemory[];
  totalMatches: number;
  retrievalTime: number;
  stanceBoost: number;
  query: RetrievalQuery;
}

export interface ForgettingEvent {
  memoryId: string;
  forgottenAt: Date;
  reason: 'decay' | 'consolidation' | 'capacity' | 'manual';
  finalPriority: number;
}

export interface ConsolidationResult {
  consolidatedCount: number;
  newAbstractions: string[];
  linkedPairs: [string, string][];
  strengthened: string[];
}

export interface PrioritizationStats {
  totalMemories: number;
  activeMemories: number;
  forgottenMemories: number;
  consolidatedMemories: number;
  averagePriority: number;
  averageSalience: number;
}

// ============================================================================
// Memory Prioritization Manager
// ============================================================================

export class MemoryPrioritizationManager {
  private config: PrioritizationConfig;
  private memories: Map<string, PrioritizedMemory> = new Map();
  private forgettingLog: ForgettingEvent[] = [];
  private stats: PrioritizationStats;

  constructor(config: Partial<PrioritizationConfig> = {}) {
    this.config = {
      enablePrioritization: true,
      forgettingRate: 0.1,
      emotionalWeight: 0.3,
      stanceAlignmentWeight: 0.25,
      recencyWeight: 0.25,
      frequencyWeight: 0.2,
      consolidationThreshold: 0.7,
      ...config
    };

    this.stats = {
      totalMemories: 0,
      activeMemories: 0,
      forgottenMemories: 0,
      consolidatedMemories: 0,
      averagePriority: 0,
      averageSalience: 0
    };
  }

  /**
   * Add a new memory with prioritization
   */
  addMemory(
    content: string,
    type: MemoryType,
    stance: Stance,
    metadata: Partial<MemoryMetadata> = {}
  ): PrioritizedMemory {
    const now = new Date();
    const salience = this.calculateSalience(content, stance);
    const stanceAlignment = this.calculateStanceAlignment(content, stance);

    const memory: PrioritizedMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      priority: this.calculateInitialPriority(salience, stanceAlignment),
      salience,
      decay: {
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
        decayRate: this.config.forgettingRate,
        currentStrength: 1.0,
        predictedForgetting: null
      },
      stanceAlignment,
      consolidation: {
        isConsolidated: false,
        consolidatedAt: null,
        linkedMemories: [],
        strengthenedBy: [],
        abstractionLevel: 0
      },
      metadata: {
        source: metadata.source || 'unknown',
        tags: metadata.tags || [],
        embedding: metadata.embedding,
        relatedStance: stance
      }
    };

    // Calculate predicted forgetting time
    memory.decay.predictedForgetting = this.predictForgetting(memory);

    this.memories.set(memory.id, memory);
    this.stats.totalMemories++;
    this.stats.activeMemories++;
    this.updateAverages(memory);

    return memory;
  }

  /**
   * Calculate salience score
   */
  private calculateSalience(content: string, stance: Stance): SalienceScore {
    // Emotional salience based on emotional keywords and stance empathy
    const emotionalKeywords = ['love', 'hate', 'fear', 'joy', 'anger', 'sad', 'excited', 'anxious'];
    const contentLower = content.toLowerCase();
    const emotionalMatches = emotionalKeywords.filter(k => contentLower.includes(k)).length;
    const emotional = Math.min((emotionalMatches * 0.2) + (stance.values.empathy / 200), 1);

    // Contextual salience based on current frame
    const frameRelevance = this.getFrameRelevance(content, stance.frame);
    const contextual = frameRelevance;

    // Novelty based on uniqueness (simplified)
    const novelty = Math.min(0.5 + (stance.values.novelty / 200), 1);

    // Utility based on stance objective
    const objectiveRelevance = content.toLowerCase().includes(stance.objective.toLowerCase()) ? 0.8 : 0.3;
    const utility = objectiveRelevance;

    // Overall weighted score
    const overall = (
      emotional * 0.3 +
      contextual * 0.25 +
      novelty * 0.2 +
      utility * 0.25
    );

    return { emotional, contextual, novelty, utility, overall };
  }

  /**
   * Get frame relevance for content
   */
  private getFrameRelevance(content: string, frame: Frame): number {
    const frameKeywords: Record<Frame, string[]> = {
      existential: ['meaning', 'purpose', 'existence', 'being', 'death', 'life'],
      pragmatic: ['practical', 'useful', 'effective', 'solution', 'action', 'result'],
      poetic: ['beauty', 'metaphor', 'art', 'image', 'feeling', 'expression'],
      adversarial: ['challenge', 'debate', 'argue', 'oppose', 'critique', 'weakness'],
      playful: ['fun', 'game', 'joke', 'play', 'humor', 'creative'],
      mythic: ['hero', 'journey', 'archetype', 'legend', 'symbol', 'sacred'],
      systems: ['system', 'pattern', 'structure', 'process', 'network', 'feedback'],
      psychoanalytic: ['unconscious', 'desire', 'memory', 'trauma', 'dream', 'shadow'],
      stoic: ['virtue', 'control', 'acceptance', 'wisdom', 'discipline', 'nature'],
      absurdist: ['absurd', 'meaningless', 'paradox', 'irony', 'chaos', 'random']
    };

    const keywords = frameKeywords[frame] || [];
    const contentLower = content.toLowerCase();
    const matches = keywords.filter(k => contentLower.includes(k)).length;
    return Math.min(matches * 0.15 + 0.2, 1);
  }

  /**
   * Calculate stance alignment
   */
  private calculateStanceAlignment(content: string, stance: Stance): StanceAlignmentInfo {
    const allFrames: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];

    const relevanceByFrame: Record<string, number> = {};
    const alignedFrames: Frame[] = [];

    for (const frame of allFrames) {
      const relevance = this.getFrameRelevance(content, frame);
      relevanceByFrame[frame] = relevance;
      if (relevance > 0.5) {
        alignedFrames.push(frame);
      }
    }

    // Check value alignment
    const alignedValues: string[] = [];
    const stanceValues = stance.values as Record<string, number>;
    for (const [key, value] of Object.entries(stanceValues)) {
      if (value > 60) {
        alignedValues.push(key);
      }
    }

    // Calculate overall alignment score
    const currentFrameRelevance = relevanceByFrame[stance.frame] || 0;
    const alignmentScore = (currentFrameRelevance * 2 - 1);  // Convert to -1 to 1 range

    return { alignedFrames, alignedValues, alignmentScore, relevanceByFrame };
  }

  /**
   * Calculate initial priority
   */
  private calculateInitialPriority(salience: SalienceScore, alignment: StanceAlignmentInfo): number {
    const salienceComponent = salience.overall * this.config.emotionalWeight * 100;
    const alignmentComponent = ((alignment.alignmentScore + 1) / 2) * this.config.stanceAlignmentWeight * 100;
    const baseComponent = 50 * (1 - this.config.emotionalWeight - this.config.stanceAlignmentWeight);

    return Math.min(100, Math.max(0, salienceComponent + alignmentComponent + baseComponent));
  }

  /**
   * Predict when memory will be forgotten
   */
  private predictForgetting(memory: PrioritizedMemory): Date | null {
    if (memory.priority >= 80) return null;  // High priority memories don't get forgotten

    // Ebbinghaus forgetting curve approximation
    const halfLife = (1 / memory.decay.decayRate) * 24 * 60 * 60 * 1000;  // in milliseconds
    const forgetThreshold = 0.3;  // Strength below which we consider it forgotten

    // t = halfLife * log2(1/threshold)
    const timeToForget = halfLife * Math.log2(1 / forgetThreshold);

    return new Date(memory.decay.createdAt.getTime() + timeToForget);
  }

  /**
   * Retrieve memories based on query
   */
  retrieve(query: RetrievalQuery, currentStance: Stance): RetrievalResult {
    const startTime = Date.now();
    let results: PrioritizedMemory[] = [];

    for (const memory of this.memories.values()) {
      // Apply decay
      this.applyDecay(memory);

      // Skip if below strength threshold
      if (memory.decay.currentStrength < 0.1) continue;

      // Filter by type
      if (query.type && memory.type !== query.type) continue;

      // Filter by priority
      if (query.minPriority && memory.priority < query.minPriority) continue;

      // Filter by age
      if (query.maxAge) {
        const age = Date.now() - memory.decay.createdAt.getTime();
        if (age > query.maxAge) continue;
      }

      // Text search
      if (query.text && !memory.content.toLowerCase().includes(query.text.toLowerCase())) continue;

      results.push(memory);
    }

    // Calculate stance boost and re-prioritize
    const stanceBoost = this.calculateStanceBoost(currentStance, results);

    // Apply stance-aware boosting
    results = results.map(mem => ({
      ...mem,
      priority: this.boostByStance(mem, currentStance)
    }));

    // Sort by priority
    results.sort((a, b) => b.priority - a.priority);

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    // Update access counts
    for (const mem of results) {
      const original = this.memories.get(mem.id);
      if (original) {
        original.decay.lastAccessed = new Date();
        original.decay.accessCount++;
        original.decay.currentStrength = Math.min(1.0, original.decay.currentStrength + 0.1);
      }
    }

    return {
      memories: results,
      totalMatches: results.length,
      retrievalTime: Date.now() - startTime,
      stanceBoost,
      query
    };
  }

  /**
   * Apply memory decay
   */
  private applyDecay(memory: PrioritizedMemory): void {
    const now = Date.now();
    const timeSinceAccess = now - memory.decay.lastAccessed.getTime();
    const hoursSinceAccess = timeSinceAccess / (1000 * 60 * 60);

    // Ebbinghaus curve: R = e^(-t/S) where S is stability
    const stability = memory.priority / 10;  // Higher priority = more stable
    const decayFactor = Math.exp(-hoursSinceAccess * memory.decay.decayRate / stability);

    memory.decay.currentStrength = Math.max(0, memory.decay.currentStrength * decayFactor);
  }

  /**
   * Calculate stance boost factor
   */
  private calculateStanceBoost(stance: Stance, memories: PrioritizedMemory[]): number {
    if (memories.length === 0) return 0;

    let totalBoost = 0;
    for (const mem of memories) {
      const alignment = mem.stanceAlignment.relevanceByFrame[stance.frame] || 0;
      totalBoost += alignment;
    }

    return totalBoost / memories.length;
  }

  /**
   * Boost memory priority by current stance
   */
  private boostByStance(memory: PrioritizedMemory, stance: Stance): number {
    const frameRelevance = memory.stanceAlignment.relevanceByFrame[stance.frame] || 0;
    const boost = frameRelevance * 20;  // Up to 20 point boost

    return Math.min(100, memory.priority + boost);
  }

  /**
   * Run memory consolidation
   */
  consolidate(): ConsolidationResult {
    const result: ConsolidationResult = {
      consolidatedCount: 0,
      newAbstractions: [],
      linkedPairs: [],
      strengthened: []
    };

    const memories = [...this.memories.values()];

    // Find memories to consolidate (similar, frequently accessed together)
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const mem1 = memories[i];
        const mem2 = memories[j];

        // Calculate similarity
        const similarity = this.calculateSimilarity(mem1, mem2);

        if (similarity > this.config.consolidationThreshold) {
          // Link memories
          if (!mem1.consolidation.linkedMemories.includes(mem2.id)) {
            mem1.consolidation.linkedMemories.push(mem2.id);
            mem2.consolidation.linkedMemories.push(mem1.id);
            result.linkedPairs.push([mem1.id, mem2.id]);
          }

          // Strengthen both
          mem1.decay.currentStrength = Math.min(1.0, mem1.decay.currentStrength + 0.1);
          mem2.decay.currentStrength = Math.min(1.0, mem2.decay.currentStrength + 0.1);
          result.strengthened.push(mem1.id, mem2.id);

          // Mark as consolidated
          if (!mem1.consolidation.isConsolidated) {
            mem1.consolidation.isConsolidated = true;
            mem1.consolidation.consolidatedAt = new Date();
            result.consolidatedCount++;
            this.stats.consolidatedMemories++;
          }
        }
      }
    }

    return result;
  }

  /**
   * Calculate memory similarity
   */
  private calculateSimilarity(mem1: PrioritizedMemory, mem2: PrioritizedMemory): number {
    // Type similarity
    const typeSim = mem1.type === mem2.type ? 0.2 : 0;

    // Frame alignment similarity
    const sharedFrames = mem1.stanceAlignment.alignedFrames.filter(
      f => mem2.stanceAlignment.alignedFrames.includes(f)
    ).length;
    const frameSim = sharedFrames * 0.1;

    // Content similarity (simple word overlap)
    const words1 = new Set(mem1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(mem2.content.toLowerCase().split(/\s+/));
    const overlap = [...words1].filter(w => words2.has(w)).length;
    const contentSim = overlap / Math.max(words1.size, words2.size) * 0.5;

    // Tag similarity
    const sharedTags = mem1.metadata.tags.filter(t => mem2.metadata.tags.includes(t)).length;
    const tagSim = sharedTags * 0.1;

    return Math.min(1, typeSim + frameSim + contentSim + tagSim);
  }

  /**
   * Forget low-priority memories
   */
  forgetLowPriority(threshold: number = 20): ForgettingEvent[] {
    const events: ForgettingEvent[] = [];

    for (const [id, memory] of this.memories) {
      this.applyDecay(memory);

      if (memory.decay.currentStrength < 0.1 || memory.priority < threshold) {
        events.push({
          memoryId: id,
          forgottenAt: new Date(),
          reason: memory.decay.currentStrength < 0.1 ? 'decay' : 'capacity',
          finalPriority: memory.priority
        });

        this.memories.delete(id);
        this.stats.activeMemories--;
        this.stats.forgottenMemories++;
      }
    }

    this.forgettingLog.push(...events);
    return events;
  }

  /**
   * Get memory by ID
   */
  getMemory(memoryId: string): PrioritizedMemory | null {
    return this.memories.get(memoryId) || null;
  }

  /**
   * Update memory priority
   */
  updatePriority(memoryId: string, newPriority: number): boolean {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    memory.priority = Math.max(0, Math.min(100, newPriority));
    memory.decay.predictedForgetting = this.predictForgetting(memory);

    return true;
  }

  /**
   * Update averages
   */
  private updateAverages(newMemory: PrioritizedMemory): void {
    const n = this.stats.activeMemories;
    this.stats.averagePriority = (
      this.stats.averagePriority * (n - 1) + newMemory.priority
    ) / n;
    this.stats.averageSalience = (
      this.stats.averageSalience * (n - 1) + newMemory.salience.overall
    ) / n;
  }

  /**
   * List all memories
   */
  listMemories(sortBy: 'priority' | 'recency' | 'strength' = 'priority'): PrioritizedMemory[] {
    const memories = [...this.memories.values()];

    switch (sortBy) {
      case 'priority':
        return memories.sort((a, b) => b.priority - a.priority);
      case 'recency':
        return memories.sort((a, b) =>
          b.decay.lastAccessed.getTime() - a.decay.lastAccessed.getTime()
        );
      case 'strength':
        return memories.sort((a, b) => b.decay.currentStrength - a.decay.currentStrength);
      default:
        return memories;
    }
  }

  /**
   * Get forgetting log
   */
  getForgettingLog(limit?: number): ForgettingEvent[] {
    const log = [...this.forgettingLog];
    return limit ? log.slice(-limit) : log;
  }

  /**
   * Get statistics
   */
  getStats(): PrioritizationStats {
    return { ...this.stats };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.memories.clear();
    this.forgettingLog = [];
    this.stats = {
      totalMemories: 0,
      activeMemories: 0,
      forgottenMemories: 0,
      consolidatedMemories: 0,
      averagePriority: 0,
      averageSalience: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const memoryPrioritization = new MemoryPrioritizationManager();
