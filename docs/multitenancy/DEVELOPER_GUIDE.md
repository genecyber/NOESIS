# Developer Guide

> Guide for developers extending the Metamorph multitenancy system

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Code Organization](#code-organization)
2. [Key Files](#key-files)
3. [Working with Vault Context](#working-with-vault-context)
4. [Using VaultScopedDatabase](#using-vaultscopeddatabase)
5. [Adding New Endpoints](#adding-new-endpoints)
6. [Testing Strategies](#testing-strategies)
7. [Common Patterns](#common-patterns)
8. [Anti-Patterns](#anti-patterns)

---

## Code Organization

### Directory Structure

```
src/
+-- config/
|   +-- database.ts          # Database configuration
+-- db/
|   +-- migrator.ts          # Migration runner
|   +-- migrations/          # Migration files
|       +-- 001_add_vault_id.ts
|       +-- 002_add_vercel_sandbox_tables.ts
+-- multitenancy/
|   +-- vault-context.ts     # AsyncLocalStorage context
|   +-- sandbox-manager.ts   # Sandbox execution
+-- server/
|   +-- middleware/
|   |   +-- emblem-auth.ts   # Authentication middleware
|   +-- routes/
|       +-- vercel-auth.ts   # Vercel OAuth routes
|       +-- sandboxes.ts     # Sandbox management routes
```

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `vault-context.ts` | Context propagation, VaultScopedDatabase |
| `emblem-auth.ts` | Authentication, token validation |
| `sandbox-manager.ts` | Sandboxed code execution |
| `database.ts` | SQLite configuration, pragmas |
| `migrator.ts` | Migration lifecycle |

---

## Key Files

### vault-context.ts

Core multitenancy module providing:

```typescript
// Context functions
getCurrentVault(): VaultContext           // Get current vault (throws if none)
tryGetCurrentVault(): VaultContext | null // Get current vault (returns null)
getVaultId(fallback?: string): string     // Get just vaultId

// Context wrappers
withVaultContext(ctx, fn)                 // Sync context wrapper
withVaultContextAsync(ctx, fn)            // Async context wrapper

// Database helpers
createVaultScopedDb(db)                   // Dynamic vault lookup
createVaultScopedDbExplicit(db, vaultId)  // Explicit vault ID

// Middleware
vaultContextMiddleware()                  // Express middleware

// Classes
VaultScopedDatabase                       // Vault-aware database wrapper
```

### emblem-auth.ts

Authentication module providing:

```typescript
// Token validation
validateEmblemToken(token): EmblemUser | null

// Middleware
requireAuth(options?)                     // Require authentication
optionalAuth()                            // Optional authentication

// Helpers
hasPermission(req, permission): boolean
getVaultIdFromRequest(req, fallback): string
```

### sandbox-manager.ts

Sandbox execution module providing:

```typescript
// Manager class
SandboxManager {
  getOrCreateSandbox(vaultId)
  executeSandboxed(vaultId, code, context?)
  destroySandbox(vaultId)
  shutdown()
  getStats()
}

// Default singleton
sandboxManager
```

---

## Working with Vault Context

### Setting Up Context

```typescript
import {
  withVaultContext,
  withVaultContextAsync,
  getCurrentVault,
  getVaultId
} from './multitenancy/vault-context.js';

// Synchronous context
withVaultContext({ vaultId: 'vault-123' }, () => {
  const vault = getCurrentVault();
  console.log(`Operating in vault: ${vault.vaultId}`);
});

// Asynchronous context
await withVaultContextAsync({ vaultId: 'vault-123' }, async () => {
  const data = await fetchData();
  const vault = getCurrentVault(); // Still available after await
  return processData(data, vault.vaultId);
});
```

### Express Integration

```typescript
import { requireAuth } from './server/middleware/emblem-auth.js';
import { vaultContextMiddleware, getCurrentVault } from './multitenancy/vault-context.js';

// Apply middleware chain
app.use('/api/protected', requireAuth());
app.use('/api/protected', vaultContextMiddleware());

// Handlers have vault context
app.get('/api/protected/data', (req, res) => {
  const vault = getCurrentVault();
  // Access vault.vaultId anywhere in the call chain
});
```

### Background Jobs

For background jobs without request context:

```typescript
import { withVaultContextAsync, createVaultScopedDbExplicit } from './multitenancy/vault-context.js';

async function processVaultJob(vaultId: string) {
  // Option 1: Use context wrapper
  await withVaultContextAsync({ vaultId }, async () => {
    const db = createVaultScopedDb(rawDb);
    // db uses current context for vaultId
  });

  // Option 2: Use explicit vault ID
  const db = createVaultScopedDbExplicit(rawDb, vaultId);
  // db uses provided vaultId directly
}
```

---

## Using VaultScopedDatabase

### Basic Usage

```typescript
import { createVaultScopedDb, VaultScopedDatabase } from './multitenancy/vault-context.js';
import Database from 'better-sqlite3';

// Create raw database
const rawDb = new Database('./data/metamorph.db');

// Wrap with vault scoping (uses context)
const db = createVaultScopedDb(rawDb);
```

### Query Methods

```typescript
// SELECT with automatic vault filtering
const sessions = db.queryWithVault(
  'SELECT * FROM sessions WHERE status = ?',
  ['active']
);
// Becomes: SELECT * FROM sessions WHERE vault_id = ? AND status = ?

// Single row
const session = db.getWithVault(
  'SELECT * FROM sessions WHERE id = ?',
  ['session-123']
);

// INSERT with automatic vault_id
db.insertWithVault('sessions', {
  id: 'session-123',
  name: 'My Session',
  created_at: new Date().toISOString()
});
// Inserts: (vault_id, id, name, created_at)

// UPDATE with vault filtering
db.runWithVault(
  'UPDATE sessions SET name = ? WHERE id = ?',
  ['New Name', 'session-123']
);

// DELETE with vault filtering
db.deleteWithVault('sessions', 'id = ?', ['session-123']);

// COUNT
const count = db.countWithVault('sessions');
const activeCount = db.countWithVault('sessions', 'status = ?', ['active']);
```

### Transactions

```typescript
db.transaction(() => {
  db.insertWithVault('sessions', { id: 's1', name: 'Session 1' });
  db.insertWithVault('sessions', { id: 's2', name: 'Session 2' });
  // Atomic: both succeed or both fail
});
```

### Complex Queries

For queries where automatic injection does not work:

```typescript
// Use prepare() for full control
const vaultId = getVaultId();
const stmt = db.prepare(`
  SELECT s.name, COUNT(m.id) as message_count
  FROM sessions s
  LEFT JOIN messages m ON s.id = m.session_id
  WHERE s.vault_id = ? AND m.vault_id = ?
  GROUP BY s.id
`);
const results = stmt.all(vaultId, vaultId);

// Or access raw database
const rawDb = db.raw;
```

---

## Adding New Endpoints

### Step 1: Create Route Handler

```typescript
// src/server/routes/my-feature.ts
import { Router, Request, Response } from 'express';
import { getVaultIdFromRequest } from '../middleware/emblem-auth.js';
import { createVaultScopedDb } from '../../multitenancy/vault-context.js';
import { getDatabase } from '../../db/index.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const db = createVaultScopedDb(getDatabase());

    const items = db.queryWithVault('SELECT * FROM my_table');

    res.json({ items, vaultId });
  } catch (error) {
    console.error('[MyFeature] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch items',
      code: 'FETCH_ERROR'
    });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Name is required',
        code: 'MISSING_NAME'
      });
    }

    const db = createVaultScopedDb(getDatabase());
    const id = `item-${Date.now()}`;

    db.insertWithVault('my_table', {
      id,
      name,
      created_at: new Date().toISOString()
    });

    res.status(201).json({ id, name });
  } catch (error) {
    console.error('[MyFeature] Error:', error);
    res.status(500).json({
      error: 'Failed to create item',
      code: 'CREATE_ERROR'
    });
  }
});

export default router;
```

### Step 2: Register Route

```typescript
// src/server/index.ts
import { requireAuth } from './middleware/emblem-auth.js';
import myFeatureRoutes from './routes/my-feature.js';

// Register protected routes
app.use('/api/my-feature', requireAuth(), myFeatureRoutes);
```

### Step 3: Add Migration (if needed)

```typescript
// src/db/migrations/003_add_my_table.ts
import type Database from 'better-sqlite3';
import type { Migration } from '../migrator.js';

function up(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS my_table (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_my_table_vault_id
      ON my_table(vault_id)
  `).run();
}

function down(db: Database.Database): void {
  db.prepare('DROP INDEX IF EXISTS idx_my_table_vault_id').run();
  db.prepare('DROP TABLE IF EXISTS my_table').run();
}

export const addMyTableMigration: Migration = {
  id: '003_add_my_table',
  description: 'Add my_table for new feature',
  up,
  down
};
```

---

## Testing Strategies

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { VaultScopedDatabase, withVaultContext } from '../vault-context.js';

describe('VaultScopedDatabase', () => {
  let db: Database.Database;
  let scopedDb: VaultScopedDatabase;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE test_items (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        name TEXT
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('filters queries by vault_id', () => {
    // Seed data for multiple vaults
    db.exec(`
      INSERT INTO test_items VALUES
        ('item-1', 'vault-a', 'Item A'),
        ('item-2', 'vault-b', 'Item B')
    `);

    // Query as vault-a
    scopedDb = new VaultScopedDatabase(db, 'vault-a');
    const items = scopedDb.queryWithVault('SELECT * FROM test_items');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Item A');
  });

  it('cannot access other vault data', () => {
    db.exec(`INSERT INTO test_items VALUES ('item-1', 'vault-a', 'Item A')`);

    // Try to access as vault-b
    scopedDb = new VaultScopedDatabase(db, 'vault-b');
    const item = scopedDb.getWithVault(
      'SELECT * FROM test_items WHERE id = ?',
      ['item-1']
    );

    expect(item).toBeUndefined();
  });

  it('cannot delete other vault data', () => {
    db.exec(`INSERT INTO test_items VALUES ('item-1', 'vault-a', 'Item A')`);

    // Try to delete as vault-b
    scopedDb = new VaultScopedDatabase(db, 'vault-b');
    const result = scopedDb.deleteWithVault('test_items', 'id = ?', ['item-1']);

    expect(result.changes).toBe(0);

    // Verify item still exists
    const item = db.prepare('SELECT * FROM test_items WHERE id = ?').get('item-1');
    expect(item).toBeDefined();
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server/index.js';

describe('API Integration', () => {
  beforeAll(() => {
    process.env.EMBLEM_DEV_MODE = 'true';
  });

  it('isolates data between vaults', async () => {
    // Create session in vault-a
    const createRes = await request(app)
      .post('/api/sessions')
      .set('X-Vault-Id', 'vault-a')
      .send({ name: 'Test Session' });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.id;

    // List sessions in vault-a (should see it)
    const listA = await request(app)
      .get('/api/sessions')
      .set('X-Vault-Id', 'vault-a');

    expect(listA.body.sessions).toHaveLength(1);

    // List sessions in vault-b (should be empty)
    const listB = await request(app)
      .get('/api/sessions')
      .set('X-Vault-Id', 'vault-b');

    expect(listB.body.sessions).toHaveLength(0);

    // Delete from vault-b should fail silently
    const deleteB = await request(app)
      .delete(`/api/sessions/${sessionId}`)
      .set('X-Vault-Id', 'vault-b');

    // Session should still exist in vault-a
    const checkA = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set('X-Vault-Id', 'vault-a');

    expect(checkA.status).toBe(200);
  });
});
```

---

## Common Patterns

### Pattern: Service Layer with Context

```typescript
// src/services/session-service.ts
import { getCurrentVault, createVaultScopedDb } from '../multitenancy/vault-context.js';

export class SessionService {
  private db: VaultScopedDatabase;

  constructor(rawDb: Database.Database) {
    this.db = createVaultScopedDb(rawDb);
  }

  async createSession(name: string) {
    const vault = getCurrentVault();
    const id = `session-${Date.now()}`;

    this.db.insertWithVault('sessions', {
      id,
      name,
      created_at: new Date().toISOString()
    });

    return { id, name, vaultId: vault.vaultId };
  }

  async listSessions() {
    return this.db.queryWithVault('SELECT * FROM sessions ORDER BY created_at DESC');
  }
}
```

### Pattern: Factory for Scoped Instances

```typescript
// src/factories/memory-store-factory.ts
import { MemoryStore } from '../memory/store.js';

const instances = new Map<string, MemoryStore>();

export function getMemoryStoreForVault(vaultId: string): MemoryStore {
  let store = instances.get(vaultId);
  if (!store) {
    store = new MemoryStore({ vaultId });
    instances.set(vaultId, store);
  }
  return store;
}
```

### Pattern: Vault-Aware Error Handling

```typescript
// src/errors/vault-errors.ts
export class VaultAccessError extends Error {
  constructor(
    public readonly vaultId: string,
    public readonly resourceType: string,
    public readonly resourceId: string
  ) {
    super(`Cannot access ${resourceType} ${resourceId} from vault ${vaultId}`);
    this.name = 'VaultAccessError';
  }
}

// Usage
if (resource.vault_id !== currentVaultId) {
  throw new VaultAccessError(currentVaultId, 'session', resource.id);
}
```

---

## Anti-Patterns

### Anti-Pattern: Bypassing Vault Scope

```typescript
// WRONG: Direct database access bypasses vault filtering
const sessions = rawDb.prepare('SELECT * FROM sessions').all();

// RIGHT: Use vault-scoped database
const sessions = scopedDb.queryWithVault('SELECT * FROM sessions');
```

### Anti-Pattern: Hardcoding Vault ID

```typescript
// WRONG: Hardcoded vault ID
const db = new VaultScopedDatabase(rawDb, 'default-vault');

// RIGHT: Use context or parameter
const db = createVaultScopedDb(rawDb); // From context
const db = createVaultScopedDbExplicit(rawDb, vaultIdFromRequest); // Explicit
```

### Anti-Pattern: Missing Context Check

```typescript
// WRONG: No check for missing context
app.get('/api/data', (req, res) => {
  const vault = getCurrentVault(); // Throws if no context!
});

// RIGHT: Ensure context is set via middleware
app.use('/api', requireAuth(), vaultContextMiddleware());
app.get('/api/data', (req, res) => {
  const vault = getCurrentVault(); // Guaranteed to exist
});
```

### Anti-Pattern: Leaking Vault Info

```typescript
// WRONG: Exposing internal vault details
res.json({
  sessions,
  _internal_vault_id: vaultId,
  _db_path: DATABASE_PATH
});

// RIGHT: Only expose necessary data
res.json({ sessions });
```

### Anti-Pattern: Cross-Vault Operations

```typescript
// WRONG: Copying data between vaults without authorization
function copySession(fromVault: string, toVault: string, sessionId: string) {
  const fromDb = createVaultScopedDbExplicit(rawDb, fromVault);
  const toDb = createVaultScopedDbExplicit(rawDb, toVault);

  const session = fromDb.getWithVault('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  toDb.insertWithVault('sessions', session);
}

// RIGHT: Such operations require special authorization
// or should be prohibited entirely
```

---

## See Also

- [Architecture Overview](./ARCHITECTURE.md) - System design
- [API Reference](./API_REFERENCE.md) - Endpoint documentation
- [Testing Documentation](../../TESTING.md) - Test commands and patterns
