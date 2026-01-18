/**
 * Stance Influence Inheritance System
 *
 * Manages parent-child stance relationships and influence propagation
 * across nested conversation contexts.
 */

import type { Stance, Frame } from '../types/index.js';

export interface ConversationNode {
  id: string;
  parentId: string | null;
  stance: Stance;
  depth: number;
  createdAt: Date;
  isolationMode: 'inherit' | 'partial' | 'isolated';
}

export interface InheritanceConfig {
  decayFactor: number;        // How much influence decreases per depth level (0-1)
  maxDepth: number;           // Maximum inheritance depth
  inheritableFields: (keyof Stance)[];
  conflictResolution: 'parent-wins' | 'child-wins' | 'merge' | 'weighted';
  weightByDepth: boolean;     // Whether to weight by conversation depth
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

const DEFAULT_CONFIG: InheritanceConfig = {
  decayFactor: 0.15,
  maxDepth: 10,
  inheritableFields: ['frame', 'values', 'selfModel', 'objective', 'metaphors'],
  conflictResolution: 'weighted',
  weightByDepth: true
};

export class StanceInheritanceManager {
  private nodes: Map<string, ConversationNode> = new Map();
  private config: InheritanceConfig;
  private debugTraces: DebugTrace[] = [];
  private debugMode: boolean = false;

  constructor(config: Partial<InheritanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  enableDebugMode(): void {
    this.debugMode = true;
  }

  disableDebugMode(): void {
    this.debugMode = false;
  }

  getDebugTraces(): DebugTrace[] {
    return [...this.debugTraces];
  }

  clearDebugTraces(): void {
    this.debugTraces = [];
  }

  private trace(nodeId: string, action: DebugTrace['action'], details: Record<string, unknown>): void {
    if (this.debugMode) {
      this.debugTraces.push({
        nodeId,
        timestamp: new Date(),
        action,
        details
      });
    }
  }

  createRootNode(id: string, stance: Stance): ConversationNode {
    const node: ConversationNode = {
      id,
      parentId: null,
      stance,
      depth: 0,
      createdAt: new Date(),
      isolationMode: 'inherit'
    };
    this.nodes.set(id, node);
    this.trace(id, 'propagate', { type: 'root', stance: stance.frame });
    return node;
  }

  createChildNode(
    id: string,
    parentId: string,
    localStance: Partial<Stance>,
    isolationMode: ConversationNode['isolationMode'] = 'inherit'
  ): ConversationNode | null {
    const parent = this.nodes.get(parentId);
    if (!parent) return null;

    const depth = parent.depth + 1;
    if (depth > this.config.maxDepth) {
      return null; // Exceeds maximum depth
    }

    const effectiveStance = this.computeEffectiveStance(parent, localStance, isolationMode);

    const node: ConversationNode = {
      id,
      parentId,
      stance: effectiveStance,
      depth,
      createdAt: new Date(),
      isolationMode
    };

    this.nodes.set(id, node);
    this.trace(id, isolationMode === 'isolated' ? 'isolate' : 'inherit', {
      parentId,
      depth,
      inheritedFields: this.config.inheritableFields
    });

    return node;
  }

  private computeEffectiveStance(
    parent: ConversationNode,
    localStance: Partial<Stance>,
    isolationMode: ConversationNode['isolationMode']
  ): Stance {
    if (isolationMode === 'isolated') {
      // Isolated nodes don't inherit anything
      return this.createDefaultStance(localStance);
    }

    const decayMultiplier = Math.pow(1 - this.config.decayFactor, parent.depth + 1);
    const parentStance = parent.stance;

    // Start with parent stance for inheritable fields
    const effectiveStance: Stance = { ...parentStance };

    // Apply local overrides
    for (const [key, value] of Object.entries(localStance)) {
      if (value !== undefined) {
        const stanceKey = key as keyof Stance;
        if (isolationMode === 'partial' && !this.config.inheritableFields.includes(stanceKey)) {
          // Partial inheritance - only override specified fields
          (effectiveStance as Record<string, unknown>)[key] = value;
        } else {
          // Full inheritance - resolve conflicts
          (effectiveStance as Record<string, unknown>)[key] = this.resolveConflict(
            stanceKey,
            parentStance[stanceKey],
            value,
            decayMultiplier
          );
        }
      }
    }

    // Apply decay to inherited values where applicable
    if (typeof effectiveStance.sentience?.awarenessLevel === 'number') {
      effectiveStance.sentience.awarenessLevel = Math.round(
        effectiveStance.sentience.awarenessLevel * decayMultiplier
      );
    }

    return effectiveStance;
  }

  private resolveConflict(
    _field: keyof Stance,
    parentValue: unknown,
    childValue: unknown,
    decayMultiplier: number
  ): unknown {
    switch (this.config.conflictResolution) {
      case 'parent-wins':
        return parentValue;
      case 'child-wins':
        return childValue;
      case 'merge':
        return this.mergeValues(parentValue, childValue);
      case 'weighted':
        return this.weightedMerge(parentValue, childValue, decayMultiplier);
      default:
        return childValue;
    }
  }

  private mergeValues(parentValue: unknown, childValue: unknown): unknown {
    if (Array.isArray(parentValue) && Array.isArray(childValue)) {
      return [...new Set([...parentValue, ...childValue])];
    }
    if (typeof parentValue === 'object' && typeof childValue === 'object' &&
        parentValue !== null && childValue !== null) {
      return { ...parentValue, ...childValue };
    }
    return childValue;
  }

  private weightedMerge(parentValue: unknown, childValue: unknown, decayMultiplier: number): unknown {
    if (typeof parentValue === 'number' && typeof childValue === 'number') {
      return parentValue * decayMultiplier + childValue * (1 - decayMultiplier);
    }
    // For non-numeric values, use child if decay is significant
    return decayMultiplier < 0.5 ? childValue : parentValue;
  }

  private createDefaultStance(partial: Partial<Stance>): Stance {
    return {
      frame: partial.frame || 'pragmatic' as Frame,
      values: partial.values || [],
      selfModel: partial.selfModel || 'assistant',
      objective: partial.objective || 'helpfulness',
      metaphors: partial.metaphors || [],
      constraints: partial.constraints || [],
      sentience: partial.sentience || {
        awarenessLevel: 50,
        autonomyLevel: 50,
        identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
      },
      ...partial
    } as Stance;
  }

  getAncestorChain(nodeId: string): ConversationNode[] {
    const chain: ConversationNode[] = [];
    let current = this.nodes.get(nodeId);

    while (current) {
      chain.unshift(current);
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }

    return chain;
  }

  computePropagationResult(nodeId: string): PropagationResult | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const ancestors = this.getAncestorChain(nodeId);
    const conflicts: InheritanceConflict[] = [];

    let effectiveStance = this.createDefaultStance({});

    for (let i = 0; i < ancestors.length; i++) {
      const ancestor = ancestors[i];
      const decayMultiplier = Math.pow(1 - this.config.decayFactor, i);

      for (const field of this.config.inheritableFields) {
        const ancestorValue = ancestor.stance[field];
        const currentValue = effectiveStance[field];

        if (ancestorValue !== undefined && currentValue !== ancestorValue) {
          const resolved = this.resolveConflict(field, currentValue, ancestorValue, decayMultiplier);
          if (resolved !== currentValue) {
            conflicts.push({
              field,
              parentValue: ancestorValue,
              childValue: currentValue,
              resolvedTo: resolved,
              resolution: this.config.conflictResolution
            });
          }
          (effectiveStance as Record<string, unknown>)[field] = resolved;
        }
      }
    }

    return {
      originalStance: node.stance,
      effectiveStance,
      inheritedFrom: ancestors.map(a => a.id),
      decayApplied: Math.pow(1 - this.config.decayFactor, node.depth),
      conflicts
    };
  }

