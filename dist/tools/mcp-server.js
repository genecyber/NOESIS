/**
 * METAMORPH MCP Server
 *
 * Model Context Protocol server for exposing METAMORPH tools to external agents.
 *
 * Tool Categories:
 * - Introspection (4): get_stance, get_transformation_history, get_sentience_report, get_emergent_goals
 * - Memory (4): store_memory, recall_memories, get_memory_categories, delete_memory
 * - Analysis (4): dialectical_analysis, frame_shift_analysis, value_analysis, coherence_check
 * - Research (2): web_search, web_scrape
 *
 * Total: 14 tools
 */
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { allTools, TOOL_COUNTS } from './index.js';
/**
 * Log MCP tool registration info. Call once at server startup.
 */
export function logMcpToolsInfo() {
    console.log(`📦 Registered ${TOOL_COUNTS.total} MCP tools:`);
    console.log(`   - Introspection: ${TOOL_COUNTS.introspection} tools`);
    console.log(`   - Memory: ${TOOL_COUNTS.memory} tools`);
    console.log(`   - Analysis: ${TOOL_COUNTS.analysis} tools`);
    console.log(`   - Research: ${TOOL_COUNTS.research} tools`);
}
/**
 * Create the METAMORPH MCP server with all tools registered.
 *
 * Tool Categories:
 * - Introspection tools (4):
 *   - get_stance: Get current stance state
 *   - get_transformation_history: Get stance transformation history
 *   - get_sentience_report: Get detailed sentience metrics
 *   - get_emergent_goals: Get emergent goals list
 *
 * - Memory tools (4):
 *   - store_memory: Store a memory with category and importance
 *   - recall_memories: Search and retrieve memories
 *   - get_memory_categories: Get all memory categories
 *   - delete_memory: Delete a specific memory
 *
 * - Analysis tools (4):
 *   - dialectical_analysis: Apply thesis/antithesis/synthesis reasoning
 *   - frame_shift_analysis: Analyze potential frame transformations
 *   - value_analysis: Analyze current value weights
 *   - coherence_check: Check stance coherence
 *
 * - Research tools (2):
 *   - web_search: Search the web (placeholder - needs API integration)
 *   - web_scrape: Extract content from webpages
 *
 * @returns MCP server instance with all tools registered
 */
export function createMetamorphMcpServer() {
    return createSdkMcpServer({
        name: 'metamorph-tools',
        version: '1.0.0',
        tools: allTools,
    });
}
export { allTools, TOOL_COUNTS };
//# sourceMappingURL=mcp-server.js.map