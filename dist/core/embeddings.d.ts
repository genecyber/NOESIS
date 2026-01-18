/**
 * Semantic Embeddings - Ralph Iteration 4 Feature 1
 *
 * Provides semantic similarity for memory retrieval.
 * Uses simple TF-IDF based embeddings as a starting point,
 * with hooks for upgrading to Voyage AI or other providers.
 */
/**
 * Simple embedding based on word frequency vectors
 * Returns a sparse representation
 */
export interface SparseEmbedding {
    terms: Map<string, number>;
    magnitude: number;
}
/**
 * Create a sparse embedding from text
 */
export declare function createSparseEmbedding(text: string): SparseEmbedding;
/**
 * Calculate cosine similarity between two sparse embeddings
 */
export declare function cosineSimilarity(a: SparseEmbedding, b: SparseEmbedding): number;
/**
 * Dense embedding (fixed-size vector)
 * For use with external embedding APIs like Voyage AI
 */
export interface DenseEmbedding {
    vector: number[];
    dimension: number;
}
/**
 * Configuration for embedding provider
 */
export interface EmbeddingConfig {
    provider: 'local' | 'voyage' | 'openai';
    apiKey?: string;
    model?: string;
    dimension?: number;
}
/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
    embed(text: string): Promise<DenseEmbedding>;
    embedBatch(texts: string[]): Promise<DenseEmbedding[]>;
    similarity(a: DenseEmbedding, b: DenseEmbedding): number;
}
/**
 * Local embedding provider using TF-IDF approximation
 * Creates a pseudo-dense embedding by hashing terms into fixed buckets
 */
export declare class LocalEmbeddingProvider implements EmbeddingProvider {
    private dimension;
    constructor(dimension?: number);
    /**
     * Simple hash function for term -> bucket mapping
     */
    private hash;
    embed(text: string): Promise<DenseEmbedding>;
    embedBatch(texts: string[]): Promise<DenseEmbedding[]>;
    similarity(a: DenseEmbedding, b: DenseEmbedding): number;
}
/**
 * Voyage AI embedding provider (placeholder - requires API key)
 */
export declare class VoyageEmbeddingProvider implements EmbeddingProvider {
    private apiKey;
    private model;
    private dimension;
    constructor(config: {
        apiKey: string;
        model?: string;
    });
    embed(text: string): Promise<DenseEmbedding>;
    embedBatch(texts: string[]): Promise<DenseEmbedding[]>;
    similarity(a: DenseEmbedding, b: DenseEmbedding): number;
}
/**
 * Create an embedding provider based on config
 */
export declare function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider;
/**
 * Set the default embedding provider
 */
export declare function setDefaultProvider(provider: EmbeddingProvider): void;
/**
 * Get the default embedding provider
 */
export declare function getDefaultProvider(): EmbeddingProvider;
/**
 * Embed text using the default provider
 */
export declare function embed(text: string): Promise<DenseEmbedding>;
/**
 * Calculate similarity between two texts
 */
export declare function textSimilarity(a: string, b: string): Promise<number>;
/**
 * Find most similar texts from a corpus
 */
export declare function findSimilar(query: string, corpus: string[], topK?: number): Promise<Array<{
    text: string;
    similarity: number;
    index: number;
}>>;
//# sourceMappingURL=embeddings.d.ts.map