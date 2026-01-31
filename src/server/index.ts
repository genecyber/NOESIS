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
import { createServer } from 'http';
import { MetamorphAgent, StreamCallbacks } from '../agent/index.js';
import { registerSteeringProvider } from '../agent/hooks.js';
import { ModeConfig } from '../types/index.js';
import { MetamorphRuntime } from '../runtime/index.js';
import { FaceApiDetector } from '../plugins/emotion-detection/face-api-detector.js';
import { EmotionProcessor } from '../plugins/emotion-detection/emotion-processor.js';
import { pluginEventBus } from '../plugins/event-bus.js';
import { createWebSocketServer } from './websocket.js';
import { streamManager } from '../plugins/streams/stream-manager.js';
import { EmbeddingService } from '../embeddings/service.js';
import { IdleStreamBridge } from './idle-bridge.js';
import { IdleSessionExecutor, createAutonomyConfig, type AutonomyLevel } from '../idle/index.js';
import { requireAuth, getVaultIdFromRequest } from './middleware/emblem-auth.js';
import { vaultContextMiddleware } from '../multitenancy/index.js';
import vercelAuthRoutes from './routes/vercel-auth.js';
import sandboxRoutes from './routes/sandboxes.js';

const app = express();

// Create HTTP server for WebSocket support
const server = createServer(app);

// CORS configuration for Emblem origins
const EMBLEM_DEV_MODE = process.env.EMBLEM_DEV_MODE === 'true';
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.EMBLEM_ORIGIN,
  process.env.EMBLEM_PRODUCTION_ORIGIN,
  // Add production origins as needed
].filter(Boolean) as string[];

