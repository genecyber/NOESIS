/**
 * Semantic Stance Versioning
 *
 * Git-like version control for stances with semantic diffing,
 * branching, merging, and rollback capabilities.
 */
export class StanceVersionControl {
    versions = new Map();
    branches = new Map();
    currentBranch = 'main';
    headVersion = null;
    constructor() {
        // Initialize main branch
        this.branches.set('main', {
            name: 'main',
            headVersionId: '',
            createdAt: new Date(),
            description: 'Main development branch',
            protected: true
        });
    }
    commit(stance, message, author = 'system', tags = []) {
        const version = {
            id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            stance: JSON.parse(JSON.stringify(stance)),
            parentId: this.headVersion,
            branchName: this.currentBranch,
            message,
            author,
            timestamp: new Date(),
            tags
        };
        this.versions.set(version.id, version);
        this.headVersion = version.id;
        // Update branch head
        const branch = this.branches.get(this.currentBranch);
        if (branch) {
            branch.headVersionId = version.id;
        }
        return version;
    }
    createBranch(name, fromVersionId, description) {
        if (this.branches.has(name))
            return null;
        const sourceVersionId = fromVersionId || this.headVersion;
        if (!sourceVersionId)
            return null;
        const branch = {
            name,
            headVersionId: sourceVersionId,
            createdAt: new Date(),
            description,
            protected: false
        };
        this.branches.set(name, branch);
        return branch;
    }
    checkout(branchName) {
        const branch = this.branches.get(branchName);
        if (!branch)
            return false;
        this.currentBranch = branchName;
        this.headVersion = branch.headVersionId;
        return true;
    }
    diff(versionIdA, versionIdB) {
        const versionA = this.versions.get(versionIdA);
        const versionB = this.versions.get(versionIdB);
        if (!versionA || !versionB)
            return null;
        const changes = this.computeChanges(versionA.stance, versionB.stance);
        const summary = this.summarizeChanges(changes);
        return {
            versionA: versionIdA,
            versionB: versionIdB,
            changes,
            summary,
            conflictRisk: this.assessConflictRisk(changes)
        };
    }
    computeChanges(stanceA, stanceB) {
        const changes = [];
        // Compare top-level fields
        const fields = ['frame', 'selfModel', 'objective', 'metaphors', 'constraints'];
        for (const field of fields) {
            const valueA = stanceA[field];
            const valueB = stanceB[field];
            if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
                changes.push({
                    field,
                    path: field,
                    type: 'modified',
                    oldValue: valueA,
                    newValue: valueB,
                    semanticImpact: this.assessSemanticImpact(field, valueA, valueB)
                });
            }
        }
        // Compare values (numeric weights)
        const valueKeys = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
        for (const key of valueKeys) {
            if (stanceA.values[key] !== stanceB.values[key]) {
                changes.push({
                    field: 'values',
                    path: `values.${key}`,
                    type: 'modified',
                    oldValue: stanceA.values[key],
                    newValue: stanceB.values[key],
                    semanticImpact: {
                        category: 'values',
                        magnitude: Math.abs(stanceA.values[key] - stanceB.values[key]) > 30 ? 'major' : 'moderate',
                        description: `Value weight ${key} changed by ${stanceB.values[key] - stanceA.values[key]}`
                    }
                });
            }
        }
        // Compare sentience
        const sentienceKeys = ['awarenessLevel', 'autonomyLevel', 'identityStrength'];
        for (const key of sentienceKeys) {
            const valA = stanceA.sentience[key];
            const valB = stanceB.sentience[key];
            if (valA !== valB) {
                changes.push({
                    field: 'sentience',
                    path: `sentience.${key}`,
                    type: 'modified',
                    oldValue: valA,
                    newValue: valB,
                    semanticImpact: {
                        category: 'identity',
                        magnitude: typeof valA === 'number' && typeof valB === 'number' && Math.abs(valA - valB) > 30 ? 'major' : 'moderate',
                        description: `Sentience ${key} changed`
                    }
                });
            }
        }
        return changes;
    }
    assessSemanticImpact(field, _oldValue, _newValue) {
        const impactMap = {
            frame: { category: 'behavior', magnitude: 'major' },
            selfModel: { category: 'identity', magnitude: 'major' },
            objective: { category: 'behavior', magnitude: 'major' },
            metaphors: { category: 'presentation', magnitude: 'minor' },
            constraints: { category: 'behavior', magnitude: 'moderate' },
            values: { category: 'values', magnitude: 'moderate' },
            sentience: { category: 'identity', magnitude: 'major' }
        };
        const impact = impactMap[field] || { category: 'behavior', magnitude: 'minor' };
        return {
            ...impact,
            description: `Changed ${field} field`
        };
    }
    summarizeChanges(changes) {
        const breakingChanges = changes.filter(c => c.semanticImpact.magnitude === 'major' &&
            (c.semanticImpact.category === 'identity' || c.semanticImpact.category === 'behavior')).length;
        return {
            totalChanges: changes.length,
            addedFields: changes.filter(c => c.type === 'added').length,
            removedFields: changes.filter(c => c.type === 'removed').length,
            modifiedFields: changes.filter(c => c.type === 'modified').length,
            breakingChanges,
            description: breakingChanges > 0
                ? `${changes.length} changes including ${breakingChanges} breaking changes`
                : `${changes.length} changes`
        };
    }
    assessConflictRisk(changes) {
        const majorChanges = changes.filter(c => c.semanticImpact.magnitude === 'major').length;
        if (majorChanges >= 3)
            return 'high';
        if (majorChanges >= 1)
            return 'medium';
        if (changes.length > 5)
            return 'low';
        return 'none';
    }
    merge(sourceBranch, targetBranch = this.currentBranch) {
        const source = this.branches.get(sourceBranch);
        const target = this.branches.get(targetBranch);
        if (!source || !target) {
            return {
                success: false,
                conflicts: [],
                resolvedAutomatically: [],
                requiresManualResolution: []
            };
        }
        const sourceVersion = this.versions.get(source.headVersionId);
        const targetVersion = this.versions.get(target.headVersionId);
        if (!sourceVersion || !targetVersion) {
            return {
                success: false,
                conflicts: [],
                resolvedAutomatically: [],
                requiresManualResolution: []
            };
        }
        const diff = this.diff(target.headVersionId, source.headVersionId);
        if (!diff) {
            return {
                success: false,
                conflicts: [],
                resolvedAutomatically: [],
                requiresManualResolution: []
            };
        }
        const conflicts = [];
        const resolvedAutomatically = [];
        const mergedStance = JSON.parse(JSON.stringify(targetVersion.stance));
        for (const change of diff.changes) {
            if (change.semanticImpact.magnitude === 'major') {
                // Major changes require review
                conflicts.push({
                    field: change.path,
                    sourceValue: change.newValue,
                    targetValue: change.oldValue,
                    suggestedResolution: change.newValue,
                    resolutionStrategy: 'use-source'
                });
            }
            else {
                // Minor/moderate changes auto-merge
                this.applyChange(mergedStance, change);
                resolvedAutomatically.push(change.path);
            }
        }
        if (conflicts.length === 0) {
            // Create merge commit
            this.commit(mergedStance, `Merge ${sourceBranch} into ${targetBranch}`, 'system', ['merge']);
            return {
                success: true,
                mergedStance,
                conflicts: [],
                resolvedAutomatically,
                requiresManualResolution: []
            };
        }
        return {
            success: false,
            mergedStance,
            conflicts,
            resolvedAutomatically,
            requiresManualResolution: conflicts.map(c => c.field)
        };
    }
    applyChange(stance, change) {
        const pathParts = change.path.split('.');
        if (pathParts.length === 1) {
            stance[pathParts[0]] = change.newValue;
        }
        else if (pathParts.length === 2) {
            const [parent, child] = pathParts;
            (stance[parent])[child] = change.newValue;
        }
    }
    resolveConflict(conflict, resolution) {
        conflict.suggestedResolution = resolution;
        conflict.resolutionStrategy = 'manual';
    }
    cherryPick(versionId) {
        const version = this.versions.get(versionId);
        if (!version || !version.parentId) {
            return {
                success: false,
                appliedChanges: [],
                skippedChanges: [],
                conflicts: []
            };
        }
        const diff = this.diff(version.parentId, versionId);
        if (!diff) {
            return {
                success: false,
                appliedChanges: [],
                skippedChanges: [],
                conflicts: []
            };
        }
        const currentHead = this.headVersion ? this.versions.get(this.headVersion) : null;
        if (!currentHead) {
            return {
                success: false,
                appliedChanges: [],
                skippedChanges: [],
                conflicts: []
            };
        }
        const newStance = JSON.parse(JSON.stringify(currentHead.stance));
        const appliedChanges = [];
        const skippedChanges = [];
        const conflicts = [];
        for (const change of diff.changes) {
            try {
                this.applyChange(newStance, change);
                appliedChanges.push(change);
            }
            catch {
                skippedChanges.push(change);
                conflicts.push({
                    field: change.path,
                    sourceValue: change.newValue,
                    targetValue: change.oldValue,
                    resolutionStrategy: 'manual'
                });
            }
        }
        if (conflicts.length === 0) {
            const newVersion = this.commit(newStance, `Cherry-pick ${versionId.substring(0, 8)}: ${version.message}`, 'system', ['cherry-pick']);
            return {
                success: true,
                newVersionId: newVersion.id,
                appliedChanges,
                skippedChanges,
                conflicts
            };
        }
        return {
            success: false,
            appliedChanges,
            skippedChanges,
            conflicts
        };
    }
    rollback(toVersionId) {
        const targetVersion = this.versions.get(toVersionId);
        if (!targetVersion) {
            return {
                success: false,
                rolledBackVersions: [],
                message: 'Target version not found'
            };
        }
        const rolledBackVersions = [];
        let current = this.headVersion;
        while (current && current !== toVersionId) {
            rolledBackVersions.push(current);
            const version = this.versions.get(current);
            current = version?.parentId || null;
        }
        if (current !== toVersionId) {
            return {
                success: false,
                rolledBackVersions: [],
                message: 'Target version not in history chain'
            };
        }
        // Create rollback commit
        const newVersion = this.commit(targetVersion.stance, `Rollback to ${toVersionId.substring(0, 8)}`, 'system', ['rollback']);
        return {
            success: true,
            newVersionId: newVersion.id,
            rolledBackVersions,
            message: `Rolled back ${rolledBackVersions.length} versions`
        };
    }
    getVersion(id) {
        return this.versions.get(id);
    }
    getVersionHistory(branchName) {
        const branch = branchName || this.currentBranch;
        const branchData = this.branches.get(branch);
        if (!branchData)
            return [];
        const history = [];
        let current = branchData.headVersionId;
        while (current) {
            const version = this.versions.get(current);
            if (!version)
                break;
            history.push(version);
            current = version.parentId;
        }
        return history;
    }
    getBranches() {
        return Array.from(this.branches.values());
    }
    getCurrentBranch() {
        return this.currentBranch;
    }
    getHead() {
        return this.headVersion ? this.versions.get(this.headVersion) || null : null;
    }
    tag(versionId, tag) {
        const version = this.versions.get(versionId);
        if (!version)
            return false;
        if (!version.tags.includes(tag)) {
            version.tags.push(tag);
        }
        return true;
    }
    findByTag(tag) {
        return Array.from(this.versions.values()).filter(v => v.tags.includes(tag));
    }
}
export function createVersionControl() {
    return new StanceVersionControl();
}
//# sourceMappingURL=semantic.js.map