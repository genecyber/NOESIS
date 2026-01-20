#!/usr/bin/env npx ts-node
/**
 * Deduplicate memories in SQLite database
 *
 * Finds duplicate memories by content and keeps only the one with:
 * - Highest importance
 * - Most recent timestamp (as tiebreaker)
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';

const DB_PATH = './data/metamorph.db';

interface MemoryRow {
  id: string;
  type: string;
  content: string;
  importance: number;
  timestamp: string;
}

function hashContent(content: string): string {
  return createHash('md5').update(content.trim().toLowerCase()).digest('hex');
}

async function main() {
  console.log('Opening database:', DB_PATH);
  const db = new Database(DB_PATH);

  // Get all memories
  const memories = db.prepare('SELECT id, type, content, importance, timestamp FROM semantic_memory').all() as MemoryRow[];
  console.log(`Total memories: ${memories.length}`);

  // Group by content hash
  const groups = new Map<string, MemoryRow[]>();
  for (const mem of memories) {
    const hash = hashContent(mem.content);
    if (!groups.has(hash)) {
      groups.set(hash, []);
    }
    groups.get(hash)!.push(mem);
  }

  // Find duplicates
  let duplicateCount = 0;
  const toDelete: string[] = [];

  for (const [hash, group] of groups) {
    if (group.length > 1) {
      duplicateCount += group.length - 1;

      // Sort by importance DESC, then timestamp DESC
      group.sort((a, b) => {
        if (b.importance !== a.importance) {
          return b.importance - a.importance;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Keep the first one, delete the rest
      const keep = group[0];
      const dupes = group.slice(1);

      console.log(`\nDuplicate group (${group.length} copies):`);
      console.log(`  Content: "${keep.content.slice(0, 60)}..."`);
      console.log(`  Keeping: ${keep.id} (importance: ${keep.importance})`);
      console.log(`  Deleting: ${dupes.length} duplicates`);

      toDelete.push(...dupes.map(d => d.id));
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Unique memories: ${groups.size}`);
  console.log(`Duplicate memories to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('No duplicates found!');
    db.close();
    return;
  }

  // Delete duplicates in batches
  console.log('\nDeleting duplicates...');
  const deleteStmt = db.prepare('DELETE FROM semantic_memory WHERE id = ?');

  const deleteMany = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteStmt.run(id);
    }
  });

  deleteMany(toDelete);

  // Verify
  const remaining = db.prepare('SELECT COUNT(*) as count FROM semantic_memory').get() as { count: number };
  console.log(`\nRemaining memories: ${remaining.count}`);
  console.log(`Deleted: ${memories.length - remaining.count} duplicates`);

  db.close();
  console.log('Done!');
}

main().catch(console.error);