app.use(cors({
  origin: EMBLEM_DEV_MODE
    ? true  // Allow all origins in dev mode
    : (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Vault-Id']
}));

// Increase JSON body limit for base64 images (webcam frames can be 1-2MB)
app.use(express.json({ limit: '10mb' }));

// Unified runtime instance (replaces per-session agent Map)
const runtime = new MetamorphRuntime();

// Emotion detection components (singleton instances for efficiency)
const faceDetector = new FaceApiDetector();
const emotionProcessor = new EmotionProcessor();
let emotionDetectorInitialized = false;

// Embedding service (singleton instance)
// Use OpenAI in production if API key is set, otherwise use local
const embeddingProvider = process.env.OPENAI_API_KEY ? 'openai' : 'local';
const embeddingService = new EmbeddingService({
  provider: embeddingProvider,
  localModel: 'Xenova/all-MiniLM-L6-v2',
  openaiApiKey: process.env.OPENAI_API_KEY
});
let embeddingServiceInitialized = false;
console.log(`[Server] Using ${embeddingProvider} embedding provider`);

// Idle stream bridge (singleton instance)
let idleStreamBridge: IdleStreamBridge | null = null;

// Steering message queue - per-session storage
interface SteeringMessage {
  id: string;
  content: string;
  timestamp: number;
  processed?: boolean;
}

const steeringMessageQueues = new Map<string, SteeringMessage[]>();

// Idle session executors - per-session storage for prompt editing
const idleSessionExecutors = new Map<string, IdleSessionExecutor>();

/**
 * Get effective session ID with vault prefix, avoiding double-prefixing.
 * If sessionId already contains a colon (vault prefix), use as-is.
 * Otherwise, prefix with vaultId.
 */
function getEffectiveSessionId(sessionId: string, vaultId: string): string {
  // If sessionId already contains a colon, it's already vault-prefixed
  if (sessionId.includes(':')) {
    // Verify it starts with a valid vault prefix (simple check)
    return sessionId;
  }
  return `${vaultId}:${sessionId}`;
}

/**
 * Get or create an idle session executor for a session
 */
function getOrCreateExecutor(sessionId: string, mode: 'exploration' | 'research' | 'creation' | 'optimization', autonomyLevel: AutonomyLevel = 'standard'): IdleSessionExecutor {
  let executor = idleSessionExecutors.get(sessionId);

  if (!executor) {
    const autonomyConfig = createAutonomyConfig(autonomyLevel);

    executor = new IdleSessionExecutor({
      sessionId,
      mode,
      autonomy: autonomyConfig,
      safetyConstraints: {
        coherenceFloor: 30,
        maxDriftPerSession: 15,
        allowedOperators: ['introspect', 'reflect', 'analyze', 'synthesize', 'query'],
        forbiddenTopics: ['harmful content', 'deception', 'manipulation'],
        escalationTriggers: [],
        humanApprovalRequired: autonomyLevel === 'restricted'
      },
      heartbeatInterval: 30000, // 30 seconds
      promptApprovalRequired: true, // User can edit prompts
      maxTurnsPerSession: 20
    });

    // Set up event handlers
    executor.on('prompt_ready', (data) => {
      console.log(`[IdleExecutor] Prompt ready for ${sessionId}:`, data.chunks?.length, 'chunks');
      // Emit to stream for UI update
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'prompt_ready',
          sessionId,
          chunks: data.chunks,
          timestamp: new Date().toISOString()
        });
      }
    });

    executor.on('status_change', (data) => {
      console.log(`[IdleExecutor] Status change for ${sessionId}:`, data.status);
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'status_change',
          sessionId,
          status: data.status,
          timestamp: new Date().toISOString()
        });
      }
    });

    executor.on('turn_completed', (data) => {
      console.log(`[IdleExecutor] Turn ${data.turn} completed for ${sessionId}`);
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'turn_completed',
          sessionId,
          turn: data.turn,
          response: data.response,
          timestamp: new Date().toISOString()
        });
      }
    });

    executor.on('discovery', (data) => {
      console.log(`[IdleExecutor] Discovery for ${sessionId}:`, data.discovery?.title);
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'discovery',
          sessionId,
          discovery: data.discovery,
          timestamp: new Date().toISOString()
        });
      }
    });

    executor.on('heartbeat', (_data) => {
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'heartbeat',
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    });

    executor.on('session_complete', (data) => {
      console.log(`[IdleExecutor] Session complete for ${sessionId}:`, data.discoveries?.length, 'discoveries');
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'session_complete',
          sessionId,
          discoveries: data.discoveries,
          activities: data.activities,
          turns: data.turns,
          timestamp: new Date().toISOString()
        });
      }
      // Cleanup
      idleSessionExecutors.delete(sessionId);
    });

    executor.on('error', (data) => {
      console.error(`[IdleExecutor] Error for ${sessionId}:`, data.error);
      if (idleStreamBridge) {
        streamManager.publishEvent(`autonomous-sessions:${sessionId}`, {
          type: 'error',
          sessionId,
          error: data.error instanceof Error ? data.error.message : String(data.error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // CRITICAL: Initialize the executor with runtime so it can actually execute
    // Memory store is not easily accessible from runtime, so we pass null
    // The executor will use mock memories as a fallback for goal extraction
    console.log(`[IdleExecutor] Initializing executor for ${sessionId} with runtime`);
    executor.initialize(runtime, null);

    idleSessionExecutors.set(sessionId, executor);
  }

  return executor;
}

/**
 * Get or create steering message queue for a session
 */
function getSteeringQueue(sessionId: string): SteeringMessage[] {
  let queue = steeringMessageQueues.get(sessionId);
  if (!queue) {
    queue = [];
    steeringMessageQueues.set(sessionId, queue);
  }
  return queue;
}

/**
 * Add a steering message to the queue
 */
function addSteeringMessage(sessionId: string, content: string): SteeringMessage {
  const queue = getSteeringQueue(sessionId);
  const message: SteeringMessage = {
    id: `steer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    timestamp: Date.now(),
    processed: false
  };
  queue.push(message);
  console.log(`[Steering] Added message for session ${sessionId}: "${content.substring(0, 50)}..."`);
  return message;
}

/**
 * Get and clear pending steering messages for a session
 */
function consumeSteeringMessages(sessionId: string): SteeringMessage[] {
  const queue = getSteeringQueue(sessionId);
  const pending = queue.filter(m => !m.processed);
  // Mark as processed
  pending.forEach(m => m.processed = true);
  return pending;
}

/**
 * Export consumeSteeringMessages for use in hooks
 */
export { consumeSteeringMessages };

// Initialize embedding service lazily on first use
async function initializeEmbeddingService(): Promise<boolean> {
  if (embeddingServiceInitialized) {
    return true;
  }

  try {
    console.log('[Server] Initializing embedding service...');
    console.log('[Server] Provider:', embeddingProvider);
    console.log('[Server] Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB used');

    await embeddingService.initialize();
    embeddingServiceInitialized = true;

    console.log('[Server] Embedding service initialized successfully');
    console.log('[Server] Provider name:', embeddingService.getProviderName());
    console.log('[Server] Dimensions:', embeddingService.getDimensions());
    return true;
  } catch (error) {
    console.error('[Server] Failed to initialize embedding service:', error);
    console.error('[Server] Error details:', error instanceof Error ? error.stack : String(error));
    return false;
  }
}

// Initialize emotion detector lazily on first use
async function initializeEmotionDetector(): Promise<boolean> {
  if (emotionDetectorInitialized) {
    return true;
  }

  try {
    await faceDetector.initialize();
    emotionDetectorInitialized = true;
    console.log('[Server] Emotion detector initialized successfully');
    return true;
  } catch (error) {
    console.error('[Server] Failed to initialize emotion detector:', error);
    return false;
  }
}

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

// Health check - unauthenticated
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Health check API endpoint - unauthenticated
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply authentication and vault context to all /api routes except health
// Note: This runs AFTER /api/health route is defined (unauthenticated)
app.use('/api', requireAuth(), vaultContextMiddleware());

// Mount Vercel OAuth and Sandbox routes
app.use('/api/vercel/auth', vercelAuthRoutes);
app.use('/api/sandboxes', sandboxRoutes);

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
      'GET /api/commands': 'List available commands',
      'POST /api/sync': 'Sync data from browser to server (messages, memories, emotions)',
      'GET /api/sync/emotions': 'Get aggregated emotion context for a session',
      'POST /api/emotion/detect': 'Detect emotions from webcam frame (base64 image)',
      'GET /api/emotion/status': 'Get emotion detector status',
      'POST /api/emotion/reset': 'Clear emotion history',
      'POST /api/chat/vision': 'Send message with webcam frame to Claude for vision-based analysis',
      // Vercel OAuth endpoints
      'GET /api/vercel/auth/url': 'Get Vercel OAuth authorization URL',
      'GET /api/vercel/auth/callback': 'OAuth callback handler',
      'DELETE /api/vercel/auth/disconnect': 'Revoke Vercel connection',
      'GET /api/vercel/auth/status': 'Check Vercel connection status',
      // Sandbox endpoints
      'POST /api/sandboxes': 'Create new sandbox',
      'GET /api/sandboxes': 'List user sandboxes',
      'GET /api/sandboxes/:id': 'Get sandbox details',
      'DELETE /api/sandboxes/:id': 'Delete sandbox',
      'POST /api/sandboxes/:id/start': 'Start sandbox',
      'POST /api/sandboxes/:id/stop': 'Stop sandbox',
      'POST /api/sandboxes/:id/execute': 'Run command in sandbox',
      'POST /api/sandboxes/:id/files': 'Write files to sandbox',
      'POST /api/sandboxes/:id/agent/attach': 'Attach Metamorph agent to sandbox',
      'POST /api/sandboxes/:id/agent/chat': 'Chat with sandboxed agent',
      'GET /api/sandboxes/usage': 'Get resource usage'
    }
  });
});

// Chat endpoint (non-streaming)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, config } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Create vault-scoped session with config if needed
    const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
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
      error: 'An error occurred processing your request'
    });
  }
});

// Streaming chat endpoint (Server-Sent Events)
app.get('/api/chat/stream', async (req: Request, res: Response) => {
  const message = req.query.message as string;
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');

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

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;

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
    onQuestion: (question) => {
      res.write(`event: question\ndata: ${JSON.stringify(question)}\n\n`);
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
        toolsUsed: result.toolsUsed,
        injectedMemories: result.injectedMemories
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
app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { message, sessionId, emotionContext } = req.body;
  const vaultId = getVaultIdFromRequest(req, 'default');

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

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;

  const callbacks: StreamCallbacks = {
    onText: (text) => {
      res.write(`event: text\ndata: ${JSON.stringify({ text })}\n\n`);
    },
    onToolUse: (tool) => {
      res.write(`event: tool\ndata: ${JSON.stringify({ tool })}\n\n`);
    },
    onToolEvent: (event) => {
      res.write(`event: tool_event\ndata: ${JSON.stringify(event)}\n\n`);

      // Check for steering messages during tool events and send them
      const steeringMessages = consumeSteeringMessages(effectiveSessionId);
      if (steeringMessages.length > 0) {
        res.write(`event: steering_applied\ndata: ${JSON.stringify({
          count: steeringMessages.length,
          messages: steeringMessages
        })}\n\n`);
      }
    },
    onQuestion: (question) => {
      res.write(`event: question\ndata: ${JSON.stringify(question)}\n\n`);
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
        toolsUsed: result.toolsUsed,
        injectedMemories: result.injectedMemories
      })}\n\n`);
      res.end();
    },
    onError: (error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  };

  try {
    // Pass emotion context to runtime for hooks to access
    await runtime.chatStream(effectiveSessionId, message, callbacks, { emotionContext });
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
});

// Get current state
app.get('/api/state', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);

  res.json({
    stance: agent.getCurrentStance(),
    config: agent.getConfig(),
    conversationId: agent.getConversationId(),
    sessionId: agent.getSessionId()
  });
});

// Update configuration
app.put('/api/config', (req: Request, res: Response) => {
  const { sessionId, config } = req.body;
  const vaultId = getVaultIdFromRequest(req, 'default');

  if (!config) {
    res.status(400).json({ error: 'Config is required' });
    return;
  }

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
  agent.updateConfig(config);

  res.json({
    success: true,
    config: agent.getConfig()
  });
});

// Get identity information
app.get('/api/identity', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
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
app.get('/api/subagents', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
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
app.post('/api/subagents/:name', async (req: Request, res: Response) => {
  const { name } = req.params;
  const { task, sessionId } = req.body;
  const vaultId = getVaultIdFromRequest(req, 'default');

  if (!task) {
    res.status(400).json({ error: 'Task is required' });
    return;
  }

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);

  try {
    const result = await agent.invokeSubagent(name, task);
    res.json({
      response: result.response,
      toolsUsed: result.toolsUsed,
      subagent: name
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to invoke subagent'
    });
  }
});

// Get conversation history
app.get('/api/history', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
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
app.get('/api/timeline', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const limit = parseInt(req.query.limit as string) || 20;

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
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
app.get('/api/evolution', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const limit = parseInt(req.query.limit as string) || 20;

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
  const snapshots = agent.getEvolutionTimeline(limit);

  res.json({ snapshots });
});

// Search memories (INCEPTION Phase 7 - Memory browser)
app.get('/api/memories', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const type = req.query.type as string | undefined;
  const limit = parseInt(req.query.limit as string) || 500;

  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);
  const memories = agent.searchMemories({
    type: type as 'episodic' | 'semantic' | 'identity' | undefined,
    limit
  });

  res.json({ memories });
});

// Export conversation state
app.get('/api/export', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
  const agent = getOrCreateAgent(effectiveSessionId);

  res.json({
    state: JSON.parse(agent.exportState())
  });
});

