/**
 * CLI Command Definitions for Web UI
 * Mirrors the CLI commands for the web interface
 */

export interface CommandArg {
  name: string;
  required: boolean;
  description: string;
  options?: string[];
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  category: CommandCategory;
  args?: CommandArg[];
  subcommands?: Command[];
  // If true, command output appears in chat; if false, triggers side panel
  inlineOutput: boolean;
  // Panel to switch to (if applicable)
  targetPanel?: 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories';
}

export type CommandCategory =
  | 'chat'
  | 'memory'
  | 'subagents'
  | 'sessions'
  | 'identity'
  | 'advanced'
  | 'system';

export const COMMAND_CATEGORIES: Record<CommandCategory, { label: string; color: string }> = {
  chat: { label: 'Chat & Control', color: '#3b82f6' },
  memory: { label: 'Memory & Transformation', color: '#8b5cf6' },
  subagents: { label: 'Subagents', color: '#ec4899' },
  sessions: { label: 'Sessions', color: '#10b981' },
  identity: { label: 'Identity & Plugins', color: '#f59e0b' },
  advanced: { label: 'Advanced', color: '#6366f1' },
  system: { label: 'System', color: '#6b7280' },
};

// Core commands array - mutable to allow plugin command registration
const coreCommands: Command[] = [
  // Chat & Control
  {
    name: 'stance',
    aliases: [],
    description: 'Show current stance (frame, values, sentience)',
    category: 'chat',
    inlineOutput: false,
    targetPanel: 'stance',
  },
  {
    name: 'config',
    aliases: [],
    description: 'Show and edit configuration',
    category: 'chat',
    inlineOutput: false,
    targetPanel: 'config',
  },
  {
    name: 'stats',
    aliases: [],
    description: 'Show session statistics',
    category: 'chat',
    inlineOutput: true,
  },
  {
    name: 'mode',
    aliases: [],
    description: 'Change mode settings (frame, intensity, etc.)',
    category: 'chat',
    inlineOutput: true,
    subcommands: [
      {
        name: 'frame',
        aliases: [],
        description: 'Change frame',
        category: 'chat',
        inlineOutput: true,
        args: [{
          name: 'frame',
          required: true,
          description: 'Frame to use',
          options: ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'],
        }],
      },
      {
        name: 'self',
        aliases: [],
        description: 'Change self-model',
        category: 'chat',
        inlineOutput: true,
        args: [{
          name: 'self-model',
          required: true,
          description: 'Self-model to use',
          options: ['interpreter', 'challenger', 'mirror', 'guide', 'provocateur', 'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'],
        }],
      },
      {
        name: 'objective',
        aliases: [],
        description: 'Change objective',
        category: 'chat',
        inlineOutput: true,
        args: [{
          name: 'objective',
          required: true,
          description: 'Objective to pursue',
          options: ['helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'],
        }],
      },
      {
        name: 'intensity',
        aliases: [],
        description: 'Change transformation intensity (0-100)',
        category: 'chat',
        inlineOutput: true,
        args: [{
          name: 'value',
          required: true,
          description: 'Intensity value (0-100)',
        }],
      },
    ],
  },
  {
    name: 'history',
    aliases: [],
    description: 'Show conversation history',
    category: 'chat',
    inlineOutput: true,
  },
  {
    name: 'export',
    aliases: [],
    description: 'Export conversation state as JSON',
    category: 'chat',
    inlineOutput: true,
  },
  {
    name: 'new',
    aliases: ['clear'],
    description: 'Start a new chat session',
    category: 'chat',
    inlineOutput: true,
  },

  // Memory & Transformation
  {
    name: 'memories',
    aliases: [],
    description: 'List stored memories',
    category: 'memory',
    inlineOutput: false,
    targetPanel: 'memories',
    args: [{
      name: 'type',
      required: false,
      description: 'Memory type filter',
      options: ['episodic', 'semantic', 'identity'],
    }],
  },
  {
    name: 'transformations',
    aliases: ['transforms'],
    description: 'Show transformation history with scores',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'operator-stats',
    aliases: ['ops'],
    description: 'Show operator performance statistics',
    category: 'memory',
    inlineOutput: true,
    args: [{
      name: 'operator',
      required: false,
      description: 'Specific operator to show',
    }],
  },
  {
    name: 'coherence',
    aliases: ['coherence-forecast'],
    description: 'Show coherence forecast and operator drift costs',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'strategies',
    aliases: ['strategy'],
    description: 'Manage multi-turn operator strategies',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'cache',
    aliases: ['subagent-cache'],
    description: 'View cached subagent results',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'mood',
    aliases: ['emotional-arc', 'emotion'],
    description: 'Show emotional arc and sentiment tracking',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'similar',
    aliases: [],
    description: 'Semantic search for similar memories',
    category: 'memory',
    inlineOutput: true,
    args: [{
      name: 'text',
      required: true,
      description: 'Text to search for',
    }],
  },
  {
    name: 'evolution',
    aliases: ['auto-evolve', 'evolve'],
    description: 'View stance evolution over time',
    category: 'memory',
    inlineOutput: false,
    targetPanel: 'evolution',
    subcommands: [
      {
        name: 'timeline',
        aliases: [],
        description: 'View stance evolution snapshots over time',
        category: 'memory',
        inlineOutput: false,
        targetPanel: 'evolution',
      },
      {
        name: 'snapshot',
        aliases: [],
        description: 'Save manual evolution snapshot',
        category: 'memory',
        inlineOutput: true,
      },
      {
        name: 'status',
        aliases: [],
        description: 'Autonomous evolution triggers & status',
        category: 'memory',
        inlineOutput: true,
      },
    ],
  },
  {
    name: 'viz',
    aliases: ['visualize', 'graph'],
    description: 'Generate interactive visualization',
    category: 'memory',
    inlineOutput: true,
  },
  {
    name: 'context',
    aliases: ['ctx'],
    description: 'Context window management & compaction',
    category: 'memory',
    inlineOutput: true,
  },

  // Subagents
  {
    name: 'subagents',
    aliases: [],
    description: 'List available subagents',
    category: 'subagents',
    inlineOutput: true,
  },
  {
    name: 'explore',
    aliases: [],
    description: 'Deep investigation with explorer agent',
    category: 'subagents',
    inlineOutput: true,
    args: [{
      name: 'topic',
      required: true,
      description: 'Topic to explore',
    }],
  },
  {
    name: 'reflect',
    aliases: [],
    description: 'Self-reflection with reflector agent',
    category: 'subagents',
    inlineOutput: true,
    args: [{
      name: 'focus',
      required: false,
      description: 'Focus area for reflection',
    }],
  },
  {
    name: 'dialectic',
    aliases: [],
    description: 'Thesis/antithesis/synthesis analysis',
    category: 'subagents',
    inlineOutput: true,
    args: [{
      name: 'thesis',
      required: true,
      description: 'Thesis to analyze',
    }],
  },
  {
    name: 'verify',
    aliases: [],
    description: 'Verify output with verifier agent',
    category: 'subagents',
    inlineOutput: true,
    args: [{
      name: 'text',
      required: true,
      description: 'Text to verify',
    }],
  },

  // Session Management
  {
    name: 'sessions',
    aliases: ['session'],
    description: 'Session management',
    category: 'sessions',
    inlineOutput: false,
    targetPanel: 'sessions',
    subcommands: [
      {
        name: 'list',
        aliases: [],
        description: 'List all sessions',
        category: 'sessions',
        inlineOutput: false,
        targetPanel: 'sessions',
      },
      {
        name: 'name',
        aliases: [],
        description: 'Name current session',
        category: 'sessions',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Session name',
        }],
      },
      {
        name: 'resume',
        aliases: [],
        description: 'Resume a session',
        category: 'sessions',
        inlineOutput: true,
        args: [{
          name: 'id',
          required: true,
          description: 'Session ID',
        }],
      },
      {
        name: 'delete',
        aliases: [],
        description: 'Delete a session',
        category: 'sessions',
        inlineOutput: true,
        args: [{
          name: 'id',
          required: true,
          description: 'Session ID',
        }],
      },
      {
        name: 'save',
        aliases: [],
        description: 'Force save current session',
        category: 'sessions',
        inlineOutput: true,
      },
    ],
  },

  // Identity & Plugins
  {
    name: 'identity',
    aliases: ['id'],
    description: 'Identity persistence (save/restore/diff checkpoints)',
    category: 'identity',
    inlineOutput: true,
    subcommands: [
      {
        name: 'save',
        aliases: [],
        description: 'Save identity checkpoint',
        category: 'identity',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Checkpoint name',
        }],
      },
      {
        name: 'restore',
        aliases: [],
        description: 'Restore identity checkpoint',
        category: 'identity',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Checkpoint name',
        }],
      },
      {
        name: 'diff',
        aliases: [],
        description: 'Compare identity checkpoints',
        category: 'identity',
        inlineOutput: true,
      },
      {
        name: 'list',
        aliases: [],
        description: 'List identity checkpoints',
        category: 'identity',
        inlineOutput: true,
      },
    ],
  },
  {
    name: 'plugins',
    aliases: ['plugin'],
    description: 'Plugin management (list/enable/disable)',
    category: 'identity',
    inlineOutput: true,
  },
  {
    name: 'collab',
    aliases: ['collaborate'],
    description: 'Collaborative sessions',
    category: 'identity',
    inlineOutput: true,
    subcommands: [
      {
        name: 'start',
        aliases: [],
        description: 'Start collaborative session',
        category: 'identity',
        inlineOutput: true,
        args: [
          { name: 'name', required: true, description: 'Your display name' },
          { name: 'mode', required: false, description: 'Collaboration mode', options: ['free-form', 'structured', 'moderated'] },
        ],
      },
      {
        name: 'join',
        aliases: [],
        description: 'Join collaborative session',
        category: 'identity',
        inlineOutput: true,
        args: [
          { name: 'session-id', required: true, description: 'Session to join' },
          { name: 'name', required: true, description: 'Your display name' },
        ],
      },
      {
        name: 'list',
        aliases: [],
        description: 'List active collaborative sessions',
        category: 'identity',
        inlineOutput: true,
      },
    ],
  },
  {
    name: 'inject',
    aliases: ['memory-inject'],
    description: 'Proactive memory injection (on/off/config)',
    category: 'identity',
    inlineOutput: true,
  },
  {
    name: 'gates',
    aliases: ['coherence-gates'],
    description: 'Coherence gates for streaming',
    category: 'identity',
    inlineOutput: true,
  },

  // Advanced Commands
  {
    name: 'persist',
    aliases: ['memory-persist'],
    description: 'Memory persistence (export/backup/dedupe)',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'configure',
    aliases: ['nl-config'],
    description: 'Natural language operator configuration',
    category: 'advanced',
    inlineOutput: true,
    args: [{
      name: 'instruction',
      required: true,
      description: 'Configuration instruction in natural language',
    }],
  },
  {
    name: 'branch',
    aliases: ['branches'],
    description: 'Conversation branching & time travel',
    category: 'advanced',
    inlineOutput: true,
    subcommands: [
      {
        name: 'create',
        aliases: [],
        description: 'Create a new branch',
        category: 'advanced',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Branch name',
        }],
      },
      {
        name: 'switch',
        aliases: [],
        description: 'Switch to a branch',
        category: 'advanced',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Branch name',
        }],
      },
      {
        name: 'list',
        aliases: [],
        description: 'List branches',
        category: 'advanced',
        inlineOutput: true,
      },
      {
        name: 'merge',
        aliases: [],
        description: 'Merge branches',
        category: 'advanced',
        inlineOutput: true,
        args: [{
          name: 'source',
          required: true,
          description: 'Source branch',
        }],
      },
    ],
  },
  {
    name: 'discover',
    aliases: ['suggest-operator'],
    description: 'Dynamic operator discovery & A/B testing',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'agents',
    aliases: ['multi-agent'],
    description: 'Multi-agent orchestration & coordination',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'presets',
    aliases: ['marketplace'],
    description: 'Personality marketplace & presets',
    category: 'advanced',
    inlineOutput: true,
    subcommands: [
      {
        name: 'list',
        aliases: [],
        description: 'List available presets',
        category: 'advanced',
        inlineOutput: true,
      },
      {
        name: 'search',
        aliases: [],
        description: 'Search presets',
        category: 'advanced',
        inlineOutput: true,
        args: [{
          name: 'query',
          required: true,
          description: 'Search query',
        }],
      },
      {
        name: 'apply',
        aliases: [],
        description: 'Apply a preset',
        category: 'advanced',
        inlineOutput: true,
        args: [{
          name: 'name',
          required: true,
          description: 'Preset name',
        }],
      },
    ],
  },
  {
    name: 'compress',
    aliases: ['memory-compress'],
    description: 'Semantic memory compression & hierarchy',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'dashboard',
    aliases: ['telemetry'],
    description: 'Real-time telemetry & visualization',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'knowledge',
    aliases: [],
    description: 'External knowledge graph integration',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'sdk',
    aliases: ['plugin-dev'],
    description: 'Plugin development SDK & tools',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'stream',
    aliases: ['adaptive'],
    description: 'Adaptive response streaming & confidence',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'replay',
    aliases: [],
    description: 'Stance evolution recording & replay',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'voice',
    aliases: ['audio'],
    description: 'Voice/audio interface & TTS',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'ide',
    aliases: [],
    description: 'IDE integration (VS Code, JetBrains)',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'codegen',
    aliases: ['generate'],
    description: 'Stance-aware code generation',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'vr',
    aliases: ['ar', '3d'],
    description: 'VR/AR stance visualization (WebXR)',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'docs',
    aliases: ['docgen'],
    description: 'Auto documentation & journey recording',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'experiment',
    aliases: ['ab', 'abtest'],
    description: 'A/B testing framework for operators',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'rewrite',
    aliases: ['prompt'],
    description: 'Context-aware prompt rewriting',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'diff',
    aliases: ['merge'],
    description: 'Stance diffing, merging & rollback',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'workflow',
    aliases: ['integrate'],
    description: 'External integrations (Slack/Discord)',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'training',
    aliases: [],
    description: 'Custom training data export (JSONL/JSON/CSV)',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'language',
    aliases: ['i18n', 'locale'],
    description: 'Multi-language support & localization',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'community',
    aliases: [],
    description: 'Community preset marketplace',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'benchmark',
    aliases: ['perf'],
    description: 'Performance benchmarking & regression',
    category: 'advanced',
    inlineOutput: true,
  },
  {
    name: 'autonomy',
    aliases: ['goal', 'pursue'],
    description: 'Autonomous goal pursuit & sessions',
    category: 'advanced',
    inlineOutput: true,
  },

  // System
  {
    name: 'help',
    aliases: ['?'],
    description: 'Show available commands',
    category: 'system',
    inlineOutput: true,
  },
  {
    name: 'clear',
    aliases: [],
    description: 'Clear chat history display',
    category: 'system',
    inlineOutput: false,
  },
];

