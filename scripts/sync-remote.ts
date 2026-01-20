#!/usr/bin/env npx ts-node
/**
 * Sync memories from remote NOESIS server to local SQLite database
 *
 * Fetches all memories from the remote server and merges them into
 * the local database, avoiding duplicates by content hash.
 *
 * Usage:
 *   npx ts-node scripts/sync-remote.ts
 *   npm run sync:remote
 *
 * Environment:
 *   NOESIS_REMOTE_URL - Remote server URL (required)
 *   DATABASE_PATH - Local database path (default: ./data/metamorph.db)
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REMOTE_URL = process.env.NOESIS_REMOTE_URL;
const DB_PATH = process.env.DATABASE_PATH || './data/metamorph.db';

interface MemoryRow {
  id: string;
  type: string;
  content: string;
  importance: number;
  timestamp: string;
  embedding?: string;
  metadata?: string;
}

interface RemoteMemory {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  timestamp?: string;
  createdAt?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

function hashContent(content: string): string {
  return createHash('md5').update(content.trim().toLowerCase()).digest('hex');
}

async function fetchRemoteMemories(): Promise<RemoteMemory[]> {
  if (!REMOTE_URL) {
    throw new Error('NOESIS_REMOTE_URL not set in environment');
  }

  console.log(`Fetching memories from: ${REMOTE_URL}/api/memories`);

  const response = await fetch(`${REMOTE_URL}/api/memories?limit=10000`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch remote memories: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.memories || [];
}

async function main() {
  console.log('='.repeat(60));
  console.log('NOESIS Remote Sync');
  console.log('='.repeat(60));

  if (!REMOTE_URL) {
    console.error('Error: NOESIS_REMOTE_URL not set in .env');
    console.error('Add: NOESIS_REMOTE_URL=https://your-server.railway.app');
    process.exit(1);
  }

  console.log(`Remote: ${REMOTE_URL}`);
  console.log(`Local DB: ${DB_PATH}`);
  console.log('');

  // Fetch remote memories
  let remoteMemories: RemoteMemory[];
  try {
    remoteMemories = await fetchRemoteMemories();
    console.log(`Remote memories: ${remoteMemories.length}`);
  } catch (error) {
    console.error('Failed to fetch remote memories:', error);
    process.exit(1);
  }

  if (remoteMemories.length === 0) {
    console.log('No remote memories to sync');
    return;
  }

  // Open local database
  const db = new Database(DB_PATH);

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_memory (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      embedding TEXT,
      metadata TEXT
    )
  `);

  // Get existing local memories and build content hash set
  const localMemories = db.prepare('SELECT id, content, type FROM semantic_memory').all() as MemoryRow[];
  console.log(`Local memories: ${localMemories.length}`);

  const localHashes = new Set<string>();
  for (const mem of localMemories) {
    localHashes.add(hashContent(mem.content));
  }

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO semantic_memory (id, type, content, importance, timestamp, embedding, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert new memories
  let inserted = 0;
  let skipped = 0;

  const insertMany = db.transaction((memories: RemoteMemory[]) => {
    for (const mem of memories) {
      const contentHash = hashContent(mem.content);

      if (localHashes.has(contentHash)) {
        skipped++;
        continue;
      }

      const timestamp = mem.timestamp || mem.createdAt || new Date().toISOString();
      const embedding = mem.embedding ? JSON.stringify(mem.embedding) : null;
      const metadata = mem.metadata ? JSON.stringify(mem.metadata) : null;

      insertStmt.run(
        mem.id,
        mem.type,
        mem.content,
        mem.importance,
        timestamp,
        embedding,
        metadata
      );

      localHashes.add(contentHash); // Prevent duplicates within batch
      inserted++;
    }
  });

  insertMany(remoteMemories);

  // Get final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM semantic_memory').get() as { count: number };

  console.log('');
  console.log('Sync Results:');
  console.log(`  - New memories added: ${inserted}`);
  console.log(`  - Duplicates skipped: ${skipped}`);
  console.log(`  - Total local memories: ${finalCount.count}`);

  db.close();
  console.log('');
  console.log('Sync complete!');
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
