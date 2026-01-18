/**
 * Stance Influence Inheritance System
 *
 * Manages parent-child stance relationships and influence propagation
 * across nested conversation contexts.
 */
import type { Stance } from '../types/index.js';
export interface ConversationNode {
    id: string;
    parentId: string | null;
    stance: Stance;
    depth: number;
    createdAt: Date;
    isolationMode: 'inherit' | 'partial' | 'isolated';
}
export interface InheritanceConfig {
    decayFactor: number;
    maxDepth: number;
    inheritableFields: (keyof Stance)[];
    conflictResolution: 'parent-wins' | 'child-wins' | 'merge' | 'weighted';
    weightByDepth: boolean;
}
export interface PropagationResult {
    originalStance: Stance;
    effectiveStance: Stance;
    inheritedFrom: string[];
    decayApplied: number;
    conflicts: InheritanceConflict[];
}
export interface InheritanceConflict {
    field: keyof Stance;
    parentValue: unknown;
    childValue: unknown;
    resolvedTo: unknown;
    resolution: string;
}
export interface DebugTrace {
    nodeId: string;
    timestamp: Date;
    action: 'inherit' | 'override' | 'isolate' | 'propagate';
    details: Record<string, unknown>;
}
export declare class StanceInheritanceManager {
    private nodes;
    private config;
    private debugTraces;
    private debugMode;
    constructor(config?: Partial<InheritanceConfig>);
    enableDebugMode(): void;
    disableDebugMode(): void;
    getDebugTraces(): DebugTrace[];
    clearDebugTraces(): void;
    private trace;
    createRootNode(id: string, stance: Stance): ConversationNode;
    createChildNode(id: string, parentId: string, localStance: Partial<Stance>, isolationMode?: ConversationNode['isolationMode']): ConversationNode | null;
    private computeEffectiveStance;
    private resolveConflict;
    private mergeValues;
    private weightedMerge;
    private createDefaultStance;
    getAncestorChain(nodeId: string): ConversationNode[];
    computePropagationResult(nodeId: string): PropagationResult | null;
    overrideInheritance(nodeId: string, overrides: Partial<Stance>): boolean;
    isolateNode(nodeId: string): boolean;
    getNode(nodeId: string): ConversationNode | undefined;
    getAllNodes(): ConversationNode[];
    getChildNodes(parentId: string): ConversationNode[];
    removeNode(nodeId: string): boolean;
    private getDescendants;
}
export declare function createInheritanceManager(config?: Partial<InheritanceConfig>): StanceInheritanceManager;
//# sourceMappingURL=influence.d.ts.map