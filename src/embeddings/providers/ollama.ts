/**
 * Ollama Embedding Provider (Stub)
 * Will use Ollama's local embedding models when available
 */

import type { EmbeddingProvider } from '../types';

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  name = 'ollama-nomic-embed';
  dimensions = 768; // nomic-embed-text default

  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'nomic-embed-text') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /** Get configured model name (for future use) */
  getModel(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (!response.ok) return false;

      // Check if the embedding model is available
      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models || [];
      return models.some(m => m.name.includes('embed') || m.name.includes('nomic'));
    } catch {
      return false;
    }
  }

  async embed(_text: string): Promise<number[]> {
    // TODO: Implement actual Ollama API call
    // const response = await fetch(`${this.baseUrl}/api/embeddings`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     model: this._model,
    //     prompt: _text,
    //   }),
    // });
    // const data = await response.json();
    // return data.embedding;

    throw new Error('Ollama embedding provider not yet implemented');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama doesn't support batching, process sequentially
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
