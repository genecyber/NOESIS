# Architecture Overview

> Technical deep-dive into the Metamorph multitenancy system

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Overview](#component-overview)
3. [Request Lifecycle](#request-lifecycle)
4. [Data Flow](#data-flow)
5. [Vault Isolation Model](#vault-isolation-model)
6. [Database Schema](#database-schema)
7. [Security Model](#security-model)

---

## System Architecture

### High-Level Architecture Diagram

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

### Component Interaction

```
                    +-------------------+
                    |    Express App    |
                    +-------------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    | REST Routes |  |  WebSocket  |  | CLI Runtime |
    +-------------+  +-------------+  +-------------+
            |               |               |
            +-------+-------+-------+-------+
                    |
                    v
            +---------------+
            | MetamorphAgent|
            +---------------+
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
    +-------+  +--------+  +---------+
    |Memory |  |Identity|  |Operators|
    | Store |  |Manager |  | System  |
    +-------+  +--------+  +---------+
        |           |           |
        +-----------+-----------+
                    |
                    v
            +---------------+
            |VaultScopedDB  |
            +---------------+
                    |
                    v
            +---------------+
            |    SQLite     |
            +---------------+
```

---

## Component Overview

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Emblem Auth | `src/server/middleware/emblem-auth.ts` | JWT validation and dev mode bypass |
| Vault Context | `src/multitenancy/vault-context.ts` | AsyncLocalStorage context management |
| VaultScopedDatabase | `src/multitenancy/vault-context.ts` | Auto-scoped database queries |
| Sandbox Manager | `src/multitenancy/sandbox-manager.ts` | Isolated code execution per vault |
| Database Config | `src/config/database.ts` | SQLite configuration and pragmas |
| Migrator | `src/db/migrator.ts` | Migration lifecycle management |

### Middleware Stack

```typescript
// Order of middleware application
app.use(express.json());           // 1. Parse JSON bodies
app.use(requireAuth());            // 2. Authenticate user, set req.user
app.use(vaultContextMiddleware()); // 3. Establish vault context
// Route handlers execute here with full vault context
```

### VaultScopedDatabase Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `queryWithVault()` | SELECT with vault filter | `db.queryWithVault('SELECT * FROM sessions')` |
| `getWithVault()` | Single row with vault filter | `db.getWithVault('SELECT * FROM sessions WHERE id = ?', [id])` |
| `insertWithVault()` | INSERT with vault_id | `db.insertWithVault('sessions', { name: 'New' })` |
| `deleteWithVault()` | DELETE with vault filter | `db.deleteWithVault('sessions', 'id = ?', [id])` |
| `runWithVault()` | UPDATE/DELETE mutations | `db.runWithVault('UPDATE sessions SET name = ?', ['New'])` |
| `countWithVault()` | COUNT with vault filter | `db.countWithVault('sessions')` |

---

## Request Lifecycle

### Complete Request Flow

```
1. CLIENT REQUEST
   |
   | HTTP Request with Authorization header or X-Vault-Id
   v

2. EXPRESS MIDDLEWARE
   |
   | requireAuth() extracts vault info
   | vaultContextMiddleware() sets AsyncLocalStorage
   v

3. ROUTE HANDLER
   |
   | Handler code executes
   | getCurrentVault() available anywhere
   v

4. SERVICE LAYER
   |
   | Business logic
   | createVaultScopedDb(rawDb)
   v

5. DATABASE LAYER
   |
   | VaultScopedDatabase auto-injects vault_id
   | SELECT * FROM x WHERE active = ?
   | becomes
   | SELECT * FROM x WHERE vault_id = ? AND active = ?
   v

6. SQLITE
   |
   | Query executes on vault-filtered data
   v

7. RESPONSE
   |
   | Results flow back through layers
   | Only vault-specific data returned
   v

8. CLIENT
```

### Async Context Propagation

The vault context propagates through all async operations:

```typescript
withVaultContext({ vaultId: 'user-123' }, async () => {
  // Context available here
  await doSomething();

  // Still available after await
  await Promise.all([
    doThing1(),
    doThing2(),
  ]);

  // Still available in setTimeout (captured)
  setTimeout(() => {
    const vault = getCurrentVault(); // Works!
  }, 100);
});
```

---

## Data Flow

### Query Transformation

```
User Query:
  SELECT * FROM sessions WHERE status = 'active'

Vault Context:
  vaultId = 'user-123'

Transformed Query:
  SELECT * FROM sessions WHERE vault_id = 'user-123' AND status = 'active'
```

### Insert Transformation

```
User Insert:
  INSERT INTO sessions (id, name) VALUES (?, ?)

Vault Context:
  vaultId = 'user-123'

Transformed Insert:
  INSERT INTO sessions (vault_id, id, name) VALUES (?, ?, ?)
  Parameters: ['user-123', 'sess-1', 'My Session']
```

### Memory Flow

```
+-------------+     +----------------+     +------------------+
|   Request   | --> | Memory Store   | --> | VaultScopedDB    |
| (vault-123) |     | .forVault()    |     | .queryWithVault()|
+-------------+     +----------------+     +------------------+
                                                   |
                                                   v
                                          +------------------+
                                          | Results filtered |
                                          | by vault-123     |
                                          +------------------+
```

---

## Vault Isolation Model

### What Gets Isolated

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
|  Operator Learning    |            |  Operator Learning    |
|  - Bayesian weights   |            |  - Bayesian weights   |
+-----------------------+            +-----------------------+
         |                                    |
         +------------ ISOLATED --------------+
```

### Isolation Guarantees

1. **Query Isolation** - All SELECT queries include `vault_id = ?`
2. **Mutation Isolation** - UPDATE/DELETE only affect vault's rows
3. **Insert Isolation** - New rows automatically get vault_id
4. **Memory Isolation** - Semantic search only within vault's memories
5. **Identity Isolation** - Each vault has independent AI identity
6. **Sandbox Isolation** - Code execution in separate VM contexts

### Context Isolation

Concurrent requests maintain separate contexts:

```
Request 1 (vault-a)        Request 2 (vault-b)
|                          |
+- withVaultContext(a)     +- withVaultContext(b)
|  +- getCurrentVault()    |  +- getCurrentVault()
|     -> 'vault-a'         |     -> 'vault-b'
|                          |
+- Each request isolated   +- No cross-contamination
```

---

## Database Schema

### Tables with vault_id

All user-scoped tables include the `vault_id` column:

| Table | Purpose |
|-------|---------|
| sessions | Active chat sessions |
| messages | Chat messages |
| conversations | Conversation threads |
| semantic_memory | All memory types |
| identity | Identity checkpoints |
| evolution_snapshots | Transformation history |
| operator_performance | Learning metrics |
| subagent_results | Cached subagent responses |
| emotional_arcs | Emotional trajectory |
| emotion_context | Per-session emotions |
| session_states | Session persistence |
| vercel_connections | Vercel OAuth tokens |
| sandboxes | Execution environments |
| sandbox_resource_usage | Resource tracking |

### Schema Diagram

```
+-------------------+       +-------------------+
|    sessions       |       |    messages       |
+-------------------+       +-------------------+
| id (PK)           |<------| id (PK)           |
| vault_id          |       | vault_id          |
| name              |       | session_id (FK)   |
| created_at        |       | role              |
| last_accessed     |       | content           |
+-------------------+       | created_at        |
                            +-------------------+

+-------------------+       +-------------------+
| semantic_memory   |       |    identity       |
+-------------------+       +-------------------+
| id (PK)           |       | id (PK)           |
| vault_id          |       | vault_id          |
| type              |       | self_model        |
| content           |       | values            |
| embedding         |       | emergent_goals    |
| importance        |       | created_at        |
+-------------------+       +-------------------+

+-------------------+       +-------------------+
| vercel_connections|       |    sandboxes      |
+-------------------+       +-------------------+
| id (PK)           |<------| id (PK)           |
| vault_id          |       | vault_id          |
| vercel_user_id    |       | vercel_conn_id(FK)|
| access_token      |       | status            |
| scopes            |       | runtime           |
| connection_status |       | vcpus             |
+-------------------+       | memory_mb         |
                            +-------------------+
```

### Indexes

Composite indexes ensure efficient vault-scoped queries:

```sql
-- Session lookups by vault
CREATE INDEX idx_sessions_vault_id ON sessions(vault_id, id);
CREATE INDEX idx_sessions_vault_accessed ON sessions(vault_id, last_accessed);

-- Memory queries by vault and type
CREATE INDEX idx_semantic_memory_vault_type ON semantic_memory(vault_id, type);

-- Sandbox status queries
CREATE INDEX idx_sandboxes_status ON sandboxes(vault_id, status);
```

---

## Security Model

### Authentication Flow

```
+--------+     +------------+     +------------+     +-----------+
| Client | --> | Auth       | --> | Validate   | --> | Set       |
|        |     | Middleware |     | Token/Dev  |     | req.user  |
+--------+     +------------+     +------------+     +-----------+
                                        |
                     +------------------+------------------+
                     |                                     |
              +------v------+                       +------v------+
              | Dev Mode    |                       | Prod Mode   |
              | X-Vault-Id  |                       | JWT Token   |
              | Header      |                       | Validation  |
              +-------------+                       +-------------+
```

### Token Encryption

OAuth tokens are encrypted at rest:

```
Token: "eyJhbGciOiJIUzI1NiIs..."

Encrypted Format:
enc:<iv>:<authTag>:<ciphertext>

Algorithm: AES-256-GCM
Key: TOKEN_ENCRYPTION_KEY environment variable
```

### Permission System

```typescript
// Define required permissions
app.post('/admin', requireAuth({ permissions: ['admin'] }), handler);

// Check permissions in handler
if (hasPermission(req, 'write')) {
  // Allow write operation
}
```

### Sandbox Security

```
+---------------------------+
|    Host System            |
|                           |
|  +---------------------+  |
|  | Vercel Sandbox      |  |
|  | (MicroVM)           |  |
|  |                     |  |
|  | - Isolated FS       |  |
|  | - Restricted Net    |  |
|  | - Memory Limits     |  |
|  | - CPU Limits        |  |
|  +---------------------+  |
|                           |
|  +---------------------+  |
|  | VM Fallback         |  |
|  | (Node.js vm)        |  |
|  |                     |  |
|  | - Restricted Globals|  |
|  | - Module Allowlist  |  |
|  | - No Code Gen       |  |
|  +---------------------+  |
+---------------------------+
```

---

## See Also

- [Authentication Guide](./AUTHENTICATION.md) - Detailed auth documentation
- [Developer Guide](./DEVELOPER_GUIDE.md) - Implementation patterns
- [API Reference](./API_REFERENCE.md) - Endpoint documentation
