/**
 * Stance Archetype Library (Ralph Iteration 11, Feature 5)
 *
 * Historical figure stance mappings, cultural archetype database,
 * philosophical tradition templates, literary character personas,
 * archetype blending and fusion, context-appropriate archetype selection.
 */
import type { Stance, Frame } from '../types/index.js';
export interface ArchetypeConfig {
    enableArchetypes: boolean;
    allowBlending: boolean;
    maxBlendCount: number;
    contextSensitivity: number;
    authenticity: number;
}
export interface Archetype {
    id: string;
    name: string;
    category: ArchetypeCategory;
    description: string;
    stanceTemplate: StanceTemplate;
    traits: ArchetypeTrait[];
    origins: ArchetypeOrigin[];
    keywords: string[];
    compatibility: ArchetypeCompatibility;
}
export type ArchetypeCategory = 'historical' | 'cultural' | 'philosophical' | 'literary' | 'mythological' | 'psychological';
export interface StanceTemplate {
    preferredFrame: Frame;
    alternateFrames: Frame[];
    values: Partial<Stance['values']>;
    selfModelBias: Stance['selfModel'][];
    objectiveBias: Stance['objective'][];
    sentienceProfile: SentienceProfile;
}
export interface SentienceProfile {
    awarenessRange: [number, number];
    autonomyRange: [number, number];
    identityStrength: number;
    typicalGoals: string[];
}
export interface ArchetypeTrait {
    name: string;
    strength: number;
    expression: string;
    valueInfluence: Partial<Record<keyof Stance['values'], number>>;
}
export interface ArchetypeOrigin {
    source: string;
    tradition: string;
    era: string;
    context: string;
}
export interface ArchetypeCompatibility {
    blendsWith: string[];
    conflictsWith: string[];
    enhances: string[];
    suppressedBy: string[];
}
export interface BlendedArchetype {
    id: string;
    name: string;
    sources: string[];
    blendRatios: Record<string, number>;
    resultingTemplate: StanceTemplate;
    coherenceScore: number;
    description: string;
}
export interface ArchetypeMatch {
    archetype: Archetype;
    matchScore: number;
    matchReasons: string[];
    suggestedAdaptations: string[];
}
export interface ContextQuery {
    topic?: string;
    mood?: string;
    intent?: string;
    currentFrame?: Frame;
    keywords?: string[];
}
export interface LibraryStats {
    totalArchetypes: number;
    byCategory: Record<ArchetypeCategory, number>;
    blendedCreated: number;
    mostUsed: string[];
    avgCompatibility: number;
}
export declare class ArchetypeLibraryManager {
    private config;
    private archetypes;
    private blends;
    private usageHistory;
    private stats;
    constructor(config?: Partial<ArchetypeConfig>);
    /**
     * Initialize the archetype library with default archetypes
     */
    private initializeLibrary;
    /**
     * Register an archetype
     */
    registerArchetype(archetype: Archetype): void;
    /**
     * Get archetype by ID
     */
    getArchetype(id: string): Archetype | null;
    /**
     * Find archetypes matching context
     */
    findMatchingArchetypes(query: ContextQuery, limit?: number): ArchetypeMatch[];
    /**
     * Calculate match score
     */
    private calculateMatchScore;
    /**
     * Suggest adaptations for archetype
     */
    private suggestAdaptations;
    /**
     * Blend archetypes
     */
    blendArchetypes(archetypeIds: string[], ratios?: Record<string, number>, customName?: string): BlendedArchetype | null;
    /**
     * Calculate blend coherence
     */
    private calculateBlendCoherence;
    /**
     * Blend stance templates
     */
    private blendTemplates;
    /**
     * Apply archetype to stance
     */
    applyArchetype(currentStance: Stance, archetypeId: string, intensity?: number): Stance;
    /**
     * Update most used statistics
     */
    private updateMostUsed;
    /**
     * Update stats
     */
    private updateStats;
    /**
     * List all archetypes
     */
    listArchetypes(category?: ArchetypeCategory): Archetype[];
    /**
     * Get blended archetype
     */
    getBlend(id: string): BlendedArchetype | null;
    /**
     * List all blends
     */
    listBlends(): BlendedArchetype[];
    /**
     * Get statistics
     */
    getStats(): LibraryStats;
}
export declare const archetypeLibrary: ArchetypeLibraryManager;
//# sourceMappingURL=library.d.ts.map