/**
 * Stance-Based Recommendation System
 *
 * Intelligent recommendations for stances, frames, values, and templates
 * based on user history, collaborative filtering, and contextual analysis.
 */
import type { Stance, Frame, SelfModel, Values } from '../types/index.js';
export interface RecommendationConfig {
    maxRecommendations: number;
    diversityWeight: number;
    recencyWeight: number;
    collaborativeWeight: number;
    contentWeight: number;
    contextualWeight: number;
    minConfidence: number;
}
export interface Recommendation {
    id: string;
    type: RecommendationType;
    target: RecommendationTarget;
    confidence: number;
    reasoning: string[];
    relevanceScore: number;
    noveltyScore: number;
    diversityScore: number;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
export type RecommendationType = 'frame' | 'value-adjustment' | 'template' | 'self-model' | 'exploration' | 'refinement' | 'complementary';
export interface RecommendationTarget {
    frame?: Frame;
    values?: Partial<Values>;
    selfModel?: SelfModel;
    templateId?: string;
    templateName?: string;
    description?: string;
}
export interface UserProfile {
    userId: string;
    stanceHistory: StanceHistoryEntry[];
    preferences: UserPreferences;
    interactionPatterns: InteractionPattern[];
    affinities: AffinityScore[];
}
export interface StanceHistoryEntry {
    stance: Stance;
    timestamp: Date;
    duration: number;
    satisfaction?: number;
    context?: string;
}
export interface UserPreferences {
    preferredFrames: Frame[];
    avoidedFrames: Frame[];
    valueRanges: Partial<Record<keyof Values, {
        min: number;
        max: number;
    }>>;
    complexityPreference: 'simple' | 'moderate' | 'complex';
    explorationTendency: number;
}
export interface InteractionPattern {
    pattern: string;
    frequency: number;
    lastOccurrence: Date;
    associatedFrames: Frame[];
}
export interface AffinityScore {
    item: string;
    itemType: 'frame' | 'template' | 'value' | 'self-model';
    score: number;
    interactions: number;
}
export interface RecommendationResult {
    recommendations: Recommendation[];
    diversityIndex: number;
    coverageScore: number;
    generationTime: number;
}
export interface SimilarityScore {
    itemId: string;
    score: number;
    commonFeatures: string[];
}
export interface ContextualFactors {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    sessionDuration: number;
    recentActivity: 'exploring' | 'refining' | 'creating' | 'reviewing';
    emotionalState?: string;
    taskContext?: string;
}
export declare class RecommendationEngine {
    private config;
    private userProfiles;
    private templateDatabase;
    private recommendationHistory;
    constructor(config?: Partial<RecommendationConfig>);
    generateRecommendations(currentStance: Stance, userProfile: UserProfile, context?: ContextualFactors): RecommendationResult;
    private generateContentBasedRecommendations;
    private generateCollaborativeRecommendations;
    private generateContextualRecommendations;
    private generateExplorationRecommendations;
    private findComplementaryFrame;
    private scoreAndRank;
    private applyDiversityFilter;
    private calculateNovelty;
    private calculateAverageValues;
    private suggestValueAdjustments;
    private calculateDiversityIndex;
    private calculateCoverageScore;
    registerTemplate(id: string, stance: Stance): void;
    updateUserProfile(profile: UserProfile): void;
    recordInteraction(userId: string, item: string, itemType: 'frame' | 'template' | 'value' | 'self-model', positive: boolean): void;
    getConfig(): RecommendationConfig;
    setConfig(config: Partial<RecommendationConfig>): void;
    getRecommendationHistory(): Recommendation[];
    clearHistory(): void;
}
export declare function createRecommendationEngine(config?: Partial<RecommendationConfig>): RecommendationEngine;
//# sourceMappingURL=engine.d.ts.map