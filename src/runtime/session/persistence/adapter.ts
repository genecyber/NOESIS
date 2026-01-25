/**
 * PersistenceAdapter - Interface for session storage backends
 *
 * Implementations:
 * - InMemoryAdapter (default, current behavior)
 * - SupabaseAdapter (future, for cloud persistence)
 *
 * Supports multi-tenant isolation via vaultId parameter.
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
  /** Vault ID for multi-tenant filtering */
  vaultId?: string;
}

/**
 * PersistenceAdapter interface
 */
export interface PersistenceAdapter {
  /**
   * Save a session state
   * @param state - Session state to save (should include vaultId for multitenancy)
   */
  save(state: SessionState): Promise<void>;

  /**
   * Load a session state by ID
   * @param id - Session ID
   * @param vaultId - Optional vault ID for access control (required in multitenancy mode)
   */
  load(id: string, vaultId?: string): Promise<SessionState | null>;

  /**
   * Delete a session by ID
   * @param id - Session ID
   * @param vaultId - Optional vault ID for access control (required in multitenancy mode)
   */
  delete(id: string, vaultId?: string): Promise<boolean>;

  /**
   * List all session infos (lightweight metadata only)
   * When vaultId is provided, only returns sessions belonging to that vault
   */
  list(options?: SessionListOptions): Promise<SessionInfo[]>;

  /**
   * Check if a session exists
   * @param id - Session ID
   * @param vaultId - Optional vault ID for access control
   */
  exists(id: string, vaultId?: string): Promise<boolean>;

  /**
   * Update session metadata without replacing entire state
   * @param id - Session ID
   * @param updates - Partial state updates
   * @param vaultId - Optional vault ID for access control (required in multitenancy mode)
   */
  updateMetadata(id: string, updates: Partial<SessionState>, vaultId?: string): Promise<void>;
}

// Re-export types for convenience
export type { SessionState, SessionInfo } from '../session.js';
