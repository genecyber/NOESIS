import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/idle-mode/toggle - Toggle idle mode on/off
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, enabled } = body;

    if (!sessionId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Session ID and enabled flag required' }, { status: 400 });
    }

    // Forward request to backend server
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/idle-mode/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, enabled }),
    });

    if (!response.ok) {
      // If backend doesn't have idle mode yet, return mock success
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Idle mode will be available once the backend implements the autonomous idle system',
          config: {
            enabled,
            idleThreshold: 30,
            maxSessionDuration: 120,
            evolutionIntensity: 'moderate',
            safetyLevel: 'high',
            coherenceFloor: 30,
            allowedGoalTypes: [],
            researchDomains: [],
            externalPublishing: false,
            subagentCoordination: true,
          }
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to toggle idle mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle idle mode' },
      { status: 500 }
    );
  }
}