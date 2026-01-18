/**
 * Memory Tools
 *
 * Tools for persistent memory and context:
 * - store_memory: Store a memory with type and importance
 * - recall_memories: Search and retrieve memories
 * - get_memory_types: Get memory type counts
 * - delete_memory: Delete a specific memory
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
// Memory provider interface - will be injected at runtime
let memoryStore = null;
export function setMemoryProvider(provider) {
    memoryStore = provider;
}
function createSuccessResponse(data, message) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: message || 'Operation successful',
                    data,
                }, null, 2),
            },
        ],
    };
}
function createErrorResponse(error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
        ],
        isError: true,
    };
}
// =============================================================================
// TOOL 1: store_memory
// =============================================================================
const storeMemorySchema = {
    content: z.string().describe('The content of the memory to store'),
    type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Type of memory: episodic (events), semantic (facts), identity (self-knowledge). Default: episodic'),
    importance: z.number().min(0).max(100).optional().describe('Importance level (0-100). Default: 50'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata to store with the memory'),
};
export const storeMemoryTool = tool('store_memory', 'Store a memory for future recall. Use this to remember important insights, user preferences, transformation outcomes, or any information that should persist across conversation turns.', storeMemorySchema, async (args) => {
    try {
        if (!memoryStore) {
            throw new Error('Memory provider not configured');
        }
        const { content, type = 'episodic', importance = 50, metadata = {}, } = args;
        const memory = memoryStore.store({
            content,
            type,
            importance,
            metadata,
        });
        return createSuccessResponse({
            id: memory.id,
            content: memory.content,
            type: memory.type,
            importance: memory.importance,
            timestamp: memory.timestamp instanceof Date ? memory.timestamp.toISOString() : memory.timestamp,
        }, 'Memory stored successfully');
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// TOOL 2: recall_memories
// =============================================================================
const recallMemoriesSchema = {
    query: z.string().describe('Search query to find relevant memories'),
    type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Filter by memory type'),
    limit: z.number().int().min(1).max(50).optional().describe('Maximum memories to return. Default: 10'),
    minImportance: z.number().min(0).max(100).optional().describe('Minimum importance level to include'),
};
export const recallMemoriesTool = tool('recall_memories', 'Search and retrieve stored memories. Use this to recall previous insights, user preferences, or any stored information that might be relevant to the current context.', recallMemoriesSchema, async (args) => {
    try {
        if (!memoryStore) {
            throw new Error('Memory provider not configured');
        }
        const { query, type, limit = 10, minImportance } = args;
        let memories = memoryStore.recall(query, limit * 2); // Get extra for filtering
        // Apply type filter
        if (type) {
            memories = memories.filter(m => m.type === type);
        }
        // Apply importance filter
        if (minImportance !== undefined) {
            memories = memories.filter(m => m.importance >= minImportance);
        }
        // Limit results
        memories = memories.slice(0, limit);
        const formattedMemories = memories.map(m => ({
            id: m.id,
            content: m.content,
            type: m.type,
            importance: m.importance,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
            metadata: m.metadata,
        }));
        return createSuccessResponse({
            query,
            count: formattedMemories.length,
            memories: formattedMemories,
        }, `Found ${formattedMemories.length} relevant memories`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// TOOL 3: get_memory_types
// =============================================================================
const getMemoryTypesSchema = {};
export const getMemoryTypesTool = tool('get_memory_types', 'Get counts of memories by type. Useful for understanding how memories are organized.', getMemoryTypesSchema, async () => {
    try {
        if (!memoryStore) {
            throw new Error('Memory provider not configured');
        }
        const allMemories = memoryStore.getAll();
        // Count memories per type
        const typeCounts = {
            episodic: 0,
            semantic: 0,
            identity: 0,
        };
        for (const memory of allMemories) {
            typeCounts[memory.type] = (typeCounts[memory.type] || 0) + 1;
        }
        const typeDetails = Object.entries(typeCounts).map(([type, count]) => ({
            type,
            count,
            description: getTypeDescription(type),
        }));
        return createSuccessResponse({
            types: typeDetails,
            totalMemories: allMemories.length,
        }, `${allMemories.length} total memories`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function getTypeDescription(type) {
    switch (type) {
        case 'episodic':
            return 'Event-based memories of specific interactions or experiences';
        case 'semantic':
            return 'Factual knowledge and general information';
        case 'identity':
            return 'Self-knowledge and identity-related memories';
    }
}
// =============================================================================
// TOOL 4: delete_memory
// =============================================================================
const deleteMemorySchema = {
    id: z.string().describe('ID of the memory to delete'),
};
export const deleteMemoryTool = tool('delete_memory', 'Delete a specific memory by ID. Use carefully - deleted memories cannot be recovered.', deleteMemorySchema, async (args) => {
    try {
        if (!memoryStore) {
            throw new Error('Memory provider not configured');
        }
        const { id } = args;
        const success = memoryStore.delete(id);
        if (!success) {
            throw new Error(`Memory with ID "${id}" not found`);
        }
        return createSuccessResponse({
            id,
            deleted: true,
        }, 'Memory deleted successfully');
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// EXPORTS
// =============================================================================
export const memoryTools = [
    storeMemoryTool,
    recallMemoriesTool,
    getMemoryTypesTool,
    deleteMemoryTool,
];
export const MEMORY_TOOL_NAMES = [
    'store_memory',
    'recall_memories',
    'get_memory_types',
    'delete_memory',
];
//# sourceMappingURL=memory.js.map