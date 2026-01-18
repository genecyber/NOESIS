/**
 * Commands Module - Exports and registers all commands
 */
export { commandRegistry, formatCommandResultsForContext, formatAutoInvokedNotice, type CommandDefinition, type CommandResult, type CommandContext, type TriggerCondition, type TriggerType, type DetectedTrigger, type StanceCondition } from './registry.js';
export { memoriesCommand } from './memories.js';
export { evolutionCommand } from './evolution.js';
export { strategiesCommand } from './strategies.js';
export { moodCommand } from './mood.js';
export { coherenceCommand } from './coherence.js';
export { transformationsCommand } from './transformations.js';
export { identityCommand } from './identity.js';
/**
 * Initialize command registry with all built-in commands
 */
export declare function initializeCommands(): void;
//# sourceMappingURL=index.d.ts.map