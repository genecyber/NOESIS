/**
 * Real-Time Collaborative Stance Editing
 *
 * Multi-cursor editing with CRDT-based conflict resolution,
 * user presence, and synchronized undo/redo stacks.
 */
export class CollaborativeEditor {
    sessions = new Map();
    vectorClocks = new Map();
    onChangeCallbacks = [];
    onPresenceCallbacks = [];
    createSession(stance, creatorId, creatorName) {
        const sessionId = `collab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const session = {
            id: sessionId,
            stanceId: `stance-${Date.now()}`,
            stance: JSON.parse(JSON.stringify(stance)),
            participants: [{
                    userId: creatorId,
                    displayName: creatorName,
                    color: this.generateUserColor(creatorId),
                    joinedAt: new Date(),
                    lastActivity: new Date(),
                    permissions: ['view', 'edit', 'admin'],
                    status: 'active'
                }],
            cursors: [],
            pendingOperations: [],
            undoStack: [],
            redoStack: [],
            createdAt: new Date(),
            lastActivity: new Date()
        };
        this.sessions.set(sessionId, session);
        this.vectorClocks.set(sessionId, { [creatorId]: 0 });
        return session;
    }
    joinSession(sessionId, userId, displayName) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        // Check if already joined
        const existing = session.participants.find(p => p.userId === userId);
        if (existing) {
            existing.status = 'active';
            existing.lastActivity = new Date();
            return existing;
        }
        const participant = {
            userId,
            displayName,
            color: this.generateUserColor(userId),
            joinedAt: new Date(),
            lastActivity: new Date(),
            permissions: ['view', 'edit'],
            status: 'active'
        };
        session.participants.push(participant);
        // Initialize vector clock for new participant
        const clock = this.vectorClocks.get(sessionId);
        clock[userId] = 0;
        this.notifyPresence(session, participant);
        return participant;
    }
    leaveSession(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const participant = session.participants.find(p => p.userId === userId);
        if (participant) {
            participant.status = 'disconnected';
            this.notifyPresence(session, participant);
        }
        // Remove cursor
        session.cursors = session.cursors.filter(c => c.userId !== userId);
        return true;
    }
    updateCursor(sessionId, userId, field, subField, offset) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const existingCursor = session.cursors.find(c => c.userId === userId);
        if (existingCursor) {
            existingCursor.field = field;
            existingCursor.subField = subField;
            existingCursor.offset = offset;
            existingCursor.timestamp = new Date();
        }
        else {
            session.cursors.push({
                userId,
                field,
                subField,
                offset,
                timestamp: new Date()
            });
        }
        const participant = session.participants.find(p => p.userId === userId);
        if (participant) {
            participant.lastActivity = new Date();
        }
        session.lastActivity = new Date();
    }
    applyOperation(sessionId, userId, op) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        // Check permissions
        const participant = session.participants.find(p => p.userId === userId);
        if (!participant || !participant.permissions.includes('edit')) {
            return null;
        }
        // Update vector clock
        const clock = this.vectorClocks.get(sessionId);
        clock[userId] = (clock[userId] || 0) + 1;
        const operation = {
            id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            ...op,
            timestamp: new Date(),
            vectorClock: { ...clock }
        };
        // Get previous value
        operation.previousValue = this.getFieldValue(session.stance, operation.field);
        // Apply the operation
        this.applyOperationToStance(session.stance, operation);
        // Add to pending operations for sync
        session.pendingOperations.push(operation);
        // Update undo stack
        const batch = {
            id: `batch-${Date.now()}`,
            userId,
            operations: [operation],
            timestamp: new Date()
        };
        session.undoStack.push(batch);
        // Clear redo stack on new operation
        session.redoStack = [];
        // Limit undo stack
        if (session.undoStack.length > 100) {
            session.undoStack = session.undoStack.slice(-50);
        }
        session.lastActivity = new Date();
        participant.lastActivity = new Date();
        this.notifyChange(session, operation);
        return operation;
    }
    applyOperationToStance(stance, operation) {
        const parts = operation.field.split('.');
        let target = stance;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        const finalKey = parts[parts.length - 1];
        switch (operation.type) {
            case 'set':
                target[finalKey] = operation.value;
                break;
            case 'increment':
                target[finalKey] = target[finalKey] + operation.value;
                break;
            case 'decrement':
                target[finalKey] = target[finalKey] - operation.value;
                break;
            case 'append':
                if (Array.isArray(target[finalKey])) {
                    target[finalKey].push(operation.value);
                }
                break;
            case 'remove':
                if (Array.isArray(target[finalKey])) {
                    const arr = target[finalKey];
                    const idx = arr.indexOf(operation.value);
                    if (idx > -1)
                        arr.splice(idx, 1);
                }
                break;
        }
    }
    getFieldValue(stance, field) {
        const parts = field.split('.');
        let current = stance;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    undo(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.undoStack.length === 0)
            return null;
        // Find last batch by this user
        let batchIndex = -1;
        for (let i = session.undoStack.length - 1; i >= 0; i--) {
            if (session.undoStack[i].userId === userId) {
                batchIndex = i;
                break;
            }
        }
        if (batchIndex === -1)
            return null;
        const batch = session.undoStack.splice(batchIndex, 1)[0];
        // Reverse operations
        for (const op of batch.operations.reverse()) {
            this.setFieldValue(session.stance, op.field, op.previousValue);
        }
        session.redoStack.push(batch);
        session.lastActivity = new Date();
        return batch;
    }
    redo(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.redoStack.length === 0)
            return null;
        // Find last batch by this user
        let batchIndex = -1;
        for (let i = session.redoStack.length - 1; i >= 0; i--) {
            if (session.redoStack[i].userId === userId) {
                batchIndex = i;
                break;
            }
        }
        if (batchIndex === -1)
            return null;
        const batch = session.redoStack.splice(batchIndex, 1)[0];
        // Re-apply operations
        for (const op of batch.operations) {
            this.applyOperationToStance(session.stance, op);
        }
        session.undoStack.push(batch);
        session.lastActivity = new Date();
        return batch;
    }
    setFieldValue(stance, field, value) {
        const parts = field.split('.');
        let target = stance;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
    }
    resolveConflict(op1, op2) {
        // Compare vector clocks
        const clock1 = op1.vectorClock;
        const clock2 = op2.vectorClock;
        // Check if one happened before the other
        const op1Before = this.happenedBefore(clock1, clock2);
        const op2Before = this.happenedBefore(clock2, clock1);
        if (op1Before) {
            return {
                operationId: op2.id,
                conflictsWith: op1.id,
                resolution: 'accept-remote'
            };
        }
        if (op2Before) {
            return {
                operationId: op1.id,
                conflictsWith: op2.id,
                resolution: 'accept-local'
            };
        }
        // Concurrent operations - use LWW (Last Writer Wins) based on timestamp
        if (op1.timestamp > op2.timestamp) {
            return {
                operationId: op1.id,
                conflictsWith: op2.id,
                resolution: 'accept-local'
            };
        }
        else if (op2.timestamp > op1.timestamp) {
            return {
                operationId: op2.id,
                conflictsWith: op1.id,
                resolution: 'accept-remote'
            };
        }
        // Same timestamp - try to merge for numeric values
        if (typeof op1.value === 'number' && typeof op2.value === 'number') {
            return {
                operationId: op1.id,
                conflictsWith: op2.id,
                resolution: 'merge',
                mergedValue: (op1.value + op2.value) / 2
            };
        }
        // Default to user with lower ID (deterministic)
        return {
            operationId: op1.userId < op2.userId ? op1.id : op2.id,
            conflictsWith: op1.userId < op2.userId ? op2.id : op1.id,
            resolution: op1.userId < op2.userId ? 'accept-local' : 'accept-remote'
        };
    }
    happenedBefore(clock1, clock2) {
        let atLeastOneLess = false;
        for (const key of Object.keys({ ...clock1, ...clock2 })) {
            const v1 = clock1[key] || 0;
            const v2 = clock2[key] || 0;
            if (v1 > v2)
                return false;
            if (v1 < v2)
                atLeastOneLess = true;
        }
        return atLeastOneLess;
    }
    syncState(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }
        return {
            type: 'sync-response',
            sessionId,
            userId: 'system',
            payload: {
                stance: session.stance,
                participants: session.participants,
                cursors: session.cursors,
                vectorClock: this.vectorClocks.get(sessionId)
            },
            timestamp: new Date()
        };
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getParticipants(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? [...session.participants] : [];
    }
    getCursors(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? [...session.cursors] : [];
    }
    setPermissions(sessionId, adminId, targetUserId, permissions) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const admin = session.participants.find(p => p.userId === adminId);
        if (!admin || !admin.permissions.includes('admin'))
            return false;
        const target = session.participants.find(p => p.userId === targetUserId);
        if (!target)
            return false;
        target.permissions = permissions;
        return true;
    }
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
        return () => {
            const idx = this.onChangeCallbacks.indexOf(callback);
            if (idx > -1)
                this.onChangeCallbacks.splice(idx, 1);
        };
    }
    onPresence(callback) {
        this.onPresenceCallbacks.push(callback);
        return () => {
            const idx = this.onPresenceCallbacks.indexOf(callback);
            if (idx > -1)
                this.onPresenceCallbacks.splice(idx, 1);
        };
    }
    notifyChange(session, op) {
        for (const callback of this.onChangeCallbacks) {
            callback(session, op);
        }
    }
    notifyPresence(session, participant) {
        for (const callback of this.onPresenceCallbacks) {
            callback(session, participant);
        }
    }
    generateUserColor(userId) {
        // Generate consistent color from userId
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    listSessions() {
        return Array.from(this.sessions.values());
    }
    deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
}
export function createCollaborativeEditor() {
    return new CollaborativeEditor();
}
//# sourceMappingURL=realtime.js.map