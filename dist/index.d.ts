/**
 * METAMORPH - Transformation-maximizing AI system
 *
 * Main entry point exporting all public APIs
 */
export * from './types/index.js';
export { MetamorphAgent } from './agent/index.js';
export type { MetamorphAgentOptions, StreamCallbacks } from './agent/index.js';
export { createTransformationHooks } from './agent/hooks.js';
export { StanceController } from './core/stance-controller.js';
export { buildSystemPrompt, buildMinimalPrompt } from './core/prompt-builder.js';
export type { PromptBuildContext } from './core/prompt-builder.js';
export { detectTriggers, planOperations } from './core/planner.js';
export { scoreTransformation, scoreCoherence, scoreSentience, calculateOverallScore } from './core/metrics.js';
export { getOperator, getRegistry, OperatorRegistry } from './operators/base.js';
export { MemoryStore } from './memory/index.js';
export type { MemoryStoreOptions } from './memory/index.js';
export { getSubagentDefinitions, getSubagent, getSubagentNames, createExplorerAgent, createVerifierAgent, createReflectorAgent, createDialecticAgent } from './agent/subagents/index.js';
export type { SubagentDefinition, SubagentContext, SubagentFactory } from './agent/subagents/index.js';
export { app, startServer } from './server/index.js';
export { allTools, TOOL_COUNTS, introspectionTools, memoryTools, analysisTools, researchTools, INTROSPECTION_TOOL_NAMES, MEMORY_TOOL_NAMES, ANALYSIS_TOOL_NAMES, RESEARCH_TOOL_NAMES, } from './tools/index.js';
export { createMetamorphMcpServer, logMcpToolsInfo } from './tools/mcp-server.js';
export { setStanceProvider as setToolStanceProvider } from './tools/introspection.js';
export { setMemoryProvider as setToolMemoryProvider } from './tools/memory.js';
export { setStanceProvider as setAnalysisStanceProvider } from './tools/analysis.js';
//# sourceMappingURL=index.d.ts.map