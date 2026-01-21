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
import { registerSteeringProvider, formatSteeringContext } from '../agent/hooks.js';
import { ModeConfig } from '../types/index.js';
import { MetamorphRuntime } from '../runtime/index.js';
import { FaceApiDetector } from '../plugins/emotion-detection/face-api-detector.js';
import { EmotionProcessor } from '../plugins/emotion-detection/emotion-processor.js';
import { pluginEventBus } from '../plugins/event-bus.js';
import { createWebSocketServer } from './websocket.js';
import { streamManager } from '../plugins/streams/stream-manager.js';
import { EmbeddingService } from '../embeddings/service.js';

const app = express();

// Create HTTP server for WebSocket support
const server = createServer(app);

// Middleware
app.use(cors());
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

// Steering message queue - per-session storage
interface SteeringMessage {
  id: string;
  content: string;
  timestamp: number;
  processed?: boolean;
}

const steeringMessageQueues = new Map<string, SteeringMessage[]>();

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
      'GET /api/commands': 'List available commands',
      'POST /api/sync': 'Sync data from browser to server (messages, memories, emotions)',
      'GET /api/sync/emotions': 'Get aggregated emotion context for a session',
      'POST /api/emotion/detect': 'Detect emotions from webcam frame (base64 image)',
      'GET /api/emotion/status': 'Get emotion detector status',
      'POST /api/emotion/reset': 'Clear emotion history',
      'POST /api/chat/vision': 'Send message with webcam frame to Claude for vision-based analysis'
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
app.post('/api/chat/stream', apiKeyAuth, async (req: Request, res: Response) => {
  const { message, sessionId, emotionContext } = req.body;

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
  const limit = parseInt(req.query.limit as string) || 500;

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

// List all sessions (includes persisted sessions from SQLite)
app.get('/api/sessions', apiKeyAuth, async (_req: Request, res: Response) => {
  try {
    // Get all sessions from persistence (includes ones not in memory)
    const sessions = await runtime.sessions.listSessionsAsync();
    res.json({ sessions });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
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

// Sync endpoint for PWA background sync (browser → server)
app.post('/api/sync', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { type, sessionId, data } = req.body;

    if (!type || !sessionId) {
      res.status(400).json({ error: 'type and sessionId are required' });
      return;
    }

    const agent = getOrCreateAgent(sessionId);

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
app.get('/api/sync/emotions', apiKeyAuth, (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const emotionData = sessionEmotionData.get(sessionId);

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
app.post('/api/emotion/detect', apiKeyAuth, async (req: Request, res: Response) => {
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
app.get('/api/emotion/status', apiKeyAuth, (_req: Request, res: Response) => {
  res.json({
    initialized: emotionDetectorInitialized,
    detectorReady: faceDetector.isInitialized(),
    historyLength: emotionProcessor.getHistoryLength()
  });
});

// Clear emotion history (for testing/reset)
app.post('/api/emotion/reset', apiKeyAuth, (_req: Request, res: Response) => {
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
app.post('/api/chat/vision', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, imageDataUrl } = req.body;

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

    const agent = getOrCreateAgent(sessionId);

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
        sessionId: sessionId || DEFAULT_SESSION
      });
    } finally {
      visionRequestInProgress = false;
    }
  } catch (error) {
    visionRequestInProgress = false;
    console.error('Vision analysis error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ============================================================================
// Streams Endpoints
// ============================================================================

// List streams for a session
app.get('/api/streams', apiKeyAuth, (req, res) => {
  // If sessionId is provided, filter by it; otherwise return ALL streams
  const sessionId = req.query.sessionId as string | undefined;
  const streams = streamManager.listStreams(sessionId);
  res.json({ streams });
});

// Get stream info
app.get('/api/streams/:channel', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  const stream = streamManager.getStream(channel);
  if (!stream) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }
  res.json({ stream });
});

// Create a stream
app.post('/api/streams', apiKeyAuth, (req, res) => {
  try {
    const { channel, sessionId, schema, metadata } = req.body;
    const effectiveSessionId = sessionId || 'default';
    const stream = streamManager.createStream(channel, effectiveSessionId, schema, metadata);
    res.json({ stream });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create stream' });
  }
});

// Publish an event to a stream (for HTTP-based publishing)
app.post('/api/streams/:channel/event', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  const { data, source } = req.body;
  const event = streamManager.publishEvent(channel, data, source);
  if (!event) {
    res.status(400).json({ error: 'Failed to publish event (validation error or stream issue)' });
    return;
  }
  res.json({ event });
});

// Get stream history
app.get('/api/streams/:channel/history', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const events = streamManager.getHistory(channel, limit);
  res.json({ events });
});

// Set/update stream schema
app.post('/api/streams/:channel/schema', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  const { schema } = req.body;
  streamManager.setSchema(channel, schema);
  res.json({ success: true });
});

// Get stream schema
app.get('/api/streams/:channel/schema', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  const schema = streamManager.getSchema(channel);
  if (!schema) {
    res.status(404).json({ error: 'No schema defined for stream' });
    return;
  }
  res.json({ schema });
});

// Close a stream
app.delete('/api/streams/:channel', apiKeyAuth, (req, res) => {
  const channel = decodeURIComponent(req.params.channel);
  streamManager.closeStream(channel);
  res.json({ success: true });
});

// ============================================================================
// Embeddings Endpoints
// ============================================================================

// Get embeddings API info
app.get('/api/embeddings', apiKeyAuth, (_req: Request, res: Response) => {
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
app.post('/api/embeddings', apiKeyAuth, async (req: Request, res: Response) => {
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
// Steering Endpoints - User guidance during streaming/tool use
// ============================================================================

// Send a steering message
app.post('/api/steering', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const { sessionId, content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required and must be a string' });
      return;
    }

    const effectiveSessionId = sessionId || DEFAULT_SESSION;
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
app.get('/api/steering/:sessionId', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const queue = getSteeringQueue(sessionId);
    const pending = queue.filter(m => !m.processed);

    res.json({
      success: true,
      messages: pending
    });
  } catch (error) {
    console.error('[Steering] Error getting messages:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get steering messages'
    });
  }
});

// Clear all steering messages for a session
app.delete('/api/steering/:sessionId', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const queue = getSteeringQueue(sessionId);
    const clearedCount = queue.length;
    steeringMessageQueues.set(sessionId, []);

    res.json({
      success: true,
      cleared: clearedCount
    });
  } catch (error) {
    console.error('[Steering] Error clearing messages:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to clear steering messages'
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
