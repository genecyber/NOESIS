/**
 * Inheritance Chain Visualization
 *
 * Visual graph of template inheritance hierarchies with
 * debug mode, conflict highlighting, and property tracing.
 */
import type { Stance } from '../types/index.js';
export interface InheritanceGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    conflicts: InheritanceConflict[];
    metadata: GraphMetadata;
}
export interface GraphNode {
    id: string;
    name: string;
    type: 'template' | 'stance' | 'override' | 'mixin';
    stance: Partial<Stance>;
    depth: number;
    isRoot: boolean;
    isLeaf: boolean;
    position?: {
        x: number;
        y: number;
    };
    style: NodeStyle;
}
export interface NodeStyle {
    color: string;
    borderColor: string;
    borderWidth: number;
    shape: 'rectangle' | 'ellipse' | 'diamond';
    opacity: number;
}
export interface GraphEdge {
    id: string;
    from: string;
    to: string;
    type: EdgeType;
    overriddenFields: string[];
    style: EdgeStyle;
}
export type EdgeType = 'extends' | 'implements' | 'overrides' | 'mixes';
export interface EdgeStyle {
    color: string;
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
    animated: boolean;
}
export interface InheritanceConflict {
    id: string;
    field: string;
    sources: ConflictSource[];
    resolution: ConflictResolution;
    severity: 'warning' | 'error';
}
export interface ConflictSource {
    nodeId: string;
    nodeName: string;
    value: unknown;
    priority: number;
}
export interface ConflictResolution {
    strategy: 'first-wins' | 'last-wins' | 'merge' | 'manual';
    resolvedValue: unknown;
    resolvedFrom: string;
}
export interface GraphMetadata {
    totalNodes: number;
    maxDepth: number;
    conflictCount: number;
    overrideCount: number;
    generatedAt: Date;
}
export interface PropertyTrace {
    field: string;
    finalValue: unknown;
    sources: PropertySource[];
    overrideChain: OverrideStep[];
}
export interface PropertySource {
    nodeId: string;
    nodeName: string;
    value: unknown;
    depth: number;
    wasOverridden: boolean;
}
export interface OverrideStep {
    from: string;
    to: string;
    previousValue: unknown;
    newValue: unknown;
    reason?: string;
}
export interface TemplateDiff {
    template1: string;
    template2: string;
    additions: FieldDiff[];
    removals: FieldDiff[];
    modifications: FieldDiff[];
    similarity: number;
}
export interface FieldDiff {
    field: string;
    value1?: unknown;
    value2?: unknown;
    changeType: 'added' | 'removed' | 'modified';
}
export interface DebugSession {
    id: string;
    graph: InheritanceGraph;
    breakpoints: Breakpoint[];
    watchedFields: string[];
    executionLog: DebugLogEntry[];
    isActive: boolean;
}
export interface Breakpoint {
    nodeId: string;
    field?: string;
    condition?: string;
    enabled: boolean;
}
export interface DebugLogEntry {
    timestamp: Date;
    nodeId: string;
    field: string;
    action: 'read' | 'write' | 'override' | 'conflict';
    value: unknown;
    previousValue?: unknown;
}
export interface Template {
    id: string;
    name: string;
    extends?: string[];
    stance: Partial<Stance>;
    priority: number;
    description?: string;
}
export declare class InheritanceVisualizer {
    private templates;
    private debugSessions;
    private onConflictCallbacks;
    registerTemplate(template: Template): void;
    removeTemplate(templateId: string): boolean;
    buildGraph(rootTemplateId: string): InheritanceGraph;
    private buildNodeRecursive;
    private findOverriddenFields;
    private detectConflicts;
    private extractFieldSources;
    private resolveConflict;
    private calculatePositions;
    traceProperty(templateId: string, field: string): PropertyTrace;
    private tracePropertyRecursive;
    private getFieldValue;
    generateDiff(template1Id: string, template2Id: string): TemplateDiff;
    private getAllFields;
    startDebugSession(graphId: string): DebugSession;
    addBreakpoint(sessionId: string, nodeId: string, field?: string, condition?: string): boolean;
    watchField(sessionId: string, field: string): boolean;
    logDebugEvent(sessionId: string, entry: Omit<DebugLogEntry, 'timestamp'>): void;
    getDebugSession(sessionId: string): DebugSession | undefined;
    endDebugSession(sessionId: string): void;
    onConflict(callback: (conflict: InheritanceConflict) => void): () => void;
    private notifyConflict;
    getTemplate(templateId: string): Template | undefined;
    listTemplates(): Template[];
    exportGraph(graph: InheritanceGraph, format: 'json' | 'dot' | 'mermaid'): string;
    private toGraphviz;
    private toMermaid;
}
export declare function createInheritanceVisualizer(): InheritanceVisualizer;
//# sourceMappingURL=visualization.d.ts.map