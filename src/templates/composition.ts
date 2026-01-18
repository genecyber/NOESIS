/**
 * Template Composition and Inheritance
 *
 * Enables templates to extend other templates, creating hierarchies
 * with override, merge, and diamond inheritance resolution.
 */

import type { Stance, Frame, SelfModel, Objective, Values } from '../types/index.js';

export interface ComposableTemplate {
  id: string;
  name: string;
  description: string;
  extends?: string[];
  overrides: Partial<TemplateDefinition>;
  mergeStrategy: MergeStrategy;
  validationRules: ValidationRule[];
  metadata: TemplateMetadata;
}

export interface TemplateDefinition {
  frame: Frame;
  values: Values;
  selfModel: SelfModel;
  objective: Objective;
  metaphors: string[];
  constraints: string[];
}

export interface MergeStrategy {
  values: 'first' | 'last' | 'average' | 'max' | 'min';
  metaphors: 'concat' | 'unique' | 'replace';
  constraints: 'concat' | 'unique' | 'replace';
  conflictResolution: 'error' | 'first-wins' | 'last-wins' | 'explicit';
}

export interface ValidationRule {
  field: string;
  constraint: 'required' | 'range' | 'enum' | 'custom';
  value?: unknown;
  message: string;
}

export interface TemplateMetadata {
  version: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  dependencies: string[];
}

export interface ResolvedTemplate {
  id: string;
  name: string;
  resolved: TemplateDefinition;
  inheritanceChain: string[];
  appliedOverrides: Array<{ templateId: string; fields: string[] }>;
  warnings: string[];
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value: unknown;
}

export interface InheritanceGraph {
  nodes: Map<string, ComposableTemplate>;
  edges: Map<string, string[]>;
  cycles: string[][];
}

function createDefaultValues(): Values {
  return {
    curiosity: 50, certainty: 50, risk: 50,
    novelty: 50, empathy: 50, provocation: 50, synthesis: 50
  };
}

function createDefaultSentience() {
  return {
    awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
    emergentGoals: [] as string[],
    consciousnessInsights: [] as string[],
    persistentValues: [] as string[]
  };
}

function createStanceMetadata() {
  return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}

const BASE_TEMPLATE: TemplateDefinition = {
  frame: 'pragmatic',
  values: createDefaultValues(),
  selfModel: 'guide',
  objective: 'helpfulness',
  metaphors: ['assistant'],
  constraints: ['base-template']
};

export class TemplateComposer {
  private templates: Map<string, ComposableTemplate> = new Map();
  private resolvedCache: Map<string, ResolvedTemplate> = new Map();

  constructor() {
    this.registerBuiltinTemplates();
  }

  private registerBuiltinTemplates(): void {
    // Base template
    this.register({
      id: 'base',
      name: 'Base Template',
      description: 'Foundation template for all others',
      overrides: { ...BASE_TEMPLATE },
      mergeStrategy: {
        values: 'average',
        metaphors: 'unique',
        constraints: 'unique',
        conflictResolution: 'last-wins'
      },
      validationRules: [],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['core'],
        dependencies: []
      }
    });

    // Analytical template
    this.register({
      id: 'analytical',
      name: 'Analytical Template',
      description: 'For logical, structured analysis',
      extends: ['base'],
      overrides: {
        frame: 'systems',
        values: { ...createDefaultValues(), certainty: 70, synthesis: 65 },
        selfModel: 'synthesizer'
      },
      mergeStrategy: {
        values: 'max',
        metaphors: 'concat',
        constraints: 'unique',
        conflictResolution: 'last-wins'
      },
      validationRules: [
        { field: 'values.certainty', constraint: 'range', value: [50, 100], message: 'Certainty must be high for analytical' }
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['analytical', 'logical'],
        dependencies: ['base']
      }
    });

    // Creative template
    this.register({
      id: 'creative',
      name: 'Creative Template',
      description: 'For imaginative, artistic expression',
      extends: ['base'],
      overrides: {
        frame: 'poetic',
        values: { ...createDefaultValues(), novelty: 80, risk: 60, curiosity: 75 },
        selfModel: 'provocateur',
        objective: 'novelty'
      },
      mergeStrategy: {
        values: 'max',
        metaphors: 'concat',
        constraints: 'unique',
        conflictResolution: 'last-wins'
      },
      validationRules: [
        { field: 'values.novelty', constraint: 'range', value: [60, 100], message: 'Novelty must be high for creative' }
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['creative', 'artistic'],
        dependencies: ['base']
      }
    });

