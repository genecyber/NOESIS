import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * PUT /api/idle-mode/prompts/:sessionId/:chunkId - Update a prompt chunk
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; chunkId: string }> }
) {
  try {
    const { sessionId, chunkId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const response = await backendFetch(request, `/api/idle-mode/prompts/${sessionId}/${chunkId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Session or chunk not found' }, { status: 404 });
      }
      if (response.status === 400) {
        return NextResponse.json({ error: 'Chunk not editable' }, { status: 400 });
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to update prompt chunk:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}
