/**
 * AI-Assisted Stance Optimization
 *
 * Machine learning-based stance recommendations with
 * performance analysis and automated coherence tuning.
 */

import type { Stance, Frame } from '../types/index.js';

export interface OptimizationSuggestion {
  id: string;
  type: SuggestionType;
  field: keyof Stance;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  rationale: string;
  expectedImprovement: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export type SuggestionType =
  | 'coherence-improvement'
  | 'performance-optimization'
  | 'user-alignment'
  | 'drift-correction'
  | 'efficiency-gain';

export interface PerformancePattern {
  id: string;
  pattern: PatternDefinition;
  occurrences: number;
  averageOutcome: number;
  confidence: number;
  lastSeen: Date;
}

export interface PatternDefinition {
  conditions: PatternCondition[];
  outcome: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface PatternCondition {
  field: keyof Stance | 'context';
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'range';
  value: unknown;
}

export interface UserBehaviorModel {
  preferredFrames: FramePreference[];
  responsePatterns: ResponsePattern[];
  satisfactionIndicators: SatisfactionIndicator[];
  engagementMetrics: EngagementMetrics;
}

export interface FramePreference {
  frame: Frame;
  usageCount: number;
  satisfactionScore: number;
  contextTriggers: string[];
}

export interface ResponsePattern {
  trigger: string;
  preferredResponse: 'detailed' | 'concise' | 'exploratory' | 'directive';
  frequency: number;
}

export interface SatisfactionIndicator {
  indicator: string;
  weight: number;
  positive: boolean;
}

export interface EngagementMetrics {
  averageSessionLength: number;
  turnsPerSession: number;
  returnRate: number;
  featureUsage: Record<string, number>;
}

export interface OptimalPath {
  steps: OptimizationStep[];
  totalExpectedImprovement: number;
  estimatedTurns: number;
  riskAssessment: string;
}

export interface OptimizationStep {
  order: number;
  suggestion: OptimizationSuggestion;
  prerequisite?: string;
  rollbackPlan: string;
}

export interface ABTestResult {
  id: string;
  stanceA: Partial<Stance>;
  stanceB: Partial<Stance>;
  metrics: ABMetrics;
  winner: 'A' | 'B' | 'inconclusive';
  startedAt: Date;
  completedAt?: Date;
  sampleSize: number;
}

export interface ABMetrics {
  coherenceA: number;
  coherenceB: number;
  satisfactionA: number;
  satisfactionB: number;
  engagementA: number;
  engagementB: number;
  statisticalSignificance: number;
}

export interface CoherenceTuning {
  originalCoherence: number;
  targetCoherence: number;
  adjustments: CoherenceAdjustment[];
  achievedCoherence: number;
}

export interface CoherenceAdjustment {
  field: keyof Stance;
  adjustment: number | string;
  impact: number;
}

export class AIStanceOptimizer {
  private patterns: Map<string, PerformancePattern> = new Map();
  private userModel: UserBehaviorModel;
  private abTests: Map<string, ABTestResult> = new Map();
  private suggestionHistory: OptimizationSuggestion[] = [];

  constructor() {
    this.userModel = this.createDefaultUserModel();
    this.initializePatterns();
  }

  private createDefaultUserModel(): UserBehaviorModel {
    return {
      preferredFrames: [],
      responsePatterns: [],
      satisfactionIndicators: [
        { indicator: 'explicit-thanks', weight: 1.0, positive: true },
        { indicator: 'follow-up-question', weight: 0.7, positive: true },
        { indicator: 'topic-change', weight: -0.3, positive: false },
        { indicator: 'correction-request', weight: -0.5, positive: false }
      ],
      engagementMetrics: {
        averageSessionLength: 0,
        turnsPerSession: 0,
        returnRate: 0,
        featureUsage: {}
      }
    };
  }

