/**
 * Stance Rollback with Branching
 *
 * Full undo/redo history with named checkpoints,
 * branch creation, merging, and timeline navigation.
 */
export class StanceVersionControl {
    histories = new Map();
    checkpoints = new Map();
    maxCheckpointsPerBranch = 100;
    gcThreshold = 500;
    createHistory(stance, author) {
        const historyId = `history-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const defaultBranchId = `branch-main`;
        const rootCheckpointId = `checkpoint-root`;
        const rootCheckpoint = {
            id: rootCheckpointId,
            stance: JSON.parse(JSON.stringify(stance)),
            name: 'Initial',
            parentId: undefined,
            branchId: defaultBranchId,
            timestamp: new Date(),
            author,
            tags: ['root']
        };
        const defaultBranch = {
            id: defaultBranchId,
            name: 'main',
            createdAt: new Date(),
            lastModified: new Date(),
            isDefault: true,
            protected: false,
            checkpoints: [rootCheckpointId]
        };
        const history = {
            id: historyId,
            rootCheckpoint,
            branches: [defaultBranch],
            currentBranchId: defaultBranchId,
            currentCheckpointId: rootCheckpointId,
            createdAt: new Date(),
            lastModified: new Date()
        };
        this.histories.set(historyId, history);
        this.checkpoints.set(rootCheckpointId, rootCheckpoint);
        return history;
    }
    commit(historyId, stance, author, name, description) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const branch = history.branches.find(b => b.id === history.currentBranchId);
        if (!branch)
            return null;
        const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const checkpoint = {
            id: checkpointId,
            stance: JSON.parse(JSON.stringify(stance)),
            name,
            description,
            parentId: history.currentCheckpointId,
            branchId: branch.id,
            timestamp: new Date(),
            author,
            tags: []
        };
        this.checkpoints.set(checkpointId, checkpoint);
        branch.checkpoints.push(checkpointId);
        branch.lastModified = new Date();
        history.currentCheckpointId = checkpointId;
        history.lastModified = new Date();
        // Trigger GC if needed
        if (branch.checkpoints.length > this.gcThreshold) {
            this.garbageCollect(historyId, branch.id);
        }
        return checkpoint;
    }
    createCheckpoint(historyId, name, description, tags) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
        if (!currentCheckpoint)
            return null;
        const newCheckpoint = this.commit(historyId, currentCheckpoint.stance, currentCheckpoint.author, name, description);
        if (newCheckpoint && tags) {
            newCheckpoint.tags = tags;
        }
        return newCheckpoint;
    }
    createBranch(historyId, branchName, fromCheckpointId) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        // Check if branch name already exists
        if (history.branches.some(b => b.name === branchName)) {
            return null;
        }
        const sourceCheckpointId = fromCheckpointId || history.currentCheckpointId;
        const sourceCheckpoint = this.checkpoints.get(sourceCheckpointId);
        if (!sourceCheckpoint)
            return null;
        const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const newBranch = {
            id: branchId,
            name: branchName,
            createdFrom: sourceCheckpointId,
            createdAt: new Date(),
            lastModified: new Date(),
            isDefault: false,
            protected: false,
            checkpoints: [sourceCheckpointId]
        };
        history.branches.push(newBranch);
        history.lastModified = new Date();
        return newBranch;
    }
    switchBranch(historyId, branchName) {
        const history = this.histories.get(historyId);
        if (!history)
            return false;
        const branch = history.branches.find(b => b.name === branchName);
        if (!branch)
            return false;
        history.currentBranchId = branch.id;
        history.currentCheckpointId = branch.checkpoints[branch.checkpoints.length - 1];
        history.lastModified = new Date();
        return true;
    }
    deleteBranch(historyId, branchName) {
        const history = this.histories.get(historyId);
        if (!history)
            return false;
        const branchIndex = history.branches.findIndex(b => b.name === branchName);
        if (branchIndex === -1)
            return false;
        const branch = history.branches[branchIndex];
        // Can't delete default or protected branches
        if (branch.isDefault || branch.protected)
            return false;
        // Can't delete current branch
        if (branch.id === history.currentBranchId)
            return false;
        // Remove branch (keep checkpoints for potential recovery)
        history.branches.splice(branchIndex, 1);
        history.lastModified = new Date();
        return true;
    }
    rollback(historyId, steps = 1) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const branch = history.branches.find(b => b.id === history.currentBranchId);
        if (!branch)
            return null;
        const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
        if (!currentCheckpoint)
            return null;
        // Find checkpoint 'steps' back
        let targetCheckpointId = history.currentCheckpointId;
        let actualSteps = 0;
        for (let i = 0; i < steps; i++) {
            const checkpoint = this.checkpoints.get(targetCheckpointId);
            if (!checkpoint || !checkpoint.parentId)
                break;
            targetCheckpointId = checkpoint.parentId;
            actualSteps++;
        }
        if (actualSteps === 0)
            return null;
        const targetCheckpoint = this.checkpoints.get(targetCheckpointId);
        if (!targetCheckpoint)
            return null;
        history.currentCheckpointId = targetCheckpointId;
        history.lastModified = new Date();
        return {
            success: true,
            previousCheckpoint: currentCheckpoint,
            currentCheckpoint: targetCheckpoint,
            stepsRolledBack: actualSteps
        };
    }
    rollbackTo(historyId, checkpointId) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const targetCheckpoint = this.checkpoints.get(checkpointId);
        if (!targetCheckpoint)
            return null;
        const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
        if (!currentCheckpoint)
            return null;
        // Verify checkpoint is on current branch
        const branch = history.branches.find(b => b.id === history.currentBranchId);
        if (!branch || !branch.checkpoints.includes(checkpointId))
            return null;
        // Count steps
        const currentIndex = branch.checkpoints.indexOf(history.currentCheckpointId);
        const targetIndex = branch.checkpoints.indexOf(checkpointId);
        history.currentCheckpointId = checkpointId;
        history.lastModified = new Date();
        return {
            success: true,
            previousCheckpoint: currentCheckpoint,
            currentCheckpoint: targetCheckpoint,
            stepsRolledBack: currentIndex - targetIndex
        };
    }
    redo(historyId, steps = 1) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const branch = history.branches.find(b => b.id === history.currentBranchId);
        if (!branch)
            return null;
        const currentIndex = branch.checkpoints.indexOf(history.currentCheckpointId);
        const targetIndex = Math.min(currentIndex + steps, branch.checkpoints.length - 1);
        if (targetIndex === currentIndex)
            return null;
        const targetCheckpointId = branch.checkpoints[targetIndex];
        const targetCheckpoint = this.checkpoints.get(targetCheckpointId);
        if (!targetCheckpoint)
            return null;
        history.currentCheckpointId = targetCheckpointId;
        history.lastModified = new Date();
        return targetCheckpoint;
    }
    merge(historyId, sourceBranchName, strategy = 'interactive') {
        const history = this.histories.get(historyId);
        if (!history) {
            return { success: false, conflicts: [], strategy };
        }
        const sourceBranch = history.branches.find(b => b.name === sourceBranchName);
        const targetBranch = history.branches.find(b => b.id === history.currentBranchId);
        if (!sourceBranch || !targetBranch) {
            return { success: false, conflicts: [], strategy };
        }
        // Get head checkpoints
        const sourceCheckpointId = sourceBranch.checkpoints[sourceBranch.checkpoints.length - 1];
        const targetCheckpointId = targetBranch.checkpoints[targetBranch.checkpoints.length - 1];
        const sourceCheckpoint = this.checkpoints.get(sourceCheckpointId);
        const targetCheckpoint = this.checkpoints.get(targetCheckpointId);
        if (!sourceCheckpoint || !targetCheckpoint) {
            return { success: false, conflicts: [], strategy };
        }
        // Detect conflicts
        const conflicts = this.detectMergeConflicts(sourceCheckpoint.stance, targetCheckpoint.stance);
        // Resolve conflicts based on strategy
        const mergedStance = this.resolveConflicts(sourceCheckpoint.stance, targetCheckpoint.stance, conflicts, strategy);
        // Create merged checkpoint
        const mergedCheckpointId = `checkpoint-merge-${Date.now()}`;
        const mergedCheckpoint = {
            id: mergedCheckpointId,
            stance: mergedStance,
            name: `Merge ${sourceBranchName} into ${targetBranch.name}`,
            description: `Merged ${conflicts.length} conflicts using ${strategy} strategy`,
            parentId: targetCheckpointId,
            branchId: targetBranch.id,
            timestamp: new Date(),
            author: 'system',
            tags: ['merge'],
            metadata: {
                mergeSource: sourceBranchName,
                mergeStrategy: strategy,
                conflictCount: conflicts.length
            }
        };
        this.checkpoints.set(mergedCheckpointId, mergedCheckpoint);
        targetBranch.checkpoints.push(mergedCheckpointId);
        targetBranch.lastModified = new Date();
        history.currentCheckpointId = mergedCheckpointId;
        history.lastModified = new Date();
        return {
            success: true,
            mergedCheckpoint,
            conflicts,
            strategy
        };
    }
    detectMergeConflicts(source, target) {
        const conflicts = [];
        // Compare all fields
        const compareObjects = (s, t, prefix = '') => {
            const allKeys = new Set([...Object.keys(s), ...Object.keys(t)]);
            for (const key of allKeys) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                const sVal = s[key];
                const tVal = t[key];
                if (typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal) &&
                    typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal)) {
                    compareObjects(sVal, tVal, fullPath);
                }
                else if (JSON.stringify(sVal) !== JSON.stringify(tVal)) {
                    conflicts.push({
                        field: fullPath,
                        sourceValue: sVal,
                        targetValue: tVal
                    });
                }
            }
        };
        compareObjects(source, target);
        return conflicts;
    }
    resolveConflicts(_source, target, conflicts, strategy) {
        const merged = JSON.parse(JSON.stringify(target));
        for (const conflict of conflicts) {
            let resolvedValue;
            switch (strategy) {
                case 'ours':
                    resolvedValue = conflict.targetValue;
                    conflict.resolution = 'target';
                    break;
                case 'theirs':
                    resolvedValue = conflict.sourceValue;
                    conflict.resolution = 'source';
                    break;
                case 'average':
                    if (typeof conflict.sourceValue === 'number' && typeof conflict.targetValue === 'number') {
                        resolvedValue = Math.round((conflict.sourceValue + conflict.targetValue) / 2);
                    }
                    else {
                        resolvedValue = conflict.targetValue; // Fallback to ours
                    }
                    conflict.resolution = 'manual';
                    break;
                case 'interactive':
                default:
                    // Default to target for non-numeric, average for numeric
                    if (typeof conflict.sourceValue === 'number' && typeof conflict.targetValue === 'number') {
                        resolvedValue = Math.round((conflict.sourceValue + conflict.targetValue) / 2);
                    }
                    else {
                        resolvedValue = conflict.targetValue;
                    }
                    conflict.resolution = 'manual';
                    break;
            }
            conflict.resolvedValue = resolvedValue;
            this.setFieldValue(merged, conflict.field, resolvedValue);
        }
        return merged;
    }
    setFieldValue(stance, field, value) {
        const parts = field.split('.');
        let target = stance;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
    }
    getTimeline(historyId) {
        const history = this.histories.get(historyId);
        if (!history)
            return [];
        const timeline = [];
        for (const branch of history.branches) {
            for (let i = 0; i < branch.checkpoints.length; i++) {
                const checkpointId = branch.checkpoints[i];
                const checkpoint = this.checkpoints.get(checkpointId);
                if (!checkpoint)
                    continue;
                const children = branch.checkpoints.slice(i + 1, i + 2);
                timeline.push({
                    checkpoint,
                    branch,
                    depth: i,
                    isCurrentHead: checkpointId === history.currentCheckpointId,
                    children
                });
            }
        }
        // Sort by timestamp
        timeline.sort((a, b) => a.checkpoint.timestamp.getTime() - b.checkpoint.timestamp.getTime());
        return timeline;
    }
    garbageCollect(historyId, branchId) {
        const history = this.histories.get(historyId);
        if (!history) {
            return { checkpointsRemoved: 0, branchesRemoved: 0, spaceReclaimed: 0 };
        }
        let checkpointsRemoved = 0;
        let branchesRemoved = 0;
        // Remove old checkpoints from branches that exceed maxCheckpointsPerBranch
        for (const branch of history.branches) {
            if (branchId && branch.id !== branchId)
                continue;
            if (branch.protected)
                continue;
            if (branch.checkpoints.length > this.maxCheckpointsPerBranch) {
                const toRemove = branch.checkpoints.length - this.maxCheckpointsPerBranch;
                const removedIds = branch.checkpoints.splice(0, toRemove);
                for (const id of removedIds) {
                    // Only remove if not referenced by other branches
                    const isReferenced = history.branches.some(b => b.id !== branch.id && b.checkpoints.includes(id));
                    if (!isReferenced) {
                        this.checkpoints.delete(id);
                        checkpointsRemoved++;
                    }
                }
            }
        }
        // Remove empty non-default branches
        const emptyBranches = history.branches.filter(b => !b.isDefault && !b.protected && b.checkpoints.length === 0);
        for (const branch of emptyBranches) {
            const index = history.branches.indexOf(branch);
            if (index > -1) {
                history.branches.splice(index, 1);
                branchesRemoved++;
            }
        }
        return {
            checkpointsRemoved,
            branchesRemoved,
            spaceReclaimed: checkpointsRemoved * 1000 // Estimated bytes
        };
    }
    getHistory(historyId) {
        return this.histories.get(historyId);
    }
    getCurrentStance(historyId) {
        const history = this.histories.get(historyId);
        if (!history)
            return null;
        const checkpoint = this.checkpoints.get(history.currentCheckpointId);
        return checkpoint ? JSON.parse(JSON.stringify(checkpoint.stance)) : null;
    }
    getCheckpoint(checkpointId) {
        return this.checkpoints.get(checkpointId);
    }
    findCheckpointsByTag(historyId, tag) {
        const history = this.histories.get(historyId);
        if (!history)
            return [];
        const checkpointIds = new Set();
        for (const branch of history.branches) {
            for (const id of branch.checkpoints) {
                checkpointIds.add(id);
            }
        }
        return Array.from(checkpointIds)
            .map(id => this.checkpoints.get(id))
            .filter((cp) => cp !== undefined && cp.tags.includes(tag));
    }
    listBranches(historyId) {
        const history = this.histories.get(historyId);
        return history ? [...history.branches] : [];
    }
    protectBranch(historyId, branchName, protect) {
        const history = this.histories.get(historyId);
        if (!history)
            return false;
        const branch = history.branches.find(b => b.name === branchName);
        if (!branch)
            return false;
        branch.protected = protect;
        return true;
    }
    setMaxCheckpoints(max) {
        this.maxCheckpointsPerBranch = max;
    }
    setGcThreshold(threshold) {
        this.gcThreshold = threshold;
    }
}
export function createStanceVersionControl() {
    return new StanceVersionControl();
}
//# sourceMappingURL=branching.js.map