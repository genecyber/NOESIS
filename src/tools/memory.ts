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
import type { MemoryEntry } from '../types/index.js';
import { getEmbeddingService } from '../embeddings/service.js';

// Memory provider interface - will be injected at runtime
let memoryStore: {
  store: (memory: Omit<MemoryEntry, 'id' | 'timestamp' | 'decay'>) => MemoryEntry;
  recall: (query: string, limit?: number) => MemoryEntry[];
  getAll: () => MemoryEntry[];
  delete: (id: string) => boolean;
  searchMemories: (query: {
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  }) => MemoryEntry[];
  semanticSearch: (queryEmbedding: number[], options?: {
    type?: 'episodic' | 'semantic' | 'identity';
    minSimilarity?: number;
    limit?: number;
  }) => Array<MemoryEntry & { similarity: number }>;
  // Batch operations (added for power-user tools)
  updateMemoryContent: (id: string, newContent: string) => boolean;
  batchDelete: (ids: string[]) => number;
  getMemoriesWithEmbeddings: () => Array<MemoryEntry & { embedding: number[] }>;
} | null = null;

export function setMemoryProvider(provider: typeof memoryStore): void {
  memoryStore = provider;
}

function createSuccessResponse(data: unknown, message?: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            message: message || 'Operation successful',
            data,
          },
          null,
          2
        ),
      },
    ],
  };
}

