# Migration Guide

> Guide for migrating existing Metamorph deployments to multitenancy

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Backup Procedures](#backup-procedures)
4. [Running the Migration](#running-the-migration)
5. [Verifying Migration Success](#verifying-migration-success)
6. [Handling Legacy Data](#handling-legacy-data)
7. [Rollback Procedures](#rollback-procedures)
8. [Gradual Rollout Strategy](#gradual-rollout-strategy)

---

## Overview

### What the Migration Does

The multitenancy migration:

1. **Adds `vault_id` column** to all user-scoped tables
2. **Creates composite indexes** for efficient vault-scoped queries
3. **Sets existing data** to `default-vault` vault ID
4. **Creates new tables** for Vercel connections and sandboxes

### Migration Files

| Migration | Description |
|-----------|-------------|
| `001_add_vault_id` | Adds vault_id to existing tables |
| `002_add_vercel_sandbox_tables` | Creates sandbox-related tables |

### Tables Modified

The following tables receive the `vault_id` column:

- sessions, messages, conversations
- semantic_memory, identity
- evolution_snapshots, operator_performance
- subagent_results, emotional_arcs, emotion_context
- session_states, identity_checkpoints
- operator_efficacy, coherence_metrics
- persona_variants, emergence_traces
- memory_associations, memory_compression_queue
- remote_sync_queue, identity_compression
- steering_messages

---

## Pre-Migration Checklist

### Before You Begin

- [ ] **Backup your database** (see next section)
- [ ] **Document current data** - Record row counts for verification
- [ ] **Plan downtime** - Migration requires brief service interruption
- [ ] **Test in staging** - Run migration on a copy first
- [ ] **Review environment variables** - Prepare production config

### Version Requirements

- Node.js 18.x or higher
- npm 9.x or higher
- Metamorph codebase with multitenancy branch

### Estimated Downtime

| Database Size | Estimated Time |
|---------------|----------------|
| < 100MB | < 1 minute |
| 100MB - 1GB | 1-5 minutes |
| 1GB - 10GB | 5-30 minutes |
| > 10GB | Plan for extended maintenance |

---

## Backup Procedures

### Full Database Backup

```bash
# Local development
cp ./data/metamorph.db ./data/metamorph-backup-$(date +%Y%m%d).db

# Or use SQLite backup command
sqlite3 ./data/metamorph.db ".backup ./data/metamorph-backup-$(date +%Y%m%d).db"
```

### Railway Backup

```bash
# SSH into Railway container
railway run bash

# Create backup
sqlite3 /data/metamorph.db ".backup /data/metamorph-backup-$(date +%Y%m%d).db"

# Verify backup
ls -la /data/metamorph-backup-*.db
```

### Verify Backup Integrity

```bash
# Check backup is valid SQLite
sqlite3 ./data/metamorph-backup-*.db "PRAGMA integrity_check;"
# Should return: ok

# Record row counts for verification
sqlite3 ./data/metamorph.db "
SELECT 'sessions' as table_name, COUNT(*) as count FROM sessions
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'semantic_memory', COUNT(*) FROM semantic_memory
UNION ALL
SELECT 'identity', COUNT(*) FROM identity;
"
```

---

## Running the Migration

### Step 1: Stop the Service

```bash
# Local
# Stop running server (Ctrl+C)

# Railway
railway service stop
```

### Step 2: Pull Latest Code

```bash
git fetch origin
git checkout feature/multitenancy  # or main if merged
git pull
npm install
npm run build
```

### Step 3: Run Migration

```bash
# Run all pending migrations
npm run migrate

# Or run specific migration
npm run migrate -- --migration=001_add_vault_id
```

### Migration Output

```
[Migration 001] Adding vault_id columns for multitenancy...

[Step 1] Adding vault_id columns...
  [+] sessions: column added successfully
  [+] messages: column added successfully
  [+] conversations: column added successfully
  [-] nonexistent_table: table does not exist
  ...

[Step 2] Creating composite indexes...
  [+] idx_sessions_vault_id: index created successfully
  [+] idx_sessions_vault_accessed: index created successfully
  ...

[Migration 001] Summary:
  Columns added: 15 (5 skipped)
  Indexes created: 25 (5 skipped)
```

### Step 4: Restart Service

```bash
# Local
npm run server

# Railway
railway service start
```

---

## Verifying Migration Success

### Check Column Exists

```bash
sqlite3 ./data/metamorph.db "PRAGMA table_info(sessions)" | grep vault_id
# Expected: 8|vault_id|TEXT|1|'default-vault'|0
```

### Check Data Migrated

```bash
sqlite3 ./data/metamorph.db "
SELECT vault_id, COUNT(*) as count
FROM sessions
GROUP BY vault_id;
"
# Expected: default-vault|123 (your count)
```

### Check Indexes Created

```bash
sqlite3 ./data/metamorph.db "
SELECT name FROM sqlite_master
WHERE type='index' AND name LIKE 'idx_%vault%';
"
# Should list all vault indexes
```

### Verify Row Counts Match

Compare with pre-migration counts:

```bash
sqlite3 ./data/metamorph.db "
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;
"
# Should match pre-migration counts
```

### Test API Endpoints

```bash
# Enable dev mode for testing
export EMBLEM_DEV_MODE=true

# Test listing sessions
curl -H "X-Vault-Id: default-vault" http://localhost:3001/api/sessions

# Should return existing data
```

---

## Handling Legacy Data

### Understanding Default Vault

All existing data is migrated to `default-vault`:

```sql
-- Existing data gets this vault_id
UPDATE sessions SET vault_id = 'default-vault' WHERE vault_id = '';
```

### Option 1: Keep as Default Vault

The simplest approach - legacy users continue using `default-vault`:

```bash
# Configure default vault in your auth system
# All legacy tokens should contain vault_id: 'default-vault'
```

### Option 2: Migrate to User-Specific Vaults

If you have user identifiers, migrate data to proper vaults:

```sql
-- Example: Migrate data based on a user_id column
UPDATE sessions
SET vault_id = 'user-' || created_by
WHERE vault_id = 'default-vault'
  AND created_by IS NOT NULL;

UPDATE semantic_memory
SET vault_id = 'user-' || user_id
WHERE vault_id = 'default-vault'
  AND user_id IS NOT NULL;
```

### Migration Script Example

```typescript
// src/scripts/migrate-legacy-users.ts
import Database from 'better-sqlite3';

async function migrateLegacyData() {
  const db = new Database(process.env.DATABASE_PATH);

  // Get distinct users
  const users = db.prepare(`
    SELECT DISTINCT created_by FROM sessions
    WHERE vault_id = 'default-vault' AND created_by IS NOT NULL
  `).all();

  // Migrate each user's data
  for (const { created_by } of users) {
    const newVaultId = `user-${created_by}`;

    console.log(`Migrating ${created_by} -> ${newVaultId}`);

    // Update sessions
    db.prepare(`
      UPDATE sessions SET vault_id = ?
      WHERE created_by = ? AND vault_id = 'default-vault'
    `).run(newVaultId, created_by);

    // Update messages (join via session)
    db.prepare(`
      UPDATE messages SET vault_id = ?
      WHERE session_id IN (
        SELECT id FROM sessions WHERE created_by = ?
      )
    `).run(newVaultId, created_by);

    // Update memories
    db.prepare(`
      UPDATE semantic_memory SET vault_id = ?
      WHERE user_id = ? AND vault_id = 'default-vault'
    `).run(newVaultId, created_by);
  }

  console.log(`Migrated ${users.length} users`);
  db.close();
}

migrateLegacyData();
```

---

## Rollback Procedures

### Rollback Migration

The migration `down` function removes indexes but preserves columns:

```bash
npm run migrate:rollback
```

**Note:** SQLite does not support `DROP COLUMN`. The vault_id columns remain but indexes are removed. For a complete rollback, restore from backup.

### Full Restore from Backup

```bash
# Stop service
railway service stop

# Restore backup
cp ./data/metamorph-backup-YYYYMMDD.db ./data/metamorph.db

# Restart
railway service start
```

### Partial Rollback (Keep Data, Disable Multitenancy)

If you need to disable multitenancy but keep the migrated data:

```bash
# Set dev mode with fixed vault
EMBLEM_DEV_MODE=true
# All requests will use 'dev-vault' or X-Vault-Id header
```

---

## Gradual Rollout Strategy

### Phase 1: Development Testing

```bash
# Enable dev mode
EMBLEM_DEV_MODE=true

# Test with different vaults
curl -H "X-Vault-Id: test-vault-1" http://localhost:3001/api/sessions
curl -H "X-Vault-Id: test-vault-2" http://localhost:3001/api/sessions

# Verify isolation works
```

### Phase 2: Staging Deployment

1. Deploy to staging environment
2. Run migration on staging database
3. Test all functionality with real tokens
4. Verify performance with vault-scoped queries

### Phase 3: Production - Legacy Mode

1. Deploy with `EMBLEM_DEV_MODE=false`
2. Configure JWT secret
3. Issue tokens with `vault_id: 'default-vault'` for existing users
4. Monitor for any issues

### Phase 4: Production - Full Multitenancy

1. Begin issuing unique vault IDs to new users
2. Optionally migrate existing users to new vaults
3. Update authentication to provide user-specific vault IDs
4. Monitor performance and vault isolation

### Phase 5: Cleanup

1. Remove any legacy workarounds
2. Migrate remaining `default-vault` data if applicable
3. Document final state

---

## Troubleshooting

### Migration Fails - Column Already Exists

```
Error: duplicate column name: vault_id
```

**Solution:** Column was partially added in a previous attempt. Check which tables have the column and skip them:

```bash
sqlite3 ./data/metamorph.db "
SELECT name FROM sqlite_master WHERE type='table'
" | while read table; do
  echo -n "$table: "
  sqlite3 ./data/metamorph.db "PRAGMA table_info($table)" | grep vault_id || echo "missing"
done
```

### Migration Fails - Database Locked

```
Error: SQLITE_BUSY: database is locked
```

**Solution:** Ensure no other processes are accessing the database:

```bash
lsof ./data/metamorph.db
# Kill any processes accessing the database
```

### Data Not Showing After Migration

**Symptom:** API returns empty arrays after migration

**Cause:** Querying with wrong vault ID

**Solution:**
1. Check what vault ID existing data has:
   ```sql
   SELECT DISTINCT vault_id FROM sessions;
   ```
2. Use that vault ID in your requests:
   ```bash
   curl -H "X-Vault-Id: default-vault" http://localhost:3001/api/sessions
   ```

### Performance Degradation

**Symptom:** Queries slower after migration

**Cause:** Indexes not created or not being used

**Solution:**
1. Verify indexes exist:
   ```sql
   SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%vault%';
   ```
2. Analyze query plan:
   ```sql
   EXPLAIN QUERY PLAN SELECT * FROM sessions WHERE vault_id = 'x' AND status = 'y';
   ```
3. Re-run migration if indexes are missing

---

## See Also

- [Getting Started](./GETTING_STARTED.md) - Fresh installation
- [Architecture Overview](./ARCHITECTURE.md) - System design
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
