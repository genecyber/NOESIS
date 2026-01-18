/**
 * Federated Learning (Ralph Iteration 8, Feature 4)
 *
 * Share anonymized stance evolution patterns, learn from fleet,
 * privacy-preserving updates, and local model fine-tuning.
 */
import type { Stance, PlannedOperation, TurnScores } from '../types/index.js';
export interface FederationConfig {
    enabled: boolean;
    nodeId: string;
    coordinatorUrl: string;
    contributionEnabled: boolean;
    privacyLevel: PrivacyLevel;
    syncInterval: number;
    minLocalSamples: number;
    maxContributionSize: number;
}
export type PrivacyLevel = 'strict' | 'moderate' | 'permissive';
export interface FederationNode {
    id: string;
    name?: string;
    version: string;
    lastSeen: Date;
    contributionCount: number;
    status: 'active' | 'inactive' | 'pending';
}
export interface OperatorSequence {
    operators: string[];
    successRate: number;
    avgTransformation: number;
    avgCoherence: number;
    sampleCount: number;
    contexts: string[];
}
export interface StancePattern {
    id: string;
    fromFrame: string;
    toFrame: string;
    operatorSequence: string[];
    frequency: number;
    effectiveness: number;
    privacyHash: string;
}
export interface FederatedUpdate {
    id: string;
    timestamp: Date;
    sourceNode: string;
    patterns: StancePattern[];
    sequences: OperatorSequence[];
    aggregatedMetrics: AggregatedMetrics;
}
export interface AggregatedMetrics {
    totalSamples: number;
    avgTransformationScore: number;
    avgCoherenceScore: number;
    avgSentienceScore: number;
    topOperators: Array<{
        name: string;
        effectiveness: number;
    }>;
    frameTransitions: Array<{
        from: string;
        to: string;
        frequency: number;
    }>;
}
export interface LocalLearningData {
    samples: LearningSample[];
    patterns: StancePattern[];
    sequences: OperatorSequence[];
    lastUpdate: Date;
}
export interface LearningSample {
    id: string;
    stanceBefore: AnonymizedStance;
    stanceAfter: AnonymizedStance;
    operators: string[];
    scores: TurnScores;
    contextHash: string;
    timestamp: Date;
}
export interface AnonymizedStance {
    frame: string;
    selfModel: string;
    objective: string;
    valueRanges: Record<string, 'low' | 'medium' | 'high'>;
    sentienceLevel: 'low' | 'medium' | 'high';
}
export interface ContributionResult {
    success: boolean;
    contributionId?: string;
    samplesAccepted?: number;
    error?: string;
}
export interface FederationStats {
    isConnected: boolean;
    nodeCount: number;
    totalContributions: number;
    totalSamplesShared: number;
    updatesReceived: number;
    lastSync: Date | null;
    privacyLevel: PrivacyLevel;
}
export type FederationEventHandler = (event: FederationEvent) => void;
export interface FederationEvent {
    type: 'connected' | 'disconnected' | 'update_received' | 'contribution_sent' | 'error';
    timestamp: Date;
    data?: Record<string, unknown>;
}
export declare class FederatedLearningManager {
    private config;
    private localData;
    private nodes;
    private receivedUpdates;
    private handlers;
    private syncTimer;
    private stats;
    private isConnected;
    constructor(config?: Partial<FederationConfig>);
    /**
     * Join the federation
     */
    join(): Promise<boolean>;
    /**
     * Leave the federation
     */
    leave(): Promise<void>;
    /**
     * Start periodic sync
     */
    private startSync;
    /**
     * Stop periodic sync
     */
    private stopSync;
    /**
     * Sync with federation
     */
    private sync;
    /**
     * Record a learning sample
     */
    recordSample(stanceBefore: Stance, stanceAfter: Stance, operators: PlannedOperation[], scores: TurnScores, context: string): LearningSample;
    /**
     * Anonymize stance based on privacy level
     */
    private anonymizeStance;
    /**
     * Hash context for privacy
     */
    private hashContext;
    /**
     * Extract patterns from samples
     */
    private extractPatterns;
    /**
     * Contribute local learning to federation
     */
    contribute(): Promise<ContributionResult>;
    /**
     * Select samples for contribution based on privacy level
     */
    private selectContributionSamples;
    /**
     * Calculate aggregated metrics
     */
    private calculateAggregatedMetrics;
    /**
     * Receive updates from federation
     */
    receiveUpdates(): Promise<FederatedUpdate[]>;
    /**
     * Apply federated insights to local model
     */
    applyInsights(): {
        recommendedOperators: string[];
        effectivePatterns: StancePattern[];
        insights: string[];
    };
    /**
     * Get effective operator sequences
     */
    getEffectiveSequences(): OperatorSequence[];
    /**
     * Subscribe to federation events
     */
    subscribe(handler: FederationEventHandler): () => void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Get statistics
     */
    getStats(): FederationStats;
    /**
     * Get local learning data
     */
    getLocalData(): LocalLearningData;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<FederationConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): FederationConfig;
    /**
     * Export state
     */
    export(): {
        localData: LocalLearningData;
        receivedUpdates: FederatedUpdate[];
    };
    /**
     * Import state
     */
    import(data: ReturnType<FederatedLearningManager['export']>): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const federatedLearning: FederatedLearningManager;
//# sourceMappingURL=learning.d.ts.map