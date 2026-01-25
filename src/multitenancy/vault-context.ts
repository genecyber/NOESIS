/**
 * VaultContext - Provides vault-scoped database access for multitenancy
 *
 * This module implements request-scoped vault context using AsyncLocalStorage,
 * enabling automatic vault isolation for database operations without explicit
 * vaultId passing through every function call.
 *
 * Key features:
 * - AsyncLocalStorage for propagating vault context through async call chains
 * - VaultScopedDatabase wrapper that auto-injects vault_id into queries
 * - Express middleware for setting vault context from authenticated requests
 * - Factory functions for creating vault-scoped database instances
 *
 * Usage:
 * ```typescript
 * // In middleware (automatic from emblem-auth)
 * withVaultContext({ vaultId: req.user.vaultId }, () => {
 *   // All database operations here are automatically scoped to vault
 *   const db = createVaultScopedDb(rawDb);
 *   const sessions = db.queryWithVault('SELECT * FROM sessions WHERE active = ?', [true]);
 * });
 *
 * // Direct access to current vault
 * const { vaultId } = getCurrentVault();
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';
import Database from 'better-sqlite3';

/**
 * Vault context stored in AsyncLocalStorage for request-scoped access
 */
export interface VaultContext {
  /** Unique identifier for the vault (tenant) */
  vaultId: string;
  /** Optional user ID within the vault */
  userId?: string;
}

/**
 * AsyncLocalStorage instance for propagating vault context through async chains
 */
const vaultStorage = new AsyncLocalStorage<VaultContext>();

/**
 * Get the current vault context
 *
 * @throws Error if not called within a withVaultContext() scope
 * @returns The current VaultContext
 *
 * @example
 * const { vaultId, userId } = getCurrentVault();
 * console.log(`Operating in vault: ${vaultId}`);
 */
export function getCurrentVault(): VaultContext {
  const ctx = vaultStorage.getStore();
  if (!ctx) {
    throw new Error('No vault context - must be called within withVaultContext()');
  }
  return ctx;
}

/**
 * Try to get the current vault context without throwing
 *
 * Use this when vault context is optional (e.g., background jobs that may or
 * may not have vault context).
 *
 * @returns The current VaultContext or null if not in scope
 *
 * @example
 * const ctx = tryGetCurrentVault();
 * if (ctx) {
 *   console.log(`In vault: ${ctx.vaultId}`);
 * } else {
 *   console.log('No vault context - using global scope');
 * }
 */
export function tryGetCurrentVault(): VaultContext | null {
  return vaultStorage.getStore() ?? null;
}

/**
 * Get just the vaultId from current context
 *
 * Convenience function when you only need the vaultId and want to provide
 * a fallback for non-vault-scoped code paths.
 *
 * @param fallback - Optional fallback value if no vault context exists
 * @throws Error if no vault context and no fallback provided
 * @returns The current vaultId or the fallback
 *
 * @example
 * // Throws if no context
 * const vaultId = getVaultId();
 *
 * // Returns 'default' if no context
 * const vaultId = getVaultId('default');
 */
export function getVaultId(fallback?: string): string {
  const ctx = vaultStorage.getStore();
  if (ctx) return ctx.vaultId;
  if (fallback !== undefined) return fallback;
  throw new Error('No vault context and no fallback provided');
}

/**
 * Run a synchronous function within a vault context
 *
 * All code executed within the callback (and any async operations it starts)
 * will have access to the vault context via getCurrentVault() and related functions.
 *
 * @param ctx - The vault context to use
 * @param fn - Function to execute within the context
 * @returns The return value of fn
 *
 * @example
 * const result = withVaultContext({ vaultId: 'vault-123' }, () => {
 *   const vault = getCurrentVault();
 *   return doSomething(vault.vaultId);
 * });
 */
export function withVaultContext<T>(ctx: VaultContext, fn: () => T): T {
  return vaultStorage.run(ctx, fn);
}

/**
 * Run an async function within a vault context
 *
 * Same as withVaultContext but for async functions. The vault context
 * propagates through the entire async chain, including Promise.all,
 * setTimeout callbacks, etc.
 *
 * @param ctx - The vault context to use
 * @param fn - Async function to execute within the context
 * @returns Promise resolving to the return value of fn
 *
 * @example
 * const data = await withVaultContextAsync({ vaultId: 'vault-123' }, async () => {
 *   const sessions = await db.queryWithVault('SELECT * FROM sessions');
 *   return processSessions(sessions);
 * });
 */
