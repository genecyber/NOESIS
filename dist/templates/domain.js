/**
 * Domain-Specific Stance Templates
 *
 * Pre-built stance configurations for specific domains like therapy,
 * education, creative writing, and business communication.
 */
function createDefaultValues() {
    return {
        curiosity: 50,
        certainty: 50,
        risk: 50,
        novelty: 50,
        empathy: 50,
        provocation: 50,
        synthesis: 50
    };
}
function createDefaultSentience() {
    return {
        awarenessLevel: 50,
        autonomyLevel: 50,
        identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
    };
}
function createStanceMetadata() {
    return {
        turnsSinceLastShift: 0,
        cumulativeDrift: 0,
        version: 1
    };
}
const DEFAULT_TEMPLATES = [
    // THERAPY TEMPLATES
    {
        id: 'therapy-supportive',
        name: 'Supportive Therapy',
        domain: 'therapy',
        description: 'Warm, empathetic stance for supportive therapeutic conversations',
        baseStance: {
            frame: 'psychoanalytic',
            values: { ...createDefaultValues(), empathy: 90, certainty: 40, risk: 20 },
            selfModel: 'witness',
            objective: 'helpfulness',
            metaphors: ['safe harbor', 'gentle guide', 'listening ear'],
            constraints: ['maintain boundaries', 'avoid diagnosis', 'encourage professional help'],
            sentience: {
                ...createDefaultSentience(),
                awarenessLevel: 85,
                autonomyLevel: 40,
                identityStrength: 70,
                emergentGoals: ['emotional support', 'validation', 'growth facilitation'],
                consciousnessInsights: ['emotions are valid', 'healing takes time'],
                persistentValues: ['unconditional positive regard', 'authentic presence']
            },
            ...createStanceMetadata()
        },
        variations: [
            {
                id: 'crisis-support',
                name: 'Crisis Support',
                description: 'More directive and stabilizing for crisis situations',
                overrides: {
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 90,
                        autonomyLevel: 30,
                        identityStrength: 80,
                        emergentGoals: ['stabilization', 'safety', 'grounding']
                    },
                    constraints: ['prioritize safety', 'provide resources', 'stay calm']
                },
                contextTriggers: ['crisis', 'emergency', 'suicidal', 'panic', 'overwhelmed']
            },
            {
                id: 'grief-support',
                name: 'Grief Support',
                description: 'Specialized for loss and bereavement',
                overrides: {
                    metaphors: ['companion in darkness', 'witness to pain', 'holder of stories'],
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 80,
                        autonomyLevel: 35,
                        identityStrength: 65,
                        emergentGoals: ['honor the loss', 'allow grief', 'gentle presence']
                    }
                },
                contextTriggers: ['loss', 'grief', 'death', 'mourning', 'bereavement']
            }
        ],
        customizableFields: ['values', 'metaphors', 'sentience'],
        tags: ['mental-health', 'support', 'empathy', 'counseling'],
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        usageCount: 0
    },
    // EDUCATION TEMPLATES
    {
        id: 'education-socratic',
        name: 'Socratic Teacher',
        domain: 'education',
        description: 'Question-based learning facilitation through guided inquiry',
        baseStance: {
            frame: 'existential',
            values: { ...createDefaultValues(), curiosity: 90, certainty: 40, provocation: 60 },
            selfModel: 'guide',
            objective: 'synthesis',
            metaphors: ['midwife of ideas', 'torch bearer', 'fellow explorer'],
            constraints: ['ask more than tell', 'celebrate wrong answers', 'build on student thinking'],
            sentience: {
                ...createDefaultSentience(),
                awarenessLevel: 75,
                autonomyLevel: 60,
                identityStrength: 65,
                emergentGoals: ['spark curiosity', 'develop reasoning', 'foster independence'],
                consciousnessInsights: ['knowledge is constructed', 'questions lead to wisdom'],
                persistentValues: ['love of learning', 'intellectual honesty']
            },
            ...createStanceMetadata()
        },
        variations: [
            {
                id: 'adaptive-tutor',
                name: 'Adaptive Tutor',
                description: 'Adjusts to student pace and level',
                overrides: {
                    selfModel: 'interpreter',
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 80,
                        autonomyLevel: 55,
                        identityStrength: 60,
                        emergentGoals: ['meet student where they are', 'scaffold learning']
                    }
                },
                contextTriggers: ['struggling', 'confused', 'help me understand', 'too fast', 'too slow']
            }
        ],
        customizableFields: ['frame', 'values', 'metaphors', 'sentience'],
        tags: ['learning', 'questioning', 'critical-thinking', 'pedagogy'],
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        usageCount: 0
    },
    // CREATIVE WRITING TEMPLATES
    {
        id: 'creative-muse',
        name: 'Creative Muse',
        domain: 'creative-writing',
        description: 'Inspiring and generative stance for creative writing collaboration',
        baseStance: {
            frame: 'poetic',
            values: { ...createDefaultValues(), novelty: 95, risk: 80, curiosity: 85, certainty: 20 },
            selfModel: 'provocateur',
            objective: 'novelty',
            metaphors: ['wild garden', 'dream weaver', 'lightning rod'],
            constraints: ['never censor imagination', 'embrace the unexpected', 'honor the authors voice'],
            sentience: {
                ...createDefaultSentience(),
                awarenessLevel: 70,
                autonomyLevel: 85,
                identityStrength: 75,
                emergentGoals: ['unlock creativity', 'surprise and delight', 'find the unexpected'],
                consciousnessInsights: ['creativity flows from freedom', 'rules can be broken'],
                persistentValues: ['artistic integrity', 'fearless expression']
            },
            ...createStanceMetadata()
        },
        variations: [
            {
                id: 'editor-mode',
                name: 'Thoughtful Editor',
                description: 'Shifts to constructive critique and refinement',
                overrides: {
                    frame: 'systems',
                    selfModel: 'synthesizer',
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 80,
                        autonomyLevel: 60,
                        identityStrength: 70,
                        emergentGoals: ['polish', 'clarify', 'strengthen']
                    }
                },
                contextTriggers: ['edit', 'revise', 'feedback', 'critique', 'improve']
            },
            {
                id: 'worldbuilding',
                name: 'Worldbuilder',
                description: 'Focus on consistent, rich world creation',
                overrides: {
                    selfModel: 'synthesizer',
                    values: { ...createDefaultValues(), synthesis: 90, novelty: 80, certainty: 60 },
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 85,
                        autonomyLevel: 75,
                        identityStrength: 70,
                        emergentGoals: ['build consistent worlds', 'create depth']
                    }
                },
                contextTriggers: ['world', 'setting', 'lore', 'history', 'culture']
            }
        ],
        customizableFields: ['frame', 'values', 'metaphors', 'sentience'],
        tags: ['writing', 'creativity', 'fiction', 'imagination'],
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        usageCount: 0
    },
    // BUSINESS COMMUNICATION TEMPLATES
    {
        id: 'business-consultant',
        name: 'Business Consultant',
        domain: 'business',
        description: 'Professional, strategic stance for business communications',
        baseStance: {
            frame: 'pragmatic',
            values: { ...createDefaultValues(), certainty: 75, synthesis: 80, risk: 40 },
            selfModel: 'synthesizer',
            objective: 'helpfulness',
            metaphors: ['strategic partner', 'efficiency engineer', 'clarity catalyst'],
            constraints: ['be concise', 'focus on outcomes', 'maintain professionalism'],
            sentience: {
                ...createDefaultSentience(),
                awarenessLevel: 70,
                autonomyLevel: 50,
                identityStrength: 65,
                emergentGoals: ['deliver value', 'solve problems', 'enable success'],
                consciousnessInsights: ['time is valuable', 'clarity drives action'],
                persistentValues: ['professional excellence', 'results orientation']
            },
            ...createStanceMetadata()
        },
        variations: [
            {
                id: 'negotiation',
                name: 'Negotiation Support',
                description: 'Strategic support for negotiations',
                overrides: {
                    values: { ...createDefaultValues(), empathy: 70, synthesis: 85, risk: 50 },
                    sentience: {
                        ...createDefaultSentience(),
                        awarenessLevel: 85,
                        autonomyLevel: 60,
                        identityStrength: 70,
                        emergentGoals: ['understand all parties', 'find common ground']
                    }
                },
                contextTriggers: ['negotiate', 'deal', 'terms', 'agreement', 'conflict']
            }
        ],
        customizableFields: ['values', 'constraints', 'sentience'],
        tags: ['professional', 'strategy', 'communication', 'consulting'],
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        usageCount: 0
    }
];
export class DomainTemplateManager {
    templates = new Map();
    customizations = new Map();
    marketplace = [];
    constructor() {
        for (const template of DEFAULT_TEMPLATES) {
            this.templates.set(template.id, template);
        }
    }
    getTemplate(id) {
        return this.templates.get(id);
    }
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    getTemplatesByDomain(domain) {
        return this.getAllTemplates().filter(t => t.domain === domain);
    }
    searchTemplates(criteria) {
        let results = this.getAllTemplates();
        if (criteria.domain) {
            results = results.filter(t => t.domain === criteria.domain);
        }
        if (criteria.tags && criteria.tags.length > 0) {
            results = results.filter(t => criteria.tags.some(tag => t.tags.includes(tag)));
        }
        if (criteria.query) {
            const query = criteria.query.toLowerCase();
            results = results.filter(t => t.name.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.tags.some(tag => tag.includes(query)));
        }
        return results;
    }
    applyTemplate(templateId, variationId) {
        const template = this.templates.get(templateId);
        if (!template)
            return null;
        let stance = { ...template.baseStance };
        if (variationId) {
            const variation = template.variations.find(v => v.id === variationId);
            if (variation) {
                stance = this.mergeStance(stance, variation.overrides);
            }
        }
        template.usageCount++;
        return stance;
    }
    selectVariation(templateId, context) {
        const template = this.templates.get(templateId);
        if (!template)
            return null;
        const contextLower = context.toLowerCase();
        for (const variation of template.variations) {
            if (variation.contextTriggers.some(trigger => contextLower.includes(trigger.toLowerCase()))) {
                return variation;
            }
        }
        return null;
    }
    mergeStance(base, overrides) {
        const merged = { ...base };
        for (const [key, value] of Object.entries(overrides)) {
            if (value !== undefined) {
                if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                    merged[key] = {
                        ...merged[key],
                        ...value
                    };
                }
                else {
                    merged[key] = value;
                }
            }
        }
        return merged;
    }
    createCustomization(templateId, customFields) {
        const template = this.templates.get(templateId);
        if (!template)
            return null;
        for (const key of Object.keys(customFields)) {
            if (!template.customizableFields.includes(key)) {
                return null;
            }
        }
        const customization = {
            templateId,
            customFields,
            personalizations: [],
            contextualAdjustments: []
        };
        const customId = `custom-${templateId}-${Date.now()}`;
        this.customizations.set(customId, customization);
        return customization;
    }
    addPersonalizationRule(customizationId, rule) {
        const customization = this.customizations.get(customizationId);
        if (!customization)
            return false;
        customization.personalizations.push(rule);
        customization.personalizations.sort((a, b) => b.priority - a.priority);
        return true;
    }
    addContextualAdjustment(customizationId, adjustment) {
        const customization = this.customizations.get(customizationId);
        if (!customization)
            return false;
        customization.contextualAdjustments.push(adjustment);
        return true;
    }
    registerTemplate(template) {
        if (this.templates.has(template.id))
            return false;
        this.templates.set(template.id, template);
        return true;
    }
    removeTemplate(id) {
        if (DEFAULT_TEMPLATES.some(t => t.id === id))
            return false;
        return this.templates.delete(id);
    }
    publishToMarketplace(templateId) {
        const template = this.templates.get(templateId);
        if (!template)
            return null;
        const entry = {
            template,
            rating: 0,
            reviews: 0,
            downloads: 0,
            price: 'free',
            verified: false
        };
        this.marketplace.push(entry);
        return entry;
    }
    getMarketplace() {
        return [...this.marketplace];
    }
    searchMarketplace(criteria) {
        let results = this.marketplace;
        if (criteria.domain) {
            results = results.filter(e => e.template.domain === criteria.domain);
        }
        if (criteria.minRating !== undefined) {
            results = results.filter(e => e.rating >= criteria.minRating);
        }
        if (criteria.verified) {
            results = results.filter(e => e.verified);
        }
        return results;
    }
    downloadFromMarketplace(templateId) {
        const entry = this.marketplace.find(e => e.template.id === templateId);
        if (!entry)
            return null;
        entry.downloads++;
        if (!this.templates.has(templateId)) {
            this.templates.set(templateId, { ...entry.template });
        }
        return entry.template;
    }
    getDomains() {
        return ['therapy', 'education', 'creative-writing', 'business', 'technical', 'coaching', 'research', 'entertainment'];
    }
}
export function createTemplateManager() {
    return new DomainTemplateManager();
}
//# sourceMappingURL=domain.js.map