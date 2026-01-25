/**
 * Emblem Vault Authentication Middleware
 *
 * Validates JWT tokens against Emblem Vault API and extracts vault context.
 * Supports both required and optional authentication modes for backward compatibility.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Context extracted from a validated Emblem Vault JWT
 */
export interface VaultContext {
  vaultId: string;           // Primary user identifier (partition key)
  evmAddress?: string;       // Ethereum address (if wallet auth)
  solanaAddress?: string;    // Solana address (if wallet auth)
  verified: boolean;         // Token verification status
  verifiedAt: Date;          // Timestamp of verification
}

/**
 * Extended Express Request with vault context
 */
export interface AuthenticatedRequest extends Request {
  vault: VaultContext;
}

/**
 * Check if multitenancy is enabled
 */
export function isMultitenancyEnabled(): boolean {
  return process.env.ENABLE_MULTITENANCY === 'true';
}

/**
 * Get default vault ID for legacy/single-tenant mode
 * Uses 'default-vault' to match the database schema defaults
 */
export function getDefaultVaultId(): string {
  return 'default-vault';
}

/**
 * Get vault ID from request, with fallback to default
 * Use this helper in endpoints to safely extract vaultId
 */
export function getVaultId(req: Request): string {
  if (isMultitenancyEnabled()) {
    const authReq = req as AuthenticatedRequest;
    if (authReq.vault?.vaultId) {
      return authReq.vault.vaultId;
    }
  }
  return getDefaultVaultId();
}

/**
 * Validate JWT token against Emblem Vault API
 */
async function validateToken(token: string): Promise<VaultContext | null> {
  const apiUrl = process.env.EMBLEM_API_URL || 'https://api.emblemvault.ai';

  try {
    const response = await fetch(`${apiUrl}/vault/info`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('[Auth] Token validation failed:', response.status);
      return null;
    }

    const vaultInfo = await response.json() as {
      vaultId: string;
      evmAddress?: string;
      solanaAddress?: string;
    };

    if (!vaultInfo.vaultId) {
      console.warn('[Auth] No vaultId in response');
      return null;
    }

    return {
      vaultId: vaultInfo.vaultId,
      evmAddress: vaultInfo.evmAddress,
      solanaAddress: vaultInfo.solanaAddress,
      verified: true,
      verifiedAt: new Date()
    };
  } catch (error) {
    console.error('[Auth] Token validation error:', error);
    return null;
  }
}

/**
 * Required authentication middleware
 *
 * Validates the Bearer token from Authorization header against Emblem Vault.
 * Returns 401 if token is missing or invalid.
 *
 * Usage:
 *   app.post('/api/protected', emblemAuth, (req, res) => {
 *     const vaultId = (req as AuthenticatedRequest).vault.vaultId;
 *   });
 */
export async function emblemAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth in non-multitenancy mode
  if (!isMultitenancyEnabled()) {
    (req as AuthenticatedRequest).vault = {
      vaultId: getDefaultVaultId(),
      verified: false,
      verifiedAt: new Date()
    };
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing authorization header',
      message: 'Authorization header with Bearer token is required'
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  const vaultContext = await validateToken(token);

  if (!vaultContext) {
    res.status(401).json({
      error: 'Invalid or expired token',
      message: 'The provided token could not be verified'
    });
    return;
  }

  (req as AuthenticatedRequest).vault = vaultContext;

  console.log(`[Auth] Request authenticated for vault: ${vaultContext.vaultId}`);

  next();
}

/**
 * Optional authentication middleware
 *
 * Attempts to validate the Bearer token if present, but allows
 * unauthenticated requests to proceed with default vault.
 *
 * Useful for backward compatibility during migration or for
 * endpoints that work in both authenticated and anonymous modes.
 *
 * Usage:
 *   app.get('/api/public', optionalEmblemAuth, (req, res) => {
 *     const vaultId = getVaultId(req);
 *   });
 */
export async function optionalEmblemAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Always set a default vault context
  (req as AuthenticatedRequest).vault = {
    vaultId: getDefaultVaultId(),
    verified: false,
    verifiedAt: new Date()
  };

  // Skip validation in non-multitenancy mode
  if (!isMultitenancyEnabled()) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // No auth header - proceed with default vault
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  const vaultContext = await validateToken(token);

  if (vaultContext) {
    (req as AuthenticatedRequest).vault = vaultContext;
    console.log(`[Auth] Optional auth succeeded for vault: ${vaultContext.vaultId}`);
  } else {
    console.log('[Auth] Optional auth token invalid, using default vault');
  }

  next();
}

/**
 * WebSocket authentication
 *
 * Validates token from WebSocket upgrade request.
 * Token can be provided via:
 * - Authorization header
 * - Query parameter: ?token=xxx
 *
 * Returns null if authentication fails (in multitenancy mode).
 */
export async function authenticateWebSocket(
  req: Request
): Promise<VaultContext | null> {
  // Non-multitenancy mode - return default vault
  if (!isMultitenancyEnabled()) {
    return {
      vaultId: getDefaultVaultId(),
      verified: false,
      verifiedAt: new Date()
    };
  }

  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const context = await validateToken(token);
    if (context) return context;
  }

  // Try query parameter
  const urlToken = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('token');
  if (urlToken) {
    const context = await validateToken(urlToken);
    if (context) return context;
  }

  // Authentication failed
  return null;
}

/**
 * Create middleware that requires specific vault permission
 * (Reserved for future role-based access control)
 */
export function requirePermission(_permission: string) {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.vault?.verified) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // TODO: Implement permission checking when roles are added
    // For now, any authenticated user has all permissions

    next();
  };
}
