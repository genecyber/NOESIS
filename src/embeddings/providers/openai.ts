/**
 * OpenAI Embedding Provider (Stub)
 * Will use OpenAI's text-embedding-3-small model when API key is provided
 */

import type { EmbeddingProvider } from '../types.js';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai-embedding-3-small';
  dimensions = 1536; // text-embedding-3-small default

  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    // Only available if API key is provided
    return !!this.apiKey;
  }

  async embed(_text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // TODO: Implement actual OpenAI API call
    // const response = await fetch('https://api.openai.com/v1/embeddings', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'text-embedding-3-small',
    //     input: _text,
    //   }),
    // });
    // const data = await response.json();
    // return data.data[0].embedding;

    throw new Error('OpenAI embedding provider not yet implemented');
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // TODO: Implement batch API call
    // OpenAI supports batching in a single request

    throw new Error('OpenAI embedding provider not yet implemented');
  }
}
