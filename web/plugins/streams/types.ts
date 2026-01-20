/**
 * Types for the Streams Web Plugin
 *
 * Frontend-specific stream types for real-time data visualization.
 */

// =============================================================================
// Mirror of Backend Types for WebSocket Protocol
// =============================================================================

/** Information about a stream channel */
export interface StreamInfo {
  /** Channel name/identifier */
  channel: string;
  /** Session ID this stream belongs to */
  sessionId: string;
  /** When the stream was created (ISO date string) */
  createdAt: string;
  /** When the last event was received (ISO date string) */
  lastEventAt?: string;
  /** Total number of events in this stream */
  eventCount: number;
  /** JSON schema for event data validation */
  schema?: Record<string, unknown>;
  /** Additional metadata about the stream */
  metadata?: Record<string, unknown>;
}

/** A single event in a stream */
export interface StreamEvent {
  /** Unique event identifier */
  id: string;
  /** When the event occurred (ISO date string) */
  timestamp: string;
  /** Event payload data */
  data: unknown;
  /** Source of the event (e.g., plugin name, user) */
  source?: string;
}

// =============================================================================
// WebSocket Message Types (Client -> Server)
// =============================================================================

/** Messages sent from the client to the server */
export type ClientMessage =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'publish'; channel: string; event: { data: unknown; source?: string } }
  | { type: 'create_stream'; channel: string; schema?: Record<string, unknown>; metadata?: Record<string, unknown> }
  | { type: 'close_stream'; channel: string }
  | { type: 'list_streams'; sessionId?: string }
  | { type: 'get_history'; channel: string; limit?: number };

// =============================================================================
// WebSocket Message Types (Server -> Client)
// =============================================================================

/** Messages sent from the server to the client */
export type ServerMessage =
  | { type: 'event'; channel: string; event: StreamEvent }
  | { type: 'stream_created'; channel: string; info: StreamInfo }
  | { type: 'stream_closed'; channel: string }
  | { type: 'stream_list'; streams: StreamInfo[] }
  | { type: 'history'; channel: string; events: StreamEvent[] }
  | { type: 'subscribed'; channel: string }
  | { type: 'unsubscribed'; channel: string }
  | { type: 'error'; code: string; message: string };

// =============================================================================
// Panel State
// =============================================================================

/** State for the streams panel UI */
export interface StreamsPanelState {
  /** Currently selected stream channel */
  selectedStream: string | null;
  /** Current view mode */
  viewMode: 'list' | 'viewer';
  /** Auto-scroll to new events */
  autoScroll: boolean;
  /** Show timestamps in event list */
  showTimestamps: boolean;
  /** Maximum events to keep in memory */
  maxEvents: number;
  /** Filter text for event content */
  filterText: string;
}

// =============================================================================
// Hook Return Types
// =============================================================================

/** Return type for useStreamSubscription hook */
export interface UseStreamSubscriptionReturn {
  /** Events received from the subscribed stream */
  events: StreamEvent[];
  /** Whether WebSocket is connected */
  connected: boolean;
  /** Error message if any */
  error: string | null;
  /** Clear all events from memory */
  clear: () => void;
  /** Subscribe to a channel */
  subscribe: (channel: string) => void;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
}

/** Return type for useStreamList hook */
export interface UseStreamListReturn {
  /** List of available streams */
  streams: StreamInfo[];
  /** Whether the list is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the stream list */
  refresh: () => void;
}

// =============================================================================
// Custom Viewer Types
// =============================================================================

/** Custom viewer for specific stream channels */
export interface CustomViewer {
  /** Channel this viewer is for */
  channel: string;
  /** HTML content for the viewer */
  html: string;
  /** Optional title for the viewer */
  title?: string;
}

// =============================================================================
// Default Panel State
// =============================================================================

/** Default panel state for streams plugin */
export const defaultStreamsPanelState: StreamsPanelState = {
  selectedStream: null,
  viewMode: 'list',
  autoScroll: true,
  showTimestamps: true,
  maxEvents: 1000,
  filterText: '',
};
