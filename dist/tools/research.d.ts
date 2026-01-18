/**
 * Research Tools
 *
 * General-purpose research tools adapted from hustle-v5 patterns:
 * - web_search: Search the web for information
 * - web_scrape: Extract content from a webpage
 *
 * These tools use fetch for basic web access.
 * For production use, consider integrating with Firecrawl or similar APIs.
 */
import { z } from 'zod';
export declare const webSearchTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}>;
export declare const webScrapeTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    url: z.ZodString;
    selector: z.ZodOptional<z.ZodString>;
    maxLength: z.ZodOptional<z.ZodNumber>;
}>;
export declare const researchTools: (import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    url: z.ZodString;
    selector: z.ZodOptional<z.ZodString>;
    maxLength: z.ZodOptional<z.ZodNumber>;
}>)[];
export declare const RESEARCH_TOOL_NAMES: readonly ["web_search", "web_scrape"];
export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number];
//# sourceMappingURL=research.d.ts.map