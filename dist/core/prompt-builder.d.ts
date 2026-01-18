/**
 * System Prompt Builder - Constructs dynamic system prompts with stance injection
 */
import { Stance, ModeConfig, PlannedOperation } from '../types/index.js';
export interface PromptBuildContext {
    stance: Stance;
    operators: PlannedOperation[];
    config: ModeConfig;
}
/**
 * Build the complete system prompt with stance and operators injected
 */
export declare function buildSystemPrompt(context: PromptBuildContext): string;
/**
 * Build a minimal system prompt for basic operation
 */
export declare function buildMinimalPrompt(): string;
//# sourceMappingURL=prompt-builder.d.ts.map