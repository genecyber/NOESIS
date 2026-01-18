/**
 * A/B Testing Framework for Operators (Ralph Iteration 9, Feature 3)
 *
 * Operator effectiveness comparison, statistical significance testing,
 * automated experiment scheduling, and result visualization.
 */
import type { Stance } from '../types/index.js';
export interface ABConfig {
    minSampleSize: number;
    confidenceLevel: number;
    maxDuration: number;
    autoStop: boolean;
    trackMetrics: string[];
}
export interface Experiment {
    id: string;
    name: string;
    description: string;
    hypothesis: string;
    variants: Variant[];
    status: ExperimentStatus;
    startTime: Date;
    endTime: Date | null;
    targetMetric: string;
    secondaryMetrics: string[];
    results: ExperimentResults | null;
}
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export interface Variant {
    id: string;
    name: string;
    description: string;
    operatorConfig: OperatorConfig;
    weight: number;
    samples: Sample[];
}
export interface OperatorConfig {
    operatorName: string;
    parameters: Record<string, unknown>;
    sequence?: string[];
}
export interface Sample {
    id: string;
    timestamp: Date;
    variantId: string;
    stanceBefore: Stance;
    stanceAfter: Stance;
    metrics: Record<string, number>;
    userFeedback?: UserFeedback;
}
export interface UserFeedback {
    satisfaction: number;
    comments: string;
    preferred: boolean;
}
export interface ExperimentResults {
    winner: string | null;
    confidence: number;
    statisticallySignificant: boolean;
    pValue: number;
    effectSize: number;
    variantStats: Map<string, VariantStats>;
    recommendation: string;
}
export interface VariantStats {
    variantId: string;
    sampleSize: number;
    mean: number;
    standardDeviation: number;
    confidenceInterval: {
        lower: number;
        upper: number;
    };
    conversionRate?: number;
}
export interface SuccessMetric {
    name: string;
    type: 'continuous' | 'binary' | 'count';
    direction: 'higher' | 'lower';
    calculator: (before: Stance, after: Stance) => number;
}
export interface ScheduledExperiment {
    experimentId: string;
    scheduledStart: Date;
    duration: number;
    recurrence?: 'daily' | 'weekly' | 'monthly';
}
export interface ABStats {
    totalExperiments: number;
    completedExperiments: number;
    significantResults: number;
    averageSampleSize: number;
    topOperators: string[];
}
export declare class ABTestingManager {
    private config;
    private experiments;
    private metrics;
    private schedule;
    private stats;
    constructor(config?: Partial<ABConfig>);
    /**
     * Register default success metrics
     */
    private registerDefaultMetrics;
    /**
     * Create a new experiment
     */
    createExperiment(name: string, description: string, hypothesis: string, targetMetric: string): Experiment;
    /**
     * Add a variant to an experiment
     */
    addVariant(experimentId: string, name: string, operatorConfig: OperatorConfig, weight?: number): Variant | null;
    /**
     * Start an experiment
     */
    startExperiment(experimentId: string): boolean;
    /**
     * Record a sample for an experiment
     */
    recordSample(experimentId: string, variantId: string, stanceBefore: Stance, stanceAfter: Stance, userFeedback?: UserFeedback): Sample | null;
    /**
     * Assign a variant for a new user/session
     */
    assignVariant(experimentId: string): Variant | null;
    /**
     * Check if experiment should auto-stop
     */
    private checkAutoStop;
    /**
     * Analyze experiment results
     */
    analyzeResults(experimentId: string): ExperimentResults | null;
    /**
     * Generate recommendation based on results
     */
    private generateRecommendation;
    /**
     * Complete an experiment
     */
    completeExperiment(experimentId: string): ExperimentResults | null;
    /**
     * Pause an experiment
     */
    pauseExperiment(experimentId: string): boolean;
    /**
     * Resume an experiment
     */
    resumeExperiment(experimentId: string): boolean;
    /**
     * Cancel an experiment
     */
    cancelExperiment(experimentId: string): boolean;
    /**
     * Schedule an experiment
     */
    scheduleExperiment(experimentId: string, scheduledStart: Date, duration: number, recurrence?: 'daily' | 'weekly' | 'monthly'): ScheduledExperiment;
    /**
     * Register a custom success metric
     */
    registerMetric(metric: SuccessMetric): void;
    /**
     * Generate results visualization
     */
    generateVisualization(experimentId: string): Record<string, unknown> | null;
    /**
     * Generate comparison chart data
     */
    private generateComparisonChart;
    /**
     * Generate timeline chart data
     */
    private generateTimelineChart;
    /**
     * Find best operator combinations
     */
    findBestCombinations(topN?: number): Array<{
        operators: string[];
        effectSize: number;
        confidence: number;
    }>;
    /**
     * Get experiment by ID
     */
    getExperiment(experimentId: string): Experiment | null;
    /**
     * List all experiments
     */
    listExperiments(status?: ExperimentStatus): Experiment[];
    /**
     * Get statistics
     */
    getStats(): ABStats;
    /**
     * Export experiment data
     */
    exportExperiment(experimentId: string): Record<string, unknown> | null;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const abTesting: ABTestingManager;
//# sourceMappingURL=ab-framework.d.ts.map