/**
 * Domain-Specific Stance Templates
 *
 * Pre-built stance configurations for specific domains like therapy,
 * education, creative writing, and business communication.
 */
import type { Stance } from '../types/index.js';
export interface DomainTemplate {
    id: string;
    name: string;
    domain: TemplateDomain;
    description: string;
    baseStance: Stance;
    variations: TemplateVariation[];
    customizableFields: (keyof Stance)[];
    tags: string[];
    author?: string;
    version: string;
    createdAt: Date;
    usageCount: number;
}
export type TemplateDomain = 'therapy' | 'education' | 'creative-writing' | 'business' | 'technical' | 'coaching' | 'research' | 'entertainment';
export interface TemplateVariation {
    id: string;
    name: string;
    description: string;
    overrides: Partial<Stance>;
    contextTriggers: string[];
}
export interface TemplateCustomization {
    templateId: string;
    customFields: Partial<Stance>;
    personalizations: PersonalizationRule[];
    contextualAdjustments: ContextualAdjustment[];
}
export interface PersonalizationRule {
    condition: string;
    adjustment: Partial<Stance>;
    priority: number;
}
export interface ContextualAdjustment {
    trigger: 'keyword' | 'sentiment' | 'time' | 'history';
    pattern: string;
    adjustment: Partial<Stance>;
}
export interface MarketplaceEntry {
    template: DomainTemplate;
    rating: number;
    reviews: number;
    downloads: number;
    price: 'free' | number;
    verified: boolean;
}
export interface TemplateSearchCriteria {
    domain?: TemplateDomain;
    tags?: string[];
    query?: string;
    minRating?: number;
    verified?: boolean;
}
export declare class DomainTemplateManager {
    private templates;
    private customizations;
    private marketplace;
    constructor();
    getTemplate(id: string): DomainTemplate | undefined;
    getAllTemplates(): DomainTemplate[];
    getTemplatesByDomain(domain: TemplateDomain): DomainTemplate[];
    searchTemplates(criteria: TemplateSearchCriteria): DomainTemplate[];
    applyTemplate(templateId: string, variationId?: string): Stance | null;
    selectVariation(templateId: string, context: string): TemplateVariation | null;
    private mergeStance;
    createCustomization(templateId: string, customFields: Partial<Stance>): TemplateCustomization | null;
    addPersonalizationRule(customizationId: string, rule: PersonalizationRule): boolean;
    addContextualAdjustment(customizationId: string, adjustment: ContextualAdjustment): boolean;
    registerTemplate(template: DomainTemplate): boolean;
    removeTemplate(id: string): boolean;
    publishToMarketplace(templateId: string): MarketplaceEntry | null;
    getMarketplace(): MarketplaceEntry[];
    searchMarketplace(criteria: TemplateSearchCriteria & {
        minRating?: number;
    }): MarketplaceEntry[];
    downloadFromMarketplace(templateId: string): DomainTemplate | null;
    getDomains(): TemplateDomain[];
}
export declare function createTemplateManager(): DomainTemplateManager;
//# sourceMappingURL=domain.d.ts.map