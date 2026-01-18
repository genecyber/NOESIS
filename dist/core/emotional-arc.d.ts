/**
 * Emotional Arc Tracking - Ralph Iteration 3 Feature 6
 *
 * Tracks conversation emotional trajectory and detects patterns
 * that may warrant transformation interventions.
 */
/**
 * Emotional state for a single turn
 */
export interface EmotionalPoint {
    turn: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    valence: number;
    arousal: number;
    dominance: number;
    primaryEmotion: string;
}
/**
 * Emotional arc tracker for a conversation
 */
export interface EmotionalArc {
    conversationId: string;
    points: EmotionalPoint[];
    insights: string[];
    patterns: EmotionalPattern[];
}
/**
 * Detected emotional pattern
 */
export interface EmotionalPattern {
    type: 'escalation' | 'de-escalation' | 'stuck' | 'volatile' | 'stable';
    startTurn: number;
    endTurn: number;
    description: string;
    suggestedIntervention?: string;
}
/**
 * Analyze text for emotional content
 */
export declare function analyzeEmotionalContent(text: string): {
    sentiment: 'positive' | 'neutral' | 'negative';
    valence: number;
    arousal: number;
    dominance: number;
    primaryEmotion: string;
};
/**
 * Emotional arc tracker
 */
declare class EmotionalArcTracker {
    private arcs;
    /**
     * Get or create arc for conversation
     */
    getArc(conversationId: string): EmotionalArc;
    /**
     * Record emotional state for a turn
     */
    recordTurn(conversationId: string, text: string, turnNumber: number): EmotionalPoint;
    /**
     * Detect emotional patterns in the arc
     */
    private detectPatterns;
    /**
     * Generate insights from patterns
     */
    private generateInsights;
    /**
     * Get current emotional state summary
     */
    getCurrentState(conversationId: string): {
        current: EmotionalPoint | null;
        trend: 'improving' | 'declining' | 'stable' | 'unknown';
        recentInsights: string[];
        suggestedIntervention: string | null;
    };
    /**
     * Get full arc for visualization
     */
    getFullArc(conversationId: string): EmotionalArc | null;
    /**
     * Clear arc for conversation
     */
    clearArc(conversationId: string): void;
}
export declare const emotionalArcTracker: EmotionalArcTracker;
export {};
//# sourceMappingURL=emotional-arc.d.ts.map