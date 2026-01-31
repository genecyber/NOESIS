import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * GET /api/idle-mode/status - Get current idle mode status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Forward request to backend server with auth headers
    const response = await backendFetch(
      request,
      `/api/idle-mode/status?sessionId=${encodeURIComponent(sessionId)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      // If idle mode system isn't available yet, return mock data
      if (response.status === 404) {
        return NextResponse.json({
          isIdle: false,
          idleDuration: 0,
          lastActivity: new Date().toISOString(),
          currentSession: null,
          sessionHistory: [],
          config: {
            enabled: false,
            idleThreshold: 30,
            maxSessionDuration: 120,
            evolutionIntensity: 'moderate',
            safetyLevel: 'high',
            coherenceFloor: 30,
            allowedGoalTypes: [],
            researchDomains: [],
            externalPublishing: false,
            subagentCoordination: true,
          },
          learningHistory: [],
          emergentCategories: []
        });
      }

      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to get idle mode status:', error);

    // Return fallback mock data if backend is not available
    return NextResponse.json({
      isIdle: false,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      currentSession: null,
      sessionHistory: [],
      config: {
        enabled: false,
        idleThreshold: 30,
        maxSessionDuration: 120,
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30,
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      },
      learningHistory: [],
      emergentCategories: []
    });
  }
}
