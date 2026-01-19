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
import type { WebPlugin } from '@/lib/plugins/types';
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
