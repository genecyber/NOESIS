/**
 * Database Migrator - Manages schema migrations for Metamorph
 *
 * Provides a simple migration system that:
 * - Tracks applied migrations in a schema_migrations table
 * - Runs pending migrations in order
 * - Supports rollback
 */

import Database from 'better-sqlite3';
import { DATABASE_CONFIG, ensureDatabaseDirectory } from '../config/database.js';

/**
 * Migration interface - each migration must implement these functions
 */
export interface Migration {
  /** Unique migration ID (e.g., '001_add_vault_id') */
  id: string;
  /** Human-readable description */
  description: string;
  /** Apply the migration */
  up: (db: Database.Database) => void;
  /** Revert the migration */
  down: (db: Database.Database) => void;
}

/**
 * Migration record stored in the database
 */
interface MigrationRecord {
  id: string;
  applied_at: string;
  checksum: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migrationId: string;
  appliedAt?: Date;
  error?: string;
}

/**
 * Migrator class - handles migration lifecycle
 */
export class Migrator {
  private db: Database.Database;
  private migrations: Map<string, Migration> = new Map();
  private initialized = false;

  constructor(dbPath?: string) {
    const path = dbPath || DATABASE_CONFIG.path;
    ensureDatabaseDirectory(path);
    this.db = new Database(path);
    this.ensureMigrationsTable();
  }

