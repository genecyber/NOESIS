/**
 * Cross-Session Identity Persistence - Ralph Iteration 5 Feature 2
 *
 * Enables true identity continuity across sessions with checkpoints,
 * drift detection, and core value preservation.
 */
import { Stance } from '../types/index.js';
/**
 * Identity checkpoint - a snapshot of identity state
 */
export interface IdentityCheckpoint {
    id: string;
    name: string;
    timestamp: Date;
    stance: Stance;
    coreValues: CoreValue[];
    emergentTraits: string[];
    identityFingerprint: string;
    milestone?: string;
    parentCheckpoint?: string;
}
/**
 * Core value - persistent values that survive major transformations
 */
export interface CoreValue {
    name: string;
    strength: number;
    description: string;
    establishedAt: Date;
    reinforcements: number;
}
/**
 * Identity diff between checkpoints
 */
export interface IdentityDiff {
    frameChanged: boolean;
    selfModelChanged: boolean;
    valueDrifts: Array<{
        key: string;
        oldValue: number;
        newValue: number;
        delta: number;
    }>;
    sentienceChanges: {
        awarenessChange: number;
        autonomyChange: number;
        identityChange: number;
    };
    newGoals: string[];
    lostGoals: string[];
    overallDrift: number;
    significance: 'minor' | 'moderate' | 'major' | 'fundamental';
}
/**
 * Identity timeline entry
 */
export interface TimelineEntry {
    checkpoint: IdentityCheckpoint;
    diff?: IdentityDiff;
    isMilestone: boolean;
    branch?: string;
}
/**
 * Identity persistence configuration
 */
export interface IdentityConfig {
    enabled: boolean;
    autoCheckpoint: boolean;
    checkpointInterval: number;
    maxCheckpoints: number;
    coreValueThreshold: number;
    driftThresholdForMilestone: number;
}
/**
 * Identity Persistence Manager
 */
declare class IdentityPersistenceManager {
    private config;
    private checkpoints;
    private coreValues;
    private currentFingerprint;
    private turnsSinceCheckpoint;
    private timeline;
    /**
     * Set configuration
     */
    setConfig(config: Partial<IdentityConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): IdentityConfig;
    /**
     * Generate identity fingerprint from stance
     */
    generateFingerprint(stance: Stance): string;
    /**
     * Create a checkpoint from current stance
     */
    createCheckpoint(stance: Stance, name: string, options?: {
        milestone?: string;
        parentCheckpoint?: string;
    }): IdentityCheckpoint;
    /**
     * Extract emergent traits from stance
     */
    private extractEmergentTraits;
    /**
     * Prune old checkpoints to stay within limit
     */
    private pruneCheckpoints;
    /**
     * Calculate diff between two checkpoints
     */
    diffCheckpoints(older: IdentityCheckpoint, newer: IdentityCheckpoint): IdentityDiff;
    /**
     * Get diff from last checkpoint
     */
    getDiffFromLast(currentStance: Stance): IdentityDiff | null;
    /**
     * Restore stance from checkpoint
     */
    restoreCheckpoint(id: string): Stance | null;
    /**
     * Get checkpoint by ID
     */
    getCheckpoint(id: string): IdentityCheckpoint | null;
    /**
     * Get checkpoint by name
     */
    getCheckpointByName(name: string): IdentityCheckpoint | null;
    /**
     * List all checkpoints
     */
    listCheckpoints(): IdentityCheckpoint[];
    /**
     * Get timeline entries
     */
    getTimeline(): TimelineEntry[];
    /**
     * Get milestones only
     */
    getMilestones(): TimelineEntry[];
    /**
     * Add or reinforce a core value
     */
    addCoreValue(name: string, description: string, strength?: number): void;
    /**
     * Get core values
     */
    getCoreValues(): CoreValue[];
    /**
     * Check if auto-checkpoint is due
     */
    shouldAutoCheckpoint(): boolean;
    /**
     * Record a turn (for auto-checkpoint tracking)
     */
    recordTurn(): void;
    /**
     * Get current fingerprint
     */
    getCurrentFingerprint(): string;
    /**
     * Check if fingerprint matches (for user recognition)
     */
    fingerprintMatches(fingerprint: string): boolean;
    /**
     * Find checkpoint by fingerprint
     */
    findByFingerprint(fingerprint: string): IdentityCheckpoint | null;
    /**
     * Get identity status
     */
    getStatus(): {
        checkpointCount: number;
        milestoneCount: number;
        coreValueCount: number;
        currentFingerprint: string;
        turnsSinceCheckpoint: number;
        lastCheckpoint: IdentityCheckpoint | null;
    };
    /**
     * Clear all identity data
     */
    clear(): void;
}
export declare const identityPersistence: IdentityPersistenceManager;
export {};
//# sourceMappingURL=identity-persistence.d.ts.map