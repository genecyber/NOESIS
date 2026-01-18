/**
 * Predictive Stance Decay Modeling
 *
 * Time-based decay curves, environmental factors, usage patterns,
 * prevention recommendations, and automatic refresh scheduling.
 */
import type { Stance } from '../types/index.js';
export interface DecayModel {
    id: string;
    stanceId: string;
    curves: DecayCurve[];
    factors: EnvironmentalFactor[];
    usagePattern: UsagePattern;
    predictions: DecayPrediction[];
    recommendations: DecayRecommendation[];
    refreshSchedule?: RefreshSchedule;
    createdAt: Date;
    updatedAt: Date;
}
export interface DecayCurve {
    field: string;
    curveType: CurveType;
    halfLife: number;
    baseline: number;
    currentValue: number;
    decayRate: number;
    projectedValues: ProjectedValue[];
}
export type CurveType = 'exponential' | 'linear' | 'logarithmic' | 'step' | 'plateau' | 'oscillating';
export interface ProjectedValue {
    timestamp: Date;
    value: number;
    confidence: number;
}
export interface EnvironmentalFactor {
    name: string;
    type: FactorType;
    impact: number;
    weight: number;
    currentState: unknown;
}
export type FactorType = 'temporal' | 'usage' | 'context' | 'social' | 'content' | 'system';
export interface UsagePattern {
    averageSessionsPerDay: number;
    averageSessionDuration: number;
    lastActive: Date;
    activityHours: number[];
    frequencyTrend: 'increasing' | 'stable' | 'decreasing';
    engagementScore: number;
}
export interface DecayPrediction {
    field: string;
    currentValue: number;
    predictedValue: number;
    timeToThreshold: number;
    threshold: number;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface DecayRecommendation {
    id: string;
    type: RecommendationType;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    field: string;
    action: string;
    expectedImprovement: number;
    reasoning: string;
}
export type RecommendationType = 'refresh-value' | 'increase-usage' | 'environmental-change' | 'schedule-refresh' | 'reinforce-baseline';
export interface RefreshSchedule {
    enabled: boolean;
    interval: number;
    nextRefresh: Date;
    autoRefreshFields: string[];
    refreshHistory: RefreshEvent[];
}
export interface RefreshEvent {
    timestamp: Date;
    field: string;
    previousValue: number;
    newValue: number;
    trigger: 'scheduled' | 'manual' | 'threshold';
}
export interface DecayAnalysis {
    overallHealth: number;
    decayRate: number;
    stableFields: string[];
    decayingFields: string[];
    criticalFields: string[];
    daysUntilAction: number;
}
export interface HistoricalDecay {
    field: string;
    dataPoints: Array<{
        timestamp: Date;
        value: number;
    }>;
    fittedCurve: CurveType;
    r2Score: number;
}
export interface StanceSnapshot {
    stance: Stance;
    timestamp: Date;
}
export declare class DecayModelingEngine {
    private models;
    private stanceHistory;
    private decayThreshold;
    createModel(stanceId: string, stance: Stance): DecayModel;
    private initializeCurves;
    private calculateDecayRate;
    private projectValues;
    private calculateDecayedValue;
    private initializeFactors;
    private initializeUsagePattern;
    updateStance(modelId: string, stance: Stance): void;
    private getFieldValue;
    private generatePredictions;
    private generateRecommendations;
    setupRefreshSchedule(modelId: string, intervalHours: number, fields?: string[]): RefreshSchedule;
    executeRefresh(modelId: string, field: string, newValue: number, trigger?: RefreshEvent['trigger']): boolean;
    analyzeDecay(modelId: string): DecayAnalysis;
    analyzeHistoricalDecay(modelId: string, field: string): HistoricalDecay | null;
    getModel(modelId: string): DecayModel | undefined;
    getHistory(modelId: string): StanceSnapshot[];
    setDecayThreshold(threshold: number): void;
    updateEnvironmentalFactor(modelId: string, factorName: string, state: unknown): void;
}
export declare function createDecayModelingEngine(): DecayModelingEngine;
//# sourceMappingURL=modeling.d.ts.map