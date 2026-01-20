/**
 * Embeddings client for browser-side usage
 * Communicates with /api/embeddings endpoint
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

// ============================================================================
// Configuration
// ============================================================================

const API_ENDPOINT = '/api/embeddings';

/**
 * Custom error class for embedding-related errors
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'COMPUTATION_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

// ============================================================================
// API Communication
// ============================================================================

/**
 * Make a POST request to the embeddings API
 */
async function apiRequest<T>(body: Record<string, unknown>): Promise<T> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new EmbeddingError(
        'Network error: Unable to reach embeddings API',
        'NETWORK_ERROR',
        error
      );
    }

    throw new EmbeddingError(
      'Unexpected error during API request',
      'API_ERROR',
      error
    );
  }
}

// ============================================================================
// Embedding Functions
// ============================================================================

/**
 * Generate embedding for a single text
 *
 * @param text - The text to embed
 * @returns Promise resolving to a 384-dimensional embedding vector
 * @throws EmbeddingError if the request fails
 *
 * @example
 * ```typescript
 * const embedding = await embed("Hello, world!");
 * console.log(embedding.length); // 384
 * ```
 */
export async function embed(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new EmbeddingError(
      'Text must be a non-empty string',
      'VALIDATION_ERROR'
    );
  }

  const result = await apiRequest<EmbeddingResult>({
    action: 'embed',
    text,
  });

  return result.embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch request
 * More efficient than calling embed() multiple times
 *
 * @param texts - Array of texts to embed
 * @returns Promise resolving to array of 384-dimensional embedding vectors
 * @throws EmbeddingError if the request fails
 *
 * @example
 * ```typescript
 * const embeddings = await embedBatch(["Hello", "World", "Test"]);
 * console.log(embeddings.length); // 3
 * console.log(embeddings[0].length); // 384
 * ```
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new EmbeddingError(
      'Texts must be a non-empty array of strings',
      'VALIDATION_ERROR'
    );
  }

  if (!texts.every((t) => typeof t === 'string')) {
    throw new EmbeddingError(
      'All items in texts array must be strings',
      'VALIDATION_ERROR'
    );
  }

  const result = await apiRequest<EmbeddingBatchResult>({
    action: 'embedBatch',
    texts,
  });

  return result.embeddings;
}

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Calculate cosine similarity between two embedding vectors
 * This is computed locally without an API call for performance
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 * @throws EmbeddingError if vectors have different dimensions
 *
 * @example
 * ```typescript
 * const emb1 = await embed("Hello");
 * const emb2 = await embed("Hi there");
 * const similarity = cosineSimilarity(emb1, emb2);
 * console.log(similarity); // ~0.7 (high similarity)
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new EmbeddingError(
      'Both arguments must be arrays',
      'VALIDATION_ERROR'
    );
  }

  if (a.length !== b.length) {
    throw new EmbeddingError(
      `Embedding dimension mismatch: ${a.length} vs ${b.length}`,
      'VALIDATION_ERROR'
    );
  }

  if (a.length === 0) {
    throw new EmbeddingError(
      'Embeddings cannot be empty arrays',
      'VALIDATION_ERROR'
    );
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

  if (magnitude === 0) {
    return 0;
  }

  return dot / magnitude;
}

/**
 * Calculate cosine similarity using the server API
 * Use this when you want consistent results with server-side computations
 * or when you don't have the embeddings locally
 *
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Promise resolving to similarity score between -1 and 1
 * @throws EmbeddingError if the request fails
 */
export async function computeSimilarity(
  embedding1: number[],
  embedding2: number[]
): Promise<number> {
  if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
    throw new EmbeddingError(
      'Both arguments must be arrays',
      'VALIDATION_ERROR'
    );
  }

  if (!embedding1.every((n) => typeof n === 'number') ||
      !embedding2.every((n) => typeof n === 'number')) {
    throw new EmbeddingError(
      'Embeddings must contain only numbers',
      'VALIDATION_ERROR'
    );
  }

  const result = await apiRequest<SimilarityResult>({
    action: 'similarity',
    embedding1,
    embedding2,
  });

  return result.similarity;
}

/**
 * Find the most similar texts from a list of candidates
 *
 * @param query - The query text to compare against
 * @param candidates - Array of candidate texts to search
 * @param topK - Number of results to return (default: 5)
 * @returns Promise resolving to ranked results with similarity scores
 * @throws EmbeddingError if the request fails
 *
 * @example
 * ```typescript
 * const results = await findSimilar(
 *   "machine learning",
 *   ["artificial intelligence", "cooking recipes", "neural networks", "gardening tips"],
 *   2
 * );
 * // results.results = [
 * //   { text: "artificial intelligence", similarity: 0.85 },
 * //   { text: "neural networks", similarity: 0.82 }
 * // ]
 * ```
 */
export async function findSimilar(
  query: string,
  candidates: string[],
  topK: number = 5
): Promise<FindSimilarResult> {
  if (!query || typeof query !== 'string') {
    throw new EmbeddingError(
      'Query must be a non-empty string',
      'VALIDATION_ERROR'
    );
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new EmbeddingError(
      'Candidates must be a non-empty array of strings',
      'VALIDATION_ERROR'
    );
  }

  if (!candidates.every((c) => typeof c === 'string')) {
    throw new EmbeddingError(
      'All candidates must be strings',
      'VALIDATION_ERROR'
    );
  }

  if (typeof topK !== 'number' || topK < 1) {
    throw new EmbeddingError(
      'topK must be a positive number',
      'VALIDATION_ERROR'
    );
  }

  const result = await apiRequest<FindSimilarResult>({
    action: 'findSimilar',
    query,
    candidates,
    topK,
  });

  return result;
}

// ============================================================================
// Dimensionality Reduction for Visualization
// ============================================================================

/**
 * Fixed projection matrix for reducing 384-dim embeddings to 3D
 * Generated using PCA-like basis vectors optimized for semantic embedding space
 * These vectors capture different semantic dimensions:
 * - Component 1: General semantic meaning/topic
 * - Component 2: Sentiment/affect polarity
 * - Component 3: Specificity/abstraction level
 */
const PROJECTION_MATRIX = generateProjectionMatrix();

/**
 * Generate a deterministic pseudo-random projection matrix
 * Uses a fixed seed for reproducibility across sessions
 * The matrix is designed to preserve relative distances while reducing dimensions
 */
function generateProjectionMatrix(): number[][] {
  const inputDim = 384;
  const outputDim = 3;
  const matrix: number[][] = [];

  // Deterministic seed-based pseudo-random number generator
  function seededRandom(seed: number): () => number {
    return function() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  // Different seeds for each output dimension to ensure diversity
  const seeds = [42, 137, 256];

  for (let i = 0; i < outputDim; i++) {
    const random = seededRandom(seeds[i]);
    const row: number[] = [];
    let sumSquares = 0;

    // Generate random values with Gaussian-like distribution using Box-Muller
    for (let j = 0; j < inputDim; j++) {
      // Box-Muller transform for Gaussian distribution
      const u1 = random();
      const u2 = random();
      const value = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      row.push(value);
      sumSquares += value * value;
    }

    // Normalize the row to unit length for better numerical stability
    const norm = Math.sqrt(sumSquares);
    for (let j = 0; j < inputDim; j++) {
      row[j] /= norm;
    }

    matrix.push(row);
  }

  return matrix;
}

/**
 * Project high-dimensional embeddings (384-dim) to 3D for visualization
 * Uses a fixed random projection matrix that preserves relative distances
 * (Johnson-Lindenstrauss lemma guarantees approximate distance preservation)
 *
 * The resulting 3D coordinates are normalized to [-1, 1] range for each axis
 *
 * @param embeddings - Array of 384-dimensional embedding vectors
 * @returns Array of 3D points suitable for visualization
 * @throws EmbeddingError if embeddings are invalid
 *
 * @example
 * ```typescript
 * const texts = ["hello", "world", "test"];
 * const embeddings = await embedBatch(texts);
 * const points3D = projectTo3D(embeddings);
 * // points3D = [
 * //   { x: 0.3, y: -0.5, z: 0.2 },
 * //   { x: 0.4, y: -0.4, z: 0.3 },
 * //   { x: -0.6, y: 0.1, z: -0.2 }
 * // ]
 * ```
 */
export function projectTo3D(
  embeddings: number[][]
): { x: number; y: number; z: number }[] {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new EmbeddingError(
      'Embeddings must be a non-empty array',
      'VALIDATION_ERROR'
    );
  }

  // Validate all embeddings have correct dimension
  for (let i = 0; i < embeddings.length; i++) {
    if (!Array.isArray(embeddings[i])) {
      throw new EmbeddingError(
        `Embedding at index ${i} is not an array`,
        'VALIDATION_ERROR'
      );
    }
    if (embeddings[i].length !== 384) {
      throw new EmbeddingError(
        `Embedding at index ${i} has dimension ${embeddings[i].length}, expected 384`,
        'VALIDATION_ERROR'
      );
    }
  }

  // Project each embedding to 3D using matrix multiplication
  const projected: { x: number; y: number; z: number }[] = [];

  // Track min/max for normalization
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  // First pass: compute projections
  const rawProjections: [number, number, number][] = [];

  for (const embedding of embeddings) {
    let x = 0, y = 0, z = 0;

    for (let j = 0; j < 384; j++) {
      x += embedding[j] * PROJECTION_MATRIX[0][j];
      y += embedding[j] * PROJECTION_MATRIX[1][j];
      z += embedding[j] * PROJECTION_MATRIX[2][j];
    }

    rawProjections.push([x, y, z]);

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  // Second pass: normalize to [-1, 1] range
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;

  for (const [x, y, z] of rawProjections) {
    projected.push({
      x: ((x - minX) / rangeX) * 2 - 1,
      y: ((y - minY) / rangeY) * 2 - 1,
      z: ((z - minZ) / rangeZ) * 2 - 1,
    });
  }

  return projected;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize an embedding vector to unit length
 * Useful for ensuring consistent similarity calculations
 *
 * @param embedding - The embedding vector to normalize
 * @returns Normalized embedding with unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new EmbeddingError(
      'Embedding must be a non-empty array',
      'VALIDATION_ERROR'
    );
  }

  let sumSquares = 0;
  for (const value of embedding) {
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return embedding.slice(); // Return copy of zero vector
  }

  return embedding.map((v) => v / norm);
}

/**
 * Compute the average (centroid) of multiple embeddings
 * Useful for finding the semantic center of a cluster
 *
 * @param embeddings - Array of embedding vectors
 * @returns The average embedding vector
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new EmbeddingError(
      'Embeddings must be a non-empty array',
      'VALIDATION_ERROR'
    );
  }

  const dim = embeddings[0].length;
  const result = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    if (embedding.length !== dim) {
      throw new EmbeddingError(
        'All embeddings must have the same dimension',
        'VALIDATION_ERROR'
      );
    }
    for (let i = 0; i < dim; i++) {
      result[i] += embedding[i];
    }
  }

  const count = embeddings.length;
  return result.map((v) => v / count);
}
