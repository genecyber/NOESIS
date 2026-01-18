/**
 * Subagent Registry
 *
 * Defines specialized subagents for the MetamorphAgent:
 * - Explorer: Autonomous exploration of topics
 * - Verifier: Output validation and coherence checking
 * - Reflector: Self-reflection on agent behavior
 * - Dialectic: Thesis/antithesis/synthesis reasoning
 */
import type { Stance, ModeConfig } from '../../types/index.js';
/**
 * Subagent definition for the Claude Agent SDK
 */
export interface SubagentDefinition {
    name: string;
    description: string;
    systemPrompt: string;
    tools: string[];
}
/**
 * Context provided to subagent prompt builders
 */
export interface SubagentContext {
    stance: Stance;
    config: ModeConfig;
    conversationSummary?: string;
}
/**
 * Subagent factory function type
 */
export type SubagentFactory = (context: SubagentContext) => SubagentDefinition;
/**
 * Registry of all available subagents
 */
export declare const subagentFactories: Record<string, SubagentFactory>;
/**
 * Get all subagent definitions for the current context
 */
export declare function getSubagentDefinitions(context: SubagentContext): SubagentDefinition[];
/**
 * Get a specific subagent definition
 */
export declare function getSubagent(name: string, context: SubagentContext): SubagentDefinition | undefined;
/**
 * Get subagent names
 */
export declare function getSubagentNames(): string[];
export { createExplorerAgent } from './explorer.js';
export { createVerifierAgent } from './verifier.js';
export { createReflectorAgent } from './reflector.js';
export { createDialecticAgent } from './dialectic.js';
//# sourceMappingURL=index.d.ts.map