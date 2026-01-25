# Metamorph Multitenancy Documentation

> Complete guide to the vault-based multitenancy system in Metamorph

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Overview

Metamorph's multitenancy system enables multiple users (tenants) to share the same application instance while maintaining complete data isolation. Each tenant is identified by a **vault** - a unique identifier that serves as the partition key for all user data.

### Key Features

- **Complete Data Isolation** - Each vault's data is fully separated from others
- **Transparent Scoping** - Database queries automatically filter by vault
- **Flexible Authentication** - JWT tokens or development mode with headers
- **Sandboxed Execution** - Isolated code execution environments per vault
- **Vercel Integration** - OAuth-based sandbox provisioning

### What Gets Isolated

| Data Type | Description |
|-----------|-------------|
| Sessions | Chat threads and active sessions |
| Memories | Episodic, semantic, and identity memories |
| Identity | Identity checkpoints and evolution history |
| Transformation | Operator performance and learning data |
| Sandboxes | Isolated code execution environments |

---

## Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Getting Started Guide](./GETTING_STARTED.md) | Installation, setup, and first API call |
| [Architecture Overview](./ARCHITECTURE.md) | System design and component overview |

### Core Concepts

| Document | Description |
|----------|-------------|
| [Authentication Guide](./AUTHENTICATION.md) | Emblem Auth, JWT tokens, and permissions |
| [Developer Guide](./DEVELOPER_GUIDE.md) | Extending the system, patterns, and testing |

### API & Integration

| Document | Description |
|----------|-------------|
| [API Reference](./API_REFERENCE.md) | Complete endpoint documentation |
| [Sandbox Guide](./SANDBOX_GUIDE.md) | Isolated code execution environments |

### Operations

| Document | Description |
|----------|-------------|
| [Deployment Guide](./DEPLOYMENT.md) | Railway setup and production configuration |
| [Migration Guide](./MIGRATION_GUIDE.md) | Upgrading existing deployments |

---

## Quick Start

### 1. Enable Development Mode

For local development, set the environment variable:

```bash
EMBLEM_DEV_MODE=true
```

### 2. Make Your First Request

```bash
# List sessions for a specific vault
curl -H "X-Vault-Id: my-test-vault" http://localhost:3001/api/sessions

# Or use the default dev-vault
curl http://localhost:3001/api/sessions
```

### 3. Run Database Migrations

```bash
npm run migrate
```

See the [Getting Started Guide](./GETTING_STARTED.md) for complete setup instructions.

---

## Common Tasks

### Create a Vault-Scoped Session

```typescript
import { withVaultContext, createVaultScopedDb } from './multitenancy/vault-context.js';

withVaultContext({ vaultId: 'user-123' }, () => {
  const db = createVaultScopedDb(rawDb);
  db.insertWithVault('sessions', {
    id: 'session-abc',
    name: 'My Session'
  });
});
```

### Protect an API Endpoint

```typescript
import { requireAuth } from './server/middleware/emblem-auth.js';

app.get('/api/data', requireAuth(), (req, res) => {
  const vaultId = req.user.vaultId;
  // Data is automatically scoped to this vault
});
```

### Execute Code in a Sandbox

```typescript
import { sandboxManager } from './multitenancy/sandbox-manager.js';

const result = await sandboxManager.executeSandboxed(
  'vault-123',
  'return 1 + 2;'
);
// { success: true, output: 3, executionTimeMs: 5 }
```

---

## Architecture at a Glance

```
Client Request
      |
      v
+------------------+
| Emblem Auth      |  Validates JWT / X-Vault-Id header
+------------------+
      |
      v
+------------------+
| Vault Context    |  Establishes AsyncLocalStorage context
+------------------+
      |
      v
+------------------+
| VaultScopedDB    |  Auto-injects vault_id into queries
+------------------+
      |
      v
+------------------+
| SQLite Database  |  All tables have vault_id column
+------------------+
```

See [Architecture Overview](./ARCHITECTURE.md) for detailed diagrams and explanations.

---

## Security Model

1. **Authentication** - All requests require valid JWT or dev-mode header
2. **Authorization** - Permissions control access to specific operations
3. **Data Isolation** - Queries automatically filter by vault_id
4. **Token Encryption** - OAuth tokens encrypted with AES-256-GCM
5. **Sandbox Isolation** - Code executes in isolated VM or Vercel MicroVM

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `EMBLEM_JWT_SECRET` | Production | JWT signing secret |
| `EMBLEM_DEV_MODE` | No | Enable dev mode (default: false) |
| `DATABASE_PATH` | No | SQLite path (default: ./data/metamorph.db) |
| `TOKEN_ENCRYPTION_KEY` | No | AES-256 key for token encryption |
| `VERCEL_CLIENT_ID` | Sandbox | Vercel OAuth client ID |
| `VERCEL_CLIENT_SECRET` | Sandbox | Vercel OAuth client secret |

See [Deployment Guide](./DEPLOYMENT.md) for complete configuration reference.

---

## Support

- [GitHub Issues](https://github.com/your-org/metamorph/issues) - Bug reports and feature requests
- [Contributing Guide](../../CONTRIBUTING.md) - How to contribute to the project

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Project overview and build commands
- [Existing Multitenancy Doc](../MULTITENANCY.md) - Original comprehensive guide
