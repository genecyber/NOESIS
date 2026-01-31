import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * GET /api/idle-mode/prompts/:sessionId - Get prompt chunks for editing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const response = await backendFetch(request, `/api/idle-mode/prompts/${sessionId}`, {
      method: 'GET',
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
    console.error('Failed to get prompts:', error);
    return NextResponse.json(
      { error: 'Failed to get prompts' },
      { status: 500 }
    );
  }
}
