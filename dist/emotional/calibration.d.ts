/**
 * Emotional Intelligence Calibration
 *
 * Calibrates AI responses based on user emotional states with
 * sentiment analysis, tone matching, and adaptive communication styles.
 */
import type { Stance, Frame } from '../types/index.js';
export interface EmotionalState {
    primary: Emotion;
    secondary?: Emotion;
    intensity: number;
    valence: number;
    arousal: number;
    confidence: number;
    timestamp: Date;
}
export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation' | 'neutral' | 'curiosity' | 'frustration' | 'excitement' | 'confusion' | 'satisfaction';
export interface CalibrationConfig {
    sensitivityLevel: 'low' | 'medium' | 'high';
    responseAdaptation: boolean;
    toneMatching: boolean;
    emotionalMirroring: number;
    deescalationEnabled: boolean;
    empathyLevel: number;
    culturalContext?: string;
}
export interface CommunicationStyle {
    formality: number;
    warmth: number;
    directness: number;
    pace: 'slow' | 'moderate' | 'fast';
    complexity: 'simple' | 'moderate' | 'complex';
    encouragement: number;
}
export interface EmotionalResponse {
    recommendedStyle: CommunicationStyle;
    suggestedTone: string;
    adaptations: StyleAdaptation[];
    frameSuggestion?: Frame;
    deescalationNeeded: boolean;
    empathyStatements: string[];
}
export interface StyleAdaptation {
    type: 'tone' | 'pace' | 'complexity' | 'formality' | 'encouragement' | 'warmth' | 'directness';
    direction: 'increase' | 'decrease' | 'maintain';
    reason: string;
    magnitude: number;
}
export interface EmotionalHistory {
    states: EmotionalState[];
    patterns: EmotionalPattern[];
    averageValence: number;
    volatility: number;
    dominantEmotions: Emotion[];
}
export interface EmotionalPattern {
    trigger: string;
    response: Emotion;
    frequency: number;
    consistency: number;
}
export interface SentimentAnalysis {
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    emotions: EmotionScore[];
    keywords: SentimentKeyword[];
}
export interface EmotionScore {
    emotion: Emotion;
    score: number;
    confidence: number;
}
export interface SentimentKeyword {
    word: string;
    sentiment: number;
    weight: number;
}
export declare class EmotionalCalibrationEngine {
    private config;
    private emotionalHistory;
    private currentStyle;
    private sentimentLexicon;
    constructor(config?: Partial<CalibrationConfig>);
    private createDefaultStyle;
    private initializeLexicon;
    analyzeSentiment(text: string): SentimentAnalysis;
    private inferEmotionsFromText;
    detectEmotionalState(text: string, stance?: Stance): EmotionalState;
    calibrateResponse(emotionalState: EmotionalState, _stance: Stance): EmotionalResponse;
    private calculateRecommendedStyle;
    private generateEmpathyStatements;
    private determineTone;
    private suggestFrame;
    analyzeEmotionalHistory(): EmotionalHistory;
    private detectPatterns;
    setConfig(config: Partial<CalibrationConfig>): void;
    getConfig(): CalibrationConfig;
    getCurrentStyle(): CommunicationStyle;
    setCurrentStyle(style: Partial<CommunicationStyle>): void;
    clearHistory(): void;
}
export declare function createEmotionalCalibrationEngine(config?: Partial<CalibrationConfig>): EmotionalCalibrationEngine;
//# sourceMappingURL=calibration.d.ts.map