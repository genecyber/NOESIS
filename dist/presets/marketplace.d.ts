/**
 * Personality Marketplace & Presets - Ralph Iteration 6 Feature 6
 *
 * Create, share, and discover personality configurations:
 * - Preset creation with operator combinations, stance settings, mode configs
 * - Marketplace browsing with search and filtering
 * - Rating and review system
 * - Import/export for sharing
 * - Version control for presets
 */
import { EventEmitter } from 'events';
import type { Frame } from '../types/index.js';
export type PresetMode = 'adaptive' | 'analytical' | 'exploratory' | 'supportive' | 'dialectical';
export interface PresetStanceConfig {
    baseStance: Frame;
    stanceModifiers?: Record<string, number>;
    autoAdjust?: boolean;
}
export interface PresetModeConfig {
    defaultMode: PresetMode;
    modeTransitions?: Array<{
        from: PresetMode;
        to: PresetMode;
        trigger: string;
    }>;
}
export interface PresetOperatorConfig {
    operatorName: string;
    priority: number;
    conditions?: string[];
    parameters?: Record<string, unknown>;
}
export interface PersonalityPreset {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    stanceConfig: PresetStanceConfig;
    modeConfig: PresetModeConfig;
    operators: PresetOperatorConfig[];
    creativityLevel: number;
    formality: number;
    verbosity: number;
    emotionalExpression: number;
    systemPromptAdditions?: string;
    responseStyleGuide?: string;
    isPublic: boolean;
    downloads: number;
    rating: number;
    ratingCount: number;
}
export interface PresetReview {
    id: string;
    presetId: string;
    userId: string;
    rating: number;
    comment: string;
    createdAt: Date;
    helpful: number;
}
export interface PresetVersion {
    version: string;
    changes: string;
    preset: PersonalityPreset;
    createdAt: Date;
}
export interface MarketplaceCategory {
    id: string;
    name: string;
    description: string;
    presetCount: number;
}
export interface SearchFilters {
    category?: string;
    tags?: string[];
    minRating?: number;
    author?: string;
    sortBy?: 'downloads' | 'rating' | 'newest' | 'name';
    sortOrder?: 'asc' | 'desc';
}
export interface PresetBundle {
    id: string;
    name: string;
    description: string;
    presets: string[];
    author: string;
    price?: number;
}
export declare const PRESET_TEMPLATES: Record<string, Partial<PersonalityPreset>>;
export declare class PersonalityMarketplace extends EventEmitter {
    private presets;
    private reviews;
    private versions;
    private categories;
    private bundles;
    private userPresets;
    private installedPresets;
    constructor();
    private initializeDefaultCategories;
    private initializeBuiltInPresets;
    private createPresetFromTemplate;
    createPreset(config: {
        name: string;
        description: string;
        author: string;
        stanceConfig: PresetStanceConfig;
        modeConfig: PresetModeConfig;
        operators?: PresetOperatorConfig[];
        creativityLevel?: number;
        formality?: number;
        verbosity?: number;
        emotionalExpression?: number;
        tags?: string[];
        isPublic?: boolean;
        systemPromptAdditions?: string;
        responseStyleGuide?: string;
    }): PersonalityPreset;
    updatePreset(presetId: string, updates: Partial<PersonalityPreset>, changeLog?: string): PersonalityPreset | null;
    private incrementVersion;
    deletePreset(presetId: string, userId: string): boolean;
    getPreset(presetId: string): PersonalityPreset | undefined;
    searchPresets(query: string, filters?: SearchFilters): PersonalityPreset[];
    getFeaturedPresets(limit?: number): PersonalityPreset[];
    getPresetsByCategory(categoryId: string): PersonalityPreset[];
    getSimilarPresets(presetId: string, limit?: number): PersonalityPreset[];
    private calculateSimilarity;
    installPreset(presetId: string): PersonalityPreset | null;
    uninstallPreset(presetId: string): boolean;
    getInstalledPresets(): PersonalityPreset[];
    applyPreset(presetId: string): {
        success: boolean;
        operators?: PresetOperatorConfig[];
        stanceConfig?: PresetStanceConfig;
        modeConfig?: PresetModeConfig;
        error?: string;
    };
    addReview(presetId: string, userId: string, rating: number, comment: string): PresetReview | null;
    getReviews(presetId: string): PresetReview[];
    markReviewHelpful(reviewId: string, presetId: string): boolean;
    exportPreset(presetId: string): string | null;
    importPreset(jsonData: string, newAuthor: string): PersonalityPreset | null;
    exportBundle(bundleId: string): string | null;
    createBundle(config: {
        name: string;
        description: string;
        presetIds: string[];
        author: string;
        price?: number;
    }): PresetBundle;
    getBundle(bundleId: string): PresetBundle | undefined;
    listBundles(): PresetBundle[];
    getPresetVersions(presetId: string): PresetVersion[];
    revertToVersion(presetId: string, version: string): PersonalityPreset | null;
    getMarketplaceStats(): {
        totalPresets: number;
        publicPresets: number;
        totalDownloads: number;
        averageRating: number;
        topCategories: Array<{
            category: string;
            count: number;
        }>;
    };
    getUserStats(userId: string): {
        presetsCreated: number;
        totalDownloads: number;
        averageRating: number;
        presetsInstalled: number;
    };
}
export declare const personalityMarketplace: PersonalityMarketplace;
//# sourceMappingURL=marketplace.d.ts.map