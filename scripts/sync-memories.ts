#!/usr/bin/env tsx
/**
 * Bidirectional memory sync between local and remote
 *
 * 1. Pull all memories from remote
 * 2. Merge with local (dedupe by content)
 * 3. Push merged result back to remote
 *
 * Usage: npx tsx scripts/sync-memories.ts [sessionId]
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const REMOTE_URL = process.env.NOESIS_REMOTE_URL || 'https://miraculous-truth-production.up.railway.app';
const LOCAL_DB_PATH = process.env.NOESIS_DB_PATH || './data/metamorph.db';

interface Memory {
  id: string;
  type: string;
  content: string;
  importance: number;
  decay: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface RemoteMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Step 1: Pull from remote
// ─────────────────────────────────────────────────────────────
async function fetchRemoteMemories(_sessionId: string): Promise<RemoteMemory[]> {
  console.log(`[Sync] Fetching memories from ${REMOTE_URL}...`);

  try {
    // Don't filter by sessionId - memories may not have session association
    const response = await fetch(`${REMOTE_URL}/api/memories?limit=10000`);
    if (!response.ok) {
      console.error(`[Sync] Failed to fetch: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.memories || [];
  } catch (error) {
    console.error('[Sync] Fetch error:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Step 2: Get local memories
// ─────────────────────────────────────────────────────────────
function getLocalMemories(db: Database.Database): Memory[] {
  return db.prepare(`
    SELECT id, type, content, importance, decay, timestamp, metadata
    FROM semantic_memory
  `).all() as Memory[];
}

// ─────────────────────────────────────────────────────────────
// Step 3: Merge (dedupe by content hash)
// ─────────────────────────────────────────────────────────────
function mergeMemories(local: Memory[], remote: RemoteMemory[]): {
  merged: Memory[];
  newFromRemote: number;
  duplicates: number;
} {
  // Create content-based index of local memories
  const contentIndex = new Map<string, Memory>();
  for (const mem of local) {
    const key = `${mem.type}:${mem.content}`;
    contentIndex.set(key, mem);
  }

  let newFromRemote = 0;
  let duplicates = 0;

  // Add remote memories that don't exist locally
  for (const remoteMem of remote) {
    const key = `${remoteMem.type}:${remoteMem.content}`;

    if (!contentIndex.has(key)) {
      // New memory from remote
      const localMem: Memory = {
        id: remoteMem.id,
        type: remoteMem.type,
        content: remoteMem.content,
        importance: remoteMem.importance,
        decay: 0.01, // Default decay
        timestamp: remoteMem.timestamp,
        metadata: remoteMem.metadata,
      };
      contentIndex.set(key, localMem);
      newFromRemote++;
    } else {
      duplicates++;
    }
  }

  return {
    merged: Array.from(contentIndex.values()),
    newFromRemote,
    duplicates,
  };
}

// ─────────────────────────────────────────────────────────────
// Step 4: Save merged to local DB
// ─────────────────────────────────────────────────────────────
function saveToLocal(db: Database.Database, memories: Memory[]): number {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO semantic_memory
    (id, type, content, importance, decay, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let saved = 0;
  const transaction = db.transaction(() => {
    for (const mem of memories) {
      insertStmt.run(
        mem.id,
        mem.type,
        mem.content,
        mem.importance,
        mem.decay,
        mem.timestamp,
        mem.metadata ? JSON.stringify(mem.metadata) : null
      );
      saved++;
    }
  });

  transaction();
  return saved;
}

// ─────────────────────────────────────────────────────────────
// Step 5: Push merged to remote
// ─────────────────────────────────────────────────────────────
async function pushToRemote(memories: Memory[], sessionId: string): Promise<number> {
  const apiMemories = memories.map(m => ({
    id: m.id,
    type: m.type as 'episodic' | 'semantic' | 'identity',
    content: m.content,
    importance: m.importance,
    timestamp: new Date(m.timestamp).getTime(),
    metadata: m.metadata,
  }));

  // Batch push
  const batchSize = 50;
  let synced = 0;

  for (let i = 0; i < apiMemories.length; i += batchSize) {
    const batch = apiMemories.slice(i, i + batchSize);

    try {
      const response = await fetch(`${REMOTE_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'memories',
          sessionId,
          data: batch,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        synced += result.synced || batch.length;
      }
    } catch (error) {
      console.error(`[Sync] Push batch error:`, error);
    }
  }

  return synced;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const sessionId = process.argv[2] || 'default';
  console.log(`\n🔄 BIDIRECTIONAL MEMORY SYNC`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   Remote:  ${REMOTE_URL}`);
  console.log(`   Local:   ${LOCAL_DB_PATH}\n`);

  const dbPath = path.resolve(LOCAL_DB_PATH);
  const db = new Database(dbPath);

  // Ensure table exists
  db.exec(`
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

  // Step 1: Pull from remote
  const remoteMemories = await fetchRemoteMemories(sessionId);
  console.log(`[1/5] Pulled ${remoteMemories.length} memories from remote`);

  // Step 2: Get local
  const localMemories = getLocalMemories(db);
  console.log(`[2/5] Found ${localMemories.length} memories locally`);

  // Step 3: Merge
  const { merged, newFromRemote, duplicates } = mergeMemories(localMemories, remoteMemories);
  console.log(`[3/5] Merged: ${merged.length} total (${newFromRemote} new from remote, ${duplicates} duplicates)`);

  // Step 4: Save to local
  const saved = saveToLocal(db, merged);
  console.log(`[4/5] Saved ${saved} memories to local DB`);

  db.close();

  // Step 5: Push to remote
  console.log(`[5/5] Pushing merged set to remote...`);
  const pushed = await pushToRemote(merged, sessionId);
  console.log(`      Pushed ${pushed} memories to remote`);

  console.log(`\n✅ Sync complete!`);
  console.log(`   Local:  ${merged.length} memories`);
  console.log(`   Remote: ${pushed} memories synced\n`);
}

main().catch(console.error);
