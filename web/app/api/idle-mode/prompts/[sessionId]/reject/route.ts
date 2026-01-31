import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * POST /api/idle-mode/prompts/:sessionId/reject - Reject prompts and cancel session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const response = await backendFetch(request, `/api/idle-mode/prompts/${sessionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'No active session' }, { status: 404 });
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to reject prompts:', error);
    return NextResponse.json(
      { error: 'Failed to reject prompts' },
      { status: 500 }
    );
  }
}
