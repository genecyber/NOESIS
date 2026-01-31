import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * POST /api/idle-mode/session/heartbeat - Continue idle session with next turn
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mode, context } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const response = await backendFetch(request, '/api/idle-mode/session/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode, context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Heartbeat failed' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to send heartbeat:', error);
    return NextResponse.json(
      { error: 'Failed to send heartbeat' },
      { status: 500 }
    );
  }
}
