/**
 * Command Registry - Central registry for all slash commands
 * Enables agent-invocable and hook-triggered command execution
 */
// ============================================================================
// Command Registry
// ============================================================================
class CommandRegistry {
    commands = new Map();
    aliasMap = new Map();
    /**
     * Register a command
     */
    register(command) {
        this.commands.set(command.name, command);
        // Register aliases
        for (const alias of command.aliases) {
            this.aliasMap.set(alias, command.name);
        }
    }
    /**
     * Get a command by name or alias
     */
    get(nameOrAlias) {
        const name = this.aliasMap.get(nameOrAlias) || nameOrAlias;
        return this.commands.get(name);
    }
    /**
     * List all registered commands
     */
    list() {
        return Array.from(this.commands.values());
    }
    /**
     * List agent-invocable commands
     */
    listAgentInvocable() {
        return this.list().filter(cmd => cmd.agentInvocable);
    }
    /**
     * List hook-triggerable commands
     */
    listHookTriggerable() {
        return this.list().filter(cmd => cmd.hookTriggerable);
    }
    /**
     * Execute a command
     */
    execute(nameOrAlias, context, args = []) {
        const command = this.get(nameOrAlias);
        if (!command) {
            return null;
        }
        return command.execute(context, args);
    }
    /**
     * Detect which commands should be triggered based on message and stance
     */
    detectTriggers(message, stance, config, maxTriggers = 2) {
        if (!config.enableAutoCommands) {
            return [];
        }
        const detected = [];
        const threshold = config.autoCommandThreshold || 0.6;
        const whitelist = config.autoCommandWhitelist || [];
        const blacklist = config.autoCommandBlacklist || [];
        for (const command of this.listHookTriggerable()) {
            // Check whitelist/blacklist
            if (whitelist.length > 0 && !whitelist.includes(command.name)) {
                continue;
            }
            if (blacklist.includes(command.name)) {
                continue;
            }
            for (const trigger of command.triggers) {
                // Check pattern matches
                for (const pattern of trigger.patterns) {
                    if (pattern.test(message)) {
                        const confidence = trigger.confidence;
                        if (confidence >= threshold) {
                            // Check stance conditions if any
                            let stanceMatch = true;
                            if (trigger.stanceConditions) {
                                stanceMatch = this.checkStanceConditions(stance, trigger.stanceConditions);
                            }
                            if (stanceMatch) {
                                detected.push({
                                    command: command.name,
                                    trigger,
                                    confidence,
                                    matchedPattern: pattern.source
                                });
                                break; // Only one trigger per command
                            }
                        }
                    }
                }
            }
        }
        // Sort by confidence and limit
        return detected
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, maxTriggers);
    }
    /**
     * Check if stance matches conditions
     */
    checkStanceConditions(stance, conditions) {
        for (const condition of conditions) {
            const value = this.getNestedValue(stance, condition.field);
            switch (condition.operator) {
                case 'lt':
                    if (typeof value !== 'number' || value >= condition.value)
                        return false;
                    break;
                case 'gt':
                    if (typeof value !== 'number' || value <= condition.value)
                        return false;
                    break;
                case 'eq':
                    if (value !== condition.value)
                        return false;
                    break;
                case 'contains':
                    if (Array.isArray(value)) {
                        if (!value.includes(condition.value))
                            return false;
                    }
                    else if (typeof value === 'string') {
                        if (!value.includes(condition.value))
                            return false;
                    }
                    else {
                        return false;
                    }
                    break;
            }
        }
        return true;
    }
    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
}
// Singleton instance
export const commandRegistry = new CommandRegistry();
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Format command results for injection into system prompt
 */
export function formatCommandResultsForContext(results) {
    if (results.length === 0)
        return '';
    const sections = results.map(result => {
        return `[/${result.command}${result.args.length > 0 ? ' ' + result.args.join(' ') : ''}]\n${result.output}`;
    });
    return sections.join('\n\n');
}
/**
 * Format auto-invoked commands for transparency
 */
export function formatAutoInvokedNotice(triggers) {
    if (triggers.length === 0)
        return '';
    const names = triggers.map(t => `/${t.command}`).join(', ');
    return `[Auto-invoked: ${names}]`;
}
//# sourceMappingURL=registry.js.map