// =============================================================================
// Dynamic Plugin Commands Registry
// =============================================================================

/** Plugin commands stored by plugin ID */
const pluginCommands: Map<string, Command[]> = new Map();

/**
 * Get all commands (core + plugin commands)
 */
export function getAllCommands(): Command[] {
  const allCommands = [...coreCommands];
  pluginCommands.forEach((commands) => {
    allCommands.push(...commands);
  });
  return allCommands;
}

/**
 * Export COMMANDS as a getter that dynamically includes plugin commands
 * This maintains backwards compatibility with existing code
 */
export const COMMANDS: Command[] = new Proxy(coreCommands, {
  get(target, prop) {
    // For array operations, return from combined array
    if (prop === 'length') {
      return getAllCommands().length;
    }
    if (prop === Symbol.iterator) {
      return function* () {
        yield* getAllCommands();
      };
    }
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return getAllCommands()[Number(prop)];
    }
    if (prop === 'find' || prop === 'filter' || prop === 'map' || prop === 'forEach' || prop === 'indexOf') {
      return (...args: unknown[]) => {
        const allCmds = getAllCommands();
        return (allCmds as unknown as Record<string, (...args: unknown[]) => unknown>)[prop as string](...args);
      };
    }
    // Fallback to target for other operations
    return (target as unknown as Record<string | symbol, unknown>)[prop];
  }
});

