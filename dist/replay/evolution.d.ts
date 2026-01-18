/**
 * Stance Evolution Replay (Ralph Iteration 7, Feature 6)
 *
 * Record full stance evolution history, replay conversations
 * with different starting stances, compare outcomes, and export
 * evolution as training data.
 */
import type { Stance, ModeConfig, ConversationMessage, PlannedOperation, TurnScores } from '../types/index.js';
export interface EvolutionSnapshot {
    id: string;
    timestamp: Date;
    turnNumber: number;
    message: string;
    stanceBefore: Stance;
    stanceAfter: Stance;
    operators: PlannedOperation[];
    scores: TurnScores;
    decisionPoints: DecisionPoint[];
}
export interface DecisionPoint {
    type: 'operator_selection' | 'stance_shift' | 'coherence_check' | 'regeneration';
    description: string;
    alternatives: string[];
    chosenOption: string;
    confidence: number;
    reasoning: string;
}
export interface EvolutionRecording {
    id: string;
    name: string;
    description?: string;
    startTime: Date;
    endTime: Date | null;
    initialStance: Stance;
    initialConfig: ModeConfig;
    snapshots: EvolutionSnapshot[];
    metadata: Record<string, unknown>;
}
export interface ReplayConfig {
    startingStance?: Stance;
    startingConfig?: ModeConfig;
    pauseAtDecisionPoints: boolean;
    speed: number;
    skipOperators?: string[];
    forceOperators?: string[];
}
export interface ReplayState {
    recording: EvolutionRecording;
    config: ReplayConfig;
    currentTurn: number;
    status: 'idle' | 'playing' | 'paused' | 'completed';
    currentStance: Stance;
    divergencePoints: number[];
}
export interface ReplayComparison {
    originalRecordingId: string;
    replayId: string;
    stanceDeviation: number;
    outcomeDeviation: number;
    divergenceAnalysis: Array<{
        turn: number;
        originalStance: Stance;
        replayStance: Stance;
        difference: string;
    }>;
    insights: string[];
}
export interface TrainingDataExport {
    format: 'jsonl' | 'csv' | 'parquet';
    samples: TrainingSample[];
    metadata: {
        recordingId: string;
        totalSamples: number;
        exportedAt: Date;
        stanceDistribution: Record<string, number>;
    };
}
export interface TrainingSample {
    input: {
        message: string;
        stanceBefore: Stance;
        config: ModeConfig;
        conversationHistory: Array<{
            role: string;
            content: string;
        }>;
    };
    output: {
        stanceAfter: Stance;
        operators: string[];
        scores: TurnScores;
    };
    metadata: {
        turn: number;
        recordingId: string;
        timestamp: string;
    };
}
export interface EvolutionVisualization {
    timeline: Array<{
        turn: number;
        timestamp: Date;
        frame: string;
        selfModel: string;
        objective: string;
        awarenessLevel: number;
        operators: string[];
    }>;
    decisionTree: DecisionTreeNode;
    stanceTrajectory: Array<{
        x: number;
        y: number;
        label: string;
    }>;
}
export interface DecisionTreeNode {
    turn: number;
    decision: string;
    children: DecisionTreeNode[];
    outcome?: string;
}
export type ReplayEventHandler = (event: ReplayEvent) => void;
export interface ReplayEvent {
    type: 'turn_start' | 'decision_point' | 'stance_change' | 'turn_complete' | 'replay_complete';
    turn: number;
    data: unknown;
    timestamp: Date;
}
export declare class StanceEvolutionRecorder {
    private recordings;
    private activeRecording;
    private replayStates;
    private handlers;
    /**
     * Start a new recording
     */
    startRecording(name: string, initialStance: Stance, initialConfig: ModeConfig): string;
    /**
     * Record a turn snapshot
     */
    recordTurn(message: string, stanceBefore: Stance, stanceAfter: Stance, operators: PlannedOperation[], scores: TurnScores, decisionPoints?: DecisionPoint[]): void;
    /**
     * Record a decision point
     */
    recordDecisionPoint(type: DecisionPoint['type'], description: string, alternatives: string[], chosenOption: string, confidence: number, reasoning: string): DecisionPoint;
    /**
     * Stop the current recording
     */
    stopRecording(): EvolutionRecording | null;
    /**
     * Get a recording by ID
     */
    getRecording(id: string): EvolutionRecording | null;
    /**
     * List all recordings
     */
    listRecordings(): Array<{
        id: string;
        name: string;
        turnCount: number;
        startTime: Date;
    }>;
    /**
     * Start a replay session
     */
    startReplay(recordingId: string, config?: Partial<ReplayConfig>): string;
    /**
     * Play the next turn in a replay
     */
    playNextTurn(replayId: string): Promise<{
        snapshot: EvolutionSnapshot | null;
        diverged: boolean;
        complete: boolean;
    }>;
    /**
     * Pause a replay
     */
    pauseReplay(replayId: string): void;
    /**
     * Resume a paused replay
     */
    resumeReplay(replayId: string): void;
    /**
     * Apply operators to stance (simplified)
     */
    private applyOperators;
    /**
     * Check if stance has diverged significantly
     */
    private hasStanceDiverged;
    /**
     * Compare a replay to its original recording
     */
    compareReplay(replayId: string): ReplayComparison;
    /**
     * Calculate deviation between two stances
     */
    private calculateStanceDeviation;
    /**
     * Describe difference between stances
     */
    private describeStanceDifference;
    /**
     * Export recording as training data
     */
    exportAsTrainingData(recordingId: string, format?: TrainingDataExport['format'], conversationHistory?: ConversationMessage[]): TrainingDataExport;
    /**
     * Generate visualization data
     */
    generateVisualization(recordingId: string): EvolutionVisualization;
    /**
     * Subscribe to replay events
     */
    subscribe(handler: ReplayEventHandler): () => void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Helper for delay
     */
    private delay;
    /**
     * Delete a recording
     */
    deleteRecording(id: string): boolean;
    /**
     * Export all recordings
     */
    exportAll(): EvolutionRecording[];
    /**
     * Import recordings
     */
    importRecordings(recordings: EvolutionRecording[]): number;
    /**
     * Get replay state
     */
    getReplayState(replayId: string): ReplayState | null;
}
export declare const evolutionRecorder: StanceEvolutionRecorder;
//# sourceMappingURL=evolution.d.ts.map