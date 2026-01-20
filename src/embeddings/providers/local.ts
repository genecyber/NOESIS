/**
 * Local Embedding Provider
 * Uses @xenova/transformers for offline embeddings
 * Models are bundled in the models/ directory
 */

import type { EmbeddingProvider } from '../types.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get the project root directory - try multiple approaches
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findModelsDir(): string {
  // Try relative to this file (works in dev)
  const fromFile = path.resolve(__dirname, '../../..', 'models');
  if (fs.existsSync(fromFile)) {
    console.log(`[LocalEmbedding] Found models at: ${fromFile}`);
    return fromFile;
  }

  // Try relative to cwd (works on Railway)
  const fromCwd = path.join(process.cwd(), 'models');
  if (fs.existsSync(fromCwd)) {
    console.log(`[LocalEmbedding] Found models at: ${fromCwd}`);
    return fromCwd;
  }

  // Try env var
  const fromEnv = process.env.MODELS_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) {
    console.log(`[LocalEmbedding] Found models at: ${fromEnv}`);
    return fromEnv;
  }

  console.error(`[LocalEmbedding] Models not found! Tried:`);
  console.error(`  - ${fromFile}`);
  console.error(`  - ${fromCwd}`);
  console.error(`  - MODELS_DIR env: ${fromEnv || '(not set)'}`);
  console.error(`  - cwd: ${process.cwd()}`);
  console.error(`  - __dirname: ${__dirname}`);

  // Return cwd path as fallback (will trigger download)
  return fromCwd;
}

const MODELS_DIR = findModelsDir();

// Dynamic import to handle the transformers library
let pipeline: typeof import('@xenova/transformers').pipeline | null = null;
let env: typeof import('@xenova/transformers').env | null = null;
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
        env = transformers.env;

        // Configure to use bundled models
        if (env) {
          // Use local models directory instead of downloading
          env.localModelPath = MODELS_DIR;
          // Allow remote as fallback in case model isn't bundled
          env.allowRemoteModels = true;
          // Cache to local models dir
          env.cacheDir = MODELS_DIR;

          console.log(`[LocalEmbedding] Using models from: ${MODELS_DIR}`);
        }
      }
      return true;
    } catch (error) {
      console.error('[LocalEmbedding] Failed to load transformers:', error);
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
            env = transformers.env;

            if (env) {
              env.localModelPath = MODELS_DIR;
              env.allowRemoteModels = true;
              env.cacheDir = MODELS_DIR;
            }
          }

          console.log(`[LocalEmbedding] Loading model: ${this.modelName}...`);
          console.log(`[LocalEmbedding] Models directory: ${MODELS_DIR}`);

          const model = await pipeline('feature-extraction', this.modelName, {
            quantized: true, // Use quantized model for smaller size
          });

          console.log('[LocalEmbedding] Model loaded successfully');
          return model;
        } catch (error) {
          console.error('[LocalEmbedding] Failed to load model:', error);
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
