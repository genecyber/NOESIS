# API Reference

> Complete API documentation for Metamorph multitenancy endpoints

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Responses](#error-responses)
4. [Vercel OAuth Endpoints](#vercel-oauth-endpoints)
5. [Sandbox Endpoints](#sandbox-endpoints)
6. [Session Endpoints](#session-endpoints)
7. [Memory Endpoints](#memory-endpoints)

---

## Overview

### Base URL

```
Development: http://localhost:3001
Production:  https://your-deployment.railway.app
```

### Content Type

All requests should use:
```
Content-Type: application/json
```

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Production | `Bearer <JWT token>` |
| `X-Vault-Id` | Dev mode | Vault identifier (dev mode only) |
| `Content-Type` | POST/PUT | `application/json` |

---

## Authentication

### Development Mode

Set `EMBLEM_DEV_MODE=true` and use the `X-Vault-Id` header:

```bash
curl -H "X-Vault-Id: my-vault" http://localhost:3001/api/sessions
```

### Production Mode

Use a valid JWT token:

```bash
curl -H "Authorization: Bearer eyJhbG..." http://localhost:3001/api/sessions
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Optional additional details"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `MISSING_*` | Required field missing |
| 400 | `INVALID_*` | Invalid field value |
| 401 | `MISSING_TOKEN` | No authorization header |
| 401 | `INVALID_TOKEN` | Token validation failed |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `*_LIMIT_REACHED` | Rate/resource limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `*_NOT_CONFIGURED` | Required service not configured |

---

## Vercel OAuth Endpoints

### GET /api/vercel/auth/url

Get Vercel OAuth authorization URL.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect_uri` | string | Custom callback URL (optional) |

**Response:**

```json
{
  "url": "https://vercel.com/oauth/authorize?client_id=...",
  "state": "abc123...",
  "expiresIn": 600,
  "scopes": ["user:read", "team:read", "sandbox:create", "sandbox:manage"]
}
```

**Example:**

```bash
curl -H "X-Vault-Id: my-vault" http://localhost:3001/api/vercel/auth/url
```

---

### GET /api/vercel/auth/callback

OAuth callback handler. Usually called by Vercel redirect.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Vercel |
| `state` | string | State parameter for CSRF protection |
| `success_url` | string | URL to redirect on success (optional) |

**Response (JSON if no success_url):**

```json
{
  "success": true,
  "vercelUserId": "user_xxx",
  "teamId": "team_xxx",
  "scopes": ["user:read", "team:read", "sandbox:create", "sandbox:manage"]
}
```

**Error Response:**

```json
{
  "error": "Invalid or expired state",
  "code": "INVALID_STATE"
}
```

---

### DELETE /api/vercel/auth/disconnect

Revoke Vercel connection.

**Authentication:** Required

**Request Body:**

```json
{
  "connectionId": "optional-specific-connection-id"
}
```

**Response:**

```json
{
  "success": true,
  "disconnectedAt": "2025-01-25T12:00:00.000Z"
}
```

---

### GET /api/vercel/auth/status

Check Vercel connection status.

**Authentication:** Required

**Response:**

```json
{
  "connected": true,
  "activeConnection": {
    "id": "conn_xxx",
    "vercelUserId": "user_xxx",
    "teamId": "team_xxx",
    "scopes": ["user:read", "team:read", "sandbox:create", "sandbox:manage"],
    "status": "active",
    "tokenExpired": false,
    "tokenExpiresAt": "2025-02-25T12:00:00.000Z",
    "createdAt": "2025-01-25T12:00:00.000Z",
    "updatedAt": "2025-01-25T12:00:00.000Z"
  },
  "connectionHistory": [
    {
      "id": "conn_xxx",
      "status": "active",
      "createdAt": "2025-01-25T12:00:00.000Z",
      "updatedAt": "2025-01-25T12:00:00.000Z"
    }
  ]
}
```

---

## Sandbox Endpoints

### POST /api/sandboxes

Create a new sandbox.

**Authentication:** Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Sandbox name |
| `template` | string | No | Template: `metamorph-basic`, `metamorph-research`, `metamorph-autonomous` |
| `runtime` | string | No | Runtime (default: `node22`) |
| `vcpus` | number | No | vCPU count (default: 2) |
| `memoryMb` | number | No | Memory in MB (default: 2048) |
| `timeoutMinutes` | number | No | Timeout in minutes (default: 30) |
| `environment` | object | No | Environment variables |
| `workingDirectory` | string | No | Working directory (default: `/vercel/sandbox`) |

**Example Request:**

```json
{
  "name": "My Research Sandbox",
  "template": "metamorph-research"
}
```

**Response:**

```json
{
  "id": "sandbox_xxx",
  "name": "My Research Sandbox",
  "status": "pending",
  "config": {
    "runtime": "node22",
    "vcpus": 4,
    "memoryMb": 4096,
    "timeoutMinutes": 60
  },
  "agentConfig": {
    "intensity": 60,
    "enableProactiveMemory": true
  },
  "createdAt": "2025-01-25T12:00:00.000Z"
}
```

**Error Responses:**

```json
// No Vercel connection
{
  "error": "No active Vercel connection. Please connect your Vercel account first.",
  "code": "NO_VERCEL_CONNECTION"
}

// Sandbox limit reached
{
  "error": "Maximum sandbox limit (5) reached for your tier",
  "code": "SANDBOX_LIMIT_REACHED",
  "currentCount": 5,
  "limit": 5
}
```

---

### GET /api/sandboxes

List user's sandboxes.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Max results (default: 50, max: 100) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "sandboxes": [
    {
      "id": "sandbox_xxx",
      "name": "My Sandbox",
      "status": "running",
      "runtime": "node22",
      "vcpus": 2,
      "memoryMb": 2048,
      "timeoutMinutes": 30,
      "workingDirectory": "/vercel/sandbox",
      "hasAgent": true,
      "createdAt": "2025-01-25T12:00:00.000Z",
      "startedAt": "2025-01-25T12:01:00.000Z",
      "stoppedAt": null,
      "lastActivityAt": "2025-01-25T12:05:00.000Z",
      "totalRuntimeSeconds": 300,
      "errorMessage": null
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### GET /api/sandboxes/:id

Get sandbox details.

**Authentication:** Required

**Response:**

```json
{
  "id": "sandbox_xxx",
  "name": "My Sandbox",
  "status": "running",
  "runtime": "node22",
  "vcpus": 2,
  "memoryMb": 2048,
  "timeoutMinutes": 30,
  "environment": { "NODE_ENV": "production" },
  "workingDirectory": "/vercel/sandbox",
  "agent": {
    "sessionId": "sandbox-xxx-agent-abc123",
    "config": { "intensity": 50 }
  },
  "vercelSandboxId": "sbx_xxx",
  "createdAt": "2025-01-25T12:00:00.000Z",
  "startedAt": "2025-01-25T12:01:00.000Z",
  "stoppedAt": null,
  "lastActivityAt": "2025-01-25T12:05:00.000Z",
  "totalRuntimeSeconds": 300,
  "errorMessage": null
}
```

---

### DELETE /api/sandboxes/:id

Delete a sandbox.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "deletedAt": "2025-01-25T12:00:00.000Z"
}
```

---

### POST /api/sandboxes/:id/start

Start a sandbox.

**Authentication:** Required

**Response:**

```json
{
  "id": "sandbox_xxx",
  "status": "running",
  "startedAt": "2025-01-25T12:00:00.000Z"
}
```

**Error Responses:**

```json
// Already running
{
  "error": "Sandbox is already running",
  "code": "ALREADY_RUNNING"
}

// Cannot restart terminated
{
  "error": "Cannot start a terminated sandbox. Please create a new one.",
  "code": "CANNOT_RESTART"
}
```

---

### POST /api/sandboxes/:id/stop

Stop a running sandbox.

**Authentication:** Required

**Response:**

```json
{
  "id": "sandbox_xxx",
  "status": "stopped",
  "stoppedAt": "2025-01-25T12:00:00.000Z",
  "runtimeSeconds": 300
}
```

---

### POST /api/sandboxes/:id/execute

Execute a command in the sandbox.

**Authentication:** Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | Command to execute |
| `cwd` | string | No | Working directory |
| `timeout` | number | No | Timeout in ms (default: 30000) |

**Allowed Commands:**
`node`, `npm`, `npx`, `ls`, `cat`, `pwd`, `echo`, `mkdir`, `touch`, `rm`, `cp`, `mv`

**Example Request:**

```json
{
  "command": "node script.js",
  "cwd": "/vercel/sandbox/src"
}
```

**Response:**

```json
{
  "success": true,
  "stdout": "Hello, World!\n",
  "stderr": "",
  "exitCode": 0,
  "executionTimeMs": 125
}
```

**Error Response:**

```json
{
  "error": "Command not allowed. Allowed commands: node, npm, npx, ls, cat, pwd, echo, mkdir, touch, rm, cp, mv",
  "code": "COMMAND_NOT_ALLOWED"
}
```

---

### POST /api/sandboxes/:id/files

Write files to the sandbox.

**Authentication:** Required

**Request Body:**

```json
{
  "files": [
    {
      "path": "src/index.js",
      "content": "console.log('Hello, World!');"
    },
    {
      "path": "package.json",
      "content": "{\"name\": \"sandbox-app\"}"
    }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "path": "src/index.js", "success": true },
    { "path": "package.json", "success": true }
  ],
  "successCount": 2,
  "totalCount": 2
}
```

---

### POST /api/sandboxes/:id/agent/attach

Attach a Metamorph agent to the sandbox.

**Authentication:** Required

**Request Body:**

```json
{
  "config": {
    "intensity": 60,
    "coherenceFloor": 30,
    "enableProactiveMemory": true
  }
}
```

**Response:**

```json
{
  "sessionId": "sandbox-xxx-agent-abc123",
  "config": {
    "intensity": 60,
    "coherenceFloor": 30,
    "enableProactiveMemory": true,
    "sandboxed": true,
    "sandboxId": "sandbox_xxx",
    "vaultId": "my-vault"
  },
  "attachedAt": "2025-01-25T12:00:00.000Z"
}
```

---

### POST /api/sandboxes/:id/agent/chat

Chat with the sandboxed agent.

**Authentication:** Required

**Request Body:**

```json
{
  "message": "Hello, what can you help me with?"
}
```

**Response:**

```json
{
  "response": {
    "message": "Agent received your message...",
    "userMessage": "Hello, what can you help me with?",
    "sessionId": "sandbox-xxx-agent-abc123",
    "sandboxId": "sandbox_xxx",
    "timestamp": "2025-01-25T12:00:00.000Z"
  },
  "sessionId": "sandbox-xxx-agent-abc123",
  "executionTimeMs": 500
}
```

---

### GET /api/sandboxes/usage

Get resource usage for the current billing period.

**Authentication:** Required

**Response:**

```json
{
  "tier": "free",
  "period": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-31T23:59:59.000Z"
  },
  "usage": {
    "activeSandboxes": 1,
    "totalSandboxesCreated": 3,
    "runtimeHours": 5.5,
    "totalExecutions": 142
  },
  "limits": {
    "maxSandboxes": 1,
    "maxRuntimeHours": 10,
    "maxVcpus": 2,
    "maxMemoryMb": 2048,
    "maxTimeoutMinutes": 30
  },
  "remaining": {
    "sandboxes": 0,
    "runtimeHours": 4.5
  },
  "limitExceeded": false
}
```

---

## Session Endpoints

All session endpoints are vault-scoped.

### GET /api/sessions

List sessions for the current vault.

**Authentication:** Required

**Response:**

```json
{
  "sessions": [
    {
      "id": "session_xxx",
      "name": "My Session",
      "createdAt": "2025-01-25T12:00:00.000Z",
      "lastAccessed": "2025-01-25T13:00:00.000Z"
    }
  ],
  "vaultId": "my-vault"
}
```

---

### POST /api/sessions

Create a new session.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "My New Session"
}
```

**Response:**

```json
{
  "id": "session_xxx",
  "name": "My New Session",
  "createdAt": "2025-01-25T12:00:00.000Z"
}
```

---

### GET /api/sessions/:id

Get session details.

**Authentication:** Required

**Response:**

```json
{
  "id": "session_xxx",
  "name": "My Session",
  "createdAt": "2025-01-25T12:00:00.000Z",
  "lastAccessed": "2025-01-25T13:00:00.000Z",
  "messageCount": 42
}
```

---

### DELETE /api/sessions/:id

Delete a session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "deletedAt": "2025-01-25T12:00:00.000Z"
}
```

---

## Memory Endpoints

All memory endpoints are vault-scoped.

### GET /api/memories

List memories for the current vault.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type: `episodic`, `semantic`, `identity` |
| `minImportance` | number | Minimum importance (0-1) |
| `limit` | number | Max results (default: 10) |

**Response:**

```json
{
  "memories": [
    {
      "id": "mem_xxx",
      "type": "semantic",
      "content": "Memory content...",
      "importance": 0.8,
      "createdAt": "2025-01-25T12:00:00.000Z"
    }
  ],
  "total": 25,
  "vaultId": "my-vault"
}
```

---

### POST /api/memories

Create a new memory.

**Authentication:** Required

**Request Body:**

```json
{
  "type": "semantic",
  "content": "Important information to remember",
  "importance": 0.8,
  "metadata": {
    "source": "user-input"
  }
}
```

**Response:**

```json
{
  "id": "mem_xxx",
  "type": "semantic",
  "content": "Important information to remember",
  "importance": 0.8,
  "createdAt": "2025-01-25T12:00:00.000Z"
}
```

---

### DELETE /api/memories/:id

Delete a memory.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "deletedAt": "2025-01-25T12:00:00.000Z"
}
```

---

## See Also

- [Authentication Guide](./AUTHENTICATION.md) - Token and permission details
- [Sandbox Guide](./SANDBOX_GUIDE.md) - Sandbox usage patterns
- [Developer Guide](./DEVELOPER_GUIDE.md) - Implementation patterns