export async function withVaultContextAsync<T>(
  ctx: VaultContext,
  fn: () => Promise<T>
): Promise<T> {
  return vaultStorage.run(ctx, fn);
}

/**
 * Express middleware to set vault context from authenticated request
 *
 * This middleware should be applied after authentication middleware (e.g., requireAuth
 * from emblem-auth). It extracts vaultId and userId from req.user and establishes
 * a vault context for the remainder of the request.
 *
 * If no vaultId is present on req.user, the middleware passes through without
 * establishing context, allowing auth middleware to handle the error.
 *
 * @returns Express middleware function
 *
 * @example
 * // In Express app setup
 * app.use(requireAuth());
 * app.use(vaultContextMiddleware());
 *
 * // In route handlers
 * app.get('/api/sessions', (req, res) => {
 *   const vault = getCurrentVault(); // Works!
 *   // ...
 * });
 */
export function vaultContextMiddleware() {
  return (req: any, _res: any, next: any) => {
    const vaultId = req.user?.vaultId;
    if (!vaultId) {
      // No vault in user - let auth middleware handle this
      return next();
    }

    // Establish vault context for this request
    withVaultContext({ vaultId, userId: req.user?.userId }, () => {
      next();
    });
  };
}

/**
 * VaultScopedDatabase - Wraps better-sqlite3 to auto-inject vault_id filtering
 *
 * This class provides vault-aware database operations that automatically
 * scope queries to the current vault. It supports both dynamic vault lookup
 * (via callback) and static vault binding.
 *
 * SQL Injection Note: The vault_id injection modifies SQL strings. While the
 * vaultId value is passed as a parameter (safe), the SQL modification assumes
 * standard SQL syntax. Use prepare() for complex queries where automatic
 * injection might not work correctly.
 */
export class VaultScopedDatabase {
  private db: Database.Database;
  private vaultId: string | (() => string);

  /**
   * Create a vault-scoped database wrapper
   *
   * @param db - The underlying better-sqlite3 database instance
   * @param vaultId - Either a static vault ID or a function that returns the vault ID
   *
   * @example
   * // Static vault ID
   * const db = new VaultScopedDatabase(rawDb, 'vault-123');
   *
   * // Dynamic vault ID from context
   * const db = new VaultScopedDatabase(rawDb, () => getVaultId());
   */
  constructor(db: Database.Database, vaultId: string | (() => string)) {
    this.db = db;
    this.vaultId = vaultId;
  }

  /**
   * Get the current vault ID
   * @internal
   */
  private getVaultId(): string {
    return typeof this.vaultId === 'function' ? this.vaultId() : this.vaultId;
  }

  /**
   * Prepare a statement directly (caller handles vault_id in their query)
   *
   * Use this for complex queries where automatic vault_id injection might not work,
   * or when you need full control over the query structure.
   *
   * @param sql - SQL statement to prepare
   * @returns Prepared statement
   *
   * @example
   * const stmt = db.prepare('SELECT * FROM sessions WHERE vault_id = ? AND status = ?');
   * const rows = stmt.all(vaultId, 'active');
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  /**
   * Query with automatic vault_id injection into WHERE clause
   *
   * Modifies the SQL to include vault_id filtering. The vaultId is prepended
   * to the parameters array.
   *
   * @param sql - SQL SELECT statement
   * @param params - Query parameters (vault_id is auto-prepended)
   * @returns Array of matching rows
   *
   * @example
   * // Original: SELECT * FROM sessions WHERE active = ?
   * // Modified: SELECT * FROM sessions WHERE vault_id = ? AND active = ?
   * const sessions = db.queryWithVault(
   *   'SELECT * FROM sessions WHERE active = ?',
   *   [true]
   * );
   */
  queryWithVault(sql: string, params: any[] = []): any[] {
    const vaultId = this.getVaultId();
    const modifiedSql = this.injectVaultFilter(sql);
    return this.db.prepare(modifiedSql).all(vaultId, ...params);
  }

  /**
   * Get single row with vault scoping
   *
   * Same as queryWithVault but returns only the first matching row.
   *
   * @param sql - SQL SELECT statement
   * @param params - Query parameters (vault_id is auto-prepended)
   * @returns First matching row or undefined
   *
   * @example
   * const session = db.getWithVault(
   *   'SELECT * FROM sessions WHERE id = ?',
   *   [sessionId]
   * );
   */
  getWithVault(sql: string, params: any[] = []): any {
    const vaultId = this.getVaultId();
    const modifiedSql = this.injectVaultFilter(sql);
    return this.db.prepare(modifiedSql).get(vaultId, ...params);
  }

