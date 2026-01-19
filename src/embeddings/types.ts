/**
 * Embedding Types
 * Core interfaces for the embedding system
 */

export interface EmbeddingProvider {
  /** Provider name for identification */
  name: string;

  /** Embedding vector dimensions */
  dimensions: number;

  /** Check if this provider is available (has dependencies, API keys, etc.) */
  isAvailable(): Promise<boolean>;

  /** Embed a single text */
  embed(text: string): Promise<number[]>;

  /** Embed multiple texts (may be more efficient than multiple single calls) */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingServiceConfig {
  /** Preferred provider: 'local' | 'ollama' | 'openai' | 'auto' */
  provider: 'local' | 'ollama' | 'openai' | 'auto';

  /** OpenAI API key (if using openai provider) */
  openaiApiKey?: string;

  /** Ollama base URL (default: http://localhost:11434) */
  ollamaBaseUrl?: string;

  /** Local model name (default: Xenova/all-MiniLM-L6-v2) */
  localModel?: string;

  /** Cache size limit (number of entries) */
  cacheSize?: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  provider: 'auto',
  cacheSize: 1000,
  localModel: 'Xenova/all-MiniLM-L6-v2',
  ollamaBaseUrl: 'http://localhost:11434',
};
