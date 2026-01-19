/**
 * METAMORPH Emotion Detection Plugin
 *
 * A reference implementation showing how to create plugins using the SDK.
 *
 * This plugin provides:
 * - Real-time emotion detection via webcam (face-api.js)
 * - AI-powered emotion analysis via Claude Vision
 * - Emotion aggregation and trend detection
 * - Empathy boost suggestions for chat responses
 */

import { Heart } from 'lucide-react';
import { definePlugin } from '@/lib/plugins';
import type { WebPlugin, PluginCommand, PluginCommandContext, PluginCommandResult } from '@/lib/plugins/types';
import EmotionPanel from './EmotionPanel';

/**
 * Emotion Detection Plugin Definition
 */
export const emotionPlugin: WebPlugin = definePlugin({
  manifest: {
    id: 'emotion-detection',
    name: 'Emotion Detection',
    version: '1.0.0',
    description: 'Real-time emotion detection and empathy enhancement',
    author: 'METAMORPH',
    license: 'MIT',
    metamorphVersion: '0.1.0',
    capabilities: ['webcam', 'vision', 'storage'],
    permissions: ['emotion:read', 'emotion:write', 'config:read'],
  },

  panel: {
    id: 'empathy',
    label: 'Empathy',
    icon: Heart,
    component: EmotionPanel,
    order: 3,
    defaultEnabled: true,
  },

  commands: [
    {
      name: 'emotion',
      aliases: ['empathy'],
      description: 'Control emotion detection (on/off)',
      usage: '/emotion <on|off>',
      agentInvocable: true,
      execute: async (args: string[], ctx: PluginCommandContext): Promise<PluginCommandResult> => {
        const action = args[0]?.toLowerCase();

        if (action === 'on') {
          try {
            await ctx.capabilities.webcam.start();
            console.log('[EmotionPlugin] Emotion detection enabled via command');
            return {
              success: true,
              message: 'Emotion detection enabled. Webcam started.',
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmotionPlugin] Failed to start webcam:', errorMessage);
            return {
              success: false,
              message: `Failed to enable emotion detection: ${errorMessage}`,
            };
          }
        } else if (action === 'off') {
          ctx.capabilities.webcam.stop();
          console.log('[EmotionPlugin] Emotion detection disabled via command');
          return {
            success: true,
            message: 'Emotion detection disabled. Webcam stopped.',
          };
        }

        return {
          success: false,
          message: 'Usage: /emotion <on|off>',
        };
      },
    },
  ],

  onActivate: async (capabilities) => {
    console.log('[EmotionPlugin] Activated');
    // Pre-load face-api models on activation
    // This happens in the panel component itself
  },

  onDeactivate: async () => {
    console.log('[EmotionPlugin] Deactivated');
  },

  onEmotionDetected: (emotion) => {
    // Log emotion changes for debugging
    if (emotion.confidence > 0.7) {
      console.log(`[EmotionPlugin] High-confidence emotion: ${emotion.currentEmotion} (${Math.round(emotion.confidence * 100)}%)`);
    }
  },
});

export default emotionPlugin;
