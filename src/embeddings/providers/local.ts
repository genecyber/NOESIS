/**
 * Local Embedding Provider
 * Uses @xenova/transformers for offline embeddings
 */

import type { EmbeddingProvider } from '../types.js';

// Dynamic import to handle the transformers library
let pipeline: typeof import('@xenova/transformers').pipeline | null = null;
type FeatureExtractionPipeline = Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'local-minilm';
  dimensions = 384; // all-MiniLM-L6-v2 outputs 384-dimensional vectors

  private modelName: string;
  private model: FeatureExtractionPipeline | null = null;
  private modelLoading: Promise<FeatureExtractionPipeline> | null = null;
  private initError: Error | null = null;

  constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
    this.modelName = modelName;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to import the library
      if (!pipeline) {
        const transformers = await import('@xenova/transformers');
        pipeline = transformers.pipeline;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async getModel(): Promise<FeatureExtractionPipeline> {
    if (this.model) return this.model;
    if (this.initError) throw this.initError;

    if (!this.modelLoading) {
      this.modelLoading = (async () => {
        try {
          if (!pipeline) {
            const transformers = await import('@xenova/transformers');
            pipeline = transformers.pipeline;
          }

          console.log(`Loading embedding model: ${this.modelName}...`);
          const model = await pipeline('feature-extraction', this.modelName, {
            quantized: true, // Use quantized model for smaller size
          });
          console.log('Embedding model loaded successfully');
          return model;
        } catch (error) {
          this.initError = error instanceof Error ? error : new Error(String(error));
          throw this.initError;
        }
      })();
    }

    this.model = await this.modelLoading;
    return this.model;
  }

  async embed(text: string): Promise<number[]> {
    const model = await this.getModel();
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Extract the embedding array from the tensor
    const tensor = output as { data: Float32Array };
    return Array.from(tensor.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const model = await this.getModel();
    const results: number[][] = [];

    // Process sequentially to avoid memory issues
    for (const text of texts) {
      const output = await model(text, {
        pooling: 'mean',
        normalize: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
      const tensor = output as { data: Float32Array };
      results.push(Array.from(tensor.data));
    }

    return results;
  }
}
