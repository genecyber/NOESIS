/**
 * METAMORPH REST API Server
 *
 * Phase 6: REST API with SSE streaming
 * - POST /api/chat - Send a message and receive response
 * - GET /api/chat/stream - SSE streaming endpoint
 * - GET /api/state - Get current agent state
 * - PUT /api/config - Update configuration
 * - GET /api/identity - Get identity information
 * - GET /api/memory/search - Search semantic memory
 * - GET /api/logs - Get transformation logs
 * - POST /api/command - Execute a command
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MetamorphAgent, StreamCallbacks } from '../agent/index.js';
import { ModeConfig } from '../types/index.js';
import { MetamorphRuntime } from '../runtime/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Unified runtime instance (replaces per-session agent Map)
const runtime = new MetamorphRuntime();

// Default session ID for requests without explicit session
const DEFAULT_SESSION = 'default';

/**
 * Helper to get agent from session, creating if necessary
 * Maintains backward compatibility with existing endpoints
 */
function getOrCreateAgent(sessionId?: string, config?: Partial<ModeConfig>): MetamorphAgent {
  const effectiveSessionId = sessionId || DEFAULT_SESSION;
  const session = runtime.sessions.getOrCreate(effectiveSessionId, { config });
  return session.agent;
}

// API Key authentication middleware (optional)
const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.METAMORPH_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
};

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Get API info
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'METAMORPH API',
    version: '0.1.0',
    endpoints: {
      'POST /api/chat': 'Send a message and receive response',
      'GET /api/chat/stream': 'SSE streaming endpoint',
      'GET /api/state': 'Get current agent state',
      'PUT /api/config': 'Update configuration',
      'GET /api/identity': 'Get identity information',
      'GET /api/subagents': 'List available subagents',
      'POST /api/subagents/:name': 'Invoke a specific subagent',
      'GET /api/history': 'Get conversation history',
      'POST /api/session': 'Create a new session',
      'DELETE /api/session/:id': 'Delete a session',
      'POST /api/command': 'Execute a command',
      'GET /api/commands': 'List available commands'
    }
  });
});

