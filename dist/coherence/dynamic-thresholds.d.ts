/**
 * Dynamic Coherence Thresholds (Ralph Iteration 11, Feature 3)
 *
 * Context-adaptive coherence floors, conversation phase detection,
 * automatic threshold adjustment, risk-aware bounds, and recovery strategies.
 */
import type { Stance } from '../types/index.js';
export interface ThresholdConfig {
    enableDynamicThresholds: boolean;
    baseCoherenceFloor: number;
    minCoherenceFloor: number;
    maxCoherenceFloor: number;
    adaptationRate: number;
    riskSensitivity: number;
    recoveryAggressiveness: number;
}
export interface ConversationPhase {
    id: string;
    name: string;
    description: string;
    indicators: PhaseIndicator[];
    suggestedThreshold: number;
    durationEstimate: number;
}
export type PhaseType = 'opening' | 'exploration' | 'deepening' | 'challenging' | 'synthesis' | 'closing' | 'crisis' | 'recovery';
export interface PhaseIndicator {
    type: 'keyword' | 'sentiment' | 'drift' | 'operator' | 'frame';
    pattern: string | number;
    weight: number;
}
export interface ThresholdState {
    currentThreshold: number;
    baseThreshold: number;
    phase: PhaseType;
    phaseConfidence: number;
    adjustmentReason: string;
    riskLevel: RiskLevel;
    recoveryMode: boolean;
    history: ThresholdAdjustment[];
}
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export interface ThresholdAdjustment {
    timestamp: Date;
    previousThreshold: number;
    newThreshold: number;
    reason: string;
    phase: PhaseType;
    triggerEvent: string;
}
export interface CoherenceContext {
    stance: Stance;
    recentDrift: number[];
    operatorHistory: string[];
    messageCount: number;
    sessionDuration: number;
    userIntent?: string;
}
export interface RiskAssessment {
    level: RiskLevel;
    factors: RiskFactor[];
    recommendation: string;
    suggestedAction: 'maintain' | 'tighten' | 'relax' | 'recover';
}
export interface RiskFactor {
    name: string;
    severity: number;
    description: string;
}
export interface RecoveryStrategy {
    id: string;
    name: string;
    applicablePhases: PhaseType[];
    steps: RecoveryStep[];
    successCriteria: SuccessCriteria;
}
export interface RecoveryStep {
    order: number;
    action: string;
    thresholdAdjustment: number;
    description: string;
}
export interface SuccessCriteria {
    minCoherence: number;
    maxDrift: number;
    minTurns: number;
}
export interface ThresholdStats {
    adjustmentCount: number;
    averageThreshold: number;
    timeInRecovery: number;
    phaseDistribution: Record<PhaseType, number>;
    riskEvents: number;
}
export declare class DynamicThresholdManager {
    private config;
    private state;
    private phases;
    private recoveryStrategies;
    private stats;
    constructor(config?: Partial<ThresholdConfig>);
    /**
     * Initialize conversation phases
     */
    private initializePhases;
    /**
     * Initialize recovery strategies
     */
    private initializeRecoveryStrategies;
    /**
     * Update threshold based on context
     */
    updateThreshold(context: CoherenceContext): ThresholdState;
    /**
     * Detect conversation phase
     */
    private detectPhase;
    /**
     * Assess risk level
     */
    assessRisk(context: CoherenceContext): RiskAssessment;
    /**
     * Generate risk recommendation
     */
    private generateRecommendation;
    /**
     * Calculate new threshold
     */
    private calculateThreshold;
    /**
     * Record threshold adjustment
     */
    private recordAdjustment;
    /**
     * Get current threshold
     */
    getCurrentThreshold(): number;
    /**
     * Get current state
     */
    getState(): ThresholdState;
    /**
     * Get recovery strategy
     */
    getRecoveryStrategy(): RecoveryStrategy | null;
    /**
     * Check if coherence is below threshold
     */
    isCoherenceCritical(stance: Stance): boolean;
    /**
     * Get adjustment history
     */
    getHistory(limit?: number): ThresholdAdjustment[];
    /**
     * Get statistics
     */
    getStats(): ThresholdStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const dynamicThresholds: DynamicThresholdManager;
//# sourceMappingURL=dynamic-thresholds.d.ts.map