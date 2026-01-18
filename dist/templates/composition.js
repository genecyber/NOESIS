/**
 * Template Composition and Inheritance
 *
 * Enables templates to extend other templates, creating hierarchies
 * with override, merge, and diamond inheritance resolution.
 */
function createDefaultValues() {
    return {
        curiosity: 50, certainty: 50, risk: 50,
        novelty: 50, empathy: 50, provocation: 50, synthesis: 50
    };
}
function createDefaultSentience() {
    return {
        awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
    };
}
function createStanceMetadata() {
    return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}
const BASE_TEMPLATE = {
    frame: 'pragmatic',
    values: createDefaultValues(),
    selfModel: 'guide',
    objective: 'helpfulness',
    metaphors: ['assistant'],
    constraints: ['base-template']
};
export class TemplateComposer {
    templates = new Map();
    resolvedCache = new Map();
    constructor() {
        this.registerBuiltinTemplates();
    }
    registerBuiltinTemplates() {
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
    register(template) {
        this.templates.set(template.id, template);
        this.resolvedCache.delete(template.id);
    }
    unregister(templateId) {
        this.resolvedCache.delete(templateId);
        return this.templates.delete(templateId);
    }
    resolve(templateId) {
        const cached = this.resolvedCache.get(templateId);
        if (cached)
            return cached;
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        const inheritanceChain = this.buildInheritanceChain(templateId);
        this.detectCycles(inheritanceChain);
        const resolved = this.mergeTemplates(inheritanceChain);
        const appliedOverrides = this.trackOverrides(inheritanceChain);
        const warnings = this.generateWarnings(inheritanceChain);
        const result = {
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
    buildInheritanceChain(templateId) {
        const chain = [];
        const visited = new Set();
        const visit = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            const template = this.templates.get(id);
            if (!template)
                return;
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
    detectCycles(chain) {
        const visiting = new Set();
        const visited = new Set();
        const dfs = (id) => {
            if (visited.has(id))
                return false;
            if (visiting.has(id))
                return true;
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
    mergeTemplates(chain) {
        const result = { ...BASE_TEMPLATE, values: createDefaultValues() };
        for (const templateId of chain) {
            const template = this.templates.get(templateId);
            const { overrides, mergeStrategy } = template;
            if (overrides.frame)
                result.frame = overrides.frame;
            if (overrides.selfModel)
                result.selfModel = overrides.selfModel;
            if (overrides.objective)
                result.objective = overrides.objective;
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
    mergeValues(base, override, strategy) {
        const result = { ...base };
        const keys = Object.keys(override);
        for (const key of keys) {
            const baseVal = base[key];
            const overrideVal = override[key];
            if (overrideVal === undefined)
                continue;
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
    mergeMetaphors(base, override, strategy) {
        switch (strategy) {
            case 'concat':
                return [...base, ...override];
            case 'unique':
                return [...new Set([...base, ...override])];
            case 'replace':
                return override;
        }
    }
    mergeConstraints(base, override, strategy) {
        switch (strategy) {
            case 'concat':
                return [...base, ...override];
            case 'unique':
                return [...new Set([...base, ...override])];
            case 'replace':
                return override;
        }
    }
    trackOverrides(chain) {
        const overrides = [];
        for (const templateId of chain) {
            const template = this.templates.get(templateId);
            const fields = Object.keys(template.overrides);
            if (fields.length > 0) {
                overrides.push({ templateId, fields });
            }
        }
        return overrides;
    }
    generateWarnings(chain) {
        const warnings = [];
        // Check for diamond inheritance
        const parentCounts = new Map();
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
    validate(templateId) {
        const resolved = this.resolve(templateId);
        const template = this.templates.get(templateId);
        const errors = [];
        const warnings = [...resolved.warnings];
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
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    evaluateRule(rule, value) {
        switch (rule.constraint) {
            case 'required':
                return value !== undefined && value !== null;
            case 'range':
                if (typeof value !== 'number' || !Array.isArray(rule.value))
                    return false;
                return value >= rule.value[0] && value <= rule.value[1];
            case 'enum':
                return Array.isArray(rule.value) && rule.value.includes(value);
            default:
                return true;
        }
    }
    createFromTemplate(templateId) {
        const resolved = this.resolve(templateId);
        return {
            ...resolved.resolved,
            sentience: createDefaultSentience(),
            ...createStanceMetadata()
        };
    }
    compose(templateIds) {
        const composedId = `composed-${templateIds.join('-')}-${Date.now()}`;
        const composed = {
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
    getInheritanceGraph() {
        const nodes = new Map(this.templates);
        const edges = new Map();
        for (const [id, template] of this.templates) {
            edges.set(id, template.extends || []);
        }
        return { nodes, edges, cycles: [] };
    }
    listTemplates() {
        return Array.from(this.templates.values());
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
}
export function createTemplateComposer() {
    return new TemplateComposer();
}
//# sourceMappingURL=composition.js.map