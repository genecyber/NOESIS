/**
 * Plugin Development SDK (Ralph Iteration 7, Feature 4)
 *
 * Plugin templates, type-safe API, hot reloading,
 * testing framework, and publishing workflow.
 */

import type { Stance, ModeConfig, OperatorDefinition, ConversationMessage } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  metamorphVersion: string;  // Minimum compatible version
  entryPoint: string;
  permissions: PluginPermission[];
  dependencies?: Record<string, string>;
}

export type PluginPermission =
  | 'stance:read'
  | 'stance:write'
  | 'memory:read'
  | 'memory:write'
  | 'config:read'
  | 'config:write'
  | 'conversation:read'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:fetch';

export interface PluginContext {
  stance: Readonly<Stance>;
  config: Readonly<ModeConfig>;
  conversationHistory: Readonly<ConversationMessage[]>;
  pluginStorage: PluginStorage;
  logger: PluginLogger;
  api: PluginAPI;
}

export interface PluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginAPI {
  // Stance operations
  getStance(): Stance;
  updateStance(delta: Partial<Stance>): void;

  // Memory operations
  searchMemory(query: string, limit?: number): Promise<unknown[]>;
  addMemory(content: string, metadata?: Record<string, unknown>): Promise<string>;

  // Operator operations
  registerOperator(operator: OperatorDefinition): void;
  unregisterOperator(name: string): void;

  // Event operations
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): () => void;
}

export interface Plugin {
  manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;
}

export interface PluginTestContext extends PluginContext {
  mockStance(stance: Partial<Stance>): void;
  mockConfig(config: Partial<ModeConfig>): void;
  mockConversation(messages: ConversationMessage[]): void;
  assertStanceChanged(expected: Partial<Stance>): void;
  getEmittedEvents(): Array<{ event: string; data: unknown }>;
}

export interface PluginTestSuite {
  name: string;
  tests: PluginTest[];
}

export interface PluginTest {
  name: string;
  fn: (context: PluginTestContext) => Promise<void>;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}

export interface PluginPublishResult {
  success: boolean;
  version?: string;
  url?: string;
  error?: string;
}

export type PluginStatus = 'installed' | 'active' | 'inactive' | 'error';

export interface InstalledPlugin {
  manifest: PluginManifest;
  status: PluginStatus;
  loadedAt: Date | null;
  error?: string;
}

// ============================================================================
// Plugin SDK
// ============================================================================

export class PluginSDK {
  private plugins: Map<string, InstalledPlugin> = new Map();
  private activePlugins: Map<string, Plugin> = new Map();
  private storage: Map<string, Map<string, unknown>> = new Map();
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private registeredOperators: Map<string, OperatorDefinition> = new Map();
  private hotReloadWatchers: Map<string, () => void> = new Map();

  /**
   * Create a new plugin from template
   */
  createPlugin(options: {
    name: string;
    description: string;
    author: string;
    permissions: PluginPermission[];
  }): { manifest: PluginManifest; template: string } {
    const manifest: PluginManifest = {
      name: options.name,
      version: '1.0.0',
      description: options.description,
      author: options.author,
      license: 'MIT',
      keywords: ['metamorph-plugin'],
      metamorphVersion: '1.0.0',
      entryPoint: 'index.js',
      permissions: options.permissions
    };

    const template = this.generatePluginTemplate(manifest);

    return { manifest, template };
  }