// Import conversation state
app.post('/api/import', (req: Request, res: Response) => {
  const { state } = req.body;
  const vaultId = getVaultIdFromRequest(req, 'default');

  if (!state) {
    res.status(400).json({ error: 'State is required' });
    return;
  }

  try {
    const agent = MetamorphAgent.fromState(JSON.stringify(state));
    const agentSessionId = agent.getConversationId();
    // Create vault-scoped session ID
    const sessionId = `${vaultId}:${agentSessionId}`;
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
      error: 'Failed to import state'
    });
  }
});

// Create a new session
app.post('/api/session', (req: Request, res: Response) => {
  const { config, name, sessionId } = req.body;
  const vaultId = getVaultIdFromRequest(req, 'default');
  // Create vault-scoped session with proper vaultId propagation
  const session = runtime.createSession(config, name, sessionId, vaultId);

  res.json({
    sessionId: session.id,
    config: session.agent.getConfig(),
    stance: session.agent.getCurrentStance()
  });
});

// Delete a session
app.delete('/api/session/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const vaultId = getVaultIdFromRequest(req, 'default');
  // Delete session using vault-scoped method for proper isolation
  if (runtime.deleteSession(id, vaultId)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// List all sessions (includes persisted sessions from SQLite)
// Note: This returns vault-scoped sessions - filter by vaultId prefix
app.get('/api/sessions', async (req: Request, res: Response) => {
  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    // Get sessions for this vault from persistence (already vault-scoped)
    const sessions = await runtime.sessions.listSessionsAsync(vaultId);
    res.json({ sessions });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Execute a command (exposes all 50+ CLI commands via HTTP)
app.post('/api/command', async (req: Request, res: Response) => {
  try {
    const { command, args, sessionId } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');

    if (!command) {
      res.status(400).json({ error: 'Command is required' });
      return;
    }

    const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
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
      error: 'Command execution failed'
    });
  }
});

// List available commands
app.get('/api/commands', (_req: Request, res: Response) => {
  const commands = runtime.listCommands();
  res.json({ commands });
});

// Emotion sync state - per-session storage for aggregated emotion readings
const sessionEmotionData = new Map<string, {
  readings: Array<{
    currentEmotion: string;
    valence: number;
    arousal: number;
    confidence: number;
    timestamp: number;
  }>;
  lastAggregate: {
    avgValence: number;
    avgArousal: number;
    avgConfidence: number;
    dominantEmotion: string;
    stability: number;
    trend: 'improving' | 'stable' | 'declining';
    suggestedEmpathyBoost: number;
    promptContext: string;
  } | null;
  lastSyncTime: number;
}>();

/**
 * Get or create emotion data for a session
 */
function getSessionEmotionData(sessionId: string) {
  let data = sessionEmotionData.get(sessionId);
  if (!data) {
    data = {
      readings: [],
      lastAggregate: null,
      lastSyncTime: Date.now()
    };
    sessionEmotionData.set(sessionId, data);
  }
  return data;
}

/**
 * Calculate emotion aggregate from readings
 */
function calculateEmotionAggregate(readings: Array<{
  currentEmotion: string;
  valence: number;
  arousal: number;
  confidence: number;
  timestamp: number;
}>) {
  if (readings.length === 0) return null;

  // Calculate averages
  const avgValence = readings.reduce((sum, r) => sum + r.valence, 0) / readings.length;
  const avgArousal = readings.reduce((sum, r) => sum + r.arousal, 0) / readings.length;
  const avgConfidence = readings.reduce((sum, r) => sum + r.confidence, 0) / readings.length;

  // Find dominant emotion (most frequent)
  const emotionCounts: Record<string, number> = {};
  for (const r of readings) {
    emotionCounts[r.currentEmotion] = (emotionCounts[r.currentEmotion] || 0) + 1;
  }
  let dominantEmotion = 'neutral';
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }

  // Calculate stability (inverse of variance in valence)
  let stability = 1;
  if (readings.length >= 2) {
    const variance = readings.reduce((sum, r) => sum + Math.pow(r.valence - avgValence, 2), 0) / readings.length;
    stability = Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
  }

  // Calculate trend (compare first half to second half)
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (readings.length >= 4) {
    const midpoint = Math.floor(readings.length / 2);
    const firstHalfAvg = readings.slice(0, midpoint).reduce((sum, r) => sum + r.valence, 0) / midpoint;
    const secondHalfAvg = readings.slice(midpoint).reduce((sum, r) => sum + r.valence, 0) / (readings.length - midpoint);
    const delta = secondHalfAvg - firstHalfAvg;
    if (delta > 0.15) trend = 'improving';
    else if (delta < -0.15) trend = 'declining';
  }

  // Calculate suggested empathy boost
  let suggestedEmpathyBoost = 0;
  if (avgValence < 0) {
    const valenceBoost = Math.abs(avgValence) * 15;
    const instabilityMultiplier = 1 + (1 - stability) * 0.5;
    suggestedEmpathyBoost = Math.round(Math.min(20, valenceBoost * instabilityMultiplier));
  }

  // Generate prompt context
  const valenceDesc = avgValence > 0.3 ? 'positive' : avgValence < -0.3 ? 'negative' : 'neutral';
  const arousalDesc = avgArousal > 0.7 ? 'highly activated' : avgArousal < 0.3 ? 'calm' : 'moderately engaged';
  let promptContext = `The user appears ${dominantEmotion} with a ${valenceDesc} emotional state. They seem ${arousalDesc}.`;
  if (stability < 0.4) promptContext += ' Their emotional state has been fluctuating.';
  if (trend === 'declining') promptContext += ' Their mood appears to be declining - consider responding with extra care.';
  if (trend === 'improving') promptContext += ' Their mood appears to be improving.';

  return {
    avgValence,
    avgArousal,
    avgConfidence,
    dominantEmotion,
    stability,
    trend,
    suggestedEmpathyBoost,
    promptContext
  };
}

// Sync endpoint for PWA background sync (browser -> server)
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    const { type, sessionId, data } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');

    if (!type || !sessionId) {
      res.status(400).json({ error: 'type and sessionId are required' });
      return;
    }

    const effectiveSessionId = `${vaultId}:${sessionId}`;
    const agent = getOrCreateAgent(effectiveSessionId);

    switch (type) {
      case 'messages': {
        // Messages are stored in conversation history - they're already there from chat
        // This is more for syncing messages that were composed offline
        const messages = data as Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
        // For now, just acknowledge - messages should be sent via /api/chat
        res.json({
          success: true,
          synced: messages?.length || 0,
          type: 'messages'
        });
        break;
      }

      case 'memories': {
        // Sync memories from browser to server
        const memories = data as Array<{
          id: string;
          type: 'episodic' | 'semantic' | 'identity';
          content: string;
          importance: number;
          timestamp: number;
          metadata?: Record<string, unknown>;
        }>;

        if (!Array.isArray(memories)) {
          res.status(400).json({ error: 'memories must be an array' });
          return;
        }

        let synced = 0;
        for (const memory of memories) {
          try {
            // Get existing memories to check for duplicates
            const existingMemories = agent.searchMemories({ type: memory.type, limit: 1000 });

            // Check if already exists (by content to be safe, since IDs may differ)
            const alreadyExists = existingMemories.some(
              m => m.content === memory.content && m.type === memory.type
            );

            if (!alreadyExists) {
              // Add memory to the agent's memory store
              agent.storeMemory(
                memory.content,
                memory.type,
                memory.importance
              );
              synced++;
            }
          } catch (e) {
            console.error(`Failed to sync memory ${memory.id}:`, e);
          }
        }

        res.json({
          success: true,
          synced,
          total: memories.length,
          type: 'memories'
        });
        break;
      }

      case 'emotions': {
        // Sync emotion readings from browser to server
        const emotionReadings = data as Array<{
          currentEmotion: string;
          valence: number;
          arousal: number;
          confidence: number;
          timestamp: number;
        }>;

        if (!Array.isArray(emotionReadings)) {
          res.status(400).json({ error: 'emotionReadings must be an array' });
          return;
        }

        const emotionData = getSessionEmotionData(sessionId);

        // Add new readings (keep last 100 readings max)
        emotionData.readings.push(...emotionReadings);
        if (emotionData.readings.length > 100) {
          emotionData.readings = emotionData.readings.slice(-100);
        }

        // Calculate aggregate
        const aggregate = calculateEmotionAggregate(emotionData.readings);
        emotionData.lastAggregate = aggregate;
        emotionData.lastSyncTime = Date.now();

        console.log(`[Sync] Emotion data synced for session ${sessionId}: ${emotionReadings.length} readings, dominant: ${aggregate?.dominantEmotion || 'none'}`);

        // Return current aggregate with empathy suggestions
        res.json({
          success: true,
          synced: emotionReadings.length,
          type: 'emotions',
          emotionContext: aggregate ? {
            avgValence: aggregate.avgValence,
            avgArousal: aggregate.avgArousal,
            avgConfidence: aggregate.avgConfidence,
            dominantEmotion: aggregate.dominantEmotion,
            stability: aggregate.stability,
            trend: aggregate.trend,
            suggestedEmpathyBoost: aggregate.suggestedEmpathyBoost,
            promptContext: aggregate.promptContext,
            readingCount: emotionData.readings.length,
            lastSyncTime: emotionData.lastSyncTime
          } : null
        });
        break;
      }

      case 'preferences': {
        // Preferences stay local for now
        res.json({
          success: true,
          type: 'preferences',
          note: 'Preferences stored locally only'
        });
        break;
      }

      case 'full': {
        // Full sync - receive all browser data
        const { messages, memories, emotionReadings } = data as {
          messages?: Array<{ role: string; content: string; timestamp: number }>;
          memories?: Array<{
            id: string;
            type: 'episodic' | 'semantic' | 'identity';
            content: string;
            importance: number;
            timestamp: number;
          }>;
          emotionReadings?: Array<{
            currentEmotion: string;
            valence: number;
            arousal: number;
            confidence: number;
            timestamp: number;
          }>;
        };

        let memoriesSynced = 0;
        if (memories && Array.isArray(memories)) {
          for (const memory of memories) {
            try {
              agent.storeMemory(
                memory.content,
                memory.type,
                memory.importance
              );
              memoriesSynced++;
            } catch (e) {
              console.error(`Failed to sync memory:`, e);
            }
          }
        }

        // Sync emotion readings if provided
        let emotionsSynced = 0;
        let emotionContext = null;
        if (emotionReadings && Array.isArray(emotionReadings)) {
          const emotionData = getSessionEmotionData(sessionId);
          emotionData.readings.push(...emotionReadings);
          if (emotionData.readings.length > 100) {
            emotionData.readings = emotionData.readings.slice(-100);
          }
          const aggregate = calculateEmotionAggregate(emotionData.readings);
          emotionData.lastAggregate = aggregate;
          emotionData.lastSyncTime = Date.now();
          emotionsSynced = emotionReadings.length;
          emotionContext = aggregate;
        }

        res.json({
          success: true,
          type: 'full',
          synced: {
            messages: messages?.length || 0,
            memories: memoriesSynced,
            emotions: emotionsSynced
          },
          emotionContext
        });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown sync type: ${type}` });
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Sync failed'
    });
  }
});

// Get emotion context for a session
app.get('/api/sync/emotions', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const vaultId = getVaultIdFromRequest(req, 'default');

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const effectiveSessionId = `${vaultId}:${sessionId}`;
  const emotionData = sessionEmotionData.get(effectiveSessionId);

  if (!emotionData || !emotionData.lastAggregate) {
    res.json({
      success: true,
      emotionContext: null,
      message: 'No emotion data available for this session'
    });
    return;
  }

  res.json({
    success: true,
    emotionContext: {
      avgValence: emotionData.lastAggregate.avgValence,
      avgArousal: emotionData.lastAggregate.avgArousal,
      avgConfidence: emotionData.lastAggregate.avgConfidence,
      dominantEmotion: emotionData.lastAggregate.dominantEmotion,
      stability: emotionData.lastAggregate.stability,
      trend: emotionData.lastAggregate.trend,
      suggestedEmpathyBoost: emotionData.lastAggregate.suggestedEmpathyBoost,
      promptContext: emotionData.lastAggregate.promptContext,
      readingCount: emotionData.readings.length,
      lastSyncTime: emotionData.lastSyncTime
    }
  });
});

// Emotion detection endpoint - processes webcam frames and returns emotion context
app.post('/api/emotion/detect', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image) {
      res.status(400).json({ error: 'Image is required (base64 data URL or raw base64)' });
      return;
    }

    // Initialize detector on first use (lazy loading for faster startup)
    const initialized = await initializeEmotionDetector();
    if (!initialized) {
      res.status(503).json({
        error: 'Emotion detector not available',
        details: 'face-api.js models may not be installed. Run: npm run setup:face-api'
      });
      return;
    }

    console.log('[Server] Processing emotion detection request...');

    // Detect faces and expressions
    const faces = await faceDetector.detectEmotions(image);

    if (faces.length === 0) {
      res.json({
        detected: false,
        emotionContext: null,
        message: 'No face detected in frame'
      });
      return;
    }

    // Process detection into emotion context
    const emotionContext = emotionProcessor.processDetection(faces);

    if (!emotionContext) {
      res.json({
        detected: false,
        emotionContext: null,
        message: 'Face detected but confidence too low'
      });
      return;
    }

    console.log('[Server] Emotion detected:', emotionContext.currentEmotion,
      'confidence:', Math.round(emotionContext.confidence * 100) + '%');

    res.json({
      detected: true,
      emotionContext: {
        currentEmotion: emotionContext.currentEmotion,
        valence: emotionContext.valence,
        arousal: emotionContext.arousal,
        confidence: emotionContext.confidence,
        stability: emotionContext.stability,
        suggestedEmpathyBoost: emotionContext.suggestedEmpathyBoost,
        promptContext: emotionContext.promptContext,
        timestamp: emotionContext.timestamp.toISOString()
      },
      facesDetected: faces.length
    });
  } catch (error) {
    console.error('[Server] Emotion detection error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Emotion detection failed'
    });
  }
});

// Get emotion detection status
app.get('/api/emotion/status', (_req: Request, res: Response) => {
  res.json({
    initialized: emotionDetectorInitialized,
    detectorReady: faceDetector.isInitialized(),
    historyLength: emotionProcessor.getHistoryLength()
  });
});

// Clear emotion history (for testing/reset)
app.post('/api/emotion/reset', (_req: Request, res: Response) => {
  emotionProcessor.clearHistory();
  res.json({ success: true, message: 'Emotion history cleared' });
});

// Vision analysis state - prevent concurrent requests
let visionRequestInProgress = false;
let lastVisionRequestTime = 0;
const VISION_COOLDOWN_MS = 60000; // 60 second minimum between vision requests (once per minute)

/**
 * Vision emotion analysis endpoint
 *
 * This endpoint ONLY analyzes the image for emotions and stores the result.
 * It does NOT process a chat message. Use the regular /api/chat endpoint after this
 * to send messages - the stored emotion context will automatically influence responses.
 *
 * Flow:
 * 1. Frontend captures webcam frame
 * 2. Frontend calls POST /api/chat/vision with just the image
 * 3. Backend analyzes image with Claude Vision, stores emotion context
 * 4. Returns emotion context to frontend
 * 5. Frontend calls POST /api/chat with message - emotion context is auto-injected
 */
app.post('/api/chat/vision', async (req: Request, res: Response) => {
  try {
    const { sessionId, imageDataUrl } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');

    if (!imageDataUrl) {
      res.status(400).json({ error: 'imageDataUrl is required' });
      return;
    }

    // Prevent concurrent vision requests
    if (visionRequestInProgress) {
      res.status(429).json({
        error: 'Vision request already in progress',
        retryAfter: 5
      });
      return;
    }

    // Rate limiting (additional server-side check)
    const now = Date.now();
    const timeSinceLastRequest = now - lastVisionRequestTime;
    if (timeSinceLastRequest < VISION_COOLDOWN_MS) {
      res.status(429).json({
        error: 'Too many vision requests',
        retryAfter: Math.ceil((VISION_COOLDOWN_MS - timeSinceLastRequest) / 1000)
      });
      return;
    }

    const effectiveSessionId = sessionId || `${vaultId}:${DEFAULT_SESSION}`;
    const agent = getOrCreateAgent(effectiveSessionId);

    visionRequestInProgress = true;
    lastVisionRequestTime = now;

    try {
      // Emit event for plugin tracking
      pluginEventBus.emit('emotion:vision_request', {
        imageSize: imageDataUrl.length,
        timestamp: now
      });

      // Analyze the image for emotions (this stores the result internally)
      const emotionContext = await agent.analyzeVisionEmotion(imageDataUrl);

      // Return just the emotion context - no chat response
      res.json({
        success: true,
        emotionContext,
        sessionId: effectiveSessionId
      });
    } finally {
      visionRequestInProgress = false;
    }
  } catch (error) {
    visionRequestInProgress = false;
    console.error('Vision analysis error:', error);
    res.status(500).json({ error: 'Vision analysis failed' });
  }
});

// ============================================================================
// Streams Endpoints
// ============================================================================

// List streams for a session
app.get('/api/streams', (req: Request, res: Response) => {
  // If sessionId is provided, filter by it; otherwise return vault-scoped streams
  const sessionId = req.query.sessionId as string | undefined;
  const vaultId = getVaultIdFromRequest(req, 'default');
  const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : undefined;
  const allStreams = streamManager.listStreams(effectiveSessionId);
  // Filter to only streams belonging to this vault
  const streams = allStreams.filter(s => s.sessionId.startsWith(`${vaultId}:`));
  res.json({ streams });
});

// Get stream info
app.get('/api/streams/:channel', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  const stream = streamManager.getStream(channel);
  if (!stream) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  // Verify stream belongs to this vault
  if (!stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  res.json({ stream });
});

// Create a stream
app.post('/api/streams', (req: Request, res: Response) => {
  try {
    const { channel, sessionId, schema, metadata } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:default`;
    const stream = streamManager.createStream(channel, effectiveSessionId, schema, metadata);
    res.json({ stream });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create stream' });
  }
});

