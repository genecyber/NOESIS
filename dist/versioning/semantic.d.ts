/**
 * Semantic Stance Versioning
 *
 * Git-like version control for stances with semantic diffing,
 * branching, merging, and rollback capabilities.
 */
import type { Stance } from '../types/index.js';
export interface StanceVersion {
    id: string;
    stance: Stance;
    parentId: string | null;
    branchName: string;
    message: string;
    author: string;
    timestamp: Date;
    tags: string[];
}
export interface StanceBranch {
    name: string;
    headVersionId: string;
    createdAt: Date;
    description?: string;
    protected: boolean;
}
export interface SemanticDiff {
    versionA: string;
    versionB: string;
    changes: DiffChange[];
    summary: DiffSummary;
    conflictRisk: 'none' | 'low' | 'medium' | 'high';
}
export interface DiffChange {
    field: keyof Stance | string;
    path: string;
    type: 'added' | 'removed' | 'modified';
    oldValue: unknown;
    newValue: unknown;
    semanticImpact: SemanticImpact;
}
export interface SemanticImpact {
    category: 'identity' | 'behavior' | 'values' | 'presentation';
    magnitude: 'minor' | 'moderate' | 'major';
    description: string;
}
export interface DiffSummary {
    totalChanges: number;
    addedFields: number;
    removedFields: number;
    modifiedFields: number;
    breakingChanges: number;
    description: string;
}
export interface MergeResult {
    success: boolean;
    mergedStance?: Stance;
    conflicts: MergeConflict[];
    resolvedAutomatically: string[];
    requiresManualResolution: string[];
}
export interface MergeConflict {
    field: string;
    sourceValue: unknown;
    targetValue: unknown;
    baseValue?: unknown;
    suggestedResolution?: unknown;
    resolutionStrategy: ResolutionStrategy;
}
export type ResolutionStrategy = 'use-source' | 'use-target' | 'use-base' | 'merge-values' | 'manual';
export interface VersionHistory {
    versions: StanceVersion[];
    branches: StanceBranch[];
    currentBranch: string;
    headVersion: string;
}
export interface CherryPickResult {
    success: boolean;
    newVersionId?: string;
    appliedChanges: DiffChange[];
    skippedChanges: DiffChange[];
    conflicts: MergeConflict[];
}
export interface RollbackResult {
    success: boolean;
    newVersionId?: string;
    rolledBackVersions: string[];
    message: string;
}
export declare class StanceVersionControl {
    private versions;
    private branches;
    private currentBranch;
    private headVersion;
    constructor();
    commit(stance: Stance, message: string, author?: string, tags?: string[]): StanceVersion;
    createBranch(name: string, fromVersionId?: string, description?: string): StanceBranch | null;
    checkout(branchName: string): boolean;
    diff(versionIdA: string, versionIdB: string): SemanticDiff | null;
    private computeChanges;
    private assessSemanticImpact;
    private summarizeChanges;
    private assessConflictRisk;
    merge(sourceBranch: string, targetBranch?: string): MergeResult;
    private applyChange;
    resolveConflict(conflict: MergeConflict, resolution: unknown): void;
    cherryPick(versionId: string): CherryPickResult;
    rollback(toVersionId: string): RollbackResult;
    getVersion(id: string): StanceVersion | undefined;
    getVersionHistory(branchName?: string): StanceVersion[];
    getBranches(): StanceBranch[];
    getCurrentBranch(): string;
    getHead(): StanceVersion | null;
    tag(versionId: string, tag: string): boolean;
    findByTag(tag: string): StanceVersion[];
}
export declare function createVersionControl(): StanceVersionControl;
//# sourceMappingURL=semantic.d.ts.map