  /**
   * Run mutation (UPDATE/DELETE) with vault_id in WHERE
   *
   * Modifies the SQL to include vault_id filtering, ensuring mutations
   * only affect rows belonging to the current vault.
   *
   * @param sql - SQL UPDATE or DELETE statement
   * @param params - Query parameters (vault_id is auto-prepended)
   * @returns Run result with changes count
   *
   * @example
   * // Original: UPDATE sessions SET status = ? WHERE id = ?
   * // Modified: UPDATE sessions SET vault_id = ? AND status = ? WHERE id = ?
   * const result = db.runWithVault(
   *   'UPDATE sessions SET status = ? WHERE id = ?',
   *   ['inactive', sessionId]
   * );
   */
  runWithVault(sql: string, params: any[] = []): Database.RunResult {
    const vaultId = this.getVaultId();
    const modifiedSql = this.injectVaultFilter(sql);
    // For UPDATE/DELETE statements, the vault_id placeholder is in the WHERE clause,
    // which comes after any SET clause placeholders. We need to insert vaultId
    // at the position where WHERE clause parameters begin.
    const upperSql = sql.toUpperCase();
    const whereIndex = upperSql.indexOf('WHERE');
    if (whereIndex !== -1) {
      // Count placeholders before WHERE clause
      const beforeWhere = sql.slice(0, whereIndex);
      const placeholderCount = (beforeWhere.match(/\?/g) || []).length;
      // Insert vaultId at the correct position
      const newParams = [...params.slice(0, placeholderCount), vaultId, ...params.slice(placeholderCount)];
      return this.db.prepare(modifiedSql).run(...newParams);
    }
    // No WHERE clause - just prepend vaultId
    return this.db.prepare(modifiedSql).run(vaultId, ...params);
  }

  /**
   * Insert with automatic vault_id column
   *
   * Adds vault_id to the column list and values, ensuring new rows
   * are associated with the current vault.
   *
   * @param table - Table name to insert into
   * @param data - Object with column names as keys and values
   * @returns Run result with lastInsertRowid
   *
   * @example
   * const result = db.insertWithVault('sessions', {
   *   id: 'session-123',
   *   name: 'My Session',
   *   created_at: new Date().toISOString()
   * });
   * // Inserts: vault_id, id, name, created_at
   */
  insertWithVault(table: string, data: Record<string, any>): Database.RunResult {
    const vaultId = this.getVaultId();
    const dataWithVault = { vault_id: vaultId, ...data };
    const columns = Object.keys(dataWithVault);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.db.prepare(sql).run(...Object.values(dataWithVault));
  }

  /**
   * Insert or replace with automatic vault_id column
   *
   * Same as insertWithVault but uses INSERT OR REPLACE for upsert behavior.
   *
   * @param table - Table name
   * @param data - Object with column names as keys and values
   * @returns Run result
   */
  upsertWithVault(table: string, data: Record<string, any>): Database.RunResult {
    const vaultId = this.getVaultId();
    const dataWithVault = { vault_id: vaultId, ...data };
    const columns = Object.keys(dataWithVault);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.db.prepare(sql).run(...Object.values(dataWithVault));
  }

  /**
   * Delete with vault scoping
   *
   * Deletes rows from a table with automatic vault_id filtering.
   *
   * @param table - Table name
   * @param whereClause - WHERE clause (without WHERE keyword)
   * @param params - Parameters for the WHERE clause (vault_id auto-prepended)
   * @returns Run result with changes count
   *
   * @example
   * const result = db.deleteWithVault('sessions', 'id = ?', [sessionId]);
   * // Executes: DELETE FROM sessions WHERE vault_id = ? AND id = ?
   */
  deleteWithVault(
    table: string,
    whereClause: string,
    params: any[] = []
  ): Database.RunResult {
    const vaultId = this.getVaultId();
    const sql = `DELETE FROM ${table} WHERE vault_id = ? AND ${whereClause}`;
    return this.db.prepare(sql).run(vaultId, ...params);
  }

  /**
   * Count rows with vault scoping
   *
   * @param table - Table name
   * @param whereClause - Optional WHERE clause (without WHERE keyword)
   * @param params - Parameters for the WHERE clause
   * @returns Count of matching rows
   *
   * @example
   * const total = db.countWithVault('sessions');
   * const active = db.countWithVault('sessions', 'status = ?', ['active']);
   */
  countWithVault(
    table: string,
    whereClause?: string,
    params: any[] = []
  ): number {
    const vaultId = this.getVaultId();
    let sql = `SELECT COUNT(*) as count FROM ${table} WHERE vault_id = ?`;
    if (whereClause) {
      sql += ` AND ${whereClause}`;
    }
    const result = this.db.prepare(sql).get(vaultId, ...params) as { count: number };
    return result.count;
  }