  /**
   * Generate plugin template code
   */
  private generatePluginTemplate(manifest: PluginManifest): string {
    return `/**
 * ${manifest.name}
 * ${manifest.description}
 *
 * @author ${manifest.author}
 * @version ${manifest.version}
 */

import type { Plugin, PluginContext } from '@metamorph/plugin-sdk';

export default class ${this.toPascalCase(manifest.name)}Plugin implements Plugin {
  manifest = ${JSON.stringify(manifest, null, 2)};

  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('${manifest.name} initialized');
  }

  async activate(): Promise<void> {
    if (!this.context) throw new Error('Plugin not initialized');

    // Register custom operators
    // this.context.api.registerOperator({...});

    // Subscribe to events
    // this.context.api.on('turn:complete', (data) => {...});

    this.context.logger.info('${manifest.name} activated');
  }

  async deactivate(): Promise<void> {
    this.context?.logger.info('${manifest.name} deactivated');
  }

  async dispose(): Promise<void> {
    this.context = undefined;
  }
}
`;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, c => c.toUpperCase());
  }

  /**
   * Load a plugin
   */
  async loadPlugin(
    manifest: PluginManifest,
    pluginClass: new () => Plugin
  ): Promise<PluginLoadResult> {
    try {
      // Validate manifest
      if (!manifest.name || !manifest.version) {
        return { success: false, error: 'Invalid manifest: missing name or version' };
      }

      // Check if already loaded
      if (this.plugins.has(manifest.name)) {
        return { success: false, error: `Plugin ${manifest.name} is already loaded` };
      }

      // Create plugin instance
      const plugin = new pluginClass();

      // Create context
      const context = this.createPluginContext(manifest.name, manifest.permissions);

      // Initialize plugin
      await plugin.initialize(context);

      // Store plugin
      this.plugins.set(manifest.name, {
        manifest,
        status: 'installed',
        loadedAt: new Date()
      });

      this.activePlugins.set(manifest.name, plugin);

      return { success: true, plugin };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create plugin context
   */
  private createPluginContext(pluginName: string, permissions: PluginPermission[]): PluginContext {
    const hasPermission = (perm: PluginPermission) => permissions.includes(perm);

    // Create plugin storage
    if (!this.storage.has(pluginName)) {
      this.storage.set(pluginName, new Map());
    }
    const pluginStorage = this.storage.get(pluginName)!;

    const storage: PluginStorage = {
      async get<T>(key: string): Promise<T | null> {
        return (pluginStorage.get(key) as T) ?? null;
      },
      async set<T>(key: string, value: T): Promise<void> {
        pluginStorage.set(key, value);
      },
      async delete(key: string): Promise<void> {
        pluginStorage.delete(key);
      },
      async list(): Promise<string[]> {
        return [...pluginStorage.keys()];
      }
    };

    const logger: PluginLogger = {
      debug: (msg, ...args) => console.debug(`[${pluginName}] ${msg}`, ...args),
      info: (msg, ...args) => console.info(`[${pluginName}] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${pluginName}] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${pluginName}] ${msg}`, ...args)
    };

    const api: PluginAPI = {
      getStance: () => {
        if (!hasPermission('stance:read')) {
          throw new Error('Permission denied: stance:read');
        }
        // Return mock stance for now
        return {} as Stance;
      },

      updateStance: (_delta) => {
        if (!hasPermission('stance:write')) {
          throw new Error('Permission denied: stance:write');
        }
        // Update stance logic
      },

      searchMemory: async (_query, _limit) => {
        if (!hasPermission('memory:read')) {
          throw new Error('Permission denied: memory:read');
        }
        return [];
      },

      addMemory: async (_content, _metadata) => {
        if (!hasPermission('memory:write')) {
          throw new Error('Permission denied: memory:write');
        }
        return `memory-${Date.now()}`;
      },

      registerOperator: (operator) => {
        this.registeredOperators.set(`${pluginName}:${operator.name}`, operator);
      },

      unregisterOperator: (name) => {
        this.registeredOperators.delete(`${pluginName}:${name}`);
      },

      emit: (event, data) => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(data);
            } catch {
              // Ignore handler errors
            }
          }
        }
      },

      on: (event, handler) => {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler);
        return () => this.eventHandlers.get(event)?.delete(handler);
      }
    };

    return {
      stance: {} as Stance,
      config: {} as ModeConfig,
      conversationHistory: [],
      pluginStorage: storage,
      logger,
      api
    };
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(name: string): Promise<boolean> {
    const plugin = this.activePlugins.get(name);
    const installed = this.plugins.get(name);

    if (!plugin || !installed) {
      return false;
    }

    try {
      await plugin.activate();
      installed.status = 'active';
      return true;
    } catch (error) {
      installed.status = 'error';
      installed.error = error instanceof Error ? error.message : 'Activation failed';
      return false;
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(name: string): Promise<boolean> {
    const plugin = this.activePlugins.get(name);
    const installed = this.plugins.get(name);

    if (!plugin || !installed) {
      return false;
    }

    try {
      await plugin.deactivate();
      installed.status = 'inactive';
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.activePlugins.get(name);

    if (plugin) {
      try {
        await plugin.dispose();
      } catch {
        // Ignore dispose errors
      }
    }

    // Stop hot reload
    const stopWatcher = this.hotReloadWatchers.get(name);
    if (stopWatcher) {
      stopWatcher();
      this.hotReloadWatchers.delete(name);
    }

    // Clean up
    this.activePlugins.delete(name);
    this.plugins.delete(name);
    this.storage.delete(name);

    // Remove registered operators
    for (const key of this.registeredOperators.keys()) {
      if (key.startsWith(`${name}:`)) {
        this.registeredOperators.delete(key);
      }
    }

    return true;
  }

  /**
   * Enable hot reloading for development
   */
  enableHotReload(name: string, _watchPath: string): () => void {
    // In a real implementation, this would use fs.watch or chokidar
    // For now, we just track that hot reload is enabled

    const stopWatcher = () => {
      this.hotReloadWatchers.delete(name);
    };

    this.hotReloadWatchers.set(name, stopWatcher);

    return stopWatcher;
  }

  /**
   * Create test context for plugin testing
   */
  createTestContext(pluginName: string): PluginTestContext {
    let mockStance: Stance = {} as Stance;
    let mockConfig: ModeConfig = {} as ModeConfig;
    let mockConversation: ConversationMessage[] = [];
    const emittedEvents: Array<{ event: string; data: unknown }> = [];

    const baseContext = this.createPluginContext(pluginName, [
      'stance:read', 'stance:write',
      'memory:read', 'memory:write',
      'config:read', 'config:write',
      'conversation:read'
    ]);

    return {
      ...baseContext,
      stance: mockStance,
      config: mockConfig,
      conversationHistory: mockConversation,

      mockStance: (stance) => {
        mockStance = { ...mockStance, ...stance } as Stance;
      },

      mockConfig: (config) => {
        mockConfig = { ...mockConfig, ...config } as ModeConfig;
      },

      mockConversation: (messages) => {
        mockConversation = messages;
      },

      assertStanceChanged: (expected) => {
        for (const [key, value] of Object.entries(expected)) {
          if ((mockStance as Record<string, unknown>)[key] !== value) {
            throw new Error(
              `Stance assertion failed: expected ${key} to be ${JSON.stringify(value)}`
            );
          }
        }
      },

      getEmittedEvents: () => emittedEvents,

      api: {
        ...baseContext.api,
        getStance: () => mockStance,
        updateStance: (delta) => {
          mockStance = { ...mockStance, ...delta } as Stance;
        },
        emit: (event, data) => {
          emittedEvents.push({ event, data });
          baseContext.api.emit(event, data);
        }
      }
    };
  }

  /**
   * Run plugin tests
   */
  async runTests(suite: PluginTestSuite): Promise<{
    passed: number;
    failed: number;
    results: Array<{ name: string; passed: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; passed: boolean; error?: string }> = [];
    let passed = 0;
    let failed = 0;

    for (const test of suite.tests) {
      const context = this.createTestContext(suite.name);

      try {
        await test.fn(context);
        results.push({ name: test.name, passed: true });
        passed++;
      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }

    return { passed, failed, results };
  }

  /**
   * Generate documentation from plugin
   */
  generateDocs(manifest: PluginManifest): string {
    return `# ${manifest.name}

${manifest.description}

## Installation

\`\`\`bash
metamorph plugin install ${manifest.name}
\`\`\`

## Version

${manifest.version}

## Author

${manifest.author}

## License

${manifest.license}

## Permissions

This plugin requires the following permissions:

${manifest.permissions.map(p => `- \`${p}\``).join('\n')}

## Keywords

${manifest.keywords.join(', ')}

${manifest.homepage ? `## Homepage\n\n${manifest.homepage}` : ''}

${manifest.repository ? `## Repository\n\n${manifest.repository}` : ''}
`;
  }

  /**
   * Validate plugin for publishing
   */
  validateForPublish(manifest: PluginManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.name) errors.push('Missing name');
    if (!manifest.version) errors.push('Missing version');
    if (!manifest.description) errors.push('Missing description');
    if (!manifest.author) errors.push('Missing author');
    if (!manifest.license) errors.push('Missing license');
    if (!manifest.entryPoint) errors.push('Missing entryPoint');
    if (!manifest.metamorphVersion) errors.push('Missing metamorphVersion');

    // Validate version format
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Invalid version format (expected semver)');
    }

    // Validate name format
    if (manifest.name && !/^[a-z0-9-]+$/.test(manifest.name)) {
      errors.push('Invalid name format (lowercase letters, numbers, and hyphens only)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Publish plugin (mock implementation)
   */
  async publishPlugin(manifest: PluginManifest): Promise<PluginPublishResult> {
    const validation = this.validateForPublish(manifest);

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Mock publish - in reality, this would upload to a registry
    return {
      success: true,
      version: manifest.version,
      url: `https://registry.metamorph.ai/plugins/${manifest.name}/${manifest.version}`
    };
  }

  /**
   * List installed plugins
   */
  listPlugins(): InstalledPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): InstalledPlugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * Get registered operators from plugins
   */
  getRegisteredOperators(): Map<string, OperatorDefinition> {
    return new Map(this.registeredOperators);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const pluginSDK = new PluginSDK();
