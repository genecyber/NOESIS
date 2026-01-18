/**
 * Multiplayer Stance Editing (Ralph Iteration 11, Feature 6)
 *
 * Real-time collaborative editing, conflict resolution for concurrent edits,
 * permission-based modification zones, edit history and rollback,
 * collaborative coherence maintenance, sync protocols for distributed editing.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface MultiplayerConfig {
  enableMultiplayer: boolean;
  maxParticipants: number;
  conflictResolution: ConflictResolutionStrategy;
  permissionModel: PermissionModel;
  syncInterval: number;  // milliseconds
  coherenceVoting: boolean;
}

export type ConflictResolutionStrategy = 'last-write-wins' | 'merge' | 'vote' | 'owner-priority';
export type PermissionModel = 'open' | 'role-based' | 'zone-based';

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastActive: Date;
  permissions: Permission[];
  color: string;
  cursor: EditCursor | null;
}

export type ParticipantRole = 'owner' | 'editor' | 'contributor' | 'viewer';

export interface Permission {
  type: 'read' | 'write' | 'admin';
  scope: PermissionScope;
}

export interface PermissionScope {
  zones: EditZone[];
  valueRanges: Record<string, [number, number]>;
  frames: Frame[];
}

export interface EditZone {
  id: string;
  name: string;
  fields: string[];
  allowedRoles: ParticipantRole[];
}

export interface EditCursor {
  participantId: string;
  field: string;
  timestamp: Date;
  color: string;
}

export interface StanceEdit {
  id: string;
  participantId: string;
  timestamp: Date;
  type: EditType;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  status: EditStatus;
}

export type EditType = 'set' | 'increment' | 'decrement' | 'toggle' | 'append';
export type EditStatus = 'pending' | 'applied' | 'rejected' | 'merged' | 'rolled-back';

export interface EditConflict {
  id: string;
  edits: StanceEdit[];
  field: string;
  detectedAt: Date;
  resolution: ConflictResolution | null;
}

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  winnerId: string;
  mergedValue?: unknown;
  votes?: Record<string, string>;  // participantId -> votedEditId
  resolvedAt: Date;
}

export interface EditHistory {
  edits: StanceEdit[];
  conflicts: EditConflict[];
  rollbacks: Rollback[];
  totalEdits: number;
  appliedEdits: number;
}

export interface Rollback {
  id: string;
  editId: string;
  participantId: string;
  timestamp: Date;
  reason: string;
}

export interface SessionState {
  sessionId: string;
  stance: Stance;
  participants: Participant[];
  history: EditHistory;
  coherenceScore: number;
  lastSync: Date;
  version: number;
}

export interface SyncMessage {
  type: 'edit' | 'cursor' | 'join' | 'leave' | 'sync' | 'conflict' | 'vote';
  sessionId: string;
  participantId: string;
  payload: unknown;
  timestamp: Date;
  version: number;
}

export interface CoherenceVote {
  participantId: string;
  accept: boolean;
  reason?: string;
}

export interface MultiplayerStats {
  totalSessions: number;
  activeParticipants: number;
  editsProcessed: number;
  conflictsResolved: number;
  rollbacksPerformed: number;
  averageCoherence: number;
}

// ============================================================================
// Multiplayer Session Manager
// ============================================================================

export class MultiplayerSessionManager {
  private config: MultiplayerConfig;
  private sessions: Map<string, SessionState> = new Map();
  private participants: Map<string, Participant> = new Map();
  private editQueue: Map<string, StanceEdit[]> = new Map();
  private syncCallbacks: Map<string, (message: SyncMessage) => void> = new Map();
  private stats: MultiplayerStats;

  constructor(config: Partial<MultiplayerConfig> = {}) {
    this.config = {
      enableMultiplayer: true,
      maxParticipants: 10,
      conflictResolution: 'merge',
      permissionModel: 'role-based',
      syncInterval: 100,
      coherenceVoting: true,
      ...config
    };

    this.stats = {
      totalSessions: 0,
      activeParticipants: 0,
      editsProcessed: 0,
      conflictsResolved: 0,
      rollbacksPerformed: 0,
      averageCoherence: 0
    };
  }

  /**
   * Create a new multiplayer session
   */
  createSession(
    sessionId: string,
    initialStance: Stance,
    ownerId: string,
    ownerName: string
  ): SessionState {
    const owner: Participant = {
      id: ownerId,
      name: ownerName,
      role: 'owner',
      joinedAt: new Date(),
      lastActive: new Date(),
      permissions: this.getDefaultPermissions('owner'),
      color: this.generateColor(),
      cursor: null
    };

    const session: SessionState = {
      sessionId,
      stance: { ...initialStance },
      participants: [owner],
      history: {
        edits: [],
        conflicts: [],
        rollbacks: [],
        totalEdits: 0,
        appliedEdits: 0
      },
      coherenceScore: 100 - initialStance.cumulativeDrift,
      lastSync: new Date(),
      version: 1
    };

    this.sessions.set(sessionId, session);
    this.participants.set(ownerId, owner);
    this.editQueue.set(sessionId, []);
    this.stats.totalSessions++;
    this.stats.activeParticipants++;

    return session;
  }

  /**
   * Join an existing session
   */
  joinSession(
    sessionId: string,
    participantId: string,
    participantName: string,
    requestedRole: ParticipantRole = 'contributor'
  ): { success: boolean; session?: SessionState; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.participants.length >= this.config.maxParticipants) {
      return { success: false, error: 'Session is full' };
    }

    // Viewers can always join, others need approval in role-based model
    const role = this.config.permissionModel === 'open' ? requestedRole :
                 (requestedRole === 'viewer' ? 'viewer' : 'contributor');

    const participant: Participant = {
      id: participantId,
      name: participantName,
      role,
      joinedAt: new Date(),
      lastActive: new Date(),
      permissions: this.getDefaultPermissions(role),
      color: this.generateColor(),
      cursor: null
    };

    session.participants.push(participant);
    this.participants.set(participantId, participant);
    this.stats.activeParticipants++;

    // Broadcast join message
    this.broadcast(sessionId, {
      type: 'join',
      sessionId,
      participantId,
      payload: { name: participantName, role },
      timestamp: new Date(),
      version: session.version
    });

    return { success: true, session };
  }

  /**
   * Leave a session
   */
  leaveSession(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.participants.findIndex(p => p.id === participantId);
    if (index === -1) return false;

    session.participants.splice(index, 1);
    this.participants.delete(participantId);
    this.stats.activeParticipants--;

    // Broadcast leave message
    this.broadcast(sessionId, {
      type: 'leave',
      sessionId,
      participantId,
      payload: null,
      timestamp: new Date(),
      version: session.version
    });

    // Clean up empty sessions
    if (session.participants.length === 0) {
      this.sessions.delete(sessionId);
      this.editQueue.delete(sessionId);
    }

    return true;
  }

  /**
   * Submit an edit
   */
  submitEdit(
    sessionId: string,
    participantId: string,
    field: string,
    newValue: unknown,
    editType: EditType = 'set'
  ): { success: boolean; edit?: StanceEdit; conflict?: EditConflict; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      return { success: false, error: 'Not a session participant' };
    }

    // Check permissions
    if (!this.canEdit(participant, field)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get current value
    const previousValue = this.getFieldValue(session.stance, field);

    // Create edit
    const edit: StanceEdit = {
      id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId,
      timestamp: new Date(),
      type: editType,
      field,
      previousValue,
      newValue,
      status: 'pending'
    };

    // Check for conflicts
    const conflict = this.detectConflict(session, edit);
    if (conflict) {
      session.history.conflicts.push(conflict);

      // Handle conflict based on strategy
      const resolution = this.resolveConflict(session, conflict);
      if (resolution.winnerId !== edit.id) {
        edit.status = 'rejected';
        session.history.edits.push(edit);
        return { success: false, conflict, error: 'Edit rejected due to conflict' };
      }
    }

    // Apply edit
    this.applyEdit(session, edit);
    edit.status = 'applied';
    session.history.edits.push(edit);
    session.history.totalEdits++;
    session.history.appliedEdits++;
    session.version++;
    this.stats.editsProcessed++;

    // Update coherence
    this.updateCoherence(session);

    // Broadcast edit
    this.broadcast(sessionId, {
      type: 'edit',
      sessionId,
      participantId,
      payload: { edit, stance: session.stance },
      timestamp: new Date(),
      version: session.version
    });

    return { success: true, edit };
  }

  /**
   * Detect conflicts with pending edits
   */
  private detectConflict(session: SessionState, newEdit: StanceEdit): EditConflict | null {
    const queue = this.editQueue.get(session.sessionId) || [];
    const recentEdits = session.history.edits.filter(e =>
      e.field === newEdit.field &&
      e.status === 'applied' &&
      Date.now() - e.timestamp.getTime() < 1000  // Within last second
    );

    const conflictingEdits = [...queue, ...recentEdits].filter(e =>
      e.field === newEdit.field && e.id !== newEdit.id
    );

    if (conflictingEdits.length === 0) return null;

    return {
      id: `conflict-${Date.now()}`,
      edits: [newEdit, ...conflictingEdits],
      field: newEdit.field,
      detectedAt: new Date(),
      resolution: null
    };
  }

  /**
   * Resolve a conflict
   */
  private resolveConflict(session: SessionState, conflict: EditConflict): ConflictResolution {
    let resolution: ConflictResolution;

    switch (this.config.conflictResolution) {
      case 'last-write-wins':
        const latest = conflict.edits.reduce((a, b) =>
          a.timestamp > b.timestamp ? a : b
        );
        resolution = {
          strategy: 'last-write-wins',
          winnerId: latest.id,
          resolvedAt: new Date()
        };
        break;

      case 'owner-priority':
        const ownerEdit = conflict.edits.find(e => {
          const p = session.participants.find(p => p.id === e.participantId);
          return p?.role === 'owner';
        });
        resolution = {
          strategy: 'owner-priority',
          winnerId: ownerEdit?.id || conflict.edits[0].id,
          resolvedAt: new Date()
        };
        break;

      case 'merge':
        // For numeric values, average them
        const numericEdits = conflict.edits.filter(e => typeof e.newValue === 'number');
        if (numericEdits.length === conflict.edits.length) {
          const mergedValue = numericEdits.reduce(
            (sum, e) => sum + (e.newValue as number), 0
          ) / numericEdits.length;
          resolution = {
            strategy: 'merge',
            winnerId: conflict.edits[0].id,
            mergedValue: Math.round(mergedValue),
            resolvedAt: new Date()
          };
        } else {
          // Fall back to last-write-wins for non-numeric
          resolution = {
            strategy: 'merge',
            winnerId: conflict.edits[conflict.edits.length - 1].id,
            resolvedAt: new Date()
          };
        }
        break;

      case 'vote':
      default:
        // In voting mode, first edit wins by default (voting happens async)
        resolution = {
          strategy: 'vote',
          winnerId: conflict.edits[0].id,
          votes: {},
          resolvedAt: new Date()
        };
        break;
    }

    conflict.resolution = resolution;
    this.stats.conflictsResolved++;

    return resolution;
  }

  /**
   * Apply an edit to the stance
   */
  private applyEdit(session: SessionState, edit: StanceEdit): void {
    const parts = edit.field.split('.');
    let target: Record<string, unknown> = session.stance as unknown as Record<string, unknown>;

    // Navigate to parent of target field
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
    }

    const finalKey = parts[parts.length - 1];
    const currentValue = target[finalKey];

    switch (edit.type) {
      case 'set':
        target[finalKey] = edit.newValue;
        break;
      case 'increment':
        if (typeof currentValue === 'number') {
          target[finalKey] = currentValue + (edit.newValue as number);
        }
        break;
      case 'decrement':
        if (typeof currentValue === 'number') {
          target[finalKey] = currentValue - (edit.newValue as number);
        }
        break;
      case 'toggle':
        if (typeof currentValue === 'boolean') {
          target[finalKey] = !currentValue;
        }
        break;
      case 'append':
        if (Array.isArray(currentValue)) {
          (currentValue as unknown[]).push(edit.newValue);
        }
        break;
    }
  }

  /**
   * Get field value from stance
   */
  private getFieldValue(stance: Stance, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = stance;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Rollback an edit
   */
  rollbackEdit(
    sessionId: string,
    participantId: string,
    editId: string,
    reason: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant || !['owner', 'editor'].includes(participant.role)) {
      return false;
    }

    const edit = session.history.edits.find(e => e.id === editId);
    if (!edit || edit.status !== 'applied') return false;

    // Create reverse edit
    const reverseEdit: StanceEdit = {
      id: `rollback-${Date.now()}`,
      participantId,
      timestamp: new Date(),
      type: 'set',
      field: edit.field,
      previousValue: edit.newValue,
      newValue: edit.previousValue,
      status: 'pending'
    };

    // Apply rollback
    this.applyEdit(session, reverseEdit);
    reverseEdit.status = 'applied';
    edit.status = 'rolled-back';

    session.history.edits.push(reverseEdit);
    session.history.rollbacks.push({
      id: `rb-${Date.now()}`,
      editId,
      participantId,
      timestamp: new Date(),
      reason
    });

    session.version++;
    this.stats.rollbacksPerformed++;

    // Broadcast rollback
    this.broadcast(sessionId, {
      type: 'edit',
      sessionId,
      participantId,
      payload: { edit: reverseEdit, rollback: true, reason, stance: session.stance },
      timestamp: new Date(),
      version: session.version
    });

    return true;
  }

  /**
   * Update cursor position
   */
  updateCursor(
    sessionId: string,
    participantId: string,
    field: string | null
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return;

    participant.cursor = field ? {
      participantId,
      field,
      timestamp: new Date(),
      color: participant.color
    } : null;

    participant.lastActive = new Date();

    this.broadcast(sessionId, {
      type: 'cursor',
      sessionId,
      participantId,
      payload: { field, color: participant.color },
      timestamp: new Date(),
      version: session.version
    });
  }

  /**
   * Vote on coherence
   */
  submitCoherenceVote(
    sessionId: string,
    participantId: string,
    accept: boolean,
    reason?: string
  ): void {
    if (!this.config.coherenceVoting) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const vote: CoherenceVote = { participantId, accept, reason };

    this.broadcast(sessionId, {
      type: 'vote',
      sessionId,
      participantId,
      payload: vote,
      timestamp: new Date(),
      version: session.version
    });
  }

  /**
   * Update coherence score
   */
  private updateCoherence(session: SessionState): void {
    session.coherenceScore = Math.max(0, 100 - session.stance.cumulativeDrift);
    this.stats.averageCoherence = (
      this.stats.averageCoherence * (this.stats.editsProcessed - 1) +
      session.coherenceScore
    ) / this.stats.editsProcessed;
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: ParticipantRole): Permission[] {
    const allFrames: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
    const fullRange: [number, number] = [0, 100];

    switch (role) {
      case 'owner':
        return [{
          type: 'admin',
          scope: {
            zones: [],  // Full access
            valueRanges: {
              curiosity: fullRange, certainty: fullRange, risk: fullRange,
              novelty: fullRange, empathy: fullRange, provocation: fullRange, synthesis: fullRange
            },
            frames: allFrames
          }
        }];

      case 'editor':
        return [{
          type: 'write',
          scope: {
            zones: [{ id: 'values', name: 'Values Zone', fields: ['values.*'], allowedRoles: ['editor', 'owner'] }],
            valueRanges: {
              curiosity: [20, 80], certainty: [20, 80], risk: [20, 80],
              novelty: [20, 80], empathy: [20, 80], provocation: [20, 80], synthesis: [20, 80]
            },
            frames: allFrames
          }
        }];

      case 'contributor':
        return [{
          type: 'write',
          scope: {
            zones: [{ id: 'minor', name: 'Minor Zone', fields: ['values.curiosity', 'values.empathy'], allowedRoles: ['contributor', 'editor', 'owner'] }],
            valueRanges: {
              curiosity: [30, 70], empathy: [30, 70]
            },
            frames: ['pragmatic', 'playful']
          }
        }];

      case 'viewer':
      default:
        return [{
          type: 'read',
          scope: { zones: [], valueRanges: {}, frames: [] }
        }];
    }
  }

  /**
   * Check if participant can edit field
   */
  private canEdit(participant: Participant, field: string): boolean {
    if (participant.role === 'viewer') return false;
    if (participant.role === 'owner') return true;

    for (const permission of participant.permissions) {
      if (permission.type === 'admin') return true;
      if (permission.type === 'write') {
        // Check zones
        for (const zone of permission.scope.zones) {
          for (const zoneField of zone.fields) {
            if (zoneField === field || zoneField.endsWith('.*') && field.startsWith(zoneField.slice(0, -2))) {
              if (zone.allowedRoles.includes(participant.role)) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Broadcast message to session participants
   */
  private broadcast(sessionId: string, message: SyncMessage): void {
    const callback = this.syncCallbacks.get(sessionId);
    if (callback) {
      callback(message);
    }
  }

  /**
   * Register sync callback
   */
  onSync(sessionId: string, callback: (message: SyncMessage) => void): void {
    this.syncCallbacks.set(sessionId, callback);
  }

  /**
   * Unregister sync callback
   */
  offSync(sessionId: string): void {
    this.syncCallbacks.delete(sessionId);
  }

  /**
   * Generate random color for participant
   */
  private generateColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get session
   */
  getSession(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get participant
   */
  getParticipant(participantId: string): Participant | null {
    return this.participants.get(participantId) || null;
  }

  /**
   * List active sessions
   */
  listSessions(): SessionState[] {
    return [...this.sessions.values()];
  }

  /**
   * Get edit history for session
   */
  getEditHistory(sessionId: string, limit?: number): StanceEdit[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const edits = [...session.history.edits];
    return limit ? edits.slice(-limit) : edits;
  }

  /**
   * Get statistics
   */
  getStats(): MultiplayerStats {
    return { ...this.stats };
  }

  /**
   * Close session
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove all participants
    for (const participant of session.participants) {
      this.participants.delete(participant.id);
      this.stats.activeParticipants--;
    }

    this.sessions.delete(sessionId);
    this.editQueue.delete(sessionId);
    this.syncCallbacks.delete(sessionId);

    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const multiplayerSession = new MultiplayerSessionManager();
