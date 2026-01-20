/**
 * SessionManager - Manages session lifecycle
 *
 * Handles creation, retrieval, and deletion of sessions.
 * Uses SQLite for persistence by default to ensure data survives restarts.
 */

import { v4 as uuidv4 } from 'uuid';
import { MetamorphAgent } from '../../agent/index.js';
import { ModeConfig } from '../../types/index.js';
import { Session, SessionInfo, CreateSessionOptions, SessionState } from './session.js';
import { PersistenceAdapter } from './persistence/adapter.js';
import { SQLiteAdapter } from './persistence/sqlite-adapter.js';

export interface SessionManagerOptions {
  persistence?: PersistenceAdapter;
  defaultConfig?: Partial<ModeConfig>;
  dbPath?: string;  // Path to SQLite database
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistence: PersistenceAdapter;
  private defaultConfig: Partial<ModeConfig>;
  private dbPath: string;

  constructor(options: SessionManagerOptions = {}) {
    this.dbPath = options.dbPath || './data/metamorph.db';
    this.persistence = options.persistence ?? new SQLiteAdapter({ dbPath: this.dbPath });
    this.defaultConfig = options.defaultConfig ?? {};
    console.log(`[SessionManager] Using SQLite persistence: ${this.dbPath}`);
  }

  /**
   * Load a session from persistence by ID
   * Creates a new agent and restores its state
   */
  async loadSession(id: string): Promise<Session | null> {
    // Check if already loaded in memory
    const existing = this.sessions.get(id);
    if (existing) return existing;

    // Try to load from persistence
    const state = await this.persistence.load(id);
    if (!state) return null;

    // Create agent with restored config
    const agent = new MetamorphAgent({
      config: state.config,
      dbPath: this.dbPath
    });

    // Restore stance if possible
    // Note: Full conversation history is in the MemoryStore

    const session: Session = {
      id: state.id,
      agent,
      createdAt: new Date(state.createdAt),
      lastActivity: new Date(state.lastActivity),
      name: state.name,
      metadata: state.metadata
    };

    this.sessions.set(id, session);
    console.log(`[SessionManager] Loaded session from persistence: ${id}`);
    return session;
  }

  /**
   * Load all sessions from persistence
   */
  async loadAllSessions(): Promise<void> {
    const sessionInfos = await this.persistence.list({ limit: 1000 });
    console.log(`[SessionManager] Loading ${sessionInfos.length} sessions from persistence...`);

    for (const info of sessionInfos) {
      await this.loadSession(info.id);
    }

    console.log(`[SessionManager] Loaded ${this.sessions.size} sessions`);
  }

  /**
   * Create a new session and persist it
   */
  createSession(options: CreateSessionOptions = {}): Session {
    const id = options.id ?? uuidv4();
    const now = new Date();

    const agent = new MetamorphAgent({
      config: { ...this.defaultConfig, ...options.config },
      dbPath: this.dbPath
    });

    const session: Session = {
      id,
      agent,
      createdAt: now,
      lastActivity: now,
      name: options.name,
      metadata: options.metadata
    };

    this.sessions.set(id, session);

    // Save to persistence immediately
    this.saveSession(session).catch(err => {
      console.error(`[SessionManager] Failed to persist session ${id}:`, err);
    });

    return session;
  }

  /**
   * Get existing session by ID
   */
  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  /**
   * Get existing session or create new one
   * Checks memory first, then persistence, then creates new
   */
  getOrCreate(id?: string, options: CreateSessionOptions = {}): Session {
    if (id) {
      // Check memory first
      const existing = this.getSession(id);
      if (existing) return existing;

      // Note: For sync usage, we can't await loadSession
      // The caller should use getOrCreateAsync for persistence-aware loading
    }
    return this.createSession({ ...options, id });
  }

  /**
   * Async version that checks persistence before creating
   */
  async getOrCreateAsync(id?: string, options: CreateSessionOptions = {}): Promise<Session> {
    if (id) {
      // Check memory first
      const existing = this.getSession(id);
      if (existing) return existing;

      // Try loading from persistence
      const loaded = await this.loadSession(id);
      if (loaded) return loaded;
    }
    return this.createSession({ ...options, id });
  }

  /**
   * Delete a session from memory and persistence
   */
  deleteSession(id: string): boolean {
    const deleted = this.sessions.delete(id);

    // Also delete from persistence
    this.persistence.delete(id).catch(err => {
      console.error(`[SessionManager] Failed to delete session ${id} from persistence:`, err);
    });

    return deleted;
  }

  /**
   * List all sessions (lightweight info) from memory
   * For full list including persisted sessions, use listSessionsAsync
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
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
   * List all sessions from persistence (includes ones not in memory)
   */
  async listSessionsAsync(): Promise<SessionInfo[]> {
    return this.persistence.list({ limit: 1000 });
  }

  /**
   * Get session count
   */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Save session state to persistence
   */
  async saveSession(session: Session): Promise<void> {
    const state: SessionState = {
      id: session.id,
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
   * Persist all sessions
   */
  async persistAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      await this.saveSession(session);
    }
  }
}
