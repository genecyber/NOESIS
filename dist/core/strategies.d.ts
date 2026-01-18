/**
 * Multi-Turn Operator Strategies - Ralph Iteration 3 Feature 3
 *
 * Defines named sequences of operators that unfold across multiple turns
 * for complex transformation goals.
 */
import { OperatorName, TriggerType, Stance } from '../types/index.js';
/**
 * Strategy state tracking
 */
export interface StrategyState {
    strategyName: string;
    currentStep: number;
    totalSteps: number;
    startedAt: Date;
    completedSteps: OperatorName[];
    paused: boolean;
}
/**
 * Strategy definition
 */
export interface OperatorStrategy {
    name: string;
    description: string;
    steps: OperatorName[];
    triggers: TriggerType[];
    minIntensity: number;
    cooldownTurns: number;
}
/**
 * Predefined multi-turn strategies
 */
export declare const OPERATOR_STRATEGIES: OperatorStrategy[];
/**
 * Strategy manager - tracks active strategies per conversation
 */
declare class StrategyManager {
    private activeStrategies;
    private cooldowns;
    /**
     * Get the current strategy state for a conversation
     */
    getActiveStrategy(conversationId: string): StrategyState | undefined;
    /**
     * Check if a strategy is in cooldown
     */
    isInCooldown(conversationId: string, strategyName: string): boolean;
    /**
     * Start a new strategy
     */
    startStrategy(conversationId: string, strategyName: string): StrategyState | null;
    /**
     * Get the next operator to apply from active strategy
     */
    getNextStrategyOperator(conversationId: string): OperatorName | null;
    /**
     * Advance to next step after operator completes
     */
    advanceStrategy(conversationId: string, completedOperator: OperatorName): boolean;
    /**
     * Complete a strategy and set cooldown
     */
    private completeStrategy;
    /**
     * Pause the current strategy
     */
    pauseStrategy(conversationId: string): void;
    /**
     * Resume a paused strategy
     */
    resumeStrategy(conversationId: string): void;
    /**
     * Cancel the current strategy
     */
    cancelStrategy(conversationId: string): void;
    /**
     * Select a strategy to activate based on triggers
     */
    selectStrategy(conversationId: string, triggers: TriggerType[], _stance: Stance, // Reserved for future stance-based strategy selection
    intensity: number): OperatorStrategy | null;
    /**
     * List available strategies
     */
    listStrategies(): OperatorStrategy[];
    /**
     * Get strategy progress for display
     */
    getStrategyProgress(conversationId: string): {
        name: string;
        current: number;
        total: number;
        completedOps: string[];
        nextOp: string | null;
    } | null;
}
export declare const strategyManager: StrategyManager;
/**
 * Get strategy by name
 */
export declare function getStrategy(name: string): OperatorStrategy | undefined;
/**
 * List all strategy names
 */
export declare function getStrategyNames(): string[];
export {};
//# sourceMappingURL=strategies.d.ts.map