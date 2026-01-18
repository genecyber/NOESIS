/**
 * Stance Diffing and Merge Strategies (Ralph Iteration 9, Feature 5)
 *
 * Visual stance diff tools, three-way merge for branches,
 * conflict resolution strategies, and rollback support.
 */

import type { Stance } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface DiffConfig {
  ignoreMinorChanges: boolean;
  minorChangeThreshold: number;  // Percentage
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

export type MergeStrategy =
  | 'ours'        // Always use left
  | 'theirs'      // Always use right
  | 'union'       // Combine (for arrays)
  | 'average'     // Average numeric values
  | 'latest'      // Use most recent
  | 'manual';     // Require manual resolution

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

// ============================================================================
// Stance Diff Manager
// ============================================================================

export class StanceDiffManager {
  private config: DiffConfig;
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private diffHistory: StanceDiff[] = [];
  private stats: DiffStats;

  constructor(config: Partial<DiffConfig> = {}) {
    this.config = {
      ignoreMinorChanges: false,
      minorChangeThreshold: 5,
      includeMetadata: true,
      colorize: true,
      ...config
    };

    this.stats = {
      totalDiffs: 0,
      totalMerges: 0,
      conflictsResolved: 0,
      rollbacksPerformed: 0
    };
  }

  /**
   * Create a diff between two stances
   */
  diff(left: Stance, right: Stance): StanceDiff {
    const changes: DiffChange[] = [];

    // Compare frame
    if (left.frame !== right.frame) {
      changes.push({
        path: 'frame',
        type: 'modified',
        leftValue: left.frame,
        rightValue: right.frame,
        significance: 'major'
      });
    }

    // Compare self-model
    if (left.selfModel !== right.selfModel) {
      changes.push({
        path: 'selfModel',
        type: 'modified',
        leftValue: left.selfModel,
        rightValue: right.selfModel,
        significance: 'major'
      });
    }

    // Compare objective
    if (left.objective !== right.objective) {
      changes.push({
        path: 'objective',
        type: 'modified',
        leftValue: left.objective,
        rightValue: right.objective,
        significance: 'moderate'
      });
    }

    // Compare values
    const leftValues = left.values as Record<string, number>;
    const rightValues = right.values as Record<string, number>;
    for (const key of Object.keys(leftValues)) {
      const leftVal = leftValues[key];
      const rightVal = rightValues[key];
      if (leftVal !== rightVal) {
        const delta = Math.abs(rightVal - leftVal);
        changes.push({
          path: `values.${key}`,
          type: 'modified',
          leftValue: leftVal,
          rightValue: rightVal,
          significance: delta > 20 ? 'major' : delta > 10 ? 'moderate' : 'minor'
        });
      }
    }

    // Compare sentience
    if (left.sentience.awarenessLevel !== right.sentience.awarenessLevel) {
      changes.push({
        path: 'sentience.awarenessLevel',
        type: 'modified',
        leftValue: left.sentience.awarenessLevel,
        rightValue: right.sentience.awarenessLevel,
        significance: 'moderate'
      });
    }

    if (left.sentience.autonomyLevel !== right.sentience.autonomyLevel) {
      changes.push({
        path: 'sentience.autonomyLevel',
        type: 'modified',
        leftValue: left.sentience.autonomyLevel,
        rightValue: right.sentience.autonomyLevel,
        significance: 'moderate'
      });
    }

    // Compare emergent goals
    const leftGoals = new Set(left.sentience.emergentGoals);
    const rightGoals = new Set(right.sentience.emergentGoals);

    for (const goal of rightGoals) {
      if (!leftGoals.has(goal)) {
        changes.push({
          path: 'sentience.emergentGoals',
          type: 'added',
          leftValue: null,
          rightValue: goal,
          significance: 'moderate'
        });
      }
    }

    for (const goal of leftGoals) {
      if (!rightGoals.has(goal)) {
        changes.push({
          path: 'sentience.emergentGoals',
          type: 'removed',
          leftValue: goal,
          rightValue: null,
          significance: 'moderate'
        });
      }
    }

    // Filter minor changes if configured
    const filteredChanges = this.config.ignoreMinorChanges
      ? changes.filter(c => c.significance !== 'minor')
      : changes;

    const stanceDiff: StanceDiff = {
      id: `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      left,
      right,
      changes: filteredChanges,
      summary: this.summarizeDiff(filteredChanges, left, right)
    };

    this.diffHistory.push(stanceDiff);
    this.stats.totalDiffs++;

    return stanceDiff;
  }

  /**
   * Summarize a diff
   */
  private summarizeDiff(
    changes: DiffChange[],
    left: Stance,
    right: Stance
  ): DiffSummary {
    return {
      totalChanges: changes.length,
      majorChanges: changes.filter(c => c.significance === 'major').length,
      moderateChanges: changes.filter(c => c.significance === 'moderate').length,
      minorChanges: changes.filter(c => c.significance === 'minor').length,
      frameChanged: left.frame !== right.frame,
      selfModelChanged: left.selfModel !== right.selfModel,
      coherenceImpact: Math.abs(right.cumulativeDrift - left.cumulativeDrift)
    };
  }

  /**
   * Three-way merge
   */
  merge(
    base: Stance,
    left: Stance,
    right: Stance,
    strategy: MergeStrategy = 'average'
  ): MergeResult {
    const conflicts: MergeConflict[] = [];
    const resolutions: ConflictResolution[] = [];

    // Start with base
    const merged: Stance = JSON.parse(JSON.stringify(base));

    // Diff base->left and base->right
    const leftDiff = this.diff(base, left);
    const rightDiff = this.diff(base, right);

    // Find conflicting paths
    const leftPaths = new Set(leftDiff.changes.map(c => c.path));
    const rightPaths = new Set(rightDiff.changes.map(c => c.path));

    for (const path of leftPaths) {
      if (rightPaths.has(path)) {
        // Conflict
        const leftChange = leftDiff.changes.find(c => c.path === path)!;
        const rightChange = rightDiff.changes.find(c => c.path === path)!;

        if (leftChange.rightValue !== rightChange.rightValue) {
          const conflict: MergeConflict = {
            id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            path,
            baseValue: this.getValueAtPath(base, path),
            leftValue: leftChange.rightValue,
            rightValue: rightChange.rightValue,
            suggestedResolution: this.suggestResolution(
              leftChange.rightValue,
              rightChange.rightValue,
              strategy
            )
          };

          conflicts.push(conflict);

          // Apply resolution based on strategy
          const resolved = this.resolveConflict(conflict, strategy);
          resolutions.push(resolved);
          this.setValueAtPath(merged, path, resolved.customValue);
        } else {
          // Both changed to same value
          this.setValueAtPath(merged, path, leftChange.rightValue);
        }
      } else {
        // Only left changed
        const leftChange = leftDiff.changes.find(c => c.path === path)!;
        this.setValueAtPath(merged, path, leftChange.rightValue);
      }
    }

    // Apply right-only changes
    for (const path of rightPaths) {
      if (!leftPaths.has(path)) {
        const rightChange = rightDiff.changes.find(c => c.path === path)!;
        this.setValueAtPath(merged, path, rightChange.rightValue);
      }
    }

    // Update merged stance metadata
    merged.version++;
    merged.cumulativeDrift = (left.cumulativeDrift + right.cumulativeDrift) / 2;

    this.stats.totalMerges++;
    this.stats.conflictsResolved += resolutions.length;

    return {
      success: true,
      mergedStance: merged,
      conflicts,
      resolutions,
      strategy
    };
  }

  /**
   * Get value at path
   */
  private getValueAtPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set value at path
   */
  private setValueAtPath(obj: unknown, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Suggest resolution for a conflict
   */
  private suggestResolution(
    leftValue: unknown,
    rightValue: unknown,
    strategy: MergeStrategy
  ): unknown {
    switch (strategy) {
      case 'ours':
        return leftValue;
      case 'theirs':
        return rightValue;
      case 'average':
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
          return (leftValue + rightValue) / 2;
        }
        return rightValue;
      case 'union':
        if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
          return [...new Set([...leftValue, ...rightValue])];
        }
        return rightValue;
      case 'latest':
      default:
        return rightValue;
    }
  }

  /**
   * Resolve a conflict
   */
  private resolveConflict(
    conflict: MergeConflict,
    strategy: MergeStrategy
  ): ConflictResolution {
    const resolution = this.suggestResolution(
      conflict.leftValue,
      conflict.rightValue,
      strategy
    );

    return {
      conflictId: conflict.id,
      resolution: strategy === 'ours' ? 'use_left' :
                  strategy === 'theirs' ? 'use_right' : 'custom',
      customValue: resolution,
      reason: `Applied ${strategy} merge strategy`
    };
  }

  /**
   * Cherry-pick specific changes
   */
  cherryPick(
    target: Stance,
    sourceDiff: StanceDiff,
    changePaths: string[]
  ): CherryPickResult {
    const result: Stance = JSON.parse(JSON.stringify(target));
    const appliedChanges: DiffChange[] = [];
    const skippedChanges: DiffChange[] = [];

    for (const change of sourceDiff.changes) {
      if (changePaths.includes(change.path)) {
        this.setValueAtPath(result, change.path, change.rightValue);
        appliedChanges.push(change);
      } else {
        skippedChanges.push(change);
      }
    }

    result.version++;

    return {
      success: true,
      appliedChanges,
      skippedChanges,
      resultStance: result
    };
  }

  /**
   * Create a rollback point
   */
  createRollbackPoint(
    stance: Stance,
    description: string,
    branchId?: string
  ): RollbackPoint {
    const point: RollbackPoint = {
      id: `rollback-${Date.now()}`,
      timestamp: new Date(),
      stance: JSON.parse(JSON.stringify(stance)),
      description,
      branchId
    };

    this.rollbackPoints.set(point.id, point);
    return point;
  }

  /**
   * Rollback to a point
   */
  rollback(rollbackId: string): Stance | null {
    const point = this.rollbackPoints.get(rollbackId);
    if (!point) return null;

    this.stats.rollbacksPerformed++;
    return JSON.parse(JSON.stringify(point.stance));
  }

  /**
   * List rollback points
   */
  listRollbackPoints(branchId?: string): RollbackPoint[] {
    const points = [...this.rollbackPoints.values()];
    if (branchId) {
      return points.filter(p => p.branchId === branchId);
    }
    return points.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Preview merge without applying
   */
  previewMerge(
    base: Stance,
    left: Stance,
    right: Stance,
    strategy: MergeStrategy = 'average'
  ): { conflicts: MergeConflict[]; preview: Record<string, unknown> } {
    const result = this.merge(base, left, right, strategy);

    // Don't count preview in stats
    this.stats.totalMerges--;
    this.stats.conflictsResolved -= result.resolutions.length;

    return {
      conflicts: result.conflicts,
      preview: {
        frame: result.mergedStance?.frame,
        selfModel: result.mergedStance?.selfModel,
        values: result.mergedStance?.values,
        changeCount: result.conflicts.length
      }
    };
  }

  /**
   * Generate visual diff
   */
  visualize(diff: StanceDiff, type: 'tree' | 'side-by-side' | 'unified' = 'unified'): DiffVisualization {
    const highlights: DiffHighlight[] = [];
    let content = '';

    if (type === 'unified') {
      content = this.generateUnifiedDiff(diff, highlights);
    } else if (type === 'side-by-side') {
      content = this.generateSideBySideDiff(diff, highlights);
    } else {
      content = this.generateTreeDiff(diff, highlights);
    }

    return { type, content, highlights };
  }

  /**
   * Generate unified diff view
   */
  private generateUnifiedDiff(diff: StanceDiff, highlights: DiffHighlight[]): string {
    let output = `# Stance Diff\n`;
    output += `## Summary: ${diff.summary.totalChanges} changes\n\n`;

    for (const change of diff.changes) {
      const symbol = change.type === 'added' ? '+' :
                     change.type === 'removed' ? '-' : '~';
      const color = change.type === 'added' ? 'green' :
                    change.type === 'removed' ? 'red' : 'yellow';

      output += `${symbol} ${change.path}: `;

      if (change.type === 'modified') {
        output += `${change.leftValue} → ${change.rightValue}`;
      } else if (change.type === 'added') {
        output += `${change.rightValue}`;
      } else {
        output += `${change.leftValue}`;
      }

      output += ` [${change.significance}]\n`;

      highlights.push({ path: change.path, color, label: change.significance });
    }

    return output;
  }

  /**
   * Generate side-by-side diff view
   */
  private generateSideBySideDiff(diff: StanceDiff, highlights: DiffHighlight[]): string {
    let output = `| Left | Right | Change |\n|------|-------|--------|\n`;

    for (const change of diff.changes) {
      output += `| ${change.leftValue ?? '-'} | ${change.rightValue ?? '-'} | ${change.type} |\n`;

      const color = change.type === 'added' ? 'green' :
                    change.type === 'removed' ? 'red' : 'yellow';
      highlights.push({ path: change.path, color, label: change.path });
    }

    return output;
  }

  /**
   * Generate tree diff view
   */
  private generateTreeDiff(diff: StanceDiff, _highlights: DiffHighlight[]): string {
    let output = 'Stance\n';

    const paths = new Map<string, DiffChange>();
    for (const change of diff.changes) {
      paths.set(change.path, change);
    }

    // Build tree structure
    const renderPath = (path: string, indent: number): string => {
      const change = paths.get(path);
      const prefix = '  '.repeat(indent) + '├─ ';
      let line = prefix + path.split('.').pop();

      if (change) {
        const symbol = change.type === 'added' ? '[+]' :
                       change.type === 'removed' ? '[-]' : '[~]';
        line += ` ${symbol}`;
      }

      return line + '\n';
    };

    for (const path of paths.keys()) {
      const parts = path.split('.');
      for (let i = 0; i < parts.length; i++) {
        const partialPath = parts.slice(0, i + 1).join('.');
        output += renderPath(partialPath, i);
      }
    }

    return output;
  }

  /**
   * Get diff history
   */
  getDiffHistory(limit?: number): StanceDiff[] {
    const history = [...this.diffHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get statistics
   */
  getStats(): DiffStats {
    return { ...this.stats };
  }

  /**
   * Clear rollback points
   */
  clearRollbackPoints(olderThan?: Date): number {
    if (!olderThan) {
      const count = this.rollbackPoints.size;
      this.rollbackPoints.clear();
      return count;
    }

    let cleared = 0;
    for (const [id, point] of this.rollbackPoints) {
      if (point.timestamp < olderThan) {
        this.rollbackPoints.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.rollbackPoints.clear();
    this.diffHistory = [];
    this.stats = {
      totalDiffs: 0,
      totalMerges: 0,
      conflictsResolved: 0,
      rollbacksPerformed: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const stanceDiff = new StanceDiffManager();
