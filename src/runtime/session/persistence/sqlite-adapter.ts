/**
 * SQLiteAdapter - SQLite-based session persistence
 *
 * Stores full session state in SQLite for persistence across restarts.
 * Uses the same database file as MemoryStore for consistency.
 */

import Database from 'better-sqlite3';
import { PersistenceAdapter, SessionListOptions } from './adapter.js';
import { SessionState, SessionInfo } from '../session.js';

export interface SQLiteAdapterOptions {
  dbPath?: string;
}

export class SQLiteAdapter implements PersistenceAdapter {
  private db: Database.Database;
  private initialized = false;

  constructor(options: SQLiteAdapterOptions = {}) {
    const dbPath = options.dbPath || './data/metamorph.db';
    this.db = new Database(dbPath);
    this.ensureTable();
  }

  /**
   * Ensure the session_states table exists with full state storage
   */
  private ensureTable(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_states (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        stance TEXT NOT NULL,
        config TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        metadata TEXT
      )
    `);

    // Create index for faster listing
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_states_last_activity
      ON session_states(last_activity DESC)
    `);

    this.initialized = true;
    console.log('[SQLiteAdapter] Session persistence initialized');
  }

  async save(state: SessionState): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_states
      (id, name, created_at, last_activity, stance, config, message_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      state.id,
      state.name || null,
      state.createdAt,
      state.lastActivity,
      JSON.stringify(state.stance),
      JSON.stringify(state.config),
      state.messageCount,
      state.metadata ? JSON.stringify(state.metadata) : null
    );
  }

  async load(id: string): Promise<SessionState | null> {
    const row = this.db.prepare(`
      SELECT id, name, created_at, last_activity, stance, config, message_count, metadata
      FROM session_states
      WHERE id = ?
    `).get(id) as {
      id: string;
      name: string | null;
      created_at: string;
      last_activity: string;
      stance: string;
      config: string;
      message_count: number;
      metadata: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name || undefined,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      stance: JSON.parse(row.stance),
      config: JSON.parse(row.config),
      messageCount: row.message_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM session_states WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async list(options: SessionListOptions = {}): Promise<SessionInfo[]> {
    const { limit = 50, offset = 0, orderBy = 'lastActivity', orderDir = 'desc' } = options;

    // Map interface field names to database column names
    const columnMap: Record<string, string> = {
      lastActivity: 'last_activity',
      createdAt: 'created_at'
    };
    const orderColumn = columnMap[orderBy] || 'last_activity';
    const direction = orderDir.toUpperCase();

    const rows = this.db.prepare(`
      SELECT id, name, created_at, last_activity, stance, message_count, metadata
      FROM session_states
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Array<{
      id: string;
      name: string | null;
      created_at: string;
      last_activity: string;
      stance: string;
      message_count: number;
      metadata: string | null;
    }>;

    return rows.map(row => {
      const stance = JSON.parse(row.stance);
      return {
        id: row.id,
        name: row.name || undefined,
        createdAt: new Date(row.created_at),
        lastActivity: new Date(row.last_activity),
        messageCount: row.message_count,
        currentFrame: stance?.frame,
        currentDrift: stance?.cumulativeDrift,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    });
  }

  async exists(id: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM session_states WHERE id = ?').get(id);
    return !!row;
  }

  async updateMetadata(id: string, updates: Partial<SessionState>): Promise<void> {
    const existing = await this.load(id);
    if (existing) {
      await this.save({ ...existing, ...updates });
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get session count
   */
  async count(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM session_states').get() as { count: number };
    return row.count;
  }

  /**
   * Clear all sessions (useful for testing)
   */
  async clear(): Promise<void> {
    this.db.exec('DELETE FROM session_states');
  }
}
