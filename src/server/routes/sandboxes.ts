/**
 * Sandbox Management API Routes
 *
 * Provides endpoints for creating and managing isolated sandbox environments:
 * - POST /               - Create new sandbox
 * - GET /                - List user's sandboxes
 * - GET /:id             - Get sandbox details
 * - DELETE /:id          - Delete sandbox
 * - POST /:id/start      - Start sandbox
 * - POST /:id/stop       - Stop sandbox
 * - POST /:id/execute    - Run command in sandbox
 * - POST /:id/files      - Write files to sandbox
 * - POST /:id/agent/attach - Attach Metamorph agent
 * - POST /:id/agent/chat   - Chat with sandboxed agent
 * - GET /usage           - Get resource usage
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { getVaultIdFromRequest } from '../middleware/emblem-auth.js';
import { DATABASE_CONFIG } from '../../config/database.js';
import { getVercelAccessToken, getVercelConnectionId } from './vercel-auth.js';
import { sandboxManager } from '../../multitenancy/sandbox-manager.js';

const router = Router();

// Sandbox templates with predefined configurations
const SANDBOX_TEMPLATES: Record<string, {
  runtime: string;
  vcpus: number;
  memoryMb: number;
  timeoutMinutes: number;
  packages: string[];
  agentConfig: Record<string, unknown>;
}> = {
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
    packages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk', 'better-sqlite3', 'puppeteer', 'cheerio', 'axios'],
    agentConfig: { intensity: 60, enableProactiveMemory: true }
  },
  'metamorph-autonomous': {
    runtime: 'node22',
    vcpus: 4,
    memoryMb: 8192,
    timeoutMinutes: 120,
    packages: ['@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk', 'better-sqlite3', '@xenova/transformers'],
    agentConfig: { intensity: 70, sentienceLevel: 70, enableAutoEvolution: true }
  }
};

// Resource limits by tier
const RESOURCE_LIMITS: Record<string, {
  maxSandboxes: number;
  maxRuntimeHours: number;
  maxVcpus: number;
  maxMemoryMb: number;
  maxTimeoutMinutes: number;
}> = {
  free: {
    maxSandboxes: 1,
    maxRuntimeHours: 10,
    maxVcpus: 2,
    maxMemoryMb: 2048,
    maxTimeoutMinutes: 30
  },
  pro: {
    maxSandboxes: 5,
    maxRuntimeHours: 100,
    maxVcpus: 4,
    maxMemoryMb: 8192,
    maxTimeoutMinutes: 60
  },
  enterprise: {
    maxSandboxes: 20,
    maxRuntimeHours: 1000,
    maxVcpus: 8,
    maxMemoryMb: 16384,
    maxTimeoutMinutes: 120
  }
};

// Allowed commands whitelist for sandbox execution
const ALLOWED_COMMANDS = new Set([
  'node', 'npm', 'npx', 'ls', 'cat', 'pwd', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv'
]);

/**
 * Sandbox status enum
 */
type SandboxStatus = 'pending' | 'creating' | 'running' | 'stopped' | 'terminated' | 'error';

/**
 * Sandbox record interface
 */
interface SandboxRecord {
  id: string;
  vault_id: string;
  vercel_connection_id: string | null;
  sandbox_vercel_id: string | null;
  name: string;
  status: SandboxStatus;
  runtime: string;
  vcpus: number;
  memory_mb: number;
  timeout_minutes: number;
  environment: string | null;
  working_directory: string;
  agent_session_id: string | null;
  agent_config: string | null;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  last_activity_at: string | null;
  total_runtime_seconds: number;
  error_message: string | null;
}

/**
 * Resource usage record interface
 */