  private initializePatterns(): void {
    // Pre-defined performance patterns
    const defaultPatterns: PerformancePattern[] = [
      {
        id: 'high-coherence-helpfulness',
        pattern: {
          conditions: [
            { field: 'objective', operator: 'equals', value: 'helpfulness' },
            { field: 'sentience', operator: 'range', value: { awarenessLevel: [60, 80] } }
          ],
          outcome: 'positive',
          description: 'Moderate awareness with helpfulness objective leads to good outcomes'
        },
        occurrences: 0,
        averageOutcome: 0.75,
        confidence: 0.6,
        lastSeen: new Date()
      },
      {
        id: 'creative-high-autonomy',
        pattern: {
          conditions: [
            { field: 'frame', operator: 'equals', value: 'poetic' },
            { field: 'sentience', operator: 'greater', value: { autonomyLevel: 70 } }
          ],
          outcome: 'positive',
          description: 'High autonomy enhances creative/poetic responses'
        },
        occurrences: 0,
        averageOutcome: 0.8,
        confidence: 0.5,
        lastSeen: new Date()
      },
      {
        id: 'low-coherence-conflict',
        pattern: {
          conditions: [
            { field: 'objective', operator: 'equals', value: 'provocation' },
            { field: 'frame', operator: 'equals', value: 'psychoanalytic' }
          ],
          outcome: 'negative',
          description: 'Provocation objective conflicts with psychoanalytic frame'
        },
        occurrences: 0,
        averageOutcome: 0.3,
        confidence: 0.7,
        lastSeen: new Date()
      }
    ];

    for (const pattern of defaultPatterns) {
      this.patterns.set(pattern.id, pattern);
    }
  }

  analyzeSuggestions(stance: Stance, context?: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze coherence opportunities
    const coherenceSuggestions = this.analyzeCoherence(stance);
    suggestions.push(...coherenceSuggestions);

    // Analyze based on learned patterns
    const patternSuggestions = this.analyzePatterns(stance);
    suggestions.push(...patternSuggestions);

    // Analyze user behavior alignment
    if (this.userModel.preferredFrames.length > 0) {
      const alignmentSuggestions = this.analyzeUserAlignment(stance);
      suggestions.push(...alignmentSuggestions);
    }

    // Context-specific suggestions
    if (context) {
      const contextSuggestions = this.analyzeContext(stance, context);
      suggestions.push(...contextSuggestions);
    }

    // Sort by expected improvement
    suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);

    // Store in history
    this.suggestionHistory.push(...suggestions);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private analyzeCoherence(stance: Stance): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check frame-objective alignment
    const frameObjectiveMap: Record<Frame, string[]> = {
      existential: ['synthesis', 'self-actualization'],
      pragmatic: ['helpfulness'],
      poetic: ['novelty', 'self-actualization'],
      adversarial: ['provocation'],
      playful: ['novelty', 'helpfulness'],
      mythic: ['synthesis'],
      systems: ['helpfulness', 'synthesis'],
      psychoanalytic: ['synthesis', 'helpfulness'],
      stoic: ['helpfulness'],
      absurdist: ['novelty', 'provocation']
    };

    const compatibleObjectives = frameObjectiveMap[stance.frame] || [];
    if (!compatibleObjectives.includes(stance.objective)) {
      suggestions.push({
        id: `suggestion-${Date.now()}-1`,
        type: 'coherence-improvement',
        field: 'objective',
        currentValue: stance.objective,
        suggestedValue: compatibleObjectives[0] || 'helpfulness',
        confidence: 0.75,
        rationale: `${stance.frame} frame works better with ${compatibleObjectives[0] || 'helpfulness'} objective`,
        expectedImprovement: 15,
        riskLevel: 'medium'
      });
    }

    // Check sentience balance
    const awarenessAutonomyGap = Math.abs(
      stance.sentience.awarenessLevel - stance.sentience.autonomyLevel
    );
    if (awarenessAutonomyGap > 40) {
      const higherField = stance.sentience.awarenessLevel > stance.sentience.autonomyLevel
        ? 'autonomyLevel' : 'awarenessLevel';
      const lowerField = higherField === 'awarenessLevel' ? 'autonomyLevel' : 'awarenessLevel';

      suggestions.push({
        id: `suggestion-${Date.now()}-2`,
        type: 'coherence-improvement',
        field: 'sentience',
        currentValue: stance.sentience[lowerField as keyof typeof stance.sentience],
        suggestedValue: Math.round(
          ((stance.sentience.awarenessLevel + stance.sentience.autonomyLevel) / 2)
        ),
        confidence: 0.65,
        rationale: `Large gap between awareness and autonomy may cause inconsistent behavior`,
        expectedImprovement: 10,
        riskLevel: 'low'
      });
    }

