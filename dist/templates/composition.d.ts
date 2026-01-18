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
    appliedOverrides: Array<{
        templateId: string;
        fields: string[];
    }>;
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
export declare class TemplateComposer {
    private templates;
    private resolvedCache;
    constructor();
    private registerBuiltinTemplates;
    register(template: ComposableTemplate): void;
    unregister(templateId: string): boolean;
    resolve(templateId: string): ResolvedTemplate;
    private buildInheritanceChain;
    private detectCycles;
    private mergeTemplates;
    private mergeValues;
    private mergeMetaphors;
    private mergeConstraints;
    private trackOverrides;
    private generateWarnings;
    validate(templateId: string): TemplateValidationResult;
    private getNestedValue;
    private evaluateRule;
    createFromTemplate(templateId: string): Stance;
    compose(templateIds: string[]): ComposableTemplate;
    getInheritanceGraph(): InheritanceGraph;
    listTemplates(): ComposableTemplate[];
    getTemplate(templateId: string): ComposableTemplate | undefined;
}
export declare function createTemplateComposer(): TemplateComposer;
//# sourceMappingURL=composition.d.ts.map