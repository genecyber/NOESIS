/**
 * AI-Assisted Stance Optimization
 *
 * Machine learning-based stance recommendations with
 * performance analysis and automated coherence tuning.
 */
import type { Stance, Frame } from '../types/index.js';
export interface OptimizationSuggestion {
    id: string;
    type: SuggestionType;
    field: keyof Stance;
    currentValue: unknown;
    suggestedValue: unknown;
    confidence: number;
    rationale: string;
    expectedImprovement: number;
    riskLevel: 'low' | 'medium' | 'high';
}
export type SuggestionType = 'coherence-improvement' | 'performance-optimization' | 'user-alignment' | 'drift-correction' | 'efficiency-gain';
export interface PerformancePattern {
    id: string;
    pattern: PatternDefinition;
    occurrences: number;
    averageOutcome: number;
    confidence: number;
    lastSeen: Date;
}
export interface PatternDefinition {
    conditions: PatternCondition[];
    outcome: 'positive' | 'negative' | 'neutral';
    description: string;
}
export interface PatternCondition {
    field: keyof Stance | 'context';
    operator: 'equals' | 'greater' | 'less' | 'contains' | 'range';
    value: unknown;
}
export interface UserBehaviorModel {
    preferredFrames: FramePreference[];
    responsePatterns: ResponsePattern[];
    satisfactionIndicators: SatisfactionIndicator[];
    engagementMetrics: EngagementMetrics;
}
export interface FramePreference {
    frame: Frame;
    usageCount: number;
    satisfactionScore: number;
    contextTriggers: string[];
}
export interface ResponsePattern {
    trigger: string;
    preferredResponse: 'detailed' | 'concise' | 'exploratory' | 'directive';
    frequency: number;
}
export interface SatisfactionIndicator {
    indicator: string;
    weight: number;
    positive: boolean;
}
export interface EngagementMetrics {
    averageSessionLength: number;
    turnsPerSession: number;
    returnRate: number;
    featureUsage: Record<string, number>;
}
export interface OptimalPath {
    steps: OptimizationStep[];
    totalExpectedImprovement: number;
    estimatedTurns: number;
    riskAssessment: string;
}
export interface OptimizationStep {
    order: number;
    suggestion: OptimizationSuggestion;
    prerequisite?: string;
    rollbackPlan: string;
}
export interface ABTestResult {
    id: string;
    stanceA: Partial<Stance>;
    stanceB: Partial<Stance>;
    metrics: ABMetrics;
    winner: 'A' | 'B' | 'inconclusive';
    startedAt: Date;
    completedAt?: Date;
    sampleSize: number;
}
export interface ABMetrics {
    coherenceA: number;
    coherenceB: number;
    satisfactionA: number;
    satisfactionB: number;
    engagementA: number;
    engagementB: number;
    statisticalSignificance: number;
}
export interface CoherenceTuning {
    originalCoherence: number;
    targetCoherence: number;
    adjustments: CoherenceAdjustment[];
    achievedCoherence: number;
}
export interface CoherenceAdjustment {
    field: keyof Stance;
    adjustment: number | string;
    impact: number;
}
export declare class AIStanceOptimizer {
    private patterns;
    private userModel;
    private abTests;
    private suggestionHistory;
    constructor();
    private createDefaultUserModel;
    private initializePatterns;
    analyzeSuggestions(stance: Stance, context?: string): OptimizationSuggestion[];
    private analyzeCoherence;
    private analyzePatterns;
    private matchesPattern;
    private getPatternPrimaryField;
    private getCurrentValue;
    private getSuggestedAlternative;
    private analyzeUserAlignment;
    private analyzeContext;
    recordOutcome(stance: Stance, outcome: number, context?: string): void;
    generateOptimalPath(currentStance: Stance, targetCoherence?: number): OptimalPath;
    startABTest(stanceA: Partial<Stance>, stanceB: Partial<Stance>): ABTestResult;
    recordABTestSample(testId: string, variant: 'A' | 'B', metrics: {
        coherence: number;
        satisfaction: number;
        engagement: number;
    }): void;
    private runningAverage;
    completeABTest(testId: string): ABTestResult | null;
    tuneCoherence(stance: Stance, targetCoherence: number): CoherenceTuning;
    private estimateCoherence;
    getSuggestionHistory(): OptimizationSuggestion[];
    getUserModel(): UserBehaviorModel;
    getABTest(testId: string): ABTestResult | undefined;
    getAllABTests(): ABTestResult[];
}
export declare function createAIOptimizer(): AIStanceOptimizer;
//# sourceMappingURL=ai-assisted.d.ts.map