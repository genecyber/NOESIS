/**
 * MemoryStore - SQLite-based persistent memory for conversations and identity
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  MemoryEntry,
  IdentityState,
  Conversation,
  ConversationMessage,
  Stance,
  SelfModel
} from '../types/index.js';

export interface MemoryStoreOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export class MemoryStore {
  private db: Database.Database;

  constructor(options: MemoryStoreOptions = {}) {
    const dbPath = options.inMemory ? ':memory:' : (options.dbPath || './data/metamorph.db');
    this.db = new Database(dbPath);
    this.initSchema();
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
  }
}
