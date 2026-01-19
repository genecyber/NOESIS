/**
 * METAMORPH Plugin SDK - CLI Registry
 *
 * CLI plugin registry for Node.js integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  PluginRegistry,
  PluginRegistration,
} from '../core/plugin.js';
import {
  createPluginLogger,
  createMemoryStorage,
} from '../core/plugin.js';
import { pluginEventBus } from '../core/events.js';
import type { Stance, ModeConfig, PluginStorage } from '../core/types.js';
import type {
  CliPlugin,
  CliPluginContext,
  CliOperator,
  CliHook,
  HookEvent,
  OperatorContext,
  OperatorResult,
} from './types.js';

// =============================================================================
// CLI Plugin Registration
// =============================================================================

export interface CliPluginRegistration extends PluginRegistration<CliPlugin> {
  /** Plugin context */
  context?: CliPluginContext;
  /** Plugin settings values */
  settings: Record<string, unknown>;
}

// =============================================================================
// File-based Storage
// =============================================================================

function createFileStorage(pluginId: string, storageDir: string): PluginStorage {
  const filePath = path.join(storageDir, `${pluginId}.json`);
  let cache: Record<string, unknown> = {};

  // Load existing data
  try {
    if (fs.existsSync(filePath)) {
      cache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    cache = {};
  }

  const save = () => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
    } catch (err) {
      console.error(`[CliPluginStorage] Failed to save ${pluginId}:`, err);
    }
  };

  return {
    get<T>(key: string): T | null {
      return (cache[key] as T) ?? null;
    },
    async getAsync<T>(key: string): Promise<T | null> {
      return this.get(key);
    },
    set<T>(key: string, value: T): void {
      cache[key] = value;
      save();
    },
    async setAsync<T>(key: string, value: T): Promise<void> {
      this.set(key, value);
    },
    remove(key: string): void {
      delete cache[key];
      save();
    },
    keys(): string[] {
      return Object.keys(cache);
    },
    clear(): void {
      cache = {};
      save();
    },
  };
}

// =============================================================================
// CLI Plugin Registry
// =============================================================================

export interface CliPluginRegistryOptions {
  /** Directory for plugin storage */
  storageDir?: string;
  /** Directory to scan for plugins */
  pluginsDir?: string;
  /** Current stance getter */
  getStance?: () => Stance;
  /** Stance updater */
  updateStance?: (delta: Partial<Stance>) => void;
  /** Config getter */
  getConfig?: () => ModeConfig;
  /** Memory search function */
  searchMemory?: (query: string, limit?: number) => Promise<unknown[]>;
  /** Memory add function */
  addMemory?: (content: string, metadata?: Record<string, unknown>) => Promise<string>;
}

class CliPluginRegistry implements PluginRegistry<CliPlugin> {
  private plugins: Map<string, CliPluginRegistration> = new Map();
  private operators: Map<string, { pluginId: string; operator: CliOperator }> = new Map();
  private hooks: Map<HookEvent, Array<{ pluginId: string; hook: CliHook }>> = new Map();
  private options: CliPluginRegistryOptions;

  constructor(options: CliPluginRegistryOptions = {}) {
    this.options = {
      storageDir: options.storageDir ?? './.metamorph/plugins',
      ...options,
    };
  }

  /**
   * Set runtime integration options.
   */
  setOptions(options: Partial<CliPluginRegistryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Register a plugin.
   */
  register(plugin: CliPlugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      console.warn(`Plugin ${plugin.manifest.id} is already registered`);
      return;
    }

    // Initialize settings with defaults
    const settings: Record<string, unknown> = {};
    if (plugin.settings) {
      for (const setting of plugin.settings) {
        settings[setting.key] = setting.default;
      }
    }

    const registration: CliPluginRegistration = {
      plugin,
      enabled: false,
      loadedAt: new Date(),
      settings,
    };

    this.plugins.set(plugin.manifest.id, registration);

    // Register operators
    if (plugin.operators) {
      for (const op of plugin.operators) {
        const opKey = `${plugin.manifest.id}:${op.name}`;
        this.operators.set(opKey, { pluginId: plugin.manifest.id, operator: op });
      }
    }

    // Register hooks
    if (plugin.hooks) {
      for (const hook of plugin.hooks) {
        this.registerHook(plugin.manifest.id, hook);
      }
    }
  }