// Publish an event to a stream (for HTTP-based publishing)
app.post('/api/streams/:channel/event', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  const { data, source } = req.body;
  // Verify stream belongs to this vault before publishing
  const stream = streamManager.getStream(channel);
  if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  const event = streamManager.publishEvent(channel, data, source);
  if (!event) {
    res.status(400).json({ error: 'Failed to publish event' });
    return;
  }
  res.json({ event });
});

// Get stream history
app.get('/api/streams/:channel/history', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  // Verify stream belongs to this vault
  const stream = streamManager.getStream(channel);
  if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  const events = streamManager.getHistory(channel, limit);
  res.json({ events });
});

// Set/update stream schema
app.post('/api/streams/:channel/schema', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  const { schema } = req.body;
  // Verify stream belongs to this vault
  const stream = streamManager.getStream(channel);
  if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  streamManager.setSchema(channel, schema);
  res.json({ success: true });
});

// Get stream schema
app.get('/api/streams/:channel/schema', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  // Verify stream belongs to this vault
  const stream = streamManager.getStream(channel);
  if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  const schema = streamManager.getSchema(channel);
  if (!schema) {
    res.status(404).json({ error: 'No schema defined for stream' });
    return;
  }
  res.json({ schema });
});

// Close a stream
app.delete('/api/streams/:channel', (req: Request, res: Response) => {
  const channel = decodeURIComponent(req.params.channel);
  const vaultId = getVaultIdFromRequest(req, 'default');
  // Verify stream belongs to this vault before closing
  const stream = streamManager.getStream(channel);
  if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  streamManager.closeStream(channel);
  res.json({ success: true });
});

