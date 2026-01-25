# Metamorph Multitenancy Guide

> Complete documentation for the vault-based multitenancy system in Metamorph

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Getting Started](#3-getting-started)
4. [Authentication](#4-authentication)
5. [Vault Context System](#5-vault-context-system)
6. [Database Access](#6-database-access)
7. [Sandbox Execution](#7-sandbox-execution)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Migration Guide](#10-migration-guide)

---

## 1. Overview

### What is Multitenancy?

Metamorph's multitenancy system allows multiple users (tenants) to share the same application instance while maintaining complete data isolation. Each tenant is identified by a **vault** - a unique identifier that serves as the partition key for all user data.

### The Vault Isolation Model

Every piece of user-specific data in Metamorph is scoped to a vault:

- **Sessions and Conversations**: Each user's chat sessions are isolated
- **Memories**: Episodic, semantic, and identity memories are per-vault
- **Identity Checkpoints**: Each user has their own evolving AI identity
- **Evolution Snapshots**: Transformation history is user-specific
- **Operator Learning**: Bayesian operator learning is personalized

```
Vault A                              Vault B
+-----------------------+            +-----------------------+
|  Sessions             |            |  Sessions             |
|  - session-a1         |            |  - session-b1         |
|  - session-a2         |            |                       |
+-----------------------+            +-----------------------+
|  Memories             |            |  Memories             |
|  - 15 episodic        |            |  - 8 episodic         |
|  - 23 semantic        |            |  - 12 semantic        |
+-----------------------+            +-----------------------+
|  Identity             |            |  Identity             |
|  - checkpoint #42     |            |  - checkpoint #7      |
+-----------------------+            +-----------------------+
         |                                    |
         +------------ ISOLATED --------------+
```

### Key Guarantees

1. **Data Isolation**: Vault A cannot read, write, or even detect Vault B's data
2. **Query Scoping**: All database queries automatically filter by vault_id
3. **Context Propagation**: Vault identity propagates through async call chains
4. **Sandbox Isolation**: Code execution is isolated per vault (when enabled)

---

## 2. Architecture

### System Layer Diagram

```
+------------------------------------------------------------------+
|                        Client Request                             |
|                 Authorization: Bearer <JWT>                       |
|                    or X-Vault-Id: dev-vault                       |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                    Emblem Auth Middleware                         |
|                                                                   |
|  - Validates JWT token (production) or uses X-Vault-Id (dev)     |
|  - Extracts vaultId, userId, permissions                         |
|  - Attaches user object to request                               |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                  Vault Context Middleware                         |
|                                                                   |
|  - Establishes AsyncLocalStorage context                         |
|  - Provides getCurrentVault() throughout request lifecycle       |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                    VaultScopedDatabase                            |
|                                                                   |
|  - Wraps better-sqlite3 database                                 |
|  - Auto-injects vault_id into all queries                        |
|  - Methods: queryWithVault, insertWithVault, deleteWithVault     |
+-------------------------------+----------------------------------+
                                |
                                v
+------------------------------------------------------------------+
|                      SQLite Database                              |
|                                                                   |
|  - All tables have vault_id column                               |
|  - Composite indexes for efficient vault-scoped queries          |
|  - WAL mode for concurrent access                                |
+------------------------------------------------------------------+
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Emblem Auth | `src/server/middleware/emblem-auth.ts` | JWT validation and dev mode bypass |
| Vault Context | `src/multitenancy/vault-context.ts` | AsyncLocalStorage context management |
| VaultScopedDatabase | `src/multitenancy/vault-context.ts` | Auto-scoped database queries |
| Sandbox Manager | `src/multitenancy/sandbox-manager.ts` | Isolated code execution per vault |
| Migration | `src/db/migrations/001_add_vault_id.ts` | Schema changes for multitenancy |
| Migrator | `src/db/migrator.ts` | Migration lifecycle management |

---

## 3. Getting Started

### Environment Variables

```bash
# Required for production
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key
EMBLEM_JWT_SECRET=your-secret      # JWT signing secret for token validation

# Optional - Emblem API (fallback validation)
EMBLEM_API_URL=https://api.emblemvault.ai

# Development mode - bypasses JWT validation
EMBLEM_DEV_MODE=true

# Database
DATABASE_PATH=./data/metamorph.db

# Optional - Vercel Sandbox (for isolated code execution)
VERCEL_OIDC_TOKEN=...              # Vercel OIDC token (auto-set in Vercel)
# OR manual credentials:
VERCEL_TOKEN=...
VERCEL_TEAM_ID=...
VERCEL_PROJECT_ID=...
```

### Running Migrations

Migrations add the `vault_id` column to all user-scoped tables:

```bash
# Run all pending migrations
npm run migrate

# Or manually from code:
import { runMigrations } from './src/db/migrator.js';

const result = await runMigrations();
console.log(`Applied ${result.results.length} migrations`);
```

### Migration Details

The `001_add_vault_id` migration:

1. **Adds vault_id column** to 20+ tables:
   - sessions, messages, conversations
   - semantic_memory, identity, evolution_snapshots
   - operator_performance, subagent_results
   - emotional_arcs, emotion_context
   - And more...

2. **Creates composite indexes** for efficient queries:
   - `idx_sessions_vault_id` - (vault_id, id)
   - `idx_sessions_vault_accessed` - (vault_id, last_accessed)
   - etc.

3. **Migrates existing data** to `default-vault` vault ID

### Dev Mode vs Production Mode

**Development Mode** (`EMBLEM_DEV_MODE=true`):
- No JWT validation required
- Use `X-Vault-Id` header to specify vault
- Falls back to `dev-vault` if no header
- Full permissions granted automatically

**Production Mode**:
- Requires valid JWT Bearer token
- Validates token signature with EMBLEM_JWT_SECRET
- Falls back to Emblem API validation
- Permissions extracted from token claims

---

## 4. Authentication

### How Emblem Auth Works

Emblem Auth is a flexible authentication middleware supporting both JWT validation and external API verification.

#### Token Flow

```
Client                     Metamorph Server                 Emblem API
  |                              |                              |
  |  Authorization: Bearer JWT   |                              |
  +----------------------------->|                              |
  |                              |                              |
  |                              | 1. Extract Bearer token      |
  |                              | 2. Verify JWT signature      |
  |                              |    (if EMBLEM_JWT_SECRET set)|
  |                              |                              |
  |                              | 3. If JWT fails, call API    |
  |                              +----------------------------->|
  |                              |                              |
  |                              |     vaultId, permissions     |
  |                              |<-----------------------------+
  |                              |                              |
  |       Protected Resource     |                              |
  |<-----------------------------+                              |
```

#### Token Format

JWT tokens should include these claims:

```json
{
  "vault_id": "user-vault-123",      // or "vaultId" (camelCase)
  "user_id": "user-456",             // or "userId" or "sub"
  "email": "user@example.com",       // optional
  "permissions": ["read", "write"],  // or "scope": "read write"
  "exp": 1735084800                  // expiration timestamp
}
```

#### Using the Middleware

```typescript
import { requireAuth, optionalAuth, hasPermission } from './server/middleware/emblem-auth.js';

// Require authentication
app.get('/api/sessions', requireAuth(), (req, res) => {
  // req.user.vaultId is guaranteed to exist
  const sessions = getSessionsForVault(req.user.vaultId);
  res.json(sessions);
});

// Require specific permissions
app.post('/api/admin/users', requireAuth({ permissions: ['admin'] }), (req, res) => {
  // Only users with 'admin' permission can access
});

// Optional authentication
app.get('/api/public', optionalAuth(), (req, res) => {
  if (req.user) {
    // Personalized response
  } else {
    // Anonymous response
  }
});

// Check permissions in handler
app.post('/api/data', requireAuth(), (req, res) => {
  if (hasPermission(req, 'write')) {
    // Allow write operation
  } else {
    res.status(403).json({ error: 'Write permission required' });
  }
});
```

#### Dev Mode Bypass

In development, use the `X-Vault-Id` header:

```bash
# Use specific vault
curl -H "X-Vault-Id: my-test-vault" http://localhost:3001/api/sessions

# Use default dev vault
curl http://localhost:3001/api/sessions  # Uses 'dev-vault'
```

---

## 5. Vault Context System

### AsyncLocalStorage Pattern

The vault context system uses Node.js `AsyncLocalStorage` to propagate vault identity through async call chains without explicit parameter passing.

```typescript
import {
  withVaultContext,
  withVaultContextAsync,
  getCurrentVault,
  tryGetCurrentVault,
  getVaultId,
} from './multitenancy/vault-context.js';
```

### Using withVaultContext()

Wrap synchronous code in a vault context:

```typescript
// Establish context for synchronous code
const result = withVaultContext({ vaultId: 'vault-123' }, () => {
  // All code here has access to vault context
  const vault = getCurrentVault();
  console.log(`Operating in vault: ${vault.vaultId}`);

  return doSomething();
});
```

Wrap asynchronous code:

```typescript
// Establish context for async code
const data = await withVaultContextAsync({ vaultId: 'vault-123' }, async () => {
  // Context propagates through awaits
  const sessions = await fetchSessions();

  await new Promise(resolve => setTimeout(resolve, 100));

  // Still in vault-123 context
  return getCurrentVault().vaultId;
});
```

### Getting Current Vault in Any Code

```typescript
// Throws if no context (use in code that requires authentication)
const { vaultId, userId } = getCurrentVault();

// Returns null if no context (use for optional scoping)
const ctx = tryGetCurrentVault();
if (ctx) {
  console.log(`In vault: ${ctx.vaultId}`);
} else {
  console.log('Anonymous access');
}

// Get just vaultId with optional fallback
const vaultId = getVaultId();              // Throws if no context
const vaultId = getVaultId('default');     // Returns 'default' if no context
```

### Context Isolation

Nested contexts are properly isolated:

```typescript
withVaultContext({ vaultId: 'outer-vault' }, () => {
  console.log(getCurrentVault().vaultId);  // 'outer-vault'

  withVaultContext({ vaultId: 'inner-vault' }, () => {
    console.log(getCurrentVault().vaultId);  // 'inner-vault'
  });

  console.log(getCurrentVault().vaultId);  // 'outer-vault' (restored)
});
```

Concurrent requests maintain separate contexts:

```typescript
// Request 1 (vault-a)        Request 2 (vault-b)
// |                          |
// +- withVaultContext(a)     +- withVaultContext(b)
// |  +- getCurrentVault()    |  +- getCurrentVault()
// |     -> 'vault-a'         |     -> 'vault-b'
// |                          |
// +- Each request isolated   +- No cross-contamination
```

### Express Middleware Integration

The vault context middleware establishes context for each request:

```typescript
import { vaultContextMiddleware } from './multitenancy/vault-context.js';

// Apply after auth middleware
app.use(requireAuth());
app.use(vaultContextMiddleware());

// Now getCurrentVault() works in all route handlers
app.get('/api/data', (req, res) => {
  const vault = getCurrentVault();  // Works!
});
```

---

## 6. Database Access

### VaultScopedDatabase

The `VaultScopedDatabase` class wraps better-sqlite3 to automatically inject vault_id filtering into queries.

#### Creating a Scoped Database

```typescript
import {
  VaultScopedDatabase,
  createVaultScopedDb,
  createVaultScopedDbExplicit,
} from './multitenancy/vault-context.js';

// Use current vault context (dynamic lookup)
const db = createVaultScopedDb(rawDb);

// Use explicit vault ID (for background jobs, migrations)
const db = createVaultScopedDbExplicit(rawDb, 'specific-vault');

// Manual construction
const db = new VaultScopedDatabase(rawDb, 'vault-123');
// Or with dynamic lookup
const db = new VaultScopedDatabase(rawDb, () => getVaultId());
```

#### Query Methods

**queryWithVault** - SELECT with automatic vault filtering:

```typescript
// Original: SELECT * FROM sessions WHERE active = ?
// Modified: SELECT * FROM sessions WHERE vault_id = ? AND active = ?
const sessions = db.queryWithVault(
  'SELECT * FROM sessions WHERE active = ?',
  [true]
);
// Returns only sessions belonging to current vault
```

**getWithVault** - Get single row:

```typescript
const session = db.getWithVault(
  'SELECT * FROM sessions WHERE id = ?',
  [sessionId]
);
// Returns undefined if session exists but belongs to different vault
```

**insertWithVault** - Insert with automatic vault_id:

```typescript
const result = db.insertWithVault('sessions', {
  id: 'session-123',
  name: 'My Session',
  created_at: new Date().toISOString()
});
// Automatically adds vault_id column to insert
```

**upsertWithVault** - Insert or replace:

```typescript
db.upsertWithVault('sessions', {
  id: 'session-123',
  name: 'Updated Name'
});
```

**deleteWithVault** - Delete with vault scoping:

```typescript
const result = db.deleteWithVault('sessions', 'id = ?', [sessionId]);
// Only deletes if session belongs to current vault
console.log(`Deleted ${result.changes} rows`);
```

**countWithVault** - Count rows in vault:

```typescript
const total = db.countWithVault('sessions');
const active = db.countWithVault('sessions', 'status = ?', ['active']);
```

**runWithVault** - Run UPDATE/DELETE:

```typescript
const result = db.runWithVault(
  'UPDATE sessions SET status = ? WHERE id = ?',
  ['inactive', sessionId]
);
// Only updates if session belongs to current vault
```

#### Transactions

```typescript
db.transaction(() => {
  db.insertWithVault('sessions', { id: 's1', name: 'Session 1' });
  db.insertWithVault('sessions', { id: 's2', name: 'Session 2' });
  // Atomic: both succeed or both fail
});
```

#### Raw Database Access

When automatic injection doesn't work (complex JOINs, subqueries):

```typescript
// Use prepare() for manual queries
const stmt = db.prepare(`
  SELECT s.name, COUNT(m.id) as message_count
  FROM sessions s
  LEFT JOIN messages m ON s.id = m.session_id
  WHERE s.vault_id = ? AND m.vault_id = ?
  GROUP BY s.id
`);
const results = stmt.all(vaultId, vaultId);

// Or access underlying database
const rawDb = db.raw;
```

---

## 7. Sandbox Execution

### When Sandboxes Are Used

Sandboxes provide isolated code execution environments for:

- Running user-provided code safely
- Isolating computational workloads
- Preventing resource exhaustion across vaults
- Executing untrusted transformations

### Sandbox Types

**Vercel Sandbox** (Production):
- Cloud-based MicroVMs
- Full process isolation
- Network and filesystem isolation
- Requires Vercel credentials

**Node.js vm** (Development/Fallback):
- Local VM-based isolation
- Restricted globals and modules
- No network isolation
- Always available

```typescript
import { SandboxManager, sandboxManager } from './multitenancy/sandbox-manager.js';

// Use default singleton
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  'return 1 + 2;'
);

// Or create custom manager
const manager = new SandboxManager({
  maxPoolSize: 10,
  defaultConfig: {
    memoryLimitMB: 128,
    timeoutMs: 30000,
    allowedModules: ['path', 'url', 'crypto']
  },
  forceVmFallback: false
});
```

### Resource Limits

| Setting | Default | Description |
|---------|---------|-------------|
| memoryLimitMB | 128 | Maximum memory per sandbox |
| timeoutMs | 30000 | Maximum execution time (30 seconds) |
| maxPoolSize | 10 | Maximum concurrent sandboxes |

### Module Allowlist

Only these modules can be `require()`d in sandboxes:

- `path` - Path manipulation
- `url` - URL parsing
- `crypto` - Cryptographic functions
- `querystring` - Query string parsing
- `util` - Utility functions
- `buffer` - Buffer operations
- `events` - Event emitter
- `stream` - Stream utilities

Blocked modules include filesystem access, process spawning, and network access modules.

### Code Execution

```typescript
// Simple execution
const result = await manager.executeSandboxed(
  'vault-123',
  'return 1 + 2;'
);
// { success: true, output: 3, executionTimeMs: 5 }

// With context variables
const result = await manager.executeSandboxed(
  'vault-123',
  'return x * y;',
  { x: 10, y: 5 }
);
// { success: true, output: 50, executionTimeMs: 3 }

// Using allowed modules
const result = await manager.executeSandboxed(
  'vault-123',
  `
    const path = require('path');
    return path.join('a', 'b', 'c');
  `
);
// { success: true, output: 'a/b/c', executionTimeMs: 8 }

// Handling errors
const result = await manager.executeSandboxed(
  'vault-123',
  'throw new Error("Something went wrong");'
);
// { success: false, error: 'Something went wrong', executionTimeMs: 2 }
```

### Vault Data Isolation

Each sandbox has isolated per-vault storage:

```typescript
// Store data in vault-a's sandbox
await manager.executeSandboxed('vault-a', `
  __vaultData__.set('secret', 'vault-a-value');
`);

// Cannot access from vault-b
const result = await manager.executeSandboxed('vault-b', `
  return __vaultData__.get('secret');
`);
// result.output is undefined
```

### Sandbox Lifecycle

```typescript
// Get statistics
const stats = manager.getStats();
// { activeCount: 3, maxPoolSize: 10, sandboxType: 'vm', vaults: ['v1', 'v2', 'v3'] }

// Check if vault has sandbox
manager.hasSandbox('vault-123');  // true/false

// Destroy specific sandbox
await manager.destroySandbox('vault-123');

// Shutdown all (on server shutdown)
await manager.shutdown();
```

---

## 8. Deployment

### Railway Setup

#### 1. Create Volume for Database Persistence

```
Railway Dashboard -> Service -> Settings -> Volumes
  Name: metamorph-data
  Mount Path: /data
  Size: 1GB (auto-expands)
```

#### 2. Configure railway.toml

```toml
[build]
builder = "NIXPACKS"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[mounts]]
source = "metamorph-data"
destination = "/data"
```

#### 3. Set Environment Variables

```bash
# Railway CLI or Dashboard
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set EMBLEM_JWT_SECRET=your-jwt-secret
railway variables set DATABASE_PATH=/data/metamorph.db
railway variables set NODE_ENV=production
```

### Volume Configuration

```
+------------------------------------------------------------------+
|                   Railway Container                               |
|                                                                   |
|   /data/                      <- Railway Volume Mount             |
|   +-- metamorph.db            <- Main SQLite database             |
|   +-- metamorph.db-wal        <- Write-ahead log                  |
|   +-- metamorph.db-shm        <- Shared memory                    |
|   +-- backups/                <- Optional backup directory        |
|                                                                   |
+------------------------------------------------------------------+
```

### Environment Variables for Production

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
EMBLEM_JWT_SECRET=...                   # JWT signing secret (32+ chars)

# Database
DATABASE_PATH=/data/metamorph.db        # Path on Railway volume
RAILWAY_VOLUME_MOUNT_PATH=/data         # Auto-set by Railway

# Production Settings
NODE_ENV=production
EMBLEM_DEV_MODE=false                   # Disable dev mode!

# Optional - Vercel Sandbox
VERCEL_OIDC_TOKEN=...                   # If using Vercel Sandbox

# Optional - External Services
EMBLEM_API_URL=https://api.emblemvault.ai
NOESIS_REMOTE_URL=https://...           # For memory sync
```

### Backup Strategy

```bash
# Manual backup via Railway CLI
railway run sqlite3 /data/metamorph.db ".backup /data/backups/metamorph-$(date +%Y%m%d).db"

# Restore from backup
railway run cp /data/backups/metamorph-YYYYMMDD.db /data/metamorph.db
railway restart
```

---

## 9. Testing

### Running Multitenancy Tests

```bash
# Run all multitenancy tests
npm test -- src/multitenancy

# Run specific test files
npm test -- src/multitenancy/__tests__/vault-context.test.ts
npm test -- src/multitenancy/__tests__/vault-isolation.test.ts
npm test -- src/multitenancy/__tests__/emblem-auth.test.ts
npm test -- src/multitenancy/__tests__/sandbox-manager.test.ts
```

### Testing Vault Isolation

The vault isolation tests verify that:

1. **Cross-vault queries return empty**: Vault A cannot see Vault B's data
2. **Cross-vault mutations fail**: Vault A cannot modify Vault B's data
3. **Nested contexts isolate properly**: Inner contexts don't leak
4. **Concurrent contexts don't interfere**: Parallel requests stay isolated

Example test pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { VaultScopedDatabase } from '../vault-context.js';

describe('Vault Isolation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE test_items (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        name TEXT
      )
    `);
    // Seed data for multiple vaults
    db.exec(`
      INSERT INTO test_items VALUES
        ('item-1', 'vault-a', 'Item A'),
        ('item-2', 'vault-b', 'Item B')
    `);
  });

  it('vault-a cannot see vault-b data', () => {
    const scopedDb = new VaultScopedDatabase(db, 'vault-a');
    const count = scopedDb.countWithVault('test_items');
    expect(count).toBe(1);  // Only sees its own data
  });

  it('vault-a cannot delete vault-b data', () => {
    const scopedDb = new VaultScopedDatabase(db, 'vault-a');
    const result = scopedDb.deleteWithVault('test_items', 'id = ?', ['item-2']);
    expect(result.changes).toBe(0);  // No rows deleted

    // Verify item-2 still exists
    const row = db.prepare('SELECT * FROM test_items WHERE id = ?').get('item-2');
    expect(row).toBeDefined();
  });
});
```

### Integration Test Pattern

```typescript
import { requireAuth } from '../server/middleware/emblem-auth.js';
import { withVaultContext, createVaultScopedDb } from '../multitenancy/vault-context.js';

describe('API Integration', () => {
  it('protects endpoints and scopes data', async () => {
    // Set up test with EMBLEM_DEV_MODE=true

    // Request with X-Vault-Id header
    const response = await request(app)
      .get('/api/sessions')
      .set('X-Vault-Id', 'test-vault');

    expect(response.status).toBe(200);
    // Verify response only contains test-vault data
  });
});
```

---

## 10. Migration Guide

### For Existing Single-Tenant Deployments

#### Step 1: Backup Your Database

```bash
# Create backup before migration
sqlite3 ./data/metamorph.db ".backup ./data/metamorph-backup-$(date +%Y%m%d).db"
```

#### Step 2: Run Migration

```bash
# The migration adds vault_id columns and indexes
npm run migrate
```

What the migration does:

1. Adds `vault_id TEXT NOT NULL DEFAULT 'default-vault'` to all tables
2. Creates composite indexes for vault-scoped queries
3. Updates all existing rows to use `default-vault` as vault_id

#### Step 3: Verify Migration

```bash
# Check that columns were added
sqlite3 ./data/metamorph.db "PRAGMA table_info(sessions)"

# Check that data was migrated
sqlite3 ./data/metamorph.db "SELECT vault_id, COUNT(*) FROM sessions GROUP BY vault_id"
```

#### Step 4: Update Configuration

```bash
# For development (keeps working as before)
EMBLEM_DEV_MODE=true
# All requests use 'dev-vault' by default

# For production (requires auth setup)
EMBLEM_DEV_MODE=false
EMBLEM_JWT_SECRET=your-secret
```

### Data Migration Considerations

#### Handling Legacy Data

All existing data is migrated to `default-vault`. You can:

1. **Keep as-is**: Legacy users continue using `default-vault`
2. **Migrate to new vaults**: Update vault_id for existing users:

```sql
-- Migrate specific user's data to their vault
UPDATE sessions SET vault_id = 'user-123-vault'
WHERE vault_id = 'default-vault' AND created_by = 'user-123';

UPDATE semantic_memory SET vault_id = 'user-123-vault'
WHERE vault_id = 'default-vault' AND user_id = 'user-123';
```

#### Rollback (if needed)

The migration `down` function removes indexes but preserves columns:

```bash
# Rollback last migration
npm run migrate:rollback
```

Note: SQLite doesn't support DROP COLUMN, so vault_id columns remain but indexes are removed.

### Gradual Rollout

For gradual adoption:

1. **Phase 1**: Enable dev mode, test with X-Vault-Id headers
2. **Phase 2**: Integrate authentication, test with real tokens
3. **Phase 3**: Migrate legacy data to user vaults
4. **Phase 4**: Disable dev mode in production

---

## Appendix A: Quick Reference

### Common Patterns

```typescript
// Get vault ID (throws if not in context)
const vaultId = getVaultId();

// Get vault ID with fallback
const vaultId = getVaultId('anonymous');

// Check vault context exists
const ctx = tryGetCurrentVault();
if (ctx) { /* authenticated */ }

// Create scoped database
const db = createVaultScopedDb(rawDb);

// Query with vault scoping
const items = db.queryWithVault('SELECT * FROM items WHERE active = ?', [true]);

// Insert with automatic vault_id
db.insertWithVault('items', { name: 'New Item' });
```

### Environment Quick Reference

| Variable | Required | Description |
|----------|----------|-------------|
| ANTHROPIC_API_KEY | Yes | Claude API key |
| EMBLEM_JWT_SECRET | Prod | JWT signing secret |
| EMBLEM_DEV_MODE | No | Enable dev mode (default: false) |
| DATABASE_PATH | No | SQLite path (default: ./data/metamorph.db) |

### API Headers

| Header | When | Description |
|--------|------|-------------|
| Authorization: Bearer <token> | Production | JWT authentication |
| X-Vault-Id: <vault> | Dev mode | Override vault (dev only) |

---

## Appendix B: Troubleshooting

### "No vault context" Error

**Cause**: Code is accessing vault context outside of middleware scope.

**Solution**: Ensure the code runs within `withVaultContext()` or after vault middleware:

```typescript
// Wrong
app.get('/api/data', (req, res) => {
  const vault = getCurrentVault();  // Error!
});

// Right
app.use(vaultContextMiddleware());
app.get('/api/data', (req, res) => {
  const vault = getCurrentVault();  // Works!
});
```

### Cross-Vault Data Leakage

**Cause**: Using raw database instead of VaultScopedDatabase.

**Solution**: Always use vault-scoped methods:

```typescript
// Wrong (leaks data)
const items = db.prepare('SELECT * FROM items').all();

// Right (vault-scoped)
const items = scopedDb.queryWithVault('SELECT * FROM items');
```

### Dev Mode in Production

**Symptoms**: All requests succeed without authentication.

**Solution**: Ensure `EMBLEM_DEV_MODE` is not set or is `false` in production:

```bash
# Verify
railway variables
# Should NOT show EMBLEM_DEV_MODE=true
```
