/**
 * Migration 002: Add Vercel connections and sandboxes tables
 *
 * Creates tables for:
 * - vercel_connections: Stores OAuth tokens for Vercel integration
 * - sandboxes: Manages isolated code execution environments
 * - sandbox_resource_usage: Tracks resource consumption per vault
 */

import type Database from 'better-sqlite3';
import type { Migration } from '../migrator.js';

/**
 * Migration up function - creates the new tables
 */
function up(db: Database.Database): void {
  console.log('[Migration 002] Creating Vercel and Sandbox tables...');

  // Create vercel_connections table
  console.log('  Creating vercel_connections table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vercel_connections (
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

  // Create indexes for vercel_connections
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_vercel_connections_vault_id
      ON vercel_connections(vault_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_vercel_connections_status
      ON vercel_connections(vault_id, connection_status)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_vercel_connections_vercel_user
      ON vercel_connections(vercel_user_id)
  `).run();

  // Create sandboxes table
  console.log('  Creating sandboxes table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sandboxes (
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

  // Create indexes for sandboxes
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_vault_id
      ON sandboxes(vault_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_status
      ON sandboxes(vault_id, status)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_connection
      ON sandboxes(vercel_connection_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_vercel_id
      ON sandboxes(sandbox_vercel_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_created
      ON sandboxes(vault_id, created_at)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandboxes_agent
      ON sandboxes(agent_session_id)
  `).run();

  // Create sandbox_resource_usage table
  console.log('  Creating sandbox_resource_usage table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sandbox_resource_usage (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      sandbox_count INTEGER DEFAULT 0,
      total_runtime_seconds INTEGER DEFAULT 0,
      total_executions INTEGER DEFAULT 0,
      sandbox_limit INTEGER DEFAULT 5,
      runtime_limit_hours INTEGER DEFAULT 100,
      limit_exceeded BOOLEAN DEFAULT FALSE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  // Create indexes for sandbox_resource_usage
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandbox_resource_usage_vault_id
      ON sandbox_resource_usage(vault_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_sandbox_resource_usage_period
      ON sandbox_resource_usage(vault_id, period_start)
  `).run();
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_resource_usage_vault_period
      ON sandbox_resource_usage(vault_id, period_start)
  `).run();

  console.log('[Migration 002] Tables created successfully');
}

/**
 * Migration down function - drops the tables
 */
function down(db: Database.Database): void {
  console.log('[Migration 002 Rollback] Dropping Vercel and Sandbox tables...');

  // Drop indexes first
  db.prepare('DROP INDEX IF EXISTS idx_sandbox_resource_usage_vault_period').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandbox_resource_usage_period').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandbox_resource_usage_vault_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_agent').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_created').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_vercel_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_connection').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_status').run();
  db.prepare('DROP INDEX IF EXISTS idx_sandboxes_vault_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_vercel_connections_vercel_user').run();
  db.prepare('DROP INDEX IF EXISTS idx_vercel_connections_status').run();
  db.prepare('DROP INDEX IF EXISTS idx_vercel_connections_vault_id').run();

  // Drop tables (in reverse order due to foreign keys)
  db.prepare('DROP TABLE IF EXISTS sandbox_resource_usage').run();
  db.prepare('DROP TABLE IF EXISTS sandboxes').run();
  db.prepare('DROP TABLE IF EXISTS vercel_connections').run();

  console.log('[Migration 002 Rollback] Tables dropped successfully');
}

/**
 * The migration object
 */
export const addVercelSandboxTablesMigration: Migration = {
  id: '002_add_vercel_sandbox_tables',
  description: 'Add vercel_connections, sandboxes, and sandbox_resource_usage tables',
  up,
  down
};
