/**
 * MemoryStore - SQLite-based persistent memory for conversations and identity
 *
 * Supports vault-scoped multitenancy: all memory operations are automatically
 * scoped to the current vault context when available.
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
import { EmbeddingService, getEmbeddingService } from '../embeddings/service.js';
import {
  VaultScopedDatabase,
  createVaultScopedDbExplicit,
  getVaultId
} from '../multitenancy/index.js';

export interface MemoryStoreOptions {
  dbPath?: string;
  inMemory?: boolean;
  /** Optional explicit vault ID. If not provided, uses AsyncLocalStorage context or 'default-vault' fallback */
  vaultId?: string;
}

/** Default vault ID used when no vault context is available */
const DEFAULT_VAULT_ID = 'default-vault';

export class MemoryStore {
  private db: Database.Database;
  private vaultDb: VaultScopedDatabase;
  private readonly dbPath: string;
  private embeddingService: EmbeddingService;
  private readonly explicitVaultId?: string;

  constructor(options: MemoryStoreOptions = {}) {
    this.dbPath = options.inMemory ? ':memory:' : (options.dbPath || './data/metamorph.db');
    this.explicitVaultId = options.vaultId;

    // Ensure data directory exists for file-based storage
    if (this.dbPath !== ':memory:') {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);

    // Create vault-scoped database wrapper
    // If explicit vaultId provided, use it; otherwise dynamically look up from context
    if (options.vaultId) {
      this.vaultDb = createVaultScopedDbExplicit(this.db, options.vaultId);
    } else {
      // Dynamic lookup with fallback to default-vault
      this.vaultDb = new VaultScopedDatabase(this.db, () => getVaultId(DEFAULT_VAULT_ID));
    }

    this.initSchema();
    this.embeddingService = getEmbeddingService();
  }

  /**
   * Get the current vault ID being used for operations
   */
  getVaultId(): string {
    if (this.explicitVaultId) {
      return this.explicitVaultId;
    }
    return getVaultId(DEFAULT_VAULT_ID);
  }