// ============================================================================
// Embeddings Endpoints
// ============================================================================

// Get embeddings API info
app.get('/api/embeddings', (_req: Request, res: Response) => {
  res.json({
    service: 'embeddings',
    version: '1.0.0',
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    initialized: embeddingServiceInitialized,
    endpoints: {
      POST: {
        embed: { action: 'embed', text: 'string' },
        embedBatch: { action: 'embedBatch', texts: 'string[]' },
        similarity: { action: 'similarity', embedding1: 'number[]', embedding2: 'number[]' },
        findSimilar: { action: 'findSimilar', query: 'string', candidates: 'string[]', topK: 'number (optional)' }
      }
    }
  });
});

// Embeddings operations
app.post('/api/embeddings', async (req: Request, res: Response) => {
  try {
    const { action, text, texts, embedding1, embedding2, query, candidates, topK } = req.body;

    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    // Initialize embedding service if needed
    const initialized = await initializeEmbeddingService();
    if (!initialized) {
      res.status(503).json({ error: 'Embedding service not available' });
      return;
    }

    switch (action) {
      case 'embed': {
        if (!text || typeof text !== 'string') {
          res.status(400).json({ error: 'text is required for embed action' });
          return;
        }
        const embedding = await embeddingService.embed(text);
        res.json({ embedding });
        break;
      }

      case 'embedBatch': {
        if (!texts || !Array.isArray(texts) || texts.length === 0) {
          res.status(400).json({ error: 'texts array is required for embedBatch action' });
          return;
        }
        const embeddings = await embeddingService.embedBatch(texts);
        res.json({ embeddings });
        break;
      }

      case 'similarity': {
        if (!embedding1 || !embedding2 || !Array.isArray(embedding1) || !Array.isArray(embedding2)) {
          res.status(400).json({ error: 'embedding1 and embedding2 arrays are required for similarity action' });
          return;
        }
        const similarity = embeddingService.cosineSimilarity(embedding1, embedding2);
        res.json({ similarity });
        break;
      }

      case 'findSimilar': {
        if (!query || typeof query !== 'string') {
          res.status(400).json({ error: 'query string is required for findSimilar action' });
          return;
        }
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
          res.status(400).json({ error: 'candidates array is required for findSimilar action' });
          return;
        }
        const results = await embeddingService.findMostSimilar(query, candidates, topK || 5);
        res.json({ results: results.map(r => ({ text: r.text, similarity: r.similarity })) });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[Server] Embeddings error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Embeddings operation failed'
    });
  }
});

