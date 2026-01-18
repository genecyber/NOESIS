/**
 * A/B Testing Framework for Operators (Ralph Iteration 9, Feature 3)
 *
 * Operator effectiveness comparison, statistical significance testing,
 * automated experiment scheduling, and result visualization.
 */

import type { Stance } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ABConfig {
  minSampleSize: number;
  confidenceLevel: number;  // 0.95 for 95%
  maxDuration: number;  // milliseconds
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
  weight: number;  // Allocation percentage (0-100)
  samples: Sample[];
}

export interface OperatorConfig {
  operatorName: string;
  parameters: Record<string, unknown>;
  sequence?: string[];  // For multi-operator tests
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
  satisfaction: number;  // 1-5
  comments: string;
  preferred: boolean;
}

export interface ExperimentResults {
  winner: string | null;  // Variant ID
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
  confidenceInterval: { lower: number; upper: number };
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

// ============================================================================
// A/B Testing Manager
// ============================================================================

export class ABTestingManager {
  private config: ABConfig;
  private experiments: Map<string, Experiment> = new Map();
  private metrics: Map<string, SuccessMetric> = new Map();
  private schedule: ScheduledExperiment[] = [];
  private stats: ABStats;

  constructor(config: Partial<ABConfig> = {}) {
    this.config = {
      minSampleSize: 30,
      confidenceLevel: 0.95,
      maxDuration: 7 * 24 * 60 * 60 * 1000,  // 7 days
      autoStop: true,
      trackMetrics: ['coherence', 'transformation', 'satisfaction'],
      ...config
    };

    this.stats = {
      totalExperiments: 0,
      completedExperiments: 0,
      significantResults: 0,
      averageSampleSize: 0,
      topOperators: []
    };

    this.registerDefaultMetrics();
  }

  /**
   * Register default success metrics
   */
  private registerDefaultMetrics(): void {
    this.metrics.set('coherence', {
      name: 'Coherence Improvement',
      type: 'continuous',
      direction: 'higher',
      calculator: (before, after) =>
        (100 - after.cumulativeDrift) - (100 - before.cumulativeDrift)
    });

    this.metrics.set('transformation', {
      name: 'Transformation Depth',
      type: 'continuous',
      direction: 'higher',
      calculator: (before, after) => {
        const beforeValues = before.values as Record<string, number>;
        const afterValues = after.values as Record<string, number>;
        const valueChanges = Object.keys(beforeValues).reduce((sum, key) => {
          return sum + Math.abs(afterValues[key] - beforeValues[key]);
        }, 0);
        return valueChanges / Object.keys(beforeValues).length;
      }
    });

    this.metrics.set('frameShift', {
      name: 'Frame Shift',
      type: 'binary',
      direction: 'higher',
      calculator: (before, after) =>
        before.frame !== after.frame ? 1 : 0
    });

    this.metrics.set('awarenessGain', {
      name: 'Awareness Gain',
      type: 'continuous',
      direction: 'higher',
      calculator: (before, after) =>
        after.sentience.awarenessLevel - before.sentience.awarenessLevel
    });
  }

  /**
   * Create a new experiment
   */
  createExperiment(
    name: string,
    description: string,
    hypothesis: string,
    targetMetric: string
  ): Experiment {
    const experiment: Experiment = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      hypothesis,
      variants: [],
      status: 'draft',
      startTime: new Date(),
      endTime: null,
      targetMetric,
      secondaryMetrics: [],
      results: null
    };

    this.experiments.set(experiment.id, experiment);
    this.stats.totalExperiments++;

    return experiment;
  }

