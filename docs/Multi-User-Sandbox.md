# Multi-User Sandbox Architecture

> Implementation plan for Metamorph multitenancy with Vercel Sandbox integration

## Executive Summary

This document describes the architecture for transforming Metamorph from a single-tenant system to a multi-tenant SaaS platform where:

1. **Each user has isolated data** - Memories, sessions, identity checkpoints are scoped by user
2. **Users can connect their own Vercel accounts** - OAuth-based Vercel integration
3. **Users get isolated sandbox environments** - Vercel Sandbox for secure code execution
4. **Agents can run inside sandboxes** - MetamorphAgent executes in user's isolated environment

---

## Table of Contents

1. [Authentication Architecture](#1-authentication-architecture)
2. [Database Multitenancy](#2-database-multitenancy)
3. [Railway Volume Persistence](#3-railway-volume-persistence)
4. [Session Isolation](#4-session-isolation)
5. [Memory Isolation](#5-memory-isolation)
6. [Identity Persistence](#6-identity-persistence)
7. [Vercel Integration](#7-vercel-integration)
8. [Sandbox Management](#8-sandbox-management)
9. [Agent-in-Sandbox Execution](#9-agent-in-sandbox-execution)
10. [Resource Limits](#10-resource-limits)
11. [API Reference](#11-api-reference)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Authentication Architecture

### 1.1 Emblem Vault Integration

Metamorph uses [Emblem Vault Auth SDK](https://github.com/EmblemLabs/auth-sdk) for user authentication. Each user is identified by their `vaultId` - a unique identifier that serves as the partition key for all user data.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Request                         │
│              Authorization: Bearer <JWT Token>               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   emblemAuth Middleware                       │
│                                                               │
│  1. Extract Bearer token from Authorization header            │
│  2. POST to https://api.emblemvault.ai/vault/info            │
│  3. Validate response and extract vaultId                     │
│  4. Attach VaultContext to request object                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Protected Endpoint                         │
│                                                               │
│  const vaultId = req.vault.vaultId;                          │
│  // All operations scoped by vaultId                          │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 VaultContext Interface

```typescript
interface VaultContext {
  vaultId: string;           // Primary user identifier
  evmAddress?: string;       // Ethereum address (if wallet auth)
  solanaAddress?: string;    // Solana address (if wallet auth)
  verified: boolean;         // Token verification status
  verifiedAt: Date;          // Timestamp of verification
}

interface AuthenticatedRequest extends Request {
  vault: VaultContext;
}
```

### 1.3 Middleware Implementation

```typescript
// src/server/middleware/auth.ts

export async function emblemAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  const response = await fetch('https://api.emblemvault.ai/vault/info', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const vaultInfo = await response.json();

  (req as AuthenticatedRequest).vault = {
    vaultId: vaultInfo.vaultId,
    evmAddress: vaultInfo.evmAddress,
    solanaAddress: vaultInfo.solanaAddress,
    verified: true,
    verifiedAt: new Date()
  };

  next();
}
```

---

## 2. Database Multitenancy

### 2.1 Schema Changes

All user-scoped tables receive a `vault_id` column as the partition key:

| Table | Purpose | vault_id Usage |
|-------|---------|----------------|
| `conversations` | Chat threads | Owner's vault |
| `messages` | Chat messages | Inherited from conversation |
| `sessions` | Active sessions | Owner's vault |
| `session_states` | Session persistence | Owner's vault |
| `semantic_memory` | Episodic/semantic/identity memories | Owner's vault |
| `identity` | Identity checkpoints | Owner's vault |
| `evolution_snapshots` | Transformation history | Owner's vault |
| `operator_performance` | Learning metrics | Per-user learning |
| `subagent_results` | Cached subagent responses | Owner's vault |
| `emotional_arcs` | Emotional trajectory | Owner's vault |
| `emotion_context` | Per-session emotions | Owner's vault |

### 2.2 Migration Script

```sql
-- src/migrations/001_add_multitenancy.sql

-- Add vault_id to all tables
ALTER TABLE conversations ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE session_states ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE semantic_memory ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE identity ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE evolution_snapshots ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE operator_performance ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE subagent_results ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE emotional_arcs ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';
ALTER TABLE emotion_context ADD COLUMN vault_id TEXT NOT NULL DEFAULT '';

-- Create indexes for efficient queries
CREATE INDEX idx_conversations_vault ON conversations(vault_id);
CREATE INDEX idx_sessions_vault ON sessions(vault_id);
CREATE INDEX idx_semantic_memory_vault ON semantic_memory(vault_id);
CREATE INDEX idx_identity_vault ON identity(vault_id);
-- ... (indexes for all tables)

-- Migrate existing data to legacy vault
UPDATE conversations SET vault_id = 'legacy-default' WHERE vault_id = '';
UPDATE sessions SET vault_id = 'legacy-default' WHERE vault_id = '';
-- ... (update all tables)
```

### 2.3 Query Scoping Pattern

All queries must include vault_id filtering:

```typescript
// BEFORE (single-tenant)
const session = this.db.prepare(
  'SELECT * FROM sessions WHERE id = ?'
).get(sessionId);

// AFTER (multi-tenant)
const session = this.db.prepare(
  'SELECT * FROM sessions WHERE id = ? AND vault_id = ?'
).get(sessionId, vaultId);
```

---

## 3. Railway Volume Persistence

### 3.1 Overview

The SQLite database is persisted on a Railway volume for durability across deployments. This ensures user data (memories, sessions, identity checkpoints) survives container restarts and updates.

```
┌─────────────────────────────────────────────────────────────┐
│                   Railway Service Container                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Metamorph Application                    │   │
│  │                                                       │   │
│  │   DATABASE_PATH=/data/metamorph.db                   │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Volume Mount: /data                        │   │
│  │                                                       │   │
│  │   metamorph.db      ← Main database                  │   │
│  │   metamorph.db-wal  ← Write-ahead log                │   │
│  │   metamorph.db-shm  ← Shared memory                  │   │
│  │   backups/          ← Periodic backups               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Railway Persistent Volume                     │
│                                                              │
│   Name: metamorph-data                                      │
│   Size: 1GB (auto-expands)                                  │
│   Backup: Automatic snapshots                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Railway Configuration

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[mounts]]
source = "metamorph-data"
destination = "/data"
```

### 3.3 Database Configuration

```typescript
// src/config/database.ts
export const DATABASE_CONFIG = {
  // Railway volume path takes precedence
  path: process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/metamorph.db`
    : process.env.DATABASE_PATH || './data/metamorph.db',

  // Backup configuration
  backupPath: process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/backups`
    : './data/backups',

  // WAL mode for better concurrent access
  pragmas: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    cache_size: -64000,  // 64MB cache
    foreign_keys: 'ON'
  }
};
```

### 3.4 SQLite WAL Mode Benefits

- **Concurrent reads**: Multiple readers can access database while writing
- **Faster writes**: Writes go to WAL file, periodic checkpoints sync to main DB
- **Crash recovery**: WAL ensures consistency even if container crashes
- **Better performance**: Reduced lock contention for multi-tenant workloads

### 3.5 Deployment Setup

**Railway Dashboard Steps:**
1. Create new volume named `metamorph-data`
2. Mount to `/data` in service settings
3. Set initial size to 1GB (auto-expands as needed)

**Environment Variables:**
```env
RAILWAY_VOLUME_MOUNT_PATH=/data
DATABASE_PATH=/data/metamorph.db
```

### 3.6 Backup Strategy

```bash
# Automatic: Railway provides volume snapshots

# Manual backup (run via Railway CLI)
railway run cp /data/metamorph.db /data/backups/metamorph-$(date +%Y%m%d).db

# Restore from backup
railway run cp /data/backups/metamorph-YYYYMMDD.db /data/metamorph.db
railway restart
```

### 3.7 Migration from Local Development

```bash
# Export local database
sqlite3 ./data/metamorph.db ".backup /tmp/metamorph-export.db"

# Upload to Railway volume
railway run cat > /data/metamorph.db < /tmp/metamorph-export.db

# Verify
railway run sqlite3 /data/metamorph.db "SELECT COUNT(*) FROM conversations"
```

---

## 4. Session Isolation

### 4.1 Scoped Session Manager

```typescript
// src/runtime/session/session-manager.ts

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  // Key format: "vaultId:sessionId"
  private sessionKey(id: string, vaultId: string): string {
    return `${vaultId}:${id}`;
  }

  // Get scoped view for a specific user
  forVault(vaultId: string): ScopedSessionManager {
    return new ScopedSessionManager(this, vaultId);
  }

  createSession(options: CreateSessionOptions, vaultId: string): Session {
    const id = options.id ?? uuidv4();
    const key = this.sessionKey(id, vaultId);

    const session: Session = {
      id,
      vaultId,
      agent: new MetamorphAgent({ ...options.config, vaultId }),
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(key, session);
    return session;
  }

  listSessions(vaultId: string): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => s.vaultId === vaultId)
      .map(s => ({ id: s.id, name: s.name, lastActivity: s.lastActivity }));
  }
}

// Convenience wrapper that pre-fills vaultId
export class ScopedSessionManager {
  constructor(
    private manager: SessionManager,
    private vaultId: string
  ) {}

  createSession(options: CreateSessionOptions = {}) {
    return this.manager.createSession(options, this.vaultId);
  }

  getSession(id: string) {
    return this.manager.getSession(id, this.vaultId);
  }

  listSessions() {
    return this.manager.listSessions(this.vaultId);
  }
}
```

---

## 4. Memory Isolation

### 4.1 Scoped Memory Store

```typescript
// src/memory/store.ts

export class MemoryStore {
  constructor(options: { dbPath?: string; vaultId?: string }) {
    this.defaultVaultId = options.vaultId || 'legacy-default';
  }

  forVault(vaultId: string): ScopedMemoryStore {
    return new ScopedMemoryStore(this, vaultId);
  }

  searchMemories(query: {
    vaultId: string;
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  }): MemoryEntry[] {
    let sql = 'SELECT * FROM semantic_memory WHERE vault_id = ?';
    const params: any[] = [query.vaultId];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.minImportance) {
      sql += ' AND importance >= ?';
      params.push(query.minImportance);
    }

    sql += ' ORDER BY importance DESC, timestamp DESC';
    sql += ' LIMIT ?';
    params.push(query.limit || 10);

    return this.db.prepare(sql).all(...params);
  }
}
```

### 4.2 Memory Isolation Guarantees

- **Semantic search**: Embeddings only compared within user's memories
- **Memory injection**: Only user's own memories injected into prompts
- **Decay/consolidation**: Operates within user's memory pool
- **Backup/restore**: Scoped to user's data only

---

## 5. Identity Persistence

### 5.1 Per-User Identity Checkpoints

```typescript
// src/core/identity-persistence.ts

// Factory pattern instead of singleton
class IdentityPersistenceFactory {
  private instances: Map<string, IdentityPersistenceManager> = new Map();

  forVault(vaultId: string): IdentityPersistenceManager {
    let instance = this.instances.get(vaultId);
    if (!instance) {
      instance = new IdentityPersistenceManager(vaultId);
      this.instances.set(vaultId, instance);
    }
    return instance;
  }
}

export const identityPersistenceFactory = new IdentityPersistenceFactory();
```

### 5.2 Checkpoint Storage

```sql
-- Identity checkpoints are scoped by vault_id
INSERT INTO identity (vault_id, self_model, persistent_values, emergent_goals, ...)
VALUES (?, ?, ?, ?, ...);

-- Query most recent checkpoint for user
SELECT * FROM identity
WHERE vault_id = ?
ORDER BY created_at DESC
LIMIT 1;
```

---

## 6. Vercel Integration

### 6.1 OAuth Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Metamorph  │     │    Vercel    │     │   Metamorph  │
│   Frontend   │     │    OAuth     │     │   Backend    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ GET /api/vercel/auth/url               │
       │────────────────────────────────────────>│
       │                    │                    │
       │    { url, state }  │                    │
       │<────────────────────────────────────────│
       │                    │                    │
       │ Redirect to Vercel OAuth               │
       │───────────────────>│                    │
       │                    │                    │
       │   User authorizes  │                    │
       │<───────────────────│                    │
       │                    │                    │
       │ Callback with code │                    │
       │────────────────────────────────────────>│
       │                    │                    │
       │                    │ Exchange code      │
       │                    │<───────────────────│
       │                    │                    │
       │                    │ Access token       │
       │                    │───────────────────>│
       │                    │                    │
       │  Redirect to app   │                    │
       │<────────────────────────────────────────│
```

### 6.2 Vercel Connection Storage

```sql
CREATE TABLE vercel_connections (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  vercel_user_id TEXT NOT NULL,
  vercel_team_id TEXT,
  access_token TEXT NOT NULL,  -- Encrypted
  refresh_token TEXT,          -- Encrypted
  token_expires_at TEXT,
  scopes TEXT NOT NULL,        -- JSON array
  connection_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(vault_id, vercel_user_id)
);
```

---

## 7. Sandbox Management

### 7.1 Sandbox Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   pending   │────>│  creating   │────>│   running   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐             │
                    │   stopped   │<────────────┤
                    └──────┬──────┘             │
                           │                    │
                    ┌──────▼──────┐     ┌───────▼───────┐
                    │ terminated  │     │     error     │
                    └─────────────┘     └───────────────┘
```

### 7.2 Sandbox Database Schema

```sql
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
  environment TEXT,  -- Encrypted JSON
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
);
```

### 7.3 Sandbox Templates

```typescript
const SANDBOX_TEMPLATES = {
  'metamorph-basic': {
    runtime: 'node22',
    vcpus: 2,
    memoryMb: 2048,
    timeoutMinutes: 30,
    packages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk', 'better-sqlite3'],
    agentConfig: { intensity: 50, coherenceFloor: 30 }
  },
  'metamorph-research': {
    runtime: 'node22',
    vcpus: 4,
    memoryMb: 4096,
    timeoutMinutes: 60,
    packages: [..., 'puppeteer', 'cheerio', 'axios'],
    agentConfig: { intensity: 60, enableProactiveMemory: true }
  },
  'metamorph-autonomous': {
    runtime: 'node22',
    vcpus: 4,
    memoryMb: 8192,
    timeoutMinutes: 120,
    packages: [..., '@xenova/transformers'],
    agentConfig: { intensity: 70, sentienceLevel: 70, enableAutoEvolution: true }
  }
};
```

---

## 8. Agent-in-Sandbox Execution

### 8.1 Sandbox Agent Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Metamorph Server                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                SandboxAgentExecutor                   │  │
│  │                                                       │  │
│  │  • initializeAgent(sandboxId, vaultId)               │  │
│  │  • chat(sessionId, message)                          │  │
│  │  • syncMemoriesToMain(sessionId)                     │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │ IPC / REST
                          ▼
┌────────────────────────────────────────────────────────────┐
│                  Vercel Sandbox (Isolated)                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MetamorphAgent (In-Memory DB)            │  │
│  │                                                       │  │
│  │  • Isolated SQLite database                           │  │
│  │  • Independent identity checkpoints                   │  │
│  │  • Sandboxed file system access                       │  │
│  │  • Limited network access                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 8.2 Memory Sync

Memories can be synced between sandbox and main:

```typescript
// Copy memories from main to sandbox
await executor.syncMemoriesFromMain(sandboxSessionId, vaultId, {
  type: 'semantic',
  minImportance: 0.7,
  limit: 100
});

// Copy learned memories from sandbox back to main
await executor.syncMemoriesToMain(sandboxSessionId, vaultId);
```

---

## 9. Resource Limits

### 9.1 Tiered Limits

| Plan | Sandboxes | Runtime/Period | vCPUs | RAM | Timeout |
|------|-----------|----------------|-------|-----|---------|
| Free | 1 | 10 hours | 2 | 2GB | 30 min |
| Pro | 5 | 100 hours | 4 | 8GB | 60 min |
| Enterprise | 20 | 1000 hours | 8 | 16GB | 120 min |

### 9.2 Resource Tracking

```sql
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
  limit_exceeded BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 9.3 Cleanup Service

- **Idle timeout**: Stop sandbox after 30 minutes of inactivity
- **Max age**: Terminate sandbox after 24 hours regardless of activity
- **Orphan cleanup**: Check for orphaned sandboxes every 5 minutes

---

## 10. API Reference

### 10.1 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vercel/auth/url` | Get Vercel OAuth authorization URL |
| GET | `/api/vercel/auth/callback` | OAuth callback handler |
| DELETE | `/api/vercel/auth/disconnect` | Revoke Vercel connection |
| GET | `/api/vercel/auth/status` | Check connection status |

### 10.2 Sandbox Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sandboxes` | Create new sandbox |
| GET | `/api/sandboxes` | List user's sandboxes |
| GET | `/api/sandboxes/:id` | Get sandbox details |
| DELETE | `/api/sandboxes/:id` | Delete sandbox |
| POST | `/api/sandboxes/:id/start` | Start sandbox |
| POST | `/api/sandboxes/:id/stop` | Stop sandbox |
| POST | `/api/sandboxes/:id/execute` | Run command in sandbox |
| POST | `/api/sandboxes/:id/files` | Write files to sandbox |
| POST | `/api/sandboxes/:id/agent/attach` | Attach Metamorph agent |
| POST | `/api/sandboxes/:id/agent/chat` | Chat with sandboxed agent |
| GET | `/api/sandboxes/usage` | Get resource usage |

### 10.3 Protected Endpoints (Require Auth)

All existing endpoints now require `Authorization: Bearer <token>`:

- `/api/chat`
- `/api/session/*`
- `/api/memories`
- `/api/identity`
- `/api/state`
- `/api/config`
- `/api/sync`
- `/api/idle`

---

## 11. Implementation Phases

### Phase 1: Foundation
- [ ] Create auth middleware (`src/server/middleware/auth.ts`)
- [ ] Create database migrations
- [ ] Add vault_id to all tables

### Phase 2: Core Isolation
- [ ] Update SessionManager for vault scoping
- [ ] Update MemoryStore for vault scoping
- [ ] Refactor IdentityPersistence to factory pattern
- [ ] Add vaultId to MetamorphAgent

### Phase 3: API Integration
- [ ] Add auth middleware to all protected routes
- [ ] Update all endpoint handlers to use vaultId
- [ ] Add WebSocket authentication

### Phase 4: Vercel Integration
- [ ] Implement Vercel OAuth flow
- [ ] Create SandboxManager
- [ ] Implement resource tracking
- [ ] Create cleanup service

### Phase 5: Validation
- [ ] Security audit
- [ ] Integration tests
- [ ] Documentation

---

## Appendix A: Environment Variables

```env
# Emblem Auth
EMBLEM_APP_ID=metamorph
EMBLEM_AUTH_URL=https://auth.emblemvault.ai
EMBLEM_API_URL=https://api.emblemvault.ai

# Vercel Integration
VERCEL_CLIENT_ID=oac_xxx
VERCEL_CLIENT_SECRET=xxx
VERCEL_WEBHOOK_SECRET=xxx

# Feature Flags
ENABLE_MULTITENANCY=true

# Encryption
TOKEN_ENCRYPTION_KEY=xxx  # For encrypting stored tokens
```

## Appendix B: Security Considerations

1. **Token Storage**: All OAuth tokens encrypted at rest using AES-256-GCM
2. **Ownership Verification**: Every API call verifies user owns the resource
3. **Rate Limiting**: Per-user rate limits on sandbox creation
4. **Environment Isolation**: Each sandbox has isolated filesystem and network
5. **Audit Logging**: All sandbox operations logged for security review
