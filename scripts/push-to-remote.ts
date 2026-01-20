#!/usr/bin/env tsx
/**
 * Push local memories to remote NOESIS deployment
 *
 * Usage: npx tsx scripts/push-to-remote.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const REMOTE_URL = process.env.NOESIS_REMOTE_URL || 'https://miraculous-truth-production.up.railway.app';
const LOCAL_DB_PATH = process.env.NOESIS_DB_PATH || './data/metamorph.db';

interface LocalMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  decay: number;
  timestamp: string;
  metadata: string | null;
}

async function getLocalMemories(): Promise<LocalMemory[]> {
  const dbPath = path.resolve(LOCAL_DB_PATH);
  console.log(`[Push] Reading from local database: ${dbPath}`);

  const db = new Database(dbPath, { readonly: true });

  const memories = db.prepare(`
    SELECT id, type, content, importance, decay, timestamp, metadata
    FROM semantic_memory
    ORDER BY timestamp ASC
  `).all() as LocalMemory[];

  db.close();
  return memories;
}

async function pushMemoriesToRemote(memories: LocalMemory[], sessionId: string): Promise<{ synced: number; failed: number }> {
  // Convert to API format
  const apiMemories = memories.map(m => ({
    id: m.id,
    type: m.type as 'episodic' | 'semantic' | 'identity',
    content: m.content,
    importance: m.importance,
    timestamp: new Date(m.timestamp).getTime(),
    metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
  }));

  // Send in batches of 50
  const batchSize = 50;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < apiMemories.length; i += batchSize) {
    const batch = apiMemories.slice(i, i + batchSize);
    console.log(`[Push] Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(apiMemories.length / batchSize)} (${batch.length} memories)`);

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

      if (!response.ok) {
        const text = await response.text();
        console.error(`[Push] Batch failed: ${response.status} - ${text}`);
        failed += batch.length;
      } else {
        const result = await response.json();
        synced += result.synced || batch.length;
      }
    } catch (error) {
      console.error(`[Push] Batch error:`, error);
      failed += batch.length;
    }
  }

  return { synced, failed };
}

async function getRemoteMemoryCount(sessionId: string): Promise<number> {
  try {
    const response = await fetch(`${REMOTE_URL}/api/memories?sessionId=${sessionId}&limit=1`);
    if (!response.ok) return 0;
    const data = await response.json();
    return data.total || data.memories?.length || 0;
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`[Push] Starting push to ${REMOTE_URL}`);

  // Default session ID - can be overridden via args
  const sessionId = process.argv[2] || 'default';
  console.log(`[Push] Using session ID: ${sessionId}`);

  // Get local memories
  const localMemories = await getLocalMemories();
  console.log(`[Push] Found ${localMemories.length} local memories`);

  if (localMemories.length === 0) {
    console.log('[Push] No memories to push');
    return;
  }

  // Check remote count before
  const remoteBefore = await getRemoteMemoryCount(sessionId);
  console.log(`[Push] Remote has ${remoteBefore} memories before push`);

  // Push memories
  const { synced, failed } = await pushMemoriesToRemote(localMemories, sessionId);

  // Check remote count after
  const remoteAfter = await getRemoteMemoryCount(sessionId);

  console.log(`[Push] Complete!`);
  console.log(`[Push] Synced: ${synced}, Failed: ${failed}`);
  console.log(`[Push] Remote memories: ${remoteBefore} -> ${remoteAfter}`);
}

main().catch(console.error);
