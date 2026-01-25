/**
 * Database Configuration
 *
 * Centralized database configuration for Metamorph.
 * Supports Railway volume persistence and local development.
 */

import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  /** Path to the SQLite database file */
  path: string;
  /** Path to store backup files */
  backupPath: string;
  /** SQLite PRAGMA settings */
  pragmas: {
    journal_mode: 'WAL' | 'DELETE' | 'TRUNCATE';
    synchronous: 'OFF' | 'NORMAL' | 'FULL';
    cache_size: number;
    foreign_keys: 'ON' | 'OFF';
    busy_timeout: number;
  };
}

/**
 * Get Railway volume mount path if available
 */
export function getRailwayVolumePath(): string | null {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH || null;
}

/**
 * Determine the database path based on environment
 */
function resolveDatabasePath(): string {
  // 1. Explicit DATABASE_PATH environment variable takes priority
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  // 2. Railway volume mount path
  const railwayPath = getRailwayVolumePath();
  if (railwayPath) {
    return `${railwayPath}/metamorph.db`;
  }

  // 3. Default local development path
  return './data/metamorph.db';
}

/**
 * Determine the backup path based on environment
 */
function resolveBackupPath(): string {
  // Railway volume mount path
  const railwayPath = getRailwayVolumePath();
  if (railwayPath) {
    return `${railwayPath}/backups`;
  }

  // Default local development path
  return './data/backups';
}

/**
 * Database configuration singleton
 */
export const DATABASE_CONFIG: DatabaseConfig = {
  path: resolveDatabasePath(),
  backupPath: resolveBackupPath(),
  pragmas: {
    // WAL mode for better concurrent access (multiple readers, one writer)
    journal_mode: 'WAL',
    // NORMAL synchronous is a good balance between safety and performance
    synchronous: 'NORMAL',
    // 64MB cache for better read performance
    cache_size: -64000,
    // Enable foreign key constraints
    foreign_keys: 'ON',
    // Wait up to 5 seconds for locks before failing
    busy_timeout: 5000
  }
};

/**
 * Ensure the database directory exists
 */
export function ensureDatabaseDirectory(dbPath: string = DATABASE_CONFIG.path): void {
  if (dbPath === ':memory:') return;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`[Database] Created directory: ${dir}`);
  }
}

/**
 * Ensure the backup directory exists
 */
export function ensureBackupDirectory(backupPath: string = DATABASE_CONFIG.backupPath): void {
  if (!existsSync(backupPath)) {
    mkdirSync(backupPath, { recursive: true });
    console.log(`[Database] Created backup directory: ${backupPath}`);
  }
}

/**
 * Generate SQL pragma statements from config
 */
export function getPragmaStatements(config: DatabaseConfig = DATABASE_CONFIG): string[] {
  return [
    `PRAGMA journal_mode = ${config.pragmas.journal_mode};`,
    `PRAGMA synchronous = ${config.pragmas.synchronous};`,
    `PRAGMA cache_size = ${config.pragmas.cache_size};`,
    `PRAGMA foreign_keys = ${config.pragmas.foreign_keys};`,
    `PRAGMA busy_timeout = ${config.pragmas.busy_timeout};`
  ];
}

/**
 * Apply pragma settings to a database instance
 */
export function applyPragmas(
  db: { prepare: (sql: string) => { run: () => void } },
  config: DatabaseConfig = DATABASE_CONFIG
): void {
  const statements = getPragmaStatements(config);
  for (const statement of statements) {
    db.prepare(statement).run();
  }
  console.log('[Database] Applied SQLite pragmas');
}

/**
 * Check if running in production environment (Railway, etc.)
 */
export function isProductionEnvironment(): boolean {
  return !!(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Get the database path for a specific purpose
 */
export function getDatabasePath(options: { inMemory?: boolean } = {}): string {
  if (options.inMemory) {
    return ':memory:';
  }
  return DATABASE_CONFIG.path;
}

/**
 * Log database configuration on startup
 */
export function logDatabaseConfig(): void {
  const railwayPath = getRailwayVolumePath();

  console.log('[Database] Configuration:');
  console.log(`  Path: ${DATABASE_CONFIG.path}`);
  console.log(`  Backup Path: ${DATABASE_CONFIG.backupPath}`);
  console.log(`  Journal Mode: ${DATABASE_CONFIG.pragmas.journal_mode}`);
  console.log(`  Railway Volume: ${railwayPath || 'not configured'}`);
  console.log(`  Environment: ${isProductionEnvironment() ? 'production' : 'development'}`);
}
