/**
 * METAMORPH Plugin SDK - CLI Types
 *
 * Node.js/CLI-specific plugin types.
 */

import type {
  PluginManifest,
  Stance,
  ModeConfig,
  PluginCommand,
} from '../core/types.js';
import type { BasePlugin, PluginContext } from '../core/plugin.js';

// =============================================================================
// CLI Operator
// =============================================================================

/**
 * Trigger types for CLI operators.
 */
export type OperatorTrigger =
  | 'creative_request'
  | 'novelty_request'
  | 'dialectic_requested'
  | 'identity_question'
  | 'meta_question'
  | 'emotional_trigger'
  | 'user_input'
  | 'response'
  | 'state_change';

/**
 * Operator category.
 */
export type OperatorCategory = 'frame' | 'value' | 'identity' | 'meta' | 'custom';

/**
 * Context passed to operator execution.
 */
export interface OperatorContext {
  /** What triggered this operator */
  trigger: OperatorTrigger;
  /** Current intensity level */
  intensity: number;
  /** User's message */
  userMessage: string;
  /** Recent message history */
  recentMessages: string[];
  /** Plugin configuration */
  config: Record<string, unknown>;
}

/**
 * Result from operator execution.
 */
export interface OperatorResult {
  /** Stance modifications to apply */
  stanceModifications: Partial<Stance>;
  /** Additional system prompt content */
  systemPromptAddition?: string;
  /** Metadata for logging/debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Operator executor function.
 */
export type OperatorExecutor = (
  stance: Stance,
  context: OperatorContext
) => Promise<OperatorResult> | OperatorResult;

/**
 * CLI operator definition.
 */
export interface CliOperator {
  /** Operator name */
  name: string;
  /** Operator description */
  description: string;
  /** Operator category */
  category: OperatorCategory;
  /** Triggers that can invoke this operator */
  triggers: OperatorTrigger[];
  /** Intensity range */
  intensity: {
    min: number;
    max: number;
    default: number;
  };
  /** Execution function */
  execute: OperatorExecutor;
}

// =============================================================================
// CLI Hook
// =============================================================================

/**
 * Hook events for CLI plugins.
 */
export type HookEvent =
  | 'beforeResponse'
  | 'afterResponse'
  | 'beforeTransformation'
  | 'afterTransformation'
  | 'onError'
  | 'onStanceChange';

/**
 * Hook handler function.
 */
export type HookHandler = (
  event: HookEvent,
  data: Record<string, unknown>
) => Promise<Record<string, unknown>> | Record<string, unknown>;

/**
 * CLI plugin hook definition.
 */
export interface CliHook {
  /** Hook name */
  name: string;
  /** Event to hook into */
  event: HookEvent;
  /** Handler function */
  handler: HookHandler;
  /** Priority (higher runs first) */
  priority?: number;
}

// =============================================================================
// CLI Plugin Setting
// =============================================================================

/**
 * Plugin setting definition.
 */
export interface CliPluginSetting {
  /** Setting key */
  key: string;
  /** Value type */
  type: 'string' | 'number' | 'boolean' | 'select';
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Default value */
  default: unknown;
  /** Options for select type */
  options?: string[];
}

// =============================================================================
// CLI Plugin Context
// =============================================================================

/**
 * Extended CLI plugin context with data access.
 */
export interface CliPluginContext extends PluginContext {
  /** Get current stance */
  getStance(): Stance;
  /** Update stance */
  updateStance(delta: Partial<Stance>): void;
  /** Get current config */
  getConfig(): ModeConfig;
  /** Search memories */
  searchMemory(query: string, limit?: number): Promise<unknown[]>;
  /** Add a memory */
  addMemory(content: string, metadata?: Record<string, unknown>): Promise<string>;
  /** Register a custom operator */
  registerOperator(operator: CliOperator): void;
  /** Unregister an operator */
  unregisterOperator(name: string): void;
}

// =============================================================================
// CLI Plugin Definition
// =============================================================================

/**
 * CLI plugin definition.
 */
export interface CliPlugin extends BasePlugin<CliPluginContext> {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Custom operators */
  operators?: CliOperator[];
  /** Lifecycle hooks */
  hooks?: CliHook[];
  /** Plugin settings */
  settings?: CliPluginSetting[];
  /** Optional slash commands registered by this plugin */
  commands?: PluginCommand<CliPluginContext>[];
}

// =============================================================================
// Plugin Definition Helper
// =============================================================================

/**
 * Type-safe CLI plugin definition helper.
 *
 * @example
 * ```ts
 * const myPlugin = defineCliPlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'Enhances responses',
 *     capabilities: ['storage'],
 *     permissions: ['stance:read', 'stance:write'],
 *   },
 *   operators: [
 *     {
 *       name: 'enhance',
 *       description: 'Enhance response quality',
 *       category: 'meta',
 *       triggers: ['creative_request'],
 *       intensity: { min: 0, max: 100, default: 50 },
 *       execute: (stance, ctx) => ({
 *         stanceModifications: {
 *           values: { ...stance.values, novelty: stance.values.novelty + 10 },
 *         },
 *       }),
 *     },
 *   ],
 * });
 * ```
 */
export function defineCliPlugin(plugin: CliPlugin): CliPlugin {
  return plugin;
}
