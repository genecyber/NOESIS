/**
 * METAMORPH Memory Explorer Plugin
 *
 * A plugin for visualizing and exploring the memory system in 3D space.
 *
 * This plugin provides:
 * - 3D visualization of memories (spatial, temporal, hybrid modes)
 * - Memory clustering by similarity
 * - Timeline view of memory formation
 * - Semantic search across memories
 * - Interactive exploration with zoom, pan, and selection
 */

import { Brain } from 'lucide-react';
import { definePlugin } from '@/lib/plugins';
import type { WebPlugin, PluginCommand, PluginCommandContext, PluginCommandResult } from '@/lib/plugins/types';
import MemoryExplorerPanel from './MemoryExplorerPanel';
import Memory3DScene from './Memory3DScene';
export { Memory3DScene };
export type { Memory3DSceneProps, MemoryNodeData, ConnectionData } from './Memory3DScene';

/**
 * Memory Explorer Plugin Definition
 */
export const memoryExplorerPlugin: WebPlugin = definePlugin({
  manifest: {
    id: 'memory-explorer',
    name: 'Memory Explorer',
    version: '1.0.0',
    description: '3D visualization and exploration of the memory system',
    author: 'METAMORPH',
    license: 'MIT',
    metamorphVersion: '0.1.0',
    capabilities: ['storage', 'fullscreen'],
    permissions: ['memory:read', 'memory:write'],
  },

  panel: {
    id: 'memories',
    label: '3D Memories',
    icon: Brain,
    component: MemoryExplorerPanel,
    order: 7,
    defaultEnabled: true,
  },

  commands: [
    {
      name: 'explore-memories',
      aliases: ['memory-explore', 'mem-explore'],
      description: 'Launch 3D memory explorer',
      usage: '/explore-memories',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        console.log('[MemoryExplorer] Launching 3D memory explorer via command');

        // The actual launch happens in the UI, so we signal intent
        return {
          success: true,
          message: 'Opening 3D Memory Explorer. Use the panel to interact with the visualization.',
          data: { action: 'launch-explorer' },
        };
      },
    },
    {
      name: 'cluster-memories',
      aliases: ['mem-cluster'],
      description: 'Group memories by similarity',
      usage: '/cluster-memories [count]',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const clusterCount = parseInt(args[0], 10) || 5;

        console.log(`[MemoryExplorer] Clustering memories into ${clusterCount} groups`);

        try {
          // Fetch memories for clustering
          const memories = await ctx.capabilities.memory.getMemories({});

          if (memories.length === 0) {
            return {
              success: false,
              message: 'No memories found to cluster.',
            };
          }

          // Clustering logic would be implemented here
          // For now, return a placeholder response
          return {
            success: true,
            message: `Clustering ${memories.length} memories into ${clusterCount} groups. View results in the Memory Explorer panel.`,
            data: {
              action: 'cluster',
              memoryCount: memories.length,
              clusterCount,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            success: false,
            message: `Failed to cluster memories: ${errorMessage}`,
          };
        }
      },
    },
    {
      name: 'memory-timeline',
      aliases: ['mem-timeline'],
      description: 'View memories on timeline',
      usage: '/memory-timeline [days]',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const days = parseInt(args[0], 10) || 7;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        console.log(`[MemoryExplorer] Generating timeline for last ${days} days`);

        try {
          const memories = await ctx.capabilities.memory.getMemories({});
          const recentMemories = memories.filter(m => m.timestamp >= cutoff);

          if (recentMemories.length === 0) {
            return {
              success: true,
              message: `No memories found in the last ${days} days.`,
              data: { action: 'timeline', count: 0, days },
            };
          }

          // Group by day
          const byDay = new Map<string, number>();
          recentMemories.forEach(m => {
            const day = new Date(m.timestamp).toLocaleDateString();
            byDay.set(day, (byDay.get(day) || 0) + 1);
          });

          const summary = Array.from(byDay.entries())
            .map(([day, count]) => `${day}: ${count} memories`)
            .join(', ');

          return {
            success: true,
            message: `Timeline for last ${days} days: ${summary}. Total: ${recentMemories.length} memories.`,
            data: {
              action: 'timeline',
              count: recentMemories.length,
              days,
              byDay: Object.fromEntries(byDay),
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            success: false,
            message: `Failed to generate timeline: ${errorMessage}`,
          };
        }
      },
    },
  ],

  onActivate: async (capabilities) => {
    console.log('[MemoryExplorer] Activated');

    // Optionally pre-load memory stats on activation
    try {
      const memories = await capabilities.memory.getMemories({});
      console.log(`[MemoryExplorer] Found ${memories.length} memories in the system`);
    } catch (error) {
      console.warn('[MemoryExplorer] Could not load initial memory stats:', error);
    }
  },

  onDeactivate: async () => {
    console.log('[MemoryExplorer] Deactivated');
  },
});

export default memoryExplorerPlugin;
