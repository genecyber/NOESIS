/**
 * Commands Module - Exports and registers all commands
 */
export { commandRegistry, formatCommandResultsForContext, formatAutoInvokedNotice } from './registry.js';
export { memoriesCommand } from './memories.js';
export { evolutionCommand } from './evolution.js';
export { strategiesCommand } from './strategies.js';
export { moodCommand } from './mood.js';
export { coherenceCommand } from './coherence.js';
export { transformationsCommand } from './transformations.js';
export { identityCommand } from './identity.js';
// Import and register all commands
import { commandRegistry } from './registry.js';
import { memoriesCommand } from './memories.js';
import { evolutionCommand } from './evolution.js';
import { strategiesCommand } from './strategies.js';
import { moodCommand } from './mood.js';
import { coherenceCommand } from './coherence.js';
import { transformationsCommand } from './transformations.js';
import { identityCommand } from './identity.js';
/**
 * Initialize command registry with all built-in commands
 */
export function initializeCommands() {
    commandRegistry.register(memoriesCommand);
    commandRegistry.register(evolutionCommand);
    commandRegistry.register(strategiesCommand);
    commandRegistry.register(moodCommand);
    commandRegistry.register(coherenceCommand);
    commandRegistry.register(transformationsCommand);
    commandRegistry.register(identityCommand);
}
// Auto-initialize on import
initializeCommands();
//# sourceMappingURL=index.js.map