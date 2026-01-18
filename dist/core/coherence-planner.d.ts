/**
 * Coherence Planner - Ralph Iteration 3 Feature 2
 *
 * Prevents coherence degradation before it happens by:
 * 1. Predicting drift cost of operators
 * 2. Filtering operators whose predicted drift exceeds available budget
 * 3. Maintaining a coherence reserve buffer
 */
import { Stance, ModeConfig, PlannedOperation, OperatorName } from '../types/index.js';
/**
 * Predicted drift costs for each operator type
 * Based on typical stance changes they cause
 */
export declare const OPERATOR_DRIFT_COSTS: Record<OperatorName, number>;
/**
 * Calculate total predicted drift for a set of operators
 */
export declare function calculatePredictedDrift(operators: PlannedOperation[]): number;
/**
 * Calculate available coherence budget based on current stance and config
 */
export declare function calculateAvailableBudget(stance: Stance, config: ModeConfig): number;
/**
 * Check if an operator would exceed the coherence budget
 */
export declare function wouldExceedBudget(operator: PlannedOperation, currentDrift: number, availableBudget: number): boolean;
/**
 * Filter operators that would exceed the coherence budget
 * Returns operators that fit within budget, prioritizing by intensity
 */
export declare function filterByCoherenceBudget(operators: PlannedOperation[], stance: Stance, config: ModeConfig): {
    selected: PlannedOperation[];
    filtered: PlannedOperation[];
};
/**
 * Generate a coherence forecast for display
 */
export interface CoherenceForecast {
    currentDrift: number;
    predictedDrift: number;
    availableBudget: number;
    willExceed: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
}
export declare function generateCoherenceForecast(operators: PlannedOperation[], stance: Stance, config: ModeConfig): CoherenceForecast;
/**
 * Check if regeneration should be triggered
 */
export declare function shouldRegenerate(coherenceScore: number, config: ModeConfig, regenerationAttempts: number): boolean;
//# sourceMappingURL=coherence-planner.d.ts.map