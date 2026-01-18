/**
 * Stance Diffing and Merge Strategies (Ralph Iteration 9, Feature 5)
 *
 * Visual stance diff tools, three-way merge for branches,
 * conflict resolution strategies, and rollback support.
 */
import type { Stance } from '../types/index.js';
export interface DiffConfig {
    ignoreMinorChanges: boolean;
    minorChangeThreshold: number;
    includeMetadata: boolean;
    colorize: boolean;
}
export interface StanceDiff {
    id: string;
    timestamp: Date;
    left: Stance;
    right: Stance;
    changes: DiffChange[];
    summary: DiffSummary;
}
export interface DiffChange {
    path: string;
    type: 'added' | 'removed' | 'modified';
    leftValue: unknown;
    rightValue: unknown;
    significance: 'minor' | 'moderate' | 'major';
}
export interface DiffSummary {
    totalChanges: number;
    majorChanges: number;
    moderateChanges: number;
    minorChanges: number;
    frameChanged: boolean;
    selfModelChanged: boolean;
    coherenceImpact: number;
}
export interface MergeResult {
    success: boolean;
    mergedStance: Stance | null;
    conflicts: MergeConflict[];
    resolutions: ConflictResolution[];
    strategy: MergeStrategy;
}
export interface MergeConflict {
    id: string;
    path: string;
    baseValue: unknown;
    leftValue: unknown;
    rightValue: unknown;
    suggestedResolution: unknown;
}
export interface ConflictResolution {
    conflictId: string;
    resolution: 'use_left' | 'use_right' | 'use_base' | 'custom';
    customValue?: unknown;
    reason: string;
}
export type MergeStrategy = 'ours' | 'theirs' | 'union' | 'average' | 'latest' | 'manual';
export interface CherryPickResult {
    success: boolean;
    appliedChanges: DiffChange[];
    skippedChanges: DiffChange[];
    resultStance: Stance;
}
export interface RollbackPoint {
    id: string;
    timestamp: Date;
    stance: Stance;
    description: string;
    branchId?: string;
}
export interface DiffVisualization {
    type: 'tree' | 'side-by-side' | 'unified';
    content: string;
    highlights: DiffHighlight[];
}
export interface DiffHighlight {
    path: string;
    color: 'green' | 'red' | 'yellow' | 'blue';
    label: string;
}
export interface DiffStats {
    totalDiffs: number;
    totalMerges: number;
    conflictsResolved: number;
    rollbacksPerformed: number;
}
export declare class StanceDiffManager {
    private config;
    private rollbackPoints;
    private diffHistory;
    private stats;
    constructor(config?: Partial<DiffConfig>);
    /**
     * Create a diff between two stances
     */
    diff(left: Stance, right: Stance): StanceDiff;
    /**
     * Summarize a diff
     */
    private summarizeDiff;
    /**
     * Three-way merge
     */
    merge(base: Stance, left: Stance, right: Stance, strategy?: MergeStrategy): MergeResult;
    /**
     * Get value at path
     */
    private getValueAtPath;
    /**
     * Set value at path
     */
    private setValueAtPath;
    /**
     * Suggest resolution for a conflict
     */
    private suggestResolution;
    /**
     * Resolve a conflict
     */
    private resolveConflict;
    /**
     * Cherry-pick specific changes
     */
    cherryPick(target: Stance, sourceDiff: StanceDiff, changePaths: string[]): CherryPickResult;
    /**
     * Create a rollback point
     */
    createRollbackPoint(stance: Stance, description: string, branchId?: string): RollbackPoint;
    /**
     * Rollback to a point
     */
    rollback(rollbackId: string): Stance | null;
    /**
     * List rollback points
     */
    listRollbackPoints(branchId?: string): RollbackPoint[];
    /**
     * Preview merge without applying
     */
    previewMerge(base: Stance, left: Stance, right: Stance, strategy?: MergeStrategy): {
        conflicts: MergeConflict[];
        preview: Record<string, unknown>;
    };
    /**
     * Generate visual diff
     */
    visualize(diff: StanceDiff, type?: 'tree' | 'side-by-side' | 'unified'): DiffVisualization;
    /**
     * Generate unified diff view
     */
    private generateUnifiedDiff;
    /**
     * Generate side-by-side diff view
     */
    private generateSideBySideDiff;
    /**
     * Generate tree diff view
     */
    private generateTreeDiff;
    /**
     * Get diff history
     */
    getDiffHistory(limit?: number): StanceDiff[];
    /**
     * Get statistics
     */
    getStats(): DiffStats;
    /**
     * Clear rollback points
     */
    clearRollbackPoints(olderThan?: Date): number;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const stanceDiff: StanceDiffManager;
//# sourceMappingURL=stance-diff.d.ts.map