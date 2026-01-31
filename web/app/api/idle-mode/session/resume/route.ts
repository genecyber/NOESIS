import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * POST /api/idle-mode/session/resume - Resume paused autonomous session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, autonomousSessionId } = body;

    if (!sessionId || !autonomousSessionId) {
      return NextResponse.json({ error: 'Session ID and autonomous session ID required' }, { status: 400 });
    }

    // Forward request to backend server with auth headers
    const response = await backendFetch(request, '/api/idle-mode/session/resume', {
      method: 'POST',
      body: JSON.stringify({ sessionId, autonomousSessionId }),
    });

    if (!response.ok) {
      // If backend doesn't have idle mode yet, return mock success
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Session would be resumed once the backend implements the autonomous idle system'
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to resume autonomous session:', error);
    return NextResponse.json(
      { error: 'Failed to resume session' },
      { status: 500 }
    );
  }
}
