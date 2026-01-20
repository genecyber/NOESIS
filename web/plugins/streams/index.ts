/**
 * METAMORPH Streams Plugin
 *
 * A plugin for real-time data streams from agent scripts.
 *
 * This plugin provides:
 * - Real-time WebSocket stream subscriptions
 * - Stream list and discovery
 * - Event visualization and history
 * - Auto-scroll and filtering capabilities
 */

'use client';

import { Radio } from 'lucide-react';
import { definePlugin } from '@/lib/plugins';
import type { WebPlugin, PluginCommandContext, PluginCommandResult } from '@/lib/plugins/types';
import StreamsPanel from './StreamsPanel';

// Export types and hooks for external usage
export * from './types';
export * from './hooks';

/**
 * Streams Plugin Definition
 */
export const streamsPlugin: WebPlugin = definePlugin({
  manifest: {
    id: 'streams',
    name: 'Streams',
    version: '1.0.0',
    description: 'Real-time data streams from agent scripts',
    author: 'METAMORPH',
    license: 'MIT',
    metamorphVersion: '0.1.0',
    capabilities: ['storage'],
    permissions: [],
  },

  panel: {
    id: 'streams-panel',
    label: 'Streams',
    icon: Radio,
    component: StreamsPanel,
    order: 8,
    defaultEnabled: true,
  },

  commands: [
    {
      name: 'list-streams',
      aliases: ['streams'],
      description: 'List all available streams',
      usage: '/list-streams',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        console.log('[Streams] Listing available streams');

        return {
          success: true,
          message: 'View available streams in the Streams panel.',
          data: { action: 'list-streams' },
        };
      },
    },
    {
      name: 'subscribe-stream',
      aliases: ['sub-stream'],
      description: 'Subscribe to a stream channel',
      usage: '/subscribe-stream <channel>',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const channel = args[0];

        if (!channel) {
          return {
            success: false,
            message: 'Please specify a channel to subscribe to. Usage: /subscribe-stream <channel>',
          };
        }

        console.log(`[Streams] Subscribing to channel: ${channel}`);

        return {
          success: true,
          message: `Subscribed to channel "${channel}". View events in the Streams panel.`,
          data: { action: 'subscribe', channel },
        };
      },
    },
  ],

  onActivate: async (capabilities) => {
    console.log('[Streams] Activated');
  },

  onDeactivate: async () => {
    console.log('[Streams] Deactivated');
  },
});

export default streamsPlugin;
