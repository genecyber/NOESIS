/**
 * Plugin Architecture for Custom Operators - Ralph Iteration 5 Feature 6
 *
 * Enables extensibility through plugins that can add custom operators,
 * response modifiers, and behavior extensions.
 */
const DEFAULT_CONFIG = {
    enabled: true,
    pluginDir: './plugins',
    allowRemotePlugins: false,
    sandboxed: true
};
/**
 * Plugin System Manager
 */
class PluginManager {
    config = DEFAULT_CONFIG;
    plugins = new Map();
    operators = new Map();
    hooks = new Map();
    /**
     * Set configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Register a plugin from manifest
     */
    registerPlugin(manifest, autoEnable = true) {
        if (this.plugins.has(manifest.name)) {
            console.warn(`Plugin ${manifest.name} already registered`);
            return false;
        }
        // Validate manifest
        if (!this.validateManifest(manifest)) {
            console.error(`Invalid manifest for plugin ${manifest.name}`);
            return false;
        }
        // Create loaded plugin instance
        const loaded = {
            manifest,
            enabled: autoEnable,
            settings: this.initializeSettings(manifest),
            loadedAt: new Date()
        };
        this.plugins.set(manifest.name, loaded);
        // Register operators
        for (const op of manifest.operators) {
            this.operators.set(`${manifest.name}:${op.name}`, {
                plugin: manifest.name,
                operator: op
            });
        }
        // Register hooks
        if (manifest.hooks) {
            for (const hook of manifest.hooks) {
                this.registerHook(manifest.name, hook);
            }
        }
        return true;
    }
    /**
     * Validate plugin manifest
     */
    validateManifest(manifest) {
        if (!manifest.name || !manifest.version)
            return false;
        if (!manifest.operators || !Array.isArray(manifest.operators))
            return false;
        for (const op of manifest.operators) {
            if (!op.name || !op.execute || typeof op.execute !== 'function') {
                return false;
            }
        }
        return true;
    }
    /**
     * Initialize plugin settings with defaults
     */
    initializeSettings(manifest) {
        const settings = {};
        if (manifest.settings) {
            for (const setting of manifest.settings) {
                settings[setting.key] = setting.default;
            }
        }
        return settings;
    }
    /**
     * Register a hook
     */
    registerHook(pluginName, hook) {
        if (!this.hooks.has(hook.event)) {
            this.hooks.set(hook.event, []);
        }
        const eventHooks = this.hooks.get(hook.event);
        eventHooks.push({ plugin: pluginName, hook });
        // Sort by priority (higher first)
        eventHooks.sort((a, b) => (b.hook.priority || 0) - (a.hook.priority || 0));
    }
    /**
     * Unregister a plugin
     */
    unregisterPlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin)
            return false;
        // Remove operators
        for (const op of plugin.manifest.operators) {
            this.operators.delete(`${name}:${op.name}`);
        }
        // Remove hooks
        for (const [event, hooks] of this.hooks.entries()) {
            this.hooks.set(event, hooks.filter(h => h.plugin !== name));
        }
        this.plugins.delete(name);
        return true;
    }
    /**
     * Enable a plugin
     */
    enablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin)
            return false;
        plugin.enabled = true;
        return true;
    }
    /**
     * Disable a plugin
     */
    disablePlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin)
            return false;
        plugin.enabled = false;
        return true;
    }
    /**
     * Check if plugin is enabled
     */
    isPluginEnabled(name) {
        const plugin = this.plugins.get(name);
        return plugin?.enabled || false;
    }
    /**
     * Get plugin setting
     */
    getPluginSetting(pluginName, key) {
        const plugin = this.plugins.get(pluginName);
        return plugin?.settings[key];
    }
    /**
     * Set plugin setting
     */
    setPluginSetting(pluginName, key, value) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin)
            return false;
        plugin.settings[key] = value;
        return true;
    }
    /**
     * Get available operators from plugins
     */
    getAvailableOperators() {
        const result = [];
        for (const [name, entry] of this.operators.entries()) {
            const plugin = this.plugins.get(entry.plugin);
            result.push({
                name,
                plugin: entry.plugin,
                operator: entry.operator,
                enabled: plugin?.enabled || false
            });
        }
        return result;
    }
    /**
     * Get operator by name
     */
    getOperator(name) {
        // Try full name first
        const entry = this.operators.get(name);
        if (entry) {
            const plugin = this.plugins.get(entry.plugin);
            if (plugin?.enabled)
                return entry.operator;
        }
        // Try finding by short name
        for (const [fullName, opEntry] of this.operators.entries()) {
            if (fullName.endsWith(`:${name}`)) {
                const plugin = this.plugins.get(opEntry.plugin);
                if (plugin?.enabled)
                    return opEntry.operator;
            }
        }
        return null;
    }
    /**
     * Execute a plugin operator
     */
    async executeOperator(operatorName, stance, context) {
        const operator = this.getOperator(operatorName);
        if (!operator)
            return null;
        try {
            return await operator.execute(stance, context);
        }
        catch (error) {
            console.error(`Plugin operator ${operatorName} failed:`, error);
            return null;
        }
    }
    /**
     * Run hooks for an event
     */
    async runHooks(event, data) {
        const eventHooks = this.hooks.get(event) || [];
        let result = { ...data };
        for (const { plugin, hook } of eventHooks) {
            const pluginData = this.plugins.get(plugin);
            if (!pluginData?.enabled)
                continue;
            try {
                const hookResult = await hook.handler(event, result);
                result = { ...result, ...hookResult };
            }
            catch (error) {
                console.error(`Plugin hook ${plugin}:${hook.name} failed:`, error);
            }
        }
        return result;
    }
    /**
     * List all plugins
     */
    listPlugins() {
        return Array.from(this.plugins.values()).map(p => ({
            name: p.manifest.name,
            version: p.manifest.version,
            description: p.manifest.description,
            enabled: p.enabled,
            operatorCount: p.manifest.operators.length,
            hookCount: p.manifest.hooks?.length || 0
        }));
    }
    /**
     * Get plugin info
     */
    getPluginInfo(name) {
        return this.plugins.get(name) || null;
    }
    /**
     * Get plugin status
     */
    getStatus() {
        const plugins = Array.from(this.plugins.values());
        const enabledPlugins = plugins.filter(p => p.enabled);
        let hookCount = 0;
        for (const hooks of this.hooks.values()) {
            hookCount += hooks.length;
        }
        return {
            enabled: this.config.enabled,
            pluginCount: plugins.length,
            enabledPlugins: enabledPlugins.length,
            operatorCount: this.operators.size,
            hookCount
        };
    }
    /**
     * Clear all plugins
     */
    clear() {
        this.plugins.clear();
        this.operators.clear();
        this.hooks.clear();
    }
}
// Built-in example plugins
export const BUILTIN_PLUGINS = [
    {
        name: 'poetry-mode',
        version: '1.0.0',
        description: 'Enables poetic response style with metaphorical thinking',
        operators: [
            {
                name: 'poeticize',
                description: 'Transform response into poetic form',
                category: 'meta',
                triggers: ['creative_request', 'novelty_request'],
                intensity: { min: 30, max: 100, default: 60 },
                execute: (stance, _context) => ({
                    stanceModifications: {
                        frame: 'poetic',
                        values: {
                            ...stance.values,
                            novelty: Math.min(100, stance.values.novelty + 20),
                            synthesis: Math.min(100, stance.values.synthesis + 15)
                        }
                    },
                    systemPromptAddition: 'Respond with heightened poetic sensibility, using metaphor and rhythm.',
                    metadata: { mode: 'poetic' }
                })
            }
        ],
        settings: [
            {
                key: 'rhymeLevel',
                type: 'select',
                label: 'Rhyme Level',
                default: 'subtle',
                options: ['none', 'subtle', 'moderate', 'full']
            }
        ]
    },
    {
        name: 'debate-champion',
        version: '1.0.0',
        description: 'Enhances dialectic reasoning and argumentation',
        operators: [
            {
                name: 'steelman',
                description: 'Construct the strongest version of opposing arguments',
                category: 'meta',
                triggers: ['dialectic_requested', 'identity_question'],
                intensity: { min: 40, max: 100, default: 70 },
                execute: (stance, _context) => ({
                    stanceModifications: {
                        selfModel: 'challenger',
                        values: {
                            ...stance.values,
                            provocation: Math.min(100, stance.values.provocation + 25),
                            empathy: Math.min(100, stance.values.empathy + 10)
                        }
                    },
                    systemPromptAddition: 'Before responding, construct the strongest possible counterargument. Address it directly.',
                    metadata: { mode: 'debate' }
                })
            }
        ]
    },
    {
        name: 'coding-focus',
        version: '1.0.0',
        description: 'Optimizes responses for technical and coding tasks',
        operators: [
            {
                name: 'technify',
                description: 'Shift to precise, technical communication',
                category: 'frame',
                triggers: ['meta_question', 'novelty_request'],
                intensity: { min: 50, max: 100, default: 80 },
                execute: (stance, _context) => ({
                    stanceModifications: {
                        frame: 'pragmatic',
                        selfModel: 'guide',
                        values: {
                            ...stance.values,
                            certainty: Math.min(100, stance.values.certainty + 20),
                            risk: Math.max(0, stance.values.risk - 15)
                        }
                    },
                    systemPromptAddition: 'Focus on technical accuracy, code examples, and practical implementation.',
                    metadata: { mode: 'technical' }
                })
            }
        ],
        settings: [
            {
                key: 'preferredLanguage',
                type: 'string',
                label: 'Preferred Language',
                default: 'typescript'
            }
        ]
    }
];
// Singleton instance
export const pluginManager = new PluginManager();
// Auto-register built-in plugins
for (const plugin of BUILTIN_PLUGINS) {
    pluginManager.registerPlugin(plugin, false); // Disabled by default
}
//# sourceMappingURL=plugin-system.js.map