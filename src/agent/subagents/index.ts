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

// Import subagent factories
import { createExplorerAgent } from './explorer.js';
import { createVerifierAgent } from './verifier.js';
import { createReflectorAgent } from './reflector.js';
import { createDialecticAgent } from './dialectic.js';

/**
 * Registry of all available subagents
 */
export const subagentFactories: Record<string, SubagentFactory> = {
  explorer: createExplorerAgent,
  verifier: createVerifierAgent,
  reflector: createReflectorAgent,
  dialectic: createDialecticAgent
};

/**
 * Get all subagent definitions for the current context
 */
export function getSubagentDefinitions(context: SubagentContext): SubagentDefinition[] {
  return Object.values(subagentFactories).map(factory => factory(context));
}

/**
 * Get a specific subagent definition
 */
export function getSubagent(name: string, context: SubagentContext): SubagentDefinition | undefined {
  const factory = subagentFactories[name];
  return factory ? factory(context) : undefined;
}

/**
 * Get subagent names
 */
export function getSubagentNames(): string[] {
  return Object.keys(subagentFactories);
}

// Re-export individual factories
export { createExplorerAgent } from './explorer.js';
export { createVerifierAgent } from './verifier.js';
export { createReflectorAgent } from './reflector.js';
export { createDialecticAgent } from './dialectic.js';
