/**
 * Semantic Embeddings - Ralph Iteration 4 Feature 1
 *
 * Provides semantic similarity for memory retrieval.
 * Uses simple TF-IDF based embeddings as a starting point,
 * with hooks for upgrading to Voyage AI or other providers.
 */

/**
 * Simple TF-IDF based embedding (can be replaced with Voyage AI, OpenAI, etc.)
 * This is a basic implementation for bootstrapping - upgrade recommended.
 */

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
  'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'i', 'me',
  'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'as', 'if', 'each', 'how',
  'so', 'than', 'too', 'very', 'just', 'also', 'now'
]);

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Calculate term frequency for a document
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by document length
  const maxFreq = Math.max(...tf.values());
  for (const [term, freq] of tf.entries()) {
    tf.set(term, freq / maxFreq);
  }
  return tf;
}

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
export function createSparseEmbedding(text: string): SparseEmbedding {
  const tokens = tokenize(text);
  const terms = termFrequency(tokens);

  // Calculate magnitude for normalization
  let magnitude = 0;
  for (const weight of terms.values()) {
    magnitude += weight * weight;
  }
  magnitude = Math.sqrt(magnitude);

  return { terms, magnitude };
}

/**
 * Calculate cosine similarity between two sparse embeddings
 */
export function cosineSimilarity(a: SparseEmbedding, b: SparseEmbedding): number {
  if (a.magnitude === 0 || b.magnitude === 0) return 0;

  let dotProduct = 0;
  for (const [term, weightA] of a.terms.entries()) {
    const weightB = b.terms.get(term);
    if (weightB !== undefined) {
      dotProduct += weightA * weightB;
    }
  }

  return dotProduct / (a.magnitude * b.magnitude);
}

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
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 256) {
    this.dimension = dimension;
  }

  /**
   * Simple hash function for term -> bucket mapping
   */
  private hash(term: string): number {
    let hash = 0;
    for (let i = 0; i < term.length; i++) {
      const char = term.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % this.dimension;
  }

  async embed(text: string): Promise<DenseEmbedding> {
    const sparse = createSparseEmbedding(text);
    const vector = new Array(this.dimension).fill(0);

    // Hash terms into buckets with their weights
    for (const [term, weight] of sparse.terms.entries()) {
      const bucket = this.hash(term);
      // Use a second hash to determine sign (for better distribution)
      const sign = this.hash(term + '_sign') % 2 === 0 ? 1 : -1;
      vector[bucket] += sign * weight;
    }

    // L2 normalize
    let magnitude = 0;
    for (const val of vector) {
      magnitude += val * val;
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return { vector, dimension: this.dimension };
  }

  async embedBatch(texts: string[]): Promise<DenseEmbedding[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }

  similarity(a: DenseEmbedding, b: DenseEmbedding): number {
    if (a.dimension !== b.dimension) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    for (let i = 0; i < a.dimension; i++) {
      dotProduct += a.vector[i] * b.vector[i];
    }

    // Vectors are already normalized, so dot product = cosine similarity
    return dotProduct;
  }
}

/**
 * Voyage AI embedding provider (placeholder - requires API key)
 */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimension: number;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'voyage-3';
    this.dimension = 1024; // Voyage embeddings are 1024-dim
  }

  async embed(text: string): Promise<DenseEmbedding> {
    // Voyage AI API call
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      vector: data.data[0].embedding,
      dimension: this.dimension
    };
  }

  async embedBatch(texts: string[]): Promise<DenseEmbedding[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => ({
      vector: d.embedding,
      dimension: this.dimension
    }));
  }

  similarity(a: DenseEmbedding, b: DenseEmbedding): number {
    let dotProduct = 0;
    for (let i = 0; i < a.dimension; i++) {
      dotProduct += a.vector[i] * b.vector[i];
    }
    return dotProduct;
  }
}

/**
 * Create an embedding provider based on config
 */
export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case 'voyage':
      if (!config.apiKey) {
        throw new Error('Voyage AI requires an API key');
      }
      return new VoyageEmbeddingProvider({
        apiKey: config.apiKey,
        model: config.model
      });
    case 'local':
    default:
      return new LocalEmbeddingProvider(config.dimension || 256);
  }
}

// Default provider (local)
let defaultProvider: EmbeddingProvider = new LocalEmbeddingProvider();

/**
 * Set the default embedding provider
 */
export function setDefaultProvider(provider: EmbeddingProvider): void {
  defaultProvider = provider;
}

/**
 * Get the default embedding provider
 */
export function getDefaultProvider(): EmbeddingProvider {
  return defaultProvider;
}

/**
 * Embed text using the default provider
 */
export async function embed(text: string): Promise<DenseEmbedding> {
  return defaultProvider.embed(text);
}

/**
 * Calculate similarity between two texts
 */
export async function textSimilarity(a: string, b: string): Promise<number> {
  const [embA, embB] = await Promise.all([
    defaultProvider.embed(a),
    defaultProvider.embed(b)
  ]);
  return defaultProvider.similarity(embA, embB);
}

/**
 * Find most similar texts from a corpus
 */
export async function findSimilar(
  query: string,
  corpus: string[],
  topK: number = 5
): Promise<Array<{ text: string; similarity: number; index: number }>> {
  const queryEmb = await defaultProvider.embed(query);
  const corpusEmbs = await defaultProvider.embedBatch(corpus);

  const similarities = corpusEmbs.map((emb, index) => ({
    text: corpus[index],
    similarity: defaultProvider.similarity(queryEmb, emb),
    index
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
