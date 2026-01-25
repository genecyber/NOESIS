# Sandbox Guide

> Complete guide to isolated code execution in Metamorph

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Sandbox Types](#sandbox-types)
3. [Creating Sandboxes](#creating-sandboxes)
4. [Resource Limits](#resource-limits)
5. [Code Execution](#code-execution)
6. [Module Allowlist](#module-allowlist)
7. [Agent-in-Sandbox](#agent-in-sandbox)
8. [Security Model](#security-model)
9. [Best Practices](#best-practices)

---

## Overview

### What Are Sandboxes?

Sandboxes provide isolated code execution environments for each vault. They enable:

- Safe execution of user-provided code
- Resource isolation between vaults
- Computational workload separation
- Untrusted transformation execution

### When to Use Sandboxes

| Use Case | Description |
|----------|-------------|
| User code execution | Running user-submitted JavaScript |
| Agent autonomy | Letting agents execute code safely |
| Data processing | Isolated computation on vault data |
| Plugin execution | Running third-party plugins |

### Architecture Overview

```
+---------------------------+
|    Metamorph Server       |
|                           |
|  +---------------------+  |
|  |   SandboxManager    |  |
|  |   - LRU pool        |  |
|  |   - Per-vault       |  |
|  +----------+----------+  |
|             |             |
+-------------|-------------+
              |
    +---------+---------+
    |                   |
    v                   v
+--------+        +--------+
| Vercel |        | Node   |
| Sandbox|        | vm     |
| (Prod) |        | (Dev)  |
+--------+        +--------+
```

---

## Sandbox Types

### Vercel Sandbox (Production)

Cloud-based MicroVMs for production use.

**Features:**
- Full process isolation
- Network and filesystem isolation
- Cloud-based, scalable
- Requires Vercel credentials

**Requirements:**
```bash
VERCEL_CLIENT_ID=oac_xxx
VERCEL_CLIENT_SECRET=xxx
# Or use OIDC token
VERCEL_OIDC_TOKEN=xxx
```

**When Used:**
- Vercel credentials are configured
- `forceVmFallback` is not set

### Node.js vm (Development/Fallback)

Local VM-based isolation for development.

**Features:**
- Local execution
- Restricted globals
- Module allowlist
- Always available

**Limitations:**
- No network isolation
- Runs in same process
- Less secure than Vercel Sandbox

**When Used:**
- No Vercel credentials
- Development mode
- `forceVmFallback: true` option

### Comparison

| Feature | Vercel Sandbox | Node.js vm |
|---------|---------------|------------|
| Isolation | Full MicroVM | Same process |
| Network | Isolated | Shared |
| Filesystem | Isolated | Restricted |
| Performance | Higher latency | Lower latency |
| Security | Production-grade | Development-grade |
| Cost | Vercel usage | Free |

---

## Creating Sandboxes

### Via API

```bash
# Create a basic sandbox
curl -X POST http://localhost:3001/api/sandboxes \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Sandbox"
  }'

# Create with template
curl -X POST http://localhost:3001/api/sandboxes \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Sandbox",
    "template": "metamorph-research"
  }'

# Create with custom config
curl -X POST http://localhost:3001/api/sandboxes \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Sandbox",
    "vcpus": 4,
    "memoryMb": 4096,
    "timeoutMinutes": 60
  }'
```

### Available Templates

| Template | vCPUs | Memory | Timeout | Use Case |
|----------|-------|--------|---------|----------|
| `metamorph-basic` | 2 | 2GB | 30 min | General purpose |
| `metamorph-research` | 4 | 4GB | 60 min | Research, web scraping |
| `metamorph-autonomous` | 4 | 8GB | 120 min | Long-running autonomous tasks |

### Template Details

```typescript
// metamorph-basic
{
  runtime: 'node22',
  vcpus: 2,
  memoryMb: 2048,
  timeoutMinutes: 30,
  packages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk', 'better-sqlite3'],
  agentConfig: { intensity: 50, coherenceFloor: 30 }
}

// metamorph-research
{
  runtime: 'node22',
  vcpus: 4,
  memoryMb: 4096,
  timeoutMinutes: 60,
  packages: [..., 'puppeteer', 'cheerio', 'axios'],
  agentConfig: { intensity: 60, enableProactiveMemory: true }
}

// metamorph-autonomous
{
  runtime: 'node22',
  vcpus: 4,
  memoryMb: 8192,
  timeoutMinutes: 120,
  packages: [..., '@xenova/transformers'],
  agentConfig: { intensity: 70, sentienceLevel: 70, enableAutoEvolution: true }
}
```

### Via SandboxManager (Code)

```typescript
import { SandboxManager, sandboxManager } from './multitenancy/sandbox-manager.js';

// Use default singleton
await sandboxManager.getOrCreateSandbox('vault-123');

// Or create custom manager
const manager = new SandboxManager({
  maxPoolSize: 10,
  defaultConfig: {
    memoryLimitMB: 128,
    timeoutMs: 30000,
    allowedModules: ['path', 'url', 'crypto']
  },
  forceVmFallback: false // Force vm even with Vercel credentials
});
```

---

## Resource Limits

### Tier-Based Limits

| Plan | Max Sandboxes | Runtime/Month | Max vCPUs | Max RAM | Max Timeout |
|------|---------------|---------------|-----------|---------|-------------|
| Free | 1 | 10 hours | 2 | 2GB | 30 min |
| Pro | 5 | 100 hours | 4 | 8GB | 60 min |
| Enterprise | 20 | 1000 hours | 8 | 16GB | 120 min |

### Default Sandbox Config

| Setting | Default | Description |
|---------|---------|-------------|
| `memoryLimitMB` | 128 | Maximum memory in MB |
| `timeoutMs` | 30000 | Maximum execution time (30 seconds) |
| `maxPoolSize` | 10 | Maximum concurrent sandboxes |

### Checking Usage

```bash
curl -H "X-Vault-Id: my-vault" http://localhost:3001/api/sandboxes/usage
```

Response:
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
    "maxRuntimeHours": 10
  },
  "remaining": {
    "sandboxes": 0,
    "runtimeHours": 4.5
  },
  "limitExceeded": false
}
```

---

## Code Execution

### Simple Execution

```typescript
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  'return 1 + 2;'
);
// { success: true, output: 3, executionTimeMs: 5 }
```

### With Context Variables

```typescript
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  'return x * y;',
  { x: 10, y: 5 }
);
// { success: true, output: 50, executionTimeMs: 3 }
```

### Using Allowed Modules

```typescript
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  `
    const path = require('path');
    return path.join('a', 'b', 'c');
  `
);
// { success: true, output: 'a/b/c', executionTimeMs: 8 }
```

### Handling Errors

```typescript
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  'throw new Error("Something went wrong");'
);
// { success: false, error: 'Something went wrong', executionTimeMs: 2 }
```

### Via API

```bash
# Start sandbox first
curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/start \
  -H "X-Vault-Id: my-vault"

# Execute command
curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/execute \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "node -e \"console.log(1+1)\""
  }'
```

---

## Module Allowlist

### Allowed Modules

The following Node.js modules are available in vm sandboxes:

| Module | Purpose |
|--------|---------|
| `path` | Path manipulation |
| `url` | URL parsing |
| `crypto` | Cryptographic functions |
| `querystring` | Query string parsing |
| `util` | Utility functions |
| `buffer` | Buffer operations |
| `events` | Event emitter |
| `stream` | Stream utilities |

### Blocked Modules

The following are explicitly blocked:

- `fs` - Filesystem access
- `child_process` - Process spawning
- `net` - Network access
- `http` / `https` - HTTP requests
- `os` - Operating system info
- `cluster` - Clustering
- `worker_threads` - Worker threads

### Requesting Modules

```typescript
// Works
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  `
    const path = require('path');
    const crypto = require('crypto');
    return crypto.randomUUID();
  `
);

