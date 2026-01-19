/**
 * METAMORPH Plugin SDK - CLI Module
 *
 * Node.js/CLI-specific plugin SDK.
 */

// Re-export core types
export type {
  PluginManifest,
  PluginCapability,
  PluginPermission,
  PluginEventType,
  PluginEventHandler,
  PluginEventSubscription,
  PluginStorage,
  PluginLogger,
  EmotionContext,
  Stance,
  StanceValues,
  ModeConfig,
} from '../core/index.js';

export { pluginEventBus, PluginEventBus } from '../core/index.js';

// CLI-specific types
export type {
  OperatorTrigger,
  OperatorCategory,
  OperatorContext,
  OperatorResult,
  OperatorExecutor,
  CliOperator,
  HookEvent,
  HookHandler,
  CliHook,
  CliPluginSetting,
  CliPlugin,
  CliPluginContext,
} from './types.js';

export { defineCliPlugin } from './types.js';

// Registry
export type { CliPluginRegistration, CliPluginRegistryOptions } from './registry.js';
export { cliPluginRegistry, registerCliPlugin } from './registry.js';
