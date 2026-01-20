/**
 * Embeddings client for browser-side usage
 *
 * Supports two modes:
 * 1. Server-side (default): Uses /api/embeddings endpoint (OpenAI)
 * 2. Local (optional): Uses @xenova/transformers in browser
 *
 * Local mode is useful for:
 * - Offline usage
 * - Development without API keys
 * - Privacy-sensitive applications
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
}

export interface EmbeddingBatchResult {
  embeddings: number[][];
}

export interface SimilarityResult {
  similarity: number;
}

export interface FindSimilarResult {
  results: Array<{ text: string; similarity: number }>;
}

interface ApiErrorResponse {
  error: string;
  message?: string;
  hint?: string;
}

export type EmbeddingMode = 'server' | 'local' | 'auto';

export interface EmbeddingConfig {
  mode: EmbeddingMode;
  serverEndpoint?: string;
  localModel?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  mode: 'auto', // Try server first, fall back to local
  serverEndpoint: '/api/embeddings',
  localModel: 'Xenova/all-MiniLM-L6-v2',
};

let currentConfig = { ...DEFAULT_CONFIG };

// Local model state
let localPipeline: unknown = null;
let localModelLoading: Promise<unknown> | null = null;
let localModelError: Error | null = null;

/**
 * Configure the embedding client
 */
export function configureEmbeddings(config: Partial<EmbeddingConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current configuration
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return { ...currentConfig };
}

/**
 * Custom error class for embedding-related errors
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'COMPUTATION_ERROR' | 'LOCAL_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

// ============================================================================
// Local Embeddings (Browser-based)
// ============================================================================

/**
 * Check if local embeddings are available
 */
export async function isLocalAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const transformers = await import('@xenova/transformers');
    return !!transformers.pipeline;
  } catch {
    return false;
  }
}

/**
 * Load the local embedding model
 */
async function loadLocalModel(): Promise<unknown> {
  if (localPipeline) return localPipeline;
  if (localModelError) throw localModelError;

  if (!localModelLoading) {
    localModelLoading = (async () => {
      try {
        console.log('[Embeddings] Loading local model...');
        const { pipeline, env } = await import('@xenova/transformers');

        // Configure for browser
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const model = await pipeline('feature-extraction', currentConfig.localModel, {
          quantized: true,
        });

        console.log('[Embeddings] Local model loaded');
        return model;
      } catch (error) {
        console.error('[Embeddings] Failed to load local model:', error);
        localModelError = error instanceof Error ? error : new Error(String(error));
        throw localModelError;
      }
    })();
  }

  localPipeline = await localModelLoading;
  return localPipeline;
}

/**
 * Embed text using local model
 */
async function embedLocal(text: string): Promise<number[]> {
  const model = await loadLocalModel() as (text: string, options: object) => Promise<{ data: Float32Array }>;
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Embed batch using local model
 */
async function embedBatchLocal(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedLocal(text));
  }
  return results;
}

// ============================================================================
// Server API Communication
// ============================================================================

/**
 * Check if server embeddings are available
 */
export async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(currentConfig.serverEndpoint || '/api/embeddings', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.available !== false;
  } catch {
    return false;
  }
}

/**
 * Make a POST request to the embeddings API
 */
async function apiRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(currentConfig.serverEndpoint || '/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new EmbeddingError(
      errorData.error || 'API request failed',
      'API_ERROR',
      { status: response.status, ...errorData }
    );
  }

  return data as T;
}

/**
 * Embed text using server API
 */
async function embedServer(text: string): Promise<number[]> {
  const result = await apiRequest<EmbeddingResult>({ action: 'embed', text });
  return result.embedding;
}

/**
 * Embed batch using server API
 */
async function embedBatchServer(texts: string[]): Promise<number[][]> {
  const result = await apiRequest<EmbeddingBatchResult>({ action: 'embedBatch', texts });
  return result.embeddings;
}

// ============================================================================
// Unified Embedding Functions
// ============================================================================

/**
 * Generate embedding for a single text
 * Uses configured mode (server, local, or auto)
 */
export async function embed(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new EmbeddingError('Text must be a non-empty string', 'VALIDATION_ERROR');
  }

  const { mode } = currentConfig;

  if (mode === 'local') {
    return embedLocal(text);
  }

  if (mode === 'server') {
    return embedServer(text);
  }

  // Auto mode: try server first, fall back to local
  try {
    return await embedServer(text);
  } catch (serverError) {
    console.warn('[Embeddings] Server failed, trying local:', serverError);
    try {
      return await embedLocal(text);
    } catch (localError) {
      throw new EmbeddingError(
        'Both server and local embeddings failed',
        'COMPUTATION_ERROR',
        { serverError, localError }
      );
    }
  }
}

