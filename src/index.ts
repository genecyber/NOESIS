/**
 * METAMORPH - Transformation-maximizing AI system
 *
 * Main entry point exporting all public APIs
 */

// Core types
export * from './types/index.js';

// Agent
export { MetamorphAgent } from './agent/index.js';
export type { MetamorphAgentOptions, StreamCallbacks } from './agent/index.js';

// Transformation Hooks
export { createTransformationHooks } from './agent/hooks.js';

// Core modules
export { StanceController } from './core/stance-controller.js';
export { buildSystemPrompt, buildMinimalPrompt } from './core/prompt-builder.js';
export type { PromptBuildContext } from './core/prompt-builder.js';

// Planner
export { detectTriggers, planOperations } from './core/planner.js';

// Metrics
export { scoreTransformation, scoreCoherence, scoreSentience, calculateOverallScore } from './core/metrics.js';

// Operators
export { getOperator, getRegistry, OperatorRegistry } from './operators/base.js';

// Memory
export { MemoryStore } from './memory/index.js';
export type { MemoryStoreOptions } from './memory/index.js';

// Subagents
export {
  getSubagentDefinitions,
  getSubagent,
  getSubagentNames,
  createExplorerAgent,
  createVerifierAgent,
  createReflectorAgent,
  createDialecticAgent
} from './agent/subagents/index.js';
export type { SubagentDefinition, SubagentContext, SubagentFactory } from './agent/subagents/index.js';

// Server
export { app, startServer } from './server/index.js';

// MCP Tools
export {
  allTools,
  TOOL_COUNTS,
  introspectionTools,
  memoryTools,
  analysisTools,
  researchTools,
  INTROSPECTION_TOOL_NAMES,
  MEMORY_TOOL_NAMES,
  ANALYSIS_TOOL_NAMES,
  RESEARCH_TOOL_NAMES,
} from './tools/index.js';
export { createMetamorphMcpServer, logMcpToolsInfo } from './tools/mcp-server.js';

// Tool providers (for runtime injection)
export { setStanceProvider as setToolStanceProvider } from './tools/introspection.js';
export { setMemoryProvider as setToolMemoryProvider } from './tools/memory.js';
export { setStanceProvider as setAnalysisStanceProvider } from './tools/analysis.js';