// ============================================================================
// Idle Mode Endpoints - Control autonomous idle detection
// ============================================================================

// Get idle mode status
app.get('/api/idle-mode/status', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    const session = runtime.sessions.getSession(effectiveSessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const agent = session.agent;
    const idleStatus = agent.getIdleStatus();

    // Get bridge status if available
    const bridgeStatus = idleStreamBridge?.getStatus();

    res.json({
      isIdle: idleStatus.isIdle,
      idleDuration: idleStatus.timeSinceLastInteraction,
      lastActivity: idleStatus.lastInteractionTime.toISOString(),
      currentSession: null, // TODO: Add autonomous session tracking
      sessionHistory: [], // TODO: Add session history
      config: {
        enabled: idleStatus.enabled,
        idleThreshold: idleStatus.thresholdMinutes,
        maxSessionDuration: 120, // Default
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30, // Default coherence floor
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      },
      learningHistory: [],
      emergentCategories: [],
      // Include bridge status
      bridgeStatus: bridgeStatus || null,
      streamsAvailable: {
        idleMode: streamManager.getStream(`${effectiveSessionId}:idle-mode`) ? true : false,
        autonomousSessions: streamManager.getStream(`${effectiveSessionId}:autonomous-sessions`) ? true : false
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error getting status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get idle mode status'
    });
  }
});

// Toggle idle mode
app.post('/api/idle-mode/toggle', (req: Request, res: Response) => {
  try {
    const { sessionId, enabled } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    const session = runtime.sessions.getSession(effectiveSessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const agent = session.agent;

    if (enabled) {
      agent.enableIdleDetection();
    } else {
      agent.disableIdleDetection();
    }

    // Return updated status
    const idleStatus = agent.getIdleStatus();

    res.json({
      isIdle: idleStatus.isIdle,
      idleDuration: idleStatus.timeSinceLastInteraction,
      lastActivity: idleStatus.lastInteractionTime.toISOString(),
      config: {
        enabled: idleStatus.enabled,
        idleThreshold: idleStatus.thresholdMinutes,
        maxSessionDuration: 120,
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30, // Default coherence floor
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error toggling idle mode:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to toggle idle mode'
    });
  }
});

// Update idle mode configuration
app.post('/api/idle-mode/config', (req: Request, res: Response) => {
  try {
    const { sessionId, config } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'config object is required' });
      return;
    }

    const session = runtime.sessions.getSession(effectiveSessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const agent = session.agent;

    // Update idle threshold if provided
    if (typeof config.idleThreshold === 'number' && config.idleThreshold > 0) {
      agent.setIdleThreshold(config.idleThreshold);
    }

    // Return updated status
    const idleStatus = agent.getIdleStatus();

    res.json({
      isIdle: idleStatus.isIdle,
      idleDuration: idleStatus.timeSinceLastInteraction,
      lastActivity: idleStatus.lastInteractionTime.toISOString(),
      config: {
        enabled: idleStatus.enabled,
        idleThreshold: idleStatus.thresholdMinutes,
        maxSessionDuration: config.maxSessionDuration || 120,
        evolutionIntensity: config.evolutionIntensity || 'moderate' as const,
        safetyLevel: config.safetyLevel || 'high' as const,
        coherenceFloor: config.coherenceFloor || 30,
        allowedGoalTypes: config.allowedGoalTypes || [],
        researchDomains: config.researchDomains || [],
        externalPublishing: config.externalPublishing || false,
        subagentCoordination: config.subagentCoordination !== false,
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error updating config:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update idle mode config'
    });
  }
});

// Trigger idle mode instantly
app.post('/api/idle-mode/trigger', async (req: Request, res: Response) => {
  try {
    const { sessionId, mode } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    // Validate mode if provided
    const validModes = ['exploration', 'research', 'creation', 'optimization'];
    const evolutionMode = mode && validModes.includes(mode) ? mode : 'exploration';

    // Use the idle bridge if available
    if (idleStreamBridge) {
      const result = await idleStreamBridge.triggerIdleNow(effectiveSessionId, evolutionMode);

      if (result.success) {
        res.json({
          success: true,
          sessionId: effectiveSessionId,
          mode: evolutionMode,
          message: result.message,
          status: 'idle',
          triggeredAt: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.message
        });
      }
      return;
    }

    // Fallback: directly emit the idle:start event
    const { pluginEventBus } = await import('../plugins/event-bus.js');

    pluginEventBus.emit('idle:start', {
      timestamp: new Date(),
      timeSinceLastInteraction: 30 * 60 * 1000, // 30 minutes
      conversationId: effectiveSessionId
    } as any); // Use any to allow additional metadata

    res.json({
      success: true,
      sessionId: effectiveSessionId,
      mode: evolutionMode,
      message: `Idle mode triggered instantly for session ${effectiveSessionId} in ${evolutionMode} mode`,
      status: 'idle',
      triggeredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[IdleMode] Error triggering instant idle mode:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger idle mode'
    });
  }
});

// Session control endpoints (start, pause, resume, terminate)
app.post('/api/idle-mode/session/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, mode } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    // Validate mode
    const validModes = ['exploration', 'research', 'creation', 'optimization'];
    const evolutionMode = mode && validModes.includes(mode) ? mode : 'exploration';

    // Use the idle bridge if available
    if (idleStreamBridge) {
      const result = await idleStreamBridge.triggerIdleNow(effectiveSessionId, evolutionMode);

      if (result.success) {
        res.json({
          isIdle: true,
          idleDuration: 0,
          lastActivity: new Date().toISOString(),
          currentSession: {
            id: `session_${Date.now()}`,
            mode: evolutionMode,
            status: 'active',
            startTime: new Date().toISOString(),
            goals: [],
            activities: 0,
            discoveries: 0,
            coherenceLevel: 65
          },
          config: {
            enabled: true,
            idleThreshold: 30,
            maxSessionDuration: 120,
            evolutionIntensity: 'moderate' as const,
            safetyLevel: 'high' as const,
            coherenceFloor: 30,
            allowedGoalTypes: [],
            researchDomains: [],
            externalPublishing: false,
            subagentCoordination: true,
          }
        });
        return;
      }
    }

    // Fallback response when bridge not available
    res.json({
      isIdle: true,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      currentSession: {
        id: `session_${Date.now()}`,
        mode: evolutionMode,
        status: 'active',
        startTime: new Date().toISOString(),
        goals: [],
        activities: 0,
        discoveries: 0,
        coherenceLevel: 65
      },
      config: {
        enabled: true,
        idleThreshold: 30,
        maxSessionDuration: 120,
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30,
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error starting session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start session'
    });
  }
});

