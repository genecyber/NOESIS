/**
 * Adaptive Response Streaming (Ralph Iteration 7, Feature 5)
 *
 * Token-level confidence scoring, dynamic generation parameters,
 * early termination, backtracking, and streaming coherence visualization.
 */
import type { Stance, ModeConfig } from '../types/index.js';
export interface StreamingConfig {
    confidenceThreshold: number;
    earlyTerminationThreshold: number;
    backtrackingEnabled: boolean;
    maxBacktrackTokens: number;
    coherenceCheckInterval: number;
    dynamicTemperature: boolean;
    baseTemperature: number;
    minTemperature: number;
    maxTemperature: number;
}
export interface TokenConfidence {
    token: string;
    confidence: number;
    logProb: number;
    alternatives: Array<{
        token: string;
        confidence: number;
    }>;
    timestamp: number;
}
export interface StreamSegment {
    id: string;
    tokens: TokenConfidence[];
    avgConfidence: number;
    coherenceScore: number;
    revised: boolean;
    originalContent?: string;
}
export interface StreamState {
    segments: StreamSegment[];
    currentSegment: StreamSegment | null;
    totalTokens: number;
    avgConfidence: number;
    coherenceHistory: Array<{
        position: number;
        score: number;
    }>;
    backtrackCount: number;
    earlyTerminated: boolean;
    dynamicParams: DynamicParams;
}
export interface DynamicParams {
    temperature: number;
    topP: number;
    topK: number;
    presencePenalty: number;
    frequencyPenalty: number;
}
export interface StreamEvent {
    type: 'token' | 'segment_complete' | 'backtrack' | 'terminate' | 'params_adjust';
    data: unknown;
    timestamp: number;
}
export type StreamEventHandler = (event: StreamEvent) => void;
export interface CoherenceVisualization {
    position: number;
    score: number;
    context: string;
    issues: string[];
}
export interface AdaptiveStreamStats {
    totalTokens: number;
    avgConfidence: number;
    segmentsCompleted: number;
    backtrackCount: number;
    earlyTerminations: number;
    avgCoherence: number;
    temperatureAdjustments: number;
}
export declare class AdaptiveStreamingController {
    private config;
    private state;
    private handlers;
    private stats;
    constructor(config?: Partial<StreamingConfig>);
    /**
     * Create initial state
     */
    private createInitialState;
    /**
     * Create initial stats
     */
    private createInitialStats;
    /**
     * Start a new streaming session
     */
    startStream(): void;
    /**
     * Start a new segment
     */
    private startNewSegment;
    /**
     * Process a new token
     */
    processToken(token: string, logProb: number, alternatives?: Array<{
        token: string;
        logProb: number;
    }>): {
        accepted: boolean;
        shouldBacktrack: boolean;
        shouldTerminate: boolean;
    };
    /**
     * Calculate confidence from log probability
     */
    private calculateConfidence;
    /**
     * Update running average confidence
     */
    private updateAvgConfidence;
    /**
     * Update segment confidence
     */
    private updateSegmentConfidence;
    /**
     * Check if we should terminate early
     */
    private shouldTerminateEarly;
    /**
     * Check if we should backtrack
     */
    private shouldBacktrack;
    /**
     * Perform backtracking
     */
    backtrack(tokensToRemove?: number): string[];
    /**
     * Complete current segment
     */
    completeSegment(): StreamSegment | null;
    /**
     * Terminate the stream
     */
    terminateStream(): void;
    /**
     * Check coherence of current content
     */
    private checkCoherence;
    /**
     * Calculate variance of array
     */
    private calculateVariance;
    /**
     * Adjust dynamic parameters based on context
     */
    private adjustDynamicParams;
    /**
     * Get dynamic generation parameters adjusted for context
     */
    getGenerationParams(stance: Stance, config: ModeConfig): DynamicParams;
    /**
     * Get coherence visualization data
     */
    getCoherenceVisualization(): CoherenceVisualization[];
    /**
     * Get context around a position
     */
    private getContextAtPosition;
    /**
     * Subscribe to stream events
     */
    subscribe(handler: StreamEventHandler): () => void;
    /**
     * Emit event to handlers
     */
    private emit;
    /**
     * Get current state
     */
    getState(): StreamState;
    /**
     * Get statistics
     */
    getStats(): AdaptiveStreamStats;
    /**
     * Get all segments
     */
    getSegments(): StreamSegment[];
    /**
     * Get full generated content
     */
    getContent(): string;
    /**
     * Analyze streaming performance
     */
    analyze(): {
        avgConfidence: number;
        confidenceDistribution: Record<string, number>;
        backtrackRate: number;
        coherenceTrend: 'improving' | 'stable' | 'declining';
        recommendations: string[];
    };
    /**
     * Reset controller
     */
    reset(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<StreamingConfig>): void;
}
export declare const adaptiveStreaming: AdaptiveStreamingController;
//# sourceMappingURL=adaptive.d.ts.map