  /**
   * Get the database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  private initSchema(): void {
    // Conversations table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        stance TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Add vault_id column if it doesn't exist (migration)
    this.migrateAddVaultId('conversations');

    // Messages table - vault scoped through conversation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        stance TEXT,
        tools_used TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    this.migrateAddVaultId('messages');

    // Create index on conversation_id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id)
    `);

    // Create index on vault_id for messages
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_vault
      ON messages(vault_id)
    `);

    // Identity table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
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

    this.migrateAddVaultId('identity');

    // Semantic memory table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        importance REAL NOT NULL,
        decay REAL NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT
      )
    `);

    this.migrateAddVaultId('semantic_memory');

    // Create index on type
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_semantic_type
      ON semantic_memory(type)
    `);

    // Create index on vault_id for semantic_memory
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_semantic_memory_vault
      ON semantic_memory(vault_id)
    `);

    // Evolution snapshots table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evolution_snapshots (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        conversation_id TEXT NOT NULL,
        stance TEXT NOT NULL,
        trigger TEXT NOT NULL,
        drift_at_snapshot INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    this.migrateAddVaultId('evolution_snapshots');

    // Create index on conversation_id for evolution snapshots
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_evolution_conversation
      ON evolution_snapshots(conversation_id)
    `);

    // Sessions table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
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

    this.migrateAddVaultId('sessions');

    // Index for sessions by last_accessed
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_accessed
      ON sessions(last_accessed DESC)
    `);

    // Create index on vault_id for sessions
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_vault
      ON sessions(vault_id)
    `);

    // Operator performance table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operator_performance (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        operator_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        effectiveness_score REAL NOT NULL,
        transformation_score INTEGER NOT NULL,
        coherence_score INTEGER NOT NULL,
        drift_cost INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    this.migrateAddVaultId('operator_performance');

    // Index for operator performance by operator name
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_operator_performance
      ON operator_performance(operator_name, trigger_type)
    `);

    // Subagent results table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagent_results (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
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

    this.migrateAddVaultId('subagent_results');

    // Index for subagent results
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subagent_results
      ON subagent_results(subagent_name, relevance DESC)
    `);

    // Emotional arcs table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emotional_arcs (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
        conversation_id TEXT NOT NULL,
        emotions TEXT NOT NULL,
        insights TEXT NOT NULL,
        patterns TEXT NOT NULL,
        trend TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(vault_id, conversation_id)
      )
    `);

    this.migrateAddVaultId('emotional_arcs');

    // Index for emotional_arcs by conversation_id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emotional_arcs_conversation
      ON emotional_arcs(conversation_id)
    `);

    // Emotion context table - vault scoped
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emotion_context (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL DEFAULT 'default-vault',
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

    this.migrateAddVaultId('emotion_context');

    // Index for emotion context by session
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emotion_context_session
      ON emotion_context(session_id, timestamp DESC)
    `);
  }

  /**
   * Migration helper: adds vault_id column to existing tables if missing
   */
  private migrateAddVaultId(tableName: string): void {
    try {
      // Check if vault_id column exists
      const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
      const hasVaultId = tableInfo.some(col => col.name === 'vault_id');

      if (!hasVaultId) {
        // Add vault_id column with default value
        this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN vault_id TEXT NOT NULL DEFAULT 'default-vault'`);
        // Create index for vault_id
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_vault ON ${tableName}(vault_id)`);
      }
    } catch {
      // Table might not exist yet, which is fine - CREATE TABLE will handle it
    }
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  saveConversation(conversation: Conversation): void {
    // Use vault-scoped upsert for conversation
    this.vaultDb.upsertWithVault('conversations', {
      id: conversation.id,
      stance: JSON.stringify(conversation.stance),
      config: JSON.stringify(conversation.config),
      created_at: conversation.createdAt.toISOString(),
      updated_at: conversation.updatedAt.toISOString()
    });

    // Save messages with vault scoping
    for (const msg of conversation.messages) {
      this.vaultDb.upsertWithVault('messages', {
        id: uuidv4(),
        conversation_id: conversation.id,
        role: msg.role,
        content: msg.content,
        stance: msg.stance ? JSON.stringify(msg.stance) : null,
        tools_used: msg.toolsUsed ? JSON.stringify(msg.toolsUsed) : null,
        timestamp: msg.timestamp.toISOString()
      });
    }
  }

