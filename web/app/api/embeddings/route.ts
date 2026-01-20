/**
 * Embeddings API Route (OpenAI)
 *
 * Uses OpenAI's text-embedding-3-small model directly.
 * Set OPENAI_API_KEY in environment variables.
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({
    service: 'embeddings',
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    available: !!OPENAI_API_KEY,
  }, { headers: corsHeaders });
}

async function embedWithOpenAI(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 503, headers: corsHeaders }
      );
    }

    const body = await request.json() as {
      action: string;
      text?: string;
      texts?: string[];
      embedding1?: number[];
      embedding2?: number[];
      query?: string;
      candidates?: string[];
      topK?: number;
    };

    const { action, text, texts, embedding1, embedding2, query, candidates, topK } = body;

    switch (action) {
      case 'embed': {
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400, headers: corsHeaders });
        }
        const [embedding] = await embedWithOpenAI([text]);
        return NextResponse.json({ embedding }, { headers: corsHeaders });
      }

      case 'embedBatch': {
        if (!texts || !Array.isArray(texts)) {
          return NextResponse.json({ error: 'texts array required' }, { status: 400, headers: corsHeaders });
        }
        const embeddings = await embedWithOpenAI(texts);
        return NextResponse.json({ embeddings }, { headers: corsHeaders });
      }

      case 'similarity': {
        if (!embedding1 || !embedding2) {
          return NextResponse.json({ error: 'embedding1 and embedding2 required' }, { status: 400, headers: corsHeaders });
        }
        const similarity = cosineSimilarity(embedding1, embedding2);
        return NextResponse.json({ similarity }, { headers: corsHeaders });
      }

      case 'findSimilar': {
        if (!query || !candidates) {
          return NextResponse.json({ error: 'query and candidates required' }, { status: 400, headers: corsHeaders });
        }
        const allTexts = [query, ...candidates];
        const allEmbeddings = await embedWithOpenAI(allTexts);
        const queryEmbedding = allEmbeddings[0];
        const candidateEmbeddings = allEmbeddings.slice(1);

        const results = candidates.map((text, i) => ({
          text,
          similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[i]),
          index: i,
        }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK || 5);

        return NextResponse.json({ results }, { headers: corsHeaders });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
    }
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
