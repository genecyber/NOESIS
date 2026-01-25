/**
 * Migration 001: Add Multitenancy Support
 *
 * Adds vault_id column to all user-scoped tables for multi-tenant data isolation.
 * Creates indexes for efficient vault-scoped queries.
 * Migrates existing data to a legacy-default vault.
 */

import Database from 'better-sqlite3';
import { DATABASE_CONFIG, ensureDatabaseDirectory } from '../config/database.js';

/**
 * Tables that need vault_id column added
 */
const TABLES_TO_MIGRATE = [
  'conversations',
  'messages',
  'identity',
  'semantic_memory',
  'evolution_snapshots',
  'sessions',
  'session_states',
  'operator_performance',
  'subagent_results',
  'emotional_arcs',
  'emotion_context'
];

/**
 * Check if a column exists in a table
 */
function columnExists(db: Database.Database, table: string, column: string): boolean {
  const result = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return result.some(col => col.name === column);
}

/**
 * Check if a table exists
 */
function tableExists(db: Database.Database, table: string): boolean {
  const result = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table);
  return !!result;
}

/**
 * Check if an index exists
 */
function indexExists(db: Database.Database, indexName: string): boolean {
  const result = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='index' AND name=?`
  ).get(indexName);
  return !!result;
}

/**
 * Add vault_id column to existing tables
 */
function addVaultIdColumns(db: Database.Database): number {
  let columnsAdded = 0;

  for (const table of TABLES_TO_MIGRATE) {
    if (!tableExists(db, table)) {
      console.log(`  [Skip] Table ${table} does not exist`);
      continue;
    }

    if (columnExists(db, table, 'vault_id')) {
      console.log(`  [Skip] Column vault_id already exists in ${table}`);
      continue;
    }

    console.log(`  [Add] Adding vault_id to ${table}`);
    db.prepare(`ALTER TABLE ${table} ADD COLUMN vault_id TEXT NOT NULL DEFAULT ''`).run();
    columnsAdded++;
  }

  return columnsAdded;
}

/**
 * Create indexes for vault_id columns
 */
function createVaultIndexes(db: Database.Database): number {
  let indexesCreated = 0;

  for (const table of TABLES_TO_MIGRATE) {
    if (!tableExists(db, table)) {
      continue;
    }

    const indexName = `idx_${table}_vault`;

    if (indexExists(db, indexName)) {
      console.log(`  [Skip] Index ${indexName} already exists`);
      continue;
    }

    console.log(`  [Create] Creating index ${indexName}`);
    db.prepare(`CREATE INDEX ${indexName} ON ${table}(vault_id)`).run();
    indexesCreated++;
  }

  return indexesCreated;
}

/**
 * Migrate existing data to legacy-default vault
 */
function migrateExistingData(db: Database.Database): number {
  let rowsUpdated = 0;

  for (const table of TABLES_TO_MIGRATE) {
    if (!tableExists(db, table)) {
      continue;
    }

    if (!columnExists(db, table, 'vault_id')) {
      continue;
    }

    const result = db.prepare(
      `UPDATE ${table} SET vault_id = 'legacy-default' WHERE vault_id = ''`
    ).run();

    if (result.changes > 0) {
      console.log(`  [Migrate] Updated ${result.changes} rows in ${table}`);
      rowsUpdated += result.changes;
    }
  }

  return rowsUpdated;
}

/**
 * Create Vercel integration tables
 */
function createVercelTables(db: Database.Database): void {
  // Vercel OAuth connections
  if (!tableExists(db, 'vercel_connections')) {
    console.log('  [Create] Creating vercel_connections table');
    db.prepare(`
      CREATE TABLE vercel_connections (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        vercel_user_id TEXT NOT NULL,
        vercel_team_id TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TEXT,
        scopes TEXT NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(vault_id, vercel_user_id)
      )
    `).run();
    db.prepare(`CREATE INDEX idx_vercel_connections_vault ON vercel_connections(vault_id)`).run();
  }

  // Sandboxes
  if (!tableExists(db, 'sandboxes')) {
    console.log('  [Create] Creating sandboxes table');
    db.prepare(`
      CREATE TABLE sandboxes (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        vercel_connection_id TEXT,
        sandbox_vercel_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        runtime TEXT NOT NULL DEFAULT 'node22',
        vcpus INTEGER NOT NULL DEFAULT 2,
        memory_mb INTEGER NOT NULL DEFAULT 2048,
        timeout_minutes INTEGER NOT NULL DEFAULT 30,
        environment TEXT,
        working_directory TEXT DEFAULT '/vercel/sandbox',
        agent_session_id TEXT,
        agent_config TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        stopped_at TEXT,
        last_activity_at TEXT,
        total_runtime_seconds INTEGER DEFAULT 0,
        error_message TEXT,
        FOREIGN KEY (vercel_connection_id) REFERENCES vercel_connections(id)
      )
    `).run();
    db.prepare(`CREATE INDEX idx_sandboxes_vault ON sandboxes(vault_id)`).run();
    db.prepare(`CREATE INDEX idx_sandboxes_status ON sandboxes(status)`).run();
  }

  // Sandbox executions
  if (!tableExists(db, 'sandbox_executions')) {
    console.log('  [Create] Creating sandbox_executions table');
    db.prepare(`
      CREATE TABLE sandbox_executions (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        vault_id TEXT NOT NULL,
        command TEXT NOT NULL,
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        duration_ms INTEGER,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (sandbox_id) REFERENCES sandboxes(id)
      )
    `).run();
    db.prepare(`CREATE INDEX idx_sandbox_executions_sandbox ON sandbox_executions(sandbox_id)`).run();
    db.prepare(`CREATE INDEX idx_sandbox_executions_vault ON sandbox_executions(vault_id)`).run();
  }

  // Sandbox resource usage
  if (!tableExists(db, 'sandbox_resource_usage')) {
    console.log('  [Create] Creating sandbox_resource_usage table');
    db.prepare(`
      CREATE TABLE sandbox_resource_usage (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        sandbox_count INTEGER DEFAULT 0,
        total_runtime_seconds INTEGER DEFAULT 0,
        total_executions INTEGER DEFAULT 0,
        sandbox_limit INTEGER DEFAULT 5,
        runtime_limit_hours INTEGER DEFAULT 100,
        limit_exceeded INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
    db.prepare(`CREATE INDEX idx_sandbox_resource_usage_vault ON sandbox_resource_usage(vault_id)`).run();
    db.prepare(`CREATE INDEX idx_sandbox_resource_usage_period ON sandbox_resource_usage(vault_id, period_start)`).run();
  }
}