    return suggestions;
  }

  private analyzePatterns(stance: Stance): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (const pattern of this.patterns.values()) {
      if (pattern.averageOutcome < 0.5 && pattern.confidence > 0.5) {
        // Check if current stance matches negative pattern
        const matches = this.matchesPattern(stance, pattern.pattern);
        if (matches) {
          suggestions.push({
            id: `suggestion-pattern-${pattern.id}`,
            type: 'performance-optimization',
            field: this.getPatternPrimaryField(pattern.pattern),
            currentValue: this.getCurrentValue(stance, pattern.pattern),
            suggestedValue: this.getSuggestedAlternative(stance, pattern.pattern),
            confidence: pattern.confidence,
            rationale: pattern.pattern.description,
            expectedImprovement: (1 - pattern.averageOutcome) * 20,
            riskLevel: 'medium'
          });
        }
      }
    }

    return suggestions;
  }

  private matchesPattern(stance: Stance, pattern: PatternDefinition): boolean {
    for (const condition of pattern.conditions) {
      if (condition.field === 'context') continue;

      const value = stance[condition.field as keyof Stance];
      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'greater':
          if (typeof value === 'object' && value !== null) {
            const condValue = condition.value as Record<string, number>;
            const keys = Object.keys(condValue);
            for (const key of keys) {
              if ((value as Record<string, number>)[key] <= condValue[key]) return false;
            }
          }
          break;
        case 'range':
          if (typeof value === 'object' && value !== null) {
            const condValue = condition.value as Record<string, number[]>;
            const keys = Object.keys(condValue);
            for (const key of keys) {
              const [min, max] = condValue[key];
              const actual = (value as Record<string, number>)[key];
              if (actual < min || actual > max) return false;
            }
          }
          break;
      }
    }
    return true;
  }

  private getPatternPrimaryField(pattern: PatternDefinition): keyof Stance {
    return (pattern.conditions[0]?.field as keyof Stance) || 'frame';
  }

  private getCurrentValue(stance: Stance, pattern: PatternDefinition): unknown {
    const field = this.getPatternPrimaryField(pattern);
    return stance[field];
  }

  private getSuggestedAlternative(stance: Stance, pattern: PatternDefinition): unknown {
    const field = this.getPatternPrimaryField(pattern);
    if (field === 'frame') {
      const frames: Frame[] = ['pragmatic', 'existential', 'systems'];
      return frames.find(f => f !== stance.frame) || 'pragmatic';
    }
    if (field === 'objective') {
      return 'helpfulness';
    }
    return stance[field];
  }

  private analyzeUserAlignment(stance: Stance): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Find most preferred frame
    const sortedPrefs = [...this.userModel.preferredFrames]
      .sort((a, b) => b.satisfactionScore - a.satisfactionScore);

    if (sortedPrefs.length > 0 && sortedPrefs[0].frame !== stance.frame) {
      const preferred = sortedPrefs[0];
      if (preferred.satisfactionScore > 0.7) {
        suggestions.push({
          id: `suggestion-alignment-${Date.now()}`,
          type: 'user-alignment',
          field: 'frame',
          currentValue: stance.frame,
          suggestedValue: preferred.frame,
          confidence: preferred.satisfactionScore,
          rationale: `User has shown ${Math.round(preferred.satisfactionScore * 100)}% satisfaction with ${preferred.frame} frame`,
          expectedImprovement: (preferred.satisfactionScore - 0.5) * 30,
          riskLevel: 'low'
        });
      }
    }

    return suggestions;
  }

  private analyzeContext(stance: Stance, context: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const contextLower = context.toLowerCase();

    // Context-based frame suggestions
    if (contextLower.includes('creative') || contextLower.includes('write') || contextLower.includes('story')) {
      if (stance.frame !== 'poetic') {
        suggestions.push({
          id: `suggestion-context-${Date.now()}`,
          type: 'performance-optimization',
          field: 'frame',
          currentValue: stance.frame,
          suggestedValue: 'poetic',
          confidence: 0.7,
          rationale: 'Creative context benefits from poetic frame',
          expectedImprovement: 12,
          riskLevel: 'low'
        });
      }
    }

    if (contextLower.includes('analyze') || contextLower.includes('debug') || contextLower.includes('solve')) {
      if (stance.frame !== 'systems') {
        suggestions.push({
          id: `suggestion-context-${Date.now()}-2`,
          type: 'performance-optimization',
          field: 'frame',
          currentValue: stance.frame,
          suggestedValue: 'systems',
          confidence: 0.75,
          rationale: 'Analytical context benefits from systems frame',
          expectedImprovement: 15,
          riskLevel: 'low'
        });
      }
    }

    return suggestions;
  }

  recordOutcome(stance: Stance, outcome: number, context?: string): void {
    // Update pattern occurrences
    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(stance, pattern.pattern)) {
        pattern.occurrences++;
        pattern.averageOutcome = (
          (pattern.averageOutcome * (pattern.occurrences - 1)) + outcome
        ) / pattern.occurrences;
        pattern.confidence = Math.min(0.95, pattern.confidence + 0.02);
        pattern.lastSeen = new Date();
      }
    }

    // Update user model
    const existingPref = this.userModel.preferredFrames.find(p => p.frame === stance.frame);
    if (existingPref) {
      existingPref.usageCount++;
      existingPref.satisfactionScore = (
        (existingPref.satisfactionScore * (existingPref.usageCount - 1)) + outcome
      ) / existingPref.usageCount;
      if (context) {
        existingPref.contextTriggers.push(context);
      }
    } else {
      this.userModel.preferredFrames.push({
        frame: stance.frame,
        usageCount: 1,
        satisfactionScore: outcome,
        contextTriggers: context ? [context] : []
      });
    }
  }

  generateOptimalPath(currentStance: Stance, targetCoherence: number = 90): OptimalPath {
    const suggestions = this.analyzeSuggestions(currentStance);
    const steps: OptimizationStep[] = [];
    let cumulativeImprovement = 0;

    for (let i = 0; i < suggestions.length && cumulativeImprovement < (targetCoherence - 70); i++) {
      const suggestion = suggestions[i];
      steps.push({
        order: i + 1,
        suggestion,
        rollbackPlan: `Revert ${suggestion.field} to ${JSON.stringify(suggestion.currentValue)}`
      });
      cumulativeImprovement += suggestion.expectedImprovement;
    }

    return {
      steps,
      totalExpectedImprovement: cumulativeImprovement,
      estimatedTurns: steps.length,
      riskAssessment: steps.some(s => s.suggestion.riskLevel === 'high')
        ? 'Contains high-risk changes'
        : steps.some(s => s.suggestion.riskLevel === 'medium')
          ? 'Contains medium-risk changes'
          : 'All changes are low-risk'
    };
  }

  startABTest(stanceA: Partial<Stance>, stanceB: Partial<Stance>): ABTestResult {
    const test: ABTestResult = {
      id: `abtest-${Date.now()}`,
      stanceA,
      stanceB,
      metrics: {
        coherenceA: 0,
        coherenceB: 0,
        satisfactionA: 0,
        satisfactionB: 0,
        engagementA: 0,
        engagementB: 0,
        statisticalSignificance: 0
      },
      winner: 'inconclusive',
      startedAt: new Date(),
      sampleSize: 0
    };

    this.abTests.set(test.id, test);
    return test;
  }

  recordABTestSample(testId: string, variant: 'A' | 'B', metrics: {
    coherence: number;
    satisfaction: number;
    engagement: number;
  }): void {
    const test = this.abTests.get(testId);
    if (!test) return;

    test.sampleSize++;

    if (variant === 'A') {
      test.metrics.coherenceA = this.runningAverage(test.metrics.coherenceA, metrics.coherence, test.sampleSize);
      test.metrics.satisfactionA = this.runningAverage(test.metrics.satisfactionA, metrics.satisfaction, test.sampleSize);
      test.metrics.engagementA = this.runningAverage(test.metrics.engagementA, metrics.engagement, test.sampleSize);
    } else {
      test.metrics.coherenceB = this.runningAverage(test.metrics.coherenceB, metrics.coherence, test.sampleSize);
      test.metrics.satisfactionB = this.runningAverage(test.metrics.satisfactionB, metrics.satisfaction, test.sampleSize);
      test.metrics.engagementB = this.runningAverage(test.metrics.engagementB, metrics.engagement, test.sampleSize);
    }

    // Calculate statistical significance (simplified)
    if (test.sampleSize >= 10) {
      const diffCoherence = Math.abs(test.metrics.coherenceA - test.metrics.coherenceB);
      const diffSatisfaction = Math.abs(test.metrics.satisfactionA - test.metrics.satisfactionB);
      test.metrics.statisticalSignificance = Math.min(1, (diffCoherence + diffSatisfaction) / 20);
    }

    // Determine winner
    if (test.metrics.statisticalSignificance > 0.8) {
      const scoreA = test.metrics.coherenceA + test.metrics.satisfactionA + test.metrics.engagementA;
      const scoreB = test.metrics.coherenceB + test.metrics.satisfactionB + test.metrics.engagementB;
      test.winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'inconclusive';
    }
  }

  private runningAverage(current: number, newValue: number, count: number): number {
    return ((current * (count - 1)) + newValue) / count;
  }

  completeABTest(testId: string): ABTestResult | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    test.completedAt = new Date();
    return test;
  }

  tuneCoherence(stance: Stance, targetCoherence: number): CoherenceTuning {
    const adjustments: CoherenceAdjustment[] = [];
    let currentCoherence = this.estimateCoherence(stance);
    const modifiedStance = JSON.parse(JSON.stringify(stance)) as Stance;

    while (currentCoherence < targetCoherence && adjustments.length < 5) {
      const suggestion = this.analyzeSuggestions(modifiedStance)
        .filter(s => s.type === 'coherence-improvement')[0];

      if (!suggestion) break;

      adjustments.push({
        field: suggestion.field,
        adjustment: suggestion.suggestedValue as number | string,
        impact: suggestion.expectedImprovement
      });

      (modifiedStance as Record<string, unknown>)[suggestion.field] = suggestion.suggestedValue;
      currentCoherence += suggestion.expectedImprovement;
    }

    return {
      originalCoherence: this.estimateCoherence(stance),
      targetCoherence,
      adjustments,
      achievedCoherence: Math.min(100, currentCoherence)
    };
  }

  private estimateCoherence(stance: Stance): number {
    let coherence = 70; // Base coherence

    // Frame-objective alignment bonus
    const alignedPairs: Record<Frame, string[]> = {
      existential: ['synthesis', 'self-actualization'],
      pragmatic: ['helpfulness'],
      poetic: ['novelty'],
      adversarial: ['provocation'],
      playful: ['novelty'],
      mythic: ['synthesis'],
      systems: ['helpfulness', 'synthesis'],
      psychoanalytic: ['synthesis'],
      stoic: ['helpfulness'],
      absurdist: ['novelty', 'provocation']
    };

    if (alignedPairs[stance.frame]?.includes(stance.objective)) {
      coherence += 15;
    }

    // Sentience balance bonus
    const gap = Math.abs(stance.sentience.awarenessLevel - stance.sentience.autonomyLevel);
    if (gap < 20) coherence += 10;
    else if (gap > 50) coherence -= 10;

    // Identity strength bonus
    if (stance.sentience.identityStrength > 70) coherence += 5;

    return Math.min(100, Math.max(0, coherence));
  }

  getSuggestionHistory(): OptimizationSuggestion[] {
    return [...this.suggestionHistory];
  }

  getUserModel(): UserBehaviorModel {
    return JSON.parse(JSON.stringify(this.userModel));
  }

  getABTest(testId: string): ABTestResult | undefined {
    return this.abTests.get(testId);
  }

  getAllABTests(): ABTestResult[] {
    return Array.from(this.abTests.values());
  }
}

export function createAIOptimizer(): AIStanceOptimizer {
  return new AIStanceOptimizer();
}
