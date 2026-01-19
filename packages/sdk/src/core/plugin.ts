/**
 * METAMORPH Plugin SDK - Base Plugin Classes
 *
 * Platform-agnostic plugin definitions.
 */

import type {
  PluginManifest,
  PluginLifecycle,
  PluginStorage,
  PluginLogger,
  PluginEventType,
  PluginEventHandler,
  PluginEventSubscription,
  EmotionContext,
  Stance,
  ModeConfig,
} from './types.js';

// =============================================================================
// Plugin Context
// =============================================================================

/**
 * Base context provided to all plugins.
 */
export interface PluginContext {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Plugin-scoped storage */
  storage: PluginStorage;
  /** Plugin logger */
  logger: PluginLogger;
  /** Event subscription */
  on<T = unknown>(event: PluginEventType, handler: PluginEventHandler<T>): PluginEventSubscription;
  /** Event emission (if permitted) */
  emit?(event: PluginEventType, data: unknown): void;
}

/**
 * Extended context with data access.
 */
export interface PluginDataContext extends PluginContext {
  /** Get current stance (requires stance:read) */
  getStance?(): Stance | null;
  /** Update stance (requires stance:write) */
  updateStance?(delta: Partial<Stance>): void;
  /** Get current emotion context (requires emotion:read) */
  getEmotionContext?(): EmotionContext | null;
  /** Set emotion context (requires emotion:write) */
  setEmotionContext?(context: EmotionContext): void;
  /** Get current config (requires config:read) */
  getConfig?(): ModeConfig | null;
  /** Update config (requires config:write) */
  updateConfig?(delta: Partial<ModeConfig>): void;
}

// =============================================================================
// Base Plugin Definition
// =============================================================================

/**
 * Base plugin definition interface.
 * Extend this for platform-specific plugins.
 */
export interface BasePlugin<TContext extends PluginContext = PluginContext>
  extends PluginLifecycle<TContext> {
  /** Plugin manifest */
  manifest: PluginManifest;
}

// =============================================================================
// Plugin Registration
// =============================================================================

/**
 * Registered plugin state.
 */
export interface PluginRegistration<TPlugin extends BasePlugin = BasePlugin> {
  /** The plugin instance */
  plugin: TPlugin;
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Platform capabilities created for this plugin */
  capabilities?: unknown;
  /** When the plugin was loaded */
  loadedAt: Date;
  /** Last error if any */
  error?: string;
}

/**
 * Plugin registry interface.
 */
export interface PluginRegistry<TPlugin extends BasePlugin = BasePlugin> {
  /**
   * Register a plugin.
   */
  register(plugin: TPlugin): void;

  /**
   * Unregister a plugin.
   */
  unregister(pluginId: string): void;

  /**
   * Enable a plugin.
   */
  enable(pluginId: string): Promise<void>;

  /**
   * Disable a plugin.
   */
  disable(pluginId: string): Promise<void>;

  /**
   * Get a plugin by ID.
   */
  get(pluginId: string): PluginRegistration<TPlugin> | undefined;

  /**
   * Get all registered plugins.
   */
  getAll(): PluginRegistration<TPlugin>[];

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean;

  /**
   * Check if a plugin is enabled.
   */
  isEnabled(pluginId: string): boolean;
}

// =============================================================================
// Helper: Create Plugin Logger
// =============================================================================

/**
 * Create a prefixed logger for a plugin.
 */
export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[${pluginId}]`;
  return {
    debug: (msg, ...args) => console.debug(prefix, msg, ...args),
    info: (msg, ...args) => console.info(prefix, msg, ...args),
    warn: (msg, ...args) => console.warn(prefix, msg, ...args),
    error: (msg, ...args) => console.error(prefix, msg, ...args),
  };
}

// =============================================================================
// Helper: Create Plugin Storage
// =============================================================================

/**
 * Create a memory-based storage for a plugin.
 */
export function createMemoryStorage(pluginId: string): PluginStorage {
  const store = new Map<string, unknown>();
  const prefix = `plugin:${pluginId}:`;

  return {
    get<T>(key: string): T | null {
      return (store.get(prefix + key) as T) ?? null;
    },
    async getAsync<T>(key: string): Promise<T | null> {
      return this.get(key);
    },
    set<T>(key: string, value: T): void {
      store.set(prefix + key, value);
    },
    async setAsync<T>(key: string, value: T): Promise<void> {
      this.set(key, value);
    },
    remove(key: string): void {
      store.delete(prefix + key);
    },
    keys(): string[] {
      return Array.from(store.keys())
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
    clear(): void {
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          store.delete(key);
        }
      }
    },
  };
}
