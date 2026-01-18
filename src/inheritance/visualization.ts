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
  position?: { x: number; y: number };
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

const NODE_COLORS: Record<string, string> = {
  template: '#4A90D9',
  stance: '#7CB342',
  override: '#FFA726',
  mixin: '#AB47BC'
};

export class InheritanceVisualizer {
  private templates: Map<string, Template> = new Map();
  private debugSessions: Map<string, DebugSession> = new Map();
  private onConflictCallbacks: Array<(conflict: InheritanceConflict) => void> = [];

  registerTemplate(template: Template): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  buildGraph(rootTemplateId: string): InheritanceGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const conflicts: InheritanceConflict[] = [];
    const visited = new Set<string>();

    // Build graph recursively
    this.buildNodeRecursive(rootTemplateId, nodes, edges, visited, 0);

    // Detect conflicts
    conflicts.push(...this.detectConflicts(nodes, edges));

    // Calculate positions
    this.calculatePositions(nodes, edges);

    return {
      nodes,
      edges,
      conflicts,
      metadata: {
        totalNodes: nodes.length,
        maxDepth: Math.max(...nodes.map(n => n.depth), 0),
        conflictCount: conflicts.length,
        overrideCount: edges.filter(e => e.type === 'overrides').length,
        generatedAt: new Date()
      }
    };
  }

  private buildNodeRecursive(
    templateId: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    visited: Set<string>,
    depth: number
  ): void {
    if (visited.has(templateId)) return;
    visited.add(templateId);

    const template = this.templates.get(templateId);
    if (!template) return;

    const node: GraphNode = {
      id: template.id,
      name: template.name,
      type: 'template',
      stance: template.stance,
      depth,
      isRoot: depth === 0,
      isLeaf: !template.extends || template.extends.length === 0,
      style: {
        color: NODE_COLORS.template,
        borderColor: '#333',
        borderWidth: 2,
        shape: 'rectangle',
        opacity: 1
      }
    };

    nodes.push(node);

    // Process parent templates
    if (template.extends) {
      for (const parentId of template.extends) {
        edges.push({
          id: `edge-${parentId}-${templateId}`,
          from: parentId,
          to: templateId,
          type: 'extends',
          overriddenFields: this.findOverriddenFields(parentId, templateId),
          style: {
            color: '#666',
            width: 2,
            style: 'solid',
            animated: false
          }
        });

        this.buildNodeRecursive(parentId, nodes, edges, visited, depth + 1);
      }
    }
  }

  private findOverriddenFields(parentId: string, childId: string): string[] {
    const parent = this.templates.get(parentId);
    const child = this.templates.get(childId);
    if (!parent || !child) return [];

    const overridden: string[] = [];

    const checkOverrides = (
      parentObj: Record<string, unknown>,
      childObj: Record<string, unknown>,
      prefix: string = ''
    ) => {
      for (const key of Object.keys(childObj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (key in parentObj) {
          if (typeof childObj[key] === 'object' && childObj[key] !== null &&
              typeof parentObj[key] === 'object' && parentObj[key] !== null) {
            checkOverrides(
              parentObj[key] as Record<string, unknown>,
              childObj[key] as Record<string, unknown>,
              fullPath
            );
          } else if (JSON.stringify(parentObj[key]) !== JSON.stringify(childObj[key])) {
            overridden.push(fullPath);
          }
        }
      }
    };

    checkOverrides(
      parent.stance as Record<string, unknown>,
      child.stance as Record<string, unknown>
    );

    return overridden;
  }

  private detectConflicts(nodes: GraphNode[], edges: GraphEdge[]): InheritanceConflict[] {
    const conflicts: InheritanceConflict[] = [];

    // Find diamond inheritance patterns
    for (const node of nodes) {
      const parents = edges.filter(e => e.to === node.id).map(e => e.from);
      if (parents.length <= 1) continue;

      // Check for conflicting field definitions
      const fieldSources = new Map<string, ConflictSource[]>();

      for (const parentId of parents) {
        const parent = this.templates.get(parentId);
        if (!parent) continue;

        this.extractFieldSources(parent, parentId, fieldSources);
      }

      // Identify conflicts where multiple parents define the same field differently
      for (const [field, sources] of fieldSources) {
        if (sources.length > 1) {
          const uniqueValues = new Set(sources.map(s => JSON.stringify(s.value)));
          if (uniqueValues.size > 1) {
            const conflict: InheritanceConflict = {
              id: `conflict-${node.id}-${field}`,
              field,
              sources,
              resolution: this.resolveConflict(sources),
              severity: 'warning'
            };
            conflicts.push(conflict);
            this.notifyConflict(conflict);
          }
        }
      }
    }

    return conflicts;
  }

  private extractFieldSources(
    template: Template,
    nodeId: string,
    fieldSources: Map<string, ConflictSource[]>
  ): void {
    const traverse = (obj: Record<string, unknown>, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value as Record<string, unknown>, fullPath);
        } else {
          const sources = fieldSources.get(fullPath) || [];
          sources.push({
            nodeId,
            nodeName: template.name,
            value,
            priority: template.priority
          });
          fieldSources.set(fullPath, sources);
        }
      }
    };

    traverse(template.stance as Record<string, unknown>);
  }

  private resolveConflict(sources: ConflictSource[]): ConflictResolution {
    // Sort by priority (higher wins)
    const sorted = [...sources].sort((a, b) => b.priority - a.priority);
    const winner = sorted[0];

    return {
      strategy: 'first-wins',
      resolvedValue: winner.value,
      resolvedFrom: winner.nodeId
    };
  }

  private calculatePositions(nodes: GraphNode[], _edges: GraphEdge[]): void {
    // Group nodes by depth
    const depthGroups = new Map<number, GraphNode[]>();
    for (const node of nodes) {
      const group = depthGroups.get(node.depth) || [];
      group.push(node);
      depthGroups.set(node.depth, group);
    }

    // Assign positions
    const levelWidth = 200;
    const nodeSpacing = 150;

    for (const [depth, group] of depthGroups) {
      const startX = -(group.length - 1) * nodeSpacing / 2;
      for (let i = 0; i < group.length; i++) {
        group[i].position = {
          x: startX + i * nodeSpacing,
          y: depth * levelWidth
        };
      }
    }
  }

  traceProperty(templateId: string, field: string): PropertyTrace {
    const sources: PropertySource[] = [];
    const overrideChain: OverrideStep[] = [];

    this.tracePropertyRecursive(templateId, field, sources, overrideChain, 0);

    // Determine final value
    const finalSource = sources.find(s => !s.wasOverridden);
    const finalValue = finalSource?.value;

    return {
      field,
      finalValue,
      sources,
      overrideChain
    };
  }

  private tracePropertyRecursive(
    templateId: string,
    field: string,
    sources: PropertySource[],
    overrideChain: OverrideStep[],
    depth: number
  ): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    const value = this.getFieldValue(template.stance, field);
    const wasOverridden = sources.length > 0 && sources[sources.length - 1].value !== undefined;

    if (value !== undefined) {
      sources.push({
        nodeId: templateId,
        nodeName: template.name,
        value,
        depth,
        wasOverridden
      });

      if (wasOverridden) {
        const prevSource = sources[sources.length - 2];
        overrideChain.push({
          from: prevSource.nodeId,
          to: templateId,
          previousValue: prevSource.value,
          newValue: value
        });
      }
    }

    if (template.extends) {
      for (const parentId of template.extends) {
        this.tracePropertyRecursive(parentId, field, sources, overrideChain, depth + 1);
      }
    }
  }

  private getFieldValue(stance: Partial<Stance>, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = stance;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  generateDiff(template1Id: string, template2Id: string): TemplateDiff {
    const t1 = this.templates.get(template1Id);
    const t2 = this.templates.get(template2Id);

    if (!t1 || !t2) {
      return {
        template1: template1Id,
        template2: template2Id,
        additions: [],
        removals: [],
        modifications: [],
        similarity: 0
      };
    }

    const additions: FieldDiff[] = [];
    const removals: FieldDiff[] = [];
    const modifications: FieldDiff[] = [];

    const fields1 = new Set(this.getAllFields(t1.stance));
    const fields2 = new Set(this.getAllFields(t2.stance));

    // Find additions (in t2 but not t1)
    for (const field of fields2) {
      if (!fields1.has(field)) {
        additions.push({
          field,
          value2: this.getFieldValue(t2.stance, field),
          changeType: 'added'
        });
      }
    }

    // Find removals (in t1 but not t2)
    for (const field of fields1) {
      if (!fields2.has(field)) {
        removals.push({
          field,
          value1: this.getFieldValue(t1.stance, field),
          changeType: 'removed'
        });
      }
    }

    // Find modifications (different values)
    for (const field of fields1) {
      if (fields2.has(field)) {
        const v1 = this.getFieldValue(t1.stance, field);
        const v2 = this.getFieldValue(t2.stance, field);
        if (JSON.stringify(v1) !== JSON.stringify(v2)) {
          modifications.push({
            field,
            value1: v1,
            value2: v2,
            changeType: 'modified'
          });
        }
      }
    }

    // Calculate similarity
    const totalFields = new Set([...fields1, ...fields2]).size;
    const unchangedFields = totalFields - additions.length - removals.length - modifications.length;
    const similarity = totalFields > 0 ? (unchangedFields / totalFields) * 100 : 100;

    return {
      template1: template1Id,
      template2: template2Id,
      additions,
      removals,
      modifications,
      similarity: Math.round(similarity)
    };
  }

  private getAllFields(stance: Partial<Stance>): string[] {
    const fields: string[] = [];

    const traverse = (obj: Record<string, unknown>, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value as Record<string, unknown>, fullPath);
        } else {
          fields.push(fullPath);
        }
      }
    };

    traverse(stance as Record<string, unknown>);
    return fields;
  }

  startDebugSession(graphId: string): DebugSession {
    const graph = this.buildGraph(graphId);

    const session: DebugSession = {
      id: `debug-${Date.now()}`,
      graph,
      breakpoints: [],
      watchedFields: [],
      executionLog: [],
      isActive: true
    };

    this.debugSessions.set(session.id, session);
    return session;
  }

  addBreakpoint(sessionId: string, nodeId: string, field?: string, condition?: string): boolean {
    const session = this.debugSessions.get(sessionId);
    if (!session) return false;

    session.breakpoints.push({
      nodeId,
      field,
      condition,
      enabled: true
    });

    return true;
  }

  watchField(sessionId: string, field: string): boolean {
    const session = this.debugSessions.get(sessionId);
    if (!session) return false;

    if (!session.watchedFields.includes(field)) {
      session.watchedFields.push(field);
    }

    return true;
  }

  logDebugEvent(sessionId: string, entry: Omit<DebugLogEntry, 'timestamp'>): void {
    const session = this.debugSessions.get(sessionId);
    if (!session || !session.isActive) return;

    session.executionLog.push({
      ...entry,
      timestamp: new Date()
    });

    // Limit log size
    if (session.executionLog.length > 1000) {
      session.executionLog = session.executionLog.slice(-500);
    }
  }

  getDebugSession(sessionId: string): DebugSession | undefined {
    return this.debugSessions.get(sessionId);
  }

  endDebugSession(sessionId: string): void {
    const session = this.debugSessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  onConflict(callback: (conflict: InheritanceConflict) => void): () => void {
    this.onConflictCallbacks.push(callback);
    return () => {
      const idx = this.onConflictCallbacks.indexOf(callback);
      if (idx > -1) this.onConflictCallbacks.splice(idx, 1);
    };
  }

  private notifyConflict(conflict: InheritanceConflict): void {
    for (const callback of this.onConflictCallbacks) {
      callback(conflict);
    }
  }

  getTemplate(templateId: string): Template | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  exportGraph(graph: InheritanceGraph, format: 'json' | 'dot' | 'mermaid'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
      case 'dot':
        return this.toGraphviz(graph);
      case 'mermaid':
        return this.toMermaid(graph);
      default:
        return JSON.stringify(graph, null, 2);
    }
  }

  private toGraphviz(graph: InheritanceGraph): string {
    const lines: string[] = ['digraph InheritanceGraph {'];
    lines.push('  rankdir=BT;');

    for (const node of graph.nodes) {
      lines.push(`  "${node.id}" [label="${node.name}", shape=${node.style.shape}];`);
    }

    for (const edge of graph.edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private toMermaid(graph: InheritanceGraph): string {
    const lines: string[] = ['graph BT'];

    for (const node of graph.nodes) {
      lines.push(`  ${node.id}["${node.name}"]`);
    }

    for (const edge of graph.edges) {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }

    return lines.join('\n');
  }
}

export function createInheritanceVisualizer(): InheritanceVisualizer {
  return new InheritanceVisualizer();
}
