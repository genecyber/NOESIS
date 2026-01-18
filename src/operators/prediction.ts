/**
 * Predictive Operator Suggestions (Ralph Iteration 11, Feature 4)
 *
 * Conversation trajectory analysis, next-operator prediction models,
 * proactive transformation suggestions, user behavior pattern recognition,
 * optimal path recommendation, and surprise/novelty balancing.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PredictionConfig {
  enablePrediction: boolean;
  lookbackWindow: number;  // turns to consider
  confidenceThreshold: number;
  noveltyWeight: number;
  patternWeight: number;
  intentWeight: number;
  maxSuggestions: number;
}

export interface OperatorPrediction {
  operator: string;
  confidence: number;
  reasoning: string;
  expectedOutcome: PredictedOutcome;
  alternativeOperators: string[];
}

export interface PredictedOutcome {
  frameLikely: Frame;
  driftEstimate: number;
  coherenceImpact: number;
  noveltyScore: number;
}

export interface ConversationTrajectory {
  turns: TurnSnapshot[];
  patterns: DetectedPattern[];
  momentum: TrajectoryMomentum;
  inflectionPoints: InflectionPoint[];
}

export interface TurnSnapshot {
  turn: number;
  stance: Partial<Stance>;
  operator: string | null;
  driftDelta: number;
  userIntent: UserIntent;
}

export interface DetectedPattern {
  id: string;
  name: string;
  type: PatternType;
  occurrences: number;
  lastSeen: number;  // turn number
  operators: string[];
  confidence: number;
}

export type PatternType =
  | 'repetitive'
  | 'escalating'
  | 'cycling'
  | 'converging'
  | 'diverging'
  | 'stagnant';

export interface TrajectoryMomentum {
  direction: 'transforming' | 'stabilizing' | 'neutral';
  strength: number;  // 0-1
  acceleration: number;  // positive = speeding up
  predictedTurns: number;  // turns until direction change
}

export interface InflectionPoint {
  turn: number;
  type: 'frame_shift' | 'value_spike' | 'coherence_drop' | 'pattern_break';
  magnitude: number;
  triggeringOperator: string | null;
}

export interface UserIntent {
  primary: IntentType;
  secondary: IntentType[];
  confidence: number;
  keywords: string[];
}

export type IntentType =
  | 'explore'
  | 'challenge'
  | 'understand'
  | 'create'
  | 'resolve'
  | 'play'
  | 'reflect'
  | 'conclude'
  | 'unknown';

export interface PredictionSuggestion {
  rank: number;
  prediction: OperatorPrediction;
  urgency: 'immediate' | 'soon' | 'optional';
  category: 'proactive' | 'reactive' | 'exploratory';
}

export interface OptimalPath {
  operators: string[];
  expectedTurns: number;
  finalStateEstimate: Partial<Stance>;
  riskLevel: number;
  noveltyLevel: number;
}

export interface PredictionStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  patternHits: number;
  noveltyScore: number;
}

// ============================================================================
// Operator Prediction Manager
// ============================================================================

export class OperatorPredictionManager {
  private config: PredictionConfig;
  private trajectory: ConversationTrajectory;
  private patterns: Map<string, DetectedPattern> = new Map();
  private operatorHistory: string[] = [];
  private stats: PredictionStats;
  private lastPrediction: OperatorPrediction | null = null;

  constructor(config: Partial<PredictionConfig> = {}) {
    this.config = {
      enablePrediction: true,
      lookbackWindow: 10,
      confidenceThreshold: 0.6,
      noveltyWeight: 0.3,
      patternWeight: 0.4,
      intentWeight: 0.3,
      maxSuggestions: 3,
      ...config
    };

    this.trajectory = {
      turns: [],
      patterns: [],
      momentum: {
        direction: 'neutral',
        strength: 0,
        acceleration: 0,
        predictedTurns: 0
      },
      inflectionPoints: []
    };

    this.stats = {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      patternHits: 0,
      noveltyScore: 0.5
    };
  }

  /**
   * Record a turn for trajectory analysis
   */
  recordTurn(
    stance: Stance,
    operator: string | null,
    message: string
  ): void {
    const turnNumber = this.trajectory.turns.length + 1;
    const previousTurn = this.trajectory.turns[this.trajectory.turns.length - 1];
    const driftDelta = previousTurn
      ? stance.cumulativeDrift - (previousTurn.stance.cumulativeDrift || 0)
      : 0;

    const snapshot: TurnSnapshot = {
      turn: turnNumber,
      stance: {
        frame: stance.frame,
        selfModel: stance.selfModel,
        values: stance.values,
        cumulativeDrift: stance.cumulativeDrift
      },
      operator,
      driftDelta,
      userIntent: this.inferIntent(message)
    };

    this.trajectory.turns.push(snapshot);
    if (operator) {
      this.operatorHistory.push(operator);
    }

    // Trim to lookback window
    if (this.trajectory.turns.length > this.config.lookbackWindow * 2) {
      this.trajectory.turns = this.trajectory.turns.slice(-this.config.lookbackWindow * 2);
    }

    // Update analysis
    this.detectPatterns();
    this.updateMomentum();
    this.detectInflectionPoints(snapshot);

    // Validate last prediction
    if (this.lastPrediction && operator) {
      this.validatePrediction(operator);
    }
  }

  /**
   * Infer user intent from message
   */
  private inferIntent(message: string): UserIntent {
    const messageLower = message.toLowerCase();
    const intents: Map<IntentType, number> = new Map();

    // Intent keywords mapping
    const intentKeywords: Record<IntentType, string[]> = {
      explore: ['what', 'how', 'tell me', 'explain', 'curious', 'wonder'],
      challenge: ['but', 'however', 'disagree', 'wrong', 'challenge', 'counter'],
      understand: ['why', 'meaning', 'understand', 'clarify', 'help me'],
      create: ['create', 'make', 'build', 'write', 'design', 'imagine'],
      resolve: ['solve', 'fix', 'resolve', 'answer', 'solution', 'help'],
      play: ['fun', 'joke', 'play', 'game', 'creative', 'wild'],
      reflect: ['think', 'reflect', 'consider', 'feel', 'believe', 'sense'],
      conclude: ['summary', 'conclude', 'finally', 'overall', 'in conclusion'],
      unknown: []
    };

    const matchedKeywords: string[] = [];

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (messageLower.includes(keyword)) {
          score += 0.2;
          matchedKeywords.push(keyword);
        }
      }
      intents.set(intent as IntentType, score);
    }

    // Find primary and secondary intents
    const sorted = [...intents.entries()].sort((a, b) => b[1] - a[1]);
    const primary = sorted[0][1] > 0 ? sorted[0][0] : 'unknown';
    const secondary = sorted.slice(1, 3)
      .filter(([, score]) => score > 0)
      .map(([intent]) => intent);

    return {
      primary,
      secondary,
      confidence: sorted[0][1],
      keywords: matchedKeywords
    };
  }

  /**
   * Detect conversation patterns
   */
  private detectPatterns(): void {
    const recentTurns = this.trajectory.turns.slice(-this.config.lookbackWindow);
    if (recentTurns.length < 3) return;

    // Detect repetitive pattern
    const recentOperators = recentTurns
      .map(t => t.operator)
      .filter((op): op is string => op !== null);

    const operatorCounts = new Map<string, number>();
    for (const op of recentOperators) {
      operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
    }

    for (const [op, count] of operatorCounts) {
      if (count >= 3) {
        this.addPattern({
          id: `repetitive-${op}`,
          name: `Repetitive ${op}`,
          type: 'repetitive',
          occurrences: count,
          lastSeen: this.trajectory.turns.length,
          operators: [op],
          confidence: count / recentTurns.length
        });
      }
    }

    // Detect escalating pattern
    const driftDeltas = recentTurns.map(t => t.driftDelta);
    const avgDelta = driftDeltas.reduce((a, b) => a + b, 0) / driftDeltas.length;
    const isEscalating = driftDeltas.every((d, i) =>
      i === 0 || d >= driftDeltas[i - 1] - 1
    );

    if (isEscalating && avgDelta > 2) {
      this.addPattern({
        id: 'escalating-drift',
        name: 'Escalating Drift',
        type: 'escalating',
        occurrences: 1,
        lastSeen: this.trajectory.turns.length,
        operators: recentOperators.slice(-3),
        confidence: Math.min(avgDelta / 10, 1)
      });
    }

    // Detect stagnant pattern
    const uniqueFrames = new Set(recentTurns.map(t => t.stance.frame));
    if (uniqueFrames.size === 1 && recentTurns.length > 5) {
      this.addPattern({
        id: 'stagnant-frame',
        name: 'Stagnant Frame',
        type: 'stagnant',
        occurrences: recentTurns.length,
        lastSeen: this.trajectory.turns.length,
        operators: [],
        confidence: recentTurns.length / 10
      });
    }

    // Update trajectory patterns
    this.trajectory.patterns = [...this.patterns.values()];
  }

  /**
   * Add or update a pattern
   */
  private addPattern(pattern: DetectedPattern): void {
    const existing = this.patterns.get(pattern.id);
    if (existing) {
      existing.occurrences += pattern.occurrences;
      existing.lastSeen = pattern.lastSeen;
      existing.confidence = Math.max(existing.confidence, pattern.confidence);
    } else {
      this.patterns.set(pattern.id, pattern);
    }
    this.stats.patternHits++;
  }

  /**
   * Update trajectory momentum
   */
  private updateMomentum(): void {
    const recentTurns = this.trajectory.turns.slice(-5);
    if (recentTurns.length < 2) return;

    const driftDeltas = recentTurns.map(t => t.driftDelta);
    const avgDelta = driftDeltas.reduce((a, b) => a + b, 0) / driftDeltas.length;

    // Calculate acceleration
    let acceleration = 0;
    if (driftDeltas.length >= 3) {
      const recentAvg = (driftDeltas[driftDeltas.length - 1] + driftDeltas[driftDeltas.length - 2]) / 2;
      const olderAvg = (driftDeltas[0] + driftDeltas[1]) / 2;
      acceleration = recentAvg - olderAvg;
    }

    // Determine direction
    let direction: 'transforming' | 'stabilizing' | 'neutral';
    if (avgDelta > 3) {
      direction = 'transforming';
    } else if (avgDelta < -1) {
      direction = 'stabilizing';
    } else {
      direction = 'neutral';
    }

    // Estimate turns until change
    const predictedTurns = acceleration !== 0
      ? Math.abs(avgDelta / acceleration)
      : 10;

    this.trajectory.momentum = {
      direction,
      strength: Math.min(Math.abs(avgDelta) / 10, 1),
      acceleration,
      predictedTurns: Math.round(predictedTurns)
    };
  }

  /**
   * Detect inflection points
   */
  private detectInflectionPoints(currentTurn: TurnSnapshot): void {
    const previousTurn = this.trajectory.turns[this.trajectory.turns.length - 2];
    if (!previousTurn) return;

    // Frame shift
    if (currentTurn.stance.frame !== previousTurn.stance.frame) {
      this.trajectory.inflectionPoints.push({
        turn: currentTurn.turn,
        type: 'frame_shift',
        magnitude: 0.8,
        triggeringOperator: currentTurn.operator
      });
    }

    // Coherence drop
    if (currentTurn.driftDelta > 10) {
      this.trajectory.inflectionPoints.push({
        turn: currentTurn.turn,
        type: 'coherence_drop',
        magnitude: currentTurn.driftDelta / 20,
        triggeringOperator: currentTurn.operator
      });
    }

    // Trim old inflection points
    if (this.trajectory.inflectionPoints.length > 20) {
      this.trajectory.inflectionPoints = this.trajectory.inflectionPoints.slice(-10);
    }
  }

  /**
   * Predict next operator
   */
  predictNextOperator(
    currentStance: Stance,
    lastMessage: string
  ): PredictionSuggestion[] {
    if (!this.config.enablePrediction) return [];

    const suggestions: PredictionSuggestion[] = [];
    const intent = this.inferIntent(lastMessage);

    // Pattern-based predictions
    const patternPredictions = this.predictFromPatterns();

    // Intent-based predictions
    const intentPredictions = this.predictFromIntent(intent);

    // Momentum-based predictions
    const momentumPredictions = this.predictFromMomentum(currentStance);

    // Combine and score predictions
    const allPredictions = [
      ...patternPredictions.map(p => ({ ...p, weight: this.config.patternWeight })),
      ...intentPredictions.map(p => ({ ...p, weight: this.config.intentWeight })),
      ...momentumPredictions.map(p => ({ ...p, weight: 1 - this.config.patternWeight - this.config.intentWeight }))
    ];

    // Merge duplicate operators and calculate final confidence
    const merged = new Map<string, OperatorPrediction>();
    for (const { prediction, weight } of allPredictions) {
      const existing = merged.get(prediction.operator);
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + prediction.confidence * weight);
        existing.reasoning += '; ' + prediction.reasoning;
      } else {
        merged.set(prediction.operator, {
          ...prediction,
          confidence: prediction.confidence * weight
        });
      }
    }

    // Sort and filter by confidence
    const sorted = [...merged.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .filter(p => p.confidence >= this.config.confidenceThreshold);

    // Create suggestions
    for (let i = 0; i < Math.min(sorted.length, this.config.maxSuggestions); i++) {
      const prediction = sorted[i];
      suggestions.push({
        rank: i + 1,
        prediction,
        urgency: this.determineUrgency(prediction, currentStance),
        category: this.determineCategory(prediction)
      });
    }

    // Apply novelty balancing
    this.applyNoveltyBalance(suggestions);

    // Record for validation
    if (suggestions.length > 0) {
      this.lastPrediction = suggestions[0].prediction;
      this.stats.totalPredictions++;
    }

    return suggestions;
  }

  /**
   * Predict from patterns
   */
  private predictFromPatterns(): { prediction: OperatorPrediction; weight: number }[] {
    const predictions: { prediction: OperatorPrediction; weight: number }[] = [];

    for (const pattern of this.patterns.values()) {
      let operator: string;
      let reasoning: string;

      switch (pattern.type) {
        case 'repetitive':
          operator = 'DIVERSIFY';
          reasoning = `Repetitive ${pattern.operators[0]} detected - suggest diversification`;
          break;
        case 'escalating':
          operator = 'STABILIZE';
          reasoning = 'Escalating drift detected - suggest stabilization';
          break;
        case 'stagnant':
          operator = 'REFRAME';
          reasoning = 'Stagnant frame detected - suggest reframing';
          break;
        case 'converging':
          operator = 'SYNTHESIZE';
          reasoning = 'Converging trajectory - suggest synthesis';
          break;
        default:
          operator = 'EXPLORE';
          reasoning = 'Pattern suggests exploration';
      }

      predictions.push({
        prediction: {
          operator,
          confidence: pattern.confidence,
          reasoning,
          expectedOutcome: this.estimateOutcome(operator),
          alternativeOperators: []
        },
        weight: pattern.confidence
      });
    }

    return predictions;
  }

  /**
   * Predict from intent
   */
  private predictFromIntent(intent: UserIntent): { prediction: OperatorPrediction; weight: number }[] {
    const intentOperatorMap: Record<IntentType, string> = {
      explore: 'EXPLORE',
      challenge: 'CHALLENGE',
      understand: 'DEEPEN',
      create: 'CREATE',
      resolve: 'RESOLVE',
      play: 'PLAY',
      reflect: 'REFLECT',
      conclude: 'SYNTHESIZE',
      unknown: 'EXPLORE'
    };

    const operator = intentOperatorMap[intent.primary];

    return [{
      prediction: {
        operator,
        confidence: intent.confidence,
        reasoning: `User intent detected: ${intent.primary}`,
        expectedOutcome: this.estimateOutcome(operator),
        alternativeOperators: intent.secondary.map(i => intentOperatorMap[i])
      },
      weight: intent.confidence
    }];
  }

  /**
   * Predict from momentum
   */
  private predictFromMomentum(stance: Stance): { prediction: OperatorPrediction; weight: number }[] {
    const momentum = this.trajectory.momentum;
    let operator: string;
    let reasoning: string;

    switch (momentum.direction) {
      case 'transforming':
        if (momentum.strength > 0.7) {
          operator = 'STABILIZE';
          reasoning = 'High transformation momentum - may need stabilization';
        } else {
          operator = 'CONTINUE';
          reasoning = 'Moderate transformation momentum - continue current direction';
        }
        break;
      case 'stabilizing':
        operator = 'EXPLORE';
        reasoning = 'Stabilizing momentum - opportunity to explore';
        break;
      default:
        operator = stance.cumulativeDrift < 30 ? 'DEEPEN' : 'EXPLORE';
        reasoning = 'Neutral momentum - space for development';
    }

    return [{
      prediction: {
        operator,
        confidence: momentum.strength,
        reasoning,
        expectedOutcome: this.estimateOutcome(operator),
        alternativeOperators: []
      },
      weight: momentum.strength
    }];
  }

  /**
   * Estimate outcome for operator
   */
  private estimateOutcome(operator: string): PredictedOutcome {
    // Simplified outcome estimation based on operator type
    const outcomes: Record<string, PredictedOutcome> = {
      EXPLORE: { frameLikely: 'pragmatic', driftEstimate: 5, coherenceImpact: -3, noveltyScore: 0.7 },
      DEEPEN: { frameLikely: 'existential', driftEstimate: 8, coherenceImpact: -5, noveltyScore: 0.5 },
      STABILIZE: { frameLikely: 'pragmatic', driftEstimate: -5, coherenceImpact: 10, noveltyScore: 0.2 },
      REFRAME: { frameLikely: 'poetic', driftEstimate: 10, coherenceImpact: -8, noveltyScore: 0.8 },
      CHALLENGE: { frameLikely: 'adversarial', driftEstimate: 12, coherenceImpact: -10, noveltyScore: 0.6 },
      SYNTHESIZE: { frameLikely: 'systems', driftEstimate: 3, coherenceImpact: 5, noveltyScore: 0.4 },
      REFLECT: { frameLikely: 'psychoanalytic', driftEstimate: 4, coherenceImpact: 0, noveltyScore: 0.5 },
      DIVERSIFY: { frameLikely: 'playful', driftEstimate: 7, coherenceImpact: -4, noveltyScore: 0.9 },
      PLAY: { frameLikely: 'playful', driftEstimate: 6, coherenceImpact: -2, noveltyScore: 0.8 },
      CREATE: { frameLikely: 'poetic', driftEstimate: 8, coherenceImpact: -5, noveltyScore: 0.9 },
      RESOLVE: { frameLikely: 'pragmatic', driftEstimate: 2, coherenceImpact: 3, noveltyScore: 0.3 },
      CONTINUE: { frameLikely: 'pragmatic', driftEstimate: 2, coherenceImpact: 0, noveltyScore: 0.2 }
    };

    return outcomes[operator] || outcomes.EXPLORE;
  }

  /**
   * Determine urgency of suggestion
   */
  private determineUrgency(
    prediction: OperatorPrediction,
    stance: Stance
  ): 'immediate' | 'soon' | 'optional' {
    if (stance.cumulativeDrift > 60 && prediction.operator === 'STABILIZE') {
      return 'immediate';
    }
    if (prediction.confidence > 0.8) {
      return 'soon';
    }
    return 'optional';
  }

  /**
   * Determine category of prediction
   */
  private determineCategory(
    prediction: OperatorPrediction
  ): 'proactive' | 'reactive' | 'exploratory' {
    const proactive = ['DEEPEN', 'EXPLORE', 'CREATE', 'PLAY'];
    const reactive = ['STABILIZE', 'RESOLVE', 'DIVERSIFY'];

    if (proactive.includes(prediction.operator)) return 'proactive';
    if (reactive.includes(prediction.operator)) return 'reactive';
    return 'exploratory';
  }

  /**
   * Apply novelty balancing to suggestions
   */
  private applyNoveltyBalance(suggestions: PredictionSuggestion[]): void {
    // Boost rarely used operators
    const recentOperators = this.operatorHistory.slice(-10);

    for (const suggestion of suggestions) {
      const recentUses = recentOperators.filter(
        op => op === suggestion.prediction.operator
      ).length;

      if (recentUses === 0) {
        suggestion.prediction.confidence *= (1 + this.config.noveltyWeight);
        suggestion.prediction.reasoning += ' (novelty boost)';
      } else if (recentUses >= 3) {
        suggestion.prediction.confidence *= (1 - this.config.noveltyWeight);
        suggestion.prediction.reasoning += ' (familiarity penalty)';
      }
    }

    // Re-sort by confidence
    suggestions.sort((a, b) => b.prediction.confidence - a.prediction.confidence);
    suggestions.forEach((s, i) => s.rank = i + 1);
  }

  /**
   * Calculate optimal path to target state
   */
  calculateOptimalPath(
    currentStance: Stance,
    targetFrame: Frame,
    maxTurns: number = 5
  ): OptimalPath {
    const operators: string[] = [];
    let simulatedStance = { ...currentStance };
    let totalDrift = currentStance.cumulativeDrift;
    let totalRisk = 0;
    let totalNovelty = 0;

    // Simple greedy path finding
    for (let turn = 0; turn < maxTurns; turn++) {
      if (simulatedStance.frame === targetFrame) break;

      // Choose operator that moves toward target
      let bestOperator = 'REFRAME';
      let bestOutcome = this.estimateOutcome(bestOperator);

      operators.push(bestOperator);
      totalDrift += bestOutcome.driftEstimate;
      totalRisk += Math.max(0, -bestOutcome.coherenceImpact) / 10;
      totalNovelty += bestOutcome.noveltyScore;

      // Simulate frame change
      simulatedStance.frame = bestOutcome.frameLikely;
    }

    return {
      operators,
      expectedTurns: operators.length,
      finalStateEstimate: {
        frame: simulatedStance.frame,
        cumulativeDrift: totalDrift
      },
      riskLevel: totalRisk / Math.max(operators.length, 1),
      noveltyLevel: totalNovelty / Math.max(operators.length, 1)
    };
  }

  /**
   * Validate last prediction against actual operator
   */
  private validatePrediction(actualOperator: string): void {
    if (this.lastPrediction && this.lastPrediction.operator === actualOperator) {
      this.stats.correctPredictions++;
    }
    this.stats.accuracy = this.stats.correctPredictions / Math.max(this.stats.totalPredictions, 1);
    this.lastPrediction = null;
  }

  /**
   * Get trajectory
   */
  getTrajectory(): ConversationTrajectory {
    return { ...this.trajectory };
  }

  /**
   * Get detected patterns
   */
  getPatterns(): DetectedPattern[] {
    return [...this.patterns.values()];
  }

  /**
   * Get statistics
   */
  getStats(): PredictionStats {
    return { ...this.stats };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.trajectory = {
      turns: [],
      patterns: [],
      momentum: {
        direction: 'neutral',
        strength: 0,
        acceleration: 0,
        predictedTurns: 0
      },
      inflectionPoints: []
    };
    this.patterns.clear();
    this.operatorHistory = [];
    this.lastPrediction = null;
    this.stats = {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      patternHits: 0,
      noveltyScore: 0.5
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const operatorPrediction = new OperatorPredictionManager();
