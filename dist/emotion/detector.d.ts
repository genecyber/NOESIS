/**
 * Emotional Tone Detection (Ralph Iteration 10, Feature 5)
 *
 * Real-time sentiment analysis, emotional trajectory mapping,
 * tone-aware response adaptation, and mood-based operator selection.
 */
import type { Stance, Frame } from '../types/index.js';
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
    intensity: number;
    valence: number;
    arousal: number;
    confidence: number;
    timestamp: Date;
}
export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation' | 'neutral';
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
    warmth: number;
    directness: number;
    energyLevel: 'calm' | 'moderate' | 'energetic';
    empathyLevel: number;
}
export interface MoodProfile {
    baseline: EmotionalState;
    currentMood: Emotion;
    stability: number;
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
    compound: number;
}
export interface EmotionStats {
    analysesPerformed: number;
    averageConfidence: number;
    emotionDistribution: Record<Emotion, number>;
    averageValence: number;
    trajectoryLength: number;
}
export declare class EmotionDetector {
    private config;
    private trajectory;
    private moodProfile;
    private emotionLexicon;
    private stats;
    constructor(config?: Partial<EmotionConfig>);
    /**
     * Initialize emotion lexicon
     */
    private initializeEmotionLexicon;
    /**
     * Analyze text for emotional content
     */
    analyze(text: string): EmotionAnalysis;
    /**
     * Extract emotion indicators from text
     */
    private extractIndicators;
    /**
     * Calculate emotional state from indicators
     */
    private calculateEmotionalState;
    /**
     * Calculate valence (-1 to 1)
     */
    private calculateValence;
    /**
     * Calculate arousal (0 to 1)
     */
    private calculateArousal;
    /**
     * Create neutral state
     */
    private createNeutralState;
    /**
     * Create neutral analysis
     */
    private createNeutralAnalysis;
    /**
     * Add state to trajectory
     */
    private addToTrajectory;
    /**
     * Get recent trajectory
     */
    private getRecentTrajectory;
    /**
     * Get emotional resonance suggestions
     */
    getResonance(state: EmotionalState, currentStance: Stance): EmotionalResonance;
    /**
     * Suggest operators based on emotional state
     */
    private suggestOperators;
    /**
     * Calculate tone guidance
     */
    private calculateToneGuidance;
    /**
     * Calculate sentiment score
     */
    calculateSentiment(text: string): SentimentScore;
    /**
     * Update mood profile
     */
    updateMoodProfile(): MoodProfile;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Get trajectory
     */
    getTrajectory(): TrajectoryPoint[];
    /**
     * Get mood profile
     */
    getMoodProfile(): MoodProfile | null;
    /**
     * Get statistics
     */
    getStats(): EmotionStats;
    /**
     * Clear trajectory
     */
    clearTrajectory(): void;
    /**
     * Reset detector
     */
    reset(): void;
}
export declare const emotionDetector: EmotionDetector;
//# sourceMappingURL=detector.d.ts.map