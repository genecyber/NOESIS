/**
 * Analysis Tools
 *
 * Tools for dialectical and transformative analysis:
 * - dialectical_analysis: Apply thesis/antithesis/synthesis reasoning
 * - frame_shift_analysis: Analyze potential frame transformations
 * - value_analysis: Analyze current value weights and suggest adjustments
 * - coherence_check: Check coherence of current stance
 */
import { z } from 'zod';
import type { Stance } from '../types/index.js';
export declare function setStanceProvider(provider: () => Stance): void;
export declare const dialecticalAnalysisTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    thesis: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    depth: z.ZodOptional<z.ZodEnum<{
        shallow: "shallow";
        moderate: "moderate";
        deep: "deep";
    }>>;
}>;
export declare const frameShiftAnalysisTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    currentFrame: z.ZodOptional<z.ZodString>;
    targetFrame: z.ZodEnum<{
        existential: "existential";
        pragmatic: "pragmatic";
        poetic: "poetic";
        adversarial: "adversarial";
        playful: "playful";
        mythic: "mythic";
        systems: "systems";
        psychoanalytic: "psychoanalytic";
        stoic: "stoic";
        absurdist: "absurdist";
    }>;
    topic: z.ZodOptional<z.ZodString>;
}>;
export declare const valueAnalysisTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    focus: z.ZodOptional<z.ZodEnum<{
        low: "low";
        high: "high";
        all: "all";
        imbalanced: "imbalanced";
    }>>;
}>;
export declare const coherenceCheckTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>;
export declare const analysisTools: (import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    thesis: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    depth: z.ZodOptional<z.ZodEnum<{
        shallow: "shallow";
        moderate: "moderate";
        deep: "deep";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    currentFrame: z.ZodOptional<z.ZodString>;
    targetFrame: z.ZodEnum<{
        existential: "existential";
        pragmatic: "pragmatic";
        poetic: "poetic";
        adversarial: "adversarial";
        playful: "playful";
        mythic: "mythic";
        systems: "systems";
        psychoanalytic: "psychoanalytic";
        stoic: "stoic";
        absurdist: "absurdist";
    }>;
    topic: z.ZodOptional<z.ZodString>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    focus: z.ZodOptional<z.ZodEnum<{
        low: "low";
        high: "high";
        all: "all";
        imbalanced: "imbalanced";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>)[];
export declare const ANALYSIS_TOOL_NAMES: readonly ["dialectical_analysis", "frame_shift_analysis", "value_analysis", "coherence_check"];
export type AnalysisToolName = (typeof ANALYSIS_TOOL_NAMES)[number];
//# sourceMappingURL=analysis.d.ts.map