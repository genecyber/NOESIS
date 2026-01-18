/**
 * Conversation Branching & Time Travel - Ralph Iteration 6 Feature 3
 *
 * Enables non-linear conversation exploration with branching,
 * time travel to previous states, and branch merging.
 */

import { v4 as uuidv4 } from 'uuid';
import { Stance, ConversationMessage, ModeConfig } from '../types/index.js';

/**
 * Branch point - where a conversation splits
 */
export interface BranchPoint {
  id: string;
  messageIndex: number;  // Index in parent conversation
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
    valueDiffs: Array<{ key: string; diff: number }>;
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
class ConversationBranchManager {
  private branches: Map<string, ConversationBranch> = new Map();
  private activeBranchId: string | null = null;
  private snapshots: Map<string, TimeTravelSnapshot> = new Map();
  private rootBranchId: string | null = null;

  /**
   * Initialize with a root branch
   */
  initializeRoot(
    messages: ConversationMessage[],
    stance: Stance,
    config: ModeConfig,
    name: string = 'main'
  ): ConversationBranch {
    const branch = this.createBranch(name, null, null, messages, stance, config);
    this.rootBranchId = branch.id;
    this.activeBranchId = branch.id;
    return branch;
  }

  /**
   * Create a new branch
   */
  createBranch(
    name: string,
    parentBranchId: string | null,
    branchPoint: BranchPoint | null,
    messages: ConversationMessage[],
    stance: Stance,
    config: ModeConfig
  ): ConversationBranch {
    const id = uuidv4();

    const branch: ConversationBranch = {
      id,
      name,
      parentBranchId,
      branchPoint,
      messages: [...messages],
      stance: JSON.parse(JSON.stringify(stance)),
      config: JSON.parse(JSON.stringify(config)),
      createdAt: new Date(),
      lastModified: new Date(),
      isArchived: false,
      metadata: {
        messageCount: messages.length,
        totalDrift: stance.cumulativeDrift,
        frameChanges: 0
      }
    };

    this.branches.set(id, branch);
    return branch;
  }

  /**
   * Branch from current conversation at a specific point
   */
  branchAt(
    messageIndex: number,
    name: string,
    reason?: string
  ): ConversationBranch | null {
    if (!this.activeBranchId) return null;

    const activeBranch = this.branches.get(this.activeBranchId);
    if (!activeBranch) return null;

    if (messageIndex < 0 || messageIndex >= activeBranch.messages.length) {
      return null;
    }

    const branchPoint: BranchPoint = {
      id: uuidv4(),
      messageIndex,
      createdAt: new Date(),
      reason
    };

    // Copy messages up to and including the branch point
    const branchedMessages = activeBranch.messages.slice(0, messageIndex + 1);

    // Find the stance at that point (use the message's stance if available)
    const messageAtPoint = activeBranch.messages[messageIndex];
    const stanceAtPoint = messageAtPoint.stance || activeBranch.stance;

    const newBranch = this.createBranch(
      name,
      this.activeBranchId,
      branchPoint,
      branchedMessages,
      stanceAtPoint,
      activeBranch.config
    );

    return newBranch;
  }

  /**
   * Branch from the current point
   */
  branchNow(name: string, reason?: string): ConversationBranch | null {
    if (!this.activeBranchId) return null;

    const activeBranch = this.branches.get(this.activeBranchId);
    if (!activeBranch) return null;

    return this.branchAt(activeBranch.messages.length - 1, name, reason);
  }

  /**
   * Switch to a different branch
   */
  switchBranch(branchId: string): ConversationBranch | null {
    const branch = this.branches.get(branchId);
    if (!branch || branch.isArchived) return null;

    this.activeBranchId = branchId;
    return branch;
  }

  /**
   * Get active branch
   */
  getActiveBranch(): ConversationBranch | null {
    if (!this.activeBranchId) return null;
    return this.branches.get(this.activeBranchId) || null;
  }

  /**
   * Get branch by ID
   */
  getBranch(branchId: string): ConversationBranch | null {
    return this.branches.get(branchId) || null;
  }

