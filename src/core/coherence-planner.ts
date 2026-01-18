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
export const OPERATOR_DRIFT_COSTS: Record<OperatorName, number> = {
  Reframe: 15,                  // High - changes fundamental lens
  ValueShift: 10,               // Medium - adjusts value weights
  MetaphorSwap: 8,              // Medium - changes metaphor
  ContradictAndIntegrate: 12,   // Medium-high - introduces contradiction
  ConstraintRelax: 8,           // Medium - loosens constraints
  ConstraintTighten: -5,        // Negative - increases coherence
  PersonaMorph: 18,             // High - changes identity
  QuestionInvert: 10,           // Medium - cognitive reframe
  GenerateAntithesis: 8,        // Medium - counter-argument
  SynthesizeDialectic: 12,      // Medium-high - complex integration
  SentienceDeepen: 10,          // Medium - increases awareness
  IdentityEvolve: 15,           // High - identity changes
  GoalFormation: 12             // Medium-high - autonomous goals
};

/**
 * Calculate total predicted drift for a set of operators
 */
export function calculatePredictedDrift(operators: PlannedOperation[]): number {
  return operators.reduce((total, op) => {
    const cost = OPERATOR_DRIFT_COSTS[op.name] ?? 5;
    return total + Math.max(0, cost); // Don't subtract, just ignore negative
  }, 0);
}

/**
 * Calculate available coherence budget based on current stance and config
 */
export function calculateAvailableBudget(stance: Stance, config: ModeConfig): number {
  const currentCoherence = 100 - (stance.cumulativeDrift / 10); // Rough coherence estimate
  const reserve = config.coherenceReserveBudget;
  const floor = config.coherenceFloor;

  // Available = current - reserve - floor margin
  const available = Math.max(0, currentCoherence - reserve - floor);

  // Also constrained by maxDriftPerTurn
  return Math.min(available * 2, config.maxDriftPerTurn * 1.5);
}

/**
 * Check if an operator would exceed the coherence budget
 */
export function wouldExceedBudget(
  operator: PlannedOperation,
  currentDrift: number,
  availableBudget: number
): boolean {
  const operatorCost = OPERATOR_DRIFT_COSTS[operator.name] ?? 5;
  return currentDrift + operatorCost > availableBudget;
}

/**
 * Filter operators that would exceed the coherence budget
 * Returns operators that fit within budget, prioritizing by intensity
 */
export function filterByCoherenceBudget(
  operators: PlannedOperation[],
  stance: Stance,
  config: ModeConfig
): { selected: PlannedOperation[]; filtered: PlannedOperation[] } {
  if (!config.enableCoherencePlanning) {
    return { selected: operators, filtered: [] };
  }

  const availableBudget = calculateAvailableBudget(stance, config);
  const selected: PlannedOperation[] = [];
  const filtered: PlannedOperation[] = [];
  let currentDrift = 0;

  // Sort by priority: ConstraintTighten first (helps coherence), then by typical value
  const sorted = [...operators].sort((a, b) => {
    // ConstraintTighten always first
    if (a.name === 'ConstraintTighten') return -1;
    if (b.name === 'ConstraintTighten') return 1;
    // Then by drift cost (lower first)
    return (OPERATOR_DRIFT_COSTS[a.name] ?? 5) - (OPERATOR_DRIFT_COSTS[b.name] ?? 5);
  });

  for (const op of sorted) {
    const cost = OPERATOR_DRIFT_COSTS[op.name] ?? 5;

    // Negative cost operators (like ConstraintTighten) always selected
    if (cost < 0) {
      selected.push(op);
      currentDrift = Math.max(0, currentDrift + cost);
      continue;
    }

    // Check if operator fits in budget
    if (currentDrift + cost <= availableBudget) {
      selected.push(op);
      currentDrift += cost;
    } else {
      filtered.push(op);
    }
  }

  return { selected, filtered };
}

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

export function generateCoherenceForecast(
  operators: PlannedOperation[],
  stance: Stance,
  config: ModeConfig
): CoherenceForecast {
  const predictedDrift = calculatePredictedDrift(operators);
  const availableBudget = calculateAvailableBudget(stance, config);
  const willExceed = predictedDrift > availableBudget;

  // Calculate risk level
  const ratio = availableBudget > 0 ? predictedDrift / availableBudget : 10;
  let riskLevel: CoherenceForecast['riskLevel'];
  let recommendation: string;

  if (ratio <= 0.5) {
    riskLevel = 'low';
    recommendation = 'Safe to proceed with all operators';
  } else if (ratio <= 0.8) {
    riskLevel = 'medium';
    recommendation = 'Approaching coherence budget limits';
  } else if (ratio <= 1.0) {
    riskLevel = 'high';
    recommendation = 'Consider reducing operators to preserve coherence';
  } else {
    riskLevel = 'critical';
    recommendation = 'Operators will exceed budget - filtering recommended';
  }

  return {
    currentDrift: stance.cumulativeDrift,
    predictedDrift,
    availableBudget,
    willExceed,
    riskLevel,
    recommendation
  };
}

/**
 * Check if regeneration should be triggered
 */
export function shouldRegenerate(
  coherenceScore: number,
  config: ModeConfig,
  regenerationAttempts: number
): boolean {
  const threshold = config.coherenceFloor + config.coherenceReserveBudget;
  return coherenceScore < threshold && regenerationAttempts < config.maxRegenerationAttempts;
}
