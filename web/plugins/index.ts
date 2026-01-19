/**
 * METAMORPH Web Plugins - Auto-Discovery Registry
 *
 * All plugins in the plugins/ folder should be exported here.
 * They will be automatically registered and enabled on app load.
 */

import type { WebPlugin } from '@/lib/plugins/types';
import { emotionPlugin } from './emotion';

/**
 * All available plugins - add new plugins here
 */
export const plugins: WebPlugin[] = [
  emotionPlugin,
];

/**
 * Get plugin by ID
 */
export function getPluginById(id: string): WebPlugin | undefined {
  return plugins.find(p => p.manifest.id === id);
}

/**
 * Get all plugin IDs
 */
export function getPluginIds(): string[] {
  return plugins.map(p => p.manifest.id);
}

// Re-export individual plugins for direct imports
export { emotionPlugin };
