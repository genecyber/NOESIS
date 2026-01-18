/**
 * Conversation Branching & Time Travel - Ralph Iteration 6 Feature 3
 *
 * Enables non-linear conversation exploration with branching,
 * time travel to previous states, and branch merging.
 */
import { Stance, ConversationMessage, ModeConfig } from '../types/index.js';
/**
 * Branch point - where a conversation splits
 */
export interface BranchPoint {
    id: string;
    messageIndex: number;
    createdAt: Date;
    reason?: string;
}
/**
 * Conversation branch
 */
export interface ConversationBranch {
    id: string;
    name: string;
    parentBranchId: string | null;
    branchPoint: BranchPoint | null;
    messages: ConversationMessage[];
    stance: Stance;
    config: ModeConfig;
    createdAt: Date;
    lastModified: Date;
    isArchived: boolean;
    metadata: {
        messageCount: number;
        totalDrift: number;
        frameChanges: number;
    };
}
/**
 * Branch comparison result
 */
export interface BranchComparison {
    branch1: ConversationBranch;
    branch2: ConversationBranch;
    commonAncestorIndex: number;
    messageDifferences: number;
    stanceDifferences: {
        frameDiffers: boolean;
        selfModelDiffers: boolean;
        valueDiffs: Array<{
            key: string;
            diff: number;
        }>;
    };
    divergencePoint: Date;
}
/**
 * Merge conflict
 */
export interface MergeConflict {
    type: 'message' | 'stance' | 'config';
    description: string;
    branch1Value: unknown;
    branch2Value: unknown;
    resolution?: 'use_branch1' | 'use_branch2' | 'merge' | 'custom';
    customValue?: unknown;
}
/**
 * Merge result
 */
export interface MergeResult {
    success: boolean;
    mergedBranch: ConversationBranch | null;
    conflicts: MergeConflict[];
    autoResolved: number;
    manualRequired: number;
}
/**
 * Time travel snapshot
 */
export interface TimeTravelSnapshot {
    id: string;
    branchId: string;
    messageIndex: number;
    stance: Stance;
    config: ModeConfig;
    timestamp: Date;
    label?: string;
}
/**
 * Branch tree node for visualization
 */
export interface BranchTreeNode {
    branch: ConversationBranch;
    children: BranchTreeNode[];
    depth: number;
    isActive: boolean;
}
/**
 * Conversation Branching Manager
 */
declare class ConversationBranchManager {
    private branches;
    private activeBranchId;
    private snapshots;
    private rootBranchId;
    /**
     * Initialize with a root branch
     */
    initializeRoot(messages: ConversationMessage[], stance: Stance, config: ModeConfig, name?: string): ConversationBranch;
    /**
     * Create a new branch
     */
    createBranch(name: string, parentBranchId: string | null, branchPoint: BranchPoint | null, messages: ConversationMessage[], stance: Stance, config: ModeConfig): ConversationBranch;
    /**
     * Branch from current conversation at a specific point
     */
    branchAt(messageIndex: number, name: string, reason?: string): ConversationBranch | null;
    /**
     * Branch from the current point
     */
    branchNow(name: string, reason?: string): ConversationBranch | null;
    /**
     * Switch to a different branch
     */
    switchBranch(branchId: string): ConversationBranch | null;
    /**
     * Get active branch
     */
    getActiveBranch(): ConversationBranch | null;
    /**
     * Get branch by ID
     */
    getBranch(branchId: string): ConversationBranch | null;
    /**
     * List all branches
     */
    listBranches(includeArchived?: boolean): ConversationBranch[];
    /**
     * Add message to active branch
     */
    addMessage(message: ConversationMessage): boolean;
    /**
     * Update stance on active branch
     */
    updateStance(stance: Stance): boolean;
    /**
     * Time travel to a specific point
     */
    timeTravelTo(branchId: string, messageIndex: number): TimeTravelSnapshot | null;
    /**
     * Restore from snapshot (creates a new branch)
     */
    restoreFromSnapshot(snapshotId: string, branchName: string): ConversationBranch | null;
    /**
     * Compare two branches
     */
    compareBranches(branchId1: string, branchId2: string): BranchComparison | null;
    /**
     * Find common ancestor message index
     */
    private findCommonAncestorIndex;
    /**
     * Merge two branches
     */
    mergeBranches(targetBranchId: string, sourceBranchId: string, conflictResolutions?: Map<string, MergeConflict['resolution']>): MergeResult;
    /**
     * Archive a branch
     */
    archiveBranch(branchId: string): boolean;
    /**
     * Restore archived branch
     */
    restoreBranch(branchId: string): boolean;
    /**
     * Delete a branch permanently
     */
    deleteBranch(branchId: string): boolean;
    /**
     * Build branch tree for visualization
     */
    buildBranchTree(): BranchTreeNode | null;
    /**
     * Get branch statistics
     */
    getStats(): {
        totalBranches: number;
        activeBranches: number;
        archivedBranches: number;
        totalMessages: number;
        snapshotCount: number;
    };
    /**
     * Clear all branches except root
     */
    reset(): void;
}
export declare const branchManager: ConversationBranchManager;
export {};
//# sourceMappingURL=branching.d.ts.map