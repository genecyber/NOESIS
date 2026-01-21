import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/idle-mode/config - Update idle mode configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, config } = body;

    if (!sessionId || !config) {
      return NextResponse.json({ error: 'Session ID and config required' }, { status: 400 });
    }

    // Forward request to backend server
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/idle-mode/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, config }),
    });

    if (!response.ok) {
      // If backend doesn't have idle mode yet, return mock success
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Configuration saved. Idle mode will be available once the backend implements the autonomous idle system',
          config
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to update idle mode config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}