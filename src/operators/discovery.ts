/**
 * Dynamic Operator Discovery - Ralph Iteration 6 Feature 4
 *
 * Allows the LLM to suggest new operators based on conversation context,
 * with A/B testing and effectiveness tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Stance,
  StanceDelta,
  TriggerType,
  OperatorName,
  ConversationMessage
} from '../types/index.js';

/**
 * Operator suggestion from analysis
 */
export interface OperatorSuggestion {
  id: string;
  name: string;
  description: string;
  category: 'frame' | 'value' | 'identity' | 'meta' | 'custom';
  triggers: TriggerType[];
  rationale: string;
  confidence: number;  // 0-1
  basedOnPatterns: string[];
  proposedEffect: StanceDelta;
  createdAt: Date;
}

/**
 * Operator variant for A/B testing
 */
export interface OperatorVariant {
  id: string;
  baseOperator: OperatorName | string;
  variantName: string;
  modification: string;
  effect: StanceDelta;
  testGroup: 'A' | 'B';
  usageCount: number;
  totalEffectiveness: number;
  createdAt: Date;
}

/**
 * A/B test definition
 */
export interface ABTest {
  id: string;
  name: string;
  variantA: OperatorVariant;
  variantB: OperatorVariant;
  startedAt: Date;
  completedAt?: Date;
  minSamples: number;
  currentSamples: number;
  winner?: 'A' | 'B' | 'tie';
  significance?: number;
}

/**
 * Conversation pattern for operator suggestion
 */