interface ResourceUsageRecord {
  id: string;
  vault_id: string;
  period_start: string;
  period_end: string;
  sandbox_count: number;
  total_runtime_seconds: number;
  total_executions: number;
  sandbox_limit: number;
  runtime_limit_hours: number;
  limit_exceeded: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get database instance
 */
function getDb(): Database.Database {
  return new Database(DATABASE_CONFIG.path);
}

/**
 * Get user's tier (defaults to 'free')
 */
function getUserTier(_vaultId: string): string {
  // TODO: Implement tier lookup from user subscription
  return 'free';
}

/**
 * Get current billing period dates
 */
function getCurrentPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

/**
 * Validate and sanitize a command for sandbox execution
 * Returns null if command is not allowed
 */
function validateCommand(command: string): { cmd: string; args: string[] } | null {
  const parts = command.trim().split(/\s+/);
  if (parts.length === 0) return null;

  const cmd = parts[0];
  if (!ALLOWED_COMMANDS.has(cmd)) {
    return null;
  }

  // Sanitize args - remove shell metacharacters
  const args = parts.slice(1).map(arg =>
    arg.replace(/[;&|`$(){}[\]<>\\'"]/g, '')
  );

  return { cmd, args };
}

/**
 * Get or create resource usage record for current period
 */
function getOrCreateUsageRecord(db: Database.Database, vaultId: string): ResourceUsageRecord {
  const period = getCurrentPeriod();
  const tier = getUserTier(vaultId);
  const limits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

  let record = db.prepare(`
    SELECT * FROM sandbox_resource_usage
    WHERE vault_id = ? AND period_start = ?
  `).get(vaultId, period.start) as ResourceUsageRecord | undefined;

  if (!record) {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sandbox_resource_usage (
        id, vault_id, period_start, period_end,
        sandbox_count, total_runtime_seconds, total_executions,
        sandbox_limit, runtime_limit_hours, limit_exceeded,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, FALSE, ?, ?)
    `).run(
      id, vaultId, period.start, period.end,
      limits.maxSandboxes, limits.maxRuntimeHours,
      now, now
    );

    record = db.prepare(`
      SELECT * FROM sandbox_resource_usage WHERE id = ?
    `).get(id) as ResourceUsageRecord;
  }

  return record;
}

/**
 * POST / - Create new sandbox
 */
router.post('/', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const {
      name,
      template,
      runtime = 'node22',
      vcpus = 2,
      memoryMb = 2048,
      timeoutMinutes = 30,
      environment,
      workingDirectory = '/vercel/sandbox'
    } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        error: 'Name is required',
        code: 'MISSING_NAME'
      });
      return;
    }

    // Get Vercel connection
    const connectionId = await getVercelConnectionId(vaultId);
    if (!connectionId) {
      res.status(400).json({
        error: 'No active Vercel connection. Please connect your Vercel account first.',
        code: 'NO_VERCEL_CONNECTION'
      });
      return;
    }

    // Check resource limits
    const usage = getOrCreateUsageRecord(db, vaultId);
    const tier = getUserTier(vaultId);
    const limits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

    // Count active sandboxes
    const activeSandboxCount = db.prepare(`
      SELECT COUNT(*) as count FROM sandboxes
      WHERE vault_id = ? AND status NOT IN ('terminated', 'error')
    `).get(vaultId) as { count: number };

    if (activeSandboxCount.count >= limits.maxSandboxes) {
      res.status(429).json({
        error: `Maximum sandbox limit (${limits.maxSandboxes}) reached for your tier`,
        code: 'SANDBOX_LIMIT_REACHED',
        currentCount: activeSandboxCount.count,
        limit: limits.maxSandboxes
      });
      return;
    }

    // Apply template if specified
    let config = { runtime, vcpus, memoryMb, timeoutMinutes };
    let agentConfig: Record<string, unknown> | null = null;

    if (template && SANDBOX_TEMPLATES[template]) {
      const templateConfig = SANDBOX_TEMPLATES[template];
      config = {
        runtime: templateConfig.runtime,
        vcpus: Math.min(templateConfig.vcpus, limits.maxVcpus),
        memoryMb: Math.min(templateConfig.memoryMb, limits.maxMemoryMb),
        timeoutMinutes: Math.min(templateConfig.timeoutMinutes, limits.maxTimeoutMinutes)
      };
      agentConfig = templateConfig.agentConfig;
    }

    // Enforce limits
    config.vcpus = Math.min(config.vcpus, limits.maxVcpus);
    config.memoryMb = Math.min(config.memoryMb, limits.maxMemoryMb);
    config.timeoutMinutes = Math.min(config.timeoutMinutes, limits.maxTimeoutMinutes);

    // Create sandbox record
    const sandboxId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sandboxes (
        id, vault_id, vercel_connection_id, name, status,
        runtime, vcpus, memory_mb, timeout_minutes,
        environment, working_directory, agent_config,
        created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sandboxId,
      vaultId,
      connectionId,
      name,
      config.runtime,
      config.vcpus,
      config.memoryMb,
      config.timeoutMinutes,
      environment ? JSON.stringify(environment) : null,
      workingDirectory,
      agentConfig ? JSON.stringify(agentConfig) : null,
      now
    );

    // Update usage count
    db.prepare(`
      UPDATE sandbox_resource_usage
      SET sandbox_count = sandbox_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, usage.id);

    console.log(`[Sandboxes] Created sandbox ${sandboxId} for vault ${vaultId}`);

    res.status(201).json({
      id: sandboxId,
      name,
      status: 'pending',
      config,
      agentConfig,
      createdAt: now
    });
  } catch (error) {
    console.error('[Sandboxes] Create error:', error);
    res.status(500).json({
      error: 'Failed to create sandbox',
      code: 'CREATE_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * GET / - List user's sandboxes
 */
router.get('/', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = `
      SELECT * FROM sandboxes
      WHERE vault_id = ?
    `;
    const params: (string | number)[] = [vaultId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const sandboxes = db.prepare(query).all(...params) as SandboxRecord[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM sandboxes WHERE vault_id = ?';
    const countParams: string[] = [vaultId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const total = (db.prepare(countQuery).get(...countParams) as { count: number }).count;

    res.json({
      sandboxes: sandboxes.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        runtime: s.runtime,
        vcpus: s.vcpus,
        memoryMb: s.memory_mb,
        timeoutMinutes: s.timeout_minutes,
        workingDirectory: s.working_directory,
        hasAgent: !!s.agent_session_id,
        createdAt: s.created_at,
        startedAt: s.started_at,
        stoppedAt: s.stopped_at,
        lastActivityAt: s.last_activity_at,
        totalRuntimeSeconds: s.total_runtime_seconds,
        errorMessage: s.error_message
      })),
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('[Sandboxes] List error:', error);
    res.status(500).json({
      error: 'Failed to list sandboxes',
      code: 'LIST_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * GET /usage - Get resource usage (must be before /:id routes)
 */
router.get('/usage', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const tier = getUserTier(vaultId);
    const limits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;
    const usage = getOrCreateUsageRecord(db, vaultId);

    // Get active sandbox count
    const activeSandboxCount = db.prepare(`
      SELECT COUNT(*) as count FROM sandboxes
      WHERE vault_id = ? AND status NOT IN ('terminated', 'error')
    `).get(vaultId) as { count: number };

    // Calculate runtime hours
    const runtimeHours = usage.total_runtime_seconds / 3600;
    const limitExceeded = runtimeHours >= limits.maxRuntimeHours ||
                          activeSandboxCount.count >= limits.maxSandboxes;

    res.json({
      tier,
      period: {
        start: usage.period_start,
        end: usage.period_end
      },
      usage: {
        activeSandboxes: activeSandboxCount.count,
        totalSandboxesCreated: usage.sandbox_count,
        runtimeHours: Math.round(runtimeHours * 100) / 100,
        totalExecutions: usage.total_executions
      },
      limits: {
        maxSandboxes: limits.maxSandboxes,
        maxRuntimeHours: limits.maxRuntimeHours,
        maxVcpus: limits.maxVcpus,
        maxMemoryMb: limits.maxMemoryMb,
        maxTimeoutMinutes: limits.maxTimeoutMinutes
      },
      remaining: {
        sandboxes: Math.max(0, limits.maxSandboxes - activeSandboxCount.count),
        runtimeHours: Math.max(0, Math.round((limits.maxRuntimeHours - runtimeHours) * 100) / 100)
      },
      limitExceeded
    });
  } catch (error) {
    console.error('[Sandboxes] Usage error:', error);
    res.status(500).json({
      error: 'Failed to get usage',
      code: 'USAGE_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * GET /:id - Get sandbox details
 */
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    res.json({
      id: sandbox.id,
      name: sandbox.name,
      status: sandbox.status,
      runtime: sandbox.runtime,
      vcpus: sandbox.vcpus,
      memoryMb: sandbox.memory_mb,
      timeoutMinutes: sandbox.timeout_minutes,
      environment: sandbox.environment ? JSON.parse(sandbox.environment) : null,
      workingDirectory: sandbox.working_directory,
      agent: sandbox.agent_session_id ? {
        sessionId: sandbox.agent_session_id,
        config: sandbox.agent_config ? JSON.parse(sandbox.agent_config) : null
      } : null,
      vercelSandboxId: sandbox.sandbox_vercel_id,
      createdAt: sandbox.created_at,
      startedAt: sandbox.started_at,
      stoppedAt: sandbox.stopped_at,
      lastActivityAt: sandbox.last_activity_at,
      totalRuntimeSeconds: sandbox.total_runtime_seconds,
      errorMessage: sandbox.error_message
    });
  } catch (error) {
    console.error('[Sandboxes] Get error:', error);
    res.status(500).json({
      error: 'Failed to get sandbox',
      code: 'GET_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * DELETE /:id - Delete sandbox
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    // Stop sandbox if running
    if (sandbox.status === 'running') {
      try {
        await sandboxManager.destroySandbox(sandbox.id);
      } catch (stopError) {
        console.warn('[Sandboxes] Error stopping sandbox during delete:', stopError);
      }
    }

    // Delete from database
    db.prepare('DELETE FROM sandboxes WHERE id = ?').run(id);

    // Update usage count
    const usage = getOrCreateUsageRecord(db, vaultId);
    db.prepare(`
      UPDATE sandbox_resource_usage
      SET sandbox_count = MAX(0, sandbox_count - 1), updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), usage.id);

    console.log(`[Sandboxes] Deleted sandbox ${id} for vault ${vaultId}`);

    res.json({
      success: true,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Sandboxes] Delete error:', error);
    res.status(500).json({
      error: 'Failed to delete sandbox',
      code: 'DELETE_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/start - Start sandbox
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status === 'running') {
      res.status(400).json({
        error: 'Sandbox is already running',
        code: 'ALREADY_RUNNING'
      });
      return;
    }

    if (sandbox.status === 'terminated' || sandbox.status === 'error') {
      res.status(400).json({
        error: 'Cannot start a terminated sandbox. Please create a new one.',
        code: 'CANNOT_RESTART'
      });
      return;
    }

    // Update status to creating
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE sandboxes
      SET status = 'creating', last_activity_at = ?
      WHERE id = ?
    `).run(now, id);

    // Get Vercel access token
    const accessToken = await getVercelAccessToken(vaultId);
    if (!accessToken) {
      db.prepare(`
        UPDATE sandboxes
        SET status = 'error', error_message = 'No valid Vercel token'
        WHERE id = ?
      `).run(id);

      res.status(400).json({
        error: 'Vercel connection expired. Please reconnect.',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    // Create sandbox using SandboxManager (uses Vercel SDK internally)
    try {
      await sandboxManager.getOrCreateSandbox(sandbox.id);

      // Update status to running
      db.prepare(`
        UPDATE sandboxes
        SET status = 'running', started_at = ?, last_activity_at = ?
        WHERE id = ?
      `).run(now, now, id);

      console.log(`[Sandboxes] Started sandbox ${id} for vault ${vaultId}`);

      res.json({
        id: sandbox.id,
        status: 'running',
        startedAt: now
      });
    } catch (sandboxError) {
      const errorMessage = sandboxError instanceof Error ? sandboxError.message : 'Unknown error';
      db.prepare(`
        UPDATE sandboxes
        SET status = 'error', error_message = ?
        WHERE id = ?
      `).run(errorMessage, id);

      res.status(500).json({
        error: 'Failed to start sandbox',
        code: 'START_ERROR',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('[Sandboxes] Start error:', error);
    res.status(500).json({
      error: 'Failed to start sandbox',
      code: 'START_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/stop - Stop sandbox
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status !== 'running') {
      res.status(400).json({
        error: 'Sandbox is not running',
        code: 'NOT_RUNNING'
      });
      return;
    }

    // Calculate runtime
    const startedAt = sandbox.started_at ? new Date(sandbox.started_at) : new Date();
    const runtimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const now = new Date().toISOString();

    // Stop the sandbox
    try {
      await sandboxManager.destroySandbox(sandbox.id);
    } catch (stopError) {
      console.warn('[Sandboxes] Error stopping sandbox:', stopError);
    }

    // Update status
    db.prepare(`
      UPDATE sandboxes
      SET status = 'stopped',
          stopped_at = ?,
          last_activity_at = ?,
          total_runtime_seconds = total_runtime_seconds + ?
      WHERE id = ?
    `).run(now, now, runtimeSeconds, id);

    // Update usage
    const usage = getOrCreateUsageRecord(db, vaultId);
    db.prepare(`
      UPDATE sandbox_resource_usage
      SET total_runtime_seconds = total_runtime_seconds + ?, updated_at = ?
      WHERE id = ?
    `).run(runtimeSeconds, now, usage.id);

    console.log(`[Sandboxes] Stopped sandbox ${id} for vault ${vaultId} (runtime: ${runtimeSeconds}s)`);

    res.json({
      id: sandbox.id,
      status: 'stopped',
      stoppedAt: now,
      runtimeSeconds
    });
  } catch (error) {
    console.error('[Sandboxes] Stop error:', error);
    res.status(500).json({
      error: 'Failed to stop sandbox',
      code: 'STOP_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/execute - Run command in sandbox
 *
 * Only whitelisted commands are allowed for security.
 * Commands run in an isolated sandbox environment.
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;
    const { command, cwd, timeout = 30000 } = req.body;

    if (!command || typeof command !== 'string') {
      res.status(400).json({
        error: 'Command is required',
        code: 'MISSING_COMMAND'
      });
      return;
    }

    // Validate and sanitize command
    const validated = validateCommand(command);
    if (!validated) {
      res.status(400).json({
        error: `Command not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`,
        code: 'COMMAND_NOT_ALLOWED'
      });
      return;
    }

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status !== 'running') {
      res.status(400).json({
        error: 'Sandbox is not running',
        code: 'NOT_RUNNING'
      });
      return;
    }

    // Execute command in sandbox using spawnSync for safety
    // The code runs inside the isolated sandbox, not on the host
    const workingDir = cwd || sandbox.working_directory;
    const code = `
      const { spawnSync } = require('child_process');
      const result = spawnSync(${JSON.stringify(validated.cmd)}, ${JSON.stringify(validated.args)}, {
        cwd: ${JSON.stringify(workingDir)},
        timeout: ${Math.min(timeout, 60000)},
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      });
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.status,
        signal: result.signal
      };
    `;

    const result = await sandboxManager.executeSandboxed(sandbox.id, code);

    // Update last activity
    db.prepare(`
      UPDATE sandboxes SET last_activity_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);

    // Update execution count
    const usage = getOrCreateUsageRecord(db, vaultId);
    db.prepare(`
      UPDATE sandbox_resource_usage
      SET total_executions = total_executions + 1, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), usage.id);

    if (result.success && result.output) {
      res.json({
        success: result.output.exitCode === 0,
        stdout: result.output.stdout,
        stderr: result.output.stderr,
        exitCode: result.output.exitCode,
        executionTimeMs: result.executionTimeMs
      });
    } else {
      res.json({
        success: false,
        error: result.error,
        executionTimeMs: result.executionTimeMs
      });
    }
  } catch (error) {
    console.error('[Sandboxes] Execute error:', error);
    res.status(500).json({
      error: 'Failed to execute command',
      code: 'EXECUTE_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/files - Write files to sandbox
 */
router.post('/:id/files', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      res.status(400).json({
        error: 'Files array is required',
        code: 'MISSING_FILES'
      });
      return;
    }

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status !== 'running') {
      res.status(400).json({
        error: 'Sandbox is not running',
        code: 'NOT_RUNNING'
      });
      return;
    }

    // Write files using sandbox execution
    const writeResults: Array<{ path: string; success: boolean; error?: string }> = [];

    for (const file of files) {
      if (!file.path || typeof file.path !== 'string') {
        writeResults.push({ path: file.path || 'unknown', success: false, error: 'Missing path' });
        continue;
      }
      if (file.content === undefined || file.content === null) {
        writeResults.push({ path: file.path, success: false, error: 'Missing content' });
        continue;
      }

      // Sanitize path - prevent path traversal
      const sanitizedPath = file.path.replace(/\.\./g, '').replace(/^\/+/, '');

      const code = `
        const fs = require('fs');
        const path = require('path');
        const basePath = ${JSON.stringify(sandbox.working_directory)};
        const filePath = path.join(basePath, ${JSON.stringify(sanitizedPath)});
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, ${JSON.stringify(String(file.content))});
        return { success: true, path: filePath };
      `;

      const result = await sandboxManager.executeSandboxed(sandbox.id, code);
      writeResults.push({
        path: file.path,
        success: result.success,
        error: result.error
      });
    }

    // Update last activity
    db.prepare(`
      UPDATE sandboxes SET last_activity_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);

    res.json({
      results: writeResults,
      successCount: writeResults.filter(r => r.success).length,
      totalCount: writeResults.length
    });
  } catch (error) {
    console.error('[Sandboxes] Files error:', error);
    res.status(500).json({
      error: 'Failed to write files',
      code: 'FILES_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/agent/attach - Attach Metamorph agent to sandbox
 */
router.post('/:id/agent/attach', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;
    const { config } = req.body;

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status !== 'running') {
      res.status(400).json({
        error: 'Sandbox is not running',
        code: 'NOT_RUNNING'
      });
      return;
    }

    if (sandbox.agent_session_id) {
      res.status(400).json({
        error: 'Agent already attached to this sandbox',
        code: 'AGENT_ATTACHED',
        sessionId: sandbox.agent_session_id
      });
      return;
    }

    // Generate agent session ID
    const agentSessionId = `sandbox-${id}-agent-${uuidv4().slice(0, 8)}`;
    const agentConfig = {
      ...SANDBOX_TEMPLATES['metamorph-basic'].agentConfig,
      ...config,
      sandboxed: true,
      sandboxId: id,
      vaultId
    };

    const now = new Date().toISOString();

    // Update sandbox with agent info
    db.prepare(`
      UPDATE sandboxes
      SET agent_session_id = ?,
          agent_config = ?,
          last_activity_at = ?
      WHERE id = ?
    `).run(agentSessionId, JSON.stringify(agentConfig), now, id);

    console.log(`[Sandboxes] Attached agent ${agentSessionId} to sandbox ${id}`);

    res.json({
      sessionId: agentSessionId,
      config: agentConfig,
      attachedAt: now
    });
  } catch (error) {
    console.error('[Sandboxes] Agent attach error:', error);
    res.status(500).json({
      error: 'Failed to attach agent',
      code: 'ATTACH_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * POST /:id/agent/chat - Chat with sandboxed agent
 */
router.post('/:id/agent/chat', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { id } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
      return;
    }

    const sandbox = db.prepare(`
      SELECT * FROM sandboxes
      WHERE id = ? AND vault_id = ?
    `).get(id, vaultId) as SandboxRecord | undefined;

    if (!sandbox) {
      res.status(404).json({
        error: 'Sandbox not found',
        code: 'NOT_FOUND'
      });
      return;
    }

    if (sandbox.status !== 'running') {
      res.status(400).json({
        error: 'Sandbox is not running',
        code: 'NOT_RUNNING'
      });
      return;
    }

    if (!sandbox.agent_session_id) {
      res.status(400).json({
        error: 'No agent attached to this sandbox. Use /agent/attach first.',
        code: 'NO_AGENT'
      });
      return;
    }

    // Execute agent chat in sandbox
    // Note: This is a simplified implementation. In production, you would
    // initialize a proper MetamorphAgent in the sandbox with full capabilities.
    const sanitizedMessage = JSON.stringify(message);
    const code = `
      // Simplified agent response (in production, this would use the full MetamorphAgent)
      const response = {
        message: "Agent received your message and is processing it in a sandboxed environment.",
        userMessage: ${sanitizedMessage},
        sessionId: ${JSON.stringify(sandbox.agent_session_id)},
        sandboxId: ${JSON.stringify(sandbox.id)},
        timestamp: new Date().toISOString()
      };
      return response;
    `;

    const result = await sandboxManager.executeSandboxed(sandbox.id, code);

    // Update last activity
    db.prepare(`
      UPDATE sandboxes SET last_activity_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);

    if (result.success) {
      res.json({
        response: result.output,
        sessionId: sandbox.agent_session_id,
        executionTimeMs: result.executionTimeMs
      });
    } else {
      res.status(500).json({
        error: 'Agent execution failed',
        code: 'AGENT_ERROR',
        details: result.error
      });
    }
  } catch (error) {
    console.error('[Sandboxes] Agent chat error:', error);
    res.status(500).json({
      error: 'Failed to chat with agent',
      code: 'CHAT_ERROR'
    });
  } finally {
    db.close();
  }
});

export default router;
