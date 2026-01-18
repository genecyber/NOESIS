/**
 * MemoryStore - SQLite-based persistent memory for conversations and identity
 */
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
export class MemoryStore {
    db;
    constructor(options = {}) {
        const dbPath = options.inMemory ? ':memory:' : (options.dbPath || './data/metamorph.db');
        this.db = new Database(dbPath);
        this.initSchema();
    }
    initSchema() {
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
    }
    // ============================================================================
    // Conversation Management
    // ============================================================================
    saveConversation(conversation) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (id, stance, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(conversation.id, JSON.stringify(conversation.stance), JSON.stringify(conversation.config), conversation.createdAt.toISOString(), conversation.updatedAt.toISOString());
        // Save messages
        const msgStmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, conversation_id, role, content, stance, tools_used, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (const msg of conversation.messages) {
            msgStmt.run(uuidv4(), conversation.id, msg.role, msg.content, msg.stance ? JSON.stringify(msg.stance) : null, msg.toolsUsed ? JSON.stringify(msg.toolsUsed) : null, msg.timestamp.toISOString());
        }
    }
    loadConversation(id) {
        const convRow = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(id);
        if (!convRow)
            return null;
        const msgRows = this.db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
    `).all(id);
        const messages = msgRows.map(row => ({
            role: row.role,
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
    listConversations() {
        const rows = this.db.prepare(`
      SELECT c.id, c.created_at, c.updated_at, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all();
        return rows.map(row => ({
            id: row.id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            messageCount: row.message_count
        }));
    }
    deleteConversation(id) {
        const result = this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
        this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
        return result.changes > 0;
    }
    // ============================================================================
    // Identity Management
    // ============================================================================
    saveIdentity(identity) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO identity (
        id, self_model, persistent_values, emergent_goals, consciousness_insights,
        awareness_level, autonomy_level, identity_strength, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(identity.id, identity.selfModel, JSON.stringify(identity.persistentValues), JSON.stringify(identity.emergentGoals), JSON.stringify(identity.consciousnessInsights), identity.awarenessLevel, identity.autonomyLevel, identity.identityStrength, identity.createdAt.toISOString(), identity.updatedAt.toISOString());
    }
    loadIdentity(id) {
        let row;
        if (id) {
            row = this.db.prepare('SELECT * FROM identity WHERE id = ?').get(id);
        }
        else {
            // Get the most recent identity
            row = this.db.prepare('SELECT * FROM identity ORDER BY updated_at DESC LIMIT 1').get();
        }
        if (!row)
            return null;
        return {
            id: row.id,
            selfModel: row.self_model,
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
    createIdentityFromStance(stance) {
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
    addMemory(entry) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
      INSERT INTO semantic_memory (id, type, content, embedding, importance, decay, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, entry.type, entry.content, entry.embedding ? Buffer.from(new Float32Array(entry.embedding).buffer) : null, entry.importance, entry.decay, entry.timestamp.toISOString(), JSON.stringify(entry.metadata || {}));
        return id;
    }
    getMemory(id) {
        const row = this.db.prepare('SELECT * FROM semantic_memory WHERE id = ?').get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            type: row.type,
            content: row.content,
            embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
            importance: row.importance,
            decay: row.decay,
            timestamp: new Date(row.timestamp),
            metadata: JSON.parse(row.metadata)
        };
    }
    searchMemories(query) {
        let sql = 'SELECT * FROM semantic_memory WHERE 1=1';
        const params = [];
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
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(row => ({
            id: row.id,
            type: row.type,
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
    applyDecay(decayFactor = 0.99) {
        this.db.prepare(`
      UPDATE semantic_memory SET importance = importance * ?
    `).run(decayFactor);
        // Delete memories below threshold
        this.db.prepare(`
      DELETE FROM semantic_memory WHERE importance < 0.1
    `).run();
    }
    // ============================================================================
    // Evolution Persistence (Ralph Iteration 1 - Feature 4)
    // ============================================================================
    /**
     * Save an evolution snapshot
     */
    saveEvolutionSnapshot(conversationId, stance, trigger) {
        const id = uuidv4();
        this.db.prepare(`
      INSERT INTO evolution_snapshots (id, conversation_id, stance, trigger, drift_at_snapshot, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, JSON.stringify(stance), trigger, stance.cumulativeDrift, new Date().toISOString());
        return id;
    }
    /**
     * Get the latest evolution snapshot for a conversation
     */
    getLatestSnapshot(conversationId) {
        const row = this.db.prepare(`
      SELECT stance, trigger, timestamp
      FROM evolution_snapshots
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(conversationId);
        if (!row)
            return null;
        return {
            stance: JSON.parse(row.stance),
            trigger: row.trigger,
            timestamp: new Date(row.timestamp)
        };
    }
    /**
     * Get the latest snapshot across all conversations (for session resume)
     */
    getGlobalLatestSnapshot() {
        const row = this.db.prepare(`
      SELECT conversation_id, stance, trigger, timestamp
      FROM evolution_snapshots
      ORDER BY timestamp DESC
      LIMIT 1
    `).get();
        if (!row)
            return null;
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
    getEvolutionTimeline(conversationId, limit = 20) {
        const rows = this.db.prepare(`
      SELECT id, stance, trigger, drift_at_snapshot, timestamp
      FROM evolution_snapshots
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(conversationId, limit);
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
    shouldAutoSnapshot(conversationId, currentDrift, threshold = 20) {
        const latest = this.getLatestSnapshot(conversationId);
        if (!latest)
            return currentDrift >= threshold;
        const driftSinceSnapshot = currentDrift - latest.stance.cumulativeDrift;
        return driftSinceSnapshot >= threshold;
    }
    // ============================================================================
    // Session Management (Ralph Iteration 2 - Feature 2)
    // ============================================================================
    /**
     * Session info returned by list/get operations
     */
    getSessionInfo(sessionId) {
        const row = this.db.prepare(`
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions WHERE id = ?
    `).get(sessionId);
        if (!row)
            return null;
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
    saveSession(session) {
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
      `).run(session.name ?? null, session.conversationId ?? null, now, session.messageCount ?? null, session.currentFrame ?? null, session.currentDrift ?? null, session.id);
        }
        else {
            // Create new session
            this.db.prepare(`
        INSERT INTO sessions (id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(session.id, session.name ?? null, session.conversationId ?? null, now, now, session.messageCount ?? 0, session.currentFrame ?? null, session.currentDrift ?? 0);
        }
    }
    /**
     * List all sessions with metadata
     */
    listSessions(options = {}) {
        let sql = `
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
    `;
        const params = [];
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
        const rows = this.db.prepare(sql).all(...params);
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
    renameSession(sessionId, newName) {
        const result = this.db.prepare(`
      UPDATE sessions SET name = ?, last_accessed = ? WHERE id = ?
    `).run(newName, new Date().toISOString(), sessionId);
        return result.changes > 0;
    }
    /**
     * Delete a session
     */
    deleteSession(sessionId) {
        const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        return result.changes > 0;
    }
    /**
     * Get most recently accessed session
     */
    getMostRecentSession() {
        const row = this.db.prepare(`
      SELECT id, name, conversation_id, last_accessed, created_at, message_count, current_frame, current_drift
      FROM sessions
      ORDER BY last_accessed DESC
      LIMIT 1
    `).get();
        if (!row)
            return null;
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
    // Utility
    // ============================================================================
    close() {
        this.db.close();
    }
    /**
     * Clear all data (for testing)
     */
    clear() {
        this.db.prepare('DELETE FROM messages').run();
        this.db.prepare('DELETE FROM conversations').run();
        this.db.prepare('DELETE FROM identity').run();
        this.db.prepare('DELETE FROM semantic_memory').run();
        this.db.prepare('DELETE FROM evolution_snapshots').run();
        this.db.prepare('DELETE FROM sessions').run();
    }
}
//# sourceMappingURL=store.js.map