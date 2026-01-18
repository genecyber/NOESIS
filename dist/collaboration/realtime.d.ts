/**
 * Real-Time Collaborative Stance Editing
 *
 * Multi-cursor editing with CRDT-based conflict resolution,
 * user presence, and synchronized undo/redo stacks.
 */
import type { Stance } from '../types/index.js';
export interface CollaborationSession {
    id: string;
    stanceId: string;
    stance: Stance;
    participants: Participant[];
    cursors: CursorPosition[];
    pendingOperations: Operation[];
    undoStack: OperationBatch[];
    redoStack: OperationBatch[];
    createdAt: Date;
    lastActivity: Date;
}
export interface Participant {
    userId: string;
    displayName: string;
    color: string;
    joinedAt: Date;
    lastActivity: Date;
    permissions: ParticipantPermission[];
    status: 'active' | 'idle' | 'disconnected';
}
export type ParticipantPermission = 'view' | 'edit' | 'admin';
export interface CursorPosition {
    userId: string;
    field: string;
    subField?: string;
    offset?: number;
    timestamp: Date;
}
export interface Operation {
    id: string;
    type: OperationType;
    userId: string;
    field: string;
    value: unknown;
    previousValue: unknown;
    timestamp: Date;
    vectorClock: VectorClock;
}
export type OperationType = 'set' | 'increment' | 'decrement' | 'append' | 'remove';
export interface VectorClock {
    [userId: string]: number;
}
export interface OperationBatch {
    id: string;
    userId: string;
    operations: Operation[];
    timestamp: Date;
}
export interface SyncMessage {
    type: 'operation' | 'cursor' | 'presence' | 'sync-request' | 'sync-response';
    sessionId: string;
    userId: string;
    payload: unknown;
    timestamp: Date;
}
export interface ConflictResolution {
    operationId: string;
    conflictsWith: string;
    resolution: 'accept-local' | 'accept-remote' | 'merge' | 'manual';
    mergedValue?: unknown;
}
export declare class CollaborativeEditor {
    private sessions;
    private vectorClocks;
    private onChangeCallbacks;
    private onPresenceCallbacks;
    createSession(stance: Stance, creatorId: string, creatorName: string): CollaborationSession;
    joinSession(sessionId: string, userId: string, displayName: string): Participant | null;
    leaveSession(sessionId: string, userId: string): boolean;
    updateCursor(sessionId: string, userId: string, field: string, subField?: string, offset?: number): void;
    applyOperation(sessionId: string, userId: string, op: Omit<Operation, 'id' | 'vectorClock' | 'timestamp'>): Operation | null;
    private applyOperationToStance;
    private getFieldValue;
    undo(sessionId: string, userId: string): OperationBatch | null;
    redo(sessionId: string, userId: string): OperationBatch | null;
    private setFieldValue;
    resolveConflict(op1: Operation, op2: Operation): ConflictResolution;
    private happenedBefore;
    syncState(sessionId: string): SyncMessage;
    getSession(sessionId: string): CollaborationSession | undefined;
    getParticipants(sessionId: string): Participant[];
    getCursors(sessionId: string): CursorPosition[];
    setPermissions(sessionId: string, adminId: string, targetUserId: string, permissions: ParticipantPermission[]): boolean;
    onChange(callback: (session: CollaborationSession, op: Operation) => void): () => void;
    onPresence(callback: (session: CollaborationSession, participant: Participant) => void): () => void;
    private notifyChange;
    private notifyPresence;
    private generateUserColor;
    listSessions(): CollaborationSession[];
    deleteSession(sessionId: string): boolean;
}
export declare function createCollaborativeEditor(): CollaborativeEditor;
//# sourceMappingURL=realtime.d.ts.map