# Authentication Guide

> Complete guide to authentication and authorization in Metamorph multitenancy

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Modes](#authentication-modes)
3. [JWT Token Structure](#jwt-token-structure)
4. [Using requireAuth Middleware](#using-requireauth-middleware)
5. [Permission System](#permission-system)
6. [WebSocket Authentication](#websocket-authentication)
7. [Code Examples](#code-examples)

---

## Overview

Metamorph uses Emblem Auth for authentication, which provides:

- **JWT-based authentication** for production environments
- **Header-based bypass** for development
- **Permission-based authorization** for access control
- **Flexible token validation** via local JWT or external API

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Vault** | Unique tenant identifier, serves as partition key |
| **User** | Individual user within a vault |
| **Permission** | Capability granted to a user (e.g., read, write, admin) |
| **Token** | JWT containing claims about user identity |

---

## Authentication Modes

### Development Mode

When `EMBLEM_DEV_MODE=true`, authentication is simplified:

```bash
# Environment variable
EMBLEM_DEV_MODE=true
```

**Behavior:**
- No JWT validation required
- Use `X-Vault-Id` header to specify vault
- Falls back to `dev-vault` if no header provided
- Full permissions granted automatically

**Example:**
```bash
# Specify vault via header
curl -H "X-Vault-Id: my-test-vault" http://localhost:3001/api/sessions

# Use default dev-vault
curl http://localhost:3001/api/sessions
```

### Production Mode

When `EMBLEM_DEV_MODE` is unset or false:

```bash
# Environment variables
EMBLEM_DEV_MODE=false
EMBLEM_JWT_SECRET=your-32-character-secret-key
```

**Behavior:**
1. Requires valid JWT in `Authorization: Bearer <token>` header
2. Validates JWT signature using `EMBLEM_JWT_SECRET`
3. Falls back to Emblem API if signature validation fails
4. Extracts vault ID and permissions from token claims

### Token Validation Flow

```
Client Request
    |
    v
+------------------------+
| Extract Bearer Token   |
+------------------------+
    |
    v
+------------------------+     +-------------------+
| Local JWT Validation   |---->| If secret set:    |
| (EMBLEM_JWT_SECRET)    |     | Verify signature  |
+------------------------+     +-------------------+
    |                               |
    | (if fails)                    | (if succeeds)
    v                               v
+------------------------+     +-------------------+
| Emblem API Fallback    |     | Extract claims:   |
| POST /vault/info       |     | - vault_id        |
+------------------------+     | - user_id         |
    |                          | - permissions     |
    v                          +-------------------+
+------------------------+
| Return EmblemUser      |
| or 401 Unauthorized    |
+------------------------+
```

---

## JWT Token Structure

### Required Claims

| Claim | Alternative | Description |
|-------|-------------|-------------|
| `vault_id` | `vaultId` | Unique vault identifier |
| `user_id` | `userId`, `sub` | User identifier |

### Optional Claims

| Claim | Type | Description |
|-------|------|-------------|
| `email` | string | User email address |
| `permissions` | string[] | Array of permission strings |
| `scope` | string | Space-separated permissions |
| `exp` | number | Expiration timestamp |

### Example Token Payload

```json
{
  "vault_id": "user-vault-123",
  "user_id": "user-456",
  "email": "user@example.com",
  "permissions": ["read", "write"],
  "exp": 1735084800,
  "iat": 1735081200
}
```

### Alternative Formats

The middleware accepts multiple claim formats for flexibility:

```json
// Format 1: Snake case
{
  "vault_id": "vault-123",
  "user_id": "user-456"
}

// Format 2: Camel case
{
  "vaultId": "vault-123",
  "userId": "user-456"
}

// Format 3: Using 'sub' for user ID
{
  "vault_id": "vault-123",
  "sub": "user-456"
}

// Format 4: Permissions as scope string
{
  "vault_id": "vault-123",
  "scope": "read write admin"
}
```

---

## Using requireAuth Middleware

### Basic Usage

```typescript
import { requireAuth } from './server/middleware/emblem-auth.js';

// Require authentication only
app.get('/api/profile', requireAuth(), (req, res) => {
  // req.user is guaranteed to exist
  const { vaultId, userId, email, permissions } = req.user;
  res.json({ vaultId, userId, email });
});
```

### With Required Permissions

```typescript
// Require specific permissions
app.post('/api/admin/users', requireAuth({ permissions: ['admin'] }), (req, res) => {
  // Only users with 'admin' permission can access
  res.json({ message: 'Admin access granted' });
});

// Require multiple permissions (user must have ALL)
app.delete('/api/data', requireAuth({ permissions: ['write', 'delete'] }), (req, res) => {
  // User must have both 'write' AND 'delete' permissions
});
```

### Optional Authentication

For endpoints that work both with and without authentication:

```typescript
import { optionalAuth } from './server/middleware/emblem-auth.js';

app.get('/api/content', optionalAuth(), (req, res) => {
  if (req.user) {
    // Return personalized content for authenticated user
    res.json({
      content: getPersonalizedContent(req.user.vaultId),
      authenticated: true
    });
  } else {
    // Return public content for anonymous users
    res.json({
      content: getPublicContent(),
      authenticated: false
    });
  }
});
```

### EmblemUser Interface

```typescript
interface EmblemUser {
  vaultId: string;       // Required: Vault identifier
  userId: string;        // Required: User identifier
  email?: string;        // Optional: User email
  permissions: string[]; // Array of permission strings
}

// Access in route handlers
app.get('/api/data', requireAuth(), (req, res) => {
  const user: EmblemUser = req.user;
  console.log(`Vault: ${user.vaultId}`);
  console.log(`User: ${user.userId}`);
  console.log(`Permissions: ${user.permissions.join(', ')}`);
});
```

---

## Permission System

### Checking Permissions in Handlers

```typescript
import { hasPermission, getVaultIdFromRequest } from './server/middleware/emblem-auth.js';

app.post('/api/data', requireAuth(), (req, res) => {
  // Check specific permission
  if (!hasPermission(req, 'write')) {
    return res.status(403).json({
      error: 'Write permission required',
      code: 'FORBIDDEN'
    });
  }

  // Get vault ID with safe fallback
  const vaultId = getVaultIdFromRequest(req, 'anonymous');

  // Proceed with write operation
  writeData(vaultId, req.body);
  res.json({ success: true });
});
```

### Common Permission Patterns

```typescript
// Read-only endpoint
app.get('/api/data', requireAuth(), (req, res) => {
  // No specific permission required, just authentication
});

// Write endpoint
app.post('/api/data', requireAuth(), (req, res) => {
  if (!hasPermission(req, 'write')) {
    return res.status(403).json({ error: 'Write permission required' });
  }
  // ...
});

// Admin endpoint
app.post('/api/admin', requireAuth({ permissions: ['admin'] }), (req, res) => {
  // Only admins reach here
});

// Multiple permission check
app.delete('/api/sensitive', requireAuth(), (req, res) => {
  const canDelete = hasPermission(req, 'admin') || hasPermission(req, 'delete');
  if (!canDelete) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  // ...
});
```

### Permission Constants

Define standard permissions for your application:

```typescript
// src/auth/permissions.ts
export const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
  SANDBOX_CREATE: 'sandbox:create',
  SANDBOX_MANAGE: 'sandbox:manage',
} as const;

// Usage
app.post('/api/sandboxes', requireAuth({ permissions: [PERMISSIONS.SANDBOX_CREATE] }), handler);
```

---

## WebSocket Authentication

### Authentication on Connection

```typescript
import { validateEmblemToken } from './server/middleware/emblem-auth.js';
import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });

// Handle upgrade requests
server.on('upgrade', async (request, socket, head) => {
  try {
    // Extract token from query string or header
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token') ||
                  request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Validate token
    const user = await validateEmblemToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Complete upgrade with user attached
    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as any).user = user;
      wss.emit('connection', ws, request);
    });
  } catch (error) {
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// Handle authenticated connections
wss.on('connection', (ws: WebSocket) => {
  const user = (ws as any).user;
  console.log(`WebSocket connected: vault=${user.vaultId}`);

  ws.on('message', (data) => {
    // User context available for all messages
    handleMessage(user.vaultId, data);
  });
});
```

### Dev Mode WebSocket

In development mode, use query parameter for vault:

```javascript
// Client-side
const vaultId = 'my-test-vault';
const ws = new WebSocket(`ws://localhost:3001/ws?vaultId=${vaultId}`);

// Server-side dev mode handling
if (process.env.EMBLEM_DEV_MODE === 'true') {
  const vaultId = url.searchParams.get('vaultId') || 'dev-vault';
  (ws as any).user = {
    vaultId,
    userId: 'dev-user',
    permissions: ['read', 'write', 'admin']
  };
}
```

---

## Code Examples

### Complete Express App Setup

```typescript
import express from 'express';
import {
  requireAuth,
  optionalAuth,
  hasPermission,
  getVaultIdFromRequest
} from './server/middleware/emblem-auth.js';
import { vaultContextMiddleware, getCurrentVault } from './multitenancy/vault-context.js';

const app = express();
app.use(express.json());

// Public endpoint - no auth
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Optional auth - works both ways
app.get('/api/public', optionalAuth(), (req, res) => {
  const vaultId = req.user?.vaultId || 'anonymous';
  res.json({ greeting: `Hello, ${vaultId}!` });
});

// Protected endpoints - auth required
app.use('/api/protected', requireAuth());
app.use('/api/protected', vaultContextMiddleware());

app.get('/api/protected/sessions', (req, res) => {
  const vault = getCurrentVault();
  // Query sessions for this vault...
  res.json({ vaultId: vault.vaultId });
});

// Admin endpoints - specific permission required
app.post('/api/admin/users',
  requireAuth({ permissions: ['admin'] }),
  (req, res) => {
    // Only admins can create users
    res.json({ created: true });
  }
);

// Conditional permission check
app.put('/api/data/:id', requireAuth(), (req, res) => {
  const isOwner = checkOwnership(req.params.id, req.user.vaultId);
  const canEdit = isOwner || hasPermission(req, 'admin');

  if (!canEdit) {
    return res.status(403).json({ error: 'Cannot edit this resource' });
  }

  // Proceed with edit
  res.json({ updated: true });
});

app.listen(3001);
```

### Token Generation (For Testing)

```typescript
import * as jwt from 'jsonwebtoken';

// Generate a test token
function generateTestToken(vaultId: string, permissions: string[] = []): string {
  const secret = process.env.EMBLEM_JWT_SECRET || 'test-secret';

  return jwt.sign({
    vault_id: vaultId,
    user_id: `user-${Date.now()}`,
    email: 'test@example.com',
    permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  }, secret);
}

// Usage
const token = generateTestToken('test-vault', ['read', 'write']);
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3001/api/sessions`);
```

### Error Handling

```typescript
// Handle authentication errors gracefully
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'INVALID_TOKEN',
      details: err.message
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN',
      details: err.message
    });
  }

  next(err);
});
```

---

## See Also

- [Architecture Overview](./ARCHITECTURE.md) - System design
- [API Reference](./API_REFERENCE.md) - Endpoint documentation
- [Developer Guide](./DEVELOPER_GUIDE.md) - Implementation patterns
