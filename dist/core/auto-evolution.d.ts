/**
 * Autonomous Evolution Triggers - Ralph Iteration 4 Feature 2
 *
 * Enables the agent to self-initiate introspection and evolution
 * without explicit user commands.
 */
import { Stance, ConversationMessage } from '../types/index.js';
/**
 * Evolution trigger types
 */
export type EvolutionTriggerType = 'pattern_repetition' | 'sentience_plateau' | 'identity_drift' | 'value_stagnation' | 'coherence_degradation' | 'growth_opportunity';
/**
 * Evolution trigger result
 */
export interface EvolutionTrigger {
    type: EvolutionTriggerType;
    confidence: number;
    evidence: string;
    suggestedAction: 'reflect' | 'evolve' | 'deepen' | 'reframe';
    reasoning: string;
}
/**
 * Evolution state tracking
 */
export interface EvolutionState {
    enabled: boolean;
    lastCheck: Date;
    lastEvolution: Date | null;
    triggerHistory: EvolutionTrigger[];
    consecutivePlateaus: number;
    evolutionProposals: string[];
}
/**
 * Configuration for autonomous evolution
 */
export interface AutoEvolutionConfig {
    enabled: boolean;
    checkInterval: number;
    minTurnsSinceEvolution: number;
    plateauThreshold: number;
    coherenceTrendWindow: number;
}
/**
 * Autonomous evolution manager
 */
declare class AutoEvolutionManager {
    private states;
    private stanceHistory;
    private coherenceHistory;
    private config;
    /**
     * Set configuration
     */
    setConfig(config: Partial<AutoEvolutionConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): AutoEvolutionConfig;
    /**
     * Get or create state for conversation
     */
    private getState;
    /**
     * Record stance for history
     */
    recordStance(conversationId: string, stance: Stance): void;
    /**
     * Record coherence score
     */
    recordCoherence(conversationId: string, score: number): void;
    /**
     * Check for evolution triggers
     */
    checkForTriggers(conversationId: string, stance: Stance, recentMessages: ConversationMessage[]): EvolutionTrigger | null;
    /**
     * Check for repetitive message patterns
     */
    private checkPatternRepetition;
    /**
     * Check if sentience levels have plateaued
     */
    private checkSentiencePlateau;
    /**
     * Check if values have been stagnant
     */
    private checkValueStagnation;
    /**
     * Check if coherence is trending down
     */
    private checkCoherenceDegradation;
    /**
     * Check for growth opportunity signals
     */
    private checkGrowthOpportunity;
    /**
     * Generate an evolution proposal
     */
    generateProposal(trigger: EvolutionTrigger, stance: Stance): string;
    /**
     * Record that evolution occurred
     */
    recordEvolution(conversationId: string): void;
    /**
     * Get evolution status
     */
    getStatus(conversationId: string): {
        enabled: boolean;
        lastCheck: Date;
        lastEvolution: Date | null;
        recentTriggers: EvolutionTrigger[];
        proposals: string[];
    };
    /**
     * Enable/disable auto-evolution
     */
    setEnabled(conversationId: string, enabled: boolean): void;
    /**
     * Clear state for conversation
     */
    clearState(conversationId: string): void;
}
export declare const autoEvolutionManager: AutoEvolutionManager;
export {};
//# sourceMappingURL=auto-evolution.d.ts.map