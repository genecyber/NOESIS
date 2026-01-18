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

const FRAMES: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
const SELF_MODELS: SelfModel[] = ['interpreter', 'challenger', 'mirror', 'guide', 'provocateur', 'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'];
const OBJECTIVES: Objective[] = ['helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'];

export class MonteCarloSimulator {
  private config: SimulationConfig;
  private rng: () => number;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = {
      iterations: 1000,
      timeSteps: 20,
      volatility: 0.3,
      confidenceLevel: 0.95,
      ...config
    };

    // Simple seeded RNG
    this.rng = config?.seed !== undefined
      ? this.createSeededRng(config.seed)
      : Math.random;
  }

  private createSeededRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  simulate(initialStance: Stance): SimulationResult {
    const trajectories = this.runSimulations(initialStance);
    const statistics = this.calculateStatistics(trajectories);
    const riskAssessment = this.assessRisk(trajectories, statistics);
    const confidenceIntervals = this.calculateConfidenceIntervals(trajectories);
    const scenarios = this.generateScenarios(trajectories);

    return {
      trajectories: trajectories.slice(0, 10), // Return top 10 for inspection
      statistics,
      riskAssessment,
      confidenceIntervals,
      scenarios
    };
  }

  private runSimulations(initialStance: Stance): StanceTrajectory[] {
    const trajectories: StanceTrajectory[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const trajectory = this.runSingleSimulation(initialStance, i);
      trajectories.push(trajectory);
    }

    // Sort by probability (determined by final coherence)
    trajectories.sort((a, b) => b.probability - a.probability);

    return trajectories;
  }

  private runSingleSimulation(initialStance: Stance, index: number): StanceTrajectory {
    const steps: StanceSnapshot[] = [];
    let currentStance = JSON.parse(JSON.stringify(initialStance)) as Stance;
    let totalDrift = 0;
    const coherenceHistory: number[] = [];

    for (let step = 0; step < this.config.timeSteps; step++) {
      const { newStance, drift, changedFields } = this.evolveStance(currentStance);
      const coherence = this.calculateCoherence(newStance);

      totalDrift += drift;
      coherenceHistory.push(coherence);

      steps.push({
        step,
        stance: JSON.parse(JSON.stringify(newStance)),
        coherence,
        drift,
        changedFields
      });

      currentStance = newStance;
    }

    const avgCoherence = coherenceHistory.reduce((a, b) => a + b, 0) / coherenceHistory.length;
    const probability = avgCoherence / 100; // Higher coherence = more probable

    return {
      id: `traj-${index}`,
      steps,
      totalDrift,
      coherenceHistory,
      probability
    };
  }

  private evolveStance(stance: Stance): {
    newStance: Stance;
    drift: number;
    changedFields: string[];
  } {
    const newStance = JSON.parse(JSON.stringify(stance)) as Stance;
    const changedFields: string[] = [];
    let drift = 0;

    // Evolve values with random walk
    const valueKeys = Object.keys(newStance.values) as (keyof Values)[];
    for (const key of valueKeys) {
      if (this.rng() < this.config.volatility) {
        const change = (this.rng() - 0.5) * 20;
        const oldValue = newStance.values[key];
        newStance.values[key] = Math.max(0, Math.min(100, oldValue + change));
        drift += Math.abs(change);
        changedFields.push(`values.${key}`);
      }
    }

    // Occasionally change frame
    if (this.rng() < this.config.volatility * 0.3) {
      const newFrame = FRAMES[Math.floor(this.rng() * FRAMES.length)];
      if (newFrame !== newStance.frame) {
        newStance.frame = newFrame;
        changedFields.push('frame');
        drift += 10;
      }
    }

    // Occasionally change self-model
    if (this.rng() < this.config.volatility * 0.2) {
      const newModel = SELF_MODELS[Math.floor(this.rng() * SELF_MODELS.length)];
      if (newModel !== newStance.selfModel) {
        newStance.selfModel = newModel;
        changedFields.push('selfModel');
        drift += 8;
      }
    }

    // Rarely change objective
    if (this.rng() < this.config.volatility * 0.1) {
      const newObjective = OBJECTIVES[Math.floor(this.rng() * OBJECTIVES.length)];
      if (newObjective !== newStance.objective) {
        newStance.objective = newObjective;
        changedFields.push('objective');
        drift += 12;
      }
    }

    newStance.cumulativeDrift += drift;
    newStance.turnsSinceLastShift = changedFields.length > 0 ? 0 : newStance.turnsSinceLastShift + 1;

    return { newStance, drift, changedFields };
  }

  private calculateCoherence(stance: Stance): number {
    const values = Object.values(stance.values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Higher coherence = lower variance
    return Math.max(0, Math.min(100, 100 - stdDev * 2));
  }

  private calculateStatistics(trajectories: StanceTrajectory[]): TrajectoryStatistics {
    const allDrifts = trajectories.map(t => t.totalDrift);
    const allCoherences = trajectories.flatMap(t => t.coherenceHistory);

    const frames = trajectories.map(t => t.steps[t.steps.length - 1].stance.frame);
    const selfModels = trajectories.map(t => t.steps[t.steps.length - 1].stance.selfModel);
    const objectives = trajectories.map(t => t.steps[t.steps.length - 1].stance.objective);

    return {
      meanDrift: this.mean(allDrifts),
      stdDevDrift: this.stdDev(allDrifts),
      meanCoherence: this.mean(allCoherences),
      stdDevCoherence: this.stdDev(allCoherences),
      modeFrame: this.mode(frames) as Frame,
      modeSelfModel: this.mode(selfModels) as SelfModel,
      modeObjective: this.mode(objectives) as Objective,
      valueDistributions: this.calculateValueDistributions(trajectories)
    };
  }

  private calculateValueDistributions(
    trajectories: StanceTrajectory[]
  ): Record<keyof Values, ValueDistribution> {
    const valueKeys: (keyof Values)[] = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
    const distributions = {} as Record<keyof Values, ValueDistribution>;

    for (const key of valueKeys) {
      const values = trajectories.map(t =>
        t.steps[t.steps.length - 1].stance.values[key]
      );

      distributions[key] = {
        mean: this.mean(values),
        stdDev: this.stdDev(values),
        min: Math.min(...values),
        max: Math.max(...values),
        percentiles: {
          '5': this.percentile(values, 5),
          '25': this.percentile(values, 25),
          '50': this.percentile(values, 50),
          '75': this.percentile(values, 75),
          '95': this.percentile(values, 95)
        }
      };
    }

    return distributions;
  }

  private assessRisk(
    _trajectories: StanceTrajectory[],
    statistics: TrajectoryStatistics
  ): RiskAssessment {
    const recommendations: string[] = [];

    // Coherence risk
    let coherenceRisk: RiskLevel = 'low';
    if (statistics.meanCoherence < 30) {
      coherenceRisk = 'critical';
      recommendations.push('Coherence is dangerously low - consider constraining transformations');
    } else if (statistics.meanCoherence < 50) {
      coherenceRisk = 'high';
      recommendations.push('Coherence risk is elevated - monitor closely');
    } else if (statistics.meanCoherence < 70) {
      coherenceRisk = 'moderate';
    }

    // Drift risk
    let driftRisk: RiskLevel = 'low';
    if (statistics.meanDrift > 200) {
      driftRisk = 'critical';
      recommendations.push('Drift is extreme - reduce volatility');
    } else if (statistics.meanDrift > 100) {
      driftRisk = 'high';
      recommendations.push('High drift detected - stance stability at risk');
    } else if (statistics.meanDrift > 50) {
      driftRisk = 'moderate';
    }

    // Instability risk (based on variance)
    const coherenceVariability = statistics.stdDevCoherence / statistics.meanCoherence;
    let instabilityRisk: RiskLevel = 'low';
    if (coherenceVariability > 0.5) {
      instabilityRisk = 'high';
      recommendations.push('High instability - stance evolution is unpredictable');
    } else if (coherenceVariability > 0.3) {
      instabilityRisk = 'moderate';
    }

    // Overall risk
    const riskLevels: Record<RiskLevel, number> = {
      'low': 0, 'moderate': 1, 'high': 2, 'critical': 3
    };
    const maxRisk = Math.max(
      riskLevels[coherenceRisk],
      riskLevels[driftRisk],
      riskLevels[instabilityRisk]
    );
    const overallRisk: RiskLevel = (['low', 'moderate', 'high', 'critical'] as RiskLevel[])[maxRisk];

    return {
      coherenceRisk,
      driftRisk,
      instabilityRisk,
      overallRisk,
      recommendations
    };
  }

  private calculateConfidenceIntervals(trajectories: StanceTrajectory[]): ConfidenceIntervals {
    const alpha = 1 - this.config.confidenceLevel;
    const lowerPercentile = (alpha / 2) * 100;
    const upperPercentile = (1 - alpha / 2) * 100;

    const finalCoherences = trajectories.map(t =>
      t.coherenceHistory[t.coherenceHistory.length - 1]
    );
    const finalDrifts = trajectories.map(t => t.totalDrift);

    const valueKeys: (keyof Values)[] = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
    const valueIntervals = {} as Record<keyof Values, Interval>;

    for (const key of valueKeys) {
      const values = trajectories.map(t =>
        t.steps[t.steps.length - 1].stance.values[key]
      );
      valueIntervals[key] = {
        lower: this.percentile(values, lowerPercentile),
        upper: this.percentile(values, upperPercentile),
        mean: this.mean(values),
        confidence: this.config.confidenceLevel
      };
    }

    return {
      coherence: {
        lower: this.percentile(finalCoherences, lowerPercentile),
        upper: this.percentile(finalCoherences, upperPercentile),
        mean: this.mean(finalCoherences),
        confidence: this.config.confidenceLevel
      },
      drift: {
        lower: this.percentile(finalDrifts, lowerPercentile),
        upper: this.percentile(finalDrifts, upperPercentile),
        mean: this.mean(finalDrifts),
        confidence: this.config.confidenceLevel
      },
      values: valueIntervals
    };
  }

  private generateScenarios(trajectories: StanceTrajectory[]): ScenarioComparison[] {
    // Group trajectories by final state characteristics
    const scenarios: ScenarioComparison[] = [];

    // Best case (highest coherence)
    const bestCase = trajectories[0];
    scenarios.push({
      name: 'Best Case',
      description: 'Highest coherence trajectory',
      probability: bestCase.probability,
      outcome: bestCase.steps[bestCase.steps.length - 1],
      rank: 1
    });

    // Worst case (lowest coherence)
    const worstCase = trajectories[trajectories.length - 1];
    scenarios.push({
      name: 'Worst Case',
      description: 'Lowest coherence trajectory',
      probability: worstCase.probability,
      outcome: worstCase.steps[worstCase.steps.length - 1],
      rank: trajectories.length
    });

    // Median case
    const medianIndex = Math.floor(trajectories.length / 2);
    const medianCase = trajectories[medianIndex];
    scenarios.push({
      name: 'Median Case',
      description: 'Most likely trajectory',
      probability: medianCase.probability,
      outcome: medianCase.steps[medianCase.steps.length - 1],
      rank: medianIndex + 1
    });

    // High drift scenario
    const highDrift = trajectories.reduce((max, t) =>
      t.totalDrift > max.totalDrift ? t : max
    );
    scenarios.push({
      name: 'High Drift',
      description: 'Maximum stance evolution',
      probability: highDrift.probability,
      outcome: highDrift.steps[highDrift.steps.length - 1],
      rank: trajectories.indexOf(highDrift) + 1
    });

    return scenarios;
  }

  runSensitivityAnalysis(initialStance: Stance): SensitivityResult[] {
    const results: SensitivityResult[] = [];
    const baseResult = this.simulate(initialStance);
    const baseMeanCoherence = baseResult.statistics.meanCoherence;

    // Test volatility sensitivity
    const volatilities = [0.1, 0.2, 0.3, 0.4, 0.5];
    const volatilityCoherences: number[] = [];

    for (const vol of volatilities) {
      const tempConfig = { ...this.config, volatility: vol };
      const simulator = new MonteCarloSimulator(tempConfig);
      const result = simulator.simulate(initialStance);
      volatilityCoherences.push(result.statistics.meanCoherence);
    }

    const volatilitySensitivity = (
      (volatilityCoherences[volatilityCoherences.length - 1] - volatilityCoherences[0]) /
      baseMeanCoherence
    );

    results.push({
      parameter: 'volatility',
      sensitivity: Math.abs(volatilitySensitivity),
      impactRange: [
        Math.min(...volatilityCoherences),
        Math.max(...volatilityCoherences)
      ],
      criticalThreshold: volatilities[
        volatilityCoherences.findIndex(c => c < 50) || volatilities.length - 1
      ]
    });

    // Test time steps sensitivity
    const timeStepsOptions = [5, 10, 20, 40];
    const timeStepsCoherences: number[] = [];

    for (const steps of timeStepsOptions) {
      const tempConfig = { ...this.config, timeSteps: steps };
      const simulator = new MonteCarloSimulator(tempConfig);
      const result = simulator.simulate(initialStance);
      timeStepsCoherences.push(result.statistics.meanCoherence);
    }

    const timeStepsSensitivity = (
      (timeStepsCoherences[timeStepsCoherences.length - 1] - timeStepsCoherences[0]) /
      baseMeanCoherence
    );

    results.push({
      parameter: 'timeSteps',
      sensitivity: Math.abs(timeStepsSensitivity),
      impactRange: [
        Math.min(...timeStepsCoherences),
        Math.max(...timeStepsCoherences)
      ]
    });

    return results;
  }

  // Helper functions
  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private mode<T>(values: T[]): T {
    const counts = new Map<T, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    let maxCount = 0;
    let mode = values[0];
    for (const [value, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mode = value;
      }
    }

    return mode;
  }

  updateConfig(config: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.seed !== undefined) {
      this.rng = this.createSeededRng(config.seed);
    }
  }

  getConfig(): SimulationConfig {
    return { ...this.config };
  }
}

export function createMonteCarloSimulator(config?: Partial<SimulationConfig>): MonteCarloSimulator {
  return new MonteCarloSimulator(config);
}
