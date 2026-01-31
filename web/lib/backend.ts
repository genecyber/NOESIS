/**
 * Backend API utilities
 *
 * Helper functions for making authenticated requests to the backend server.
 * Forwards Authorization header from Next.js API routes to the Express backend.
 */

import { NextRequest } from 'next/server';

/** Backend URL from environment or default */
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Get headers to forward to backend
 * Forwards Authorization header for authentication
 * VaultId is extracted from JWT payload on backend - no X-Vault-Id needed
 */
export function getBackendHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  return headers;
}

/**
 * Make an authenticated request to the backend
 */
export async function backendFetch(
  request: NextRequest,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  const headers = {
    ...getBackendHeaders(request),
    ...(options.headers as Record<string, string> || {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
