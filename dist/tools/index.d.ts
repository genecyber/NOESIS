/**
 * METAMORPH MCP Tools
 *
 * General-purpose tools for transformation-maximizing AI:
 *
 * Introspection Tools:
 * - get_stance: Get the current stance state
 * - get_transformation_history: Get history of stance transformations
 * - get_sentience_report: Get detailed sentience metrics
 *
 * Memory Tools:
 * - store_memory: Store a memory with context
 * - recall_memories: Search and retrieve memories
 * - get_memory_categories: Get memory organization
 *
 * Analysis Tools:
 * - dialectical_analysis: Apply thesis/antithesis/synthesis
 * - frame_shift: Propose a frame transformation
 * - value_analysis: Analyze current value weights
 *
 * Research Tools (adapted from hustle-v5 patterns):
 * - web_search: Search the web for information
 * - web_scrape: Extract content from a webpage
 */
export { introspectionTools, INTROSPECTION_TOOL_NAMES } from './introspection.js';
export { memoryTools, MEMORY_TOOL_NAMES } from './memory.js';
export { analysisTools, ANALYSIS_TOOL_NAMES } from './analysis.js';
export { researchTools, RESEARCH_TOOL_NAMES } from './research.js';
export declare const allTools: (import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    section: import("zod").ZodOptional<import("zod").ZodEnum<{
        frame: "frame";
        values: "values";
        objective: "objective";
        sentience: "sentience";
        full: "full";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    limit: import("zod").ZodOptional<import("zod").ZodNumber>;
    since: import("zod").ZodOptional<import("zod").ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    content: import("zod").ZodString;
    type: import("zod").ZodOptional<import("zod").ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    importance: import("zod").ZodOptional<import("zod").ZodNumber>;
    metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: import("zod").ZodString;
    type: import("zod").ZodOptional<import("zod").ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    limit: import("zod").ZodOptional<import("zod").ZodNumber>;
    minImportance: import("zod").ZodOptional<import("zod").ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    id: import("zod").ZodString;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    thesis: import("zod").ZodString;
    context: import("zod").ZodOptional<import("zod").ZodString>;
    depth: import("zod").ZodOptional<import("zod").ZodEnum<{
        shallow: "shallow";
        moderate: "moderate";
        deep: "deep";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    currentFrame: import("zod").ZodOptional<import("zod").ZodString>;
    targetFrame: import("zod").ZodEnum<{
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
    topic: import("zod").ZodOptional<import("zod").ZodString>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    focus: import("zod").ZodOptional<import("zod").ZodEnum<{
        low: "low";
        high: "high";
        all: "all";
        imbalanced: "imbalanced";
    }>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: import("zod").ZodString;
    limit: import("zod").ZodOptional<import("zod").ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    url: import("zod").ZodString;
    selector: import("zod").ZodOptional<import("zod").ZodString>;
    maxLength: import("zod").ZodOptional<import("zod").ZodNumber>;
}>)[];
export declare const TOOL_COUNTS: {
    readonly introspection: number;
    readonly memory: number;
    readonly analysis: number;
    readonly research: number;
    readonly total: number;
};
//# sourceMappingURL=index.d.ts.map