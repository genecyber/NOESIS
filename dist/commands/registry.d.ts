/**
 * Command Registry - Central registry for all slash commands
 * Enables agent-invocable and hook-triggered command execution
 */
import type { MetamorphAgent } from '../agent/index.js';
import type { Stance, ModeConfig } from '../types/index.js';
export type TriggerType = 'memory_query' | 'identity_question' | 'evolution_check' | 'strategy_inquiry' | 'coherence_warning' | 'sentiment_shift' | 'transformation_query' | 'similarity_search';
export interface TriggerCondition {
    type: TriggerType;
    patterns: RegExp[];
    stanceConditions?: StanceCondition[];
    confidence: number;
}
export interface StanceCondition {
    field: keyof Stance | string;
    operator: 'lt' | 'gt' | 'eq' | 'contains';
    value: number | string | boolean;
}
export interface CommandResult {
    output: string;
    data?: unknown;
    shouldInjectIntoResponse: boolean;
    command: string;
    args: string[];
}
export interface CommandContext {
    agent: MetamorphAgent;
    stance: Stance;
    config: ModeConfig;
    message?: string;
    conversationHistory?: Array<{
        role: string;
        content: string;
    }>;
}
export interface CommandDefinition {
    name: string;
    aliases: string[];
    description: string;
    triggers: TriggerCondition[];
    execute: (context: CommandContext, args: string[]) => CommandResult;
    agentInvocable: boolean;
    hookTriggerable: boolean;
}
export interface DetectedTrigger {
    command: string;
    trigger: TriggerCondition;
    confidence: number;
    matchedPattern?: string;
}
declare class CommandRegistry {
    private commands;
    private aliasMap;
    /**
     * Register a command
     */
    register(command: CommandDefinition): void;
    /**
     * Get a command by name or alias
     */
    get(nameOrAlias: string): CommandDefinition | undefined;
    /**
     * List all registered commands
     */
    list(): CommandDefinition[];
    /**
     * List agent-invocable commands
     */
    listAgentInvocable(): CommandDefinition[];
    /**
     * List hook-triggerable commands
     */
    listHookTriggerable(): CommandDefinition[];
    /**
     * Execute a command
     */
    execute(nameOrAlias: string, context: CommandContext, args?: string[]): CommandResult | null;
    /**
     * Detect which commands should be triggered based on message and stance
     */
    detectTriggers(message: string, stance: Stance, config: ModeConfig, maxTriggers?: number): DetectedTrigger[];
    /**
     * Check if stance matches conditions
     */
    private checkStanceConditions;
    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue;
}
export declare const commandRegistry: CommandRegistry;
/**
 * Format command results for injection into system prompt
 */
export declare function formatCommandResultsForContext(results: CommandResult[]): string;
/**
 * Format auto-invoked commands for transparency
 */
export declare function formatAutoInvokedNotice(triggers: DetectedTrigger[]): string;
export {};
//# sourceMappingURL=registry.d.ts.map