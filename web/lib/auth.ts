/**
 * Auth utilities for Emblem authentication
 */

// Storage keys
const AUTH_TOKEN_KEY = 'emblem_auth_token';
const VAULT_ID_KEY = 'emblem_vault_id';

/**
 * Get the stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Set the auth token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Get the stored vault ID
 */
export function getVaultId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VAULT_ID_KEY);
}

/**
 * Set the vault ID
 */
export function setVaultId(vaultId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VAULT_ID_KEY, vaultId);
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(VAULT_ID_KEY);
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const vaultId = getVaultId();
  if (vaultId) {
    headers['X-Vault-Id'] = vaultId;
  }

  return headers;
}

/**
 * Check if user is authenticated (has token or vault ID)
 */
export function isAuthenticated(): boolean {
  return !!(getAuthToken() || getVaultId());
}
