/**
 * Emotion Processor
 *
 * Processes raw face-api detections into OperatorEmotionContext.
 * Maintains emotion history for stability calculation.
 *
 * Valence mapping (negative to positive):
 * - happy, surprised -> positive
 * - sad, fearful, angry, disgusted -> negative
 * - neutral -> 0
 *
 * Arousal mapping (calm to excited):
 * - surprised, angry, fearful -> high
 * - happy, disgusted -> medium
 * - sad, neutral -> low
 */

import type { Emotion } from '../../emotion/detector.js';
import type {
  DetectedFace,
  FaceExpressions,
  OperatorEmotionContext,
  EmotionHistory,
  FaceExpressionKey
} from './types.js';
import { EXPRESSION_TO_EMOTION } from './types.js';

/**
 * EmotionProcessor - Converts face-api detections to operator context
 */
export class EmotionProcessor {
  private history: EmotionHistory[] = [];
  private maxHistory: number;

  /**
   * Valence values for each expression (-1 to 1)
   * Positive emotions have positive valence
   */
  private static readonly VALENCE_MAP: Record<FaceExpressionKey, number> = {
    happy: 0.8,
    surprised: 0.3,
    neutral: 0,
    sad: -0.7,
    fearful: -0.6,
    angry: -0.8,
    disgusted: -0.5
  };

  /**
   * Arousal values for each expression (0 to 1)
   * High-energy emotions have high arousal
   */
  private static readonly AROUSAL_MAP: Record<FaceExpressionKey, number> = {
    surprised: 0.9,
    angry: 0.85,
    fearful: 0.8,
    happy: 0.6,
    disgusted: 0.5,
    sad: 0.3,
    neutral: 0.2
  };

  constructor(maxHistory: number = 10) {
    this.maxHistory = maxHistory;
  }

  /**
   * Process detected faces into operator emotion context
   *
   * @param faces - Array of detected faces from face-api
   * @returns Processed emotion context or null if no valid detection
   */
  processDetection(faces: DetectedFace[]): OperatorEmotionContext | null {
    if (faces.length === 0) {
      return null;
    }

    // Use the face with highest detection confidence
    const primaryFace = faces.reduce((best, face) =>
      face.detection.score > best.detection.score ? face : best
    );

    // Detection confidence threshold
    if (primaryFace.detection.score < 0.5) {
      return null;
    }

    const expressions = primaryFace.expressions;
    const emotion = this.mapToEmotion(expressions);
    const valence = this.calculateValence(expressions);
    const arousal = this.calculateArousal(expressions);
    const confidence = this.getExpressionConfidence(expressions);

    // Add to history
    this.addToHistory({
      emotion,
      confidence,
      timestamp: new Date()
    });

    const stability = this.calculateStability();
    const promptContext = this.generatePromptContext(emotion, valence, arousal);
    const suggestedEmpathyBoost = this.calculateEmpathyBoost(emotion, valence, stability);

    return {
      currentEmotion: emotion,
      valence,
      arousal,
      confidence,
      stability,
      suggestedEmpathyBoost,
      promptContext,
      timestamp: new Date()
    };
  }

  /**
   * Map face-api expressions to Emotion type
   * Returns the emotion with highest confidence score
   */
  private mapToEmotion(expressions: FaceExpressions): Emotion {
    let maxScore = -1;
    let dominantExpression: FaceExpressionKey = 'neutral';

    const expressionKeys: FaceExpressionKey[] = [
      'angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'
    ];

    for (const key of expressionKeys) {
      const score = expressions[key];
      if (score > maxScore) {
        maxScore = score;
        dominantExpression = key;
      }
    }

    return EXPRESSION_TO_EMOTION[dominantExpression];
  }

  /**
   * Calculate valence from expressions (-1 to 1)
   * Weighted average of all expression valences
   */
  private calculateValence(expressions: FaceExpressions): number {
    let weightedSum = 0;
    let totalWeight = 0;

    const entries = Object.entries(expressions) as Array<[FaceExpressionKey, number]>;

    for (const [expression, score] of entries) {
      const valence = EmotionProcessor.VALENCE_MAP[expression];
      weightedSum += valence * score;
      totalWeight += score;
    }

    if (totalWeight === 0) {
      return 0;
    }

    // Clamp to [-1, 1]
    return Math.max(-1, Math.min(1, weightedSum / totalWeight));
  }

