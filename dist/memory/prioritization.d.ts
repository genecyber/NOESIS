/**
 * Stance-Aware Memory Prioritization (Ralph Iteration 11, Feature 2)
 *
 * Memory importance scoring based on stance, forgetting curves,
 * stance-aligned retrieval, emotional salience, and memory consolidation.
 */
import type { Stance, Frame } from '../types/index.js';
export interface PrioritizationConfig {
    enablePrioritization: boolean;
    forgettingRate: number;
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
    priority: number;
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
    currentStrength: number;
    predictedForgetting: Date | null;
}
export interface StanceAlignmentInfo {
    alignedFrames: Frame[];
    alignedValues: string[];
    alignmentScore: number;
    relevanceByFrame: Record<string, number>;
}
export interface ConsolidationInfo {
    isConsolidated: boolean;
    consolidatedAt: Date | null;
    linkedMemories: string[];
    strengthenedBy: string[];
    abstractionLevel: number;
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
    maxAge?: number;
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
export declare class MemoryPrioritizationManager {
    private config;
    private memories;
    private forgettingLog;
    private stats;
    constructor(config?: Partial<PrioritizationConfig>);
    /**
     * Add a new memory with prioritization
     */
    addMemory(content: string, type: MemoryType, stance: Stance, metadata?: Partial<MemoryMetadata>): PrioritizedMemory;
    /**
     * Calculate salience score
     */
    private calculateSalience;
    /**
     * Get frame relevance for content
     */
    private getFrameRelevance;
    /**
     * Calculate stance alignment
     */
    private calculateStanceAlignment;
    /**
     * Calculate initial priority
     */
    private calculateInitialPriority;
    /**
     * Predict when memory will be forgotten
     */
    private predictForgetting;
    /**
     * Retrieve memories based on query
     */
    retrieve(query: RetrievalQuery, currentStance: Stance): RetrievalResult;
    /**
     * Apply memory decay
     */
    private applyDecay;
    /**
     * Calculate stance boost factor
     */
    private calculateStanceBoost;
    /**
     * Boost memory priority by current stance
     */
    private boostByStance;
    /**
     * Run memory consolidation
     */
    consolidate(): ConsolidationResult;
    /**
     * Calculate memory similarity
     */
    private calculateSimilarity;
    /**
     * Forget low-priority memories
     */
    forgetLowPriority(threshold?: number): ForgettingEvent[];
    /**
     * Get memory by ID
     */
    getMemory(memoryId: string): PrioritizedMemory | null;
    /**
     * Update memory priority
     */
    updatePriority(memoryId: string, newPriority: number): boolean;
    /**
     * Update averages
     */
    private updateAverages;
    /**
     * List all memories
     */
    listMemories(sortBy?: 'priority' | 'recency' | 'strength'): PrioritizedMemory[];
    /**
     * Get forgetting log
     */
    getForgettingLog(limit?: number): ForgettingEvent[];
    /**
     * Get statistics
     */
    getStats(): PrioritizationStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const memoryPrioritization: MemoryPrioritizationManager;
//# sourceMappingURL=prioritization.d.ts.map