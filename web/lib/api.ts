/**
 * METAMORPH API Client
 */

import type {
  Stance,
  ModeConfig,
  Message,
  ChatResponse,
  SessionResponse,
  SubagentDefinition,
  Sentience,
  TimelineEntry,
  EvolutionSnapshot,
  ToolUseEvent,
  EmotionContext,
} from './types';

// Re-export EmotionContext for backward compatibility
export type { EmotionContext } from './types';

/**
 * Emotion detection response
 */
export interface EmotionDetectionResponse {
  detected: boolean;
  emotionContext: EmotionContext | null;
  message?: string;
  facesDetected?: number;
  error?: string;
}

/**
 * Emotion detector status
 */
export interface EmotionStatusResponse {
  initialized: boolean;
  detectorReady: boolean;
  historyLength: number;
}

const API_BASE = '/api';
// Direct connection to backend for SSE streaming (bypasses Next.js proxy buffering)
// In production, use NEXT_PUBLIC_API_URL; in development, use localhost
const STREAM_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`) + '/api'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new session
 */
export async function createSession(config?: Partial<ModeConfig>): Promise<SessionResponse> {
  return fetchJson<SessionResponse>(`${API_BASE}/session`, {
    method: 'POST',
    body: JSON.stringify({ config }),
  });
}

/**
 * Resume an existing session by ID
 * Returns null if session doesn't exist
 */
export async function resumeSession(sessionId: string): Promise<SessionResponse | null> {
  try {
    const state = await getState(sessionId);
    return {
      sessionId,
      stance: state.stance,
      config: state.config,
    };
  } catch {
    // Session doesn't exist
    return null;
  }
}

/**
 * Get current state
 */
export async function getState(sessionId: string): Promise<{
  stance: Stance;
  config: ModeConfig;
}> {
  return fetchJson(`${API_BASE}/state?sessionId=${sessionId}`);
}

/**
 * Update configuration
 */
export async function updateConfig(
  sessionId: string,
  config: Partial<ModeConfig>
): Promise<{ success: boolean; config: ModeConfig }> {
  return fetchJson(`${API_BASE}/config`, {
    method: 'PUT',
    body: JSON.stringify({ sessionId, config }),
  });
}

/**
 * Send a chat message (non-streaming)
 */
export async function chat(
  sessionId: string | undefined,
  message: string
): Promise<ChatResponse & { sessionId: string }> {
  return fetchJson(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, message }),
  });
}

/**
 * Send a chat message with streaming
 * @param emotionContext - Optional emotion context from webcam detection
 */
export function chatStream(
  sessionId: string | undefined,
  message: string,
  emotionContext: EmotionContext | null | undefined,
  callbacks: {
    onText?: (text: string) => void;
    onToolEvent?: (event: ToolUseEvent) => void;
    onComplete?: (data: ChatResponse) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${STREAM_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, emotionContext: emotionContext || undefined }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events - handle event: and data: lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle based on event type
              if (currentEvent === 'text' && callbacks.onText) {
                callbacks.onText(parsed.text);
              } else if (currentEvent === 'tool_event' && callbacks.onToolEvent) {
                callbacks.onToolEvent(parsed);
              } else if (currentEvent === 'complete' && callbacks.onComplete) {
                callbacks.onComplete(parsed);
              } else if (currentEvent === 'error' && callbacks.onError) {
                callbacks.onError(new Error(parsed.error));
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
            currentEvent = ''; // Reset after processing data
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        callbacks.onError?.(error);
      }
    }
  })();

  return () => controller.abort();
}

/**
 * Get conversation history
 */
export async function getHistory(
  sessionId: string,
  limit?: number
): Promise<{ messages: Message[]; total: number }> {
  const params = new URLSearchParams({ sessionId });
  if (limit) params.append('limit', limit.toString());
  return fetchJson(`${API_BASE}/history?${params}`);
}

/**
 * Get identity information
 */
export async function getIdentity(sessionId: string): Promise<{
  frame: string;
  selfModel: string;
  sentience: Sentience;
}> {
  return fetchJson(`${API_BASE}/identity?sessionId=${sessionId}`);
}

/**
 * Get available subagents
 */
export async function getSubagents(sessionId: string): Promise<{
  subagents: SubagentDefinition[];
}> {
  return fetchJson(`${API_BASE}/subagents?sessionId=${sessionId}`);
}

/**
 * Export session state
 */
export async function exportState(sessionId: string): Promise<{
  state: string;
  exportedAt: string;
}> {
  return fetchJson(`${API_BASE}/export?sessionId=${sessionId}`);
}

/**
 * Import session state
 */
export async function importState(state: string): Promise<SessionResponse> {
  return fetchJson(`${API_BASE}/import`, {
    method: 'POST',
    body: JSON.stringify({ state }),
  });
}

/**
 * Get operator timeline (Ralph Iteration 2 - Feature 3)
 */
export async function getTimeline(
  sessionId: string,
  limit?: number
): Promise<{ entries: TimelineEntry[] }> {
  const params = new URLSearchParams({ sessionId });
  if (limit) params.append('limit', limit.toString());
  return fetchJson(`${API_BASE}/timeline?${params}`);
}

/**
 * Get evolution snapshots (Ralph Iteration 2 - Feature 5)
 */
export async function getEvolution(
  sessionId: string,
  limit?: number
): Promise<{ snapshots: EvolutionSnapshot[] }> {
  const params = new URLSearchParams({ sessionId });
  if (limit) params.append('limit', limit.toString());
  return fetchJson(`${API_BASE}/evolution?${params}`);
}

/**
 * List all sessions
 */
export async function getSessions(): Promise<{
  sessions: Array<{
    id: string;
    stance: Stance;
    messageCount: number;
  }>;
}> {
  return fetchJson(`${API_BASE}/sessions`);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<{ success: boolean }> {
  return fetchJson(`${API_BASE}/session/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * Search memories
 */