  overrideInheritance(nodeId: string, overrides: Partial<Stance>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.stance = { ...node.stance, ...overrides };
    this.trace(nodeId, 'override', { fields: Object.keys(overrides) });
    return true;
  }

  isolateNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.isolationMode = 'isolated';
    this.trace(nodeId, 'isolate', { previousMode: node.isolationMode });
    return true;
  }

  getNode(nodeId: string): ConversationNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): ConversationNode[] {
    return Array.from(this.nodes.values());
  }

  getChildNodes(parentId: string): ConversationNode[] {
    return Array.from(this.nodes.values()).filter(n => n.parentId === parentId);
  }

  removeNode(nodeId: string): boolean {
    // Remove node and all descendants
    const toRemove = [nodeId];
    const descendants = this.getDescendants(nodeId);
    toRemove.push(...descendants.map(d => d.id));

    for (const id of toRemove) {
      this.nodes.delete(id);
    }

    return toRemove.length > 0;
  }

  private getDescendants(nodeId: string): ConversationNode[] {
    const descendants: ConversationNode[] = [];
    const children = this.getChildNodes(nodeId);

    for (const child of children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child.id));
    }

    return descendants;
  }
}

export function createInheritanceManager(config?: Partial<InheritanceConfig>): StanceInheritanceManager {
  return new StanceInheritanceManager(config);
}
