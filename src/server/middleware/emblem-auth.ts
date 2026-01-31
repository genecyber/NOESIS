/**
 * Emblem Auth Middleware for Multitenancy
 *
 * Provides flexible authentication supporting:
 * - Dev mode: Extract vaultId from X-Vault-Id header or use 'dev-vault' default
 * - Production: Validate Bearer tokens via JWT verification and Emblem API
 *
 * This middleware complements the existing auth.ts by providing
 * permission-based access control and flexible dev/prod modes.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

// Re-export error types for instanceof checks (CommonJS interop)
const { TokenExpiredError, JsonWebTokenError } = jwt;

// Emblem user interface
export interface EmblemUser {
  vaultId: string;
  userId: string;
  email?: string;
  permissions: string[];
}

// JWT claims structure from Emblem tokens
interface EmblemJwtClaims extends JwtPayload {
  vault_id?: string;
  vaultId?: string;
  user_id?: string;
  userId?: string;
  email?: string;
  permissions?: string[];
  scope?: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: EmblemUser;
    }
  }
}

// Environment configuration
const EMBLEM_DEV_MODE = process.env.EMBLEM_DEV_MODE === 'true';
const EMBLEM_JWT_SECRET = process.env.EMBLEM_JWT_SECRET || '';
const EMBLEM_API_URL = process.env.EMBLEM_API_URL || 'https://api.emblemvault.ai';
const DEV_VAULT_ID = 'dev-vault';
const DEV_USER_ID = 'dev-user';

/**
 * Validate an Emblem token
 *
 * In dev mode (EMBLEM_DEV_MODE=true):
 * - Returns a mock user with 'dev-vault' vaultId and full permissions
 *
 * In production:
 * - Verifies JWT signature if EMBLEM_JWT_SECRET is set
 * - Falls back to Emblem API verification if no secret is configured
 * - Extracts vaultId and permissions from verified claims
 *
 * @param token - Bearer token string (without 'Bearer ' prefix)
 * @returns EmblemUser if valid, null if invalid
 */
export async function validateEmblemToken(token: string): Promise<EmblemUser | null> {
  // Dev mode - return mock user for any token
  if (EMBLEM_DEV_MODE) {
    console.log('[EmblemAuth] Dev mode: returning mock user');
    return {
      vaultId: DEV_VAULT_ID,
      userId: DEV_USER_ID,
      email: 'dev@localhost',
      permissions: ['read', 'write', 'admin']
    };
  }

  // Production mode - verify JWT
  try {
    // Try local JWT verification first if secret is configured
    if (EMBLEM_JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, EMBLEM_JWT_SECRET) as EmblemJwtClaims;

        // Extract vaultId (support both snake_case and camelCase)
        const vaultId = decoded.vault_id || decoded.vaultId;
        if (!vaultId) {
          console.warn('[EmblemAuth] Token missing vaultId claim');
          return null;
        }

        // Extract userId
        const userId = decoded.user_id || decoded.userId || decoded.sub || '';

        // Extract permissions (from explicit array or scope string)
        let permissions: string[] = [];
        if (Array.isArray(decoded.permissions)) {
          permissions = decoded.permissions;
        } else if (typeof decoded.scope === 'string') {
          permissions = decoded.scope.split(' ').filter(Boolean);
        }

        return {
          vaultId,
          userId,
          email: decoded.email,
          permissions
        };
      } catch (jwtError) {
        if (jwtError instanceof TokenExpiredError) {
          console.warn('[EmblemAuth] Token expired');
          return null;
        }
        if (jwtError instanceof JsonWebTokenError) {
          console.warn('[EmblemAuth] Invalid JWT signature, falling back to API verification');
          // Fall through to API verification
        } else {
          throw jwtError;
        }
      }
    }

    // Fallback: Verify via Emblem API
    const response = await fetch(`${EMBLEM_API_URL}/vault/info`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('[EmblemAuth] API token validation failed:', response.status);
      return null;
    }

    const vaultInfo = await response.json() as {
      vaultId: string;
      userId?: string;
      email?: string;
      permissions?: string[];
    };

    if (!vaultInfo.vaultId) {
      console.warn('[EmblemAuth] No vaultId in API response');
      return null;
    }

    return {
      vaultId: vaultInfo.vaultId,
      userId: vaultInfo.userId || '',
      email: vaultInfo.email,
      permissions: vaultInfo.permissions || []
    };
  } catch (error) {
    // Log error without leaking sensitive details
    console.error('[EmblemAuth] Token validation error');
    return null;
  }
}