/**
 * Register commands from a plugin
 * @param pluginId - Unique plugin identifier
 * @param commands - Array of Command objects to register
 */
export function registerPluginCommands(pluginId: string, commands: Command[]): void {
  if (pluginCommands.has(pluginId)) {
    console.warn(`[Commands] Plugin "${pluginId}" already has commands registered. Replacing.`);
  }
  pluginCommands.set(pluginId, commands);
  console.log(`[Commands] Registered ${commands.length} commands from plugin: ${pluginId}`);
}

/**
 * Unregister all commands from a plugin
 * @param pluginId - Unique plugin identifier
 */
export function unregisterPluginCommands(pluginId: string): void {
  const removed = pluginCommands.delete(pluginId);
  if (removed) {
    console.log(`[Commands] Unregistered commands from plugin: ${pluginId}`);
  }
}

/**
 * Get commands registered by a specific plugin
 * @param pluginId - Unique plugin identifier
 */
export function getPluginCommands(pluginId: string): Command[] {
  return pluginCommands.get(pluginId) || [];
}

// =============================================================================
// Command Lookup Functions
// =============================================================================

/**
 * Find a command by name or alias
 */
export function findCommand(name: string): Command | undefined {
  const lowerName = name.toLowerCase();
  return COMMANDS.find(
    cmd => cmd.name === lowerName || cmd.aliases.includes(lowerName)
  );
}

