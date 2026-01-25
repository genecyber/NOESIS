/**
 * SessionManager - Manages session lifecycle
 *
 * Handles creation, retrieval, and deletion of sessions.
 * Uses SQLite for persistence by default to ensure data survives restarts.
 * Supports multi-tenant isolation via vault IDs.
 */

import { v4 as uuidv4 } from 'uuid';
import { MetamorphAgent } from '../../agent/index.js';
import { ModeConfig } from '../../types/index.js';
import { Session, SessionInfo, CreateSessionOptions, SessionState } from './session.js';
import { PersistenceAdapter } from './persistence/adapter.js';
import { SQLiteAdapter } from './persistence/sqlite-adapter.js';
import { isMultitenancyEnabled, getDefaultVaultId } from '../../server/middleware/auth.js';

export interface SessionManagerOptions {
  persistence?: PersistenceAdapter;
  defaultConfig?: Partial<ModeConfig>;
  dbPath?: string;  // Path to SQLite database
  /** Default vault ID for sessions (multitenancy) */
  defaultVaultId?: string;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistence: PersistenceAdapter;
  private defaultConfig: Partial<ModeConfig>;
  private dbPath: string;
  private defaultVaultId: string;

  constructor(options: SessionManagerOptions = {}) {
    this.dbPath = options.dbPath || './data/metamorph.db';
    this.persistence = options.persistence ?? new SQLiteAdapter({ dbPath: this.dbPath });
    this.defaultConfig = options.defaultConfig ?? {};
    this.defaultVaultId = options.defaultVaultId || getDefaultVaultId();
    console.log(`[SessionManager] Using SQLite persistence: ${this.dbPath}`);
    if (isMultitenancyEnabled()) {
      console.log(`[SessionManager] Multitenancy enabled, default vault: ${this.defaultVaultId}`);
    }
  }

  /**
   * Generate a scoped session key for Map storage
   * Format: "vaultId:sessionId" for unique keys across tenants
   */
  private sessionKey(sessionId: string, vaultId?: string): string {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    return isMultitenancyEnabled() ? `${effectiveVaultId}:${sessionId}` : sessionId;
  }

  /**
   * Get a scoped session manager for a specific vault
   * Returns a wrapper that pre-fills vaultId for all operations
   */
  forVault(vaultId: string): ScopedSessionManager {
    return new ScopedSessionManager(this, vaultId);
  }

  /**
   * Load a session from persistence by ID
   * Creates a new agent and restores its state
   */
  async loadSession(id: string, vaultId?: string): Promise<Session | null> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const key = this.sessionKey(id, effectiveVaultId);

    // Check if already loaded in memory
    const existing = this.sessions.get(key);
    if (existing) return existing;

    // Try to load from persistence
    const state = await this.persistence.load(id, effectiveVaultId);
    if (!state) return null;

    // Verify vault ownership in multitenancy mode
    if (isMultitenancyEnabled() && state.vaultId && state.vaultId !== effectiveVaultId) {
      console.warn(`[SessionManager] Access denied: session ${id} belongs to vault ${state.vaultId}, not ${effectiveVaultId}`);
      return null;
    }

    // Create agent with restored config and vault scoping
    // Pass vaultId so memory store, operator learning, and metrics are vault-isolated
    const agent = new MetamorphAgent({
      config: state.config,
      dbPath: this.dbPath,
      vaultId: effectiveVaultId  // Enable vault-scoped database operations
    });

    // Restore stance if possible
    // Note: Full conversation history is in the MemoryStore

    const session: Session = {
      id: state.id,
      agent,
      createdAt: new Date(state.createdAt),
      lastActivity: new Date(state.lastActivity),
      name: state.name,
      metadata: state.metadata,
      vaultId: effectiveVaultId
    };

