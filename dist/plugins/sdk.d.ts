/**
 * Plugin Development SDK (Ralph Iteration 7, Feature 4)
 *
 * Plugin templates, type-safe API, hot reloading,
 * testing framework, and publishing workflow.
 */
import type { Stance, ModeConfig, OperatorDefinition, ConversationMessage } from '../types/index.js';
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
    homepage?: string;
    repository?: string;
    keywords: string[];
    metamorphVersion: string;
    entryPoint: string;
    permissions: PluginPermission[];
    dependencies?: Record<string, string>;
}
export type PluginPermission = 'stance:read' | 'stance:write' | 'memory:read' | 'memory:write' | 'config:read' | 'config:write' | 'conversation:read' | 'filesystem:read' | 'filesystem:write' | 'network:fetch';
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
    getStance(): Stance;
    updateStance(delta: Partial<Stance>): void;
    searchMemory(query: string, limit?: number): Promise<unknown[]>;
    addMemory(content: string, metadata?: Record<string, unknown>): Promise<string>;
    registerOperator(operator: OperatorDefinition): void;
    unregisterOperator(name: string): void;
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
    getEmittedEvents(): Array<{
        event: string;
        data: unknown;
    }>;
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
export declare class PluginSDK {
    private plugins;
    private activePlugins;
    private storage;
    private eventHandlers;
    private registeredOperators;
    private hotReloadWatchers;
    /**
     * Create a new plugin from template
     */
    createPlugin(options: {
        name: string;
        description: string;
        author: string;
        permissions: PluginPermission[];
    }): {
        manifest: PluginManifest;
        template: string;
    };
    /**
     * Generate plugin template code
     */
    private generatePluginTemplate;
    /**
     * Convert string to PascalCase
     */
    private toPascalCase;
    /**
     * Load a plugin
     */
    loadPlugin(manifest: PluginManifest, pluginClass: new () => Plugin): Promise<PluginLoadResult>;
    /**
     * Create plugin context
     */
    private createPluginContext;
    /**
     * Activate a plugin
     */
    activatePlugin(name: string): Promise<boolean>;
    /**
     * Deactivate a plugin
     */
    deactivatePlugin(name: string): Promise<boolean>;
    /**
     * Unload a plugin
     */
    unloadPlugin(name: string): Promise<boolean>;
    /**
     * Enable hot reloading for development
     */
    enableHotReload(name: string, _watchPath: string): () => void;
    /**
     * Create test context for plugin testing
     */
    createTestContext(pluginName: string): PluginTestContext;
    /**
     * Run plugin tests
     */
    runTests(suite: PluginTestSuite): Promise<{
        passed: number;
        failed: number;
        results: Array<{
            name: string;
            passed: boolean;
            error?: string;
        }>;
    }>;
    /**
     * Generate documentation from plugin
     */
    generateDocs(manifest: PluginManifest): string;
    /**
     * Validate plugin for publishing
     */
    validateForPublish(manifest: PluginManifest): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Publish plugin (mock implementation)
     */
    publishPlugin(manifest: PluginManifest): Promise<PluginPublishResult>;
    /**
     * List installed plugins
     */
    listPlugins(): InstalledPlugin[];
    /**
     * Get plugin by name
     */
    getPlugin(name: string): InstalledPlugin | null;
    /**
     * Get registered operators from plugins
     */
    getRegisteredOperators(): Map<string, OperatorDefinition>;
}
export declare const pluginSDK: PluginSDK;
//# sourceMappingURL=sdk.d.ts.map