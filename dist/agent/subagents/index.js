/**
 * Subagent Registry
 *
 * Defines specialized subagents for the MetamorphAgent:
 * - Explorer: Autonomous exploration of topics
 * - Verifier: Output validation and coherence checking
 * - Reflector: Self-reflection on agent behavior
 * - Dialectic: Thesis/antithesis/synthesis reasoning
 */
// Import subagent factories
import { createExplorerAgent } from './explorer.js';
import { createVerifierAgent } from './verifier.js';
import { createReflectorAgent } from './reflector.js';
import { createDialecticAgent } from './dialectic.js';
/**
 * Registry of all available subagents
 */
export const subagentFactories = {
    explorer: createExplorerAgent,
    verifier: createVerifierAgent,
    reflector: createReflectorAgent,
    dialectic: createDialecticAgent
};
/**
 * Get all subagent definitions for the current context
 */
export function getSubagentDefinitions(context) {
    return Object.values(subagentFactories).map(factory => factory(context));
}
/**
 * Get a specific subagent definition
 */
export function getSubagent(name, context) {
    const factory = subagentFactories[name];
    return factory ? factory(context) : undefined;
}
/**
 * Get subagent names
 */
export function getSubagentNames() {
    return Object.keys(subagentFactories);
}
// Re-export individual factories
export { createExplorerAgent } from './explorer.js';
export { createVerifierAgent } from './verifier.js';
export { createReflectorAgent } from './reflector.js';
export { createDialecticAgent } from './dialectic.js';
//# sourceMappingURL=index.js.map