    this.sessions.set(key, session);
    console.log(`[SessionManager] Loaded session from persistence: ${id} (vault: ${effectiveVaultId})`);
    return session;
  }

  /**
   * Load all sessions from persistence
   * In multitenancy mode, only loads sessions for the specified vault
   */
  async loadAllSessions(vaultId?: string): Promise<void> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const sessionInfos = await this.persistence.list({ limit: 1000, vaultId: effectiveVaultId });
    console.log(`[SessionManager] Loading ${sessionInfos.length} sessions from persistence...`);

    for (const info of sessionInfos) {
      await this.loadSession(info.id, info.vaultId || effectiveVaultId);
    }

    console.log(`[SessionManager] Loaded ${this.sessions.size} sessions`);
  }

  /**
   * Create a new session and persist it
   */
  createSession(options: CreateSessionOptions = {}): Session {
    const id = options.id ?? uuidv4();
    const effectiveVaultId = options.vaultId || this.defaultVaultId;
    const key = this.sessionKey(id, effectiveVaultId);
    const now = new Date();

    // Create agent with config and vault scoping
    // Pass vaultId so memory store, operator learning, and metrics are vault-isolated
    const agent = new MetamorphAgent({
      config: { ...this.defaultConfig, ...options.config },
      dbPath: this.dbPath,
      vaultId: effectiveVaultId  // Enable vault-scoped database operations
    });

    const session: Session = {
      id,
      agent,
      createdAt: now,
      lastActivity: now,
      name: options.name,
      metadata: options.metadata,
      vaultId: effectiveVaultId
    };

    this.sessions.set(key, session);

    // Save to persistence immediately
    this.saveSession(session).catch(err => {
      console.error(`[SessionManager] Failed to persist session ${id}:`, err);
    });

    return session;
  }

  /**
   * Get existing session by ID with vault scoping
   * @param id - Session ID
   * @param vaultId - Optional vault ID for access control
   */
  getSession(id: string, vaultId?: string): Session | undefined {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const key = this.sessionKey(id, effectiveVaultId);
    const session = this.sessions.get(key);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  /**
   * Get existing session or create new one with vault scoping
   * Checks memory first, then persistence, then creates new
   */
  getOrCreate(id?: string, options: CreateSessionOptions = {}): Session {
    const effectiveVaultId = options.vaultId || this.defaultVaultId;
    if (id) {
      // Check memory first
      const existing = this.getSession(id, effectiveVaultId);
      if (existing) return existing;

      // Note: For sync usage, we can't await loadSession
      // The caller should use getOrCreateAsync for persistence-aware loading
    }
    return this.createSession({ ...options, id, vaultId: effectiveVaultId });
  }

  /**
   * Async version that checks persistence before creating
   * Respects vault isolation
   */
  async getOrCreateAsync(id?: string, options: CreateSessionOptions = {}): Promise<Session> {
    const effectiveVaultId = options.vaultId || this.defaultVaultId;
    if (id) {
      // Check memory first
      const existing = this.getSession(id, effectiveVaultId);
      if (existing) return existing;

      // Try loading from persistence (with vault scoping)
      const loaded = await this.loadSession(id, effectiveVaultId);
      if (loaded) return loaded;
    }
    return this.createSession({ ...options, id, vaultId: effectiveVaultId });
  }

  /**
   * Delete a session from memory and persistence with vault scoping
   * Only deletes if the session belongs to the specified vault
   */
  deleteSession(id: string, vaultId?: string): boolean {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const key = this.sessionKey(id, effectiveVaultId);
    const deleted = this.sessions.delete(key);

    // Also delete from persistence (with vault scoping)
    this.persistence.delete(id, effectiveVaultId).catch(err => {
      console.error(`[SessionManager] Failed to delete session ${id} from persistence:`, err);
    });

    return deleted;
  }

  /**
   * List all sessions (lightweight info) from memory for a specific vault
   * For full list including persisted sessions, use listSessionsAsync
   */
  listSessions(vaultId?: string): SessionInfo[] {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    return Array.from(this.sessions.values())
      .filter(session => session.vaultId === effectiveVaultId)
      .map(session => ({
        id: session.id,
        vaultId: session.vaultId,
        name: session.name,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.agent.getHistory().length,
        currentFrame: session.agent.getCurrentStance().frame,
        currentDrift: session.agent.getCurrentStance().cumulativeDrift,
        metadata: session.metadata
      }));
  }

  /**
   * List all sessions from persistence for a specific vault (includes ones not in memory)
   */
  async listSessionsAsync(vaultId?: string): Promise<SessionInfo[]> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    return this.persistence.list({ limit: 1000, vaultId: effectiveVaultId });
  }

  /**
   * Get session count for a specific vault
   */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session count for a specific vault
   */
  getSessionCount(vaultId?: string): number {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    return Array.from(this.sessions.values())
      .filter(session => session.vaultId === effectiveVaultId)
      .length;
  }

  /**
   * Save session state to persistence (includes vaultId)
   */
  async saveSession(session: Session): Promise<void> {
    const state: SessionState = {
      id: session.id,
      vaultId: session.vaultId || this.defaultVaultId,
      name: session.name,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      stance: session.agent.getCurrentStance(),
      config: session.agent.getConfig(),
      messageCount: session.agent.getHistory().length,
      metadata: session.metadata
    };
    await this.persistence.save(state);
  }

  /**
   * Persist all sessions (for a specific vault or all)
   */
  async persistAll(vaultId?: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!vaultId || session.vaultId === vaultId) {
        await this.saveSession(session);
      }
    }
  }

  /**
   * Update a session (only if owned by vault)
   */
  async updateSession(
    id: string,
    updates: Partial<Pick<Session, 'name' | 'metadata'>>,
    vaultId?: string
  ): Promise<Session | null> {
    const effectiveVaultId = vaultId || this.defaultVaultId;
    const session = this.getSession(id, effectiveVaultId);

    if (!session) {
      return null;
    }

    // Apply updates
    if (updates.name !== undefined) session.name = updates.name;
    if (updates.metadata !== undefined) session.metadata = updates.metadata;
    session.lastActivity = new Date();

    // Persist changes
    await this.saveSession(session);

    return session;
  }
}

