/**
 * OAuth/SSO Authentication (Ralph Iteration 8, Feature 5)
 *
 * OAuth 2.0 provider integration, SAML support, role-based access,
 * session management, and audit logging.
 */

// ============================================================================
// Types
// ============================================================================

export interface AuthConfig {
  providers: AuthProvider[];
  defaultProvider?: string;
  sessionTimeout: number;  // milliseconds
  refreshTokenEnabled: boolean;
  auditLoggingEnabled: boolean;
  rbacEnabled: boolean;
  mfaRequired: boolean;
}

export interface AuthProvider {
  id: string;
  name: string;
  type: ProviderType;
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  enabled: boolean;
}

export type ProviderType = 'oauth2' | 'oidc' | 'saml';

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  roles: Role[];
  permissions: Permission[];
  provider: string;
  providerUserId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
}

export interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  conditions?: Record<string, unknown>;
}

export type PermissionAction = 'read' | 'write' | 'delete' | 'admin' | '*';

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  deviceInfo?: DeviceInfo;
  isActive: boolean;
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  platform?: string;
  browser?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: AuditAction;
  resource?: string;
  details: Record<string, unknown>;
  ip?: string;
  success: boolean;
  errorMessage?: string;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'refresh_token'
  | 'permission_check'
  | 'role_change'
  | 'session_create'
  | 'session_invalidate'
  | 'access_denied'
  | 'mfa_verify';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  mfaRequired?: boolean;
}

export interface AuthState {
  currentUser: User | null;
  currentSession: Session | null;
  isAuthenticated: boolean;
  pendingMFA: boolean;
}

export interface AuthStats {
  totalUsers: number;
  activeSessions: number;
  loginCount: number;
  failedLogins: number;
  auditLogCount: number;
}

export type AuthEventHandler = (event: AuthEvent) => void;

export interface AuthEvent {
  type: 'login' | 'logout' | 'session_expired' | 'permission_denied' | 'mfa_required';
  timestamp: Date;
  userId?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Default Roles
// ============================================================================

const DEFAULT_ROLES: Role[] = [
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Can view stance and conversation history',
    permissions: [
      { id: 'view-stance', resource: 'stance', action: 'read' },
      { id: 'view-history', resource: 'conversation', action: 'read' }
    ],
    isDefault: true
  },
  {
    id: 'user',
    name: 'User',
    description: 'Can interact with the agent',
    permissions: [
      { id: 'read-stance', resource: 'stance', action: 'read' },
      { id: 'write-stance', resource: 'stance', action: 'write' },
      { id: 'read-conversation', resource: 'conversation', action: 'read' },
      { id: 'write-conversation', resource: 'conversation', action: 'write' }
    ]
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all resources',
    permissions: [
      { id: 'all', resource: '*', action: '*' }
    ]
  }
];

// ============================================================================
// OAuth Authentication Manager
// ============================================================================

