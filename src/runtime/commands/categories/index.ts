import { coreCommands } from './core.js';
import { subagentCommands } from './subagents.js';
import { memoryCommands } from './memory.js';
import { evolutionCommands } from './evolution.js';
import { coherenceCommands } from './coherence.js';
import { identityCommands } from './identity.js';
import { advancedCommands } from './advanced.js';
import { integrationCommands } from './integrations.js';
import { CommandHandler } from '../handler.js';

// Re-export individual categories
export { coreCommands } from './core.js';
export { subagentCommands } from './subagents.js';
export { memoryCommands } from './memory.js';
export { evolutionCommands } from './evolution.js';
export { coherenceCommands } from './coherence.js';
export { identityCommands } from './identity.js';
export { advancedCommands } from './advanced.js';
export { integrationCommands } from './integrations.js';

// Combined array of all commands
export const allCommands: CommandHandler[] = [
  ...coreCommands,
  ...subagentCommands,
  ...memoryCommands,
  ...evolutionCommands,
  ...coherenceCommands,
  ...identityCommands,
  ...advancedCommands,
  ...integrationCommands
];
