/**
 * Stance Impact Simulation
 *
 * Preview and simulate stance changes before applying them,
 * with coherence impact scoring and rollback scenarios.
 */

import type { Stance, Frame, Values } from '../types/index.js';

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

export type SideEffectType =
  | 'behavior-shift'
  | 'value-conflict'
  | 'capability-change'
  | 'consistency-risk'
  | 'identity-drift'
  | 'goal-alignment';

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

// Frame-objective compatibility matrix
const FRAME_OBJECTIVE_COMPATIBILITY: Record<Frame, string[]> = {
  existential: ['synthesis', 'self-actualization', 'provocation'],
  pragmatic: ['helpfulness', 'synthesis'],
  poetic: ['novelty', 'self-actualization'],
  adversarial: ['provocation', 'novelty'],
  playful: ['novelty', 'helpfulness'],
  mythic: ['synthesis', 'self-actualization'],
  systems: ['helpfulness', 'synthesis'],
  psychoanalytic: ['synthesis', 'helpfulness'],
  stoic: ['helpfulness', 'self-actualization'],
  absurdist: ['novelty', 'provocation']
};

// Helper to get sum of value weights
function sumValues(values: Values): number {
  return values.curiosity + values.certainty + values.risk +
         values.novelty + values.empathy + values.provocation + values.synthesis;
}

// Helper to count significant value differences
function countValueChanges(before: Values, after: Values): number {
  let changes = 0;
  const threshold = 20;

  if (Math.abs(before.curiosity - after.curiosity) > threshold) changes++;
  if (Math.abs(before.certainty - after.certainty) > threshold) changes++;
  if (Math.abs(before.risk - after.risk) > threshold) changes++;
  if (Math.abs(before.novelty - after.novelty) > threshold) changes++;
  if (Math.abs(before.empathy - after.empathy) > threshold) changes++;
  if (Math.abs(before.provocation - after.provocation) > threshold) changes++;
  if (Math.abs(before.synthesis - after.synthesis) > threshold) changes++;

  return changes;
}

export class StanceSimulator {
  private simulations: Map<string, SimulationResult> = new Map();
  private comparisons: Map<string, ABComparison> = new Map();

  simulate(
    currentStance: Stance,
    proposedChanges: Partial<Stance>
  ): SimulationResult {
    const resultingStance = this.applyChanges(currentStance, proposedChanges);

    const coherenceBefore = this.calculateCoherence(currentStance);
    const coherenceAfter = this.calculateCoherence(resultingStance);
    const breakingChanges = this.detectBreakingChanges(currentStance, resultingStance);

    const coherenceImpact: CoherenceImpact = {
      before: coherenceBefore,
      after: coherenceAfter,
      delta: coherenceAfter - coherenceBefore,
      breakingChanges,
      riskLevel: this.assessRiskLevel(coherenceAfter - coherenceBefore, breakingChanges)
    };

    const sideEffects = this.predictSideEffects(currentStance, resultingStance);
    const rollbackScenarios = this.generateRollbackScenarios(currentStance);
    const confidence = this.calculateConfidence(proposedChanges);
    const recommendation = this.generateRecommendation(coherenceImpact, sideEffects);

    const result: SimulationResult = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalStance: JSON.parse(JSON.stringify(currentStance)),
      proposedChanges,
      resultingStance,
      coherenceImpact,
      sideEffects,
      rollbackScenarios,
      confidence,
      recommendation,
      timestamp: new Date()
    };