  /**
   * Helper to inject vault_id filter into WHERE clause
   *
   * Handles both queries with and without existing WHERE clauses.
   * For queries without WHERE, adds one. For queries with WHERE,
   * prepends vault_id condition.
   *
   * @internal
   */
  private injectVaultFilter(sql: string): string {
    const upperSql = sql.toUpperCase();
    const whereIndex = upperSql.indexOf('WHERE');

    if (whereIndex === -1) {
      // No WHERE clause - add one after FROM clause
      const fromMatch = upperSql.match(/FROM\s+(\w+)/);
      if (fromMatch) {
        const insertPoint = sql.indexOf(fromMatch[0]) + fromMatch[0].length;
        return sql.slice(0, insertPoint) + ' WHERE vault_id = ?' + sql.slice(insertPoint);
      }
      // Fallback: append WHERE clause
      return sql + ' WHERE vault_id = ?';
    } else {
      // Insert after WHERE
      const insertPoint = whereIndex + 5; // "WHERE".length
      return sql.slice(0, insertPoint) + ' vault_id = ? AND' + sql.slice(insertPoint);
    }
  }

  /**
   * Get direct access to the underlying database
   *
   * Use sparingly - prefer the vault-scoped methods for safety.
   * Useful for migrations, admin operations, or complex queries that
   * can't use automatic injection.
   */
  get raw(): Database.Database {
    return this.db;
  }

  /**
   * Execute a transaction with vault context
   *
   * @param fn - Function to execute within transaction
   * @returns Result of the transaction function
   *
   * @example
   * const result = db.transaction(() => {
   *   db.insertWithVault('sessions', { id: 's1', name: 'Session 1' });
   *   db.insertWithVault('sessions', { id: 's2', name: 'Session 2' });
   *   return { created: 2 };
   * });
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}

/**
 * Factory to create vault-scoped database using current AsyncLocalStorage context
 *
 * The returned database instance dynamically looks up the vault ID on each
 * operation, so it works correctly even if the vault context changes.
 *
 * @param db - The underlying better-sqlite3 database instance
 * @returns VaultScopedDatabase that uses current context for vaultId
 *
 * @example
 * // At request start (after auth middleware)
 * const db = createVaultScopedDb(rawDb);
 *
 * // Later in the request - vault ID is looked up dynamically
 * const sessions = db.queryWithVault('SELECT * FROM sessions');
 */
export function createVaultScopedDb(db: Database.Database): VaultScopedDatabase {
  return new VaultScopedDatabase(db, () => getVaultId());
}

/**
 * Factory with explicit vault ID (for background jobs, migrations, etc.)
 *
 * Use this when you have a known vault ID and don't want to rely on
 * AsyncLocalStorage context (e.g., in background workers, migration scripts,
 * or admin tools).
 *
 * @param db - The underlying better-sqlite3 database instance
 * @param vaultId - Explicit vault ID to use
 * @returns VaultScopedDatabase bound to the specified vault
 *
 * @example
 * // In a background job processing vault data
 * async function processVaultData(vaultId: string) {
 *   const db = createVaultScopedDbExplicit(rawDb, vaultId);
 *   const data = db.queryWithVault('SELECT * FROM data WHERE processed = ?', [false]);
 *   // ...
 * }
 */
export function createVaultScopedDbExplicit(
  db: Database.Database,
  vaultId: string
): VaultScopedDatabase {
  return new VaultScopedDatabase(db, vaultId);
}

/**
 * Decorator-style helper for wrapping async handlers with vault context
 *
 * Useful for Express route handlers or similar callback-based patterns.
 *
 * @param getContext - Function to extract VaultContext from arguments
 * @param handler - The async handler function to wrap
 * @returns Wrapped handler that establishes vault context
 *
 * @example
 * const handler = withVaultContextHandler(
 *   (req) => ({ vaultId: req.user.vaultId }),
 *   async (req, res) => {
 *     const sessions = await getSessions(); // Has vault context
 *     res.json(sessions);
 *   }
 * );
 */
export function withVaultContextHandler<T extends any[], R>(
  getContext: (...args: T) => VaultContext,
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    const ctx = getContext(...args);
    return withVaultContextAsync(ctx, () => handler(...args));
  };
}
