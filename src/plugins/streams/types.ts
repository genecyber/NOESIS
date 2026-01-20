import type { JSONSchema7 } from 'json-schema';

// Channel naming convention: {sessionId}:{identifier}:{type}
// Examples: "user-123:proc-456:stdout", "user-123:monitor:cpu"

export interface StreamInfo {
  channel: string;
  sessionId: string;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount: number;
  schema?: JSONSchema7;
  metadata?: Record<string, unknown>;
}

export interface StreamEvent {
  id: string;
  timestamp: Date;
  data: unknown;
  source?: string;  // PID or identifier
}

export interface StreamConnection {
  id: string;
  sessionId: string;
  subscribedChannels: Set<string>;
  role: 'publisher' | 'subscriber' | 'both';
}

// WebSocket Protocol Messages
export type ClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'publish'; channel: string; event: Omit<StreamEvent, 'id' | 'timestamp'> }
  | { type: 'create_stream'; channel: string; schema?: JSONSchema7; metadata?: Record<string, unknown> }
  | { type: 'close_stream'; channel: string }
  | { type: 'list_streams'; sessionId?: string }
  | { type: 'get_history'; channel: string; limit?: number };

export type ServerMessage =
  | { type: 'event'; channel: string; event: StreamEvent }
  | { type: 'stream_created'; channel: string; info: StreamInfo }
  | { type: 'stream_closed'; channel: string }
  | { type: 'stream_list'; streams: StreamInfo[] }
  | { type: 'history'; channel: string; events: StreamEvent[] }
  | { type: 'subscribed'; channel: string }
  | { type: 'unsubscribed'; channel: string }
  | { type: 'error'; code: string; message: string };

// Stream Manager Events (for internal plugin event bus)
export interface StreamCreatedEvent {
  channel: string;
  sessionId: string;
  info: StreamInfo;
}

export interface StreamEventPublished {
  channel: string;
  event: StreamEvent;
}

export interface StreamClosedEvent {
  channel: string;
  reason?: string;
}

// Configuration
export interface StreamManagerConfig {
  maxHistoryPerStream?: number;  // Default: 1000
  maxStreamsPerSession?: number; // Default: 50
  eventTTLMs?: number;           // Default: 1 hour
}

// Schema validation result
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