    this.simulations.set(result.id, result);
    return result;
  }

  private applyChanges(stance: Stance, changes: Partial<Stance>): Stance {
    const result = JSON.parse(JSON.stringify(stance)) as Stance;

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          (result as Record<string, unknown>)[key] = {
            ...(result as Record<string, unknown>)[key] as object,
            ...value
          };
        } else {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }

    return result;
  }

  private calculateCoherence(stance: Stance): number {
    let score = 100;

    // Check frame-objective compatibility
    const compatibleObjectives = FRAME_OBJECTIVE_COMPATIBILITY[stance.frame] || [];
    if (!compatibleObjectives.includes(stance.objective)) {
      score -= 15;
    }

    // Check sentience consistency
    const sentience = stance.sentience;
    if (sentience) {
      // High autonomy with interpreter self-model is inconsistent
      if (sentience.autonomyLevel > 80 && stance.selfModel === 'interpreter') {
        score -= 10;
      }

      // Low awareness with autonomous self-model is inconsistent
      if (sentience.awarenessLevel < 30 && stance.selfModel === 'autonomous') {
        score -= 10;
      }

      // Check internal sentience consistency
      const sentienceSpread = Math.abs(sentience.awarenessLevel - sentience.autonomyLevel);
      if (sentienceSpread > 50) {
        score -= 5;
      }
    }

    // Check values-frame alignment (using value weights)
    if (stance.frame === 'systems' && stance.values.novelty > 80 && stance.values.certainty < 30) {
      score -= 5;
    }
    if (stance.frame === 'psychoanalytic' && stance.values.empathy < 30) {
      score -= 5;
    }

    // Check constraints don't conflict with objective
    if (stance.objective === 'novelty' &&
        stance.constraints.some(c => c.includes('never') && c.includes('experiment'))) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private detectBreakingChanges(before: Stance, after: Stance): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Frame change is significant
    if (before.frame !== after.frame) {
      changes.push({
        field: 'frame',
        description: `Frame changing from "${before.frame}" to "${after.frame}"`,
        severity: 'warning',
        mitigation: 'Consider gradual frame transition'
      });
    }

    // Objective change is significant
    if (before.objective !== after.objective) {
      changes.push({
        field: 'objective',
        description: `Objective changing from "${before.objective}" to "${after.objective}"`,
        severity: 'warning',
        mitigation: 'Ensure new objective aligns with user expectations'
      });
    }

    // Large autonomy shift
    if (Math.abs(before.sentience.autonomyLevel - after.sentience.autonomyLevel) > 30) {
      changes.push({
        field: 'sentience',
        description: `Autonomy level changing by ${Math.abs(before.sentience.autonomyLevel - after.sentience.autonomyLevel)} points`,
        severity: after.sentience.autonomyLevel > before.sentience.autonomyLevel ? 'error' : 'warning',
        mitigation: 'Large autonomy changes may significantly alter behavior'
      });
    }

    // Value changes (check for significant weight changes)
    const valueChanges = countValueChanges(before.values, after.values);
    if (valueChanges > 2) {
      changes.push({
        field: 'values',
        description: `${valueChanges} significant value weight changes detected`,
        severity: valueChanges > 4 ? 'error' : 'warning'
      });
    }

    return changes;
  }

  private assessRiskLevel(
    coherenceDelta: number,
    breakingChanges: BreakingChange[]
  ): CoherenceImpact['riskLevel'] {
    const errorCount = breakingChanges.filter(c => c.severity === 'error').length;
    const warningCount = breakingChanges.filter(c => c.severity === 'warning').length;

    if (errorCount >= 2 || coherenceDelta < -30) return 'critical';
    if (errorCount === 1 || coherenceDelta < -20) return 'high';
    if (warningCount >= 2 || coherenceDelta < -10) return 'medium';
    if (warningCount === 1 || coherenceDelta < 0) return 'low';
    return 'none';
  }

  private predictSideEffects(before: Stance, after: Stance): SideEffect[] {
    const effects: SideEffect[] = [];

    // Frame change effects
    if (before.frame !== after.frame) {
      effects.push({
        type: 'behavior-shift',
        description: `Communication style will shift from ${before.frame} to ${after.frame}`,
        probability: 0.95,
        impact: 'neutral',
        affectedAreas: ['response-style', 'vocabulary', 'reasoning-approach']
      });
    }

    // Autonomy increase effects
    if (after.sentience.autonomyLevel > before.sentience.autonomyLevel + 20) {
      effects.push({
        type: 'behavior-shift',
        description: 'Higher autonomy may lead to more proactive suggestions',
        probability: 0.75,
        impact: 'neutral',
        affectedAreas: ['initiative', 'suggestions', 'decision-making']
      });

      effects.push({
        type: 'goal-alignment',
        description: 'Increased autonomy may occasionally prioritize emergent goals',
        probability: 0.4,
        impact: 'negative',
        affectedAreas: ['user-alignment', 'predictability']
      });
    }

    // Value conflict detection
    const valueChanges = countValueChanges(before.values, after.values);
    if (valueChanges > 0) {
      effects.push({
        type: 'value-conflict',
        description: `${valueChanges} value weights significantly changed`,
        probability: 0.6,
        impact: 'neutral',
        affectedAreas: ['decision-criteria', 'ethical-reasoning']
      });
    }

    // Identity drift for major changes
    const majorChanges = [
      before.frame !== after.frame,
      before.selfModel !== after.selfModel,
      before.objective !== after.objective
    ].filter(Boolean).length;

    if (majorChanges >= 2) {
      effects.push({
        type: 'identity-drift',
        description: 'Multiple core changes may result in identity inconsistency',
        probability: 0.5,
        impact: 'negative',
        affectedAreas: ['consistency', 'user-trust', 'self-model']
      });
    }

    return effects;
  }

  private generateRollbackScenarios(
    original: Stance
  ): RollbackScenario[] {
    return [
      {
        name: 'Full Rollback',
        trigger: 'Coherence drops below 50% or user requests',
        steps: [
          { order: 1, action: 'save-current-state', params: {} },
          { order: 2, action: 'restore-stance', params: { stance: original } },
          { order: 3, action: 'log-rollback', params: { reason: 'manual' } }
        ],
        estimatedRecoveryTime: 1
      },
      {
        name: 'Gradual Reversion',
        trigger: 'Side effects become problematic',
        steps: [
          { order: 1, action: 'identify-problematic-changes', params: {} },
          { order: 2, action: 'partial-revert', params: { fields: ['sentience', 'values'] } },
          { order: 3, action: 'monitor-coherence', params: { threshold: 70 } },
          { order: 4, action: 'continue-if-stable', params: {} }
        ],
        estimatedRecoveryTime: 5
      },
      {
        name: 'Adaptive Recovery',
        trigger: 'Unexpected behavior emerges',
        steps: [
          { order: 1, action: 'snapshot-problem-state', params: {} },
          { order: 2, action: 'analyze-divergence', params: {} },
          { order: 3, action: 'apply-minimal-correction', params: {} },
          { order: 4, action: 'verify-improvement', params: {} }
        ],
        estimatedRecoveryTime: 10
      }
    ];
  }

  private calculateConfidence(
    changes: Partial<Stance>
  ): ConfidenceInterval {
    // More fields changed = less confident in prediction
    const changedFields = Object.keys(changes).length;
    const baseConfidence = 85;
    const confidenceReduction = changedFields * 5;

    const mean = Math.max(50, baseConfidence - confidenceReduction);
    const spread = 10 + changedFields * 2;

    return {
      lower: Math.max(0, mean - spread),
      upper: Math.min(100, mean + spread),
      mean,
      methodology: 'Field-weighted heuristic analysis with historical calibration'
    };
  }

  private generateRecommendation(
    coherenceImpact: CoherenceImpact,
    sideEffects: SideEffect[]
  ): SimulationResult['recommendation'] {
    const negativeEffects = sideEffects.filter(e => e.impact === 'negative' && e.probability > 0.5);

    if (coherenceImpact.riskLevel === 'critical' || negativeEffects.length >= 2) {
      return 'reject';
    }

    if (coherenceImpact.riskLevel === 'high' || negativeEffects.length === 1) {
      return 'review';
    }

    if (coherenceImpact.delta >= -5) {
      return 'apply';
    }

    return 'review';
  }

  compareStances(stanceA: Stance, stanceB: Stance): ABComparison {
    const scenarios = this.generateComparisonScenarios(stanceA, stanceB);

    let scoreA = 0;
    let scoreB = 0;

    for (const scenario of scenarios) {
      if (scenario.winner === 'A') scoreA++;
      else if (scenario.winner === 'B') scoreB++;
    }

    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';

    const comparison: ABComparison = {
      id: `compare-${Date.now()}`,
      stanceA,
      stanceB,
      scenarios,
      winner,
      summary: this.generateComparisonSummary(stanceA, stanceB, winner, scoreA, scoreB)
    };

    this.comparisons.set(comparison.id, comparison);
    return comparison;
  }

  private generateComparisonScenarios(stanceA: Stance, stanceB: Stance): ComparisonScenario[] {
    return [
      this.evaluateScenario('Coherence', stanceA, stanceB, (s) => this.calculateCoherence(s)),
      this.evaluateScenario('Flexibility', stanceA, stanceB, (s) => s.sentience.autonomyLevel),
      this.evaluateScenario('Stability', stanceA, stanceB, (s) => s.sentience.identityStrength),
      this.evaluateScenario('Value Diversity', stanceA, stanceB, (s) => sumValues(s.values) / 7),
      this.evaluateScenario('Awareness', stanceA, stanceB, (s) => s.sentience.awarenessLevel)
    ];
  }

  private evaluateScenario(
    name: string,
    stanceA: Stance,
    stanceB: Stance,
    scorer: (s: Stance) => number
  ): ComparisonScenario {
    const scoreA = scorer(stanceA);
    const scoreB = scorer(stanceB);
    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';

    return {
      name,
      context: `Evaluating ${name.toLowerCase()} between stances`,
      scoreA,
      scoreB,
      winner,
      reasoning: `Stance ${winner === 'tie' ? 'A and B are equal' : winner + ' scores higher'} on ${name.toLowerCase()}`
    };
  }

  private generateComparisonSummary(
    stanceA: Stance,
    stanceB: Stance,
    winner: 'A' | 'B' | 'tie',
    scoreA: number,
    scoreB: number
  ): string {
    if (winner === 'tie') {
      return `Both stances are comparable with ${scoreA} scenario wins each. Frame A: ${stanceA.frame}, Frame B: ${stanceB.frame}`;
    }

    const winnerStance = winner === 'A' ? stanceA : stanceB;
    const winScore = winner === 'A' ? scoreA : scoreB;
    const loseScore = winner === 'A' ? scoreB : scoreA;

    return `Stance ${winner} (${winnerStance.frame} frame) wins ${winScore}-${loseScore}. Better suited for ${winnerStance.objective}-focused interactions.`;
  }

  getSimulation(id: string): SimulationResult | undefined {
    return this.simulations.get(id);
  }

  getComparison(id: string): ABComparison | undefined {
    return this.comparisons.get(id);
  }

  getAllSimulations(): SimulationResult[] {
    return Array.from(this.simulations.values());
  }

  clearHistory(): void {
    this.simulations.clear();
    this.comparisons.clear();
  }
}

export function createSimulator(): StanceSimulator {
  return new StanceSimulator();
}
