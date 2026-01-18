/**
 * Multiplayer Stance Editing (Ralph Iteration 11, Feature 6)
 *
 * Real-time collaborative editing, conflict resolution for concurrent edits,
 * permission-based modification zones, edit history and rollback,
 * collaborative coherence maintenance, sync protocols for distributed editing.
 */
import type { Stance, Frame } from '../types/index.js';
export interface MultiplayerConfig {
    enableMultiplayer: boolean;
    maxParticipants: number;
    conflictResolution: ConflictResolutionStrategy;
    permissionModel: PermissionModel;
    syncInterval: number;
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
    votes?: Record<string, string>;
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
export declare class MultiplayerSessionManager {
    private config;
    private sessions;
    private participants;
    private editQueue;
    private syncCallbacks;
    private stats;
    constructor(config?: Partial<MultiplayerConfig>);
    /**
     * Create a new multiplayer session
     */
    createSession(sessionId: string, initialStance: Stance, ownerId: string, ownerName: string): SessionState;
    /**
     * Join an existing session
     */
    joinSession(sessionId: string, participantId: string, participantName: string, requestedRole?: ParticipantRole): {
        success: boolean;
        session?: SessionState;
        error?: string;
    };
    /**
     * Leave a session
     */
    leaveSession(sessionId: string, participantId: string): boolean;
    /**
     * Submit an edit
     */
    submitEdit(sessionId: string, participantId: string, field: string, newValue: unknown, editType?: EditType): {
        success: boolean;
        edit?: StanceEdit;
        conflict?: EditConflict;
        error?: string;
    };
    /**
     * Detect conflicts with pending edits
     */
    private detectConflict;
    /**
     * Resolve a conflict
     */
    private resolveConflict;
    /**
     * Apply an edit to the stance
     */
    private applyEdit;
    /**
     * Get field value from stance
     */
    private getFieldValue;
    /**
     * Rollback an edit
     */
    rollbackEdit(sessionId: string, participantId: string, editId: string, reason: string): boolean;
    /**
     * Update cursor position
     */
    updateCursor(sessionId: string, participantId: string, field: string | null): void;
    /**
     * Vote on coherence
     */
    submitCoherenceVote(sessionId: string, participantId: string, accept: boolean, reason?: string): void;
    /**
     * Update coherence score
     */
    private updateCoherence;
    /**
     * Get default permissions for role
     */
    private getDefaultPermissions;
    /**
     * Check if participant can edit field
     */
    private canEdit;
    /**
     * Broadcast message to session participants
     */
    private broadcast;
    /**
     * Register sync callback
     */
    onSync(sessionId: string, callback: (message: SyncMessage) => void): void;
    /**
     * Unregister sync callback
     */
    offSync(sessionId: string): void;
    /**
     * Generate random color for participant
     */
    private generateColor;
    /**
     * Get session
     */
    getSession(sessionId: string): SessionState | null;
    /**
     * Get participant
     */
    getParticipant(participantId: string): Participant | null;
    /**
     * List active sessions
     */
    listSessions(): SessionState[];
    /**
     * Get edit history for session
     */
    getEditHistory(sessionId: string, limit?: number): StanceEdit[];
    /**
     * Get statistics
     */
    getStats(): MultiplayerStats;
    /**
     * Close session
     */
    closeSession(sessionId: string): boolean;
}
export declare const multiplayerSession: MultiplayerSessionManager;
//# sourceMappingURL=multiplayer.d.ts.map