/**
 * Find a subcommand
 */
export function findSubcommand(parent: Command, name: string): Command | undefined {
  if (!parent.subcommands) return undefined;
  const lowerName = name.toLowerCase();
  return parent.subcommands.find(
    cmd => cmd.name === lowerName || cmd.aliases.includes(lowerName)
  );
}

/**
 * Get all commands matching a prefix (for autocomplete)
 */
export function getMatchingCommands(prefix: string): Command[] {
  const lowerPrefix = prefix.toLowerCase();
  return COMMANDS.filter(
    cmd =>
      cmd.name.startsWith(lowerPrefix) ||
      cmd.aliases.some(a => a.startsWith(lowerPrefix))
  );
}

/**
 * Parse a command string into parts
 */
export function parseCommand(input: string): {
  command: string;
  subcommand?: string;
  args: string[];
} {
  const parts = input.slice(1).trim().split(/\s+/);
  const command = parts[0] || '';

  const parentCmd = findCommand(command);
  if (parentCmd?.subcommands && parts[1]) {
    const subCmd = findSubcommand(parentCmd, parts[1]);
    if (subCmd) {
      return {
        command,
        subcommand: parts[1],
        args: parts.slice(2),
      };
    }
  }

  return {
    command,
    args: parts.slice(1),
  };
}

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(): Record<CommandCategory, Command[]> {
  const grouped: Record<CommandCategory, Command[]> = {
    chat: [],
    memory: [],
    subagents: [],
    sessions: [],
    identity: [],
    advanced: [],
    system: [],
  };

  for (const cmd of COMMANDS) {
    grouped[cmd.category].push(cmd);
  }

  return grouped;
}