/**
 * ScopedSessionManager - Pre-scoped wrapper for vault-specific operations
 *
 * Provides a convenient API where vaultId is pre-filled for all operations,
 * useful for request-scoped session management.
 */
export class ScopedSessionManager {
  constructor(
    private manager: SessionManager,
    private vaultId: string
  ) {}

  /** Create a new session in this vault */
  createSession(options: Omit<CreateSessionOptions, 'vaultId'> = {}): Session {
    return this.manager.createSession({ ...options, vaultId: this.vaultId });
  }

  /** Load a session from this vault */
  async loadSession(id: string): Promise<Session | null> {
    return this.manager.loadSession(id, this.vaultId);
  }

  /** Get a session from this vault */
  getSession(id: string): Session | undefined {
    return this.manager.getSession(id, this.vaultId);
  }

  /** Get or create a session in this vault */
  getOrCreate(id?: string, options: Omit<CreateSessionOptions, 'vaultId'> = {}): Session {
    return this.manager.getOrCreate(id, { ...options, vaultId: this.vaultId });
  }

  /** Async get or create a session in this vault */
  async getOrCreateAsync(id?: string, options: Omit<CreateSessionOptions, 'vaultId'> = {}): Promise<Session> {
    return this.manager.getOrCreateAsync(id, { ...options, vaultId: this.vaultId });
  }

  /** Delete a session from this vault */
  deleteSession(id: string): boolean {
    return this.manager.deleteSession(id, this.vaultId);
  }

  /** List sessions in this vault (from memory) */
  listSessions(): SessionInfo[] {
    return this.manager.listSessions(this.vaultId);
  }

  /** List sessions in this vault (from persistence) */
  async listSessionsAsync(): Promise<SessionInfo[]> {
    return this.manager.listSessionsAsync(this.vaultId);
  }

  /** Load all sessions for this vault */
  async loadAllSessions(): Promise<void> {
    return this.manager.loadAllSessions(this.vaultId);
  }

  /** Get session count for this vault */
  getSessionCount(): number {
    return this.manager.getSessionCount(this.vaultId);
  }

  /** Update a session in this vault */
  async updateSession(
    id: string,
    updates: Partial<Pick<Session, 'name' | 'metadata'>>
  ): Promise<Session | null> {
    return this.manager.updateSession(id, updates, this.vaultId);
  }

  /** Persist all sessions in this vault */
  async persistAll(): Promise<void> {
    return this.manager.persistAll(this.vaultId);
  }

  /** Get the vault ID this manager is scoped to */
  getVaultId(): string {
    return this.vaultId;
  }
}
