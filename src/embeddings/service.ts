/**
 * Embedding Service
 * Central service for text embeddings with provider abstraction and caching
 */

import type { EmbeddingProvider, EmbeddingServiceConfig } from './types';
import { DEFAULT_EMBEDDING_CONFIG } from './types';
import { LocalEmbeddingProvider } from './providers/local';
import { OpenAIEmbeddingProvider } from './providers/openai';
import { OllamaEmbeddingProvider } from './providers/ollama';

export class EmbeddingService {
  private config: EmbeddingServiceConfig;
  private provider: EmbeddingProvider | null = null;
  private cache: Map<string, number[]> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<EmbeddingServiceConfig> = {}) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  }

  /**
   * Initialize the embedding service, selecting the best available provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const providers = this.getProviderCandidates();

    for (const provider of providers) {
      try {
        const available = await provider.isAvailable();
        if (available) {
          this.provider = provider;
          console.log(`Embedding service initialized with provider: ${provider.name}`);
          this.initialized = true;
          return;
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} check failed:`, error);
      }
    }

    throw new Error('No embedding provider available');
  }

  /**
   * Get provider candidates based on config
   */
  private getProviderCandidates(): EmbeddingProvider[] {
    const { provider, openaiApiKey, ollamaBaseUrl, localModel } = this.config;

    switch (provider) {
      case 'openai':
        return [new OpenAIEmbeddingProvider(openaiApiKey)];

      case 'ollama':
        return [new OllamaEmbeddingProvider(ollamaBaseUrl)];

      case 'local':
        return [new LocalEmbeddingProvider(localModel)];

      case 'auto':
      default:
        // Try in order: OpenAI (if key), Ollama (if running), Local (always)
        const candidates: EmbeddingProvider[] = [];

        if (openaiApiKey) {
          candidates.push(new OpenAIEmbeddingProvider(openaiApiKey));
        }

        candidates.push(new OllamaEmbeddingProvider(ollamaBaseUrl));
        candidates.push(new LocalEmbeddingProvider(localModel));

        return candidates;
    }
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string | null {
    return this.provider?.name || null;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.provider?.dimensions || 384;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Embed a single text
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();

    if (!this.provider) {
      throw new Error('Embedding service not initialized');
    }

    // Check cache
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Generate embedding
    const embedding = await this.provider.embed(text);

    // Cache result
    this.addToCache(cacheKey, embedding);

    return embedding;
  }

  /**
   * Embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (!this.provider) {
      throw new Error('Embedding service not initialized');
    }

    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i]);
      if (this.cache.has(cacheKey)) {
        results[i] = this.cache.get(cacheKey)!;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // Embed uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.provider.embedBatch(uncachedTexts);

      for (let i = 0; i < uncachedTexts.length; i++) {
        const originalIndex = uncachedIndices[i];
        results[originalIndex] = newEmbeddings[i];
        this.addToCache(this.getCacheKey(uncachedTexts[i]), newEmbeddings[i]);
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dot / magnitude;
  }

  /**
   * Find most similar texts from a list
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    const queryEmbedding = await this.embed(query);
    const candidateEmbeddings = await this.embedBatch(candidates);

    const similarities = candidateEmbeddings.map((embedding, index) => ({
      text: candidates[index],
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index,
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get cache key for text
   */
  private getCacheKey(text: string): string {
    return `${this.provider?.name || 'unknown'}:${text}`;
  }

  /**
   * Add to cache with size limit
   */
  private addToCache(key: string, value: number[]): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= (this.config.cacheSize || 1000)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize || 1000,
    };
  }
}

// Singleton instance for global use
let globalEmbeddingService: EmbeddingService | null = null;

/**
 * Get or create the global embedding service instance
 */
export function getEmbeddingService(config?: Partial<EmbeddingServiceConfig>): EmbeddingService {
  if (!globalEmbeddingService) {
    globalEmbeddingService = new EmbeddingService(config);
  }
  return globalEmbeddingService;
}

/**
 * Reset the global embedding service (for testing)
 */
export function resetEmbeddingService(): void {
  globalEmbeddingService = null;
}
