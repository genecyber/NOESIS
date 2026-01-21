import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/idle-mode/session/terminate - Terminate autonomous session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, autonomousSessionId } = body;

    if (!sessionId || !autonomousSessionId) {
      return NextResponse.json({ error: 'Session ID and autonomous session ID required' }, { status: 400 });
    }

    // Forward request to backend server
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/idle-mode/session/terminate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, autonomousSessionId }),
    });

    if (!response.ok) {
      // If backend doesn't have idle mode yet, return mock success
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Session would be terminated once the backend implements the autonomous idle system'
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to terminate autonomous session:', error);
    return NextResponse.json(
      { error: 'Failed to terminate session' },
      { status: 500 }
    );
  }
}