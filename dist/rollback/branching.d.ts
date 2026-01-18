/**
 * Stance Rollback with Branching
 *
 * Full undo/redo history with named checkpoints,
 * branch creation, merging, and timeline navigation.
 */
import type { Stance } from '../types/index.js';
export interface StanceHistory {
    id: string;
    rootCheckpoint: Checkpoint;
    branches: Branch[];
    currentBranchId: string;
    currentCheckpointId: string;
    createdAt: Date;
    lastModified: Date;
}
export interface Checkpoint {
    id: string;
    stance: Stance;
    name?: string;
    description?: string;
    parentId?: string;
    branchId: string;
    timestamp: Date;
    author: string;
    tags: string[];
    metadata?: Record<string, unknown>;
}
export interface Branch {
    id: string;
    name: string;
    description?: string;
    createdFrom?: string;
    createdAt: Date;
    lastModified: Date;
    isDefault: boolean;
    protected: boolean;
    checkpoints: string[];
}
export interface MergeResult {
    success: boolean;
    mergedCheckpoint?: Checkpoint;
    conflicts: MergeConflict[];
    strategy: MergeStrategy;
}
export interface MergeConflict {
    field: string;
    sourceValue: unknown;
    targetValue: unknown;
    resolvedValue?: unknown;
    resolution?: 'source' | 'target' | 'manual';
}
export type MergeStrategy = 'ours' | 'theirs' | 'interactive' | 'average';
export interface RollbackResult {
    success: boolean;
    previousCheckpoint: Checkpoint;
    currentCheckpoint: Checkpoint;
    stepsRolledBack: number;
}
export interface TimelineEntry {
    checkpoint: Checkpoint;
    branch: Branch;
    depth: number;
    isCurrentHead: boolean;
    children: string[];
}
export interface GarbageCollectionResult {
    checkpointsRemoved: number;
    branchesRemoved: number;
    spaceReclaimed: number;
}
export declare class StanceVersionControl {
    private histories;
    private checkpoints;
    private maxCheckpointsPerBranch;
    private gcThreshold;
    createHistory(stance: Stance, author: string): StanceHistory;
    commit(historyId: string, stance: Stance, author: string, name?: string, description?: string): Checkpoint | null;
    createCheckpoint(historyId: string, name: string, description?: string, tags?: string[]): Checkpoint | null;
    createBranch(historyId: string, branchName: string, fromCheckpointId?: string): Branch | null;
    switchBranch(historyId: string, branchName: string): boolean;
    deleteBranch(historyId: string, branchName: string): boolean;
    rollback(historyId: string, steps?: number): RollbackResult | null;
    rollbackTo(historyId: string, checkpointId: string): RollbackResult | null;
    redo(historyId: string, steps?: number): Checkpoint | null;
    merge(historyId: string, sourceBranchName: string, strategy?: MergeStrategy): MergeResult;
    private detectMergeConflicts;
    private resolveConflicts;
    private setFieldValue;
    getTimeline(historyId: string): TimelineEntry[];
    garbageCollect(historyId: string, branchId?: string): GarbageCollectionResult;
    getHistory(historyId: string): StanceHistory | undefined;
    getCurrentStance(historyId: string): Stance | null;
    getCheckpoint(checkpointId: string): Checkpoint | undefined;
    findCheckpointsByTag(historyId: string, tag: string): Checkpoint[];
    listBranches(historyId: string): Branch[];
    protectBranch(historyId: string, branchName: string, protect: boolean): boolean;
    setMaxCheckpoints(max: number): void;
    setGcThreshold(threshold: number): void;
}
export declare function createStanceVersionControl(): StanceVersionControl;
//# sourceMappingURL=branching.d.ts.map