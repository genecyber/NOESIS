/**
 * Monte Carlo Stance Simulation
 *
 * Trajectory prediction via random sampling with multi-path
 * exploration, risk assessment, and confidence intervals.
 */
import type { Stance, Frame, SelfModel, Objective, Values } from '../types/index.js';
export interface SimulationConfig {
    iterations: number;
    timeSteps: number;
    volatility: number;
    confidenceLevel: number;
    seed?: number;
}
export interface SimulationResult {
    trajectories: StanceTrajectory[];
    statistics: TrajectoryStatistics;
    riskAssessment: RiskAssessment;
    confidenceIntervals: ConfidenceIntervals;
    scenarios: ScenarioComparison[];
}
export interface StanceTrajectory {
    id: string;
    steps: StanceSnapshot[];
    totalDrift: number;
    coherenceHistory: number[];
    probability: number;
}
export interface StanceSnapshot {
    step: number;
    stance: Stance;
    coherence: number;
    drift: number;
    changedFields: string[];
}
export interface TrajectoryStatistics {
    meanDrift: number;
    stdDevDrift: number;
    meanCoherence: number;
    stdDevCoherence: number;
    modeFrame: Frame;
    modeSelfModel: SelfModel;
    modeObjective: Objective;
    valueDistributions: Record<keyof Values, ValueDistribution>;
}
export interface ValueDistribution {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    percentiles: Record<string, number>;
}
export interface RiskAssessment {
    coherenceRisk: RiskLevel;
    driftRisk: RiskLevel;
    instabilityRisk: RiskLevel;
    overallRisk: RiskLevel;
    recommendations: string[];
}
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export interface ConfidenceIntervals {
    coherence: Interval;
    drift: Interval;
    values: Record<keyof Values, Interval>;
}
export interface Interval {
    lower: number;
    upper: number;
    mean: number;
    confidence: number;
}
export interface ScenarioComparison {
    name: string;
    description: string;
    probability: number;
    outcome: StanceSnapshot;
    rank: number;
}
export interface SensitivityResult {
    parameter: string;
    sensitivity: number;
    impactRange: [number, number];
    criticalThreshold?: number;
}
export declare class MonteCarloSimulator {
    private config;
    private rng;
    constructor(config?: Partial<SimulationConfig>);
    private createSeededRng;
    simulate(initialStance: Stance): SimulationResult;
    private runSimulations;
    private runSingleSimulation;
    private evolveStance;
    private calculateCoherence;
    private calculateStatistics;
    private calculateValueDistributions;
    private assessRisk;
    private calculateConfidenceIntervals;
    private generateScenarios;
    runSensitivityAnalysis(initialStance: Stance): SensitivityResult[];
    private mean;
    private stdDev;
    private percentile;
    private mode;
    updateConfig(config: Partial<SimulationConfig>): void;
    getConfig(): SimulationConfig;
}
export declare function createMonteCarloSimulator(config?: Partial<SimulationConfig>): MonteCarloSimulator;
//# sourceMappingURL=montecarlo.d.ts.map