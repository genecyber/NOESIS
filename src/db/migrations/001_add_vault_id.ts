/**
 * Migration 001: Add vault_id column to all tables
 *
 * Adds vault_id TEXT NOT NULL column to all user-scoped tables
 * for multitenancy support. Uses 'default-vault' as the default
 * value for existing data.
 *
 * Creates composite indexes for efficient vault-scoped queries.
 */

import type Database from 'better-sqlite3';
import type { Migration } from '../migrator.js';

/**
 * Tables that need vault_id column added
 * These are all the user-scoped tables in the Metamorph database
 */
const TABLES_TO_MIGRATE = [
  // Core tables from store.ts
  'sessions',
  'messages',
  'conversations',
  'semantic_memory',
  'identity',
  'evolution_snapshots',
  'operator_performance',
  'subagent_results',
  'emotional_arcs',
  'emotion_context',
  // Session persistence table
  'session_states',
  // Additional tables that may exist
  'identity_checkpoints',
  'operator_efficacy',
  'coherence_metrics',
  'persona_variants',
  'emergence_traces',
  'memory_associations',
  'memory_compression_queue',
  'remote_sync_queue',
  'identity_compression',
  'steering_messages'
];

/**
 * Composite indexes to create for efficient vault-scoped queries
 * Format: [tableName, indexName, columns[]]
 */
const COMPOSITE_INDEXES: Array<[string, string, string[]]> = [
  // Sessions and conversations
  ['sessions', 'idx_sessions_vault_id', ['vault_id', 'id']],
  ['sessions', 'idx_sessions_vault_accessed', ['vault_id', 'last_accessed']],
  ['session_states', 'idx_session_states_vault_id', ['vault_id', 'id']],
  ['session_states', 'idx_session_states_vault_activity', ['vault_id', 'last_activity']],
  ['conversations', 'idx_conversations_vault_id', ['vault_id', 'id']],
  ['conversations', 'idx_conversations_vault_updated', ['vault_id', 'updated_at']],

  // Messages
  ['messages', 'idx_messages_vault_id', ['vault_id', 'id']],
  ['messages', 'idx_messages_vault_conversation', ['vault_id', 'conversation_id']],

  // Memory tables
  ['semantic_memory', 'idx_semantic_memory_vault_id', ['vault_id', 'id']],
  ['semantic_memory', 'idx_semantic_memory_vault_type', ['vault_id', 'type']],
  ['identity', 'idx_identity_vault_id', ['vault_id', 'id']],

  // Evolution and operator tables
  ['evolution_snapshots', 'idx_evolution_snapshots_vault_id', ['vault_id', 'id']],
  ['evolution_snapshots', 'idx_evolution_snapshots_vault_conv', ['vault_id', 'conversation_id']],
  ['operator_performance', 'idx_operator_performance_vault_id', ['vault_id', 'id']],
  ['operator_performance', 'idx_operator_performance_vault_op', ['vault_id', 'operator_name']],

  // Subagent and emotional tables
  ['subagent_results', 'idx_subagent_results_vault_id', ['vault_id', 'id']],
  ['subagent_results', 'idx_subagent_results_vault_agent', ['vault_id', 'subagent_name']],
  ['emotional_arcs', 'idx_emotional_arcs_vault_id', ['vault_id', 'id']],
  ['emotional_arcs', 'idx_emotional_arcs_vault_conv', ['vault_id', 'conversation_id']],
  ['emotion_context', 'idx_emotion_context_vault_id', ['vault_id', 'id']],
  ['emotion_context', 'idx_emotion_context_vault_session', ['vault_id', 'session_id']],

  // Additional tables
  ['identity_checkpoints', 'idx_identity_checkpoints_vault_id', ['vault_id', 'id']],
  ['operator_efficacy', 'idx_operator_efficacy_vault_id', ['vault_id', 'id']],
  ['coherence_metrics', 'idx_coherence_metrics_vault_id', ['vault_id', 'id']],
  ['persona_variants', 'idx_persona_variants_vault_id', ['vault_id', 'id']],
  ['emergence_traces', 'idx_emergence_traces_vault_id', ['vault_id', 'id']],
  ['memory_associations', 'idx_memory_associations_vault_id', ['vault_id', 'id']],
  ['memory_compression_queue', 'idx_memory_compression_queue_vault_id', ['vault_id', 'id']],
  ['remote_sync_queue', 'idx_remote_sync_queue_vault_id', ['vault_id', 'id']],
  ['identity_compression', 'idx_identity_compression_vault_id', ['vault_id', 'id']],
  ['steering_messages', 'idx_steering_messages_vault_id', ['vault_id', 'id']],
  ['steering_messages', 'idx_steering_messages_vault_session', ['vault_id', 'session_id']]
];

/**
 * Default vault ID for existing data
 */
const DEFAULT_VAULT_ID = 'default-vault';

/**
 * Check if a table exists in the database
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(tableName);
  return !!result;
}

/**
 * Check if a column exists in a table
 */
function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;
  return columns.some(col => col.name === columnName);
}

/**
 * Check if an index exists in the database
 */