  private registerHook(pluginId: string, hook: CliHook): void {
    if (!this.hooks.has(hook.event)) {
      this.hooks.set(hook.event, []);
    }
    const eventHooks = this.hooks.get(hook.event)!;
    eventHooks.push({ pluginId, hook });
    // Sort by priority (higher first)
    eventHooks.sort((a, b) => (b.hook.priority ?? 0) - (a.hook.priority ?? 0));
  }

  /**
   * Unregister a plugin.
   */
  unregister(pluginId: string): void {
    const reg = this.plugins.get(pluginId);
    if (!reg) return;

    // Remove operators
    for (const op of reg.plugin.operators ?? []) {
      this.operators.delete(`${pluginId}:${op.name}`);
    }

    // Remove hooks
    for (const [event, hooks] of this.hooks.entries()) {
      this.hooks.set(event, hooks.filter(h => h.pluginId !== pluginId));
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Enable a plugin.
   */
  async enable(pluginId: string): Promise<void> {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.enabled) return;

    const { plugin } = reg;

    try {
      // Create storage
      const storage = this.options.storageDir
        ? createFileStorage(pluginId, this.options.storageDir)
        : createMemoryStorage(pluginId);

      // Create context
      const context: CliPluginContext = {
        manifest: plugin.manifest,
        storage,
        logger: createPluginLogger(plugin.manifest.id),
        // Cast handler to match event bus signature - the generic T allows plugins
        // to type their handlers, but the event bus uses its own type mapping
        on: (event, handler) => pluginEventBus.on(event, handler as Parameters<typeof pluginEventBus.on>[1]),
        getStance: () => {
          if (!this.options.getStance) {
            throw new Error('Stance access not configured');
          }
          return this.options.getStance();
        },
        updateStance: (delta) => {
          if (!this.options.updateStance) {
            throw new Error('Stance update not configured');
          }
          this.options.updateStance(delta);
        },
        getConfig: () => {
          if (!this.options.getConfig) {
            throw new Error('Config access not configured');
          }
          return this.options.getConfig();
        },
        searchMemory: async (query, limit) => {
          if (!this.options.searchMemory) {
            throw new Error('Memory search not configured');
          }
          return this.options.searchMemory(query, limit);
        },
        addMemory: async (content, metadata) => {
          if (!this.options.addMemory) {
            throw new Error('Memory add not configured');
          }
          return this.options.addMemory(content, metadata);
        },
        registerOperator: (op) => {
          const opKey = `${pluginId}:${op.name}`;
          this.operators.set(opKey, { pluginId, operator: op });
        },
        unregisterOperator: (name) => {
          this.operators.delete(`${pluginId}:${name}`);
        },
      };

      reg.context = context;

      // Call lifecycle hooks
      if (plugin.onLoad) {
        await plugin.onLoad(context);
      }

      if (plugin.onActivate) {
        await plugin.onActivate(context);
      }

      reg.enabled = true;
      reg.error = undefined;
    } catch (err) {
      reg.error = err instanceof Error ? err.message : 'Failed to enable plugin';
      console.error(`[CliPluginRegistry] Failed to enable ${pluginId}:`, err);
      throw err;
    }
  }

  /**
   * Disable a plugin.
   */
  async disable(pluginId: string): Promise<void> {
    const reg = this.plugins.get(pluginId);
    if (!reg || !reg.enabled) return;

    const { plugin } = reg;

    try {
      if (plugin.onDeactivate) {
        await plugin.onDeactivate();
      }

      if (plugin.onUnload) {
        await plugin.onUnload();
      }

      reg.enabled = false;
      reg.context = undefined;
    } catch (err) {
      console.error(`[CliPluginRegistry] Error disabling ${pluginId}:`, err);
    }
  }

  /**
   * Get a plugin by ID.
   */
  get(pluginId: string): CliPluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): CliPluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Check if a plugin is enabled.
   */
  isEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.enabled ?? false;
  }

  /**
   * Get all available operators.
   */
  getOperators(): Array<{
    name: string;
    pluginId: string;
    operator: CliOperator;
    enabled: boolean;
  }> {
    const result: Array<{
      name: string;
      pluginId: string;
      operator: CliOperator;
      enabled: boolean;
    }> = [];

    for (const [name, entry] of this.operators.entries()) {
      const plugin = this.plugins.get(entry.pluginId);
      result.push({
        name,
        pluginId: entry.pluginId,
        operator: entry.operator,
        enabled: plugin?.enabled ?? false,
      });
    }

    return result;
  }

  /**
   * Get an operator by name.
   */
  getOperator(name: string): CliOperator | null {
    // Try full name first
    const entry = this.operators.get(name);
    if (entry) {
      const plugin = this.plugins.get(entry.pluginId);
      if (plugin?.enabled) return entry.operator;
    }

    // Try short name
    for (const [fullName, opEntry] of this.operators.entries()) {
      if (fullName.endsWith(`:${name}`)) {
        const plugin = this.plugins.get(opEntry.pluginId);
        if (plugin?.enabled) return opEntry.operator;
      }
    }

    return null;
  }

  /**
   * Execute an operator.
   */
  async executeOperator(
    operatorName: string,
    stance: Stance,
    context: OperatorContext
  ): Promise<OperatorResult | null> {
    const operator = this.getOperator(operatorName);
    if (!operator) return null;

    try {
      return await operator.execute(stance, context);
    } catch (error) {
      console.error(`[CliPluginRegistry] Operator ${operatorName} failed:`, error);
      return null;
    }
  }

  /**
   * Run hooks for an event.
   */
  async runHooks(
    event: HookEvent,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const eventHooks = this.hooks.get(event) ?? [];
    let result = { ...data };

    for (const { pluginId, hook } of eventHooks) {
      const plugin = this.plugins.get(pluginId);
      if (!plugin?.enabled) continue;

      try {
        const hookResult = await hook.handler(event, result);
        result = { ...result, ...hookResult };
      } catch (error) {
        console.error(`[CliPluginRegistry] Hook ${pluginId}:${hook.name} failed:`, error);
      }
    }

    return result;
  }

  /**
   * Get plugin setting.
   */
  getSetting(pluginId: string, key: string): unknown {
    return this.plugins.get(pluginId)?.settings[key];
  }

  /**
   * Set plugin setting.
   */
  setSetting(pluginId: string, key: string, value: unknown): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.settings[key] = value;
    return true;
  }

  /**
   * Get registry status.
   */
  getStatus(): {
    pluginCount: number;
    enabledCount: number;
    operatorCount: number;
    hookCount: number;
  } {
    const plugins = Array.from(this.plugins.values());
    const enabledCount = plugins.filter(p => p.enabled).length;

    let hookCount = 0;
    for (const hooks of this.hooks.values()) {
      hookCount += hooks.length;
    }

    return {
      pluginCount: plugins.length,
      enabledCount,
      operatorCount: this.operators.size,
      hookCount,
    };
  }

  /**
   * Load plugins from a directory.
   */
  async loadFromDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(dir, entry.name, 'manifest.json');
      const indexPath = path.join(dir, entry.name, 'index.js');

      if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) {
        continue;
      }

      try {
        const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const pluginModule = await import(indexPath);
        const plugin: CliPlugin = {
          manifest: manifestData,
          ...pluginModule.default,
        };

        this.register(plugin);
        console.log(`[CliPluginRegistry] Loaded plugin: ${plugin.manifest.id}`);
      } catch (err) {
        console.error(`[CliPluginRegistry] Failed to load plugin from ${entry.name}:`, err);
      }
    }
  }
}

/**
 * Global CLI plugin registry instance.
 */
export const cliPluginRegistry = new CliPluginRegistry();

/**
 * Register a CLI plugin.
 * Shorthand for cliPluginRegistry.register().
 */
export function registerCliPlugin(plugin: CliPlugin): void {
  cliPluginRegistry.register(plugin);
}
