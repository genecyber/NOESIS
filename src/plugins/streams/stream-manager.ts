import { EventEmitter } from 'events';
import Ajv from 'ajv';
import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import type {
  StreamInfo,
  StreamEvent,
  StreamManagerConfig,
  ValidationResult,
} from './types.js';
import type { JSONSchema7 } from 'json-schema';

const DEFAULT_CONFIG: Required<StreamManagerConfig> = {
  maxHistoryPerStream: 1000,
  maxStreamsPerSession: 50,
  eventTTLMs: 60 * 60 * 1000, // 1 hour
};

export class StreamManager extends EventEmitter {
  private streams = new Map<string, StreamInfo>();
  private history = new Map<string, StreamEvent[]>();
  private subscribers = new Map<string, Set<WebSocket>>();
  private schemas = new Map<string, JSONSchema7>();
  private ajv = new Ajv();
  private config: Required<StreamManagerConfig>;

  constructor(config?: StreamManagerConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Create or get a stream (auto-creates on first event)
  createStream(channel: string, sessionId: string, schema?: JSONSchema7, metadata?: Record<string, unknown>): StreamInfo {
    // Check session limit
    const sessionStreams = this.listStreams(sessionId);
    if (sessionStreams.length >= this.config.maxStreamsPerSession) {
      throw new Error(`Session ${sessionId} has reached max streams limit`);
    }

    const info: StreamInfo = {
      channel,
      sessionId,
      createdAt: new Date(),
      eventCount: 0,
      schema,
      metadata,
    };

    this.streams.set(channel, info);
    this.history.set(channel, []);
    this.subscribers.set(channel, new Set());

    if (schema) {
      this.schemas.set(channel, schema);
    }

    this.emit('stream:created', { channel, sessionId, info });
    return info;
  }

  // Publish an event to a stream
  publishEvent(channel: string, data: unknown, source?: string): StreamEvent | null {
    // Auto-create stream if it doesn't exist
    let streamInfo = this.streams.get(channel);
    if (!streamInfo) {
      // Extract sessionId from channel (format: sessionId:identifier:type)
      const sessionId = channel.split(':')[0] || 'default';
      streamInfo = this.createStream(channel, sessionId);
    }

    // Validate against schema if exists
    if (this.schemas.has(channel)) {
      const validation = this.validateEvent(channel, data);
      if (!validation.valid) {
        this.emit('stream:validation_error', { channel, errors: validation.errors });
        return null;
      }
    }

    const event: StreamEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      data,
      source,
    };

    // Update stream info
    streamInfo.eventCount++;
    streamInfo.lastEventAt = event.timestamp;

    // Store in history
    const channelHistory = this.history.get(channel)!;
    channelHistory.push(event);

    // Trim history if needed
    while (channelHistory.length > this.config.maxHistoryPerStream) {
      channelHistory.shift();
    }

    // Broadcast to subscribers
    const subs = this.subscribers.get(channel);
    if (subs) {
      const message = JSON.stringify({ type: 'event', channel, event });
      for (const ws of subs) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      }
    }

    this.emit('stream:event', { channel, event });
    return event;
  }

  // Subscribe a WebSocket to a channel
  subscribe(channel: string, ws: WebSocket): boolean {
    if (!this.streams.has(channel)) {
      return false;
    }

    const subs = this.subscribers.get(channel);
    if (subs) {
      subs.add(ws);
      return true;
    }
    return false;
  }

  // Unsubscribe a WebSocket from a channel
  unsubscribe(channel: string, ws: WebSocket): void {
    const subs = this.subscribers.get(channel);
    if (subs) {
      subs.delete(ws);
    }
  }

  // Unsubscribe from all channels (cleanup on disconnect)
  unsubscribeAll(ws: WebSocket): void {
    for (const subs of this.subscribers.values()) {
      subs.delete(ws);
    }
  }

  // List streams, optionally filtered by session
  listStreams(sessionId?: string): StreamInfo[] {
    const streams = Array.from(this.streams.values());
    if (sessionId) {
      return streams.filter(s => s.sessionId === sessionId);
    }
    return streams;
  }

  // Get stream info
  getStream(channel: string): StreamInfo | undefined {
    return this.streams.get(channel);
  }

  // Get event history for a channel
  getHistory(channel: string, limit?: number): StreamEvent[] {
    const history = this.history.get(channel) || [];
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    return [...history];
  }

  // Set or update schema for a stream
  setSchema(channel: string, schema: JSONSchema7): void {
    this.schemas.set(channel, schema);
    const streamInfo = this.streams.get(channel);
    if (streamInfo) {
      streamInfo.schema = schema;
    }
  }

  // Get schema for a stream
  getSchema(channel: string): JSONSchema7 | undefined {
    return this.schemas.get(channel);
  }

  // Validate an event against the stream's schema
  validateEvent(channel: string, data: unknown): ValidationResult {
    const schema = this.schemas.get(channel);
    if (!schema) {
      return { valid: true };
    }

    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (!valid && validate.errors) {
      return {
        valid: false,
        errors: validate.errors.map(e => `${e.instancePath} ${e.message}`),
      };
    }
    return { valid: true };
  }

  // Close a stream
  closeStream(channel: string, reason?: string): void {
    const streamInfo = this.streams.get(channel);
    if (!streamInfo) return;

    // Notify subscribers
    const subs = this.subscribers.get(channel);
    if (subs) {
      const message = JSON.stringify({ type: 'stream_closed', channel });
      for (const ws of subs) {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      }
    }

    // Cleanup
    this.streams.delete(channel);
    this.history.delete(channel);
    this.subscribers.delete(channel);
    this.schemas.delete(channel);

    this.emit('stream:closed', { channel, reason });
  }

  // Cleanup expired events
  pruneExpired(): void {
    const now = Date.now();
    const cutoff = now - this.config.eventTTLMs;

    for (const [channel, events] of this.history) {
      const filtered = events.filter(e => e.timestamp.getTime() > cutoff);
      this.history.set(channel, filtered);
    }
  }
}

// Singleton instance
export const streamManager = new StreamManager();
