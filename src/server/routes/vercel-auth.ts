/**
 * Vercel OAuth Authentication Routes
 *
 * Provides endpoints for OAuth-based Vercel integration:
 * - GET /url - Get Vercel OAuth authorization URL
 * - GET /callback - OAuth callback handler
 * - DELETE /disconnect - Revoke Vercel connection
 * - GET /status - Check connection status
 *
 * Tokens are encrypted at rest using AES-256-GCM.
 */

import { Router, Request, Response } from 'express';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getVaultIdFromRequest } from '../middleware/emblem-auth.js';
import Database from 'better-sqlite3';
import { DATABASE_CONFIG } from '../../config/database.js';

const router = Router();

// Vercel OAuth configuration
const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID || '';
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET || '';
const VERCEL_OAUTH_URL = 'https://vercel.com/oauth/authorize';
const VERCEL_TOKEN_URL = 'https://api.vercel.com/oauth/access_token';
const VERCEL_API_URL = 'https://api.vercel.com';

// Token encryption key (32 bytes for AES-256)
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';

// OAuth scopes needed for sandbox operations
const REQUIRED_SCOPES = [
  'user:read',
  'team:read',
  'sandbox:create',
  'sandbox:manage'
];

// Pending OAuth states (in production, use Redis or database)
const pendingOAuthStates = new Map<string, { vaultId: string; expiresAt: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingOAuthStates.entries()) {
    if (data.expiresAt < now) {
      pendingOAuthStates.delete(state);
    }
  }
}, 60000); // Every minute

/**
 * Encrypt a token using AES-256-GCM
 */