export interface ConversationPattern {
  type: 'repetition' | 'stagnation' | 'topic_gap' | 'value_conflict' | 'exploration_need';
  description: string;
  evidence: string[];
  suggestedOperators: string[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * Operator effectiveness feedback
 */
export interface OperatorFeedback {
  operatorId: string;
  conversationId: string;
  timestamp: Date;
  effectivenessScore: number;  // 0-100
  transformationAchieved: number;
  coherenceMaintained: number;
  userSatisfaction?: number;
  notes?: string;
}

/**
 * Dynamic Operator Discovery Manager
 */
class OperatorDiscoveryManager {
  private suggestions: Map<string, OperatorSuggestion> = new Map();
  private variants: Map<string, OperatorVariant> = new Map();
  private tests: Map<string, ABTest> = new Map();
  private feedback: OperatorFeedback[] = [];
  private patternHistory: ConversationPattern[] = [];

  /**
   * Analyze conversation for patterns that might need new operators
   */
  analyzeConversation(
    messages: ConversationMessage[],
    stance: Stance
  ): ConversationPattern[] {
    const patterns: ConversationPattern[] = [];

    // Check for repetition patterns
    const repetitionPattern = this.detectRepetition(messages);
    if (repetitionPattern) patterns.push(repetitionPattern);

    // Check for stagnation
    const stagnationPattern = this.detectStagnation(messages, stance);
    if (stagnationPattern) patterns.push(stagnationPattern);

    // Check for unexplored topics
    const topicGapPattern = this.detectTopicGaps(messages);
    if (topicGapPattern) patterns.push(topicGapPattern);

    // Check for value conflicts
    const valueConflictPattern = this.detectValueConflicts(messages, stance);
    if (valueConflictPattern) patterns.push(valueConflictPattern);

    // Store pattern history
    this.patternHistory.push(...patterns);
    if (this.patternHistory.length > 100) {
      this.patternHistory = this.patternHistory.slice(-100);
    }

    return patterns;
  }

  /**
   * Detect repetitive patterns in messages
   */
  private detectRepetition(messages: ConversationMessage[]): ConversationPattern | null {
    if (messages.length < 5) return null;

    const recentMessages = messages.slice(-10);
    const phrases = new Map<string, number>();

    // Extract and count significant phrases
    for (const msg of recentMessages) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrase.length > 10) {
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    }

    // Find repeated phrases
    const repeated = Array.from(phrases.entries())
      .filter(([_, count]) => count >= 3)
      .map(([phrase]) => phrase);

    if (repeated.length === 0) return null;

    return {
      type: 'repetition',
      description: 'Detected repetitive patterns in conversation',
      evidence: repeated.slice(0, 3),
      suggestedOperators: ['QuestionInvert', 'Reframe', 'GenerateAntithesis'],
      severity: repeated.length > 5 ? 'high' : 'medium'
    };
  }

  /**
   * Detect conversation stagnation
   */
  private detectStagnation(
    messages: ConversationMessage[],
    stance: Stance
  ): ConversationPattern | null {
    // Check if stance hasn't changed much
    if (stance.turnsSinceLastShift < 5) return null;

    // Check for low transformation signals
    const recentAssistant = messages
      .filter(m => m.role === 'assistant')
      .slice(-5);

    const avgLength = recentAssistant.reduce((sum, m) =>
      sum + m.content.length, 0) / recentAssistant.length;

    // Short, uniform responses may indicate stagnation
    if (avgLength > 500) return null;

    return {
      type: 'stagnation',
      description: 'Conversation appears to be stagnating',
      evidence: [
        `${stance.turnsSinceLastShift} turns since last shift`,
        `Average response length: ${Math.round(avgLength)} chars`
      ],
      suggestedOperators: ['PersonaMorph', 'ValueShift', 'ConstraintRelax'],
      severity: stance.turnsSinceLastShift > 10 ? 'high' : 'medium'
    };
  }

  /**
   * Detect topic gaps
   */
  private detectTopicGaps(messages: ConversationMessage[]): ConversationPattern | null {
    // Extract mentioned topics/keywords
    const topicKeywords = new Set<string>();
    const questionKeywords = new Set<string>();

    for (const msg of messages) {
      // Extract keywords from questions
      const questions = msg.content.match(/\b(\w+)\?/g) || [];
      questions.forEach(q => questionKeywords.add(q.toLowerCase().replace('?', '')));

      // Extract significant words
      const words = msg.content.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 5);
      words.forEach(w => topicKeywords.add(w));
    }

    // Find questions that weren't addressed
    const unanswered = Array.from(questionKeywords)
      .filter(q => !topicKeywords.has(q));

    if (unanswered.length < 2) return null;

    return {
      type: 'topic_gap',
      description: 'Some topics may not have been fully explored',
      evidence: unanswered.slice(0, 3),
      suggestedOperators: ['SynthesizeDialectic', 'SentienceDeepen'],
      severity: 'low'
    };
  }

  /**
   * Detect value conflicts in conversation
   */
  private detectValueConflicts(
    _messages: ConversationMessage[],
    stance: Stance
  ): ConversationPattern | null {
    // Look for conflicting value signals
    const conflicts: string[] = [];

    // High curiosity but low risk tolerance
    if (stance.values.curiosity > 70 && stance.values.risk < 30) {
      conflicts.push('High curiosity conflicts with low risk tolerance');
    }

    // High provocation but high empathy
    if (stance.values.provocation > 60 && stance.values.empathy > 70) {
      conflicts.push('Provocative stance may conflict with empathetic approach');
    }

    // High novelty but high certainty
    if (stance.values.novelty > 70 && stance.values.certainty > 70) {
      conflicts.push('Seeking novelty while maintaining high certainty');
    }

    if (conflicts.length === 0) return null;

    return {
      type: 'value_conflict',
      description: 'Internal value tensions detected',
      evidence: conflicts,
      suggestedOperators: ['ContradictAndIntegrate', 'ValueShift', 'SynthesizeDialectic'],
      severity: 'medium'
    };
  }

