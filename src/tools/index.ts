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

// Re-export all tools as a single array
import { introspectionTools } from './introspection.js';
import { memoryTools } from './memory.js';
import { analysisTools } from './analysis.js';
import { researchTools } from './research.js';

export const allTools = [
  ...introspectionTools,
  ...memoryTools,
  ...analysisTools,
  ...researchTools,
];

export const TOOL_COUNTS = {
  introspection: introspectionTools.length,
  memory: memoryTools.length,
  analysis: analysisTools.length,
  research: researchTools.length,
  total: allTools.length,
} as const;