function encryptToken(token: string): string {
  if (!TOKEN_ENCRYPTION_KEY) {
    console.warn('[VercelAuth] TOKEN_ENCRYPTION_KEY not set, storing token in plain text');
    return `plain:${token}`;
  }

  // Ensure key is 32 bytes
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token
 */
function decryptToken(encryptedToken: string): string {
  if (encryptedToken.startsWith('plain:')) {
    return encryptedToken.slice(6);
  }

  if (!encryptedToken.startsWith('enc:')) {
    throw new Error('Invalid token format');
  }

  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set');
  }

  const parts = encryptedToken.slice(4).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = Buffer.from(TOKEN_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get database instance
 */
function getDb(): Database.Database {
  return new Database(DATABASE_CONFIG.path);
}

/**
 * Vercel connection interface
 */
interface VercelConnection {
  id: string;
  vault_id: string;
  vercel_user_id: string;
  vercel_team_id: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string;
  connection_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /url - Get Vercel OAuth authorization URL
 *
 * Returns a URL that the frontend should redirect the user to for OAuth authorization.
 */
router.get('/url', (req: Request, res: Response) => {
  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const redirectUri = req.query.redirect_uri as string || `${req.protocol}://${req.get('host')}/api/vercel/auth/callback`;

    if (!VERCEL_CLIENT_ID) {
      res.status(503).json({
        error: 'Vercel integration not configured',
        code: 'VERCEL_NOT_CONFIGURED'
      });
      return;
    }

    // Generate unique state for CSRF protection
    const state = randomBytes(32).toString('hex');
    pendingOAuthStates.set(state, {
      vaultId,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: VERCEL_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: REQUIRED_SCOPES.join(','),
      state,
      response_type: 'code'
    });

    const url = `${VERCEL_OAUTH_URL}?${params.toString()}`;

    res.json({
      url,
      state,
      expiresIn: 600, // 10 minutes
      scopes: REQUIRED_SCOPES
    });
  } catch (error) {
    console.error('[VercelAuth] Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /callback - OAuth callback handler
 *
 * Handles the OAuth callback from Vercel, exchanges code for tokens,
 * and stores the connection.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('[VercelAuth] OAuth error:', error, error_description);
      res.status(400).json({
        error: error_description || error,
        code: 'OAUTH_ERROR'
      });
      return;
    }

    // Validate state
    if (!state || typeof state !== 'string') {
      res.status(400).json({
        error: 'Missing state parameter',
        code: 'MISSING_STATE'
      });
      return;
    }

    const stateData = pendingOAuthStates.get(state);
    if (!stateData) {
      res.status(400).json({
        error: 'Invalid or expired state',
        code: 'INVALID_STATE'
      });
      return;
    }

    // Clean up used state
    pendingOAuthStates.delete(state);

    // Check expiration
    if (stateData.expiresAt < Date.now()) {
      res.status(400).json({
        error: 'State expired',
        code: 'STATE_EXPIRED'
      });
      return;
    }

    const vaultId = stateData.vaultId;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: 'Missing authorization code',
        code: 'MISSING_CODE'
      });
      return;
    }

    if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
      res.status(503).json({
        error: 'Vercel integration not configured',
        code: 'VERCEL_NOT_CONFIGURED'
      });
      return;
    }

    // Exchange code for tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/api/vercel/auth/callback`;

    const tokenResponse = await fetch(VERCEL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: VERCEL_CLIENT_ID,
        client_secret: VERCEL_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[VercelAuth] Token exchange failed:', errorData);
      res.status(400).json({
        error: 'Failed to exchange authorization code',
        code: 'TOKEN_EXCHANGE_FAILED'
      });
      return;
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      team_id?: string;
      user_id?: string;
    };

    // Get user info if not in token response
    let vercelUserId = tokenData.user_id;
    if (!vercelUserId) {
      const userResponse = await fetch(`${VERCEL_API_URL}/v2/user`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json() as { user: { id: string } };
        vercelUserId = userData.user?.id;
      }
    }

    if (!vercelUserId) {
      res.status(400).json({
        error: 'Could not determine Vercel user ID',
        code: 'USER_ID_ERROR'
      });
      return;
    }

    // Calculate token expiration
    let tokenExpiresAt: string | null = null;
    if (tokenData.expires_in) {
      tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    }

    // Store or update the connection
    const connectionId = uuidv4();
    const now = new Date().toISOString();

    // Check for existing connection
    const existingConnection = db.prepare(`
      SELECT id FROM vercel_connections
      WHERE vault_id = ? AND vercel_user_id = ?
    `).get(vaultId, vercelUserId) as { id: string } | undefined;

    if (existingConnection) {
      // Update existing connection
      db.prepare(`
        UPDATE vercel_connections
        SET access_token = ?,
            refresh_token = ?,
            token_expires_at = ?,
            scopes = ?,
            vercel_team_id = ?,
            connection_status = 'active',
            updated_at = ?
        WHERE id = ?
      `).run(
        encryptToken(tokenData.access_token),
        tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        tokenExpiresAt,
        JSON.stringify(REQUIRED_SCOPES),
        tokenData.team_id || null,
        now,
        existingConnection.id
      );
    } else {
      // Create new connection
      db.prepare(`
        INSERT INTO vercel_connections (
          id, vault_id, vercel_user_id, vercel_team_id,
          access_token, refresh_token, token_expires_at,
          scopes, connection_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(
        connectionId,
        vaultId,
        vercelUserId,
        tokenData.team_id || null,
        encryptToken(tokenData.access_token),
        tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        tokenExpiresAt,
        JSON.stringify(REQUIRED_SCOPES),
        now,
        now
      );
    }

    console.log(`[VercelAuth] Successfully connected Vercel account for vault ${vaultId}`);

    // Redirect to success page or return JSON
    const successUrl = req.query.success_url as string;
    if (successUrl) {
      res.redirect(successUrl);
    } else {
      res.json({
        success: true,
        vercelUserId,
        teamId: tokenData.team_id || null,
        scopes: REQUIRED_SCOPES
      });
    }
  } catch (error) {
    console.error('[VercelAuth] Callback error:', error);
    res.status(500).json({
      error: 'Failed to complete OAuth flow',
      code: 'CALLBACK_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * DELETE /disconnect - Revoke Vercel connection
 *
 * Disconnects the user's Vercel account and revokes tokens.
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');
    const { connectionId } = req.body;

    // Find the connection
    let connection: VercelConnection | undefined;

    if (connectionId) {
      connection = db.prepare(`
        SELECT * FROM vercel_connections
        WHERE id = ? AND vault_id = ?
      `).get(connectionId, vaultId) as VercelConnection | undefined;
    } else {
      // Get the most recent active connection
      connection = db.prepare(`
        SELECT * FROM vercel_connections
        WHERE vault_id = ? AND connection_status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(vaultId) as VercelConnection | undefined;
    }

    if (!connection) {
      res.status(404).json({
        error: 'No active Vercel connection found',
        code: 'CONNECTION_NOT_FOUND'
      });
      return;
    }

    // Try to revoke the token with Vercel (best effort)
    try {
      const accessToken = decryptToken(connection.access_token);
      await fetch(`${VERCEL_API_URL}/v1/oauth/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${accessToken}`
        },
        body: new URLSearchParams({
          token: accessToken
        })
      });
    } catch (revokeError) {
      console.warn('[VercelAuth] Failed to revoke token with Vercel:', revokeError);
      // Continue anyway - we'll mark as disconnected
    }

    // Update connection status
    db.prepare(`
      UPDATE vercel_connections
      SET connection_status = 'disconnected',
          access_token = '',
          refresh_token = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), connection.id);

    console.log(`[VercelAuth] Disconnected Vercel account for vault ${vaultId}`);

    res.json({
      success: true,
      disconnectedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[VercelAuth] Disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect Vercel account',
      code: 'DISCONNECT_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * GET /status - Check connection status
 *
 * Returns the status of the user's Vercel connection(s).
 */
router.get('/status', async (req: Request, res: Response) => {
  const db = getDb();

  try {
    const vaultId = getVaultIdFromRequest(req, 'default');

    // Get all connections for this vault
    const connections = db.prepare(`
      SELECT id, vercel_user_id, vercel_team_id, scopes,
             connection_status, token_expires_at, created_at, updated_at
      FROM vercel_connections
      WHERE vault_id = ?
      ORDER BY updated_at DESC
    `).all(vaultId) as Array<{
      id: string;
      vercel_user_id: string;
      vercel_team_id: string | null;
      scopes: string;
      connection_status: string;
      token_expires_at: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const activeConnection = connections.find(c => c.connection_status === 'active');

    // Check if token is expired
    let isExpired = false;
    if (activeConnection?.token_expires_at) {
      isExpired = new Date(activeConnection.token_expires_at) < new Date();
    }

    res.json({
      connected: !!activeConnection && !isExpired,
      activeConnection: activeConnection ? {
        id: activeConnection.id,
        vercelUserId: activeConnection.vercel_user_id,
        teamId: activeConnection.vercel_team_id,
        scopes: JSON.parse(activeConnection.scopes || '[]'),
        status: activeConnection.connection_status,
        tokenExpired: isExpired,
        tokenExpiresAt: activeConnection.token_expires_at,
        createdAt: activeConnection.created_at,
        updatedAt: activeConnection.updated_at
      } : null,
      connectionHistory: connections.map(c => ({
        id: c.id,
        status: c.connection_status,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
    });
  } catch (error) {
    console.error('[VercelAuth] Status check error:', error);
    res.status(500).json({
      error: 'Failed to check connection status',
      code: 'STATUS_ERROR'
    });
  } finally {
    db.close();
  }
});

/**
 * Get the decrypted access token for a vault (internal use)
 */
export async function getVercelAccessToken(vaultId: string): Promise<string | null> {
  const db = getDb();

  try {
    const connection = db.prepare(`
      SELECT access_token, token_expires_at
      FROM vercel_connections
      WHERE vault_id = ? AND connection_status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(vaultId) as { access_token: string; token_expires_at: string | null } | undefined;

    if (!connection) {
      return null;
    }

    // Check expiration
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      console.warn(`[VercelAuth] Token expired for vault ${vaultId}`);
      return null;
    }

    return decryptToken(connection.access_token);
  } catch (error) {
    console.error('[VercelAuth] Error getting access token:', error);
    return null;
  } finally {
    db.close();
  }
}

/**
 * Get connection ID for a vault
 */
export async function getVercelConnectionId(vaultId: string): Promise<string | null> {
  const db = getDb();

  try {
    const connection = db.prepare(`
      SELECT id FROM vercel_connections
      WHERE vault_id = ? AND connection_status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(vaultId) as { id: string } | undefined;

    return connection?.id || null;
  } finally {
    db.close();
  }
}

export default router;
