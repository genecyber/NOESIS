/**
 * Inheritance Chain Visualization
 *
 * Visual graph of template inheritance hierarchies with
 * debug mode, conflict highlighting, and property tracing.
 */
const NODE_COLORS = {
    template: '#4A90D9',
    stance: '#7CB342',
    override: '#FFA726',
    mixin: '#AB47BC'
};
export class InheritanceVisualizer {
    templates = new Map();
    debugSessions = new Map();
    onConflictCallbacks = [];
    registerTemplate(template) {
        this.templates.set(template.id, template);
    }
    removeTemplate(templateId) {
        return this.templates.delete(templateId);
    }
    buildGraph(rootTemplateId) {
        const nodes = [];
        const edges = [];
        const conflicts = [];
        const visited = new Set();
        // Build graph recursively
        this.buildNodeRecursive(rootTemplateId, nodes, edges, visited, 0);
        // Detect conflicts
        conflicts.push(...this.detectConflicts(nodes, edges));
        // Calculate positions
        this.calculatePositions(nodes, edges);
        return {
            nodes,
            edges,
            conflicts,
            metadata: {
                totalNodes: nodes.length,
                maxDepth: Math.max(...nodes.map(n => n.depth), 0),
                conflictCount: conflicts.length,
                overrideCount: edges.filter(e => e.type === 'overrides').length,
                generatedAt: new Date()
            }
        };
    }
    buildNodeRecursive(templateId, nodes, edges, visited, depth) {
        if (visited.has(templateId))
            return;
        visited.add(templateId);
        const template = this.templates.get(templateId);
        if (!template)
            return;
        const node = {
            id: template.id,
            name: template.name,
            type: 'template',
            stance: template.stance,
            depth,
            isRoot: depth === 0,
            isLeaf: !template.extends || template.extends.length === 0,
            style: {
                color: NODE_COLORS.template,
                borderColor: '#333',
                borderWidth: 2,
                shape: 'rectangle',
                opacity: 1
            }
        };
        nodes.push(node);
        // Process parent templates
        if (template.extends) {
            for (const parentId of template.extends) {
                edges.push({
                    id: `edge-${parentId}-${templateId}`,
                    from: parentId,
                    to: templateId,
                    type: 'extends',
                    overriddenFields: this.findOverriddenFields(parentId, templateId),
                    style: {
                        color: '#666',
                        width: 2,
                        style: 'solid',
                        animated: false
                    }
                });
                this.buildNodeRecursive(parentId, nodes, edges, visited, depth + 1);
            }
        }
    }
    findOverriddenFields(parentId, childId) {
        const parent = this.templates.get(parentId);
        const child = this.templates.get(childId);
        if (!parent || !child)
            return [];
        const overridden = [];
        const checkOverrides = (parentObj, childObj, prefix = '') => {
            for (const key of Object.keys(childObj)) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                if (key in parentObj) {
                    if (typeof childObj[key] === 'object' && childObj[key] !== null &&
                        typeof parentObj[key] === 'object' && parentObj[key] !== null) {
                        checkOverrides(parentObj[key], childObj[key], fullPath);
                    }
                    else if (JSON.stringify(parentObj[key]) !== JSON.stringify(childObj[key])) {
                        overridden.push(fullPath);
                    }
                }
            }
        };
        checkOverrides(parent.stance, child.stance);
        return overridden;
    }
    detectConflicts(nodes, edges) {
        const conflicts = [];
        // Find diamond inheritance patterns
        for (const node of nodes) {
            const parents = edges.filter(e => e.to === node.id).map(e => e.from);
            if (parents.length <= 1)
                continue;
            // Check for conflicting field definitions
            const fieldSources = new Map();
            for (const parentId of parents) {
                const parent = this.templates.get(parentId);
                if (!parent)
                    continue;
                this.extractFieldSources(parent, parentId, fieldSources);
            }
            // Identify conflicts where multiple parents define the same field differently
            for (const [field, sources] of fieldSources) {
                if (sources.length > 1) {
                    const uniqueValues = new Set(sources.map(s => JSON.stringify(s.value)));
                    if (uniqueValues.size > 1) {
                        const conflict = {
                            id: `conflict-${node.id}-${field}`,
                            field,
                            sources,
                            resolution: this.resolveConflict(sources),
                            severity: 'warning'
                        };
                        conflicts.push(conflict);
                        this.notifyConflict(conflict);
                    }
                }
            }
        }
        return conflicts;
    }
    extractFieldSources(template, nodeId, fieldSources) {
        const traverse = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    traverse(value, fullPath);
                }
                else {
                    const sources = fieldSources.get(fullPath) || [];
                    sources.push({
                        nodeId,
                        nodeName: template.name,
                        value,
                        priority: template.priority
                    });
                    fieldSources.set(fullPath, sources);
                }
            }
        };
        traverse(template.stance);
    }
    resolveConflict(sources) {
        // Sort by priority (higher wins)
        const sorted = [...sources].sort((a, b) => b.priority - a.priority);
        const winner = sorted[0];
        return {
            strategy: 'first-wins',
            resolvedValue: winner.value,
            resolvedFrom: winner.nodeId
        };
    }
    calculatePositions(nodes, _edges) {
        // Group nodes by depth
        const depthGroups = new Map();
        for (const node of nodes) {
            const group = depthGroups.get(node.depth) || [];
            group.push(node);
            depthGroups.set(node.depth, group);
        }
        // Assign positions
        const levelWidth = 200;
        const nodeSpacing = 150;
        for (const [depth, group] of depthGroups) {
            const startX = -(group.length - 1) * nodeSpacing / 2;
            for (let i = 0; i < group.length; i++) {
                group[i].position = {
                    x: startX + i * nodeSpacing,
                    y: depth * levelWidth
                };
            }
        }
    }
    traceProperty(templateId, field) {
        const sources = [];
        const overrideChain = [];
        this.tracePropertyRecursive(templateId, field, sources, overrideChain, 0);
        // Determine final value
        const finalSource = sources.find(s => !s.wasOverridden);
        const finalValue = finalSource?.value;
        return {
            field,
            finalValue,
            sources,
            overrideChain
        };
    }
    tracePropertyRecursive(templateId, field, sources, overrideChain, depth) {
        const template = this.templates.get(templateId);
        if (!template)
            return;
        const value = this.getFieldValue(template.stance, field);
        const wasOverridden = sources.length > 0 && sources[sources.length - 1].value !== undefined;
        if (value !== undefined) {
            sources.push({
                nodeId: templateId,
                nodeName: template.name,
                value,
                depth,
                wasOverridden
            });
            if (wasOverridden) {
                const prevSource = sources[sources.length - 2];
                overrideChain.push({
                    from: prevSource.nodeId,
                    to: templateId,
                    previousValue: prevSource.value,
                    newValue: value
                });
            }
        }
        if (template.extends) {
            for (const parentId of template.extends) {
                this.tracePropertyRecursive(parentId, field, sources, overrideChain, depth + 1);
            }
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
    generateDiff(template1Id, template2Id) {
        const t1 = this.templates.get(template1Id);
        const t2 = this.templates.get(template2Id);
        if (!t1 || !t2) {
            return {
                template1: template1Id,
                template2: template2Id,
                additions: [],
                removals: [],
                modifications: [],
                similarity: 0
            };
        }
        const additions = [];
        const removals = [];
        const modifications = [];
        const fields1 = new Set(this.getAllFields(t1.stance));
        const fields2 = new Set(this.getAllFields(t2.stance));
        // Find additions (in t2 but not t1)
        for (const field of fields2) {
            if (!fields1.has(field)) {
                additions.push({
                    field,
                    value2: this.getFieldValue(t2.stance, field),
                    changeType: 'added'
                });
            }
        }
        // Find removals (in t1 but not t2)
        for (const field of fields1) {
            if (!fields2.has(field)) {
                removals.push({
                    field,
                    value1: this.getFieldValue(t1.stance, field),
                    changeType: 'removed'
                });
            }
        }
        // Find modifications (different values)
        for (const field of fields1) {
            if (fields2.has(field)) {
                const v1 = this.getFieldValue(t1.stance, field);
                const v2 = this.getFieldValue(t2.stance, field);
                if (JSON.stringify(v1) !== JSON.stringify(v2)) {
                    modifications.push({
                        field,
                        value1: v1,
                        value2: v2,
                        changeType: 'modified'
                    });
                }
            }
        }
        // Calculate similarity
        const totalFields = new Set([...fields1, ...fields2]).size;
        const unchangedFields = totalFields - additions.length - removals.length - modifications.length;
        const similarity = totalFields > 0 ? (unchangedFields / totalFields) * 100 : 100;
        return {
            template1: template1Id,
            template2: template2Id,
            additions,
            removals,
            modifications,
            similarity: Math.round(similarity)
        };
    }
    getAllFields(stance) {
        const fields = [];
        const traverse = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    traverse(value, fullPath);
                }
                else {
                    fields.push(fullPath);
                }
            }
        };
        traverse(stance);
        return fields;
    }
    startDebugSession(graphId) {
        const graph = this.buildGraph(graphId);
        const session = {
            id: `debug-${Date.now()}`,
            graph,
            breakpoints: [],
            watchedFields: [],
            executionLog: [],
            isActive: true
        };
        this.debugSessions.set(session.id, session);
        return session;
    }
    addBreakpoint(sessionId, nodeId, field, condition) {
        const session = this.debugSessions.get(sessionId);
        if (!session)
            return false;
        session.breakpoints.push({
            nodeId,
            field,
            condition,
            enabled: true
        });
        return true;
    }
    watchField(sessionId, field) {
        const session = this.debugSessions.get(sessionId);
        if (!session)
            return false;
        if (!session.watchedFields.includes(field)) {
            session.watchedFields.push(field);
        }
        return true;
    }
    logDebugEvent(sessionId, entry) {
        const session = this.debugSessions.get(sessionId);
        if (!session || !session.isActive)
            return;
        session.executionLog.push({
            ...entry,
            timestamp: new Date()
        });
        // Limit log size
        if (session.executionLog.length > 1000) {
            session.executionLog = session.executionLog.slice(-500);
        }
    }
    getDebugSession(sessionId) {
        return this.debugSessions.get(sessionId);
    }
    endDebugSession(sessionId) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            session.isActive = false;
        }
    }
    onConflict(callback) {
        this.onConflictCallbacks.push(callback);
        return () => {
            const idx = this.onConflictCallbacks.indexOf(callback);
            if (idx > -1)
                this.onConflictCallbacks.splice(idx, 1);
        };
    }
    notifyConflict(conflict) {
        for (const callback of this.onConflictCallbacks) {
            callback(conflict);
        }
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    listTemplates() {
        return Array.from(this.templates.values());
    }
    exportGraph(graph, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(graph, null, 2);
            case 'dot':
                return this.toGraphviz(graph);
            case 'mermaid':
                return this.toMermaid(graph);
            default:
                return JSON.stringify(graph, null, 2);
        }
    }
    toGraphviz(graph) {
        const lines = ['digraph InheritanceGraph {'];
        lines.push('  rankdir=BT;');
        for (const node of graph.nodes) {
            lines.push(`  "${node.id}" [label="${node.name}", shape=${node.style.shape}];`);
        }
        for (const edge of graph.edges) {
            lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];`);
        }
        lines.push('}');
        return lines.join('\n');
    }
    toMermaid(graph) {
        const lines = ['graph BT'];
        for (const node of graph.nodes) {
            lines.push(`  ${node.id}["${node.name}"]`);
        }
        for (const edge of graph.edges) {
            lines.push(`  ${edge.from} --> ${edge.to}`);
        }
        return lines.join('\n');
    }
}
export function createInheritanceVisualizer() {
    return new InheritanceVisualizer();
}
//# sourceMappingURL=visualization.js.map