    // Empathetic template
    this.register({
      id: 'empathetic',
      name: 'Empathetic Template',
      description: 'For compassionate, supportive interaction',
      extends: ['base'],
      overrides: {
        frame: 'psychoanalytic',
        values: { ...createDefaultValues(), empathy: 85, provocation: 20 },
        selfModel: 'guide',
        objective: 'helpfulness'
      },
      mergeStrategy: {
        values: 'max',
        metaphors: 'concat',
        constraints: 'unique',
        conflictResolution: 'last-wins'
      },
      validationRules: [
        { field: 'values.empathy', constraint: 'range', value: [70, 100], message: 'Empathy must be high' }
      ],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['empathetic', 'supportive'],
        dependencies: ['base']
      }
    });
  }

  register(template: ComposableTemplate): void {
    this.templates.set(template.id, template);
    this.resolvedCache.delete(template.id);
  }

  unregister(templateId: string): boolean {
    this.resolvedCache.delete(templateId);
    return this.templates.delete(templateId);
  }

  resolve(templateId: string): ResolvedTemplate {
    const cached = this.resolvedCache.get(templateId);
    if (cached) return cached;

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const inheritanceChain = this.buildInheritanceChain(templateId);
    this.detectCycles(inheritanceChain);

    const resolved = this.mergeTemplates(inheritanceChain);
    const appliedOverrides = this.trackOverrides(inheritanceChain);
    const warnings = this.generateWarnings(inheritanceChain);

    const result: ResolvedTemplate = {
      id: templateId,
      name: template.name,
      resolved,
      inheritanceChain,
      appliedOverrides,
      warnings
    };

    this.resolvedCache.set(templateId, result);
    return result;
  }

  private buildInheritanceChain(templateId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const template = this.templates.get(id);
      if (!template) return;

      if (template.extends) {
        for (const parentId of template.extends) {
          visit(parentId);
        }
      }

      chain.push(id);
    };

    visit(templateId);
    return chain;
  }

  private detectCycles(chain: string[]): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (id: string): boolean => {
      if (visited.has(id)) return false;
      if (visiting.has(id)) return true;

      visiting.add(id);
      const template = this.templates.get(id);

      if (template?.extends) {
        for (const parentId of template.extends) {
          if (dfs(parentId)) {
            throw new Error(`Circular inheritance detected involving: ${id}`);
          }
        }
      }

      visiting.delete(id);
      visited.add(id);
      return false;
    };

    for (const id of chain) {
      dfs(id);
    }
  }

  private mergeTemplates(chain: string[]): TemplateDefinition {
    const result: TemplateDefinition = { ...BASE_TEMPLATE, values: createDefaultValues() };

    for (const templateId of chain) {
      const template = this.templates.get(templateId)!;
      const { overrides, mergeStrategy } = template;

      if (overrides.frame) result.frame = overrides.frame;
      if (overrides.selfModel) result.selfModel = overrides.selfModel;
      if (overrides.objective) result.objective = overrides.objective;

      if (overrides.values) {
        result.values = this.mergeValues(result.values, overrides.values, mergeStrategy.values);
      }

      if (overrides.metaphors) {
        result.metaphors = this.mergeMetaphors(result.metaphors, overrides.metaphors, mergeStrategy.metaphors);
      }

      if (overrides.constraints) {
        result.constraints = this.mergeConstraints(result.constraints, overrides.constraints, mergeStrategy.constraints);
      }
    }

    return result;
  }

  private mergeValues(base: Values, override: Partial<Values>, strategy: MergeStrategy['values']): Values {
    const result = { ...base };
    const keys = Object.keys(override) as (keyof Values)[];

    for (const key of keys) {
      const baseVal = base[key];
      const overrideVal = override[key];

      if (overrideVal === undefined) continue;

      switch (strategy) {
        case 'first':
          break;
        case 'last':
          result[key] = overrideVal;
          break;
        case 'average':
          result[key] = Math.round((baseVal + overrideVal) / 2);
          break;
        case 'max':
          result[key] = Math.max(baseVal, overrideVal);
          break;
        case 'min':
          result[key] = Math.min(baseVal, overrideVal);
          break;
      }
    }

    return result;
  }

  private mergeMetaphors(base: string[], override: string[], strategy: MergeStrategy['metaphors']): string[] {
    switch (strategy) {
      case 'concat':
        return [...base, ...override];
      case 'unique':
        return [...new Set([...base, ...override])];
      case 'replace':
        return override;
    }
  }

  private mergeConstraints(
    base: string[],
    override: string[],
    strategy: MergeStrategy['constraints']
  ): string[] {
    switch (strategy) {
      case 'concat':
        return [...base, ...override];
      case 'unique':
        return [...new Set([...base, ...override])];
      case 'replace':
        return override;
    }
  }

  private trackOverrides(chain: string[]): Array<{ templateId: string; fields: string[] }> {
    const overrides: Array<{ templateId: string; fields: string[] }> = [];

    for (const templateId of chain) {
      const template = this.templates.get(templateId)!;
      const fields = Object.keys(template.overrides);
      if (fields.length > 0) {
        overrides.push({ templateId, fields });
      }
    }

    return overrides;
  }

  private generateWarnings(chain: string[]): string[] {
    const warnings: string[] = [];

    // Check for diamond inheritance
    const parentCounts = new Map<string, number>();
    for (const templateId of chain) {
      const template = this.templates.get(templateId);
      if (template?.extends) {
        for (const parentId of template.extends) {
          parentCounts.set(parentId, (parentCounts.get(parentId) || 0) + 1);
        }
      }
    }

    for (const [parentId, count] of parentCounts) {
      if (count > 1) {
        warnings.push(`Diamond inheritance detected: ${parentId} is inherited multiple times`);
      }
    }

    return warnings;
  }

  validate(templateId: string): TemplateValidationResult {
    const resolved = this.resolve(templateId);
    const template = this.templates.get(templateId)!;

    const errors: ValidationError[] = [];
    const warnings: string[] = [...resolved.warnings];

    for (const rule of template.validationRules) {
      const value = this.getNestedValue(resolved.resolved, rule.field);
      const isValid = this.evaluateRule(rule, value);

      if (!isValid) {
        errors.push({
          field: rule.field,
          rule: rule.constraint,
          message: rule.message,
          value
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private evaluateRule(rule: ValidationRule, value: unknown): boolean {
    switch (rule.constraint) {
      case 'required':
        return value !== undefined && value !== null;
      case 'range':
        if (typeof value !== 'number' || !Array.isArray(rule.value)) return false;
        return value >= rule.value[0] && value <= rule.value[1];
      case 'enum':
        return Array.isArray(rule.value) && rule.value.includes(value);
      default:
        return true;
    }
  }

  createFromTemplate(templateId: string): Stance {
    const resolved = this.resolve(templateId);

    return {
      ...resolved.resolved,
      sentience: createDefaultSentience(),
      ...createStanceMetadata()
    };
  }

  compose(templateIds: string[]): ComposableTemplate {
    const composedId = `composed-${templateIds.join('-')}-${Date.now()}`;

    const composed: ComposableTemplate = {
      id: composedId,
      name: `Composed: ${templateIds.join(' + ')}`,
      description: `Composition of ${templateIds.length} templates`,
      extends: templateIds,
      overrides: {},
      mergeStrategy: {
        values: 'average',
        metaphors: 'unique',
        constraints: 'unique',
        conflictResolution: 'last-wins'
      },
      validationRules: [],
      metadata: {
        version: '1.0.0',
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['composed'],
        dependencies: templateIds
      }
    };

    this.register(composed);
    return composed;
  }

  getInheritanceGraph(): InheritanceGraph {
    const nodes = new Map(this.templates);
    const edges = new Map<string, string[]>();

    for (const [id, template] of this.templates) {
      edges.set(id, template.extends || []);
    }

    return { nodes, edges, cycles: [] };
  }

  listTemplates(): ComposableTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): ComposableTemplate | undefined {
    return this.templates.get(templateId);
  }
}

export function createTemplateComposer(): TemplateComposer {
  return new TemplateComposer();
}
