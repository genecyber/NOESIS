/**
 * Stance-Based Access Control
 *
 * Permission management for stance fields with role-based access,
 * field-level locking, and audit logging.
 */

import type { Stance, Values } from '../types/index.js';

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

export type AuditAction =
  | 'read'
  | 'write'
  | 'lock'
  | 'unlock'
  | 'grant-permission'
  | 'revoke-permission'
  | 'create-space'
  | 'delete-space'
  | 'delegate';

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

function createDefaultValues(): Values {
  return {
    curiosity: 50, certainty: 50, risk: 50,
    novelty: 50, empathy: 50, provocation: 50, synthesis: 50
  };
}

function createDefaultSentience() {
  return {
    awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
    emergentGoals: [] as string[],
    consciousnessInsights: [] as string[],
    persistentValues: [] as string[]
  };
}

function createStanceMetadata() {
  return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  'none': 0,
  'read': 1,
  'write': 2,
  'admin': 3,
  'owner': 4
};

export class StanceAccessControl {
  private spaces: Map<string, StanceSpace> = new Map();
  private delegations: Map<string, DelegationRule[]> = new Map();
  private auditEnabled: boolean = true;

  createSpace(
    name: string,
    ownerId: string,
    initialStance?: Partial<Stance>,
    description?: string
  ): StanceSpace {
    const id = `space-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const stance: Stance = {
      frame: initialStance?.frame || 'pragmatic',
      values: initialStance?.values || createDefaultValues(),
      selfModel: initialStance?.selfModel || 'guide',
      objective: initialStance?.objective || 'helpfulness',
      metaphors: initialStance?.metaphors || [],
      constraints: initialStance?.constraints || [],
      sentience: createDefaultSentience(),
      ...createStanceMetadata()
    };

    const space: StanceSpace = {
      id,
      name,
      description,
      ownerId,
      stance,
      permissions: [{
        userId: ownerId,
        level: 'owner',
        fields: [],
        grantedBy: 'system',
        grantedAt: new Date()
      }],
      locks: [],
      auditLog: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.spaces.set(id, space);
    this.logAudit(space, ownerId, 'create-space');

    return space;
  }

  deleteSpace(spaceId: string, userId: string): boolean {
    const space = this.spaces.get(spaceId);
    if (!space) return false;

    const access = this.checkAccess(spaceId, userId, 'owner');
    if (!access.allowed) return false;

    this.logAudit(space, userId, 'delete-space');
    return this.spaces.delete(spaceId);
  }

  grantPermission(
    spaceId: string,
    grantorId: string,
    targetUserId: string,
    level: PermissionLevel,
    fields?: FieldPermission[]
  ): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    const grantorAccess = this.checkAccess(spaceId, grantorId, 'admin');
    if (!grantorAccess.allowed) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to grant access',
        effectiveLevel: grantorAccess.effectiveLevel
      };
    }

    // Can't grant higher than own level
    const grantorLevel = PERMISSION_HIERARCHY[grantorAccess.effectiveLevel];
    const targetLevel = PERMISSION_HIERARCHY[level];
    if (targetLevel > grantorLevel) {
      return {
        allowed: false,
        reason: 'Cannot grant permission level higher than your own',
        effectiveLevel: grantorAccess.effectiveLevel
      };
    }

    // Remove existing permission if any
    space.permissions = space.permissions.filter(p => p.userId !== targetUserId);

    // Add new permission
    space.permissions.push({
      userId: targetUserId,
      level,
      fields: fields || [],
      grantedBy: grantorId,
      grantedAt: new Date()
    });

    this.logAudit(space, grantorId, 'grant-permission', undefined, undefined, { targetUserId, level });
    space.updatedAt = new Date();

    return {
      allowed: true,
      reason: 'Permission granted',
      effectiveLevel: level
    };
  }

  revokePermission(spaceId: string, revokerId: string, targetUserId: string): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    if (targetUserId === space.ownerId) {
      return { allowed: false, reason: 'Cannot revoke owner permission', effectiveLevel: 'none' };
    }

    const revokerAccess = this.checkAccess(spaceId, revokerId, 'admin');
    if (!revokerAccess.allowed) {
      return {
        allowed: false,
        reason: 'Insufficient permissions to revoke access',
        effectiveLevel: revokerAccess.effectiveLevel
      };
    }

    const targetPermission = space.permissions.find(p => p.userId === targetUserId);
    if (!targetPermission) {
      return { allowed: false, reason: 'Target user has no permission', effectiveLevel: 'none' };
    }

    // Can't revoke permission from someone with higher or equal level (unless owner)
    if (revokerAccess.effectiveLevel !== 'owner') {
      const revokerLevel = PERMISSION_HIERARCHY[revokerAccess.effectiveLevel];
      const targetLevel = PERMISSION_HIERARCHY[targetPermission.level];
      if (targetLevel >= revokerLevel) {
        return {
          allowed: false,
          reason: 'Cannot revoke permission from user with equal or higher level',
          effectiveLevel: revokerAccess.effectiveLevel
        };
      }
    }

    space.permissions = space.permissions.filter(p => p.userId !== targetUserId);
    this.logAudit(space, revokerId, 'revoke-permission', undefined, undefined, { targetUserId });
    space.updatedAt = new Date();

    return {
      allowed: true,
      reason: 'Permission revoked',
      effectiveLevel: 'none'
    };
  }

  checkAccess(
    spaceId: string,
    userId: string,
    requiredLevel: PermissionLevel = 'read',
    field?: string
  ): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    // Check direct permissions
    let permission = space.permissions.find(p => p.userId === userId);

    // Check delegated permissions
    if (!permission) {
      const delegated = this.getDelegatedPermission(space, userId, field);
      if (delegated) {
        permission = delegated;
      }
    }

    if (!permission) {
      return { allowed: false, reason: 'No permission for this space', effectiveLevel: 'none' };
    }

    // Check expiration
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return { allowed: false, reason: 'Permission expired', effectiveLevel: 'none' };
    }

    const userLevel = PERMISSION_HIERARCHY[permission.level];
    const requiredLevelValue = PERMISSION_HIERARCHY[requiredLevel];

    if (userLevel < requiredLevelValue) {
      return {
        allowed: false,
        reason: `Requires ${requiredLevel} access, you have ${permission.level}`,
        effectiveLevel: permission.level
      };
    }

    // Check field-level permissions
    if (field && permission.fields.length > 0) {
      const fieldPerm = permission.fields.find(f => f.field === field);
      if (fieldPerm) {
        if (requiredLevel === 'write' && !fieldPerm.write) {
          return {
            allowed: false,
            reason: `Write access denied for field: ${field}`,
            effectiveLevel: 'read'
          };
        }
        if (requiredLevel === 'read' && !fieldPerm.read) {
          return {
            allowed: false,
            reason: `Read access denied for field: ${field}`,
            effectiveLevel: 'none'
          };
        }
      }
    }

    // Check locks
    if (field && requiredLevel === 'write') {
      const lock = space.locks.find(l => l.field === field);
      if (lock && lock.lockedBy !== userId) {
        if (!lock.expiresAt || lock.expiresAt > new Date()) {
          return {
            allowed: false,
            reason: `Field locked by ${lock.lockedBy}`,
            effectiveLevel: permission.level,
            warnings: [`Field ${field} is locked`]
          };
        }
      }
    }

    return {
      allowed: true,
      reason: 'Access granted',
      effectiveLevel: permission.level
    };
  }

  private getDelegatedPermission(
    space: StanceSpace,
    userId: string,
    _field?: string
  ): AccessPermission | null {
    const delegations = this.delegations.get(userId) || [];

    for (const delegation of delegations) {
      if (delegation.validUntil && delegation.validUntil < new Date()) {
        continue;
      }

      const sourcePermission = space.permissions.find(p => p.userId === delegation.fromUserId);
      if (!sourcePermission) continue;

      return {
        userId,
        level: delegation.maxLevel,
        fields: delegation.fields.map(f => ({ field: f, read: true, write: true, lock: false })),
        grantedBy: delegation.fromUserId,
        grantedAt: new Date()
      };
    }

    return null;
  }

  lockField(spaceId: string, userId: string, field: string, reason?: string, duration?: number): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    const access = this.checkAccess(spaceId, userId, 'write', field);
    if (!access.allowed) return access;

    // Check if already locked
    const existingLock = space.locks.find(l => l.field === field);
    if (existingLock && existingLock.lockedBy !== userId) {
      return {
        allowed: false,
        reason: `Field already locked by ${existingLock.lockedBy}`,
        effectiveLevel: access.effectiveLevel
      };
    }

    // Remove any expired locks
    space.locks = space.locks.filter(l =>
      !l.expiresAt || l.expiresAt > new Date() || l.lockedBy === userId
    );

    // Add new lock
    const lock: FieldLock = {
      field,
      lockedBy: userId,
      lockedAt: new Date(),
      expiresAt: duration ? new Date(Date.now() + duration) : undefined,
      reason
    };

    space.locks.push(lock);
    this.logAudit(space, userId, 'lock', field);

    return {
      allowed: true,
      reason: 'Field locked',
      effectiveLevel: access.effectiveLevel
    };
  }

  unlockField(spaceId: string, userId: string, field: string): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    const lock = space.locks.find(l => l.field === field);
    if (!lock) {
      return { allowed: false, reason: 'Field not locked', effectiveLevel: 'none' };
    }

    // Owner can unlock any field
    const access = this.checkAccess(spaceId, userId, 'admin');
    if (!access.allowed && lock.lockedBy !== userId) {
      return {
        allowed: false,
        reason: 'Cannot unlock field locked by another user',
        effectiveLevel: access.effectiveLevel
      };
    }

    space.locks = space.locks.filter(l => l.field !== field);
    this.logAudit(space, userId, 'unlock', field);

    return {
      allowed: true,
      reason: 'Field unlocked',
      effectiveLevel: access.effectiveLevel
    };
  }

  readStance(spaceId: string, userId: string): { stance: Stance; access: AccessResult } | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    const access = this.checkAccess(spaceId, userId, 'read');
    if (!access.allowed) {
      return { stance: space.stance, access };
    }

    if (this.auditEnabled) {
      this.logAudit(space, userId, 'read');
    }

    return { stance: JSON.parse(JSON.stringify(space.stance)), access };
  }

  writeStanceField(
    spaceId: string,
    userId: string,
    field: string,
    value: unknown
  ): AccessResult {
    const space = this.spaces.get(spaceId);
    if (!space) {
      return { allowed: false, reason: 'Space not found', effectiveLevel: 'none' };
    }

    const access = this.checkAccess(spaceId, userId, 'write', field);
    if (!access.allowed) return access;

    const oldValue = this.getFieldValue(space.stance, field);
    this.setFieldValue(space.stance, field, value);
    space.updatedAt = new Date();

    this.logAudit(space, userId, 'write', field, oldValue, value);

    return {
      allowed: true,
      reason: 'Field updated',
      effectiveLevel: access.effectiveLevel
    };
  }

  private getFieldValue(stance: Stance, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = stance;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private setFieldValue(stance: Stance, field: string, value: unknown): void {
    const parts = field.split('.');
    let current: Record<string, unknown> = stance as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  delegate(
    fromUserId: string,
    toUserId: string,
    fields: string[],
    maxLevel: PermissionLevel,
    canDelegate: boolean = false,
    validUntil?: Date
  ): void {
    const delegations = this.delegations.get(toUserId) || [];

    delegations.push({
      fromUserId,
      toUserId,
      fields,
      maxLevel,
      canDelegate,
      validUntil
    });

    this.delegations.set(toUserId, delegations);
  }

  revokeDelegation(fromUserId: string, toUserId: string): void {
    const delegations = this.delegations.get(toUserId) || [];
    this.delegations.set(
      toUserId,
      delegations.filter(d => d.fromUserId !== fromUserId)
    );
  }

  getAuditLog(spaceId: string, userId: string): AuditEntry[] | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    const access = this.checkAccess(spaceId, userId, 'admin');
    if (!access.allowed) return null;

    return [...space.auditLog];
  }

  private logAudit(
    space: StanceSpace,
    userId: string,
    action: AuditAction,
    field?: string,
    oldValue?: unknown,
    newValue?: unknown
  ): void {
    if (!this.auditEnabled) return;

    space.auditLog.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      userId,
      action,
      field,
      oldValue,
      newValue
    });

    // Limit audit log size
    if (space.auditLog.length > 1000) {
      space.auditLog = space.auditLog.slice(-500);
    }
  }

  setAuditEnabled(enabled: boolean): void {
    this.auditEnabled = enabled;
  }

  getSpace(spaceId: string): StanceSpace | undefined {
    return this.spaces.get(spaceId);
  }

  listSpaces(userId: string): StanceSpace[] {
    return Array.from(this.spaces.values()).filter(space =>
      space.permissions.some(p => p.userId === userId)
    );
  }
}

export function createAccessControl(): StanceAccessControl {
  return new StanceAccessControl();
}
