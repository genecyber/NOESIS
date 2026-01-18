/**
 * Emotional Tone Detection (Ralph Iteration 10, Feature 5)
 *
 * Real-time sentiment analysis, emotional trajectory mapping,
 * tone-aware response adaptation, and mood-based operator selection.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface EmotionConfig {
  enableDetection: boolean;
  trackTrajectory: boolean;
  adaptResponses: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  historyLength: number;
}

export interface EmotionalState {
  primary: Emotion;
  secondary: Emotion | null;
  intensity: number;  // 0-1
  valence: number;    // -1 to 1 (negative to positive)
  arousal: number;    // 0-1 (calm to excited)
  confidence: number; // 0-1
  timestamp: Date;
}

export type Emotion =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'trust'
  | 'anticipation'
  | 'neutral';

export interface EmotionAnalysis {
  text: string;
  state: EmotionalState;
  indicators: EmotionIndicator[];
  trajectory: TrajectoryPoint[];
}

export interface EmotionIndicator {
  type: IndicatorType;
  text: string;
  emotion: Emotion;
  weight: number;
  position: number;
}

export type IndicatorType = 'word' | 'phrase' | 'punctuation' | 'pattern' | 'context';

export interface TrajectoryPoint {
  timestamp: Date;
  state: EmotionalState;
  trigger?: string;
}

export interface EmotionalResonance {
  userEmotion: Emotion;
  suggestedFrame: Frame;
  operatorSuggestions: string[];
  toneGuidance: ToneGuidance;
}

export interface ToneGuidance {
  formality: 'formal' | 'casual' | 'neutral';
  warmth: number;  // 0-1
  directness: number;  // 0-1
  energyLevel: 'calm' | 'moderate' | 'energetic';
  empathyLevel: number;  // 0-1
}

export interface MoodProfile {
  baseline: EmotionalState;
  currentMood: Emotion;
  stability: number;  // 0-1
  triggers: MoodTrigger[];
}

export interface MoodTrigger {
  pattern: string;
  emotion: Emotion;
  intensity: number;
}

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  compound: number;  // -1 to 1
}

export interface EmotionStats {
  analysesPerformed: number;
  averageConfidence: number;
  emotionDistribution: Record<Emotion, number>;
  averageValence: number;
  trajectoryLength: number;
}

// ============================================================================
// Emotion Detector
// ============================================================================

export class EmotionDetector {
  private config: EmotionConfig;
  private trajectory: TrajectoryPoint[] = [];
  private moodProfile: MoodProfile | null = null;
  private emotionLexicon: Map<string, { emotion: Emotion; weight: number }> = new Map();
  private stats: EmotionStats;

  constructor(config: Partial<EmotionConfig> = {}) {
    this.config = {
      enableDetection: true,
      trackTrajectory: true,
      adaptResponses: true,
      sensitivityLevel: 'medium',
      historyLength: 100,
      ...config
    };

    this.stats = {
      analysesPerformed: 0,
      averageConfidence: 0,
      emotionDistribution: {
        joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
        disgust: 0, trust: 0, anticipation: 0, neutral: 0
      },
      averageValence: 0,
      trajectoryLength: 0
    };

    this.initializeEmotionLexicon();
  }

  /**
   * Initialize emotion lexicon
   */
  private initializeEmotionLexicon(): void {
    // Joy indicators
    const joyWords = ['happy', 'joy', 'excited', 'wonderful', 'amazing', 'great', 'love', 'fantastic', 'delighted', 'thrilled'];
    for (const word of joyWords) {
      this.emotionLexicon.set(word, { emotion: 'joy', weight: 0.8 });
    }

    // Sadness indicators
    const sadWords = ['sad', 'unhappy', 'depressed', 'disappointed', 'heartbroken', 'miserable', 'grief', 'sorrow', 'lonely', 'hopeless'];
    for (const word of sadWords) {
      this.emotionLexicon.set(word, { emotion: 'sadness', weight: 0.8 });
    }

    // Anger indicators
    const angerWords = ['angry', 'furious', 'annoyed', 'frustrated', 'irritated', 'mad', 'rage', 'outraged', 'hostile', 'bitter'];
    for (const word of angerWords) {
      this.emotionLexicon.set(word, { emotion: 'anger', weight: 0.8 });
    }

    // Fear indicators
    const fearWords = ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'dread', 'frightened', 'uneasy'];
    for (const word of fearWords) {
      this.emotionLexicon.set(word, { emotion: 'fear', weight: 0.8 });
    }

    // Surprise indicators
    const surpriseWords = ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'unexpected', 'wow', 'incredible', 'unbelievable'];
    for (const word of surpriseWords) {
      this.emotionLexicon.set(word, { emotion: 'surprise', weight: 0.7 });
    }

    // Trust indicators
    const trustWords = ['trust', 'believe', 'confident', 'reliable', 'honest', 'sincere', 'faith', 'loyal', 'dependable'];
    for (const word of trustWords) {
      this.emotionLexicon.set(word, { emotion: 'trust', weight: 0.7 });
    }

    // Anticipation indicators
    const anticipationWords = ['expect', 'anticipate', 'hope', 'eager', 'curious', 'looking forward', 'excited about', 'waiting'];
    for (const word of anticipationWords) {
      this.emotionLexicon.set(word, { emotion: 'anticipation', weight: 0.7 });
    }
  }

  /**
   * Analyze text for emotional content
   */
  analyze(text: string): EmotionAnalysis {
    if (!this.config.enableDetection) {
      return this.createNeutralAnalysis(text);
    }

    const indicators = this.extractIndicators(text);
    const state = this.calculateEmotionalState(indicators, text);

    // Track trajectory
    if (this.config.trackTrajectory) {
      this.addToTrajectory(state);
    }

    // Update stats
    this.updateStats(state);

    return {
      text,
      state,
      indicators,
      trajectory: this.getRecentTrajectory(10)
    };
  }

  /**
   * Extract emotion indicators from text
   */
  private extractIndicators(text: string): EmotionIndicator[] {
    const indicators: EmotionIndicator[] = [];
    const words = text.toLowerCase().split(/\s+/);

    // Check lexicon matches
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      const lexiconEntry = this.emotionLexicon.get(word);

      if (lexiconEntry) {
        indicators.push({
          type: 'word',
          text: word,
          emotion: lexiconEntry.emotion,
          weight: lexiconEntry.weight,
          position: i
        });
      }
    }

    // Check punctuation patterns
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 0) {
      indicators.push({
        type: 'punctuation',
        text: '!',
        emotion: exclamations > 2 ? 'anger' : 'surprise',
        weight: Math.min(exclamations * 0.2, 0.6),
        position: -1
      });
    }

    const questions = (text.match(/\?/g) || []).length;
    if (questions > 1) {
      indicators.push({
        type: 'punctuation',
        text: '?',
        emotion: 'fear',  // Multiple questions may indicate anxiety
        weight: Math.min(questions * 0.15, 0.4),
        position: -1
      });
    }

    // Check for all caps (shouting)
    const capsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
    if (capsWords.length > 0) {
      indicators.push({
        type: 'pattern',
        text: 'ALL CAPS',
        emotion: 'anger',
        weight: Math.min(capsWords.length * 0.2, 0.5),
        position: -1
      });
    }

    return indicators;
  }

  /**
   * Calculate emotional state from indicators
   */
  private calculateEmotionalState(indicators: EmotionIndicator[], _text: string): EmotionalState {
    if (indicators.length === 0) {
      return this.createNeutralState();
    }

    // Aggregate emotions by weight
    const emotionScores: Record<Emotion, number> = {
      joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
      disgust: 0, trust: 0, anticipation: 0, neutral: 0.1
    };

    for (const indicator of indicators) {
      emotionScores[indicator.emotion] += indicator.weight;
    }

    // Find primary and secondary emotions
    const sorted = Object.entries(emotionScores)
      .sort(([, a], [, b]) => b - a) as Array<[Emotion, number]>;

    const primary = sorted[0][0];
    const secondary = sorted[1][1] > 0.3 ? sorted[1][0] : null;

    // Calculate valence and arousal
    const valence = this.calculateValence(primary, sorted[0][1]);
    const arousal = this.calculateArousal(primary, sorted[0][1]);
    const intensity = Math.min(sorted[0][1], 1);

    // Confidence based on indicator count and consistency
    const confidence = Math.min(indicators.length * 0.2, 0.9);

    return {
      primary,
      secondary,
      intensity,
      valence,
      arousal,
      confidence,
      timestamp: new Date()
    };
  }

  /**
   * Calculate valence (-1 to 1)
   */
  private calculateValence(emotion: Emotion, intensity: number): number {
    const valenceMap: Record<Emotion, number> = {
      joy: 0.8,
      trust: 0.6,
      anticipation: 0.5,
      surprise: 0.2,
      neutral: 0,
      fear: -0.5,
      sadness: -0.6,
      disgust: -0.7,
      anger: -0.8
    };

    return valenceMap[emotion] * Math.min(intensity, 1);
  }

  /**
   * Calculate arousal (0 to 1)
   */
  private calculateArousal(emotion: Emotion, intensity: number): number {
    const arousalMap: Record<Emotion, number> = {
      anger: 0.9,
      fear: 0.8,
      surprise: 0.7,
      joy: 0.6,
      anticipation: 0.5,
      disgust: 0.4,
      trust: 0.3,
      sadness: 0.2,
      neutral: 0.1
    };

    return arousalMap[emotion] * Math.min(intensity, 1);
  }

  /**
   * Create neutral state
   */
  private createNeutralState(): EmotionalState {
    return {
      primary: 'neutral',
      secondary: null,
      intensity: 0.1,
      valence: 0,
      arousal: 0.1,
      confidence: 0.5,
      timestamp: new Date()
    };
  }

  /**
   * Create neutral analysis
   */
  private createNeutralAnalysis(text: string): EmotionAnalysis {
    return {
      text,
      state: this.createNeutralState(),
      indicators: [],
      trajectory: []
    };
  }

  /**
   * Add state to trajectory
   */
  private addToTrajectory(state: EmotionalState, trigger?: string): void {
    this.trajectory.push({ timestamp: new Date(), state, trigger });

    // Trim trajectory to max length
    if (this.trajectory.length > this.config.historyLength) {
      this.trajectory.shift();
    }

    this.stats.trajectoryLength = this.trajectory.length;
  }

  /**
   * Get recent trajectory
   */
  private getRecentTrajectory(count: number): TrajectoryPoint[] {
    return this.trajectory.slice(-count);
  }

  /**
   * Get emotional resonance suggestions
   */
  getResonance(state: EmotionalState, currentStance: Stance): EmotionalResonance {
    const frameMapping: Record<Emotion, Frame> = {
      joy: 'playful',
      sadness: 'existential',
      anger: 'adversarial',
      fear: 'stoic',
      surprise: 'playful',
      disgust: 'psychoanalytic',
      trust: 'pragmatic',
      anticipation: 'mythic',
      neutral: currentStance.frame
    };

    const suggestedFrame = frameMapping[state.primary];

    // Operator suggestions based on emotion
    const operatorSuggestions = this.suggestOperators(state);

    // Tone guidance
    const toneGuidance = this.calculateToneGuidance(state);

    return {
      userEmotion: state.primary,
      suggestedFrame,
      operatorSuggestions,
      toneGuidance
    };
  }

  /**
   * Suggest operators based on emotional state
   */
  private suggestOperators(state: EmotionalState): string[] {
    const suggestions: string[] = [];

    if (state.valence < -0.3) {
      suggestions.push('REFRAME');
      suggestions.push('ZOOM_OUT');
    }

    if (state.arousal > 0.6) {
      suggestions.push('GROUND');
      suggestions.push('PAUSE');
    }

    if (state.primary === 'fear' || state.primary === 'anger') {
      suggestions.push('VALIDATE');
      suggestions.push('REFLECT');
    }

    if (state.primary === 'joy' || state.primary === 'anticipation') {
      suggestions.push('AMPLIFY');
      suggestions.push('EXPLORE');
    }

    return suggestions;
  }

  /**
   * Calculate tone guidance
   */
  private calculateToneGuidance(state: EmotionalState): ToneGuidance {
    return {
      formality: state.arousal > 0.5 ? 'casual' : 'neutral',
      warmth: state.valence < 0 ? 0.8 : 0.5,
      directness: state.primary === 'anger' ? 0.4 : 0.6,
      energyLevel: state.arousal > 0.6 ? 'calm' : state.arousal > 0.3 ? 'moderate' : 'calm',
      empathyLevel: state.valence < 0 ? 0.9 : 0.5
    };
  }

  /**
   * Calculate sentiment score
   */
  calculateSentiment(text: string): SentimentScore {
    const analysis = this.analyze(text);

    const positiveEmotions: Emotion[] = ['joy', 'trust', 'anticipation'];
    const negativeEmotions: Emotion[] = ['sadness', 'anger', 'fear', 'disgust'];

    let positive = 0;
    let negative = 0;

    for (const indicator of analysis.indicators) {
      if (positiveEmotions.includes(indicator.emotion)) {
        positive += indicator.weight;
      } else if (negativeEmotions.includes(indicator.emotion)) {
        negative += indicator.weight;
      }
    }

    const total = positive + negative + 0.1;  // Avoid division by zero
    const neutral = Math.max(0, 1 - (positive + negative) / total);

    return {
      positive: positive / total,
      negative: negative / total,
      neutral,
      compound: (positive - negative) / total
    };
  }

  /**
   * Update mood profile
   */
  updateMoodProfile(): MoodProfile {
    if (this.trajectory.length < 5) {
      return {
        baseline: this.createNeutralState(),
        currentMood: 'neutral',
        stability: 1,
        triggers: []
      };
    }

    // Calculate baseline from history
    const recentStates = this.trajectory.slice(-20).map(t => t.state);
    const avgValence = recentStates.reduce((sum, s) => sum + s.valence, 0) / recentStates.length;
    const avgArousal = recentStates.reduce((sum, s) => sum + s.arousal, 0) / recentStates.length;

    // Find most common emotion
    const emotionCounts: Record<Emotion, number> = {} as Record<Emotion, number>;
    for (const state of recentStates) {
      emotionCounts[state.primary] = (emotionCounts[state.primary] || 0) + 1;
    }
    const currentMood = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0][0] as Emotion;

    // Calculate stability
    const valenceVariance = recentStates.reduce(
      (sum, s) => sum + Math.pow(s.valence - avgValence, 2), 0
    ) / recentStates.length;
    const stability = Math.max(0, 1 - valenceVariance * 2);

    this.moodProfile = {
      baseline: {
        primary: currentMood,
        secondary: null,
        intensity: 0.5,
        valence: avgValence,
        arousal: avgArousal,
        confidence: 0.7,
        timestamp: new Date()
      },
      currentMood,
      stability,
      triggers: []
    };

    return this.moodProfile;
  }

  /**
   * Update statistics
   */
  private updateStats(state: EmotionalState): void {
    const n = this.stats.analysesPerformed + 1;
    this.stats.analysesPerformed = n;

    this.stats.averageConfidence = (
      this.stats.averageConfidence * (n - 1) + state.confidence
    ) / n;

    this.stats.averageValence = (
      this.stats.averageValence * (n - 1) + state.valence
    ) / n;

    this.stats.emotionDistribution[state.primary]++;
  }

  /**
   * Get trajectory
   */
  getTrajectory(): TrajectoryPoint[] {
    return [...this.trajectory];
  }

  /**
   * Get mood profile
   */
  getMoodProfile(): MoodProfile | null {
    return this.moodProfile;
  }

  /**
   * Get statistics
   */
  getStats(): EmotionStats {
    return { ...this.stats };
  }

  /**
   * Clear trajectory
   */
  clearTrajectory(): void {
    this.trajectory = [];
    this.stats.trajectoryLength = 0;
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.trajectory = [];
    this.moodProfile = null;
    this.stats = {
      analysesPerformed: 0,
      averageConfidence: 0,
      emotionDistribution: {
        joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
        disgust: 0, trust: 0, anticipation: 0, neutral: 0
      },
      averageValence: 0,
      trajectoryLength: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const emotionDetector = new EmotionDetector();
