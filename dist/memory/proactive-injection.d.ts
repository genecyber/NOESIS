/**
 * Proactive Memory Injection - Ralph Iteration 5 Feature 4
 *
 * Automatically injects relevant memories into context during conversation.
 * Uses semantic similarity, recency, and importance to score relevance.
 */
import { MemoryEntry, Stance } from '../types/index.js';
import { DenseEmbedding } from '../core/embeddings.js';
/**
 * Memory relevance score with breakdown
 */
export interface MemoryRelevance {
    memory: MemoryEntry;
    totalScore: number;
    breakdown: {
        semantic: number;
        recency: number;
        importance: number;
        stanceAlign: number;
    };
    reason: string;
}
/**
 * Injection result
 */
export interface InjectionResult {
    memories: MemoryRelevance[];
    contextUsed: number;
    attribution: string[];
}
/**
 * Proactive injection configuration
 */
export interface InjectionConfig {
    enabled: boolean;
    maxMemories: number;
    maxTokens: number;
    minRelevanceScore: number;
    weights: {
        semantic: number;
        recency: number;
        importance: number;
        stanceAlign: number;
    };
    attributionStyle: 'explicit' | 'subtle' | 'none';
    cooldownTurns: number;
}
/**
 * Proactive Memory Injection Manager
 */
declare class ProactiveMemoryInjector {
    private config;
    private embeddingProvider;
    private recentlyInjected;
    private currentTurn;
    private contextCache;
    constructor();
    /**
     * Set configuration
     */
    setConfig(config: Partial<InjectionConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): InjectionConfig;
    /**
     * Enable/disable injection
     */
    setEnabled(enabled: boolean): void;
    /**
     * Record a turn (for cooldown tracking)
     */
    recordTurn(): void;
    /**
     * Clean up old cooldowns
     */
    private cleanupCooldowns;
    /**
     * Check if memory is in cooldown
     */
    private isInCooldown;
    /**
     * Calculate recency score (0-1)
     */
    private calculateRecency;
    /**
     * Calculate stance alignment score (0-1)
     */
    private calculateStanceAlignment;
    /**
     * Score a memory for relevance
     */
    scoreMemory(memory: MemoryEntry, contextEmbedding: DenseEmbedding, stance: Stance, memoryEmbedding?: number[]): Promise<MemoryRelevance>;
    /**
     * Find memories to inject based on context
     */
    findMemoriesToInject(context: string, memories: MemoryEntry[], stance: Stance, memoryEmbeddings?: Map<string, number[]>): Promise<InjectionResult>;
    /**
     * Generate attribution phrases
     */
    private generateAttributions;
    /**
     * Get human-readable age description
     */
    private getAgeDescription;
    /**
     * Format memories for injection into context
     */
    formatForInjection(result: InjectionResult): string;
    /**
     * Get injection status
     */
    getStatus(): {
        enabled: boolean;
        currentTurn: number;
        memoriesInCooldown: number;
        cacheSize: number;
    };
    /**
     * Clear caches
     */
    clearCaches(): void;
    /**
     * Reset turn counter
     */
    reset(): void;
}
export declare const memoryInjector: ProactiveMemoryInjector;
export {};
//# sourceMappingURL=proactive-injection.d.ts.map