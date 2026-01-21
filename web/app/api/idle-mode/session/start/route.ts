import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/idle-mode/session/start - Start manual autonomous session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mode } = body;

    if (!sessionId || !mode) {
      return NextResponse.json({ error: 'Session ID and mode required' }, { status: 400 });
    }

    const validModes = ['exploration', 'research', 'creation', 'optimization'];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid session mode' }, { status: 400 });
    }

    // Forward request to backend server
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/idle-mode/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, mode }),
    });

    if (!response.ok) {
      // If backend doesn't have idle mode yet, return mock session
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Session would start once the backend implements the autonomous idle system',
          currentSession: {
            id: `mock_${Date.now()}`,
            mode,
            status: 'active',
            startTime: new Date().toISOString(),
            goals: [`Mock goal for ${mode} session`],
            activities: 0,
            discoveries: 0,
            coherenceLevel: 65
          }
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to start autonomous session:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}