/**
 * Generate embeddings for multiple texts
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new EmbeddingError('Texts must be a non-empty array of strings', 'VALIDATION_ERROR');
  }

  if (!texts.every((t) => typeof t === 'string')) {
    throw new EmbeddingError('All items in texts array must be strings', 'VALIDATION_ERROR');
  }

  const { mode } = currentConfig;

  if (mode === 'local') {
    return embedBatchLocal(texts);
  }

  if (mode === 'server') {
    return embedBatchServer(texts);
  }

  // Auto mode
  try {
    return await embedBatchServer(texts);
  } catch (serverError) {
    console.warn('[Embeddings] Server failed, trying local:', serverError);
    try {
      return await embedBatchLocal(texts);
    } catch (localError) {
      throw new EmbeddingError(
        'Both server and local embeddings failed',
        'COMPUTATION_ERROR',
        { serverError, localError }
      );
    }
  }
}

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Calculate cosine similarity between two embedding vectors (local computation)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new EmbeddingError('Both arguments must be arrays', 'VALIDATION_ERROR');
  }

  if (a.length !== b.length) {
    throw new EmbeddingError(`Embedding dimension mismatch: ${a.length} vs ${b.length}`, 'VALIDATION_ERROR');
  }

  if (a.length === 0) {
    throw new EmbeddingError('Embeddings cannot be empty arrays', 'VALIDATION_ERROR');
  }

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

/**
 * Calculate cosine similarity using the server API
 */
export async function computeSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
  // Always compute locally - no need for server round-trip
  return cosineSimilarity(embedding1, embedding2);
}

/**
 * Find the most similar texts from a list of candidates
 */
export async function findSimilar(
  query: string,
  candidates: string[],
  topK: number = 5
): Promise<FindSimilarResult> {
  if (!query || typeof query !== 'string') {
    throw new EmbeddingError('Query must be a non-empty string', 'VALIDATION_ERROR');
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new EmbeddingError('Candidates must be a non-empty array of strings', 'VALIDATION_ERROR');
  }

  const queryEmbedding = await embed(query);
  const candidateEmbeddings = await embedBatch(candidates);

  const results = candidates.map((text, i) => ({
    text,
    similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[i]),
  }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return { results };
}

// ============================================================================
// Dimensionality Reduction for Visualization
// ============================================================================

const PROJECTION_MATRIX = generateProjectionMatrix();

function generateProjectionMatrix(): number[][] {
  const inputDim = 1536; // OpenAI embedding dimension (also works for 384)
  const outputDim = 3;
  const matrix: number[][] = [];

  function seededRandom(seed: number): () => number {
    return function() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  const seeds = [42, 137, 256];

  for (let i = 0; i < outputDim; i++) {
    const random = seededRandom(seeds[i]);
    const row: number[] = [];
    let sumSquares = 0;

    for (let j = 0; j < inputDim; j++) {
      const u1 = random();
      const u2 = random();
      const value = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      row.push(value);
      sumSquares += value * value;
    }

    const norm = Math.sqrt(sumSquares);
    for (let j = 0; j < inputDim; j++) {
      row[j] /= norm;
    }

    matrix.push(row);
  }

  return matrix;
}

/**
 * Project high-dimensional embeddings to 3D for visualization
 * Supports both 384-dim (local) and 1536-dim (OpenAI) embeddings
 */
export function projectTo3D(embeddings: number[][]): { x: number; y: number; z: number }[] {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new EmbeddingError('Embeddings must be a non-empty array', 'VALIDATION_ERROR');
  }

  const dim = embeddings[0].length;
  const projMatrix = dim <= 384 ? PROJECTION_MATRIX.map(row => row.slice(0, dim)) : PROJECTION_MATRIX;

  const rawProjections: [number, number, number][] = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const embedding of embeddings) {
    let x = 0, y = 0, z = 0;
    const useDim = Math.min(dim, projMatrix[0].length);

    for (let j = 0; j < useDim; j++) {
      x += embedding[j] * projMatrix[0][j];
      y += embedding[j] * projMatrix[1][j];
      z += embedding[j] * projMatrix[2][j];
    }

    rawProjections.push([x, y, z]);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;

  return rawProjections.map(([x, y, z]) => ({
    x: ((x - minX) / rangeX) * 2 - 1,
    y: ((y - minY) / rangeY) * 2 - 1,
    z: ((z - minZ) / rangeZ) * 2 - 1,
  }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize an embedding vector to unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new EmbeddingError('Embedding must be a non-empty array', 'VALIDATION_ERROR');
  }

  let sumSquares = 0;
  for (const value of embedding) {
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  return norm === 0 ? embedding.slice() : embedding.map((v) => v / norm);
}

/**
 * Compute the average (centroid) of multiple embeddings
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new EmbeddingError('Embeddings must be a non-empty array', 'VALIDATION_ERROR');
  }

  const dim = embeddings[0].length;
  const result = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    if (embedding.length !== dim) {
      throw new EmbeddingError('All embeddings must have the same dimension', 'VALIDATION_ERROR');
    }
    for (let i = 0; i < dim; i++) {
      result[i] += embedding[i];
    }
  }

  return result.map((v) => v / embeddings.length);
}

/**
 * Get current embedding mode and availability status
 */
export async function getStatus(): Promise<{
  mode: EmbeddingMode;
  serverAvailable: boolean;
  localAvailable: boolean;
  activeProvider: 'server' | 'local' | 'none';
}> {
  const [serverAvailable, localAvailable] = await Promise.all([
    isServerAvailable().catch(() => false),
    isLocalAvailable().catch(() => false),
  ]);

  let activeProvider: 'server' | 'local' | 'none' = 'none';
  if (currentConfig.mode === 'server' && serverAvailable) activeProvider = 'server';
  else if (currentConfig.mode === 'local' && localAvailable) activeProvider = 'local';
  else if (currentConfig.mode === 'auto') {
    if (serverAvailable) activeProvider = 'server';
    else if (localAvailable) activeProvider = 'local';
  }

  return {
    mode: currentConfig.mode,
    serverAvailable,
    localAvailable,
    activeProvider,
  };
}