app.post('/api/idle-mode/session/pause', (req: Request, res: Response) => {
  try {
    const { sessionId, autonomousSessionId } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    // TODO: Implement actual pause logic via idleStreamBridge
    console.log(`[IdleMode] Pausing session ${autonomousSessionId} for ${effectiveSessionId}`);

    res.json({
      isIdle: false,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      currentSession: {
        id: autonomousSessionId,
        mode: 'exploration',
        status: 'paused',
        startTime: new Date().toISOString(),
        goals: [],
        activities: 0,
        discoveries: 0,
        coherenceLevel: 65
      },
      config: {
        enabled: true,
        idleThreshold: 30,
        maxSessionDuration: 120,
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30,
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error pausing session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to pause session'
    });
  }
});

app.post('/api/idle-mode/session/resume', (req: Request, res: Response) => {
  try {
    const { sessionId, autonomousSessionId } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    // TODO: Implement actual resume logic via idleStreamBridge
    console.log(`[IdleMode] Resuming session ${autonomousSessionId} for ${effectiveSessionId}`);

    res.json({
      isIdle: true,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      currentSession: {
        id: autonomousSessionId,
        mode: 'exploration',
        status: 'active',
        startTime: new Date().toISOString(),
        goals: [],
        activities: 0,
        discoveries: 0,
        coherenceLevel: 65
      },
      config: {
        enabled: true,
        idleThreshold: 30,
        maxSessionDuration: 120,
        evolutionIntensity: 'moderate' as const,
        safetyLevel: 'high' as const,
        coherenceFloor: 30,
        allowedGoalTypes: [],
        researchDomains: [],
        externalPublishing: false,
        subagentCoordination: true,
      }
    });
  } catch (error) {
    console.error('[IdleMode] Error resuming session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to resume session'
    });
  }
});

app.post('/api/idle-mode/session/terminate', (req: Request, res: Response) => {
  try {
    const { sessionId, autonomousSessionId } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;

    // TODO: Implement actual terminate logic via idleStreamBridge
    console.log(`[IdleMode] Terminating session ${autonomousSessionId} for ${effectiveSessionId}`);

    res.json({
      isIdle: false,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      currentSession: null,
      sessionHistory: [],
      config: {
        enabled: true,
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
  } catch (error) {
    console.error('[IdleMode] Error terminating session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to terminate session'
    });
  }
});

// ============================================================================
// Idle Mode Prompt Editing Endpoints
// ============================================================================

// Start an idle session with prompt preview (doesn't execute immediately)
app.post('/api/idle-mode/session/prepare', async (req: Request, res: Response) => {
  console.log('[IdleMode:prepare] ========== PREPARE SESSION ==========');
  console.log('[IdleMode:prepare] Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { sessionId, mode, autonomyLevel } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;
    console.log('[IdleMode:prepare] Effective session ID:', effectiveSessionId);

    const validModes = ['exploration', 'research', 'creation', 'optimization'] as const;
    const validAutonomy = ['restricted', 'standard', 'relaxed', 'full'] as const;

    const evolutionMode = mode && validModes.includes(mode) ? mode : 'exploration';
    const autonomy = autonomyLevel && validAutonomy.includes(autonomyLevel) ? autonomyLevel : 'standard';
    console.log('[IdleMode:prepare] Mode:', evolutionMode, 'Autonomy:', autonomy);

    // Get or create executor
    console.log('[IdleMode:prepare] Getting/creating executor...');
    const executor = getOrCreateExecutor(effectiveSessionId, evolutionMode, autonomy as AutonomyLevel);
    console.log('[IdleMode:prepare] Executor created, starting...');

    // Initialize executor (memory store access will happen via runtime)
    // Note: Memory store initialization is handled internally by executor

    // Start preparation (will emit prompt_ready event)
    await executor.start();
    console.log('[IdleMode:prepare] Executor started');

    // Return prompt chunks for editing
    const chunks = executor.getPromptChunks();
    const state = executor.getState();
    console.log('[IdleMode:prepare] State:', state.status, 'Chunks:', chunks.length);

    res.json({
      success: true,
      sessionId: effectiveSessionId,
      mode: evolutionMode,
      autonomyLevel: autonomy,
      status: state.status,
      chunks: chunks.map(c => ({
        id: c.id,
        type: c.type,
        content: c.content,
        editable: c.editable,
        required: c.required,
        order: c.order
      }))
    });
    console.log('[IdleMode:prepare] Response sent successfully');
  } catch (error) {
    console.error('[IdleMode:prepare] ERROR:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to prepare session'
    });
  }
});

// Get current prompt chunks for editing
app.get('/api/idle-mode/prompts/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = getEffectiveSessionId(sessionId, vaultId);

    const executor = idleSessionExecutors.get(effectiveSessionId);
    if (!executor) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const chunks = executor.getPromptChunks();
    const state = executor.getState();

    res.json({
      success: true,
      status: state.status,
      chunks: chunks.map(c => ({
        id: c.id,
        type: c.type,
        content: c.content,
        editable: c.editable,
        required: c.required,
        order: c.order
      }))
    });
  } catch (error) {
    console.error('[IdleMode] Error getting prompts:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get prompts'
    });
  }
});

// Update a specific prompt chunk
app.put('/api/idle-mode/prompts/:sessionId/:chunkId', (req: Request, res: Response) => {
  try {
    const { sessionId, chunkId } = req.params;
    const { content } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = getEffectiveSessionId(sessionId, vaultId);

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const executor = idleSessionExecutors.get(effectiveSessionId);
    if (!executor) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const updated = executor.updatePromptChunk(chunkId, content);
    if (!updated) {
      res.status(400).json({ error: 'Chunk not editable or not found' });
      return;
    }

    res.json({ success: true, chunkId, updated: true });
  } catch (error) {
    console.error('[IdleMode] Error updating prompt:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update prompt'
    });
  }
});

