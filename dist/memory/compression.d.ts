/**
 * Semantic Memory Compression (Ralph Iteration 7, Feature 1)
 *
 * Intelligent memory summarization with hierarchical structures,
 * concept extraction, and context-aware retrieval.
 */
import type { MemoryEntry, Stance } from '../types/index.js';
export interface MemoryCluster {
    id: string;
    centroid: number[];
    memories: string[];
    concept: string;
    importance: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface HierarchicalMemory {
    episodes: CompressedEpisode[];
    patterns: ExtractedPattern[];
    principles: CorePrinciple[];
}
export interface CompressedEpisode {
    id: string;
    summary: string;
    originalIds: string[];
    timeRange: {
        start: Date;
        end: Date;
    };
    keyEntities: string[];
    emotionalValence: number;
    importance: number;
}
export interface ExtractedPattern {
    id: string;
    description: string;
    episodeIds: string[];
    frequency: number;
    confidence: number;
    context: string[];
}
export interface CorePrinciple {
    id: string;
    statement: string;
    supportingPatterns: string[];
    strength: number;
    lastReinforced: Date;
}
export interface ConceptNode {
    id: string;
    label: string;
    type: 'entity' | 'action' | 'concept' | 'emotion' | 'relation';
    connections: Array<{
        targetId: string;
        relation: string;
        weight: number;
    }>;
    frequency: number;
    lastSeen: Date;
}
export interface CompressionConfig {
    episodeWindowSize: number;
    patternMinFrequency: number;
    principleMinSupport: number;
    importanceDecayRate: number;
    reinforcementBoost: number;
    maxClusters: number;
    similarityThreshold: number;
}
export interface CompressionStats {
    totalMemories: number;
    compressedEpisodes: number;
    extractedPatterns: number;
    corePrinciples: number;
    conceptNodes: number;
    compressionRatio: number;
    lastCompression: Date | null;
}
export declare class SemanticMemoryCompressor {
    private config;
    private hierarchy;
    private conceptGraph;
    private clusters;
    private memoryImportance;
    constructor(config?: Partial<CompressionConfig>);
    /**
     * Compress a batch of memories into episodes
     */
    compressToEpisodes(memories: MemoryEntry[]): CompressedEpisode[];
    /**
     * Create a single episode from a group of memories
     */
    private createEpisode;
    /**
     * Summarize a group of memories into a concise description
     */
    private summarizeMemories;
    /**
     * Extract named entities from memories
     */
    private extractEntities;
    /**
     * Calculate emotional valence of memories
     */
    private calculateEmotionalValence;
    /**
     * Extract patterns from episodes
     */
    extractPatterns(): ExtractedPattern[];
    /**
     * Derive core principles from patterns
     */
    derivePrinciples(): CorePrinciple[];
    /**
     * Cluster memories by semantic similarity
     */
    clusterMemories(memories: MemoryEntry[]): MemoryCluster[];
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Generate a label for a cluster
     */
    private labelCluster;
    /**
     * Calculate average importance of cluster members
     */
    private calculateClusterImportance;
    /**
     * Update memory importance with decay
     */
    applyImportanceDecay(): void;
    /**
     * Reinforce memory importance on access
     */
    reinforceMemory(memoryId: string, baseImportance?: number): void;
    /**
     * Get current importance of a memory
     */
    getMemoryImportance(memoryId: string): number;
    /**
     * Context-aware memory retrieval
     */
    retrieveRelevant(queryEmbedding: number[], memories: MemoryEntry[], stance: Stance, limit?: number): MemoryEntry[];
    /**
     * Calculate how well a memory aligns with current stance
     */
    private calculateStanceAlignment;
    /**
     * Add concept to the knowledge graph
     */
    addConcept(label: string, type: ConceptNode['type'], connections?: Array<{
        targetId: string;
        relation: string;
        weight: number;
    }>): ConceptNode;
    /**
     * Get related concepts
     */
    getRelatedConcepts(label: string, depth?: number): ConceptNode[];
    /**
     * Get compression statistics
     */
    getStats(): CompressionStats;
    /**
     * Get the full hierarchy
     */
    getHierarchy(): HierarchicalMemory;
    /**
     * Export state for persistence
     */
    export(): {
        config: CompressionConfig;
        hierarchy: HierarchicalMemory;
        concepts: ConceptNode[];
        clusters: MemoryCluster[];
        importance: Array<{
            id: string;
            value: number;
            lastAccess: string;
        }>;
    };
    /**
     * Import state from persistence
     */
    import(data: ReturnType<SemanticMemoryCompressor['export']>): void;
}
export declare const memoryCompressor: SemanticMemoryCompressor;
//# sourceMappingURL=compression.d.ts.map