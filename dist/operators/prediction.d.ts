/**
 * Predictive Operator Suggestions (Ralph Iteration 11, Feature 4)
 *
 * Conversation trajectory analysis, next-operator prediction models,
 * proactive transformation suggestions, user behavior pattern recognition,
 * optimal path recommendation, and surprise/novelty balancing.
 */
import type { Stance, Frame } from '../types/index.js';
export interface PredictionConfig {
    enablePrediction: boolean;
    lookbackWindow: number;
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
    lastSeen: number;
    operators: string[];
    confidence: number;
}
export type PatternType = 'repetitive' | 'escalating' | 'cycling' | 'converging' | 'diverging' | 'stagnant';
export interface TrajectoryMomentum {
    direction: 'transforming' | 'stabilizing' | 'neutral';
    strength: number;
    acceleration: number;
    predictedTurns: number;
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
export type IntentType = 'explore' | 'challenge' | 'understand' | 'create' | 'resolve' | 'play' | 'reflect' | 'conclude' | 'unknown';
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
export declare class OperatorPredictionManager {
    private config;
    private trajectory;
    private patterns;
    private operatorHistory;
    private stats;
    private lastPrediction;
    constructor(config?: Partial<PredictionConfig>);
    /**
     * Record a turn for trajectory analysis
     */
    recordTurn(stance: Stance, operator: string | null, message: string): void;
    /**
     * Infer user intent from message
     */
    private inferIntent;
    /**
     * Detect conversation patterns
     */
    private detectPatterns;
    /**
     * Add or update a pattern
     */
    private addPattern;
    /**
     * Update trajectory momentum
     */
    private updateMomentum;
    /**
     * Detect inflection points
     */
    private detectInflectionPoints;
    /**
     * Predict next operator
     */
    predictNextOperator(currentStance: Stance, lastMessage: string): PredictionSuggestion[];
    /**
     * Predict from patterns
     */
    private predictFromPatterns;
    /**
     * Predict from intent
     */
    private predictFromIntent;
    /**
     * Predict from momentum
     */
    private predictFromMomentum;
    /**
     * Estimate outcome for operator
     */
    private estimateOutcome;
    /**
     * Determine urgency of suggestion
     */
    private determineUrgency;
    /**
     * Determine category of prediction
     */
    private determineCategory;
    /**
     * Apply novelty balancing to suggestions
     */
    private applyNoveltyBalance;
    /**
     * Calculate optimal path to target state
     */
    calculateOptimalPath(currentStance: Stance, targetFrame: Frame, maxTurns?: number): OptimalPath;
    /**
     * Validate last prediction against actual operator
     */
    private validatePrediction;
    /**
     * Get trajectory
     */
    getTrajectory(): ConversationTrajectory;
    /**
     * Get detected patterns
     */
    getPatterns(): DetectedPattern[];
    /**
     * Get statistics
     */
    getStats(): PredictionStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const operatorPrediction: OperatorPredictionManager;
//# sourceMappingURL=prediction.d.ts.map