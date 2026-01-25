/**
 * SQLiteAdapter - SQLite-based session persistence
 *
 * Stores full session state in SQLite for persistence across restarts.
 * Uses the same database file as MemoryStore for consistency.
 * Supports multi-tenant isolation via vault_id column.
 */

import Database from 'better-sqlite3';
import { PersistenceAdapter, SessionListOptions } from './adapter.js';
import { SessionState, SessionInfo } from '../session.js';

/** Default vault ID for backward compatibility */
const DEFAULT_VAULT_ID = 'default-vault';

export interface SQLiteAdapterOptions {
  dbPath?: string;
  /** Default vault ID for sessions without explicit vault */
  defaultVaultId?: string;
}

export class SQLiteAdapter implements PersistenceAdapter {
  private db: Database.Database;
  private initialized = false;
  private defaultVaultId: string;

  constructor(options: SQLiteAdapterOptions = {}) {
    const dbPath = options.dbPath || './data/metamorph.db';
    this.db = new Database(dbPath);
    this.defaultVaultId = options.defaultVaultId || DEFAULT_VAULT_ID;
    this.ensureTable();
  }

  /**
   * Ensure the session_states table exists with full state storage
   * Includes vault_id for multi-tenant isolation
   */
  private ensureTable(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_states (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        name TEXT,
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        stance TEXT NOT NULL,
        config TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        metadata TEXT
      )
    `);

    // Create index for faster listing by vault
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_states_vault_activity
      ON session_states(vault_id, last_activity DESC)
    `);

