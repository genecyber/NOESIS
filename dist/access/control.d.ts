/**
 * Stance-Based Access Control
 *
 * Permission management for stance fields with role-based access,
 * field-level locking, and audit logging.
 */
import type { Stance } from '../types/index.js';
export interface AccessPermission {
    userId: string;
    level: PermissionLevel;
    fields: FieldPermission[];
    grantedBy: string;
    grantedAt: Date;
    expiresAt?: Date;
}
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin' | 'owner';
export interface FieldPermission {
    field: string;
    read: boolean;
    write: boolean;
    lock: boolean;
}
export interface StanceSpace {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    stance: Stance;
    permissions: AccessPermission[];
    locks: FieldLock[];
    auditLog: AuditEntry[];
    createdAt: Date;
    updatedAt: Date;
}
export interface FieldLock {
    field: string;
    lockedBy: string;
    lockedAt: Date;
    expiresAt?: Date;
    reason?: string;
}
export interface AuditEntry {
    id: string;
    timestamp: Date;
    userId: string;
    action: AuditAction;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
}
export type AuditAction = 'read' | 'write' | 'lock' | 'unlock' | 'grant-permission' | 'revoke-permission' | 'create-space' | 'delete-space' | 'delegate';
export interface AccessResult {
    allowed: boolean;
    reason: string;
    effectiveLevel: PermissionLevel;
    warnings?: string[];
}
export interface DelegationRule {
    fromUserId: string;
    toUserId: string;
    fields: string[];
    maxLevel: PermissionLevel;
    canDelegate: boolean;
    validUntil?: Date;
}
export declare class StanceAccessControl {
    private spaces;
    private delegations;
    private auditEnabled;
    createSpace(name: string, ownerId: string, initialStance?: Partial<Stance>, description?: string): StanceSpace;
    deleteSpace(spaceId: string, userId: string): boolean;
    grantPermission(spaceId: string, grantorId: string, targetUserId: string, level: PermissionLevel, fields?: FieldPermission[]): AccessResult;
    revokePermission(spaceId: string, revokerId: string, targetUserId: string): AccessResult;
    checkAccess(spaceId: string, userId: string, requiredLevel?: PermissionLevel, field?: string): AccessResult;
    private getDelegatedPermission;
    lockField(spaceId: string, userId: string, field: string, reason?: string, duration?: number): AccessResult;
    unlockField(spaceId: string, userId: string, field: string): AccessResult;
    readStance(spaceId: string, userId: string): {
        stance: Stance;
        access: AccessResult;
    } | null;
    writeStanceField(spaceId: string, userId: string, field: string, value: unknown): AccessResult;
    private getFieldValue;
    private setFieldValue;
    delegate(fromUserId: string, toUserId: string, fields: string[], maxLevel: PermissionLevel, canDelegate?: boolean, validUntil?: Date): void;
    revokeDelegation(fromUserId: string, toUserId: string): void;
    getAuditLog(spaceId: string, userId: string): AuditEntry[] | null;
    private logAudit;
    setAuditEnabled(enabled: boolean): void;
    getSpace(spaceId: string): StanceSpace | undefined;
    listSpaces(userId: string): StanceSpace[];
}
export declare function createAccessControl(): StanceAccessControl;
//# sourceMappingURL=control.d.ts.map