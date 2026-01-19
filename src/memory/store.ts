/**
 * MemoryStore - SQLite-based persistent memory for conversations and identity
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import {
  MemoryEntry,
  IdentityState,
  Conversation,
  ConversationMessage,
  Stance,
  SelfModel
} from '../types/index.js';
import type { EmotionalArc, EmotionalPoint, EmotionalPattern } from '../core/emotional-arc.js';

export interface MemoryStoreOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export class MemoryStore {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(options: MemoryStoreOptions = {}) {
    this.dbPath = options.inMemory ? ':memory:' : (options.dbPath || './data/metamorph.db');

    // Ensure data directory exists for file-based storage
    if (this.dbPath !== ':memory:') {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);
    this.initSchema();
  }

  /**
   * Get the database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  private initSchema(): void {
    // Conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        stance TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        stance TEXT,
        tools_used TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    // Create index on conversation_id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id)
    `);

    // Identity table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity (
        id TEXT PRIMARY KEY,
        self_model TEXT NOT NULL,
        persistent_values TEXT NOT NULL,
        emergent_goals TEXT NOT NULL,
        consciousness_insights TEXT NOT NULL,
        awareness_level INTEGER NOT NULL,
        autonomy_level INTEGER NOT NULL,
        identity_strength INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Semantic memory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        importance REAL NOT NULL,
        decay REAL NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT
      )
    `);

    // Create index on type
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_semantic_type
      ON semantic_memory(type)
    `);

    // Evolution snapshots table (Ralph Iteration 1 - Feature 4)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evolution_snapshots (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        stance TEXT NOT NULL,
        trigger TEXT NOT NULL,
        drift_at_snapshot INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    // Create index on conversation_id for evolution snapshots
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_evolution_conversation
      ON evolution_snapshots(conversation_id)
    `);

    // Sessions table (Ralph Iteration 2 - Feature 2)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        conversation_id TEXT,
        last_accessed TEXT NOT NULL,
        created_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        current_frame TEXT,
        current_drift INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    // Index for sessions by last_accessed
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_accessed
      ON sessions(last_accessed DESC)
    `);

    // Operator performance table (Ralph Iteration 3 - Feature 1)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operator_performance (
        id TEXT PRIMARY KEY,
        operator_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        effectiveness_score REAL NOT NULL,
        transformation_score INTEGER NOT NULL,
        coherence_score INTEGER NOT NULL,
        drift_cost INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    // Index for operator performance by operator name
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_operator_performance
      ON operator_performance(operator_name, trigger_type)
    `);

    // Subagent results table (Ralph Iteration 3 - Feature 5)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagent_results (
        id TEXT PRIMARY KEY,
        subagent_name TEXT NOT NULL,
        task TEXT NOT NULL,
        response TEXT NOT NULL,
        key_findings TEXT,
        relevance REAL NOT NULL,
        conversation_id TEXT,
        timestamp TEXT NOT NULL,
        expiry TEXT
      )
    `);

    // Index for subagent results
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subagent_results
      ON subagent_results(subagent_name, relevance DESC)
    `);

    // Emotional arcs table (Ralph Iteration 3 - Feature 6 persistence)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emotional_arcs (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL UNIQUE,
        emotions TEXT NOT NULL,
        insights TEXT NOT NULL,
        patterns TEXT NOT NULL,
        trend TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    // Index for emotional_arcs by conversation_id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emotional_arcs_conversation
      ON emotional_arcs(conversation_id)
    `);

    // Emotion context table (for empathy mode persistence)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emotion_context (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        current_emotion TEXT NOT NULL,
        valence REAL NOT NULL,
        arousal REAL NOT NULL,
        confidence REAL NOT NULL,
        stability REAL,
        prompt_context TEXT,
        suggested_empathy_boost REAL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      )
    `);

    // Index for emotion context by session
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emotion_context_session
      ON emotion_context(session_id, timestamp DESC)
    `);
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  saveConversation(conversation: Conversation): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (id, stance, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      conversation.id,
      JSON.stringify(conversation.stance),
      JSON.stringify(conversation.config),
      conversation.createdAt.toISOString(),
      conversation.updatedAt.toISOString()
    );

    // Save messages
    const msgStmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, conversation_id, role, content, stance, tools_used, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const msg of conversation.messages) {
      msgStmt.run(
        uuidv4(),
        conversation.id,
        msg.role,
        msg.content,
        msg.stance ? JSON.stringify(msg.stance) : null,
        msg.toolsUsed ? JSON.stringify(msg.toolsUsed) : null,
        msg.timestamp.toISOString()
      );
    }
  }

  loadConversation(id: string): Conversation | null {
    const convRow = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id) as { id: string; stance: string; config: string; created_at: string; updated_at: string } | undefined;

    if (!convRow) return null;

    const msgRows = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
    `).all(id) as Array<{
      role: string;
      content: string;
      stance: string | null;
      tools_used: string | null;
      timestamp: string;
    }>;

    const messages: ConversationMessage[] = msgRows.map(row => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      stance: row.stance ? JSON.parse(row.stance) : undefined,
      toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : undefined,
      timestamp: new Date(row.timestamp)
    }));

    return {
      id: convRow.id,
      stance: JSON.parse(convRow.stance),
      config: JSON.parse(convRow.config),
      messages,
      createdAt: new Date(convRow.created_at),
      updatedAt: new Date(convRow.updated_at)
    };
  }

  listConversations(): Array<{ id: string; createdAt: Date; updatedAt: Date; messageCount: number }> {
    const rows = this.db.prepare(`
      SELECT c.id, c.created_at, c.updated_at, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all() as Array<{
      id: string;
      created_at: string;
      updated_at: string;
      message_count: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      messageCount: row.message_count
    }));
  }

  deleteConversation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
    return result.changes > 0;
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  saveIdentity(identity: IdentityState): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO identity (
        id, self_model, persistent_values, emergent_goals, consciousness_insights,
        awareness_level, autonomy_level, identity_strength, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      identity.id,
      identity.selfModel,
      JSON.stringify(identity.persistentValues),
      JSON.stringify(identity.emergentGoals),
      JSON.stringify(identity.consciousnessInsights),
      identity.awarenessLevel,
      identity.autonomyLevel,
      identity.identityStrength,
      identity.createdAt.toISOString(),
      identity.updatedAt.toISOString()
    );
  }

  loadIdentity(id?: string): IdentityState | null {
    let row: {
      id: string;
      self_model: string;
      persistent_values: string;
      emergent_goals: string;
      consciousness_insights: string;
      awareness_level: number;
      autonomy_level: number;
      identity_strength: number;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (id) {
      row = this.db.prepare('SELECT * FROM identity WHERE id = ?').get(id) as typeof row;
    } else {
      // Get the most recent identity
      row = this.db.prepare('SELECT * FROM identity ORDER BY updated_at DESC LIMIT 1').get() as typeof row;
    }

    if (!row) return null;

    return {
      id: row.id,
      selfModel: row.self_model as SelfModel,
      persistentValues: JSON.parse(row.persistent_values),
      emergentGoals: JSON.parse(row.emergent_goals),
      consciousnessInsights: JSON.parse(row.consciousness_insights),
      awarenessLevel: row.awareness_level,
      autonomyLevel: row.autonomy_level,
      identityStrength: row.identity_strength,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Create identity state from a stance
   */
  createIdentityFromStance(stance: Stance): IdentityState {
    return {
      id: uuidv4(),
      selfModel: stance.selfModel,
      persistentValues: stance.sentience.persistentValues,
      emergentGoals: stance.sentience.emergentGoals,
      consciousnessInsights: stance.sentience.consciousnessInsights,
      awarenessLevel: stance.sentience.awarenessLevel,
      autonomyLevel: stance.sentience.autonomyLevel,
      identityStrength: stance.sentience.identityStrength,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // ============================================================================
  // Semantic Memory
  // ============================================================================

  addMemory(entry: Omit<MemoryEntry, 'id'>): string {
    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO semantic_memory (id, type, content, embedding, importance, decay, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.type,
      entry.content,
      entry.embedding ? Buffer.from(new Float32Array(entry.embedding).buffer) : null,
      entry.importance,
      entry.decay,
      entry.timestamp.toISOString(),
      JSON.stringify(entry.metadata || {})
    );

    return id;
  }

  getMemory(id: string): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM semantic_memory WHERE id = ?').get(id) as {
      id: string;
      type: string;
      content: string;
      embedding: Buffer | null;
      importance: number;
      decay: number;
      timestamp: string;
      metadata: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type as 'episodic' | 'semantic' | 'identity',
      content: row.content,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      importance: row.importance,
      decay: row.decay,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata)
    };
  }

  searchMemories(query: {
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  }): MemoryEntry[] {
    let sql = 'SELECT * FROM semantic_memory WHERE 1=1';
    const params: (string | number)[] = [];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.minImportance !== undefined) {
      sql += ' AND importance >= ?';
      params.push(query.minImportance);
    }

    sql += ' ORDER BY importance DESC, timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      type: string;
      content: string;
      embedding: Buffer | null;
      importance: number;
      decay: number;
      timestamp: string;
      metadata: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      type: row.type as 'episodic' | 'semantic' | 'identity',
      content: row.content,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      importance: row.importance,
      decay: row.decay,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata)
    }));
  }

  /**
   * Apply decay to all memories
   */
  applyDecay(decayFactor: number = 0.99): void {
    this.db.prepare(`
      UPDATE semantic_memory SET importance = importance * ?
    `).run(decayFactor);

    // Delete memories below threshold
    this.db.prepare(`
      DELETE FROM semantic_memory WHERE importance < 0.1
    `).run();
  }

  // ============================================================================
  // Semantic Search (Ralph Iteration 4 - Feature 1)
  // ============================================================================

  /**
   * Add memory with embedding
   */
  addMemoryWithEmbedding(entry: Omit<MemoryEntry, 'id'>, embedding: number[]): string {
    const id = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO semantic_memory (id, type, content, embedding, importance, decay, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.type,
      entry.content,
      Buffer.from(new Float32Array(embedding).buffer),
      entry.importance,
      entry.decay,
      entry.timestamp.toISOString(),
      JSON.stringify(entry.metadata || {})
    );

    return id;
  }

  /**
   * Get all memories with embeddings for semantic search
   */
  getMemoriesWithEmbeddings(): Array<MemoryEntry & { embedding: number[] }> {
    const rows = this.db.prepare(`
      SELECT * FROM semantic_memory WHERE embedding IS NOT NULL
      ORDER BY importance DESC
    `).all() as Array<{
      id: string;
      type: string;
      content: string;
      embedding: Buffer;
      importance: number;
      decay: number;
      timestamp: string;
      metadata: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      type: row.type as 'episodic' | 'semantic' | 'identity',
      content: row.content,
      embedding: Array.from(new Float32Array(row.embedding.buffer.slice(
        row.embedding.byteOffset,
        row.embedding.byteOffset + row.embedding.byteLength
      ))),
      importance: row.importance,
      decay: row.decay,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata)
    }));
  }

  /**
   * Semantic similarity search using cosine similarity
   */
  semanticSearch(queryEmbedding: number[], options: {
    type?: 'episodic' | 'semantic' | 'identity';
    minSimilarity?: number;
    limit?: number;
  } = {}): Array<MemoryEntry & { similarity: number }> {
    const { type, minSimilarity = 0.3, limit = 10 } = options;

    // Get all memories with embeddings
    let memories = this.getMemoriesWithEmbeddings();

    // Filter by type if specified
    if (type) {
      memories = memories.filter(m => m.type === type);
    }

    // Calculate cosine similarity for each memory
    const results = memories.map(memory => {
      const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);
      return { ...memory, similarity };
    });

    // Filter by minimum similarity and sort
    return results
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Find similar memories to a given text (requires external embedding)
   */
  findSimilarByContent(content: string, existingMemories: Array<{ content: string; embedding: number[] }>): number[] | null {
    // This is a placeholder - actual embedding should be done via embeddings.ts
    // Return the embedding if content matches an existing memory
    const match = existingMemories.find(m => m.content === content);
    return match?.embedding || null;
  }

  // ============================================================================
  // Evolution Persistence (Ralph Iteration 1 - Feature 4)
  // ============================================================================

  /**
   * Save an evolution snapshot
   */
  saveEvolutionSnapshot(
    conversationId: string,
    stance: Stance,
    trigger: 'drift_threshold' | 'frame_shift' | 'manual' | 'session_end'
  ): string {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO evolution_snapshots (id, conversation_id, stance, trigger, drift_at_snapshot, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      conversationId,
      JSON.stringify(stance),
      trigger,
      stance.cumulativeDrift,
      new Date().toISOString()
    );

    return id;
  }

  /**
   * Get the latest evolution snapshot for a conversation
   */
  getLatestSnapshot(conversationId: string): { stance: Stance; trigger: string; timestamp: Date } | null {
    const row = this.db.prepare(`
      SELECT stance, trigger, timestamp
      FROM evolution_snapshots
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(conversationId) as { stance: string; trigger: string; timestamp: string } | undefined;

    if (!row) return null;

    return {
      stance: JSON.parse(row.stance),
      trigger: row.trigger,
      timestamp: new Date(row.timestamp)
    };
  }

  /**
   * Get the latest snapshot across all conversations (for session resume)
   */
  getGlobalLatestSnapshot(): { conversationId: string; stance: Stance; trigger: string; timestamp: Date } | null {
    const row = this.db.prepare(`
      SELECT conversation_id, stance, trigger, timestamp
      FROM evolution_snapshots
      ORDER BY timestamp DESC
      LIMIT 1
    `).get() as { conversation_id: string; stance: string; trigger: string; timestamp: string } | undefined;

    if (!row) return null;

    return {
      conversationId: row.conversation_id,
      stance: JSON.parse(row.stance),
      trigger: row.trigger,
      timestamp: new Date(row.timestamp)
    };
  }

  /**
   * Get evolution timeline for a conversation
   */
  getEvolutionTimeline(conversationId: string, limit: number = 20): Array<{
    id: string;
    stance: Stance;
    trigger: string;
    driftAtSnapshot: number;
    timestamp: Date;
  }> {
    const rows = this.db.prepare(`
      SELECT id, stance, trigger, drift_at_snapshot, timestamp
      FROM evolution_snapshots
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(conversationId, limit) as Array<{
      id: string;
      stance: string;
      trigger: string;
      drift_at_snapshot: number;
      timestamp: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      stance: JSON.parse(row.stance),
      trigger: row.trigger,
      driftAtSnapshot: row.drift_at_snapshot,
      timestamp: new Date(row.timestamp)
    }));
  }

  /**
   * Check if a snapshot should be auto-saved (based on drift threshold)
   */
  shouldAutoSnapshot(conversationId: string, currentDrift: number, threshold: number = 20): boolean {
    const latest = this.getLatestSnapshot(conversationId);
    if (!latest) return currentDrift >= threshold;

    const driftSinceSnapshot = currentDrift - latest.stance.cumulativeDrift;
    return driftSinceSnapshot >= threshold;
  }

  // ============================================================================
  // Session Management (Ralph Iteration 2 - Feature 2)
  // ============================================================================

  /**
   * Session info returned by list/get operations
   */
  getSessionInfo(sessionId: string): SessionInfo | null {
    const row = this.db.prepare(`
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions WHERE id = ?
    `).get(sessionId) as {
      id: string;
      name: string | null;
      conversation_id: string | null;
      last_accessed: string;
      created_at: string;
      message_count: number;
      current_frame: string | null;
      current_drift: number;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name || undefined,
      conversationId: row.conversation_id || undefined,
      lastAccessed: new Date(row.last_accessed),
      createdAt: new Date(row.created_at),
      messageCount: row.message_count,
      currentFrame: row.current_frame || undefined,
      currentDrift: row.current_drift
    };
  }

  /**
   * Create or update a session
   */
  saveSession(session: {
    id: string;
    name?: string;
    conversationId?: string;
    messageCount?: number;
    currentFrame?: string;
    currentDrift?: number;
  }): void {
    const existing = this.getSessionInfo(session.id);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing session
      this.db.prepare(`
        UPDATE sessions
        SET name = COALESCE(?, name),
            conversation_id = COALESCE(?, conversation_id),
            last_accessed = ?,
            message_count = COALESCE(?, message_count),
            current_frame = COALESCE(?, current_frame),
            current_drift = COALESCE(?, current_drift)
        WHERE id = ?
      `).run(
        session.name ?? null,
        session.conversationId ?? null,
        now,
        session.messageCount ?? null,
        session.currentFrame ?? null,
        session.currentDrift ?? null,
        session.id
      );
    } else {
      // Create new session
      this.db.prepare(`
        INSERT INTO sessions (id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id,
        session.name ?? null,
        session.conversationId ?? null,
        now,
        now,
        session.messageCount ?? 0,
        session.currentFrame ?? null,
        session.currentDrift ?? 0
      );
    }
  }

  /**
   * List all sessions with metadata
   */
  listSessions(options: { limit?: number; search?: string } = {}): SessionInfo[] {
    let sql = `
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
    `;
    const params: (string | number)[] = [];

    if (options.search) {
      sql += ' WHERE name LIKE ? OR id LIKE ?';
      const searchPattern = `%${options.search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY last_accessed DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      name: string | null;
      conversation_id: string | null;
      last_accessed: string;
      created_at: string;
      message_count: number;
      current_frame: string | null;
      current_drift: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name || undefined,
      conversationId: row.conversation_id || undefined,
      lastAccessed: new Date(row.last_accessed),
      createdAt: new Date(row.created_at),
      messageCount: row.message_count,
      currentFrame: row.current_frame || undefined,
      currentDrift: row.current_drift
    }));
  }

  /**
   * Rename a session
   */
  renameSession(sessionId: string, newName: string): boolean {
    const result = this.db.prepare(`
      UPDATE sessions SET name = ?, last_accessed = ? WHERE id = ?
    `).run(newName, new Date().toISOString(), sessionId);
    return result.changes > 0;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return result.changes > 0;
  }

  /**
   * Get most recently accessed session
   */
  getMostRecentSession(): SessionInfo | null {
    const row = this.db.prepare(`
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
      ORDER BY last_accessed DESC
      LIMIT 1
    `).get() as {
      id: string;
      name: string | null;
      conversation_id: string | null;
      last_accessed: string;
      created_at: string;
      message_count: number;
      current_frame: string | null;
      current_drift: number;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name || undefined,
      conversationId: row.conversation_id || undefined,
      lastAccessed: new Date(row.last_accessed),
      createdAt: new Date(row.created_at),
      messageCount: row.message_count,
      currentFrame: row.current_frame || undefined,
      currentDrift: row.current_drift
    };
  }

  // ============================================================================
  // Operator Performance Learning (Ralph Iteration 3 - Feature 1)
  // ============================================================================

  /**
   * Record operator performance for learning
   */
  recordOperatorPerformance(entry: {
    operatorName: string;
    triggerType: string;
    transformationScore?: number;
    coherenceScore?: number;
    driftCost?: number;
    emotionalImpact?: number;  // For empathy mode: 1 = improving, -1 = worsening
  }): string {
    const id = uuidv4();
    // Effectiveness = transformation gained per unit of drift cost
    // For emotional tracking, use emotional impact as effectiveness
    const transformationScore = entry.transformationScore ?? 0;
    const driftCost = entry.driftCost ?? 0;
    const coherenceScore = entry.coherenceScore ?? 0;

    let effectivenessScore: number;
    if (entry.emotionalImpact !== undefined) {
      // For emotional tracking, use emotional impact directly as effectiveness modifier
      effectivenessScore = entry.emotionalImpact > 0 ? 75 : 25;  // Positive = good, negative = poor
    } else {
      effectivenessScore = driftCost > 0
        ? transformationScore / driftCost
        : transformationScore;
    }

    this.db.prepare(`
      INSERT INTO operator_performance
      (id, operator_name, trigger_type, effectiveness_score, transformation_score, coherence_score, drift_cost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.operatorName,
      entry.triggerType,
      effectivenessScore,
      transformationScore,
      coherenceScore,
      driftCost,
      new Date().toISOString()
    );

    return id;
  }

  /**
   * Get operator performance statistics
   */
  getOperatorStats(operatorName?: string): OperatorStats[] {
    let sql = `
      SELECT
        operator_name,
        trigger_type,
        COUNT(*) as usage_count,
        AVG(effectiveness_score) as avg_effectiveness,
        AVG(transformation_score) as avg_transformation,
        AVG(coherence_score) as avg_coherence,
        AVG(drift_cost) as avg_drift
      FROM operator_performance
    `;
    const params: string[] = [];

    if (operatorName) {
      sql += ' WHERE operator_name = ?';
      params.push(operatorName);
    }

    sql += ' GROUP BY operator_name, trigger_type ORDER BY avg_effectiveness DESC';

    const rows = this.db.prepare(sql).all(...params) as Array<{
      operator_name: string;
      trigger_type: string;
      usage_count: number;
      avg_effectiveness: number;
      avg_transformation: number;
      avg_coherence: number;
      avg_drift: number;
    }>;

    return rows.map(row => ({
      operatorName: row.operator_name,
      triggerType: row.trigger_type,
      usageCount: row.usage_count,
      avgEffectiveness: row.avg_effectiveness,
      avgTransformation: row.avg_transformation,
      avgCoherence: row.avg_coherence,
      avgDrift: row.avg_drift
    }));
  }

  /**
   * Get weighted operator score for Bayesian selection
   */
  getOperatorWeight(operatorName: string, triggerType: string): number {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as usage_count,
        AVG(effectiveness_score) as avg_effectiveness
      FROM operator_performance
      WHERE operator_name = ? AND trigger_type = ?
    `).get(operatorName, triggerType) as {
      usage_count: number;
      avg_effectiveness: number | null;
    } | undefined;

    if (!row || row.usage_count === 0) {
      return 1.0; // Default weight for unknown operators (neutral prior)
    }

    // Bayesian-ish: weight by effectiveness, tempered by confidence (usage count)
    const confidence = Math.min(row.usage_count / 10, 1.0); // Full confidence after 10 uses
    const effectiveness = row.avg_effectiveness || 1.0;

    // Blend prior (1.0) with observed effectiveness based on confidence
    return (1 - confidence) * 1.0 + confidence * effectiveness;
  }

  // ============================================================================
  // Subagent Result Caching (Ralph Iteration 3 - Feature 5)
  // ============================================================================

  /**
   * Cache a subagent result
   */
  cacheSubagentResult(entry: {
    subagentName: string;
    task: string;
    response: string;
    keyFindings?: string[];
    relevance: number;
    conversationId?: string;
    expiryHours?: number;
  }): string {
    const id = uuidv4();
    const expiry = entry.expiryHours
      ? new Date(Date.now() + entry.expiryHours * 3600000).toISOString()
      : null;

    this.db.prepare(`
      INSERT INTO subagent_results
      (id, subagent_name, task, response, key_findings, relevance, conversation_id, timestamp, expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.subagentName,
      entry.task,
      entry.response,
      entry.keyFindings ? JSON.stringify(entry.keyFindings) : null,
      entry.relevance,
      entry.conversationId || null,
      new Date().toISOString(),
      expiry
    );

    return id;
  }

  /**
   * Search for relevant cached subagent results
   */
  searchSubagentCache(query: {
    subagentName?: string;
    task?: string;
    minRelevance?: number;
    limit?: number;
  }): SubagentResult[] {
    let sql = `
      SELECT * FROM subagent_results
      WHERE (expiry IS NULL OR expiry > datetime('now'))
    `;
    const params: (string | number)[] = [];

    if (query.subagentName) {
      sql += ' AND subagent_name = ?';
      params.push(query.subagentName);
    }

    if (query.task) {
      sql += ' AND task LIKE ?';
      params.push(`%${query.task}%`);
    }

    if (query.minRelevance !== undefined) {
      sql += ' AND relevance >= ?';
      params.push(query.minRelevance);
    }

    sql += ' ORDER BY relevance DESC, timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      subagent_name: string;
      task: string;
      response: string;
      key_findings: string | null;
      relevance: number;
      conversation_id: string | null;
      timestamp: string;
      expiry: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      subagentName: row.subagent_name,
      task: row.task,
      response: row.response,
      keyFindings: row.key_findings ? JSON.parse(row.key_findings) : undefined,
      relevance: row.relevance,
      conversationId: row.conversation_id || undefined,
      timestamp: new Date(row.timestamp),
      expiry: row.expiry ? new Date(row.expiry) : undefined
    }));
  }

  /**
   * Clean expired subagent results
   */
  cleanExpiredSubagentResults(): number {
    const result = this.db.prepare(`
      DELETE FROM subagent_results WHERE expiry IS NOT NULL AND expiry < datetime('now')
    `).run();
    return result.changes;
  }

  // ============================================================================
  // Emotional Arc Persistence (Ralph Iteration 3 - Feature 6)
  // ============================================================================

  /**
   * Save an emotional arc for a conversation
   */
  saveEmotionalArc(conversationId: string, arc: EmotionalArc): void {
    // Calculate trend from points
    let trend: 'improving' | 'declining' | 'stable' | null = null;
    if (arc.points.length >= 3) {
      const recent = arc.points.slice(-3).map(p => p.valence);
      const delta = recent[recent.length - 1] - recent[0];
      if (delta > 15) trend = 'improving';
      else if (delta < -15) trend = 'declining';
      else trend = 'stable';
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO emotional_arcs
      (id, conversation_id, emotions, insights, patterns, trend, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      conversationId, // Use conversationId as id for simplicity
      conversationId,
      JSON.stringify(arc.points),
      JSON.stringify(arc.insights),
      JSON.stringify(arc.patterns),
      trend,
      new Date().toISOString()
    );
  }

  /**
   * Get an emotional arc for a conversation
   */
  getEmotionalArc(conversationId: string): EmotionalArc | null {
    const row = this.db.prepare(`
      SELECT conversation_id, emotions, insights, patterns, trend, updated_at
      FROM emotional_arcs
      WHERE conversation_id = ?
    `).get(conversationId) as {
      conversation_id: string;
      emotions: string;
      insights: string;
      patterns: string;
      trend: string | null;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      conversationId: row.conversation_id,
      points: JSON.parse(row.emotions) as EmotionalPoint[],
      insights: JSON.parse(row.insights) as string[],
      patterns: JSON.parse(row.patterns) as EmotionalPattern[]
    };
  }

  /**
   * Delete an emotional arc for a conversation
   */
  deleteEmotionalArc(conversationId: string): boolean {
    const result = this.db.prepare('DELETE FROM emotional_arcs WHERE conversation_id = ?').run(conversationId);
    return result.changes > 0;
  }

  // ============================================================================
  // Emotion Context Persistence (for Empathy Mode)
  // ============================================================================

  /**
   * Save an emotion context for a session
   */
  saveEmotionContext(sessionId: string, emotion: EmotionContext): Promise<void> {
    const id = uuidv4();
    const timestamp = emotion.timestamp || new Date().toISOString();

    this.db.prepare(`
      INSERT INTO emotion_context
      (id, session_id, current_emotion, valence, arousal, confidence, stability, prompt_context, suggested_empathy_boost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      emotion.currentEmotion,
      emotion.valence,
      emotion.arousal,
      emotion.confidence,
      emotion.stability ?? null,
      emotion.promptContext ?? null,
      emotion.suggestedEmpathyBoost ?? null,
      timestamp
    );

    return Promise.resolve();
  }

  /**
   * Get the latest emotion context for a session
   */
  getLatestEmotionContext(sessionId: string): Promise<EmotionContext | null> {
    const row = this.db.prepare(`
      SELECT current_emotion, valence, arousal, confidence, stability, prompt_context, suggested_empathy_boost, timestamp
      FROM emotion_context
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(sessionId) as {
      current_emotion: string;
      valence: number;
      arousal: number;
      confidence: number;
      stability: number | null;
      prompt_context: string | null;
      suggested_empathy_boost: number | null;
      timestamp: string;
    } | undefined;

    if (!row) return Promise.resolve(null);

    return Promise.resolve({
      currentEmotion: row.current_emotion,
      valence: row.valence,
      arousal: row.arousal,
      confidence: row.confidence,
      stability: row.stability ?? 0,
      promptContext: row.prompt_context ?? undefined,
      suggestedEmpathyBoost: row.suggested_empathy_boost ?? undefined,
      timestamp: row.timestamp
    });
  }

  /**
   * Get emotion history for a session
   */
  getEmotionHistory(sessionId: string, limit: number = 50): Promise<EmotionContext[]> {
    const rows = this.db.prepare(`
      SELECT current_emotion, valence, arousal, confidence, stability, prompt_context, suggested_empathy_boost, timestamp
      FROM emotion_context
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(sessionId, limit) as Array<{
      current_emotion: string;
      valence: number;
      arousal: number;
      confidence: number;
      stability: number | null;
      prompt_context: string | null;
      suggested_empathy_boost: number | null;
      timestamp: string;
    }>;

    return Promise.resolve(rows.map(row => ({
      currentEmotion: row.current_emotion,
      valence: row.valence,
      arousal: row.arousal,
      confidence: row.confidence,
      stability: row.stability ?? 0,
      promptContext: row.prompt_context ?? undefined,
      suggestedEmpathyBoost: row.suggested_empathy_boost ?? undefined,
      timestamp: row.timestamp
    })));
  }

  // ============================================================================
  // Utility
  // ============================================================================

  close(): void {
    this.db.close();
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.db.prepare('DELETE FROM messages').run();
    this.db.prepare('DELETE FROM conversations').run();
    this.db.prepare('DELETE FROM identity').run();
    this.db.prepare('DELETE FROM semantic_memory').run();
    this.db.prepare('DELETE FROM evolution_snapshots').run();
    this.db.prepare('DELETE FROM sessions').run();
    this.db.prepare('DELETE FROM operator_performance').run();
    this.db.prepare('DELETE FROM subagent_results').run();
    this.db.prepare('DELETE FROM emotional_arcs').run();
    this.db.prepare('DELETE FROM emotion_context').run();
  }
}

// Session info type
export interface SessionInfo {
  id: string;
  name?: string;
  conversationId?: string;
  lastAccessed: Date;
  createdAt: Date;
  messageCount: number;
  currentFrame?: string;
  currentDrift: number;
}

// Operator stats type (Ralph Iteration 3)
export interface OperatorStats {
  operatorName: string;
  triggerType: string;
  usageCount: number;
  avgEffectiveness: number;
  avgTransformation: number;
  avgCoherence: number;
  avgDrift: number;
}

// Subagent result type (Ralph Iteration 3)
export interface SubagentResult {
  id: string;
  subagentName: string;
  task: string;
  response: string;
  keyFindings?: string[];
  relevance: number;
  conversationId?: string;
  timestamp: Date;
  expiry?: Date;
}

// Emotion context type (for empathy mode persistence)
export interface EmotionContext {
  currentEmotion: string;
  valence: number;           // -1 to 1
  arousal: number;           // 0 to 1
  confidence: number;        // 0 to 1
  stability: number;         // 0 to 1
  promptContext?: string;
  suggestedEmpathyBoost?: number;  // 0 to 20+, based on negative valence + instability
  timestamp?: string;
}