function indexExists(db: Database.Database, indexName: string): boolean {
  const result = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='index' AND name=?`
  ).get(indexName);
  return !!result;
}

/**
 * Add vault_id column to a table if it exists and doesn't have the column
 */
function addVaultIdColumn(db: Database.Database, tableName: string): { added: boolean; reason: string } {
  if (!tableExists(db, tableName)) {
    return { added: false, reason: 'table does not exist' };
  }

  if (columnExists(db, tableName, 'vault_id')) {
    return { added: false, reason: 'column already exists' };
  }

  // Add column with default value
  db.prepare(`ALTER TABLE "${tableName}" ADD COLUMN vault_id TEXT NOT NULL DEFAULT '${DEFAULT_VAULT_ID}'`).run();

  return { added: true, reason: 'column added successfully' };
}

/**
 * Create a composite index if the table exists and index doesn't
 */
function createCompositeIndex(
  db: Database.Database,
  tableName: string,
  indexName: string,
  columns: string[]
): { created: boolean; reason: string } {
  if (!tableExists(db, tableName)) {
    return { created: false, reason: 'table does not exist' };
  }

  if (indexExists(db, indexName)) {
    return { created: false, reason: 'index already exists' };
  }

  // Verify all columns exist
  for (const col of columns) {
    if (!columnExists(db, tableName, col)) {
      return { created: false, reason: `column ${col} does not exist` };
    }
  }

  const columnsStr = columns.map(c => `"${c}"`).join(', ');
  db.prepare(`CREATE INDEX "${indexName}" ON "${tableName}"(${columnsStr})`).run();

  return { created: true, reason: 'index created successfully' };
}

/**
 * Migration up function - adds vault_id columns and indexes
 */
function up(db: Database.Database): void {
  console.log('[Migration 001] Adding vault_id columns for multitenancy...');

  // Track statistics
  let columnsAdded = 0;
  let columnsSkipped = 0;
  let indexesCreated = 0;
  let indexesSkipped = 0;

  // Step 1: Add vault_id column to all tables
  console.log('\n[Step 1] Adding vault_id columns...');
  for (const tableName of TABLES_TO_MIGRATE) {
    const result = addVaultIdColumn(db, tableName);
    if (result.added) {
      console.log(`  [+] ${tableName}: ${result.reason}`);
      columnsAdded++;
    } else {
      console.log(`  [-] ${tableName}: ${result.reason}`);
      columnsSkipped++;
    }
  }

  // Step 2: Create composite indexes
  console.log('\n[Step 2] Creating composite indexes...');
  for (const [tableName, indexName, columns] of COMPOSITE_INDEXES) {
    const result = createCompositeIndex(db, tableName, indexName, columns);
    if (result.created) {
      console.log(`  [+] ${indexName}: ${result.reason}`);
      indexesCreated++;
    } else {
      console.log(`  [-] ${indexName}: ${result.reason}`);
      indexesSkipped++;
    }
  }

  // Summary
  console.log('\n[Migration 001] Summary:');
  console.log(`  Columns added: ${columnsAdded} (${columnsSkipped} skipped)`);
  console.log(`  Indexes created: ${indexesCreated} (${indexesSkipped} skipped)`);
}

/**
 * Migration down function - removes vault_id columns and indexes
 *
 * Note: SQLite doesn't support DROP COLUMN directly. We need to:
 * 1. Create a new table without the column
 * 2. Copy data
 * 3. Drop old table
 * 4. Rename new table
 *
 * For simplicity and safety, the down migration only removes indexes.
 * A full rollback would require recreating tables which is risky.
 */
function down(db: Database.Database): void {
  console.log('[Migration 001 Rollback] Removing vault_id indexes...');
  console.log('Note: vault_id columns will be preserved for safety.');

  let indexesRemoved = 0;

  // Remove composite indexes
  for (const [_tableName, indexName, _columns] of COMPOSITE_INDEXES) {
    if (indexExists(db, indexName)) {
      db.prepare(`DROP INDEX "${indexName}"`).run();
      console.log(`  [-] Dropped index: ${indexName}`);
      indexesRemoved++;
    }
  }

  console.log(`\n[Migration 001 Rollback] Removed ${indexesRemoved} indexes`);
  console.log('To fully remove vault_id columns, manual table recreation is required.');
}

/**
 * The migration object
 */
export const addVaultIdMigration: Migration = {
  id: '001_add_vault_id',
  description: 'Add vault_id column to all tables for multitenancy support',
  up,
  down
};

/**
 * CLI entry point for standalone execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Dynamic import to avoid circular dependency issues
  import('../migrator.js').then(({ Migrator }) => {
    const migrator = new Migrator();
    migrator.register(addVaultIdMigration);

    const args = process.argv.slice(2);

    if (args.includes('--rollback')) {
      const result = migrator.rollbackMigration('001_add_vault_id');
      console.log('\nRollback result:', result);
      process.exit(result.success ? 0 : 1);
    } else {
      const result = migrator.runMigration('001_add_vault_id');
      console.log('\nMigration result:', result);
      process.exit(result.success ? 0 : 1);
    }
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
