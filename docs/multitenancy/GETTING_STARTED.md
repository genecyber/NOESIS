# Getting Started with Multitenancy

> Set up and run Metamorph with multitenancy support

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Environment Setup](#environment-setup)
4. [Running Migrations](#running-migrations)
5. [Verification](#verification)
6. [First API Call](#first-api-call)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or higher | JavaScript runtime |
| npm | 9.x or higher | Package manager |
| SQLite | 3.x | Database (bundled with better-sqlite3) |

### Required Accounts

For full functionality, you may need:

| Service | Required For | How to Get |
|---------|--------------|------------|
| Anthropic | Claude API | [console.anthropic.com](https://console.anthropic.com) |
| Vercel | Sandbox execution | [vercel.com](https://vercel.com) |

---

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/metamorph.git
cd metamorph

# Install dependencies
npm install
```

### 2. Build the Project

```bash
# Compile TypeScript
npm run build
```

### 3. Create Data Directory

```bash
# Create the data directory for SQLite
mkdir -p data
```

---

## Environment Setup

### Create Environment File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### Minimum Configuration (Development)

For local development with multitenancy, set these variables:

```bash
# Required: Claude API key
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Database path (default works for local dev)
DATABASE_PATH=./data/metamorph.db

# Enable development mode (bypasses JWT validation)
EMBLEM_DEV_MODE=true
```

### Production Configuration

For production deployments, you need additional variables:

```bash
# Disable dev mode
EMBLEM_DEV_MODE=false

# JWT secret for token validation (32+ characters recommended)
EMBLEM_JWT_SECRET=your-secure-jwt-secret-at-least-32-chars

# Optional: External Emblem API for token validation
EMBLEM_API_URL=https://api.emblemvault.ai
```

### Vercel Sandbox Configuration (Optional)

To enable isolated code execution:

```bash
# OAuth app credentials from Vercel
VERCEL_CLIENT_ID=oac_xxx
VERCEL_CLIENT_SECRET=xxx

# Token encryption key (32 characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key
```

---

## Running Migrations

Migrations add the `vault_id` column to all user-scoped tables.

### Run All Pending Migrations

```bash
npm run migrate
```

### What the Migration Does

**Migration 001: Add Vault ID**
- Adds `vault_id TEXT NOT NULL` column to 20+ tables
- Creates composite indexes for efficient vault-scoped queries
- Sets existing data to `default-vault`

**Migration 002: Add Sandbox Tables**
- Creates `vercel_connections` table for OAuth tokens
- Creates `sandboxes` table for execution environments
- Creates `sandbox_resource_usage` for tracking limits

### Verify Migration Success

```bash
# Check that columns were added
sqlite3 ./data/metamorph.db "PRAGMA table_info(sessions)" | grep vault_id

# Expected output:
# 8|vault_id|TEXT|1|'default-vault'|0
```

---

## Verification

### Start the Development Server

```bash
# Start the backend server
npm run server

# In another terminal, start the web UI (optional)
cd web && npm run dev
```

### Check Server Status

```bash
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-25T..."}
```

### Verify Multitenancy is Active

```bash
# Check that dev mode authentication works
curl -H "X-Vault-Id: test-vault" http://localhost:3001/api/sessions

# Expected response (empty array for new vault):
# {"sessions":[],"vaultId":"test-vault"}
```

---

## First API Call

### Example: Create and List Sessions

```bash
# Create a new session
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-Vault-Id: my-vault" \
  -d '{"name": "My First Session"}'

# List sessions for the vault
curl -H "X-Vault-Id: my-vault" http://localhost:3001/api/sessions
```

### Example: Send a Chat Message

```bash
# Start a chat (creates session if needed)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Vault-Id: my-vault" \
  -d '{"message": "Hello, Metamorph!"}'
```

### Using Different Vaults

Each vault is isolated. Data in one vault cannot be seen from another:

```bash
# Create session in vault-a
curl -X POST http://localhost:3001/api/sessions \
  -H "X-Vault-Id: vault-a" \
  -H "Content-Type: application/json" \
  -d '{"name": "Vault A Session"}'

# List sessions in vault-b (empty - isolated)
curl -H "X-Vault-Id: vault-b" http://localhost:3001/api/sessions
# Returns: {"sessions":[]}

# List sessions in vault-a (shows the session)
curl -H "X-Vault-Id: vault-a" http://localhost:3001/api/sessions
# Returns: {"sessions":[{"id":"...","name":"Vault A Session",...}]}
```

---

## Troubleshooting

### Common Issues

#### "No vault context" Error

**Symptom:** Error message "No vault context - must be called within withVaultContext()"

**Cause:** Code is accessing vault context outside of middleware scope.

**Solution:** Ensure the code runs within `withVaultContext()` or after vault middleware:

```typescript
// Wrong - no context
const vault = getCurrentVault();  // Throws!

// Right - wrapped in context
withVaultContext({ vaultId: 'test' }, () => {
  const vault = getCurrentVault();  // Works!
});
```

#### "Authentication required" Error

**Symptom:** 401 error with `MISSING_TOKEN` code

**Cause:** Production mode is enabled but no JWT is provided.

**Solution:** Either enable dev mode or provide a valid JWT:

```bash
# Option 1: Enable dev mode
export EMBLEM_DEV_MODE=true

# Option 2: Provide JWT token
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3001/api/sessions
```

#### Migration Fails

**Symptom:** "table does not exist" or similar errors

**Cause:** Running migration before database is initialized.

**Solution:** Start the server once to create tables, then run migration:

```bash
# Start server briefly to initialize database
npm run server &
sleep 5
kill %1

# Now run migration
npm run migrate
```

#### Database Locked

**Symptom:** "SQLITE_BUSY: database is locked"

**Cause:** Multiple processes accessing the database.

**Solution:** Ensure only one server instance is running, or increase busy timeout:

```bash
# Check for running processes
lsof ./data/metamorph.db

# Kill any stale processes
pkill -f metamorph
```

### Getting Help

If you encounter issues not covered here:

1. Check the [existing documentation](../MULTITENANCY.md)
2. Search [GitHub Issues](https://github.com/your-org/metamorph/issues)
3. Enable debug logging: `LOG_LEVEL=debug npm run server`

---

## Next Steps

- [Architecture Overview](./ARCHITECTURE.md) - Understand how components fit together
- [Authentication Guide](./AUTHENTICATION.md) - Learn about JWT tokens and permissions
- [API Reference](./API_REFERENCE.md) - Explore available endpoints
- [Developer Guide](./DEVELOPER_GUIDE.md) - Start building with multitenancy

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Build commands and project overview
- [.env.example](../../.env.example) - Full list of environment variables