export async function getMemories(
  sessionId: string,
  type?: 'episodic' | 'semantic' | 'identity',
  limit?: number
): Promise<{
  memories: Array<{
    id: string;
    type: 'episodic' | 'semantic' | 'identity';
    content: string;
    importance: number;
    timestamp: Date;
  }>;
}> {
  const params = new URLSearchParams({ sessionId });
  if (type) params.append('type', type);
  if (limit) params.append('limit', limit.toString());
  return fetchJson(`${API_BASE}/memories?${params}`);
}

/**
 * Invoke a subagent (explore, reflect, dialectic, verify)
 */
export async function invokeSubagent(
  sessionId: string,
  name: string,
  input: string
): Promise<{
  response: string;
  toolsUsed: string[];
  stanceAfter: Stance;
}> {
  return fetchJson(`${API_BASE}/subagents/${name}`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, input }),
  });
}

/**
 * Execute a CLI command via API
 */
export async function executeCommand(
  sessionId: string,
  command: string,
  args: string[]
): Promise<{
  success: boolean;
  data: unknown;
  error?: string;
}> {
  return fetchJson(`${API_BASE}/command`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, command, args }),
  });
}

/**
 * Sync data from browser to server (PWA background sync)
 */
export async function syncToServer(
  sessionId: string,
  type: 'messages' | 'memories' | 'preferences' | 'full',
  data: unknown
): Promise<{
  success: boolean;
  synced?: number | { messages: number; memories: number };
  type: string;
  error?: string;
}> {
  return fetchJson(`${API_BASE}/sync`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, type, data }),
  });
}

/**
 * Sync memories from browser localStorage to server
 */
export async function syncMemoriesToServer(
  sessionId: string,
  memories: Array<{
    id: string;
    type: 'episodic' | 'semantic' | 'identity';
    content: string;
    importance: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>
): Promise<{
  success: boolean;
  synced: number;
  total: number;
}> {
  return fetchJson(`${API_BASE}/sync`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      type: 'memories',
      data: memories,
    }),
  });
}

/**
 * Detect emotions from webcam frame
 * @param image - Base64 encoded image (data URL or raw base64)
 */
export async function detectEmotion(image: string): Promise<EmotionDetectionResponse> {
  return fetchJson<EmotionDetectionResponse>(`${API_BASE}/emotion/detect`, {
    method: 'POST',
    body: JSON.stringify({ image }),
  });
}

/**
 * Get emotion detector status
 */
export async function getEmotionStatus(): Promise<EmotionStatusResponse> {
  return fetchJson<EmotionStatusResponse>(`${API_BASE}/emotion/status`);
}

/**
 * Reset emotion detection history
 */
export async function resetEmotionHistory(): Promise<{ success: boolean; message: string }> {
  return fetchJson<{ success: boolean; message: string }>(`${API_BASE}/emotion/reset`, {
    method: 'POST',
  });
}

/**
 * Vision emotion analysis response
 */
export interface VisionEmotionResponse {
  success: boolean;
  emotionContext: EmotionContext;
  sessionId: string;
  error?: string;
}

/**
 * Analyze a webcam frame for emotions using Claude Vision
 * This ONLY analyzes the image - it does NOT send a chat message.
 * The detected emotion is stored server-side and will automatically
 * influence subsequent chat messages.
 *
 * Flow:
 * 1. Call analyzeVisionEmotion() with webcam frame
 * 2. Emotion context is stored in session
 * 3. Call chat() or chatStream() - emotion context auto-injected
 *
 * @param sessionId - The session ID
 * @param imageDataUrl - Base64 data URL of the webcam frame (e.g., "data:image/jpeg;base64,...")
 * @returns The detected emotion context
 */
export async function analyzeVisionEmotion(
  sessionId: string,
  imageDataUrl: string
): Promise<VisionEmotionResponse> {
  const response = await fetch(`${API_BASE}/chat/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, imageDataUrl })
  });

  if (!response.ok) {
    // Handle rate limiting gracefully
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      console.log('[Vision] Rate limited, retry after:', data.retryAfter, 'seconds');
      throw new Error(`Rate limited: ${data.error || 'Too many requests'}`);
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Vision analysis failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * @deprecated Use analyzeVisionEmotion() instead. This function is kept for backward compatibility.
 * The new flow separates emotion analysis from chat - analyze emotion first, then chat normally.
 */
export async function chatWithVision(
  sessionId: string,
  _message: string,
  imageDataUrl: string,
  _emotionPrompt?: string
): Promise<VisionEmotionResponse> {
  console.warn('[API] chatWithVision is deprecated. Use analyzeVisionEmotion() instead.');
  return analyzeVisionEmotion(sessionId, imageDataUrl);
}