// Fails
const result = await sandboxManager.executeSandboxed(
  'vault-123',
  `
    const fs = require('fs'); // Error: Module 'fs' is not allowed
    return fs.readFileSync('/etc/passwd');
  `
);
// { success: false, error: "Module 'fs' is not allowed in sandbox." }
```

---

## Agent-in-Sandbox

### Attaching an Agent

```bash
# Create and start sandbox
curl -X POST http://localhost:3001/api/sandboxes \
  -H "X-Vault-Id: my-vault" \
  -d '{"name": "Agent Sandbox"}'

curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/start \
  -H "X-Vault-Id: my-vault"

# Attach agent
curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/agent/attach \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "intensity": 60,
      "enableProactiveMemory": true
    }
  }'
```

### Chatting with Sandboxed Agent

```bash
curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/agent/chat \
  -H "X-Vault-Id: my-vault" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, sandboxed agent!"
  }'
```

### Agent Configuration

```typescript
// Agent config merged with defaults
{
  intensity: 60,              // Transformation intensity
  coherenceFloor: 30,         // Minimum coherence
  enableProactiveMemory: true,// Auto-inject memories
  sandboxed: true,            // Marked as sandboxed
  sandboxId: 'sandbox-xxx',   // Parent sandbox
  vaultId: 'vault-123'        // Owner vault
}
```

### Memory Sync

Memories can be synced between main database and sandbox:

```typescript
// Copy high-importance memories to sandbox
await executor.syncMemoriesFromMain(sandboxSessionId, vaultId, {
  type: 'semantic',
  minImportance: 0.7,
  limit: 100
});

