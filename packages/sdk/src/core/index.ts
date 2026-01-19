/**
 * METAMORPH Plugin SDK - Core Module
 *
 * Platform-agnostic plugin SDK core.
 * Works in both Node.js and browser environments.
 */

// Types
export type {
  PluginManifest,
  PluginCapability,
  PluginPermission,
  PluginLifecycle,
  PluginEventType,
  PluginEventHandler,
  PluginEventSubscription,
  PluginStorage,
  PluginLogger,
  EmotionContext,
  Stance,
  StanceValues,
  ModeConfig,
  PluginCommand,
  PluginCommandResult,
} from './types.js';

export { isBrowserCapability } from './types.js';

// Plugin base classes
export type {
  PluginContext,
  PluginDataContext,
  BasePlugin,
  PluginRegistration,
  PluginRegistry,
} from './plugin.js';

export {
  createPluginLogger,
  createMemoryStorage,
} from './plugin.js';

// Event bus
export type { PluginEventData } from './events.js';
export { PluginEventBus, pluginEventBus } from './events.js';
