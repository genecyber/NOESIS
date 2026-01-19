/**
 * SessionManager - Manages session lifecycle
 *
 * Handles creation, retrieval, and deletion of sessions.
 * Delegates persistence to PersistenceAdapter.
 */

import { v4 as uuidv4 } from 'uuid';
import { MetamorphAgent } from '../../agent/index.js';
import { ModeConfig } from '../../types/index.js';
import { Session, SessionInfo, CreateSessionOptions, SessionState } from './session.js';
import { PersistenceAdapter } from './persistence/adapter.js';
import { InMemoryAdapter } from './persistence/memory-adapter.js';

export interface SessionManagerOptions {
  persistence?: PersistenceAdapter;
  defaultConfig?: Partial<ModeConfig>;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private persistence: PersistenceAdapter;
  private defaultConfig: Partial<ModeConfig>;

  constructor(options: SessionManagerOptions = {}) {
    this.persistence = options.persistence ?? new InMemoryAdapter();
    this.defaultConfig = options.defaultConfig ?? {};
  }

  /**
   * Create a new session
   */
  createSession(options: CreateSessionOptions = {}): Session {
    const id = options.id ?? uuidv4();
    const now = new Date();

    const agent = new MetamorphAgent({
      config: { ...this.defaultConfig, ...options.config }
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
   */
  getOrCreate(id?: string, options: CreateSessionOptions = {}): Session {
    if (id) {
      const existing = this.getSession(id);
      if (existing) return existing;
    }
    return this.createSession({ ...options, id });
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * List all sessions (lightweight info)
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