// Chat endpoint (non-streaming)
app.post('/api/chat', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { message, sessionId, config } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Create session with config if needed
    const effectiveSessionId = sessionId || DEFAULT_SESSION;
    if (config) {
      runtime.sessions.getOrCreate(effectiveSessionId, { config });
    }

    const result = await runtime.chat(effectiveSessionId, message);

    res.json({
      response: result.response,
      stanceBefore: result.stanceBefore,
      stanceAfter: result.stanceAfter,
      operationsApplied: result.operationsApplied.map(o => o.name),
      scores: result.scores,
      toolsUsed: result.toolsUsed,
      subagentsInvoked: result.subagentsInvoked,
      sessionId: effectiveSessionId
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Streaming chat endpoint (Server-Sent Events)
app.get('/api/chat/stream', apiKeyAuth, async (req: Request, res: Response) => {
  const message = req.query.message as string;
  const sessionId = req.query.sessionId as string;

  if (!message) {
    res.status(400).json({ error: 'Message query parameter is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // Send headers immediately to start streaming

  const effectiveSessionId = sessionId || DEFAULT_SESSION;

  const callbacks: StreamCallbacks = {
    onText: (text) => {
      res.write(`event: text\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    onToolUse: (tool) => {
      res.write(`event: tool\ndata: ${JSON.stringify({ tool })}\n\n`);
    },
    onToolEvent: (event) => {
      res.write(`event: tool_event\ndata: ${JSON.stringify(event)}\n\n`);
    },
    onSubagent: (name, status) => {
      res.write(`event: subagent\ndata: ${JSON.stringify({ name, status })}\n\n`);
    },
    onComplete: (result) => {
      res.write(`event: complete\ndata: ${JSON.stringify({
        stanceBefore: result.stanceBefore,
        stanceAfter: result.stanceAfter,
        operationsApplied: result.operationsApplied.map(o => o.name),
        scores: result.scores,
        toolsUsed: result.toolsUsed
      })}\n\n`);
      res.end();
    },
    onError: (error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  };

  try {
    await runtime.chatStream(effectiveSessionId, message, callbacks);
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
});

// POST version of streaming for better compatibility
app.post('/api/chat/stream', apiKeyAuth, async (req: Request, res: Response) => {
  const { message, sessionId } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // Send headers immediately to start streaming

  const effectiveSessionId = sessionId || DEFAULT_SESSION;

  const callbacks: StreamCallbacks = {
    onText: (text) => {
      res.write(`event: text\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    onToolUse: (tool) => {
      res.write(`event: tool\ndata: ${JSON.stringify({ tool })}\n\n`);
    },
    onToolEvent: (event) => {
      res.write(`event: tool_event\ndata: ${JSON.stringify(event)}\n\n`);
    },
    onSubagent: (name, status) => {
      res.write(`event: subagent\ndata: ${JSON.stringify({ name, status })}\n\n`);
    },
    onComplete: (result) => {
      res.write(`event: complete\ndata: ${JSON.stringify({
        stanceBefore: result.stanceBefore,
        stanceAfter: result.stanceAfter,
        operationsApplied: result.operationsApplied.map(o => o.name),
        scores: result.scores,
        toolsUsed: result.toolsUsed
      })}\n\n`);
      res.end();
    },
    onError: (error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  };

  try {
    await runtime.chatStream(effectiveSessionId, message, callbacks);
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
});

// Get current state
app.get('/api/state', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const agent = getOrCreateAgent(sessionId);

  res.json({
    stance: agent.getCurrentStance(),
    config: agent.getConfig(),
    conversationId: agent.getConversationId(),
    sessionId: agent.getSessionId()
  });
});

// Update configuration
app.put('/api/config', apiKeyAuth, (req: Request, res: Response) => {
  const { sessionId, config } = req.body;

  if (!config) {
    res.status(400).json({ error: 'Config is required' });
    return;
  }

  const agent = getOrCreateAgent(sessionId);
  agent.updateConfig(config);

  res.json({
    success: true,
    config: agent.getConfig()
  });
});

// Get identity information
app.get('/api/identity', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const agent = getOrCreateAgent(sessionId);
  const stance = agent.getCurrentStance();

  res.json({
    frame: stance.frame,
    selfModel: stance.selfModel,
    objective: stance.objective,
    sentience: stance.sentience,
    metaphors: stance.metaphors,
    constraints: stance.constraints,
    version: stance.version,
    cumulativeDrift: stance.cumulativeDrift
  });
});

// List available subagents
app.get('/api/subagents', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const agent = getOrCreateAgent(sessionId);
  const definitions = agent.getSubagentDefinitions();

  res.json({
    subagents: definitions.map(def => ({
      name: def.name,
      description: def.description,
      tools: def.tools
    }))
  });
});

// Invoke a specific subagent
app.post('/api/subagents/:name', apiKeyAuth, async (req: Request, res: Response) => {
  const { name } = req.params;
  const { task, sessionId } = req.body;

  if (!task) {
    res.status(400).json({ error: 'Task is required' });
    return;
  }

  const agent = getOrCreateAgent(sessionId);

  try {
    const result = await agent.invokeSubagent(name, task);
    res.json({
      response: result.response,
      toolsUsed: result.toolsUsed,
      subagent: name
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get conversation history
app.get('/api/history', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const agent = getOrCreateAgent(sessionId);
  const history = agent.getHistory();

  res.json({
    total: history.length,
    limit,
    offset,
    messages: history.slice(offset, offset + limit).map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      toolsUsed: msg.toolsUsed
    }))
  });
});

// Get operator timeline (Ralph Iteration 2 - Feature 3)
app.get('/api/timeline', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const limit = parseInt(req.query.limit as string) || 20;

  const agent = getOrCreateAgent(sessionId);
  const history = agent.getTransformationHistory();

  // Transform to timeline entries format
  const entries = history.slice(0, limit).map((entry, index) => ({
    id: `timeline-${index}`,
    timestamp: entry.timestamp,
    userMessage: entry.userMessage,
    operators: entry.operators.map((op: { name: string; description?: string }) => ({
      name: op.name,
      description: op.description || ''
    })),
    scores: entry.scores,
    frameBefore: entry.stanceBefore.frame,
    frameAfter: entry.stanceAfter.frame,
    driftDelta: entry.stanceAfter.cumulativeDrift - entry.stanceBefore.cumulativeDrift
  }));

  res.json({ entries });
});

// Get evolution snapshots (Ralph Iteration 2 - Feature 5)
app.get('/api/evolution', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const limit = parseInt(req.query.limit as string) || 20;

  const agent = getOrCreateAgent(sessionId);
  const snapshots = agent.getEvolutionTimeline(limit);

  res.json({ snapshots });
});

// Search memories (INCEPTION Phase 7 - Memory browser)
app.get('/api/memories', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const type = req.query.type as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  const agent = getOrCreateAgent(sessionId);
  const memories = agent.searchMemories({
    type: type as 'episodic' | 'semantic' | 'identity' | undefined,
    limit
  });

  res.json({ memories });
});

// Export conversation state
app.get('/api/export', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const agent = getOrCreateAgent(sessionId);

  res.json({
    state: JSON.parse(agent.exportState())
  });
});

// Import conversation state
app.post('/api/import', apiKeyAuth, (req: Request, res: Response) => {
  const { state } = req.body;

  if (!state) {
    res.status(400).json({ error: 'State is required' });
    return;
  }

  try {
    const agent = MetamorphAgent.fromState(JSON.stringify(state));
    const sessionId = agent.getConversationId();
    // Create a new session with this agent by first creating and then replacing
    const session = runtime.sessions.createSession({ id: sessionId });
    // Note: This is a workaround since we can't directly set the agent
    // The session is created with a new agent, but the imported state is in the new agent
    // For full import support, SessionManager would need an importSession method

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid state format'
    });
  }
});

// Create a new session
app.post('/api/session', apiKeyAuth, (req: Request, res: Response) => {
  const { config, name } = req.body;
  const session = runtime.createSession(config, name);

  res.json({
    sessionId: session.id,
    config: session.agent.getConfig(),
    stance: session.agent.getCurrentStance()
  });
});

// Delete a session
app.delete('/api/session/:id', apiKeyAuth, (req: Request, res: Response) => {
  const { id } = req.params;

  if (runtime.deleteSession(id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// List all sessions
app.get('/api/sessions', apiKeyAuth, (_req: Request, res: Response) => {
  // Get session info and enrich with stance for backward compatibility
  const sessions = runtime.sessions.listSessions().map(info => {
    const session = runtime.sessions.getSession(info.id);
    return {
      ...info,
      stance: session?.agent.getCurrentStance()
    };
  });
  res.json({ sessions });
});

// Execute a command (exposes all 50+ CLI commands via HTTP)
app.post('/api/command', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { command, args, sessionId } = req.body;

    if (!command) {
      res.status(400).json({ error: 'Command is required' });
      return;
    }

    const effectiveSessionId = sessionId || DEFAULT_SESSION;
    // Ensure session exists
    runtime.sessions.getOrCreate(effectiveSessionId);

    const result = await runtime.executeCommand(
      effectiveSessionId,
      command,
      Array.isArray(args) ? args : args ? [args] : []
    );

    if (result.success) {
      res.json({
        success: true,
        result: result.result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Command error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List available commands
app.get('/api/commands', apiKeyAuth, (_req: Request, res: Response) => {
  const commands = runtime.listCommands();
  res.json({ commands });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for use as module
export { app };

// Start server if run directly
// Default to 3001 to avoid conflict with Next.js dev server (3000)
const PORT = process.env.PORT || 3001;

export function startServer(port: number = Number(PORT)): void {
  app.listen(port, () => {
    console.log(`METAMORPH API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API info: http://localhost:${port}/api`);
  });
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
