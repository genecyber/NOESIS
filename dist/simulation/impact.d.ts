/**
 * Stance Impact Simulation
 *
 * Preview and simulate stance changes before applying them,
 * with coherence impact scoring and rollback scenarios.
 */
import type { Stance } from '../types/index.js';
export interface SimulationResult {
    id: string;
    originalStance: Stance;
    proposedChanges: Partial<Stance>;
    resultingStance: Stance;
    coherenceImpact: CoherenceImpact;
    sideEffects: SideEffect[];
    rollbackScenarios: RollbackScenario[];
    confidence: ConfidenceInterval;
    recommendation: 'apply' | 'review' | 'reject';
    timestamp: Date;
}
export interface CoherenceImpact {
    before: number;
    after: number;
    delta: number;
    breakingChanges: BreakingChange[];
    riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}
export interface BreakingChange {
    field: keyof Stance;
    description: string;
    severity: 'warning' | 'error';
    mitigation?: string;
}
export interface SideEffect {
    type: SideEffectType;
    description: string;
    probability: number;
    impact: 'positive' | 'neutral' | 'negative';
    affectedAreas: string[];
}
export type SideEffectType = 'behavior-shift' | 'value-conflict' | 'capability-change' | 'consistency-risk' | 'identity-drift' | 'goal-alignment';
export interface RollbackScenario {
    name: string;
    trigger: string;
    steps: RollbackStep[];
    estimatedRecoveryTime: number;
}
export interface RollbackStep {
    order: number;
    action: string;
    params: Record<string, unknown>;
}
export interface ConfidenceInterval {
    lower: number;
    upper: number;
    mean: number;
    methodology: string;
}
export interface ABComparison {
    id: string;
    stanceA: Stance;
    stanceB: Stance;
    scenarios: ComparisonScenario[];
    winner: 'A' | 'B' | 'tie';
    summary: string;
}
export interface ComparisonScenario {
    name: string;
    context: string;
    scoreA: number;
    scoreB: number;
    winner: 'A' | 'B' | 'tie';
    reasoning: string;
}
export declare class StanceSimulator {
    private simulations;
    private comparisons;
    simulate(currentStance: Stance, proposedChanges: Partial<Stance>): SimulationResult;
    private applyChanges;
    private calculateCoherence;
    private detectBreakingChanges;
    private assessRiskLevel;
    private predictSideEffects;
    private generateRollbackScenarios;
    private calculateConfidence;
    private generateRecommendation;
    compareStances(stanceA: Stance, stanceB: Stance): ABComparison;
    private generateComparisonScenarios;
    private evaluateScenario;
    private generateComparisonSummary;
    getSimulation(id: string): SimulationResult | undefined;
    getComparison(id: string): ABComparison | undefined;
    getAllSimulations(): SimulationResult[];
    clearHistory(): void;
}
export declare function createSimulator(): StanceSimulator;
//# sourceMappingURL=impact.d.ts.map