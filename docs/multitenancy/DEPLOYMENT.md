# Deployment Guide

> Production deployment guide for Metamorph multitenancy

**Version:** 1.0.0
**Last Updated:** January 2025

---

## Table of Contents

1. [Railway Setup](#railway-setup)
2. [Volume Configuration](#volume-configuration)
3. [Environment Variables](#environment-variables)
4. [Database Backup and Restore](#database-backup-and-restore)
5. [Monitoring](#monitoring)
6. [Scaling Considerations](#scaling-considerations)
7. [Security Checklist](#security-checklist)

---

## Railway Setup

### Prerequisites

- Railway account at [railway.app](https://railway.app)
- GitHub repository connected to Railway
- Anthropic API key

### Step 1: Create Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### Step 2: Configure Service

In the Railway Dashboard:

1. Navigate to your project
2. Click "New Service" > "GitHub Repo"
3. Select your Metamorph repository
4. Railway will auto-detect the Dockerfile

### Step 3: Create Volume

```
Railway Dashboard -> Service -> Settings -> Volumes

Name: metamorph-data
Mount Path: /data
Size: 1GB (auto-expands)
```

### Step 4: Configure railway.toml

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

### Step 5: Set Environment Variables

```bash
# Required
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set EMBLEM_JWT_SECRET=your-32-char-secret-minimum
railway variables set DATABASE_PATH=/data/metamorph.db
railway variables set NODE_ENV=production

# Security - IMPORTANT
railway variables set EMBLEM_DEV_MODE=false

# Optional - Vercel Sandbox
railway variables set VERCEL_CLIENT_ID=oac_xxx
railway variables set VERCEL_CLIENT_SECRET=xxx
railway variables set TOKEN_ENCRYPTION_KEY=32-char-key-for-aes-encryption
```

### Step 6: Deploy

```bash
# Deploy from current branch
railway up

# Or push to trigger auto-deploy
git push origin main
```

---

## Volume Configuration

### Volume Structure

```
+------------------------------------------------------------------+
|                   Railway Container                               |
|                                                                   |
|   /data/                      <- Railway Volume Mount             |
|   +-- metamorph.db            <- Main SQLite database             |
|   +-- metamorph.db-wal        <- Write-ahead log                  |
|   +-- metamorph.db-shm        <- Shared memory                    |
|   +-- backups/                <- Backup directory                 |
|       +-- metamorph-20250125.db                                   |
|       +-- metamorph-20250124.db                                   |
|                                                                   |
+------------------------------------------------------------------+
```

### SQLite Configuration

The database is configured with WAL mode for concurrent access:

```typescript
// Applied pragmas
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  // 64MB cache
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;  // 5 second timeout
```

### Volume Size Guidelines

| Data Volume | Recommended Size |
|-------------|------------------|
| < 1000 users | 1GB |
| 1000-10000 users | 5GB |
| 10000+ users | 10GB+ |

Note: Railway volumes auto-expand, but set initial size appropriately.

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `EMBLEM_JWT_SECRET` | JWT signing secret (32+ chars) | `your-secure-secret-here-32chars` |
| `DATABASE_PATH` | SQLite database path | `/data/metamorph.db` |
| `NODE_ENV` | Environment mode | `production` |

### Security Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBLEM_DEV_MODE` | Enable dev mode (MUST be false in prod) | `false` |
| `TOKEN_ENCRYPTION_KEY` | AES-256 key for OAuth tokens | (none) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `EMBLEM_API_URL` | Emblem API for token validation | `https://api.emblemvault.ai` |
| `NOESIS_REMOTE_URL` | Remote sync server | (none) |

### Vercel Integration Variables

| Variable | Description |
|----------|-------------|
| `VERCEL_CLIENT_ID` | Vercel OAuth client ID |
| `VERCEL_CLIENT_SECRET` | Vercel OAuth client secret |
| `VERCEL_OIDC_TOKEN` | Vercel OIDC token (auto-set in Vercel) |

### Generating Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Database Backup and Restore

### Manual Backup

```bash
# Via Railway CLI
railway run sqlite3 /data/metamorph.db ".backup /data/backups/metamorph-$(date +%Y%m%d).db"

# List backups
railway run ls -la /data/backups/
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh - Run as Railway cron job

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/data/backups"
DB_PATH="/data/metamorph.db"

# Create backup
sqlite3 $DB_PATH ".backup $BACKUP_DIR/metamorph-$DATE.db"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "metamorph-*.db" -mtime +7 -delete

echo "Backup completed: metamorph-$DATE.db"
```

### Restore from Backup

```bash
# Stop the service first
railway service stop

# Restore
railway run cp /data/backups/metamorph-YYYYMMDD.db /data/metamorph.db

# Restart
railway service start
```

### Export Database Locally

```bash
# Download database
railway run cat /data/metamorph.db > local-backup.db

# Or use railway volume download
railway volume download metamorph-data ./local-backup/
```

---

## Monitoring

### Health Check Endpoint

```bash
curl https://your-app.railway.app/health
# {"status":"ok","timestamp":"2025-01-25T12:00:00.000Z"}
```

### Recommended Monitoring

1. **Uptime Monitoring**
   - Use Railway's built-in monitoring
   - External service like UptimeRobot for /health endpoint

2. **Error Tracking**
   - Sentry integration for error reporting
   - Log aggregation with Railway logs

3. **Resource Monitoring**
   - Railway dashboard for CPU/Memory
   - Volume usage tracking

### Logging

```typescript
// Structured logging for production
console.log(JSON.stringify({
  level: 'info',
  message: 'Request processed',
  vaultId: vault.vaultId,
  endpoint: req.path,
  duration: Date.now() - startTime
}));
```

### Railway Logs

```bash
# View recent logs
railway logs

# Follow logs in real-time
railway logs -f

# View specific service logs
railway logs --service metamorph
```

---

## Scaling Considerations

### Current Architecture Limits

SQLite is excellent for single-instance deployments but has limitations:

| Factor | Limit |
|--------|-------|
| Concurrent writers | 1 |
| Max database size | ~140TB (practical: ~100GB) |
| Max connections | Limited by busy_timeout |

### When to Scale

Consider migrating to PostgreSQL when:
- Write-heavy workload with high concurrency
- Database size exceeds 10GB
- Need horizontal scaling

### Scaling Options

**Option 1: Larger Railway Instance**
```
Railway Dashboard -> Service -> Settings -> Instance Size
- Increase CPU/Memory allocation
```

**Option 2: Read Replicas (Future)**
```
- Use SQLite read replicas with Litestream
- Primary writes to volume
- Replicas for read scaling
```

**Option 3: PostgreSQL Migration (Future)**
```
- Use Railway PostgreSQL add-on
- Migrate data with migration script
- Update DATABASE_URL configuration
```

### Performance Optimization

```typescript
// Current optimizations
PRAGMA cache_size = -64000;    // 64MB cache
PRAGMA synchronous = NORMAL;   // Faster writes
PRAGMA journal_mode = WAL;     // Concurrent reads
```

---

## Security Checklist

### Pre-Deployment

- [ ] `EMBLEM_DEV_MODE` is set to `false`
- [ ] `EMBLEM_JWT_SECRET` is at least 32 characters
- [ ] `TOKEN_ENCRYPTION_KEY` is set for Vercel integration
- [ ] All secrets are in Railway variables, not code
- [ ] No hardcoded credentials in repository

### Post-Deployment

- [ ] Health endpoint responds correctly
- [ ] Authentication rejects invalid tokens
- [ ] Vault isolation is working (test with different X-Vault-Id in dev mode)
- [ ] Database is on persistent volume
- [ ] HTTPS is enforced (Railway provides this automatically)

### Ongoing

- [ ] Regular backup verification
- [ ] Secret rotation every 90 days
- [ ] Dependency updates for security patches
- [ ] Monitor for unusual activity

### Security Headers

Ensure your deployment includes:

```typescript
app.use(helmet()); // Security headers

// Specific headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Apply rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  message: { error: 'Too many requests', code: 'RATE_LIMITED' }
}));
```

---

## Troubleshooting

### Database Lock Issues

**Symptom:** "SQLITE_BUSY: database is locked"

**Solution:**
```bash
# Increase busy timeout (in code)
PRAGMA busy_timeout = 10000;  // 10 seconds

# Or restart service to clear locks
railway service restart
```

### Volume Not Mounting

**Symptom:** Data not persisting across deploys

**Solution:**
1. Verify volume is created in Railway dashboard
2. Check `railway.toml` has correct mount configuration
3. Ensure `DATABASE_PATH` points to volume mount

### Authentication Failing

**Symptom:** All requests return 401

**Solution:**
1. Check `EMBLEM_JWT_SECRET` is set correctly
2. Verify tokens are being generated with correct secret
3. Check for clock skew (token expiration)

### Memory Issues

**Symptom:** Container OOM kills

**Solution:**
1. Increase instance size in Railway
2. Reduce SQLite cache size if needed
3. Check for memory leaks in application

---

## See Also

- [Getting Started](./GETTING_STARTED.md) - Initial setup
- [Architecture Overview](./ARCHITECTURE.md) - System design
- [Migration Guide](./MIGRATION_GUIDE.md) - Upgrading existing deployments