/**
 * Authentication options for requireAuth middleware
 */
interface RequireAuthOptions {
  /** Required permissions - user must have ALL listed permissions */
  permissions?: string[];
}

/**
 * Middleware factory for required authentication
 *
 * In dev mode (EMBLEM_DEV_MODE=true):
 * - Uses X-Vault-Id header if present, otherwise defaults to 'dev-vault'
 * - Bypasses token validation entirely
 *
 * In production:
 * - Extracts and validates Bearer token from Authorization header
 * - Sets req.user with validated EmblemUser
 * - Returns 401 if token is missing or invalid
 * - Returns 403 if user lacks required permissions
 *
 * @param options - Configuration options including required permissions
 * @returns Express middleware function
 *
 * @example
 * // Require authentication only
 * app.get('/api/profile', requireAuth(), handler);
 *
 * @example
 * // Require specific permissions
 * app.post('/api/admin/users', requireAuth({ permissions: ['admin'] }), handler);
 */
export function requireAuth(options?: RequireAuthOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Dev mode bypass
    if (EMBLEM_DEV_MODE) {
      const vaultId = req.headers['x-vault-id'] as string || DEV_VAULT_ID;
      req.user = {
        vaultId,
        userId: DEV_USER_ID,
        email: 'dev@localhost',
        permissions: ['read', 'write', 'admin']
      };
      console.log(`[EmblemAuth] Dev mode: authenticated as vault ${vaultId}`);
      next();
      return;
    }

    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token
    const user = await validateEmblemToken(token);

    if (!user) {
      res.status(401).json({
        error: 'Authentication failed',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    // Check permissions if required
    if (options?.permissions && options.permissions.length > 0) {
      const hasAllPermissions = options.permissions.every(
        permission => user.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN'
        });
        return;
      }
    }

    // Attach user to request
    req.user = user;
    console.log(`[EmblemAuth] Authenticated vault: ${user.vaultId}`);

    next();
  };
}

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate but allows unauthenticated requests to proceed.
 * Useful for endpoints that work both anonymously and authenticated,
 * providing enhanced features for authenticated users.
 *
 * In dev mode:
 * - Uses X-Vault-Id header if present, otherwise defaults to 'dev-vault'
 *
 * In production:
 * - Validates token if Authorization header is present
 * - Sets req.user if validation succeeds, undefined otherwise
 * - Never fails - always calls next()
 *
 * @returns Express middleware function
 *
 * @example
 * app.get('/api/content', optionalAuth(), (req, res) => {
 *   if (req.user) {
 *     // Return personalized content
 *   } else {
 *     // Return public content
 *   }
 * });
 */
export function optionalAuth() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Dev mode - always set user
    if (EMBLEM_DEV_MODE) {
      const vaultId = req.headers['x-vault-id'] as string || DEV_VAULT_ID;
      req.user = {
        vaultId,
        userId: DEV_USER_ID,
        email: 'dev@localhost',
        permissions: ['read', 'write', 'admin']
      };
      next();
      return;
    }

    // Try to extract and validate token
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await validateEmblemToken(token);

      if (user) {
        req.user = user;
        console.log(`[EmblemAuth] Optional auth succeeded for vault: ${user.vaultId}`);
      } else {
        console.log('[EmblemAuth] Optional auth token invalid, proceeding anonymously');
      }
    }

    // Always proceed (optional auth never fails)
    next();
  };
}

/**
 * Check if the current request has a specific permission
 * Helper for use within route handlers after authentication
 *
 * @param req - Express request with optional user
 * @param permission - Permission to check
 * @returns true if user has the permission
 */
export function hasPermission(req: Request, permission: string): boolean {
  return req.user?.permissions?.includes(permission) ?? false;
}

/**
 * Get vaultId from request with safe fallback
 *
 * @param req - Express request
 * @param fallback - Value to return if no vaultId (default: 'anonymous')
 * @returns vaultId from user or fallback value
 */
export function getVaultIdFromRequest(req: Request, fallback: string = 'anonymous'): string {
  return req.user?.vaultId ?? fallback;
}
