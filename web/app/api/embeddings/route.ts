/**
 * Embeddings API Route (Proxy)
 *
 * Proxies embedding requests to the main NOESIS server which has access
 * to the full embeddings service with local transformer models.
 *
 * Supports the following actions:
 * - embed: Generate embedding for a single text
 * - embedBatch: Generate embeddings for multiple texts
 * - similarity: Calculate cosine similarity between two embeddings
 * - findSimilar: Find most similar texts from a list of candidates
 */

import { NextRequest, NextResponse } from 'next/server';

// Server URL - defaults to localhost:3001 (NOESIS server)
const SERVER_URL = process.env.NOESIS_SERVER_URL || 'http://localhost:3001';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Handle GET requests - return API info
 */
export async function GET() {
  try {
    const response = await fetch(`${SERVER_URL}/api/embeddings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return NextResponse.json(error, { status: response.status, headers: corsHeaders });
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error('[Embeddings Proxy] GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to embedding server',
        hint: 'Ensure the NOESIS server is running on port 3001'
      },
      { status: 503, headers: corsHeaders }
    );
  }
}

/**
 * Handle POST requests - proxy to server
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

    // Proxy to the NOESIS server
    const response = await fetch(`${SERVER_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Server error' }));
      return NextResponse.json(error, { status: response.status, headers: corsHeaders });
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error('[Embeddings Proxy] POST error:', error);

    return NextResponse.json(
      {
        error: 'Failed to connect to embedding server',
        hint: 'Ensure the NOESIS server is running on port 3001'
      },
      { status: 503, headers: corsHeaders }
    );
  }
}
