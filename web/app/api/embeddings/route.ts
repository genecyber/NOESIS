/**
 * Embeddings API Route
 * Exposes the server-side EmbeddingService to the browser via REST API
 *
 * Supports the following actions:
 * - embed: Generate embedding for a single text
 * - embedBatch: Generate embeddings for multiple texts
 * - similarity: Calculate cosine similarity between two embeddings
 * - findSimilar: Find most similar texts from a list of candidates
 */

import { NextRequest, NextResponse } from 'next/server';

// Type definitions for request/response payloads
interface EmbedRequest {
  action: 'embed';
  text: string;
}

interface EmbedBatchRequest {
  action: 'embedBatch';
  texts: string[];
}

interface SimilarityRequest {
  action: 'similarity';
  embedding1: number[];
  embedding2: number[];
}

interface FindSimilarRequest {
  action: 'findSimilar';
  query: string;
  candidates: string[];
  topK?: number;
}

type EmbeddingRequest = EmbedRequest | EmbedBatchRequest | SimilarityRequest | FindSimilarRequest;

// Interface for the EmbeddingService (matching the actual service)
interface IEmbeddingService {
  initialize(): Promise<void>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  findMostSimilar(
    query: string,
    candidates: string[],
    topK?: number
  ): Promise<Array<{ text: string; similarity: number; index: number }>>;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Lazy-loaded embedding service instance
let embeddingService: IEmbeddingService | null = null;

/**
 * Dynamically import and initialize the EmbeddingService
 * Uses dynamic import to avoid loading heavy ML dependencies at module initialization
 */
async function getEmbeddingService(): Promise<IEmbeddingService> {
  if (embeddingService) {
    return embeddingService;
  }

  try {
    // Dynamic import from the main project's embeddings service
    const { EmbeddingService } = await import('../../../../src/embeddings/service');
    const service = new EmbeddingService({
      provider: 'local', // Use local provider for server-side embeddings
      localModel: 'Xenova/all-MiniLM-L6-v2',
    }) as IEmbeddingService;

    await service.initialize();
    embeddingService = service;
    return service;
  } catch (error) {
    console.error('Failed to initialize EmbeddingService:', error);
    throw new Error('Embedding service initialization failed');
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Standalone function for similarity requests that don't need the full service
 */
function cosineSimilarity(a: number[], b: number[]): number {
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
 * Validate request body structure
 */
function validateRequest(body: unknown): body is EmbeddingRequest {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const req = body as Record<string, unknown>;

  if (!req.action || typeof req.action !== 'string') {
    return false;
  }

  switch (req.action) {
    case 'embed':
      return typeof req.text === 'string' && req.text.length > 0;

    case 'embedBatch':
      return Array.isArray(req.texts) &&
             req.texts.length > 0 &&
             req.texts.every((t: unknown) => typeof t === 'string');

    case 'similarity':
      return Array.isArray(req.embedding1) &&
             Array.isArray(req.embedding2) &&
             req.embedding1.every((n: unknown) => typeof n === 'number') &&
             req.embedding2.every((n: unknown) => typeof n === 'number');

    case 'findSimilar':
      return typeof req.query === 'string' &&
             req.query.length > 0 &&
             Array.isArray(req.candidates) &&
             req.candidates.length > 0 &&
             req.candidates.every((c: unknown) => typeof c === 'string') &&
             (req.topK === undefined || (typeof req.topK === 'number' && req.topK > 0));

    default:
      return false;
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Handle GET requests - return API info and health status
 */
export async function GET() {
  return NextResponse.json({
    service: 'embeddings',
    version: '1.0.0',
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    endpoints: {
      POST: {
        embed: {
          description: 'Generate embedding for a single text',
          request: { action: 'embed', text: 'string' },
          response: { embedding: 'number[]' },
        },
        embedBatch: {
          description: 'Generate embeddings for multiple texts',
          request: { action: 'embedBatch', texts: 'string[]' },
          response: { embeddings: 'number[][]' },
        },
        similarity: {
          description: 'Calculate cosine similarity between two embeddings',
          request: { action: 'similarity', embedding1: 'number[]', embedding2: 'number[]' },
          response: { similarity: 'number' },
        },
        findSimilar: {
          description: 'Find most similar texts from a list of candidates',
          request: { action: 'findSimilar', query: 'string', candidates: 'string[]', topK: 'number (optional, default 5)' },
          response: { results: '{ text: string, similarity: number }[]' },
        },
      },
    },
  }, { headers: corsHeaders });
}

/**
 * Handle POST requests - main embedding operations
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate request
    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          hint: 'Use GET request to see available actions and their required parameters',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Handle each action type
    switch (body.action) {
      case 'embed': {
        const service = await getEmbeddingService();
        const embedding = await service.embed(body.text);
        return NextResponse.json(
          { embedding },
          { headers: corsHeaders }
        );
      }

      case 'embedBatch': {
        const service = await getEmbeddingService();
        const embeddings = await service.embedBatch(body.texts);
        return NextResponse.json(
          { embeddings },
          { headers: corsHeaders }
        );
      }

      case 'similarity': {
        // Cosine similarity can be computed without the full service
        const similarity = cosineSimilarity(body.embedding1, body.embedding2);
        return NextResponse.json(
          { similarity },
          { headers: corsHeaders }
        );
      }

      case 'findSimilar': {
        const service = await getEmbeddingService();
        const results = await service.findMostSimilar(
          body.query,
          body.candidates,
          body.topK ?? 5
        );
        // Return only text and similarity (exclude index for API simplicity)
        return NextResponse.json(
          {
            results: results.map((r: { text: string; similarity: number }) => ({
              text: r.text,
              similarity: r.similarity
            }))
          },
          { headers: corsHeaders }
        );
      }

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = body;
        return NextResponse.json(
          { error: `Unknown action: ${(_exhaustive as EmbeddingRequest).action}` },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('Embeddings API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}
