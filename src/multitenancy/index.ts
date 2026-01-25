/**
 * Multitenancy Module
 *
 * This module provides vault-based multi-tenant isolation for Metamorph.
 * Each vault represents an isolated tenant with:
 * - Separate database records (via vault_id column)
 * - Isolated code execution (via SandboxManager)
 * - Request-scoped context (via VaultContext)
 *
 * Key components:
 *
 * VaultContext - Request-scoped vault identification using AsyncLocalStorage
 *   - getCurrentVault() - Get current vault context (throws if not set)
 *   - tryGetCurrentVault() - Get current vault context or null
 *   - getVaultId() - Get just the vaultId with optional fallback
 *   - withVaultContext() - Run code within a vault context
 *   - withVaultContextAsync() - Run async code within a vault context
 *   - vaultContextMiddleware() - Express middleware to set vault context
 *
 * VaultScopedDatabase - Database wrapper that auto-injects vault_id filtering
 *   - queryWithVault() - SELECT with automatic vault scoping
 *   - getWithVault() - Get single row with vault scoping
 *   - runWithVault() - UPDATE/DELETE with vault scoping
 *   - insertWithVault() - INSERT with automatic vault_id
 *   - createVaultScopedDb() - Factory using current context
 *   - createVaultScopedDbExplicit() - Factory with explicit vaultId
 *
 * SandboxManager - Per-vault isolated code execution
 *   - getOrCreateSandbox() - Get/create sandbox for a vault
 *   - executeSandboxed() - Execute code in vault's sandbox
 *   - destroySandbox() - Cleanup a vault's sandbox
 *
 * Typical usage:
 *
 * ```typescript
 * // Server setup
 * import { requireAuth, vaultContextMiddleware, createVaultScopedDb } from './multitenancy';
 *
 * app.use(requireAuth());           // Sets req.user with vaultId
 * app.use(vaultContextMiddleware()); // Sets AsyncLocalStorage context
 *
 * // In route handlers
 * app.get('/api/sessions', async (req, res) => {
 *   const db = createVaultScopedDb(rawDb);
 *   const sessions = db.queryWithVault('SELECT * FROM sessions WHERE active = ?', [true]);
 *   res.json(sessions);
 * });
 *
 * // For sandboxed code execution
 * app.post('/api/execute', async (req, res) => {
 *   const { vaultId } = getCurrentVault();
 *   const result = await sandboxManager.executeSandboxed(vaultId, req.body.code);
 *   res.json(result);
 * });
 * ```
 */

// VaultContext - Request-scoped vault identification
export {
  // Types
  type VaultContext,

  // Context access functions
  getCurrentVault,
  tryGetCurrentVault,
  getVaultId,

  // Context runners
  withVaultContext,
  withVaultContextAsync,
  withVaultContextHandler,

  // Express middleware
  vaultContextMiddleware,

  // Database wrapper
  VaultScopedDatabase,
  createVaultScopedDb,
  createVaultScopedDbExplicit,
} from './vault-context.js';

// SandboxManager - Per-vault isolated code execution
export {
  // Types
  type SandboxConfig,
  type ExecutionResult,

  // Class
  SandboxManager,

  // Default instance
  sandboxManager,
} from './sandbox-manager.js';
