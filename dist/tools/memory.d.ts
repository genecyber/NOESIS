/**
 * Memory Tools
 *
 * Tools for persistent memory and context:
 * - store_memory: Store a memory with type and importance
 * - recall_memories: Search and retrieve memories
 * - get_memory_types: Get memory type counts
 * - delete_memory: Delete a specific memory
 */
import { z } from 'zod';
import type { MemoryEntry } from '../types/index.js';
declare let memoryStore: {
    store: (memory: Omit<MemoryEntry, 'id' | 'timestamp' | 'decay'>) => MemoryEntry;
    recall: (query: string, limit?: number) => MemoryEntry[];
    getAll: () => MemoryEntry[];
    delete: (id: string) => boolean;
} | null;
export declare function setMemoryProvider(provider: typeof memoryStore): void;
export declare const storeMemoryTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    content: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    importance: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}>;
export declare const recallMemoriesTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    limit: z.ZodOptional<z.ZodNumber>;
    minImportance: z.ZodOptional<z.ZodNumber>;
}>;
export declare const getMemoryTypesTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}>;
export declare const deleteMemoryTool: import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    id: z.ZodString;
}>;
export declare const memoryTools: (import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    content: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    importance: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    query: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        episodic: "episodic";
        semantic: "semantic";
        identity: "identity";
    }>>;
    limit: z.ZodOptional<z.ZodNumber>;
    minImportance: z.ZodOptional<z.ZodNumber>;
}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{}> | import("@anthropic-ai/claude-agent-sdk").SdkMcpToolDefinition<{
    id: z.ZodString;
}>)[];
export declare const MEMORY_TOOL_NAMES: readonly ["store_memory", "recall_memories", "get_memory_types", "delete_memory"];
export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[number];
export {};
//# sourceMappingURL=memory.d.ts.map