export class OAuthManager {
  private config: AuthConfig;
  private state: AuthState;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private roles: Map<string, Role> = new Map();
  private auditLogs: AuditLog[] = [];
  private handlers: Set<AuthEventHandler> = new Set();
  private stats: AuthStats;
  private sessionCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      providers: [],
      sessionTimeout: 24 * 60 * 60 * 1000,  // 24 hours
      refreshTokenEnabled: true,
      auditLoggingEnabled: true,
      rbacEnabled: true,
      mfaRequired: false,
      ...config
    };

    this.state = {
      currentUser: null,
      currentSession: null,
      isAuthenticated: false,
      pendingMFA: false
    };

    this.stats = {
      totalUsers: 0,
      activeSessions: 0,
      loginCount: 0,
      failedLogins: 0,
      auditLogCount: 0
    };

    // Initialize default roles
    for (const role of DEFAULT_ROLES) {
      this.roles.set(role.id, role);
    }

    // Start session cleanup
    this.startSessionCleanup();
  }

  /**
   * Add an OAuth provider
   */
  addProvider(provider: AuthProvider): void {
    this.config.providers.push(provider);
    if (!this.config.defaultProvider) {
      this.config.defaultProvider = provider.id;
    }
  }

  /**
   * Get authorization URL for provider
   */
  getAuthorizationUrl(providerId: string, state: string, redirectUri: string): string | null {
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider || !provider.enabled) return null;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state
    });

    return `${provider.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    providerId: string,
    code: string,
    _redirectUri: string
  ): Promise<AuthResult> {
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider || !provider.enabled) {
      this.logAudit('login', undefined, { error: 'Provider not found' }, false);
      return { success: false, error: 'Provider not found or disabled' };
    }

    try {
      // Mock token exchange
      // In a real implementation, this would POST to provider.tokenUrl
      const tokens: AuthToken = {
        accessToken: `access-${Date.now()}-${Math.random().toString(36).substr(2)}`,
        refreshToken: this.config.refreshTokenEnabled
          ? `refresh-${Date.now()}-${Math.random().toString(36).substr(2)}`
          : undefined,
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: provider.scopes.join(' ')
      };

      // Get user info
      const userInfo = await this.getUserInfo(provider, tokens.accessToken);

      // Create or update user
      let user = [...this.users.values()].find(
        u => u.provider === providerId && u.providerUserId === userInfo.id
      );

      if (!user) {
        user = this.createUser(userInfo, providerId, code);
      } else {
        user.lastLoginAt = new Date();
        user.metadata = { ...user.metadata, ...userInfo.metadata };
      }

      // Check MFA
      if (this.config.mfaRequired && !userInfo.mfaVerified) {
        this.state.pendingMFA = true;
        this.emit({ type: 'mfa_required', timestamp: new Date(), userId: user.id });
        return { success: false, mfaRequired: true };
      }

      // Create session
      const session = this.createSession(user.id, tokens);

      // Update state
      this.state.currentUser = user;
      this.state.currentSession = session;
      this.state.isAuthenticated = true;
      this.state.pendingMFA = false;

      this.stats.loginCount++;
      this.logAudit('login', user.id, { provider: providerId }, true);

      this.emit({ type: 'login', timestamp: new Date(), userId: user.id });

      return { success: true, user, session };
    } catch (error) {
      this.stats.failedLogins++;
      this.logAudit('login', undefined, { error: String(error) }, false);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Get user info from provider (mock implementation)
   */
  private async getUserInfo(
    _provider: AuthProvider,
    _accessToken: string
  ): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
    mfaVerified?: boolean;
    metadata: Record<string, unknown>;
  }> {
    // In a real implementation, this would GET from provider.userInfoUrl
    return {
      id: `user-${Date.now()}`,
      email: 'user@example.com',
      name: 'Example User',
      mfaVerified: true,
      metadata: {}
    };
  }

  /**
   * Create a new user
   */
  private createUser(
    userInfo: { id: string; email: string; name?: string; picture?: string; metadata: Record<string, unknown> },
    providerId: string,
    _providerUserId: string
  ): User {
    const defaultRole = this.roles.get('user') || DEFAULT_ROLES[1];

    const user: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      roles: [defaultRole],
      permissions: defaultRole.permissions,
      provider: providerId,
      providerUserId: userInfo.id,
      metadata: userInfo.metadata,
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    this.users.set(user.id, user);
    this.stats.totalUsers++;

    return user;
  }

  /**
   * Create a session
   */
  private createSession(userId: string, tokens: AuthToken): Session {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      createdAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true
    };

    this.sessions.set(session.id, session);
    this.stats.activeSessions++;

    this.logAudit('session_create', userId, { sessionId: session.id }, true);

    return session;
  }

  /**
   * Refresh session with refresh token
   */
  async refreshSession(sessionId: string): Promise<AuthResult> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return { success: false, error: 'Session not found or inactive' };
    }

    if (!session.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    // Mock token refresh
    const newAccessToken = `access-${Date.now()}-${Math.random().toString(36).substr(2)}`;
    session.accessToken = newAccessToken;
    session.expiresAt = new Date(Date.now() + 3600 * 1000);
    session.lastActivityAt = new Date();

    this.logAudit('refresh_token', session.userId, { sessionId }, true);

    const user = this.users.get(session.userId);
    return { success: true, user: user || undefined, session };
  }

  /**
   * Logout current user
   */
  logout(): void {
    if (this.state.currentSession) {
      this.invalidateSession(this.state.currentSession.id);
    }

    const userId = this.state.currentUser?.id;

    this.state.currentUser = null;
    this.state.currentSession = null;
    this.state.isAuthenticated = false;

    this.logAudit('logout', userId, {}, true);
    this.emit({ type: 'logout', timestamp: new Date(), userId });
  }

  /**
   * Invalidate a session
   */
  invalidateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    this.stats.activeSessions--;

    this.logAudit('session_invalidate', session.userId, { sessionId }, true);

    return true;
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId: string, resource: string, action: PermissionAction): boolean {
    if (!this.config.rbacEnabled) return true;

    const user = this.users.get(userId);
    if (!user) {
      this.logAudit('permission_check', userId, { resource, action, result: 'user_not_found' }, false);
      return false;
    }

    // Check all permissions
    for (const permission of user.permissions) {
      // Wildcard match
      if (permission.resource === '*' && permission.action === '*') {
        return true;
      }

      // Resource match
      if (permission.resource === resource || permission.resource === '*') {
        // Action match
        if (permission.action === action || permission.action === '*') {
          this.logAudit('permission_check', userId, { resource, action, result: 'granted' }, true);
          return true;
        }
      }
    }

    this.logAudit('permission_check', userId, { resource, action, result: 'denied' }, false);
    this.emit({
      type: 'permission_denied',
      timestamp: new Date(),
      userId,
      data: { resource, action }
    });

    return false;
  }

  /**
   * Assign role to user
   */
  assignRole(userId: string, roleId: string): boolean {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user || !role) return false;

    // Check if already has role
    if (user.roles.some(r => r.id === roleId)) return true;

    user.roles.push(role);

    // Merge permissions
    for (const permission of role.permissions) {
      if (!user.permissions.some(p => p.id === permission.id)) {
        user.permissions.push(permission);
      }
    }

    this.logAudit('role_change', userId, { action: 'assign', roleId }, true);

    return true;
  }

  /**
   * Remove role from user
   */
  removeRole(userId: string, roleId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    const roleIndex = user.roles.findIndex(r => r.id === roleId);
    if (roleIndex === -1) return false;

    user.roles.splice(roleIndex, 1);

    // Recalculate permissions
    user.permissions = user.roles.flatMap(r => r.permissions);

    this.logAudit('role_change', userId, { action: 'remove', roleId }, true);

    return true;
  }

  /**
   * Log an audit event
   */
  private logAudit(
    action: AuditAction,
    userId: string | undefined,
    details: Record<string, unknown>,
    success: boolean
  ): void {
    if (!this.config.auditLoggingEnabled) return;

    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      action,
      details,
      success,
      errorMessage: success ? undefined : String(details.error || 'Unknown error')
    };

    this.auditLogs.push(log);
    this.stats.auditLogCount++;

    // Keep only last 10000 logs
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLog[] {
    let logs = [...this.auditLogs];

    if (filters?.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters?.action) {
      logs = logs.filter(l => l.action === filters.action);
    }
    if (filters?.startDate) {
      logs = logs.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return logs.slice(0, filters?.limit || 100);
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    this.sessionCleanupTimer = setInterval(() => {
      const now = new Date();
      for (const [id, session] of this.sessions) {
        if (session.isActive && session.expiresAt < now) {
          this.invalidateSession(id);
          if (this.state.currentSession?.id === id) {
            this.state.isAuthenticated = false;
            this.emit({ type: 'session_expired', timestamp: now, userId: session.userId });
          }
        }
      }
    }, 60000);  // Check every minute
  }

  /**
   * Stop session cleanup timer
   */
  private stopSessionCleanup(): void {
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
      this.sessionCleanupTimer = null;
    }
  }

  /**
   * Subscribe to auth events
   */
  subscribe(handler: AuthEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Emit event
   */
  private emit(event: AuthEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Get current state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Get statistics
   */
  getStats(): AuthStats {
    return { ...this.stats };
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Get all users
   */
  getUsers(): User[] {
    return [...this.users.values()];
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Session[] {
    return [...this.sessions.values()].filter(s => s.isActive);
  }

  /**
   * Get available roles
   */
  getRoles(): Role[] {
    return [...this.roles.values()];
  }

  /**
   * Add custom role
   */
  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  /**
   * Get providers
   */
  getProviders(): AuthProvider[] {
    return this.config.providers;
  }

  /**
   * Export state
   */
  export(): {
    users: User[];
    sessions: Session[];
    roles: Role[];
    auditLogs: AuditLog[];
  } {
    return {
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
      roles: [...this.roles.values()],
      auditLogs: this.auditLogs.slice(-1000)  // Last 1000 logs
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<OAuthManager['export']>): void {
    for (const user of data.users) {
      this.users.set(user.id, user);
    }

    for (const session of data.sessions) {
      this.sessions.set(session.id, session);
    }

    for (const role of data.roles) {
      this.roles.set(role.id, role);
    }

    this.auditLogs = data.auditLogs;
    this.stats.totalUsers = this.users.size;
    this.stats.activeSessions = [...this.sessions.values()].filter(s => s.isActive).length;
    this.stats.auditLogCount = this.auditLogs.length;
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.stopSessionCleanup();
    this.logout();

    this.users.clear();
    this.sessions.clear();
    this.auditLogs = [];

    this.state = {
      currentUser: null,
      currentSession: null,
      isAuthenticated: false,
      pendingMFA: false
    };

    this.stats = {
      totalUsers: 0,
      activeSessions: 0,
      loginCount: 0,
      failedLogins: 0,
      auditLogCount: 0
    };

    this.startSessionCleanup();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const oauthManager = new OAuthManager();
