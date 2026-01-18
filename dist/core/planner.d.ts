/**
 * Planner - Trigger detection and operation planning
 *
 * Analyzes user messages to detect transformation triggers and plans operators to apply
 */
import { TriggerResult, Stance, ModeConfig, ConversationMessage, OperatorName, PlannedOperation } from '../types/index.js';
import { OperatorRegistry } from '../operators/base.js';
/**
 * Detect triggers in a user message
 */
export declare function detectTriggers(message: string, history: ConversationMessage[]): TriggerResult[];
/**
 * Plan operations based on triggers and configuration
 */
export declare function planOperations(triggers: TriggerResult[], stance: Stance, config: ModeConfig, registry: OperatorRegistry): PlannedOperation[];
/**
 * Record operator usage for fatigue detection
 */
export declare function recordOperatorUsage(conversationId: string, operators: OperatorName[]): void;
/**
 * Detect operator fatigue - same operators used repeatedly
 */
export declare function detectOperatorFatigue(conversationId: string, config: ModeConfig): TriggerResult | null;
/**
 * Get operators that should be avoided due to fatigue
 */
export declare function getFatiguedOperators(conversationId: string, config: ModeConfig): OperatorName[];
/**
 * Clear operator history for a conversation
 */
export declare function clearOperatorHistory(conversationId: string): void;
//# sourceMappingURL=planner.d.ts.map