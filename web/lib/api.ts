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
} from './types';

const API_BASE = '/api';

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
 */
export function chatStream(
  sessionId: string | undefined,
  message: string,
  callbacks: {
    onText?: (text: string) => void;
    onComplete?: (data: ChatResponse) => void;
    onError?: (error: Error) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
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

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'text' && callbacks.onText) {
                callbacks.onText(parsed.content);
              } else if (parsed.type === 'complete' && callbacks.onComplete) {
                callbacks.onComplete(parsed.data);
              } else if (parsed.type === 'error' && callbacks.onError) {
                callbacks.onError(new Error(parsed.error));
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
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
