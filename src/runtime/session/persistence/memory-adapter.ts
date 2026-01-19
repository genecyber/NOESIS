/**
 * InMemoryAdapter - In-memory session storage
 *
 * Default adapter that matches current server behavior.
 * Sessions are lost when the process exits.
 */

import { PersistenceAdapter, SessionListOptions } from './adapter.js';
import { SessionState, SessionInfo } from '../session.js';

export class InMemoryAdapter implements PersistenceAdapter {
  private sessions: Map<string, SessionState> = new Map();

  async save(state: SessionState): Promise<void> {
    this.sessions.set(state.id, { ...state });
  }

  async load(id: string): Promise<SessionState | null> {
    return this.sessions.get(id) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async list(options: SessionListOptions = {}): Promise<SessionInfo[]> {
    const { limit = 50, offset = 0, orderBy = 'lastActivity', orderDir = 'desc' } = options;

    const sessions = Array.from(this.sessions.values())
      .map(state => ({
        id: state.id,
        name: state.name,
        createdAt: new Date(state.createdAt),
        lastActivity: new Date(state.lastActivity),
        messageCount: state.messageCount,
        currentFrame: state.stance?.frame,
        currentDrift: state.stance?.cumulativeDrift,
        metadata: state.metadata
      }))
      .sort((a, b) => {
        const aVal = a[orderBy].getTime();
        const bVal = b[orderBy].getTime();
        return orderDir === 'desc' ? bVal - aVal : aVal - bVal;
      })
      .slice(offset, offset + limit);

    return sessions;
  }

  async exists(id: string): Promise<boolean> {
    return this.sessions.has(id);
  }

  async updateMetadata(id: string, updates: Partial<SessionState>): Promise<void> {
    const existing = this.sessions.get(id);
    if (existing) {
      this.sessions.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Clear all sessions (useful for testing)
   */
  clear(): void {
    this.sessions.clear();
  }

  /**
   * Get session count
   */
  get size(): number {
    return this.sessions.size;
  }
}