/**
 * Run the migration
 */
export async function runMigration(dbPath?: string): Promise<{
  success: boolean;
  columnsAdded: number;
  indexesCreated: number;
  rowsMigrated: number;
  vercelTablesCreated: boolean;
}> {
  const path = dbPath || DATABASE_CONFIG.path;

  console.log('[Migration 001] Add Multitenancy Support');
  console.log(`  Database: ${path}`);

  ensureDatabaseDirectory(path);

  const db = new Database(path);

  try {
    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();

    // Step 1: Add vault_id columns
    console.log('\n[Step 1] Adding vault_id columns...');
    const columnsAdded = addVaultIdColumns(db);

    // Step 2: Create indexes
    console.log('\n[Step 2] Creating vault indexes...');
    const indexesCreated = createVaultIndexes(db);

    // Step 3: Migrate existing data
    console.log('\n[Step 3] Migrating existing data to legacy-default vault...');
    const rowsMigrated = migrateExistingData(db);

    // Step 4: Create Vercel tables
    console.log('\n[Step 4] Creating Vercel integration tables...');
    createVercelTables(db);

    // Commit transaction
    db.prepare('COMMIT').run();

    console.log('\n[Migration 001] Completed successfully');
    console.log(`  Columns added: ${columnsAdded}`);
    console.log(`  Indexes created: ${indexesCreated}`);
    console.log(`  Rows migrated: ${rowsMigrated}`);

    return {
      success: true,
      columnsAdded,
      indexesCreated,
      rowsMigrated,
      vercelTablesCreated: true
    };
  } catch (error) {
    // Rollback on error
    try {
      db.prepare('ROLLBACK').run();
    } catch (rollbackError) {
      console.error('[Migration 001] Rollback failed:', rollbackError);
    }

    console.error('[Migration 001] Failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Check if migration has been applied
 */
export function isMigrationApplied(dbPath?: string): boolean {
  const path = dbPath || DATABASE_CONFIG.path;

  ensureDatabaseDirectory(path);

  const db = new Database(path);

  try {
    // Check if any of the main tables have vault_id column
    for (const table of ['conversations', 'sessions', 'semantic_memory']) {
      if (tableExists(db, table) && columnExists(db, table, 'vault_id')) {
        return true;
      }
    }
    return false;
  } finally {
    db.close();
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(result => {
      console.log('\nMigration result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
