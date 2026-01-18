/**
 * OAuth/SSO Authentication (Ralph Iteration 8, Feature 5)
 *
 * OAuth 2.0 provider integration, SAML support, role-based access,
 * session management, and audit logging.
 */
export interface AuthConfig {
    providers: AuthProvider[];
    defaultProvider?: string;
    sessionTimeout: number;
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
export type AuditAction = 'login' | 'logout' | 'refresh_token' | 'permission_check' | 'role_change' | 'session_create' | 'session_invalidate' | 'access_denied' | 'mfa_verify';
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
export declare class OAuthManager {
    private config;
    private state;
    private users;
    private sessions;
    private roles;
    private auditLogs;
    private handlers;
    private stats;
    private sessionCleanupTimer;
    constructor(config?: Partial<AuthConfig>);
    /**
     * Add an OAuth provider
     */
    addProvider(provider: AuthProvider): void;
    /**
     * Get authorization URL for provider
     */
    getAuthorizationUrl(providerId: string, state: string, redirectUri: string): string | null;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCode(providerId: string, code: string, _redirectUri: string): Promise<AuthResult>;
    /**
     * Get user info from provider (mock implementation)
     */
    private getUserInfo;
    /**
     * Create a new user
     */
    private createUser;
    /**
     * Create a session
     */
    private createSession;
    /**
     * Refresh session with refresh token
     */
    refreshSession(sessionId: string): Promise<AuthResult>;
    /**
     * Logout current user
     */
    logout(): void;
    /**
     * Invalidate a session
     */
    invalidateSession(sessionId: string): boolean;
    /**
     * Check if user has permission
     */
    hasPermission(userId: string, resource: string, action: PermissionAction): boolean;
    /**
     * Assign role to user
     */
    assignRole(userId: string, roleId: string): boolean;
    /**
     * Remove role from user
     */
    removeRole(userId: string, roleId: string): boolean;
    /**
     * Log an audit event
     */
    private logAudit;
    /**
     * Get audit logs
     */
    getAuditLogs(filters?: {
        userId?: string;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): AuditLog[];
    /**
     * Start session cleanup timer
     */
    private startSessionCleanup;
    /**
     * Stop session cleanup timer
     */
    private stopSessionCleanup;
    /**
     * Subscribe to auth events
     */
    subscribe(handler: AuthEventHandler): () => void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Get current state
     */
    getState(): AuthState;
    /**
     * Get statistics
     */
    getStats(): AuthStats;
    /**
     * Get user by ID
     */
    getUser(userId: string): User | null;
    /**
     * Get all users
     */
    getUsers(): User[];
    /**
     * Get active sessions
     */
    getActiveSessions(): Session[];
    /**
     * Get available roles
     */
    getRoles(): Role[];
    /**
     * Add custom role
     */
    addRole(role: Role): void;
    /**
     * Get providers
     */
    getProviders(): AuthProvider[];
    /**
     * Export state
     */
    export(): {
        users: User[];
        sessions: Session[];
        roles: Role[];
        auditLogs: AuditLog[];
    };
    /**
     * Import state
     */
    import(data: ReturnType<OAuthManager['export']>): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const oauthManager: OAuthManager;
//# sourceMappingURL=oauth.d.ts.map