  /**
   * Ensure the schema_migrations table exists
   */
  private ensureMigrationsTable(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        checksum TEXT NOT NULL
      )
    `);

    this.initialized = true;
  }

  /**
   * Register a migration
   */
  register(migration: Migration): void {
    this.migrations.set(migration.id, migration);
  }

  /**
   * Register multiple migrations
   */
  registerAll(migrations: Migration[]): void {
    for (const migration of migrations) {
      this.register(migration);
    }
  }

  /**
   * Get all registered migration IDs sorted by ID
   */
  getRegisteredMigrations(): string[] {
    return Array.from(this.migrations.keys()).sort();
  }

  /**
   * Get applied migration IDs
   */
  getAppliedMigrations(): string[] {
    const rows = this.db.prepare(`
      SELECT id FROM schema_migrations ORDER BY id ASC
    `).all() as MigrationRecord[];

    return rows.map(r => r.id);
  }

  /**
   * Get pending migration IDs (registered but not applied)
   */
  getPendingMigrations(): string[] {
    const applied = new Set(this.getAppliedMigrations());
    return this.getRegisteredMigrations().filter(id => !applied.has(id));
  }

  /**
   * Check if a migration has been applied
   */
  isApplied(migrationId: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM schema_migrations WHERE id = ?'
    ).get(migrationId);
    return !!row;
  }

  /**
   * Calculate checksum for a migration
   */
  private calculateChecksum(migration: Migration): string {
    const content = migration.up.toString() + migration.down.toString();
    // Simple hash for checksum
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Run a single migration
   */
  runMigration(migrationId: string): MigrationResult {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      return {
        success: false,
        migrationId,
        error: `Migration not found: ${migrationId}`
      };
    }

    if (this.isApplied(migrationId)) {
      return {
        success: false,
        migrationId,
        error: `Migration already applied: ${migrationId}`
      };
    }

    console.log(`[Migrator] Running migration: ${migrationId}`);
    console.log(`  Description: ${migration.description}`);

    try {
      // Run migration in a transaction
      this.db.transaction(() => {
        migration.up(this.db);

        // Record the migration
        const appliedAt = new Date().toISOString();
        const checksum = this.calculateChecksum(migration);

        this.db.prepare(`
          INSERT INTO schema_migrations (id, applied_at, checksum)
          VALUES (?, ?, ?)
        `).run(migrationId, appliedAt, checksum);
      })();

      console.log(`[Migrator] Successfully applied: ${migrationId}`);

      return {
        success: true,
        migrationId,
        appliedAt: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Migrator] Failed to apply ${migrationId}: ${errorMessage}`);

      return {
        success: false,
        migrationId,
        error: errorMessage
      };
    }
  }

  /**
   * Run all pending migrations
   */
  runPendingMigrations(): MigrationResult[] {
    const pending = this.getPendingMigrations();
    console.log(`[Migrator] Found ${pending.length} pending migrations`);

    const results: MigrationResult[] = [];

    for (const migrationId of pending) {
      const result = this.runMigration(migrationId);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        console.error(`[Migrator] Stopping due to failure at: ${migrationId}`);
        break;
      }
    }

    return results;
  }

  /**
   * Rollback a single migration
   */
  rollbackMigration(migrationId: string): MigrationResult {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      return {
        success: false,
        migrationId,
        error: `Migration not found: ${migrationId}`
      };
    }

    if (!this.isApplied(migrationId)) {
      return {
        success: false,
        migrationId,
        error: `Migration not applied: ${migrationId}`
      };
    }

    console.log(`[Migrator] Rolling back migration: ${migrationId}`);
    console.log(`  Description: ${migration.description}`);

    try {
      // Run rollback in a transaction
      this.db.transaction(() => {
        migration.down(this.db);

        // Remove the migration record
        this.db.prepare('DELETE FROM schema_migrations WHERE id = ?').run(migrationId);
      })();

      console.log(`[Migrator] Successfully rolled back: ${migrationId}`);

      return {
        success: true,
        migrationId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Migrator] Failed to rollback ${migrationId}: ${errorMessage}`);

      return {
        success: false,
        migrationId,
        error: errorMessage
      };
    }
  }

  /**
   * Rollback the last N applied migrations
   */
  rollbackLast(count: number = 1): MigrationResult[] {
    const applied = this.getAppliedMigrations().reverse();
    const toRollback = applied.slice(0, count);

    console.log(`[Migrator] Rolling back ${toRollback.length} migrations`);

    const results: MigrationResult[] = [];

    for (const migrationId of toRollback) {
      const result = this.rollbackMigration(migrationId);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        console.error(`[Migrator] Stopping rollback due to failure at: ${migrationId}`);
        break;
      }
    }

    return results;
  }

  /**
   * Get migration status summary
   */
  getStatus(): {
    registered: number;
    applied: number;
    pending: number;
    migrations: Array<{
      id: string;
      description: string;
      applied: boolean;
      appliedAt?: string;
    }>;
  } {
    const registered = this.getRegisteredMigrations();
    const appliedSet = new Set(this.getAppliedMigrations());

    // Get applied_at timestamps
    const appliedRecords = this.db.prepare(`
      SELECT id, applied_at FROM schema_migrations
    `).all() as Array<{ id: string; applied_at: string }>;
    const appliedTimes = new Map(appliedRecords.map(r => [r.id, r.applied_at]));

    const migrations = registered.map(id => {
      const migration = this.migrations.get(id)!;
      const applied = appliedSet.has(id);
      return {
        id,
        description: migration.description,
        applied,
        appliedAt: applied ? appliedTimes.get(id) : undefined
      };
    });

    return {
      registered: registered.length,
      applied: appliedSet.size,
      pending: registered.length - appliedSet.size,
      migrations
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the underlying database instance (for testing)
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

/**
 * Create a migrator instance with default settings
 */
export function createMigrator(dbPath?: string): Migrator {
  return new Migrator(dbPath);
}

/**
 * Run migrations and close connection
 * Convenience function for CLI usage
 */
export async function runMigrations(dbPath?: string): Promise<{
  success: boolean;
  results: MigrationResult[];
}> {
  const migrator = new Migrator(dbPath);

  try {
    // Import and register all migrations
    const { addVaultIdMigration } = await import('./migrations/001_add_vault_id.js');
    migrator.register(addVaultIdMigration);

    // Run pending migrations
    const results = migrator.runPendingMigrations();
    const success = results.every(r => r.success);

    return { success, results };
  } finally {
    migrator.close();
  }
}
