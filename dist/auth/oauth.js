/**
 * OAuth/SSO Authentication (Ralph Iteration 8, Feature 5)
 *
 * OAuth 2.0 provider integration, SAML support, role-based access,
 * session management, and audit logging.
 */
// ============================================================================
// Default Roles
// ============================================================================
const DEFAULT_ROLES = [
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
    config;
    state;
    users = new Map();
    sessions = new Map();
    roles = new Map();
    auditLogs = [];
    handlers = new Set();
    stats;
    sessionCleanupTimer = null;
    constructor(config = {}) {
        this.config = {
            providers: [],
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
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
    addProvider(provider) {
        this.config.providers.push(provider);
        if (!this.config.defaultProvider) {
            this.config.defaultProvider = provider.id;
        }
    }
    /**
     * Get authorization URL for provider
     */
    getAuthorizationUrl(providerId, state, redirectUri) {
        const provider = this.config.providers.find(p => p.id === providerId);
        if (!provider || !provider.enabled)
            return null;
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
    async exchangeCode(providerId, code, _redirectUri) {
        const provider = this.config.providers.find(p => p.id === providerId);
        if (!provider || !provider.enabled) {
            this.logAudit('login', undefined, { error: 'Provider not found' }, false);
            return { success: false, error: 'Provider not found or disabled' };
        }
        try {
            // Mock token exchange
            // In a real implementation, this would POST to provider.tokenUrl
            const tokens = {
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
            let user = [...this.users.values()].find(u => u.provider === providerId && u.providerUserId === userInfo.id);
            if (!user) {
                user = this.createUser(userInfo, providerId, code);
            }
            else {
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
        }
        catch (error) {
            this.stats.failedLogins++;
            this.logAudit('login', undefined, { error: String(error) }, false);
            return { success: false, error: 'Authentication failed' };
        }
    }
    /**
     * Get user info from provider (mock implementation)
     */
    async getUserInfo(_provider, _accessToken) {
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
    createUser(userInfo, providerId, _providerUserId) {
        const defaultRole = this.roles.get('user') || DEFAULT_ROLES[1];
        const user = {
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
    createSession(userId, tokens) {
        const session = {
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
    async refreshSession(sessionId) {
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
    logout() {
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
    invalidateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        session.isActive = false;
        this.stats.activeSessions--;
        this.logAudit('session_invalidate', session.userId, { sessionId }, true);
        return true;
    }
    /**
     * Check if user has permission
     */
    hasPermission(userId, resource, action) {
        if (!this.config.rbacEnabled)
            return true;
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
    assignRole(userId, roleId) {
        const user = this.users.get(userId);
        const role = this.roles.get(roleId);
        if (!user || !role)
            return false;
        // Check if already has role
        if (user.roles.some(r => r.id === roleId))
            return true;
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
    removeRole(userId, roleId) {
        const user = this.users.get(userId);
        if (!user)
            return false;
        const roleIndex = user.roles.findIndex(r => r.id === roleId);
        if (roleIndex === -1)
            return false;
        user.roles.splice(roleIndex, 1);
        // Recalculate permissions
        user.permissions = user.roles.flatMap(r => r.permissions);
        this.logAudit('role_change', userId, { action: 'remove', roleId }, true);
        return true;
    }
    /**
     * Log an audit event
     */
    logAudit(action, userId, details, success) {
        if (!this.config.auditLoggingEnabled)
            return;
        const log = {
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
    getAuditLogs(filters) {
        let logs = [...this.auditLogs];
        if (filters?.userId) {
            logs = logs.filter(l => l.userId === filters.userId);
        }
        if (filters?.action) {
            logs = logs.filter(l => l.action === filters.action);
        }
        if (filters?.startDate) {
            logs = logs.filter(l => l.timestamp >= filters.startDate);
        }
        if (filters?.endDate) {
            logs = logs.filter(l => l.timestamp <= filters.endDate);
        }
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return logs.slice(0, filters?.limit || 100);
    }
    /**
     * Start session cleanup timer
     */
    startSessionCleanup() {
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
        }, 60000); // Check every minute
    }
    /**
     * Stop session cleanup timer
     */
    stopSessionCleanup() {
        if (this.sessionCleanupTimer) {
            clearInterval(this.sessionCleanupTimer);
            this.sessionCleanupTimer = null;
        }
    }
    /**
     * Subscribe to auth events
     */
    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    /**
     * Emit event
     */
    emit(event) {
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch {
                // Ignore handler errors
            }
        }
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get user by ID
     */
    getUser(userId) {
        return this.users.get(userId) || null;
    }
    /**
     * Get all users
     */
    getUsers() {
        return [...this.users.values()];
    }
    /**
     * Get active sessions
     */
    getActiveSessions() {
        return [...this.sessions.values()].filter(s => s.isActive);
    }
    /**
     * Get available roles
     */
    getRoles() {
        return [...this.roles.values()];
    }
    /**
     * Add custom role
     */
    addRole(role) {
        this.roles.set(role.id, role);
    }
    /**
     * Get providers
     */
    getProviders() {
        return this.config.providers;
    }
    /**
     * Export state
     */
    export() {
        return {
            users: [...this.users.values()],
            sessions: [...this.sessions.values()],
            roles: [...this.roles.values()],
            auditLogs: this.auditLogs.slice(-1000) // Last 1000 logs
        };
    }
    /**
     * Import state
     */
    import(data) {
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
    reset() {
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
//# sourceMappingURL=oauth.js.map