  /**
   * Calculate arousal from expressions (0 to 1)
   * Weighted average of all expression arousal levels
   */
  private calculateArousal(expressions: FaceExpressions): number {
    let weightedSum = 0;
    let totalWeight = 0;

    const entries = Object.entries(expressions) as Array<[FaceExpressionKey, number]>;

    for (const [expression, score] of entries) {
      const arousal = EmotionProcessor.AROUSAL_MAP[expression];
      weightedSum += arousal * score;
      totalWeight += score;
    }

    if (totalWeight === 0) {
      return 0.2; // Default low arousal
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, weightedSum / totalWeight));
  }

  /**
   * Get the confidence of the dominant expression
   */
  private getExpressionConfidence(expressions: FaceExpressions): number {
    const scores = Object.values(expressions);
    return Math.max(...scores);
  }

  /**
   * Calculate stability based on recent history
   * High stability = consistent emotions over time
   */
  private calculateStability(): number {
    if (this.history.length < 2) {
      return 1.0; // Assume stable with insufficient data
    }

    // Count emotion transitions
    let transitions = 0;
    for (let i = 1; i < this.history.length; i++) {
      if (this.history[i].emotion !== this.history[i - 1].emotion) {
        transitions++;
      }
    }

    // Stability inversely proportional to transitions
    const maxTransitions = this.history.length - 1;
    return 1 - (transitions / maxTransitions);
  }

  /**
   * Generate natural language context for prompts
   */
  private generatePromptContext(
    emotion: Emotion,
    valence: number,
    arousal: number
  ): string {
    const emotionDescriptions: Record<Emotion, string> = {
      joy: 'happy and positive',
      sadness: 'sad or down',
      anger: 'frustrated or angry',
      fear: 'anxious or worried',
      surprise: 'surprised or caught off guard',
      disgust: 'uncomfortable or displeased',
      trust: 'open and trusting',
      anticipation: 'eager and anticipating',
      neutral: 'calm and neutral'
    };

    const valenceDescription = valence > 0.3
      ? 'positive'
      : valence < -0.3
        ? 'negative'
        : 'neutral';

    const arousalDescription = arousal > 0.6
      ? 'high energy'
      : arousal < 0.4
        ? 'low energy'
        : 'moderate energy';

    const emotionDesc = emotionDescriptions[emotion] || 'neutral';

    return `The operator appears ${emotionDesc} with ${valenceDescription} emotional tone and ${arousalDescription} state.`;
  }

  /**
   * Suggest empathy boost based on emotional state
   * Returns 0-50 percentage boost
   *
   * Higher boosts for:
   * - Negative emotions (need more empathy)
   * - Unstable emotional states (need more care)
   * - High arousal negative states (need calming)
   */
  private calculateEmpathyBoost(
    emotion: Emotion,
    valence: number,
    stability: number
  ): number {
    let boost = 0;

    // Negative valence increases empathy need
    if (valence < 0) {
      boost += Math.abs(valence) * 20; // Up to 20%
    }

    // Specific emotions that need more empathy
    const highEmpathyEmotions: Emotion[] = ['sadness', 'fear', 'anger'];
    if (highEmpathyEmotions.includes(emotion)) {
      boost += 15;
    }

    // Unstable emotions need more careful handling
    if (stability < 0.5) {
      boost += (1 - stability) * 10; // Up to 5%
    }

    // Clamp to 0-50
    return Math.max(0, Math.min(50, Math.round(boost)));
  }

  /**
   * Add entry to emotion history
   */
  private addToHistory(entry: EmotionHistory): void {
    this.history.push(entry);

    // Trim to max size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Clear emotion history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get current history length
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Get a copy of the current history
   */
  getHistory(): EmotionHistory[] {
    return [...this.history];
  }
}
