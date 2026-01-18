import type {
  Stance,
  ModeConfig,
  AgentState,
  ChatResponse,
  SessionResponse,
  SubagentDefinition
} from './types';

const API_BASE = '/api';

export class ApiClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.apiKey) {
      (headers as Record<string, string>)['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Create a new session
  async createSession(config?: Partial<ModeConfig>): Promise<SessionResponse> {
    return this.fetch<SessionResponse>('/session', {
      method: 'POST',
      body: JSON.stringify({ config })
    });
  }

  // Send a chat message
  async chat(sessionId: string, message: string): Promise<ChatResponse> {
    return this.fetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message })
    });
  }

  // Stream a chat message (returns EventSource)
  chatStream(
    sessionId: string,
    message: string,
    callbacks: {
      onText?: (text: string) => void;
      onTool?: (tool: string) => void;
      onSubagent?: (name: string, status: string) => void;
      onComplete?: (data: Partial<ChatResponse>) => void;
      onError?: (error: string) => void;
    }
  ): () => void {
    const url = `${API_BASE}/chat/stream?message=${encodeURIComponent(message)}&sessionId=${sessionId}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('text', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onText?.(data.text);
    });

    eventSource.addEventListener('tool', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onTool?.(data.tool);
    });

    eventSource.addEventListener('subagent', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onSubagent?.(data.name, data.status);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onComplete?.(data);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      if ((e as MessageEvent).data) {
        const data = JSON.parse((e as MessageEvent).data);
        callbacks.onError?.(data.error);
      } else {
        callbacks.onError?.('Connection error');
      }
      eventSource.close();
    });

    // Return cleanup function
    return () => eventSource.close();
  }

  // Get current state
  async getState(sessionId: string): Promise<AgentState> {
    return this.fetch<AgentState>(`/state?sessionId=${sessionId}`);
  }

  // Update configuration
  async updateConfig(
    sessionId: string,
    config: Partial<ModeConfig>
  ): Promise<{ success: boolean; config: ModeConfig }> {
    return this.fetch('/config', {
      method: 'PUT',
      body: JSON.stringify({ sessionId, config })
    });
  }

  // Get available subagents
  async getSubagents(sessionId: string): Promise<{ subagents: SubagentDefinition[] }> {
    return this.fetch(`/subagents?sessionId=${sessionId}`);
  }

  // Invoke a subagent
  async invokeSubagent(
    sessionId: string,
    name: string,
    task: string
  ): Promise<{ response: string; toolsUsed: string[]; subagent: string }> {
    return this.fetch(`/subagents/${name}`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, task })
    });
  }

  // Get conversation history
  async getHistory(
    sessionId: string,
    limit = 50,
    offset = 0
  ): Promise<{
    total: number;
    limit: number;
    offset: number;
    messages: Array<{
      role: string;
      content: string;
      timestamp: string;
      toolsUsed?: string[];
    }>;
  }> {
    return this.fetch(`/history?sessionId=${sessionId}&limit=${limit}&offset=${offset}`);
  }

  // Export session state
  async exportState(sessionId: string): Promise<{ state: object }> {
    return this.fetch(`/export?sessionId=${sessionId}`);
  }

  // Import session state
  async importState(state: object): Promise<{ success: boolean; sessionId: string }> {
    return this.fetch('/import', {
      method: 'POST',
      body: JSON.stringify({ state })
    });
  }
}