function createErrorResponse(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    content: [
      {
        type: 'text' as const,
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

type StoreMemoryArgs = {
  content: string;
  type?: 'episodic' | 'semantic' | 'identity';
  importance?: number;
  metadata?: Record<string, unknown>;
};

export const storeMemoryTool = tool(
  'store_memory',
  'Store a memory for future recall. Use this to remember important insights, user preferences, transformation outcomes, or any information that should persist across conversation turns.',
  storeMemorySchema,
  async (args: StoreMemoryArgs) => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const {
        content,
        type = 'episodic',
        importance = 50,
        metadata = {},
      } = args;

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
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 2: recall_memories
// =============================================================================

const recallMemoriesSchema = {
  query: z.string().optional().describe('Semantic search query to find relevant memories. If provided, uses embedding-based similarity search.'),
  type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Filter by memory type'),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum memories to return. Default: 10'),
  minImportance: z.number().min(0).max(100).optional().describe('Minimum importance level to include (used when no query provided)'),
};

type RecallMemoriesArgs = {
  query?: string;
  type?: 'episodic' | 'semantic' | 'identity';
  limit?: number;
  minImportance?: number;
};

export const recallMemoriesTool = tool(
  'recall_memories',
  'Search and retrieve stored memories. Use this to recall previous insights, user preferences, or any stored information that might be relevant to the current context. When a query is provided, uses semantic similarity search for better relevance.',
  recallMemoriesSchema,
  async (args: RecallMemoriesArgs) => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const { query, type, limit = 10, minImportance } = args;

      let formattedMemories: Array<{
        id: string;
        content: string;
        type: string;
        importance: number;
        timestamp: string;
        metadata: Record<string, unknown> | undefined;
        similarity?: number;
      }>;

      if (query) {
        // Use semantic search when query is provided
        const embeddingService = getEmbeddingService();
        const queryEmbedding = await embeddingService.embed(query);
        const memories = memoryStore.semanticSearch(queryEmbedding, {
          type,
          minSimilarity: 0.3,
          limit,
        });

        formattedMemories = memories.map(m => ({
          id: m.id,
          content: m.content,
          type: m.type,
          importance: m.importance,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
          metadata: m.metadata,
          similarity: Math.round(m.similarity * 100) / 100, // Round to 2 decimal places
        }));
      } else {
        // Fall back to type/importance filtering when no query provided
        const memories = memoryStore.searchMemories({
          type,
          minImportance,
          limit,
        });

        formattedMemories = memories.map(m => ({
          id: m.id,
          content: m.content,
          type: m.type,
          importance: m.importance,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
          metadata: m.metadata,
        }));
      }

      return createSuccessResponse({
        query: query || null,
        searchType: query ? 'semantic' : 'filter',
        count: formattedMemories.length,
        memories: formattedMemories,
      }, `Found ${formattedMemories.length} relevant memories${query ? ' via semantic search' : ''}`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 3: get_memory_types
// =============================================================================

const getMemoryTypesSchema = {};

export const getMemoryTypesTool = tool(
  'get_memory_types',
  'Get counts of memories by type. Useful for understanding how memories are organized.',
  getMemoryTypesSchema,
  async () => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const allMemories = memoryStore.getAll();

      // Count memories per type
      const typeCounts: Record<string, number> = {
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
        description: getTypeDescription(type as 'episodic' | 'semantic' | 'identity'),
      }));

      return createSuccessResponse({
        types: typeDetails,
        totalMemories: allMemories.length,
      }, `${allMemories.length} total memories`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

function getTypeDescription(type: 'episodic' | 'semantic' | 'identity'): string {
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

type DeleteMemoryArgs = {
  id: string;
};

export const deleteMemoryTool = tool(
  'delete_memory',
  'Delete a specific memory by ID. Use carefully - deleted memories cannot be recovered.',
  deleteMemorySchema,
  async (args: DeleteMemoryArgs) => {
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
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 5: memory_find_replace
// =============================================================================

const memoryFindReplaceSchema = {
  find: z.string().describe('Text or regex pattern to find'),
  replace: z.string().describe('Replacement text'),
  type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Filter by memory type'),
  regex: z.boolean().optional().default(false).describe('Treat find as regex pattern'),
  dryRun: z.boolean().optional().default(true).describe('Preview changes without applying (default: true for safety)'),
};

type MemoryFindReplaceArgs = {
  find: string;
  replace: string;
  type?: 'episodic' | 'semantic' | 'identity';
  regex?: boolean;
  dryRun?: boolean;
};

export const memoryFindReplaceTool = tool(
  'memory_find_replace',
  'Find and replace text across multiple memories. Like sed for your memories. Defaults to dry run for safety.',
  memoryFindReplaceSchema,
  async (args: MemoryFindReplaceArgs) => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const {
        find,
        replace,
        type,
        regex = false,
        dryRun = true,
      } = args;

      // Get all memories, optionally filtered by type
      const allMemories = memoryStore.getAll();
      const memories = type ? allMemories.filter(m => m.type === type) : allMemories;

      // Build the search pattern
      let pattern: RegExp;
      try {
        pattern = regex ? new RegExp(find, 'g') : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${find}`);
      }

      // Find matching memories and compute replacements
      const changes: Array<{
        id: string;
        type: string;
        before: string;
        after: string;
        matchCount: number;
      }> = [];

      for (const memory of memories) {
        const matches = memory.content.match(pattern);
        if (matches && matches.length > 0) {
          const newContent = memory.content.replace(pattern, replace);
          if (newContent !== memory.content) {
            changes.push({
              id: memory.id,
              type: memory.type,
              before: memory.content.length > 200 ? memory.content.substring(0, 200) + '...' : memory.content,
              after: newContent.length > 200 ? newContent.substring(0, 200) + '...' : newContent,
              matchCount: matches.length,
            });
          }
        }
      }

      if (changes.length === 0) {
        return createSuccessResponse({
          dryRun,
          pattern: find,
          replacement: replace,
          memoriesAffected: 0,
          changes: [],
        }, 'No memories matched the pattern');
      }

      // Apply changes if not a dry run
      if (!dryRun) {
        let appliedCount = 0;
        for (const change of changes) {
          const memory = memories.find(m => m.id === change.id);
          if (memory) {
            const newContent = memory.content.replace(pattern, replace);
            const success = memoryStore.updateMemoryContent(change.id, newContent);
            if (success) appliedCount++;
          }
        }

        return createSuccessResponse({
          dryRun: false,
          pattern: find,
          replacement: replace,
          memoriesAffected: appliedCount,
          changes: changes.map(c => ({
            id: c.id,
            type: c.type,
            matchCount: c.matchCount,
          })),
        }, `Successfully updated ${appliedCount} memories`);
      }

      return createSuccessResponse({
        dryRun: true,
        pattern: find,
        replacement: replace,
        memoriesAffected: changes.length,
        preview: changes,
      }, `Preview: ${changes.length} memories would be updated. Set dryRun=false to apply.`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 6: memory_batch_delete
// =============================================================================

const memoryBatchDeleteSchema = {
  type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Delete memories of this type'),
  olderThanDays: z.number().optional().describe('Delete memories older than N days'),
  belowImportance: z.number().min(0).max(100).optional().describe('Delete memories below this importance (0-100)'),
  matchingPattern: z.string().optional().describe('Delete memories containing this text/regex pattern'),
  ids: z.array(z.string()).optional().describe('Specific memory IDs to delete'),
  dryRun: z.boolean().optional().default(true).describe('Preview deletions without applying (default: true for safety)'),
};

type MemoryBatchDeleteArgs = {
  type?: 'episodic' | 'semantic' | 'identity';
  olderThanDays?: number;
  belowImportance?: number;
  matchingPattern?: string;
  ids?: string[];
  dryRun?: boolean;
};

export const memoryBatchDeleteTool = tool(
  'memory_batch_delete',
  'Delete multiple memories matching criteria. Use with caution. Defaults to dry run for safety.',
  memoryBatchDeleteSchema,
  async (args: MemoryBatchDeleteArgs) => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const {
        type,
        olderThanDays,
        belowImportance,
        matchingPattern,
        ids,
        dryRun = true,
      } = args;

      // Require at least one filter criterion
      if (!type && olderThanDays === undefined && belowImportance === undefined && !matchingPattern && !ids) {
        throw new Error('At least one filter criterion is required (type, olderThanDays, belowImportance, matchingPattern, or ids)');
      }

      const allMemories = memoryStore.getAll();
      let toDelete: MemoryEntry[] = [...allMemories];

      // Apply filters
      if (ids && ids.length > 0) {
        // If specific IDs provided, only consider those
        const idSet = new Set(ids);
        toDelete = toDelete.filter(m => idSet.has(m.id));
      }

      if (type) {
        toDelete = toDelete.filter(m => m.type === type);
      }

      if (olderThanDays !== undefined) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        toDelete = toDelete.filter(m => {
          const timestamp = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
          return timestamp < cutoffDate;
        });
      }

      if (belowImportance !== undefined) {
        toDelete = toDelete.filter(m => m.importance < belowImportance);
      }

      if (matchingPattern) {
        try {
          const pattern = new RegExp(matchingPattern, 'i');
          toDelete = toDelete.filter(m => pattern.test(m.content));
        } catch {
          // Treat as literal string if not valid regex
          toDelete = toDelete.filter(m => m.content.includes(matchingPattern));
        }
      }

      if (toDelete.length === 0) {
        return createSuccessResponse({
          dryRun,
          memoriesDeleted: 0,
          criteria: { type, olderThanDays, belowImportance, matchingPattern, ids },
        }, 'No memories matched the criteria');
      }

      // Build preview
      const preview = toDelete.map(m => ({
        id: m.id,
        type: m.type,
        importance: m.importance,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
        contentPreview: m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content,
      }));

      if (!dryRun) {
        // Actually delete
        const idsToDelete = toDelete.map(m => m.id);
        const deletedCount = memoryStore.batchDelete(idsToDelete);

        return createSuccessResponse({
          dryRun: false,
          memoriesDeleted: deletedCount,
          criteria: { type, olderThanDays, belowImportance, matchingPattern, ids },
          deletedIds: idsToDelete,
        }, `Successfully deleted ${deletedCount} memories`);
      }

      return createSuccessResponse({
        dryRun: true,
        memoriesMatched: toDelete.length,
        criteria: { type, olderThanDays, belowImportance, matchingPattern, ids },
        preview,
      }, `Preview: ${toDelete.length} memories would be deleted. Set dryRun=false to apply.`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 7: memory_consolidate
// =============================================================================

const memoryConsolidateSchema = {
  type: z.enum(['episodic', 'semantic', 'identity']).optional().describe('Filter by memory type'),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.85).describe('Similarity threshold for merging (0-1). Default: 0.85'),
  dryRun: z.boolean().optional().default(true).describe('Preview consolidation without applying (default: true for safety)'),
};

type MemoryConsolidateArgs = {
  type?: 'episodic' | 'semantic' | 'identity';
  similarityThreshold?: number;
  dryRun?: boolean;
};

interface MemoryCluster {
  representative: MemoryEntry & { embedding: number[] };
  members: Array<MemoryEntry & { embedding: number[]; similarity: number }>;
}

export const memoryConsolidateTool = tool(
  'memory_consolidate',
  'Find and merge semantically similar memories into consolidated entries. Uses embeddings to find duplicates and near-duplicates. Defaults to dry run for safety.',
  memoryConsolidateSchema,
  async (args: MemoryConsolidateArgs) => {
    try {
      if (!memoryStore) {
        throw new Error('Memory provider not configured');
      }

      const {
        type,
        similarityThreshold = 0.85,
        dryRun = true,
      } = args;

      // Get memories with embeddings
      let memories = memoryStore.getMemoriesWithEmbeddings();

      if (type) {
        memories = memories.filter(m => m.type === type);
      }

      if (memories.length < 2) {
        return createSuccessResponse({
          dryRun,
          clustersFound: 0,
          memoriesConsolidated: 0,
          message: 'Not enough memories with embeddings to consolidate',
        }, 'Need at least 2 memories with embeddings to consolidate');
      }

      // Find clusters of similar memories
      const clusters: MemoryCluster[] = [];
      const processed = new Set<string>();

      // Helper: compute cosine similarity
      const cosineSimilarity = (a: number[], b: number[]): number => {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          magnitudeA += a[i] * a[i];
          magnitudeB += b[i] * b[i];
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
      };

      // Sort by importance descending - higher importance memories become cluster representatives
      memories.sort((a, b) => b.importance - a.importance);

      for (const memory of memories) {
        if (processed.has(memory.id)) continue;

        const cluster: MemoryCluster = {
          representative: memory,
          members: [],
        };

        // Find similar memories
        for (const other of memories) {
          if (other.id === memory.id || processed.has(other.id)) continue;

          const similarity = cosineSimilarity(memory.embedding, other.embedding);
          if (similarity >= similarityThreshold) {
            cluster.members.push({ ...other, similarity });
            processed.add(other.id);
          }
        }

        // Only include clusters with at least one member (besides representative)
        if (cluster.members.length > 0) {
          processed.add(memory.id);
          clusters.push(cluster);
        }
      }

      if (clusters.length === 0) {
        return createSuccessResponse({
          dryRun,
          threshold: similarityThreshold,
          clustersFound: 0,
          memoriesConsolidated: 0,
        }, `No similar memories found above threshold ${similarityThreshold}`);
      }

      // Build preview of consolidations
      const consolidationPreview = clusters.map(cluster => ({
        keepId: cluster.representative.id,
        keepContent: cluster.representative.content.length > 150
          ? cluster.representative.content.substring(0, 150) + '...'
          : cluster.representative.content,
        keepImportance: cluster.representative.importance,
        mergeIds: cluster.members.map(m => m.id),
        mergeContents: cluster.members.map(m => ({
          id: m.id,
          similarity: Math.round(m.similarity * 100) / 100,
          contentPreview: m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content,
        })),
        totalMerged: cluster.members.length,
      }));

      const totalToConsolidate = clusters.reduce((sum, c) => sum + c.members.length, 0);

      if (!dryRun) {
        // Actually consolidate: delete duplicate memories, keep representative
        // The representative already has the highest importance, so we just delete the members
        let deletedCount = 0;
        for (const cluster of clusters) {
          const memberIds = cluster.members.map(m => m.id);
          deletedCount += memoryStore.batchDelete(memberIds);
        }

        return createSuccessResponse({
          dryRun: false,
          threshold: similarityThreshold,
          clustersConsolidated: clusters.length,
          memoriesRemoved: deletedCount,
          keptMemoryIds: clusters.map(c => c.representative.id),
        }, `Consolidated ${clusters.length} clusters, removed ${deletedCount} duplicate memories`);
      }

      return createSuccessResponse({
        dryRun: true,
        threshold: similarityThreshold,
        clustersFound: clusters.length,
        memoriesWouldBeRemoved: totalToConsolidate,
        preview: consolidationPreview,
      }, `Preview: Would consolidate ${clusters.length} clusters, removing ${totalToConsolidate} duplicate memories. Set dryRun=false to apply.`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

export const memoryTools = [
  storeMemoryTool,
  recallMemoriesTool,
  getMemoryTypesTool,
  deleteMemoryTool,
  memoryFindReplaceTool,
  memoryBatchDeleteTool,
  memoryConsolidateTool,
];

export const MEMORY_TOOL_NAMES = [
  'store_memory',
  'recall_memories',
  'get_memory_types',
  'delete_memory',
  'memory_find_replace',
  'memory_batch_delete',
  'memory_consolidate',
] as const;

export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[number];
