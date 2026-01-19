/**
 * Persistence module exports
 */

export type {
  PersistenceAdapter,
  SessionListOptions,
} from './adapter.js';

export { InMemoryAdapter } from './memory-adapter.js';

// Re-export session types for convenience
export type { SessionState, SessionInfo } from './adapter.js';