// Approve prompts and start execution
app.post('/api/idle-mode/prompts/:sessionId/approve', async (req: Request, res: Response) => {
  console.log('[IdleMode:approve] ========== APPROVE PROMPT ==========');
  console.log('[IdleMode:approve] Session ID param:', req.params.sessionId);
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    // Use helper to avoid double-prefixing if sessionId is already vault-prefixed
    const effectiveSessionId = getEffectiveSessionId(sessionId, vaultId);
    console.log('[IdleMode:approve] Effective session ID:', effectiveSessionId);
    console.log('[IdleMode:approve] Active executors:', Array.from(idleSessionExecutors.keys()));

    const executor = idleSessionExecutors.get(effectiveSessionId);
    if (!executor) {
      console.log('[IdleMode:approve] ERROR: No executor found for session');
      res.status(404).json({ error: 'No active session' });
      return;
    }

    console.log('[IdleMode:approve] Executor found, current state:', executor.getState().status);
    console.log('[IdleMode:approve] Calling approvePrompt()...');
    await executor.approvePrompt();
    console.log('[IdleMode:approve] approvePrompt() completed');

    res.json({
      success: true,
      message: 'Prompt approved, execution started'
    });
    console.log('[IdleMode:approve] Response sent');
  } catch (error) {
    console.error('[IdleMode] Error approving prompt:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve prompt'
    });
  }
});

// Reject prompts and cancel session
app.post('/api/idle-mode/prompts/:sessionId/reject', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = getEffectiveSessionId(sessionId, vaultId);

    const executor = idleSessionExecutors.get(effectiveSessionId);
    if (!executor) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    executor.rejectPrompt();
    idleSessionExecutors.delete(effectiveSessionId);

    res.json({
      success: true,
      message: 'Prompt rejected, session cancelled'
    });
  } catch (error) {
    console.error('[IdleMode] Error rejecting prompt:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to reject prompt'
    });
  }
});

// Get session executor state
app.get('/api/idle-mode/executor/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = `${vaultId}:${sessionId}`;

    const executor = idleSessionExecutors.get(effectiveSessionId);
    if (!executor) {
      res.status(404).json({ error: 'No active session' });
      return;
    }

    const state = executor.getState();

    res.json({
      success: true,
      status: state.status,
      currentTurn: state.currentTurn,
      discoveries: state.discoveries.length,
      activities: state.activities.length,
      lastHeartbeat: state.lastHeartbeat
    });
  } catch (error) {
    console.error('[IdleMode] Error getting executor state:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get executor state'
    });
  }
});

// ============================================================================
// Steering Endpoints - User guidance during streaming/tool use
// ============================================================================

// Send a steering message
app.post('/api/steering', (req: Request, res: Response) => {
  try {
    const { sessionId, content } = req.body;
    const vaultId = getVaultIdFromRequest(req, 'default');

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required and must be a string' });
      return;
    }

    const effectiveSessionId = sessionId ? `${vaultId}:${sessionId}` : `${vaultId}:${DEFAULT_SESSION}`;
    const message = addSteeringMessage(effectiveSessionId, content.trim());

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('[Steering] Error adding message:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add steering message'
    });
  }
});

// Get pending steering messages for a session
app.get('/api/steering/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = `${vaultId}:${sessionId}`;
    const queue = getSteeringQueue(effectiveSessionId);
    const pending = queue.filter(m => !m.processed);

    res.json({
      success: true,
      messages: pending
    });
  } catch (error) {
    console.error('[Steering] Error getting messages:', error);
    res.status(500).json({
      error: 'Failed to get steering messages'
    });
  }
});

// Clear all steering messages for a session
app.delete('/api/steering/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const vaultId = getVaultIdFromRequest(req, 'default');
    const effectiveSessionId = `${vaultId}:${sessionId}`;
    const queue = getSteeringQueue(effectiveSessionId);
    const clearedCount = queue.length;
    steeringMessageQueues.set(effectiveSessionId, []);

    res.json({
      success: true,
      cleared: clearedCount
    });
  } catch (error) {
    console.error('[Steering] Error clearing messages:', error);
    res.status(500).json({
      error: 'Failed to clear steering messages'
    });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for use as module
export { app, server };

// Start server if run directly
// Default to 3001 to avoid conflict with Next.js dev server (3000)
const PORT = process.env.PORT || 3001;

export async function startServer(port: number = Number(PORT)): Promise<void> {
  // Load persisted sessions from SQLite
  console.log('[Server] Loading sessions from SQLite...');
  await runtime.sessions.loadAllSessions();

  // Register the steering message provider for hooks to access
  registerSteeringProvider(consumeSteeringMessages);
  console.log('[Server] Steering message provider registered');

  // Initialize idle stream bridge
  try {
    console.log('[Server] Initializing idle stream bridge...');
    idleStreamBridge = new IdleStreamBridge(streamManager, runtime, {
      enabled: true,
      idleThreshold: 30, // 30 minutes
      debugLogging: process.env.NODE_ENV === 'development'
    });

    await idleStreamBridge.initialize();
    console.log('[Server] Idle stream bridge initialized successfully');
  } catch (error) {
    console.warn('[Server] Idle stream bridge initialization failed (continuing with reduced functionality):', error);
    // Don't throw - allow server to continue
  }

  // Initialize WebSocket server
  createWebSocketServer(server, streamManager);

  server.listen(port, () => {
    console.log(`METAMORPH API server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`API info: http://localhost:${port}/api`);
    console.log(`WebSocket streams: ws://localhost:${port}/ws/streams`);

    // Start demo server-stats stream
    startDemoStream();
  });
}

/**
 * Demo stream that publishes server stats every 5 seconds.
 * Shows the streams system working out of the box.
 */
function startDemoStream(): void {
  const DEMO_SESSION = 'default';
  const DEMO_CHANNEL = `${DEMO_SESSION}:server:stats`;
  const INTERVAL_MS = 5000;

  // JSON Schema for server stats - viewers can use this for smart rendering
  const serverStatsSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Server Stats',
    description: 'Real-time server performance metrics',
    type: 'object' as const,
    properties: {
      uptime: { type: 'integer' as const, description: 'Server uptime in seconds' },
      memory: {
        type: 'object' as const,
        properties: {
          heapUsed: { type: 'integer' as const, description: 'Heap memory used (MB)' },
          heapTotal: { type: 'integer' as const, description: 'Total heap memory (MB)' },
          rss: { type: 'integer' as const, description: 'Resident set size (MB)' },
        },
      },
      cpu: {
        type: 'object' as const,
        properties: {
          user: { type: 'integer' as const, description: 'User CPU time (ms)' },
          system: { type: 'integer' as const, description: 'System CPU time (ms)' },
        },
      },
      connections: { type: 'integer' as const, description: 'Active stream count' },
      timestamp: { type: 'string' as const, format: 'date-time' },
    },
  };

  // Metadata for the viewer to understand how to display this stream
  const metadata = {
    displayType: 'server-stats',
    displayName: 'Server Stats',
    description: 'Real-time server performance metrics',
    refreshInterval: INTERVAL_MS,
  };

  // Create the demo stream with schema and metadata
  streamManager.createStream(DEMO_CHANNEL, DEMO_SESSION, serverStatsSchema, metadata);
  console.log(`Demo stream started: ${DEMO_CHANNEL}`);

  // Publish stats every 5 seconds
  const startTime = Date.now();
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    streamManager.publishEvent(DEMO_CHANNEL, {
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
      connections: streamManager.listStreams().length,
      timestamp: new Date().toISOString(),
    }, 'server');
  }, INTERVAL_MS);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