  /**
   * List all branches
   */
  listBranches(includeArchived: boolean = false): ConversationBranch[] {
    return Array.from(this.branches.values())
      .filter(b => includeArchived || !b.isArchived)
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  /**
   * Add message to active branch
   */
  addMessage(message: ConversationMessage): boolean {
    const branch = this.getActiveBranch();
    if (!branch) return false;

    branch.messages.push(message);
    branch.lastModified = new Date();
    branch.metadata.messageCount = branch.messages.length;

    return true;
  }

  /**
   * Update stance on active branch
   */
  updateStance(stance: Stance): boolean {
    const branch = this.getActiveBranch();
    if (!branch) return false;

    // Track frame changes
    if (branch.stance.frame !== stance.frame) {
      branch.metadata.frameChanges++;
    }

    branch.stance = JSON.parse(JSON.stringify(stance));
    branch.metadata.totalDrift = stance.cumulativeDrift;
    branch.lastModified = new Date();

    return true;
  }

  /**
   * Time travel to a specific point
   */
  timeTravelTo(branchId: string, messageIndex: number): TimeTravelSnapshot | null {
    const branch = this.branches.get(branchId);
    if (!branch || messageIndex < 0 || messageIndex >= branch.messages.length) {
      return null;
    }

    const message = branch.messages[messageIndex];

    const snapshot: TimeTravelSnapshot = {
      id: uuidv4(),
      branchId,
      messageIndex,
      stance: message.stance || branch.stance,
      config: branch.config,
      timestamp: message.timestamp
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  /**
   * Restore from snapshot (creates a new branch)
   */
  restoreFromSnapshot(
    snapshotId: string,
    branchName: string
  ): ConversationBranch | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    const originalBranch = this.branches.get(snapshot.branchId);
    if (!originalBranch) return null;

    return this.branchAt(
      snapshot.messageIndex,
      branchName,
      `Restored from snapshot at message ${snapshot.messageIndex}`
    );
  }

  /**
   * Compare two branches
   */
  compareBranches(branchId1: string, branchId2: string): BranchComparison | null {
    const branch1 = this.branches.get(branchId1);
    const branch2 = this.branches.get(branchId2);

    if (!branch1 || !branch2) return null;

    // Find common ancestor
    const commonAncestorIndex = this.findCommonAncestorIndex(branch1, branch2);

    // Calculate differences
    const valueDiffs: Array<{ key: string; diff: number }> = [];
    const values1 = branch1.stance.values;
    const values2 = branch2.stance.values;

    for (const key of Object.keys(values1)) {
      const v1 = (values1 as Record<string, number>)[key];
      const v2 = (values2 as Record<string, number>)[key];
      if (v1 !== v2) {
        valueDiffs.push({ key, diff: v2 - v1 });
      }
    }

    // Find divergence point
    const divergencePoint = branch1.branchPoint?.createdAt ||
                           branch2.branchPoint?.createdAt ||
                           new Date(Math.max(
                             branch1.createdAt.getTime(),
                             branch2.createdAt.getTime()
                           ));

    return {
      branch1,
      branch2,
      commonAncestorIndex,
      messageDifferences: Math.abs(branch1.messages.length - branch2.messages.length),
      stanceDifferences: {
        frameDiffers: branch1.stance.frame !== branch2.stance.frame,
        selfModelDiffers: branch1.stance.selfModel !== branch2.stance.selfModel,
        valueDiffs
      },
      divergencePoint
    };
  }

  /**
   * Find common ancestor message index
   */
  private findCommonAncestorIndex(
    branch1: ConversationBranch,
    branch2: ConversationBranch
  ): number {
    const minLength = Math.min(branch1.messages.length, branch2.messages.length);

    for (let i = 0; i < minLength; i++) {
      if (branch1.messages[i].content !== branch2.messages[i].content) {
        return i - 1;
      }
    }

    return minLength - 1;
  }

  /**
   * Merge two branches
   */
  mergeBranches(
    targetBranchId: string,
    sourceBranchId: string,
    conflictResolutions?: Map<string, MergeConflict['resolution']>
  ): MergeResult {
    const targetBranch = this.branches.get(targetBranchId);
    const sourceBranch = this.branches.get(sourceBranchId);

    if (!targetBranch || !sourceBranch) {
      return {
        success: false,
        mergedBranch: null,
        conflicts: [],
        autoResolved: 0,
        manualRequired: 0
      };
    }

    const conflicts: MergeConflict[] = [];
    let autoResolved = 0;

    // Check for stance conflicts
    if (targetBranch.stance.frame !== sourceBranch.stance.frame) {
      conflicts.push({
        type: 'stance',
        description: 'Frame differs between branches',
        branch1Value: targetBranch.stance.frame,
        branch2Value: sourceBranch.stance.frame,
        resolution: conflictResolutions?.get('frame') || 'use_branch1'
      });
    }

    if (targetBranch.stance.selfModel !== sourceBranch.stance.selfModel) {
      conflicts.push({
        type: 'stance',
        description: 'Self-model differs between branches',
        branch1Value: targetBranch.stance.selfModel,
        branch2Value: sourceBranch.stance.selfModel,
        resolution: conflictResolutions?.get('selfModel') || 'use_branch1'
      });
    }

    // Auto-resolve value differences by averaging
    const mergedValues = { ...targetBranch.stance.values };
    for (const key of Object.keys(mergedValues)) {
      const v1 = (targetBranch.stance.values as Record<string, number>)[key];
      const v2 = (sourceBranch.stance.values as Record<string, number>)[key];
      if (v1 !== v2) {
        (mergedValues as Record<string, number>)[key] = Math.round((v1 + v2) / 2);
        autoResolved++;
      }
    }

    // Create merged branch
    const commonIndex = this.findCommonAncestorIndex(targetBranch, sourceBranch);
    const mergedMessages = [
      ...targetBranch.messages.slice(0, commonIndex + 1),
      ...targetBranch.messages.slice(commonIndex + 1),
      // Add source-only messages with attribution
      ...sourceBranch.messages.slice(commonIndex + 1).map(m => ({
        ...m,
        content: `[Merged from ${sourceBranch.name}] ${m.content}`
      }))
    ];

    const mergedStance = {
      ...targetBranch.stance,
      values: mergedValues
    };

    // Apply conflict resolutions
    for (const conflict of conflicts) {
      if (conflict.resolution === 'use_branch2') {
        if (conflict.description.includes('Frame')) {
          mergedStance.frame = sourceBranch.stance.frame;
        } else if (conflict.description.includes('Self-model')) {
          mergedStance.selfModel = sourceBranch.stance.selfModel;
        }
      }
    }

    const mergedBranch = this.createBranch(
      `${targetBranch.name}+${sourceBranch.name}`,
      targetBranchId,
      null,
      mergedMessages,
      mergedStance,
      targetBranch.config
    );

    return {
      success: true,
      mergedBranch,
      conflicts,
      autoResolved,
      manualRequired: conflicts.filter(c => !c.resolution).length
    };
  }

  /**
   * Archive a branch
   */
  archiveBranch(branchId: string): boolean {
    const branch = this.branches.get(branchId);
    if (!branch || branchId === this.rootBranchId) return false;

    branch.isArchived = true;

    // Switch away if this was active
    if (this.activeBranchId === branchId) {
      this.activeBranchId = branch.parentBranchId || this.rootBranchId;
    }

    return true;
  }

  /**
   * Restore archived branch
   */
  restoreBranch(branchId: string): boolean {
    const branch = this.branches.get(branchId);
    if (!branch) return false;

    branch.isArchived = false;
    return true;
  }

  /**
   * Delete a branch permanently
   */
  deleteBranch(branchId: string): boolean {
    if (branchId === this.rootBranchId) return false;

    // Check for child branches
    const hasChildren = Array.from(this.branches.values())
      .some(b => b.parentBranchId === branchId);

    if (hasChildren) return false;

    if (this.activeBranchId === branchId) {
      const branch = this.branches.get(branchId);
      this.activeBranchId = branch?.parentBranchId || this.rootBranchId;
    }

    return this.branches.delete(branchId);
  }

  /**
   * Build branch tree for visualization
   */
  buildBranchTree(): BranchTreeNode | null {
    if (!this.rootBranchId) return null;

    const rootBranch = this.branches.get(this.rootBranchId);
    if (!rootBranch) return null;

    const buildNode = (branch: ConversationBranch, depth: number): BranchTreeNode => {
      const children = Array.from(this.branches.values())
        .filter(b => b.parentBranchId === branch.id && !b.isArchived)
        .map(child => buildNode(child, depth + 1));

      return {
        branch,
        children,
        depth,
        isActive: branch.id === this.activeBranchId
      };
    };

    return buildNode(rootBranch, 0);
  }

  /**
   * Get branch statistics
   */
  getStats(): {
    totalBranches: number;
    activeBranches: number;
    archivedBranches: number;
    totalMessages: number;
    snapshotCount: number;
  } {
    const branches = Array.from(this.branches.values());
    const activeBranches = branches.filter(b => !b.isArchived);
    const totalMessages = branches.reduce((sum, b) => sum + b.messages.length, 0);

    return {
      totalBranches: branches.length,
      activeBranches: activeBranches.length,
      archivedBranches: branches.length - activeBranches.length,
      totalMessages,
      snapshotCount: this.snapshots.size
    };
  }

  /**
   * Clear all branches except root
   */
  reset(): void {
    if (this.rootBranchId) {
      const root = this.branches.get(this.rootBranchId);
      this.branches.clear();
      this.snapshots.clear();

      if (root) {
        this.branches.set(this.rootBranchId, root);
        this.activeBranchId = this.rootBranchId;
      }
    }
  }
}

// Singleton instance
export const branchManager = new ConversationBranchManager();
