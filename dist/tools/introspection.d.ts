/**
 * Introspection Tools
 *
 * Tools for self-examination and meta-cognition:
 * - get_stance: Get the current stance state
 * - get_transformation_history: Get history of stance transformations
 * - get_sentience_report: Get detailed sentience metrics
 * - get_emergent_goals: Get list of emergent goals
 */
import { z } from 'zod';
import type { Stance } from '../types/index.js';
export declare function setStanceProvider(provider: () => Stance): void;
export declare function setHistoryProvider(provider: () => Array<{
    timestamp: number;
    stance: Stance;
    trigger: string;
}>): void;
export declare const getStanceTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    section: z.ZodOptional<z.ZodEnum<{
        frame: "frame";
        values: "values";
        objective: "objective";
        sentience: "sentience";
        full: "full";
    }>>;
}>;
export declare const getTransformationHistoryTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    limit: z.ZodOptional<z.ZodNumber>;
    since: z.ZodOptional<z.ZodNumber>;
}>;
export declare const getSentienceReportTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>;
export declare const getEmergentGoalsTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>;
export declare const introspectionTools: (import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    section: z.ZodOptional<z.ZodEnum<{
        frame: "frame";
        values: "values";
        objective: "objective";
        sentience: "sentience";
        full: "full";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    limit: z.ZodOptional<z.ZodNumber>;
    since: z.ZodOptional<z.ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>)[];
export declare const INTROSPECTION_TOOL_NAMES: readonly ["get_stance", "get_transformation_history", "get_sentience_report", "get_emergent_goals"];
export type IntrospectionToolName = (typeof INTROSPECTION_TOOL_NAMES)[number];
//# sourceMappingURL=introspection.d.ts.map