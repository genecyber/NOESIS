/**
 * PersistenceAdapter - Interface for session storage backends
 *
 * Implementations:
 * - InMemoryAdapter (default, current behavior)
 * - SupabaseAdapter (future, for cloud persistence)
 */

import { SessionState, SessionInfo } from '../session.js';

/**
 * Query options for listing sessions
 */
export interface SessionListOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'lastActivity';
  orderDir?: 'asc' | 'desc';
}

/**
 * PersistenceAdapter interface
 */
export interface PersistenceAdapter {
  /**
   * Save a session state
   */
  save(state: SessionState): Promise<void>;

  /**
   * Load a session state by ID
   */
  load(id: string): Promise<SessionState | null>;

  /**
   * Delete a session by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * List all session infos (lightweight metadata only)
   */
  list(options?: SessionListOptions): Promise<SessionInfo[]>;

  /**
   * Check if a session exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Update session metadata without replacing entire state
   */
  updateMetadata(id: string, updates: Partial<SessionState>): Promise<void>;
}

// Re-export types for convenience
export type { SessionState, SessionInfo } from '../session.js';