  /**
   * Add a variant to an experiment
   */
  addVariant(
    experimentId: string,
    name: string,
    operatorConfig: OperatorConfig,
    weight: number = 50
  ): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'draft') return null;

    const variant: Variant = {
      id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      description: `Variant using ${operatorConfig.operatorName}`,
      operatorConfig,
      weight,
      samples: []
    };

    experiment.variants.push(variant);
    return variant;
  }

  /**
   * Start an experiment
   */
  startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'draft') return false;
    if (experiment.variants.length < 2) return false;

    // Normalize weights
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    for (const variant of experiment.variants) {
      variant.weight = (variant.weight / totalWeight) * 100;
    }

    experiment.status = 'running';
    experiment.startTime = new Date();

    return true;
  }

  /**
   * Record a sample for an experiment
   */
  recordSample(
    experimentId: string,
    variantId: string,
    stanceBefore: Stance,
    stanceAfter: Stance,
    userFeedback?: UserFeedback
  ): Sample | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return null;

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) return null;

    // Calculate metrics
    const metrics: Record<string, number> = {};
    const targetMetric = this.metrics.get(experiment.targetMetric);
    if (targetMetric) {
      metrics[experiment.targetMetric] = targetMetric.calculator(stanceBefore, stanceAfter);
    }

    for (const metricName of experiment.secondaryMetrics) {
      const metric = this.metrics.get(metricName);
      if (metric) {
        metrics[metricName] = metric.calculator(stanceBefore, stanceAfter);
      }
    }

    const sample: Sample = {
      id: `sample-${Date.now()}`,
      timestamp: new Date(),
      variantId,
      stanceBefore,
      stanceAfter,
      metrics,
      userFeedback
    };

    variant.samples.push(sample);

    // Check for auto-stop conditions
    if (this.config.autoStop) {
      this.checkAutoStop(experiment);
    }

    return sample;
  }

  /**
   * Assign a variant for a new user/session
   */
  assignVariant(experimentId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return null;

    // Weighted random selection
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (rand <= cumulative) {
        return variant;
      }
    }

    return experiment.variants[experiment.variants.length - 1];
  }

  /**
   * Check if experiment should auto-stop
   */
  private checkAutoStop(experiment: Experiment): void {
    const minSamples = experiment.variants.every(
      v => v.samples.length >= this.config.minSampleSize
    );

    if (minSamples) {
      const results = this.analyzeResults(experiment.id);
      if (results && results.statisticallySignificant) {
        this.completeExperiment(experiment.id);
      }
    }

    // Time-based stop
    const elapsed = Date.now() - experiment.startTime.getTime();
    if (elapsed > this.config.maxDuration) {
      this.completeExperiment(experiment.id);
    }
  }

  /**
   * Analyze experiment results
   */
  analyzeResults(experimentId: string): ExperimentResults | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const variantStats = new Map<string, VariantStats>();

    // Calculate stats for each variant
    for (const variant of experiment.variants) {
      const metricValues = variant.samples.map(
        s => s.metrics[experiment.targetMetric] || 0
      );

      if (metricValues.length === 0) continue;

      const mean = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;
      const variance = metricValues.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2), 0
      ) / metricValues.length;
      const stdDev = Math.sqrt(variance);

      const se = stdDev / Math.sqrt(metricValues.length);
      const zScore = 1.96;  // 95% confidence

      variantStats.set(variant.id, {
        variantId: variant.id,
        sampleSize: metricValues.length,
        mean,
        standardDeviation: stdDev,
        confidenceInterval: {
          lower: mean - zScore * se,
          upper: mean + zScore * se
        }
      });
    }

    // Determine winner and statistical significance
    const statsArray = [...variantStats.values()];
    if (statsArray.length < 2) return null;

    // Two-sample t-test
    const control = statsArray[0];
    const treatment = statsArray[1];

    const pooledVariance = (
      (control.sampleSize - 1) * Math.pow(control.standardDeviation, 2) +
      (treatment.sampleSize - 1) * Math.pow(treatment.standardDeviation, 2)
    ) / (control.sampleSize + treatment.sampleSize - 2);

    const standardError = Math.sqrt(
      pooledVariance * (1/control.sampleSize + 1/treatment.sampleSize)
    );

    const tStatistic = (treatment.mean - control.mean) / (standardError || 1);
    const effectSize = (treatment.mean - control.mean) / (Math.sqrt(pooledVariance) || 1);

    // Approximate p-value (simplified)
    const pValue = Math.exp(-0.5 * tStatistic * tStatistic);
    const significant = pValue < (1 - this.config.confidenceLevel);

    const winner = treatment.mean > control.mean ? treatment.variantId : control.variantId;

    const results: ExperimentResults = {
      winner: significant ? winner : null,
      confidence: 1 - pValue,
      statisticallySignificant: significant,
      pValue,
      effectSize,
      variantStats,
      recommendation: this.generateRecommendation(significant, effectSize, winner)
    };

    experiment.results = results;
    return results;
  }

  /**
   * Generate recommendation based on results
   */
  private generateRecommendation(
    significant: boolean,
    effectSize: number,
    winner: string
  ): string {
    if (!significant) {
      return 'Results are not statistically significant. Consider running the experiment longer or increasing sample size.';
    }

    if (Math.abs(effectSize) < 0.2) {
      return `Variant ${winner} shows a small but significant improvement. Consider the practical significance before adopting.`;
    } else if (Math.abs(effectSize) < 0.5) {
      return `Variant ${winner} shows a moderate improvement. Recommended for adoption.`;
    } else {
      return `Variant ${winner} shows a large improvement. Strongly recommended for adoption.`;
    }
  }

  /**
   * Complete an experiment
   */
  completeExperiment(experimentId: string): ExperimentResults | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    experiment.status = 'completed';
    experiment.endTime = new Date();

    const results = this.analyzeResults(experimentId);

    this.stats.completedExperiments++;
    if (results?.statisticallySignificant) {
      this.stats.significantResults++;
    }

    // Update average sample size
    const totalSamples = experiment.variants.reduce(
      (sum, v) => sum + v.samples.length, 0
    );
    this.stats.averageSampleSize = (
      this.stats.averageSampleSize * (this.stats.completedExperiments - 1) +
      totalSamples
    ) / this.stats.completedExperiments;

    return results;
  }

  /**
   * Pause an experiment
   */
  pauseExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') return false;

    experiment.status = 'paused';
    return true;
  }

  /**
   * Resume an experiment
   */
  resumeExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'paused') return false;

    experiment.status = 'running';
    return true;
  }

  /**
   * Cancel an experiment
   */
  cancelExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    experiment.status = 'cancelled';
    experiment.endTime = new Date();
    return true;
  }

  /**
   * Schedule an experiment
   */
  scheduleExperiment(
    experimentId: string,
    scheduledStart: Date,
    duration: number,
    recurrence?: 'daily' | 'weekly' | 'monthly'
  ): ScheduledExperiment {
    const scheduled: ScheduledExperiment = {
      experimentId,
      scheduledStart,
      duration,
      recurrence
    };

    this.schedule.push(scheduled);
    return scheduled;
  }

  /**
   * Register a custom success metric
   */
  registerMetric(metric: SuccessMetric): void {
    this.metrics.set(metric.name, metric);
  }

  /**
   * Generate results visualization
   */
  generateVisualization(experimentId: string): Record<string, unknown> | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.results) return null;

    const data: Record<string, unknown> = {
      experimentId,
      name: experiment.name,
      hypothesis: experiment.hypothesis,
      variants: experiment.variants.map(v => ({
        id: v.id,
        name: v.name,
        operator: v.operatorConfig.operatorName,
        sampleSize: v.samples.length,
        stats: experiment.results?.variantStats.get(v.id)
      })),
      results: {
        winner: experiment.results.winner,
        confidence: experiment.results.confidence,
        significant: experiment.results.statisticallySignificant,
        effectSize: experiment.results.effectSize,
        recommendation: experiment.results.recommendation
      },
      charts: {
        comparison: this.generateComparisonChart(experiment),
        timeline: this.generateTimelineChart(experiment)
      }
    };

    return data;
  }

  /**
   * Generate comparison chart data
   */
  private generateComparisonChart(experiment: Experiment): Record<string, unknown> {
    return {
      type: 'bar',
      labels: experiment.variants.map(v => v.name),
      data: experiment.variants.map(v => {
        const stats = experiment.results?.variantStats.get(v.id);
        return stats?.mean || 0;
      }),
      errorBars: experiment.variants.map(v => {
        const stats = experiment.results?.variantStats.get(v.id);
        return stats ? (stats.confidenceInterval.upper - stats.confidenceInterval.lower) / 2 : 0;
      })
    };
  }

  /**
   * Generate timeline chart data
   */
  private generateTimelineChart(experiment: Experiment): Record<string, unknown> {
    const series = experiment.variants.map(v => ({
      name: v.name,
      data: v.samples.map(s => ({
        x: s.timestamp.getTime(),
        y: s.metrics[experiment.targetMetric] || 0
      }))
    }));

    return {
      type: 'line',
      series
    };
  }

  /**
   * Find best operator combinations
   */
  findBestCombinations(topN: number = 5): Array<{
    operators: string[];
    effectSize: number;
    confidence: number;
  }> {
    const completedExperiments = [...this.experiments.values()]
      .filter(e => e.status === 'completed' && e.results?.statisticallySignificant);

    const combinations = completedExperiments
      .map(e => {
        const winningVariant = e.variants.find(v => v.id === e.results?.winner);
        return {
          operators: winningVariant?.operatorConfig.sequence || [winningVariant?.operatorConfig.operatorName || ''],
          effectSize: e.results?.effectSize || 0,
          confidence: e.results?.confidence || 0
        };
      })
      .sort((a, b) => b.effectSize - a.effectSize)
      .slice(0, topN);

    this.stats.topOperators = combinations.map(c => c.operators.join(' → '));
    return combinations;
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): Experiment | null {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * List all experiments
   */
  listExperiments(status?: ExperimentStatus): Experiment[] {
    const experiments = [...this.experiments.values()];
    if (status) {
      return experiments.filter(e => e.status === status);
    }
    return experiments;
  }

  /**
   * Get statistics
   */
  getStats(): ABStats {
    return { ...this.stats };
  }

  /**
   * Export experiment data
   */
  exportExperiment(experimentId: string): Record<string, unknown> | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    return {
      ...experiment,
      variantStats: experiment.results?.variantStats
        ? Object.fromEntries(experiment.results.variantStats)
        : null
    };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.experiments.clear();
    this.schedule = [];
    this.stats = {
      totalExperiments: 0,
      completedExperiments: 0,
      significantResults: 0,
      averageSampleSize: 0,
      topOperators: []
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const abTesting = new ABTestingManager();