  loadConversation(id: string): Conversation | null {
    // Use vault-scoped query
    const convRow = this.vaultDb.getWithVault(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    ) as { id: string; stance: string; config: string; created_at: string; updated_at: string } | undefined;

    if (!convRow) return null;

    // Get messages for this conversation (vault-scoped)
    const msgRows = this.vaultDb.queryWithVault(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [id]
    ) as Array<{
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
    const vaultId = this.getVaultId();
    // Complex query with JOIN - use raw db but filter by vault_id explicitly
    const rows = this.db.prepare(`
      SELECT c.id, c.created_at, c.updated_at, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id AND m.vault_id = ?
      WHERE c.vault_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all(vaultId, vaultId) as Array<{
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
    // Delete conversation and messages with vault scoping
    const result = this.vaultDb.deleteWithVault('conversations', 'id = ?', [id]);
    this.vaultDb.deleteWithVault('messages', 'conversation_id = ?', [id]);
    return result.changes > 0;
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  saveIdentity(identity: IdentityState): void {
    // Use vault-scoped upsert for identity
    this.vaultDb.upsertWithVault('identity', {
      id: identity.id,
      self_model: identity.selfModel,
      persistent_values: JSON.stringify(identity.persistentValues),
      emergent_goals: JSON.stringify(identity.emergentGoals),
      consciousness_insights: JSON.stringify(identity.consciousnessInsights),
      awareness_level: identity.awarenessLevel,
      autonomy_level: identity.autonomyLevel,
      identity_strength: identity.identityStrength,
      created_at: identity.createdAt.toISOString(),
      updated_at: identity.updatedAt.toISOString()
    });
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
      // Use vault-scoped query
      row = this.vaultDb.getWithVault('SELECT * FROM identity WHERE id = ?', [id]) as typeof row;
    } else {
      // Get the most recent identity for this vault
      const vaultId = this.getVaultId();
      row = this.db.prepare('SELECT * FROM identity WHERE vault_id = ? ORDER BY updated_at DESC LIMIT 1').get(vaultId) as typeof row;
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

  /**
   * Add a memory with auto-embedding and semantic deduplication
   * All memories are automatically scoped to the current vault.
   * @param entry Memory entry to add (embedding will be generated if not provided)
   * @param options Options for deduplication behavior
   * @returns Object with id (if added) and whether it was a duplicate
   */
  async addMemory(
    entry: Omit<MemoryEntry, 'id'>,
    options: { skipDeduplication?: boolean; duplicateThreshold?: number } = {}
  ): Promise<{ id: string | null; isDuplicate: boolean; boostedMemoryId?: string }> {
    const { skipDeduplication = false, duplicateThreshold = 0.9 } = options;

    // Generate embedding if not provided
    let embedding = entry.embedding;
    if (!embedding) {
      try {
        embedding = await this.embeddingService.embed(entry.content);
      } catch (error) {
        // If embedding fails, continue without embedding (graceful degradation)
        console.warn('Failed to generate embedding for memory:', error);
      }
    }

    // Check for semantic duplicates unless skipped (within same vault only)
    if (!skipDeduplication && embedding) {
      const similar = this.semanticSearch(embedding, {
        minSimilarity: duplicateThreshold,
        limit: 1
      });

      if (similar.length > 0) {
        // Boost existing memory's importance instead of creating duplicate
        const existingMemory = similar[0];
        await this.boostMemoryImportance(existingMemory.id, 0.1);
        return { id: null, isDuplicate: true, boostedMemoryId: existingMemory.id };
      }
    }

    // Proceed with vault-scoped storage
    const id = uuidv4();

    this.vaultDb.insertWithVault('semantic_memory', {
      id,
      type: entry.type,
      content: entry.content,
      embedding: embedding ? Buffer.from(new Float32Array(embedding).buffer) : null,
      importance: entry.importance,
      decay: entry.decay,
      timestamp: entry.timestamp.toISOString(),
      metadata: JSON.stringify(entry.metadata || {})
    });

    return { id, isDuplicate: false };
  }

  /**
   * Synchronous version of addMemory for backwards compatibility
   * Does not perform embedding or deduplication
   * @deprecated Use async addMemory() instead
   */
  addMemorySync(entry: Omit<MemoryEntry, 'id'>): string {
    const id = uuidv4();

    this.vaultDb.insertWithVault('semantic_memory', {
      id,
      type: entry.type,
      content: entry.content,
      embedding: entry.embedding ? Buffer.from(new Float32Array(entry.embedding).buffer) : null,
      importance: entry.importance,
      decay: entry.decay,
      timestamp: entry.timestamp.toISOString(),
      metadata: JSON.stringify(entry.metadata || {})
    });

    return id;
  }

  /**
   * Boost a memory's importance (used for deduplication and reinforcement)
   * Only affects memories within the current vault.
   * @param id Memory ID to boost
   * @param boost Amount to add to importance (default 0.1)
   */
  async boostMemoryImportance(id: string, boost: number = 0.1): Promise<boolean> {
    // Use vault-scoped run to ensure we only update our own vault's memories
    const result = this.vaultDb.runWithVault(
      'UPDATE semantic_memory SET importance = MIN(importance + ?, 1.0) WHERE id = ?',
      [boost, id]
    );

    return result.changes > 0;
  }

  getMemory(id: string): MemoryEntry | null {
    // Use vault-scoped query
    const row = this.vaultDb.getWithVault('SELECT * FROM semantic_memory WHERE id = ?', [id]) as {
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
    const vaultId = this.getVaultId();
    let sql = 'SELECT * FROM semantic_memory WHERE vault_id = ?';
    const params: (string | number)[] = [vaultId];

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
   * Apply decay to all memories within the current vault
   */
  applyDecay(decayFactor: number = 0.99): void {
    const vaultId = this.getVaultId();

    // Vault-scoped decay
    this.db.prepare(`
      UPDATE semantic_memory SET importance = importance * ? WHERE vault_id = ?
    `).run(decayFactor, vaultId);

    // Delete memories below threshold (vault-scoped)
    this.db.prepare(`
      DELETE FROM semantic_memory WHERE vault_id = ? AND importance < 0.1
    `).run(vaultId);
  }

  /**
   * Update memory content (for batch find/replace operations)
   * Note: This will clear the embedding since content changed - re-embed if needed
   * Only affects memories within the current vault.
   * @param id Memory ID to update
   * @param newContent New content for the memory
   * @returns true if updated, false if not found
   */
  updateMemoryContent(id: string, newContent: string): boolean {
    // Clear embedding since content changed - it will need to be re-generated
    const result = this.vaultDb.runWithVault(
      'UPDATE semantic_memory SET content = ?, embedding = NULL WHERE id = ?',
      [newContent, id]
    );

    return result.changes > 0;
  }

  /**
   * Batch delete multiple memories by ID
   * Only deletes memories within the current vault.
   * @param ids Array of memory IDs to delete
   * @returns Number of memories deleted
   */
  batchDelete(ids: string[]): number {
    if (ids.length === 0) return 0;

    const vaultId = this.getVaultId();

    // Use a transaction for efficiency and atomicity
    const deleteStmt = this.db.prepare('DELETE FROM semantic_memory WHERE id = ? AND vault_id = ?');

    let deletedCount = 0;
    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        const result = deleteStmt.run(id, vaultId);
        deletedCount += result.changes;
      }
    });

    transaction();
    return deletedCount;
  }

  /**
   * Delete a single memory by ID
   * Only deletes memories within the current vault.
   * @param id Memory ID to delete
   * @returns true if deleted, false if not found
   */
  deleteMemory(id: string): boolean {
    const result = this.vaultDb.deleteWithVault('semantic_memory', 'id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Get all memories for the current vault (for batch operations)
   * @returns Array of all memory entries in the current vault
   */
  getAllMemories(): MemoryEntry[] {
    const vaultId = this.getVaultId();
    const rows = this.db.prepare(`
      SELECT * FROM semantic_memory WHERE vault_id = ? ORDER BY importance DESC, timestamp DESC
    `).all(vaultId) as Array<{
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
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer.slice(
        row.embedding.byteOffset,
        row.embedding.byteOffset + row.embedding.byteLength
      ))) : undefined,
      importance: row.importance,
      decay: row.decay,
      timestamp: new Date(row.timestamp),
      metadata: JSON.parse(row.metadata)
    }));
  }

  // ============================================================================
  // Semantic Search (Ralph Iteration 4 - Feature 1)
  // ============================================================================

  /**
   * Add memory with embedding (vault-scoped)
   */
  addMemoryWithEmbedding(entry: Omit<MemoryEntry, 'id'>, embedding: number[]): string {
    const id = uuidv4();

    this.vaultDb.insertWithVault('semantic_memory', {
      id,
      type: entry.type,
      content: entry.content,
      embedding: Buffer.from(new Float32Array(embedding).buffer),
      importance: entry.importance,
      decay: entry.decay,
      timestamp: entry.timestamp.toISOString(),
      metadata: JSON.stringify(entry.metadata || {})
    });

    return id;
  }

  /**
   * Get all memories with embeddings for semantic search (vault-scoped)
   * Only returns memories from the current vault.
   */
  getMemoriesWithEmbeddings(): Array<MemoryEntry & { embedding: number[] }> {
    const vaultId = this.getVaultId();
    const rows = this.db.prepare(`
      SELECT * FROM semantic_memory WHERE vault_id = ? AND embedding IS NOT NULL
      ORDER BY importance DESC
    `).all(vaultId) as Array<{
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
   * Semantic similarity search using cosine similarity (vault-scoped)
   * Only searches memories within the current vault, ensuring vault isolation.
   */
  semanticSearch(queryEmbedding: number[], options: {
    type?: 'episodic' | 'semantic' | 'identity';
    minSimilarity?: number;
    limit?: number;
  } = {}): Array<MemoryEntry & { similarity: number }> {
    const { type, minSimilarity = 0.3, limit = 10 } = options;

    // Get all memories with embeddings (already vault-scoped)
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

  /**
   * Backfill embeddings for existing memories that don't have them (vault-scoped)
   * Useful for migrating old memories or recovering from embedding failures
   * Only processes memories within the current vault.
   * @param options Options for backfill behavior
   * @returns Summary of backfill operation
   */
  async backfillEmbeddings(options: {
    batchSize?: number;
    type?: 'episodic' | 'semantic' | 'identity';
    onProgress?: (processed: number, total: number) => void;
  } = {}): Promise<{
    total: number;
    processed: number;
    failed: number;
    skipped: number;
  }> {
    const { batchSize = 10, type, onProgress } = options;
    const vaultId = this.getVaultId();

    // Get all memories without embeddings (vault-scoped)
    let sql = 'SELECT id, content FROM semantic_memory WHERE vault_id = ? AND embedding IS NULL';
    const params: (string)[] = [vaultId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      content: string;
    }>;

    const total = rows.length;
    let processed = 0;
    let failed = 0;
    const skipped = 0;

    // Process in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const contents = batch.map(r => r.content);

      try {
        const embeddings = await this.embeddingService.embedBatch(contents);

        // Update each memory with its embedding (vault-scoped to prevent cross-vault updates)
        const updateStmt = this.db.prepare(`
          UPDATE semantic_memory
          SET embedding = ?
          WHERE id = ? AND vault_id = ?
        `);

        for (let j = 0; j < batch.length; j++) {
          try {
            updateStmt.run(
              Buffer.from(new Float32Array(embeddings[j]).buffer),
              batch[j].id,
              vaultId
            );
            processed++;
          } catch (err) {
            console.warn(`Failed to update memory ${batch[j].id}:`, err);
            failed++;
          }
        }
      } catch (err) {
        console.warn(`Failed to generate embeddings for batch starting at ${i}:`, err);
        failed += batch.length;
      }

      // Report progress
      if (onProgress) {
        onProgress(i + batch.length, total);
      }
    }

    return { total, processed, failed, skipped };
  }

  /**
   * Get count of memories with and without embeddings (vault-scoped)
   * Useful for monitoring embedding coverage within the current vault.
   */
  getEmbeddingCoverage(): {
    total: number;
    withEmbedding: number;
    withoutEmbedding: number;
    coveragePercent: number;
  } {
    const vaultId = this.getVaultId();
    const total = this.db.prepare('SELECT COUNT(*) as count FROM semantic_memory WHERE vault_id = ?').get(vaultId) as { count: number };
    const withEmbedding = this.db.prepare('SELECT COUNT(*) as count FROM semantic_memory WHERE vault_id = ? AND embedding IS NOT NULL').get(vaultId) as { count: number };

    const totalCount = total.count;
    const withCount = withEmbedding.count;
    const withoutCount = totalCount - withCount;

    return {
      total: totalCount,
      withEmbedding: withCount,
      withoutEmbedding: withoutCount,
      coveragePercent: totalCount > 0 ? (withCount / totalCount) * 100 : 100
    };
  }

  // ============================================================================
  // Evolution Persistence (Ralph Iteration 1 - Feature 4)
  // ============================================================================

  /**
   * Save an evolution snapshot (vault-scoped)
   */
  saveEvolutionSnapshot(
    conversationId: string,
    stance: Stance,
    trigger: 'drift_threshold' | 'frame_shift' | 'manual' | 'session_end'
  ): string {
    const id = uuidv4();

    this.vaultDb.insertWithVault('evolution_snapshots', {
      id,
      conversation_id: conversationId,
      stance: JSON.stringify(stance),
      trigger,
      drift_at_snapshot: stance.cumulativeDrift,
      timestamp: new Date().toISOString()
    });

    return id;
  }

  /**
   * Get the latest evolution snapshot for a conversation (vault-scoped)
   */
  getLatestSnapshot(conversationId: string): { stance: Stance; trigger: string; timestamp: Date } | null {
    const vaultId = this.getVaultId();
    const row = this.db.prepare(`
      SELECT stance, trigger, timestamp
      FROM evolution_snapshots
      WHERE vault_id = ? AND conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(vaultId, conversationId) as { stance: string; trigger: string; timestamp: string } | undefined;

    if (!row) return null;

    return {
      stance: JSON.parse(row.stance),
      trigger: row.trigger,
      timestamp: new Date(row.timestamp)
    };
  }

  /**
   * Get the latest snapshot across all conversations within the current vault (for session resume)
   */
  getGlobalLatestSnapshot(): { conversationId: string; stance: Stance; trigger: string; timestamp: Date } | null {
    const vaultId = this.getVaultId();
    const row = this.db.prepare(`
      SELECT conversation_id, stance, trigger, timestamp
      FROM evolution_snapshots
      WHERE vault_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(vaultId) as { conversation_id: string; stance: string; trigger: string; timestamp: string } | undefined;

    if (!row) return null;

    return {
      conversationId: row.conversation_id,
      stance: JSON.parse(row.stance),
      trigger: row.trigger,
      timestamp: new Date(row.timestamp)
    };
  }

  /**
   * Get evolution timeline for a conversation (vault-scoped)
   */
  getEvolutionTimeline(conversationId: string, limit: number = 20): Array<{
    id: string;
    stance: Stance;
    trigger: string;
    driftAtSnapshot: number;
    timestamp: Date;
  }> {
    const vaultId = this.getVaultId();
    const rows = this.db.prepare(`
      SELECT id, stance, trigger, drift_at_snapshot, timestamp
      FROM evolution_snapshots
      WHERE vault_id = ? AND conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(vaultId, conversationId, limit) as Array<{
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
   * Session info returned by list/get operations (vault-scoped)
   */
  getSessionInfo(sessionId: string): SessionInfo | null {
    const row = this.vaultDb.getWithVault(
      'SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift FROM sessions WHERE id = ?',
      [sessionId]
    ) as {
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
   * Create or update a session (vault-scoped)
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
    const vaultId = this.getVaultId();

    if (existing) {
      // Update existing session (vault-scoped)
      this.db.prepare(`
        UPDATE sessions
        SET name = COALESCE(?, name),
            conversation_id = COALESCE(?, conversation_id),
            last_accessed = ?,
            message_count = COALESCE(?, message_count),
            current_frame = COALESCE(?, current_frame),
            current_drift = COALESCE(?, current_drift)
        WHERE id = ? AND vault_id = ?
      `).run(
        session.name ?? null,
        session.conversationId ?? null,
        now,
        session.messageCount ?? null,
        session.currentFrame ?? null,
        session.currentDrift ?? null,
        session.id,
        vaultId
      );
    } else {
      // Create new session (vault-scoped)
      this.vaultDb.insertWithVault('sessions', {
        id: session.id,
        name: session.name ?? null,
        conversation_id: session.conversationId ?? null,
        last_accessed: now,
        created_at: now,
        message_count: session.messageCount ?? 0,
        current_frame: session.currentFrame ?? null,
        current_drift: session.currentDrift ?? 0
      });
    }
  }

  /**
   * List all sessions with metadata (vault-scoped)
   */
  listSessions(options: { limit?: number; search?: string } = {}): SessionInfo[] {
    const vaultId = this.getVaultId();
    let sql = `
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
      WHERE vault_id = ?
    `;
    const params: (string | number)[] = [vaultId];

    if (options.search) {
      sql += ' AND (name LIKE ? OR id LIKE ?)';
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
   * Rename a session (vault-scoped)
   */
  renameSession(sessionId: string, newName: string): boolean {
    const result = this.vaultDb.runWithVault(
      'UPDATE sessions SET name = ?, last_accessed = ? WHERE id = ?',
      [newName, new Date().toISOString(), sessionId]
    );
    return result.changes > 0;
  }

  /**
   * Delete a session (vault-scoped)
   */
  deleteSession(sessionId: string): boolean {
    const result = this.vaultDb.deleteWithVault('sessions', 'id = ?', [sessionId]);
    return result.changes > 0;
  }

  /**
   * Get most recently accessed session within the current vault
   */
  getMostRecentSession(): SessionInfo | null {
    const vaultId = this.getVaultId();
    const row = this.db.prepare(`
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
      WHERE vault_id = ?
      ORDER BY last_accessed DESC
      LIMIT 1
    `).get(vaultId) as {
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
   * Record operator performance for learning (vault-scoped)
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

    this.vaultDb.insertWithVault('operator_performance', {
      id,
      operator_name: entry.operatorName,
      trigger_type: entry.triggerType,
      effectiveness_score: effectivenessScore,
      transformation_score: transformationScore,
      coherence_score: coherenceScore,
      drift_cost: driftCost,
      timestamp: new Date().toISOString()
    });

    return id;
  }

  /**
   * Get operator performance statistics (vault-scoped)
   */
  getOperatorStats(operatorName?: string): OperatorStats[] {
    const vaultId = this.getVaultId();
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
      WHERE vault_id = ?
    `;
    const params: string[] = [vaultId];

    if (operatorName) {
      sql += ' AND operator_name = ?';
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
   * Get weighted operator score for Bayesian selection (vault-scoped)
   */
  getOperatorWeight(operatorName: string, triggerType: string): number {
    const vaultId = this.getVaultId();
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as usage_count,
        AVG(effectiveness_score) as avg_effectiveness
      FROM operator_performance
      WHERE vault_id = ? AND operator_name = ? AND trigger_type = ?
    `).get(vaultId, operatorName, triggerType) as {
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
   * Cache a subagent result (vault-scoped)
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

    this.vaultDb.insertWithVault('subagent_results', {
      id,
      subagent_name: entry.subagentName,
      task: entry.task,
      response: entry.response,
      key_findings: entry.keyFindings ? JSON.stringify(entry.keyFindings) : null,
      relevance: entry.relevance,
      conversation_id: entry.conversationId || null,
      timestamp: new Date().toISOString(),
      expiry
    });

    return id;
  }

  /**
   * Search for relevant cached subagent results (vault-scoped)
   */
  searchSubagentCache(query: {
    subagentName?: string;
    task?: string;
    minRelevance?: number;
    limit?: number;
  }): SubagentResult[] {
    const vaultId = this.getVaultId();
    let sql = `
      SELECT * FROM subagent_results
      WHERE vault_id = ? AND (expiry IS NULL OR expiry > datetime('now'))
    `;
    const params: (string | number)[] = [vaultId];

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
   * Clean expired subagent results (vault-scoped)
   */
  cleanExpiredSubagentResults(): number {
    const vaultId = this.getVaultId();
    const result = this.db.prepare(`
      DELETE FROM subagent_results WHERE vault_id = ? AND expiry IS NOT NULL AND expiry < datetime('now')
    `).run(vaultId);
    return result.changes;
  }

  // ============================================================================
  // Emotional Arc Persistence (Ralph Iteration 3 - Feature 6)
  // ============================================================================

  /**
   * Save an emotional arc for a conversation (vault-scoped)
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

    this.vaultDb.upsertWithVault('emotional_arcs', {
      id: conversationId, // Use conversationId as id for simplicity
      conversation_id: conversationId,
      emotions: JSON.stringify(arc.points),
      insights: JSON.stringify(arc.insights),
      patterns: JSON.stringify(arc.patterns),
      trend,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Get an emotional arc for a conversation (vault-scoped)
   */
  getEmotionalArc(conversationId: string): EmotionalArc | null {
    const row = this.vaultDb.getWithVault(
      'SELECT conversation_id, emotions, insights, patterns, trend, updated_at FROM emotional_arcs WHERE conversation_id = ?',
      [conversationId]
    ) as {
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
   * Delete an emotional arc for a conversation (vault-scoped)
   */
  deleteEmotionalArc(conversationId: string): boolean {
    const result = this.vaultDb.deleteWithVault('emotional_arcs', 'conversation_id = ?', [conversationId]);
    return result.changes > 0;
  }

  // ============================================================================
  // Emotion Context Persistence (for Empathy Mode)
  // ============================================================================

  /**
   * Save an emotion context for a session (vault-scoped)
   */
  saveEmotionContext(sessionId: string, emotion: EmotionContext): Promise<void> {
    const id = uuidv4();
    const timestamp = emotion.timestamp || new Date().toISOString();

    this.vaultDb.insertWithVault('emotion_context', {
      id,
      session_id: sessionId,
      current_emotion: emotion.currentEmotion,
      valence: emotion.valence,
      arousal: emotion.arousal,
      confidence: emotion.confidence,
      stability: emotion.stability ?? null,
      prompt_context: emotion.promptContext ?? null,
      suggested_empathy_boost: emotion.suggestedEmpathyBoost ?? null,
      timestamp
    });

    return Promise.resolve();
  }

  /**
   * Get the latest emotion context for a session (vault-scoped)
   */
  getLatestEmotionContext(sessionId: string): Promise<EmotionContext | null> {
    const vaultId = this.getVaultId();
    const row = this.db.prepare(`
      SELECT current_emotion, valence, arousal, confidence, stability, prompt_context, suggested_empathy_boost, timestamp
      FROM emotion_context
      WHERE vault_id = ? AND session_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(vaultId, sessionId) as {
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
   * Get emotion history for a session (vault-scoped)
   */
  getEmotionHistory(sessionId: string, limit: number = 50): Promise<EmotionContext[]> {
    const vaultId = this.getVaultId();
    const rows = this.db.prepare(`
      SELECT current_emotion, valence, arousal, confidence, stability, prompt_context, suggested_empathy_boost, timestamp
      FROM emotion_context
      WHERE vault_id = ? AND session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(vaultId, sessionId, limit) as Array<{
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
   * Clear all data for the current vault (for testing)
   * Only clears data belonging to the current vault, preserving other vaults' data.
   */
  clear(): void {
    const vaultId = this.getVaultId();
    this.db.prepare('DELETE FROM messages WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM conversations WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM identity WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM semantic_memory WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM evolution_snapshots WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM sessions WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM operator_performance WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM subagent_results WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM emotional_arcs WHERE vault_id = ?').run(vaultId);
    this.db.prepare('DELETE FROM emotion_context WHERE vault_id = ?').run(vaultId);
  }

  /**
   * Clear all data across ALL vaults (for testing/migration purposes)
   * WARNING: This removes ALL data, not just the current vault's data.
   */
  clearAll(): void {
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
