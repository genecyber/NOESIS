/**
 * METAMORPH Subagents Plugin
 *
 * Provides a panel for viewing and invoking specialized subagents:
 * - Explorer: Deep topic investigation
 * - Verifier: Output validation
 * - Reflector: Self-reflection
 * - Dialectic: Thesis/antithesis/synthesis
 */

import { Users } from 'lucide-react';
import { definePlugin } from '@/lib/plugins';
import type { WebPlugin, PluginCommandContext, PluginCommandResult } from '@/lib/plugins/types';
import SubagentsPanel from './SubagentsPanel';

/**
 * Subagents Plugin Definition
 */
export const subagentsPlugin: WebPlugin = definePlugin({
  manifest: {
    id: 'subagents',
    name: 'Subagents',
    version: '1.0.0',
    description: 'Specialized subagent visualization and control',
    author: 'METAMORPH',
    license: 'MIT',
    metamorphVersion: '0.1.0',
    capabilities: ['storage'],
    permissions: ['config:read', 'config:write'],
  },

  panel: {
    id: 'subagents',
    label: 'Subagents',
    icon: Users,
    component: SubagentsPanel,
    order: 4,
    defaultEnabled: true,
  },

  commands: [
    {
      name: 'subagent',
      aliases: ['agent', 'invoke'],
      description: 'Invoke a specialized subagent',
      usage: '/subagent <explorer|verifier|reflector|dialectic> [task]',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const [subagentName, ...taskParts] = args;
        const task = taskParts.join(' ');

        const validSubagents = ['explorer', 'verifier', 'reflector', 'dialectic'];

        if (!subagentName || !validSubagents.includes(subagentName.toLowerCase())) {
          return {
            success: false,
            message: `Usage: /subagent <${validSubagents.join('|')}> [task]\n\nAvailable subagents:\n- explorer: Deep research and investigation\n- verifier: Output validation and quality check\n- reflector: Self-reflection on behavior patterns\n- dialectic: Thesis/antithesis/synthesis reasoning`,
          };
        }

        return {
          success: true,
          message: `Invoking ${subagentName} subagent${task ? ` with task: ${task}` : ''}...`,
          // The actual invocation happens via the chat system
          data: {
            subagent: subagentName.toLowerCase(),
            task: task || undefined,
          },
        };
      },
    },
    {
      name: 'subagents-auto',
      aliases: ['auto-subagents'],
      description: 'Toggle automatic subagent routing',
      usage: '/subagents-auto <on|off>',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const action = args[0]?.toLowerCase();

        if (action === 'on') {
          ctx.capabilities.storage.set('config:enableAutoSubagents', true);
          return {
            success: true,
            message: 'Automatic subagent routing enabled. Messages will be analyzed for subagent intents.',
          };
        } else if (action === 'off') {
          ctx.capabilities.storage.set('config:enableAutoSubagents', false);
          return {
            success: true,
            message: 'Automatic subagent routing disabled.',
          };
        }

        const currentState = ctx.capabilities.storage.get('config:enableAutoSubagents') ?? true;
        return {
          success: true,
          message: `Automatic subagent routing is currently ${currentState ? 'ON' : 'OFF'}.\n\nUsage: /subagents-auto <on|off>`,
        };
      },
    },
  ],

  onActivate: async () => {
    console.log('[SubagentsPlugin] Activated');
  },

  onDeactivate: async () => {
    console.log('[SubagentsPlugin] Deactivated');
  },
});

export default subagentsPlugin;
