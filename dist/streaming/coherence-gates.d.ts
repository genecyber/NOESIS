/**
 * Adaptive Response Streaming with Coherence Gates - Ralph Iteration 5 Feature 5
 *
 * Provides real-time coherence monitoring during token generation,
 * with early termination and automatic regeneration of problematic segments.
 */
import { Stance } from '../types/index.js';
/**
 * Token coherence score
 */
export interface TokenCoherence {
    token: string;
    position: number;
    localScore: number;
    globalScore: number;
    combinedScore: number;
    flags: CoherenceFlag[];
}
/**
 * Flags for coherence issues
 */
export type CoherenceFlag = 'topic_drift' | 'tone_shift' | 'contradiction' | 'repetition' | 'incoherent_syntax' | 'stance_violation' | 'hallucination_risk';
/**
 * Coherence gate result
 */
export interface GateResult {
    passed: boolean;
    score: number;
    reason?: string;
    action: 'continue' | 'warn' | 'backtrack' | 'terminate';
    backtrackTo?: number;
}
/**
 * Streaming coherence state
 */
export interface StreamingState {
    tokens: TokenCoherence[];
    currentScore: number;
    movingAverage: number;
    warningCount: number;
    backtrackCount: number;
    isHealthy: boolean;
    coherenceWave: number[];
}
/**
 * Coherence gate configuration
 */
export interface CoherenceGateConfig {
    enabled: boolean;
    minCoherence: number;
    warningThreshold: number;
    maxBacktracks: number;
    windowSize: number;
    localWeight: number;
    globalWeight: number;
    earlyTerminationEnabled: boolean;
    visualizationEnabled: boolean;
}
/**
 * Coherence Gate Manager
 */
declare class CoherenceGateManager {
    private config;
    private state;
    private stance;
    private conversationContext;
    private recentTokens;
    /**
     * Set configuration
     */
    setConfig(config: Partial<CoherenceGateConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): CoherenceGateConfig;
    /**
     * Initialize streaming state for new response
     */
    initializeStream(stance: Stance, context: string): StreamingState;
    /**
     * Process a new token through coherence gates
     */
    processToken(token: string): {
        coherence: TokenCoherence;
        gate: GateResult;
    };
    /**
     * Calculate local coherence (with immediate context)
     */
    private calculateLocalCoherence;
    /**
     * Calculate global coherence (with overall conversation)
     */
    private calculateGlobalCoherence;
    /**
     * Detect coherence flags
     */
    private detectCoherenceFlags;
    /**
     * Check for incoherent syntax
     */
    private hasIncoherentSyntax;
    /**
     * Detect contradictions with context
     */
    private detectContradictions;
    /**
     * Check if two sentences contradict
     */
    private sentencesContradict;
    /**
     * Detect stance violations
     */
    private detectStanceViolation;
    /**
     * Calculate topic relevance
     */
    private calculateTopicRelevance;
    /**
     * Update moving average
     */
    private updateMovingAverage;
    /**
     * Evaluate coherence gate
     */
    private evaluateGate;
    /**
     * Find optimal backtrack point
     */
    private findBacktrackPoint;
    /**
     * Execute backtrack
     */
    backtrack(toPosition: number): string;
    /**
     * Get current streaming state
     */
    getState(): StreamingState | null;
    /**
     * Get coherence visualization data
     */
    getVisualizationData(): {
        wave: number[];
        average: number;
        health: 'good' | 'warning' | 'critical';
        flagCounts: Record<CoherenceFlag, number>;
    } | null;
    /**
     * Generate inline coherence indicator for CLI
     */
    getInlineIndicator(): string;
    /**
     * Get predictive coherence warning before response
     */
    getPredictiveWarning(context: string): string | null;
    /**
     * Finalize stream and return summary
     */
    finalizeStream(): {
        success: boolean;
        finalScore: number;
        tokenCount: number;
        backtrackCount: number;
        warningCount: number;
        flagSummary: Record<CoherenceFlag, number>;
    } | null;
}
export declare const coherenceGates: CoherenceGateManager;
export {};
//# sourceMappingURL=coherence-gates.d.ts.map