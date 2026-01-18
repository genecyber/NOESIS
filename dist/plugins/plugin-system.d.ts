/**
 * Plugin Architecture for Custom Operators - Ralph Iteration 5 Feature 6
 *
 * Enables extensibility through plugins that can add custom operators,
 * response modifiers, and behavior extensions.
 */
import { Stance, TriggerType } from '../types/index.js';
/**
 * Plugin manifest defining plugin capabilities
 */
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author?: string;
    repository?: string;
    operators: PluginOperator[];
    hooks?: PluginHook[];
    settings?: PluginSetting[];
}
/**
 * Plugin operator definition
 */
export interface PluginOperator {
    name: string;
    description: string;
    category: 'frame' | 'value' | 'identity' | 'meta' | 'custom';
    triggers: TriggerType[];
    intensity: {
        min: number;
        max: number;
        default: number;
    };
    execute: OperatorExecutor;
}
/**
 * Operator executor function type
 */
export type OperatorExecutor = (stance: Stance, context: OperatorContext) => Promise<OperatorResult> | OperatorResult;
/**
 * Context passed to operator executor
 */
export interface OperatorContext {
    trigger: TriggerType;
    intensity: number;
    userMessage: string;
    recentMessages: string[];
    config: Record<string, unknown>;
}
/**
 * Result from operator execution
 */
export interface OperatorResult {
    stanceModifications: Partial<Stance>;
    systemPromptAddition?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Plugin hook for extending behavior
 */
export interface PluginHook {
    name: string;
    event: PluginEvent;
    handler: HookHandler;
    priority?: number;
}
/**
 * Plugin events that can be hooked
 */
export type PluginEvent = 'beforeResponse' | 'afterResponse' | 'beforeTransformation' | 'afterTransformation' | 'onError' | 'onStanceChange';
/**
 * Hook handler function type
 */
export type HookHandler = (event: PluginEvent, data: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
/**
 * Plugin setting definition
 */
export interface PluginSetting {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    label: string;
    description?: string;
    default: unknown;
    options?: string[];
}
/**
 * Loaded plugin instance
 */
export interface LoadedPlugin {
    manifest: PluginManifest;
    enabled: boolean;
    settings: Record<string, unknown>;
    loadedAt: Date;
}
/**
 * Plugin registry configuration
 */
export interface PluginConfig {
    enabled: boolean;
    pluginDir: string;
    allowRemotePlugins: boolean;
    sandboxed: boolean;
}
/**
 * Plugin System Manager
 */
declare class PluginManager {
    private config;
    private plugins;
    private operators;
    private hooks;
    /**
     * Set configuration
     */
    setConfig(config: Partial<PluginConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): PluginConfig;
    /**
     * Register a plugin from manifest
     */
    registerPlugin(manifest: PluginManifest, autoEnable?: boolean): boolean;
    /**
     * Validate plugin manifest
     */
    private validateManifest;
    /**
     * Initialize plugin settings with defaults
     */
    private initializeSettings;
    /**
     * Register a hook
     */
    private registerHook;
    /**
     * Unregister a plugin
     */
    unregisterPlugin(name: string): boolean;
    /**
     * Enable a plugin
     */
    enablePlugin(name: string): boolean;
    /**
     * Disable a plugin
     */
    disablePlugin(name: string): boolean;
    /**
     * Check if plugin is enabled
     */
    isPluginEnabled(name: string): boolean;
    /**
     * Get plugin setting
     */
    getPluginSetting(pluginName: string, key: string): unknown;
    /**
     * Set plugin setting
     */
    setPluginSetting(pluginName: string, key: string, value: unknown): boolean;
    /**
     * Get available operators from plugins
     */
    getAvailableOperators(): Array<{
        name: string;
        plugin: string;
        operator: PluginOperator;
        enabled: boolean;
    }>;
    /**
     * Get operator by name
     */
    getOperator(name: string): PluginOperator | null;
    /**
     * Execute a plugin operator
     */
    executeOperator(operatorName: string, stance: Stance, context: OperatorContext): Promise<OperatorResult | null>;
    /**
     * Run hooks for an event
     */
    runHooks(event: PluginEvent, data: Record<string, unknown>): Promise<Record<string, unknown>>;
    /**
     * List all plugins
     */
    listPlugins(): Array<{
        name: string;
        version: string;
        description: string;
        enabled: boolean;
        operatorCount: number;
        hookCount: number;
    }>;
    /**
     * Get plugin info
     */
    getPluginInfo(name: string): LoadedPlugin | null;
    /**
     * Get plugin status
     */
    getStatus(): {
        enabled: boolean;
        pluginCount: number;
        enabledPlugins: number;
        operatorCount: number;
        hookCount: number;
    };
    /**
     * Clear all plugins
     */
    clear(): void;
}
export declare const BUILTIN_PLUGINS: PluginManifest[];
export declare const pluginManager: PluginManager;
export {};
//# sourceMappingURL=plugin-system.d.ts.map