// Copy learned memories back to main
await executor.syncMemoriesToMain(sandboxSessionId, vaultId);
```

---

## Security Model

### Execution Isolation

```
+----------------------------------+
|         Main Process             |
|                                  |
|  +----------------------------+  |
|  |      SandboxManager        |  |
|  +----------------------------+  |
|           |                      |
|  +--------+--------+             |
|  |                 |             |
|  v                 v             |
|  +-------------+   +----------+  |
|  | vm Context  |   | Vercel   |  |
|  | (Isolated)  |   | MicroVM  |  |
|  +-------------+   +----------+  |
+----------------------------------+
```

### vm Sandbox Security

```typescript
// Restricted globals
const contextGlobals = {
  // Core JavaScript only
  Object, Array, String, Number, Boolean,
  Date, RegExp, Error, Map, Set, Promise,
  Math, JSON, parseInt, parseFloat,

  // Typed arrays
  ArrayBuffer, DataView, Int8Array, ...

  // Wrapped console
  console: {
    log: (...args) => console.log('[Sandbox]', ...args),
    // ...
  },

  // Disabled timing functions
  setTimeout: undefined,
  setInterval: undefined,

  // Per-vault data store
  __vaultData__: new Map(),
  __vaultId__: vaultId,

  // Restricted require
  require: restrictedRequire
};

// Create context with security options
const vmContext = vm.createContext(contextGlobals, {
  name: `sandbox-${vaultId}`,
  codeGeneration: {
    strings: false,  // Disable eval-like functions
    wasm: false      // Disable WebAssembly
  }
});
```

### Per-Vault Data Isolation

```typescript
// Store data in vault-a's sandbox
await sandboxManager.executeSandboxed('vault-a', `
  __vaultData__.set('secret', 'vault-a-value');
`);

// Cannot access from vault-b
const result = await sandboxManager.executeSandboxed('vault-b', `
  return __vaultData__.get('secret');
`);
// result.output is undefined
```

### Command Allowlist

API command execution is restricted:

```typescript
const ALLOWED_COMMANDS = [
  'node', 'npm', 'npx',      // Node.js
  'ls', 'cat', 'pwd',        // Read-only
  'echo', 'mkdir', 'touch',  // Safe operations
  'rm', 'cp', 'mv'           // File operations
];
```

---

## Best Practices

### Do: Use Templates for Common Cases

```bash
# Use appropriate template
curl -X POST http://localhost:3001/api/sandboxes \
  -d '{"name": "Research", "template": "metamorph-research"}'
```

### Do: Clean Up Idle Sandboxes

```bash
# Stop when not needed
curl -X POST http://localhost:3001/api/sandboxes/sandbox-id/stop

# Delete when done
curl -X DELETE http://localhost:3001/api/sandboxes/sandbox-id
```

### Do: Handle Execution Errors

```typescript
const result = await sandboxManager.executeSandboxed(vaultId, code);

if (!result.success) {
  console.error(`Execution failed: ${result.error}`);
  // Handle error appropriately
  return;
}

// Use result.output
```

### Do: Monitor Resource Usage

```bash
# Check usage regularly
curl http://localhost:3001/api/sandboxes/usage

# Alert on approaching limits
if (usage.remaining.runtimeHours < 1) {
  alert('Approaching runtime limit');
}
```

### Do Not: Trust User Code

```typescript
// WRONG: Executing user code directly
const result = await sandboxManager.executeSandboxed(
  vaultId,
  userProvidedCode // Dangerous!
);

// RIGHT: Validate and sanitize
const sanitizedCode = validateAndSanitize(userProvidedCode);
if (!sanitizedCode) {
  throw new Error('Invalid code');
}
const result = await sandboxManager.executeSandboxed(vaultId, sanitizedCode);
```

### Do Not: Store Sensitive Data in Sandboxes

```typescript
// WRONG: API keys in sandbox
await sandboxManager.executeSandboxed(vaultId, `
  const API_KEY = 'sk-secret-key';
`);

// RIGHT: Pass only necessary data
await sandboxManager.executeSandboxed(vaultId, code, {
  processedData: sanitizedData
});
```

### Do Not: Leave Sandboxes Running

```typescript
// WRONG: Create and forget
await sandboxManager.getOrCreateSandbox(vaultId);
// ... never cleaned up

// RIGHT: Proper lifecycle management
try {
  await sandboxManager.getOrCreateSandbox(vaultId);
  await executeWork();
} finally {
  await sandboxManager.destroySandbox(vaultId);
}
```

---

## Sandbox Lifecycle

### State Machine

```
+-------------+     +-------------+     +-------------+
|   pending   | --> |  creating   | --> |   running   |
+-------------+     +-------------+     +------+------+
                                               |
                    +-------------+            |
                    |   stopped   | <----------+
                    +------+------+            |
                           |                   |
                    +------v------+     +------v------+
                    | terminated  |     |    error    |
                    +-------------+     +-------------+
```

### Cleanup

```typescript
// On server shutdown
await sandboxManager.shutdown();

// Specific vault cleanup
await sandboxManager.destroySandbox(vaultId);

// Stats check
const stats = sandboxManager.getStats();
// { activeCount: 3, maxPoolSize: 10, sandboxType: 'vm', vaults: ['v1', 'v2', 'v3'] }
```

---

## See Also

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture Overview](./ARCHITECTURE.md) - System design
- [Developer Guide](./DEVELOPER_GUIDE.md) - Implementation patterns
