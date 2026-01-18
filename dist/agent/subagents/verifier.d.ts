/**
 * Verifier Subagent
 *
 * Validates output quality, coherence, and correctness.
 * Designed to catch:
 * - Coherence violations
 * - Factual errors
 * - Stance drift beyond acceptable bounds
 * - Safety concerns
 */
import type { SubagentDefinition, SubagentContext } from './index.js';
/**
 * Create a Verifier agent customized to the current context
 */
export declare function createVerifierAgent(context: SubagentContext): SubagentDefinition;
//# sourceMappingURL=verifier.d.ts.map