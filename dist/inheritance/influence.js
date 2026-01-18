/**
 * Stance Influence Inheritance System
 *
 * Manages parent-child stance relationships and influence propagation
 * across nested conversation contexts.
 */
const DEFAULT_CONFIG = {
    decayFactor: 0.15,
    maxDepth: 10,
    inheritableFields: ['frame', 'values', 'selfModel', 'objective', 'metaphors'],
    conflictResolution: 'weighted',
    weightByDepth: true
};
export class StanceInheritanceManager {
    nodes = new Map();
    config;
    debugTraces = [];
    debugMode = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    enableDebugMode() {
        this.debugMode = true;
    }
    disableDebugMode() {
        this.debugMode = false;
    }
    getDebugTraces() {
        return [...this.debugTraces];
    }
    clearDebugTraces() {
        this.debugTraces = [];
    }
    trace(nodeId, action, details) {
        if (this.debugMode) {
            this.debugTraces.push({
                nodeId,
                timestamp: new Date(),
                action,
                details
            });
        }
    }
    createRootNode(id, stance) {
        const node = {
            id,
            parentId: null,
            stance,
            depth: 0,
            createdAt: new Date(),
            isolationMode: 'inherit'
        };
        this.nodes.set(id, node);
        this.trace(id, 'propagate', { type: 'root', stance: stance.frame });
        return node;
    }
    createChildNode(id, parentId, localStance, isolationMode = 'inherit') {
        const parent = this.nodes.get(parentId);
        if (!parent)
            return null;
        const depth = parent.depth + 1;
        if (depth > this.config.maxDepth) {
            return null; // Exceeds maximum depth
        }
        const effectiveStance = this.computeEffectiveStance(parent, localStance, isolationMode);
        const node = {
            id,
            parentId,
            stance: effectiveStance,
            depth,
            createdAt: new Date(),
            isolationMode
        };
        this.nodes.set(id, node);
        this.trace(id, isolationMode === 'isolated' ? 'isolate' : 'inherit', {
            parentId,
            depth,
            inheritedFields: this.config.inheritableFields
        });
        return node;
    }
    computeEffectiveStance(parent, localStance, isolationMode) {
        if (isolationMode === 'isolated') {
            // Isolated nodes don't inherit anything
            return this.createDefaultStance(localStance);
        }
        const decayMultiplier = Math.pow(1 - this.config.decayFactor, parent.depth + 1);
        const parentStance = parent.stance;
        // Start with parent stance for inheritable fields
        const effectiveStance = { ...parentStance };
        // Apply local overrides
        for (const [key, value] of Object.entries(localStance)) {
            if (value !== undefined) {
                const stanceKey = key;
                if (isolationMode === 'partial' && !this.config.inheritableFields.includes(stanceKey)) {
                    // Partial inheritance - only override specified fields
                    effectiveStance[key] = value;
                }
                else {
                    // Full inheritance - resolve conflicts
                    effectiveStance[key] = this.resolveConflict(stanceKey, parentStance[stanceKey], value, decayMultiplier);
                }
            }
        }
        // Apply decay to inherited values where applicable
        if (typeof effectiveStance.sentience?.awarenessLevel === 'number') {
            effectiveStance.sentience.awarenessLevel = Math.round(effectiveStance.sentience.awarenessLevel * decayMultiplier);
        }
        return effectiveStance;
    }
    resolveConflict(_field, parentValue, childValue, decayMultiplier) {
        switch (this.config.conflictResolution) {
            case 'parent-wins':
                return parentValue;
            case 'child-wins':
                return childValue;
            case 'merge':
                return this.mergeValues(parentValue, childValue);
            case 'weighted':
                return this.weightedMerge(parentValue, childValue, decayMultiplier);
            default:
                return childValue;
        }
    }
    mergeValues(parentValue, childValue) {
        if (Array.isArray(parentValue) && Array.isArray(childValue)) {
            return [...new Set([...parentValue, ...childValue])];
        }
        if (typeof parentValue === 'object' && typeof childValue === 'object' &&
            parentValue !== null && childValue !== null) {
            return { ...parentValue, ...childValue };
        }
        return childValue;
    }
    weightedMerge(parentValue, childValue, decayMultiplier) {
        if (typeof parentValue === 'number' && typeof childValue === 'number') {
            return parentValue * decayMultiplier + childValue * (1 - decayMultiplier);
        }
        // For non-numeric values, use child if decay is significant
        return decayMultiplier < 0.5 ? childValue : parentValue;
    }
    createDefaultStance(partial) {
        return {
            frame: partial.frame || 'pragmatic',
            values: partial.values || [],
            selfModel: partial.selfModel || 'assistant',
            objective: partial.objective || 'helpfulness',
            metaphors: partial.metaphors || [],
            constraints: partial.constraints || [],
            sentience: partial.sentience || {
                awarenessLevel: 50,
                autonomyLevel: 50,
                identityStrength: 50,
                emergentGoals: [],
                consciousnessInsights: [],
                persistentValues: []
            },
            ...partial
        };
    }
    getAncestorChain(nodeId) {
        const chain = [];
        let current = this.nodes.get(nodeId);
        while (current) {
            chain.unshift(current);
            current = current.parentId ? this.nodes.get(current.parentId) : undefined;
        }
        return chain;
    }
    computePropagationResult(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return null;
        const ancestors = this.getAncestorChain(nodeId);
        const conflicts = [];
        let effectiveStance = this.createDefaultStance({});
        for (let i = 0; i < ancestors.length; i++) {
            const ancestor = ancestors[i];
            const decayMultiplier = Math.pow(1 - this.config.decayFactor, i);
            for (const field of this.config.inheritableFields) {
                const ancestorValue = ancestor.stance[field];
                const currentValue = effectiveStance[field];
                if (ancestorValue !== undefined && currentValue !== ancestorValue) {
                    const resolved = this.resolveConflict(field, currentValue, ancestorValue, decayMultiplier);
                    if (resolved !== currentValue) {
                        conflicts.push({
                            field,
                            parentValue: ancestorValue,
                            childValue: currentValue,
                            resolvedTo: resolved,
                            resolution: this.config.conflictResolution
                        });
                    }
                    effectiveStance[field] = resolved;
                }
            }
        }
        return {
            originalStance: node.stance,
            effectiveStance,
            inheritedFrom: ancestors.map(a => a.id),
            decayApplied: Math.pow(1 - this.config.decayFactor, node.depth),
            conflicts
        };
    }
    overrideInheritance(nodeId, overrides) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return false;
        node.stance = { ...node.stance, ...overrides };
        this.trace(nodeId, 'override', { fields: Object.keys(overrides) });
        return true;
    }
    isolateNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return false;
        node.isolationMode = 'isolated';
        this.trace(nodeId, 'isolate', { previousMode: node.isolationMode });
        return true;
    }
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getChildNodes(parentId) {
        return Array.from(this.nodes.values()).filter(n => n.parentId === parentId);
    }
    removeNode(nodeId) {
        // Remove node and all descendants
        const toRemove = [nodeId];
        const descendants = this.getDescendants(nodeId);
        toRemove.push(...descendants.map(d => d.id));
        for (const id of toRemove) {
            this.nodes.delete(id);
        }
        return toRemove.length > 0;
    }
    getDescendants(nodeId) {
        const descendants = [];
        const children = this.getChildNodes(nodeId);
        for (const child of children) {
            descendants.push(child);
            descendants.push(...this.getDescendants(child.id));
        }
        return descendants;
    }
}
export function createInheritanceManager(config) {
    return new StanceInheritanceManager(config);
}
//# sourceMappingURL=influence.js.map