    // Create index for faster listing
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_states_last_activity
      ON session_states(last_activity DESC)
    `);

    // Migration: Add vault_id column if it doesn't exist (for existing databases)
    this.migrateVaultId();

    this.initialized = true;
    console.log('[SQLiteAdapter] Session persistence initialized with vault support');
  }

  /**
   * Migrate existing sessions to have vault_id column
   * This handles upgrades from pre-multitenancy databases
   */
  private migrateVaultId(): void {
    try {
      // Check if vault_id column exists
      const tableInfo = this.db.prepare('PRAGMA table_info(session_states)').all() as Array<{ name: string }>;
      const hasVaultId = tableInfo.some(col => col.name === 'vault_id');

      if (!hasVaultId) {
        console.log('[SQLiteAdapter] Migrating: adding vault_id column...');
        this.db.exec(`ALTER TABLE session_states ADD COLUMN vault_id TEXT NOT NULL DEFAULT 'default-vault'`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_session_states_vault_activity ON session_states(vault_id, last_activity DESC)`);
        console.log('[SQLiteAdapter] Migration complete: vault_id column added');
      }
    } catch {
      // Table might not exist yet, which is fine
      console.log('[SQLiteAdapter] Migration check skipped (table may be new)');
    }
  }

  /**
   * Save a session state with vault_id
   * The vaultId is taken from state.vaultId or falls back to defaultVaultId
   */
  async save(state: SessionState): Promise<void> {
    const vaultId = state.vaultId || this.defaultVaultId;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_states
      (id, vault_id, name, created_at, last_activity, stance, config, message_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      state.id,
      vaultId,
      state.name || null,
      state.createdAt,
      state.lastActivity,
      JSON.stringify(state.stance),
      JSON.stringify(state.config),
      state.messageCount,
      state.metadata ? JSON.stringify(state.metadata) : null
    );
  }

  /**
   * Load a session state by ID with vault scoping
   * @param id - Session ID
   * @param vaultId - If provided, ensures session belongs to this vault
   */
  async load(id: string, vaultId?: string): Promise<SessionState | null> {
    const effectiveVaultId = vaultId || this.defaultVaultId;

    // Query with vault_id filter for access control
    const row = this.db.prepare(`
      SELECT id, vault_id, name, created_at, last_activity, stance, config, message_count, metadata
      FROM session_states
      WHERE id = ? AND vault_id = ?
    `).get(id, effectiveVaultId) as {
      id: string;
      vault_id: string;
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
      vaultId: row.vault_id,
      name: row.name || undefined,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      stance: JSON.parse(row.stance),
      config: JSON.parse(row.config),
      messageCount: row.message_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * Delete a session by ID with vault scoping
   * Only deletes if session belongs to the specified vault
   */
  async delete(id: string, vaultId?: string): Promise<boolean> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const result = this.db.prepare(
      'DELETE FROM session_states WHERE id = ? AND vault_id = ?'
    ).run(id, effectiveVaultId);
    return result.changes > 0;
  }

  /**
   * List sessions with optional vault filtering
   * When vaultId is provided, only returns sessions from that vault
   */
  async list(options: SessionListOptions = {}): Promise<SessionInfo[]> {
    const { limit = 50, offset = 0, orderBy = 'lastActivity', orderDir = 'desc', vaultId } = options;
    const effectiveVaultId = vaultId || this.defaultVaultId;

    // Map interface field names to database column names
    const columnMap: Record<string, string> = {
      lastActivity: 'last_activity',
      createdAt: 'created_at'
    };
    const orderColumn = columnMap[orderBy] || 'last_activity';
    const direction = orderDir.toUpperCase();

    // Always filter by vault_id for proper tenant isolation
    const rows = this.db.prepare(`
      SELECT id, vault_id, name, created_at, last_activity, stance, message_count, metadata
      FROM session_states
      WHERE vault_id = ?
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `).all(effectiveVaultId, limit, offset) as Array<{
      id: string;
      vault_id: string;
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
        vaultId: row.vault_id,
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

  /**
   * Check if a session exists (with vault scoping)
   */
  async exists(id: string, vaultId?: string): Promise<boolean> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const row = this.db.prepare(
      'SELECT 1 FROM session_states WHERE id = ? AND vault_id = ?'
    ).get(id, effectiveVaultId);
    return !!row;
  }

  /**
   * Update session metadata with vault scoping
   */
  async updateMetadata(id: string, updates: Partial<SessionState>, vaultId?: string): Promise<void> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const existing = await this.load(id, effectiveVaultId);
    if (existing) {
      // Preserve vaultId when updating
      await this.save({ ...existing, ...updates, vaultId: effectiveVaultId });
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get session count for a vault
   * @param vaultId - If provided, counts only sessions in that vault
   */
  async count(vaultId?: string): Promise<number> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM session_states WHERE vault_id = ?'
    ).get(effectiveVaultId) as { count: number };
    return row.count;
  }

  /**
   * Get total session count across all vaults (admin only)
   */
  async countAll(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM session_states').get() as { count: number };
    return row.count;
  }

  /**
   * Clear sessions for a specific vault
   * @param vaultId - If provided, clears only that vault's sessions
   */
  async clear(vaultId?: string): Promise<void> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    this.db.prepare('DELETE FROM session_states WHERE vault_id = ?').run(effectiveVaultId);
  }

  /**
   * Clear all sessions across all vaults (admin/testing only)
   */
  async clearAll(): Promise<void> {
    this.db.exec('DELETE FROM session_states');
  }

  /**
   * List sessions without vault filtering (admin only)
   * Returns sessions from all vaults
   */
  async listAll(options: Omit<SessionListOptions, 'vaultId'> = {}): Promise<SessionInfo[]> {
    const { limit = 50, offset = 0, orderBy = 'lastActivity', orderDir = 'desc' } = options;

    const columnMap: Record<string, string> = {
      lastActivity: 'last_activity',
      createdAt: 'created_at'
    };
    const orderColumn = columnMap[orderBy] || 'last_activity';
    const direction = orderDir.toUpperCase();

    const rows = this.db.prepare(`
      SELECT id, vault_id, name, created_at, last_activity, stance, message_count, metadata
      FROM session_states
      ORDER BY ${orderColumn} ${direction}
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Array<{
      id: string;
      vault_id: string;
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
        vaultId: row.vault_id,
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
}
