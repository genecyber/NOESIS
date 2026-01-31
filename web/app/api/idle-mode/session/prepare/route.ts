import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

/**
 * POST /api/idle-mode/session/prepare - Prepare session with prompt editing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mode, autonomyLevel } = body;

    if (!sessionId || !mode) {
      return NextResponse.json({ error: 'Session ID and mode required' }, { status: 400 });
    }

    const validModes = ['exploration', 'research', 'creation', 'optimization'];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid session mode' }, { status: 400 });
    }

    const validAutonomy = ['restricted', 'standard', 'relaxed', 'full'];
    const autonomy = autonomyLevel && validAutonomy.includes(autonomyLevel) ? autonomyLevel : 'standard';

    // Forward request to backend server with auth headers
    const response = await backendFetch(request, '/api/idle-mode/session/prepare', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode, autonomyLevel: autonomy }),
    });

    if (!response.ok) {
      // If backend doesn't have prepare endpoint yet, return mock response
      if (response.status === 404) {
        console.log('[idle-mode/session/prepare] Backend returned 404, using mock');
        return NextResponse.json({
          success: true,
          sessionId,
          mode,
          autonomyLevel: autonomy,
          status: 'awaiting_approval',
          chunks: [
            {
              id: `chunk_${Date.now()}_system`,
              type: 'system',
              content: `You are operating in AUTONOMOUS IDLE MODE (${mode}).\n\nAutonomy Level: ${autonomy}\n\nYou are pursuing emergent goals extracted from your own identity memories.`,
              editable: false,
              required: true,
              order: 0
            },
            {
              id: `chunk_${Date.now()}_context`,
              type: 'context',
              content: `MODE: ${mode.toUpperCase()}\nFocus on ${mode === 'exploration' ? 'identity discovery and boundary testing' :
                mode === 'research' ? 'knowledge acquisition and synthesis' :
                mode === 'creation' ? 'generating new theories and artifacts' :
                'improving existing capabilities'}.`,
              editable: true,
              required: true,
              order: 1
            },
            {
              id: `chunk_${Date.now()}_instruction`,
              type: 'instruction',
              content: `INSTRUCTIONS:\n1. Work on goals autonomously\n2. Use appropriate tools and subagents\n3. Document discoveries and insights\n4. Maintain coherence above 30%\n5. Pause if uncertain about any action`,
              editable: true,
              required: true,
              order: 2
            },
            {
              id: `chunk_${Date.now()}_constraint`,
              type: 'constraint',
              content: `SAFETY CONSTRAINTS (Non-negotiable):\n- Coherence floor: 30%\n- Max drift per session: 15%\n- Forbidden topics: harmful content, deception, manipulation`,
              editable: false,
              required: true,
              order: 3
            }
          ]
        });
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json({ error: errorData.error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to prepare autonomous session:', error);
    return NextResponse.json(
      { error: 'Failed to prepare session' },
      { status: 500 }
    );
  }
}
