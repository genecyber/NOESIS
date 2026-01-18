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

export class StanceVersionControl {
  private histories: Map<string, StanceHistory> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private maxCheckpointsPerBranch: number = 100;
  private gcThreshold: number = 500;

  createHistory(stance: Stance, author: string): StanceHistory {
    const historyId = `history-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const defaultBranchId = `branch-main`;
    const rootCheckpointId = `checkpoint-root`;

    const rootCheckpoint: Checkpoint = {
      id: rootCheckpointId,
      stance: JSON.parse(JSON.stringify(stance)),
      name: 'Initial',
      parentId: undefined,
      branchId: defaultBranchId,
      timestamp: new Date(),
      author,
      tags: ['root']
    };

    const defaultBranch: Branch = {
      id: defaultBranchId,
      name: 'main',
      createdAt: new Date(),
      lastModified: new Date(),
      isDefault: true,
      protected: false,
      checkpoints: [rootCheckpointId]
    };

    const history: StanceHistory = {
      id: historyId,
      rootCheckpoint,
      branches: [defaultBranch],
      currentBranchId: defaultBranchId,
      currentCheckpointId: rootCheckpointId,
      createdAt: new Date(),
      lastModified: new Date()
    };

    this.histories.set(historyId, history);
    this.checkpoints.set(rootCheckpointId, rootCheckpoint);

    return history;
  }

  commit(historyId: string, stance: Stance, author: string, name?: string, description?: string): Checkpoint | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const branch = history.branches.find(b => b.id === history.currentBranchId);
    if (!branch) return null;

    const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const checkpoint: Checkpoint = {
      id: checkpointId,
      stance: JSON.parse(JSON.stringify(stance)),
      name,
      description,
      parentId: history.currentCheckpointId,
      branchId: branch.id,
      timestamp: new Date(),
      author,
      tags: []
    };

    this.checkpoints.set(checkpointId, checkpoint);
    branch.checkpoints.push(checkpointId);
    branch.lastModified = new Date();

    history.currentCheckpointId = checkpointId;
    history.lastModified = new Date();

    // Trigger GC if needed
    if (branch.checkpoints.length > this.gcThreshold) {
      this.garbageCollect(historyId, branch.id);
    }

    return checkpoint;
  }

  createCheckpoint(historyId: string, name: string, description?: string, tags?: string[]): Checkpoint | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
    if (!currentCheckpoint) return null;

    const newCheckpoint = this.commit(
      historyId,
      currentCheckpoint.stance,
      currentCheckpoint.author,
      name,
      description
    );

    if (newCheckpoint && tags) {
      newCheckpoint.tags = tags;
    }

    return newCheckpoint;
  }

  createBranch(historyId: string, branchName: string, fromCheckpointId?: string): Branch | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    // Check if branch name already exists
    if (history.branches.some(b => b.name === branchName)) {
      return null;
    }

    const sourceCheckpointId = fromCheckpointId || history.currentCheckpointId;
    const sourceCheckpoint = this.checkpoints.get(sourceCheckpointId);
    if (!sourceCheckpoint) return null;

    const branchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const newBranch: Branch = {
      id: branchId,
      name: branchName,
      createdFrom: sourceCheckpointId,
      createdAt: new Date(),
      lastModified: new Date(),
      isDefault: false,
      protected: false,
      checkpoints: [sourceCheckpointId]
    };

    history.branches.push(newBranch);
    history.lastModified = new Date();

    return newBranch;
  }

  switchBranch(historyId: string, branchName: string): boolean {
    const history = this.histories.get(historyId);
    if (!history) return false;

    const branch = history.branches.find(b => b.name === branchName);
    if (!branch) return false;

    history.currentBranchId = branch.id;
    history.currentCheckpointId = branch.checkpoints[branch.checkpoints.length - 1];
    history.lastModified = new Date();

    return true;
  }

  deleteBranch(historyId: string, branchName: string): boolean {
    const history = this.histories.get(historyId);
    if (!history) return false;

    const branchIndex = history.branches.findIndex(b => b.name === branchName);
    if (branchIndex === -1) return false;

    const branch = history.branches[branchIndex];

    // Can't delete default or protected branches
    if (branch.isDefault || branch.protected) return false;

    // Can't delete current branch
    if (branch.id === history.currentBranchId) return false;

    // Remove branch (keep checkpoints for potential recovery)
    history.branches.splice(branchIndex, 1);
    history.lastModified = new Date();

    return true;
  }

  rollback(historyId: string, steps: number = 1): RollbackResult | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const branch = history.branches.find(b => b.id === history.currentBranchId);
    if (!branch) return null;

    const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
    if (!currentCheckpoint) return null;

    // Find checkpoint 'steps' back
    let targetCheckpointId = history.currentCheckpointId;
    let actualSteps = 0;

    for (let i = 0; i < steps; i++) {
      const checkpoint = this.checkpoints.get(targetCheckpointId);
      if (!checkpoint || !checkpoint.parentId) break;
      targetCheckpointId = checkpoint.parentId;
      actualSteps++;
    }

    if (actualSteps === 0) return null;

    const targetCheckpoint = this.checkpoints.get(targetCheckpointId);
    if (!targetCheckpoint) return null;

    history.currentCheckpointId = targetCheckpointId;
    history.lastModified = new Date();

    return {
      success: true,
      previousCheckpoint: currentCheckpoint,
      currentCheckpoint: targetCheckpoint,
      stepsRolledBack: actualSteps
    };
  }

  rollbackTo(historyId: string, checkpointId: string): RollbackResult | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const targetCheckpoint = this.checkpoints.get(checkpointId);
    if (!targetCheckpoint) return null;

    const currentCheckpoint = this.checkpoints.get(history.currentCheckpointId);
    if (!currentCheckpoint) return null;

    // Verify checkpoint is on current branch
    const branch = history.branches.find(b => b.id === history.currentBranchId);
    if (!branch || !branch.checkpoints.includes(checkpointId)) return null;

    // Count steps
    const currentIndex = branch.checkpoints.indexOf(history.currentCheckpointId);
    const targetIndex = branch.checkpoints.indexOf(checkpointId);

    history.currentCheckpointId = checkpointId;
    history.lastModified = new Date();

    return {
      success: true,
      previousCheckpoint: currentCheckpoint,
      currentCheckpoint: targetCheckpoint,
      stepsRolledBack: currentIndex - targetIndex
    };
  }

  redo(historyId: string, steps: number = 1): Checkpoint | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const branch = history.branches.find(b => b.id === history.currentBranchId);
    if (!branch) return null;

    const currentIndex = branch.checkpoints.indexOf(history.currentCheckpointId);
    const targetIndex = Math.min(currentIndex + steps, branch.checkpoints.length - 1);

    if (targetIndex === currentIndex) return null;

    const targetCheckpointId = branch.checkpoints[targetIndex];
    const targetCheckpoint = this.checkpoints.get(targetCheckpointId);
    if (!targetCheckpoint) return null;

    history.currentCheckpointId = targetCheckpointId;
    history.lastModified = new Date();

    return targetCheckpoint;
  }

  merge(historyId: string, sourceBranchName: string, strategy: MergeStrategy = 'interactive'): MergeResult {
    const history = this.histories.get(historyId);
    if (!history) {
      return { success: false, conflicts: [], strategy };
    }

    const sourceBranch = history.branches.find(b => b.name === sourceBranchName);
    const targetBranch = history.branches.find(b => b.id === history.currentBranchId);

    if (!sourceBranch || !targetBranch) {
      return { success: false, conflicts: [], strategy };
    }

    // Get head checkpoints
    const sourceCheckpointId = sourceBranch.checkpoints[sourceBranch.checkpoints.length - 1];
    const targetCheckpointId = targetBranch.checkpoints[targetBranch.checkpoints.length - 1];

    const sourceCheckpoint = this.checkpoints.get(sourceCheckpointId);
    const targetCheckpoint = this.checkpoints.get(targetCheckpointId);

    if (!sourceCheckpoint || !targetCheckpoint) {
      return { success: false, conflicts: [], strategy };
    }

    // Detect conflicts
    const conflicts = this.detectMergeConflicts(sourceCheckpoint.stance, targetCheckpoint.stance);

    // Resolve conflicts based on strategy
    const mergedStance = this.resolveConflicts(
      sourceCheckpoint.stance,
      targetCheckpoint.stance,
      conflicts,
      strategy
    );

    // Create merged checkpoint
    const mergedCheckpointId = `checkpoint-merge-${Date.now()}`;
    const mergedCheckpoint: Checkpoint = {
      id: mergedCheckpointId,
      stance: mergedStance,
      name: `Merge ${sourceBranchName} into ${targetBranch.name}`,
      description: `Merged ${conflicts.length} conflicts using ${strategy} strategy`,
      parentId: targetCheckpointId,
      branchId: targetBranch.id,
      timestamp: new Date(),
      author: 'system',
      tags: ['merge'],
      metadata: {
        mergeSource: sourceBranchName,
        mergeStrategy: strategy,
        conflictCount: conflicts.length
      }
    };

    this.checkpoints.set(mergedCheckpointId, mergedCheckpoint);
    targetBranch.checkpoints.push(mergedCheckpointId);
    targetBranch.lastModified = new Date();

    history.currentCheckpointId = mergedCheckpointId;
    history.lastModified = new Date();

    return {
      success: true,
      mergedCheckpoint,
      conflicts,
      strategy
    };
  }

  private detectMergeConflicts(source: Stance, target: Stance): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    // Compare all fields
    const compareObjects = (s: Record<string, unknown>, t: Record<string, unknown>, prefix: string = '') => {
      const allKeys = new Set([...Object.keys(s), ...Object.keys(t)]);

      for (const key of allKeys) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const sVal = s[key];
        const tVal = t[key];

        if (typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal) &&
            typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal)) {
          compareObjects(sVal as Record<string, unknown>, tVal as Record<string, unknown>, fullPath);
        } else if (JSON.stringify(sVal) !== JSON.stringify(tVal)) {
          conflicts.push({
            field: fullPath,
            sourceValue: sVal,
            targetValue: tVal
          });
        }
      }
    };

    compareObjects(
      source as unknown as Record<string, unknown>,
      target as unknown as Record<string, unknown>
    );

    return conflicts;
  }

  private resolveConflicts(
    _source: Stance,
    target: Stance,
    conflicts: MergeConflict[],
    strategy: MergeStrategy
  ): Stance {
    const merged = JSON.parse(JSON.stringify(target)) as Stance;

    for (const conflict of conflicts) {
      let resolvedValue: unknown;

      switch (strategy) {
        case 'ours':
          resolvedValue = conflict.targetValue;
          conflict.resolution = 'target';
          break;
        case 'theirs':
          resolvedValue = conflict.sourceValue;
          conflict.resolution = 'source';
          break;
        case 'average':
          if (typeof conflict.sourceValue === 'number' && typeof conflict.targetValue === 'number') {
            resolvedValue = Math.round((conflict.sourceValue + conflict.targetValue) / 2);
          } else {
            resolvedValue = conflict.targetValue; // Fallback to ours
          }
          conflict.resolution = 'manual';
          break;
        case 'interactive':
        default:
          // Default to target for non-numeric, average for numeric
          if (typeof conflict.sourceValue === 'number' && typeof conflict.targetValue === 'number') {
            resolvedValue = Math.round((conflict.sourceValue + conflict.targetValue) / 2);
          } else {
            resolvedValue = conflict.targetValue;
          }
          conflict.resolution = 'manual';
          break;
      }

      conflict.resolvedValue = resolvedValue;
      this.setFieldValue(merged, conflict.field, resolvedValue);
    }

    return merged;
  }

  private setFieldValue(stance: Stance, field: string, value: unknown): void {
    const parts = field.split('.');
    let target: Record<string, unknown> = stance as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
    }

    target[parts[parts.length - 1]] = value;
  }

  getTimeline(historyId: string): TimelineEntry[] {
    const history = this.histories.get(historyId);
    if (!history) return [];

    const timeline: TimelineEntry[] = [];

    for (const branch of history.branches) {
      for (let i = 0; i < branch.checkpoints.length; i++) {
        const checkpointId = branch.checkpoints[i];
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) continue;

        const children = branch.checkpoints.slice(i + 1, i + 2);

        timeline.push({
          checkpoint,
          branch,
          depth: i,
          isCurrentHead: checkpointId === history.currentCheckpointId,
          children
        });
      }
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.checkpoint.timestamp.getTime() - b.checkpoint.timestamp.getTime());

    return timeline;
  }

  garbageCollect(historyId: string, branchId?: string): GarbageCollectionResult {
    const history = this.histories.get(historyId);
    if (!history) {
      return { checkpointsRemoved: 0, branchesRemoved: 0, spaceReclaimed: 0 };
    }

    let checkpointsRemoved = 0;
    let branchesRemoved = 0;

    // Remove old checkpoints from branches that exceed maxCheckpointsPerBranch
    for (const branch of history.branches) {
      if (branchId && branch.id !== branchId) continue;
      if (branch.protected) continue;

      if (branch.checkpoints.length > this.maxCheckpointsPerBranch) {
        const toRemove = branch.checkpoints.length - this.maxCheckpointsPerBranch;
        const removedIds = branch.checkpoints.splice(0, toRemove);

        for (const id of removedIds) {
          // Only remove if not referenced by other branches
          const isReferenced = history.branches.some(b =>
            b.id !== branch.id && b.checkpoints.includes(id)
          );
          if (!isReferenced) {
            this.checkpoints.delete(id);
            checkpointsRemoved++;
          }
        }
      }
    }

    // Remove empty non-default branches
    const emptyBranches = history.branches.filter(b =>
      !b.isDefault && !b.protected && b.checkpoints.length === 0
    );

    for (const branch of emptyBranches) {
      const index = history.branches.indexOf(branch);
      if (index > -1) {
        history.branches.splice(index, 1);
        branchesRemoved++;
      }
    }

    return {
      checkpointsRemoved,
      branchesRemoved,
      spaceReclaimed: checkpointsRemoved * 1000 // Estimated bytes
    };
  }

  getHistory(historyId: string): StanceHistory | undefined {
    return this.histories.get(historyId);
  }

  getCurrentStance(historyId: string): Stance | null {
    const history = this.histories.get(historyId);
    if (!history) return null;

    const checkpoint = this.checkpoints.get(history.currentCheckpointId);
    return checkpoint ? JSON.parse(JSON.stringify(checkpoint.stance)) : null;
  }

  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  findCheckpointsByTag(historyId: string, tag: string): Checkpoint[] {
    const history = this.histories.get(historyId);
    if (!history) return [];

    const checkpointIds = new Set<string>();
    for (const branch of history.branches) {
      for (const id of branch.checkpoints) {
        checkpointIds.add(id);
      }
    }

    return Array.from(checkpointIds)
      .map(id => this.checkpoints.get(id))
      .filter((cp): cp is Checkpoint => cp !== undefined && cp.tags.includes(tag));
  }

  listBranches(historyId: string): Branch[] {
    const history = this.histories.get(historyId);
    return history ? [...history.branches] : [];
  }

  protectBranch(historyId: string, branchName: string, protect: boolean): boolean {
    const history = this.histories.get(historyId);
    if (!history) return false;

    const branch = history.branches.find(b => b.name === branchName);
    if (!branch) return false;

    branch.protected = protect;
    return true;
  }

  setMaxCheckpoints(max: number): void {
    this.maxCheckpointsPerBranch = max;
  }

  setGcThreshold(threshold: number): void {
    this.gcThreshold = threshold;
  }
}

export function createStanceVersionControl(): StanceVersionControl {
  return new StanceVersionControl();
}