  /**
   * Suggest new operator based on patterns
   */
  suggestOperator(patterns: ConversationPattern[]): OperatorSuggestion | null {
    if (patterns.length === 0) return null;

    // Prioritize by severity
    const sortedPatterns = [...patterns].sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    const primaryPattern = sortedPatterns[0];

    const suggestion: OperatorSuggestion = {
      id: uuidv4(),
      name: `Auto_${primaryPattern.type}_Resolver`,
      description: `Automatically generated operator to address ${primaryPattern.type} patterns`,
      category: 'meta',
      triggers: this.patternToTriggers(primaryPattern),
      rationale: primaryPattern.description,
      confidence: primaryPattern.severity === 'high' ? 0.8
        : primaryPattern.severity === 'medium' ? 0.6
        : 0.4,
      basedOnPatterns: [primaryPattern.type],
      proposedEffect: this.patternToEffect(primaryPattern),
      createdAt: new Date()
    };

    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  /**
   * Convert pattern to trigger types
   */
  private patternToTriggers(pattern: ConversationPattern): TriggerType[] {
    switch (pattern.type) {
      case 'repetition':
        return ['stuck_loop', 'boredom_signal'];
      case 'stagnation':
        return ['boredom_signal', 'operator_fatigue'];
      case 'topic_gap':
        return ['novelty_request', 'creative_request'];
      case 'value_conflict':
        return ['value_conflict', 'dialectic_requested'];
      default:
        return ['meta_question'];
    }
  }

  /**
   * Convert pattern to stance effect
   */
  private patternToEffect(pattern: ConversationPattern): StanceDelta {
    switch (pattern.type) {
      case 'repetition':
        return {
          values: { novelty: 70, provocation: 50 }
        };
      case 'stagnation':
        return {
          selfModel: 'provocateur',
          values: { risk: 60, curiosity: 75 }
        };
      case 'topic_gap':
        return {
          values: { synthesis: 70, curiosity: 65 }
        };
      case 'value_conflict':
        return {
          values: { synthesis: 80 }
        };
      default:
        return {};
    }
  }

  /**
   * Create A/B test for operator variant
   */
  createABTest(
    name: string,
    baseOperator: OperatorName | string,
    variantAMod: { name: string; modification: string; effect: StanceDelta },
    variantBMod: { name: string; modification: string; effect: StanceDelta },
    minSamples: number = 20
  ): ABTest {
    const variantA: OperatorVariant = {
      id: uuidv4(),
      baseOperator,
      variantName: variantAMod.name,
      modification: variantAMod.modification,
      effect: variantAMod.effect,
      testGroup: 'A',
      usageCount: 0,
      totalEffectiveness: 0,
      createdAt: new Date()
    };

    const variantB: OperatorVariant = {
      id: uuidv4(),
      baseOperator,
      variantName: variantBMod.name,
      modification: variantBMod.modification,
      effect: variantBMod.effect,
      testGroup: 'B',
      usageCount: 0,
      totalEffectiveness: 0,
      createdAt: new Date()
    };

    this.variants.set(variantA.id, variantA);
    this.variants.set(variantB.id, variantB);

    const test: ABTest = {
      id: uuidv4(),
      name,
      variantA,
      variantB,
      startedAt: new Date(),
      minSamples,
      currentSamples: 0
    };

    this.tests.set(test.id, test);
    return test;
  }

  /**
   * Get variant for A/B test (random assignment)
   */
  getTestVariant(testId: string): OperatorVariant | null {
    const test = this.tests.get(testId);
    if (!test || test.completedAt) return null;

    // Simple random assignment
    return Math.random() < 0.5 ? test.variantA : test.variantB;
  }

  /**
   * Record A/B test result
   */
  recordTestResult(testId: string, variantId: string, effectiveness: number): void {
    const test = this.tests.get(testId);
    if (!test || test.completedAt) return;

    const variant = variantId === test.variantA.id ? test.variantA : test.variantB;
    variant.usageCount++;
    variant.totalEffectiveness += effectiveness;

    test.currentSamples++;

    // Check if test is complete
    if (test.currentSamples >= test.minSamples) {
      this.completeTest(testId);
    }
  }

  /**
   * Complete an A/B test
   */
  private completeTest(testId: string): void {
    const test = this.tests.get(testId);
    if (!test) return;

    test.completedAt = new Date();

    const avgA = test.variantA.usageCount > 0
      ? test.variantA.totalEffectiveness / test.variantA.usageCount
      : 0;
    const avgB = test.variantB.usageCount > 0
      ? test.variantB.totalEffectiveness / test.variantB.usageCount
      : 0;

    const diff = Math.abs(avgA - avgB);
    const threshold = 5; // Minimum meaningful difference

    if (diff < threshold) {
      test.winner = 'tie';
    } else if (avgA > avgB) {
      test.winner = 'A';
    } else {
      test.winner = 'B';
    }

    // Simple significance estimate
    test.significance = Math.min(1, diff / 20);
  }

  /**
   * Record operator feedback
   */
  recordFeedback(feedback: Omit<OperatorFeedback, 'timestamp'>): void {
    this.feedback.push({
      ...feedback,
      timestamp: new Date()
    });

    // Limit feedback history
    if (this.feedback.length > 1000) {
      this.feedback = this.feedback.slice(-1000);
    }
  }

  /**
   * Get operator effectiveness summary
   */
  getOperatorEffectiveness(operatorId?: string): Map<string, {
    avgEffectiveness: number;
    usageCount: number;
    trend: 'improving' | 'stable' | 'declining';
  }> {
    const effectiveness = new Map<string, {
      scores: number[];
      timestamps: number[];
    }>();

    // Collect feedback by operator
    const relevantFeedback = operatorId
      ? this.feedback.filter(f => f.operatorId === operatorId)
      : this.feedback;

    for (const fb of relevantFeedback) {
      if (!effectiveness.has(fb.operatorId)) {
        effectiveness.set(fb.operatorId, { scores: [], timestamps: [] });
      }
      const data = effectiveness.get(fb.operatorId)!;
      data.scores.push(fb.effectivenessScore);
      data.timestamps.push(fb.timestamp.getTime());
    }

    // Calculate summaries
    const summaries = new Map<string, {
      avgEffectiveness: number;
      usageCount: number;
      trend: 'improving' | 'stable' | 'declining';
    }>();

    for (const [opId, data] of effectiveness) {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;

      // Calculate trend from recent vs older scores
      const midpoint = Math.floor(data.scores.length / 2);
      const olderAvg = data.scores.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
      const recentAvg = data.scores.slice(midpoint).reduce((a, b) => a + b, 0) / (data.scores.length - midpoint);

      let trend: 'improving' | 'stable' | 'declining';
      if (recentAvg > olderAvg + 5) {
        trend = 'improving';
      } else if (recentAvg < olderAvg - 5) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      summaries.set(opId, {
        avgEffectiveness: avg,
        usageCount: data.scores.length,
        trend
      });
    }

    return summaries;
  }

  /**
   * List suggestions
   */
  listSuggestions(): OperatorSuggestion[] {
    return Array.from(this.suggestions.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * List active A/B tests
   */
  listTests(includeCompleted: boolean = false): ABTest[] {
    return Array.from(this.tests.values())
      .filter(t => includeCompleted || !t.completedAt)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Get discovery status
   */
  getStatus(): {
    suggestionCount: number;
    activeTests: number;
    completedTests: number;
    feedbackCount: number;
    patternsDetected: number;
  } {
    const tests = Array.from(this.tests.values());
    return {
      suggestionCount: this.suggestions.size,
      activeTests: tests.filter(t => !t.completedAt).length,
      completedTests: tests.filter(t => t.completedAt).length,
      feedbackCount: this.feedback.length,
      patternsDetected: this.patternHistory.length
    };
  }
}

// Singleton instance
export const operatorDiscovery = new OperatorDiscoveryManager();
