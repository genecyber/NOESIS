/**
 * Core Commands - Essential commands for the runtime
 * Migrated from CLI to new runtime command structure
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';

// ============================================================================
// Helper Functions
// ============================================================================

function valueBar(value: number, width: number = 20): string {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return `${bar} ${value}%`;
}

// Utility for formatting time - exported for use by other command categories
export function formatAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// Stance Command
// ============================================================================

const stanceCommand: CommandHandler = {
  name: 'stance',
  aliases: ['frame', 'state'],
  description: 'Show current stance and frame information',
  category: 'core',
  usage: '/stance',
  execute(ctx: CommandContext, _args: string[]): CommandResult {
    const stance = ctx.session.agent.getCurrentStance();

    const lines: string[] = [
      '=== Current Stance ===',
      `Frame: ${stance.frame}`,
      `Self-Model: ${stance.selfModel}`,
      `Objective: ${stance.objective}`,
      '',
      'Values:',
      `  Curiosity:   ${valueBar(stance.values.curiosity)}`,
      `  Certainty:   ${valueBar(stance.values.certainty)}`,
      `  Risk:        ${valueBar(stance.values.risk)}`,
      `  Novelty:     ${valueBar(stance.values.novelty)}`,
      `  Empathy:     ${valueBar(stance.values.empathy)}`,
      `  Provocation: ${valueBar(stance.values.provocation)}`,
      `  Synthesis:   ${valueBar(stance.values.synthesis)}`,
      '',
      'Sentience:',
      `  Awareness: ${valueBar(stance.sentience.awarenessLevel)}`,
      `  Autonomy:  ${valueBar(stance.sentience.autonomyLevel)}`,
      `  Identity:  ${valueBar(stance.sentience.identityStrength)}`,
    ];

    if (stance.sentience.emergentGoals.length > 0) {
      lines.push('', 'Emergent Goals:');
      stance.sentience.emergentGoals.forEach(g => lines.push(`  - ${g}`));
    }

    lines.push(
      '',
      `Version: ${stance.version} | Drift: ${stance.cumulativeDrift} | Turns since shift: ${stance.turnsSinceLastShift}`
    );

    return {
      output: lines.join('\n'),
      data: stance
    };
  }
};

// ============================================================================
// Config Command
// ============================================================================

const configCommand: CommandHandler = {
  name: 'config',
  aliases: ['settings', 'cfg'],
  description: 'Show or update configuration',
  category: 'core',
  usage: '/config [key] [value]',
  execute(ctx: CommandContext, args: string[]): CommandResult {
    const config = ctx.session.agent.getConfig();

    // If args provided, attempt to update (for now, just show)
    if (args.length >= 2) {
      const key = args[0];
      const value = args[1];

      // Handle known numeric configs
      if (key === 'intensity') {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          ctx.session.agent.updateConfig({ intensity: num });
          return {
            output: `Intensity set to ${num}%`,
            data: { key, value: num }
          };
        }
        return { error: 'Intensity must be a number between 0 and 100' };
      }

      return { error: `Unknown config key: ${key}. Use /config to see available settings.` };
    }

    const lines: string[] = [
      '=== Configuration ===',
      `Intensity:       ${valueBar(config.intensity)}`,
      `Coherence Floor: ${valueBar(config.coherenceFloor)}`,
      `Sentience Level: ${valueBar(config.sentienceLevel)}`,
      `Max Drift/Turn:  ${config.maxDriftPerTurn}`,
      `Drift Budget:    ${config.driftBudget}`,
      `Model:           ${config.model}`,
    ];

    return {
      output: lines.join('\n'),
      data: config
    };
  }
};

// ============================================================================
// History Command
// ============================================================================

const historyCommand: CommandHandler = {
  name: 'history',
  aliases: ['h', 'messages'],
  description: 'Show conversation history',
  category: 'core',
  usage: '/history [count]',
  execute(ctx: CommandContext, args: string[]): CommandResult {
    const history = ctx.session.agent.getHistory();
    const count = args.length > 0 ? parseInt(args[0], 10) : 10;
    const displayCount = isNaN(count) ? 10 : Math.min(count, history.length);

    if (history.length === 0) {
      return {
        output: '=== Conversation History (0 messages) ===\nNo messages yet.',
        data: { messages: [], total: 0 }
      };
    }

    const lines: string[] = [
      `=== Conversation History (${history.length} messages) ===`
    ];

    const recentMessages = history.slice(-displayCount);
    recentMessages.forEach((msg, i) => {
      const role = msg.role === 'user' ? 'You' : 'Metamorph';
      const preview = msg.content.slice(0, 80).replace(/\n/g, ' ');
      lines.push(`${i + 1}. [${role}]: ${preview}${msg.content.length > 80 ? '...' : ''}`);
    });

    if (history.length > displayCount) {
      lines.push(`... and ${history.length - displayCount} more messages`);
    }

    return {
      output: lines.join('\n'),
      data: { messages: recentMessages, total: history.length }
    };
  }
};

// ============================================================================
// Export Command
// ============================================================================

const exportCommand: CommandHandler = {
  name: 'export',
  aliases: ['dump', 'save-state'],
  description: 'Export conversation state as JSON',
  category: 'core',
  usage: '/export',
  execute(ctx: CommandContext, _args: string[]): CommandResult {
    const exported = ctx.session.agent.exportState();

    return {
      output: '=== Exported State (JSON) ===\n' + exported,
      data: JSON.parse(exported)
    };
  }
};

// ============================================================================
// Stats Command
// ============================================================================

const statsCommand: CommandHandler = {
  name: 'stats',
  aliases: ['statistics', 'info'],
  description: 'Show session statistics',
  category: 'core',
  usage: '/stats',
  execute(ctx: CommandContext, _args: string[]): CommandResult {
    const stance = ctx.session.agent.getCurrentStance();
    const history = ctx.session.agent.getHistory();

    const userMessages = history.filter(m => m.role === 'user').length;
    const agentMessages = history.filter(m => m.role === 'assistant').length;

    // Calculate value changes from defaults
    const defaults = {
      curiosity: 70,
      certainty: 50,
      risk: 30,
      novelty: 50,
      empathy: 70,
      provocation: 30,
      synthesis: 60
    };

    const valueChanges: Array<{ key: string; diff: number }> = [];
    (Object.keys(defaults) as Array<keyof typeof defaults>).forEach(key => {
      const diff = stance.values[key] - defaults[key];
      if (diff !== 0) {
        valueChanges.push({ key, diff });
      }
    });

    const lines: string[] = [
      '=== Session Statistics ===',
      `Messages:       ${history.length}`,
      `User messages:  ${userMessages}`,
      `Agent messages: ${agentMessages}`,
      `Stance version: ${stance.version}`,
      `Total drift:    ${stance.cumulativeDrift}`,
      `Session ID:     ${ctx.session.agent.getSessionId() || 'Not established'}`,
      `Conversation:   ${ctx.session.agent.getConversationId()}`,
    ];

    if (valueChanges.length > 0) {
      lines.push('', 'Value Changes from Default:');
      valueChanges.forEach(({ key, diff }) => {
        const sign = diff > 0 ? '+' : '';
        lines.push(`  ${key}: ${sign}${diff}`);
      });
    }

    return {
      output: lines.join('\n'),
      data: {
        messageCount: history.length,
        userMessages,
        agentMessages,
        stanceVersion: stance.version,
        totalDrift: stance.cumulativeDrift,
        sessionId: ctx.session.agent.getSessionId(),
        conversationId: ctx.session.agent.getConversationId(),
        valueChanges
      }
    };
  }
};

// ============================================================================
// Help Command
// ============================================================================

const helpCommand: CommandHandler = {
  name: 'help',
  aliases: ['?', 'commands'],
  description: 'Show available commands',
  category: 'core',
  usage: '/help [command]',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_ctx: CommandContext, args: string[]): CommandResult {
    // If specific command requested
    if (args.length > 0) {
      const cmdName = args[0].replace(/^\//, '');
      // Would need access to registry here - for now just show general help
      return {
        output: `For detailed help on /${cmdName}, use the command without arguments.`,
        data: { requestedCommand: cmdName }
      };
    }

    const lines: string[] = [
      '=== METAMORPH Commands ===',
      '',
      'Chat & Control:',
      '  /stance         Show current stance (frame, values, sentience)',
      '  /config         Show configuration',
      '  /stats          Show session statistics',
      '  /mode           Change mode settings (frame, intensity, etc.)',
      '  /history        Show conversation history',
      '  /export         Export conversation state as JSON',
      '',
      'Memory & Transformation:',
      '  /memories [type]  List stored memories (episodic/semantic/identity)',
      '  /transformations  Show transformation history with scores',
      '  /operator-stats   Show operator performance statistics (or /ops)',
      '  /coherence        Show coherence forecast and operator drift costs',
      '  /strategies       Manage multi-turn operator strategies',
      '  /cache            View cached subagent results',
      '  /mood             Show emotional arc and sentiment tracking',
      '  /similar <text>   Semantic search for similar memories',
      '  /evolution        View stance evolution snapshots over time',
      '  /viz              Generate interactive D3.js visualization',
      '  /context          Context window management & compaction',
      '',
      'Subagents:',
      '  /subagents      List available subagents',
      '  /explore <topic>  Deep investigation with explorer agent',
      '  /reflect [focus]  Self-reflection with reflector agent',
      '  /dialectic <thesis>  Thesis/antithesis/synthesis analysis',
      '  /verify <text>  Verify output with verifier agent',
      '',
      'Session Management:',
      '  /sessions list         List all sessions',
      '  /sessions name <name>  Name current session',
      '  /sessions resume <id>  Get resume command for session',
      '  /sessions delete <id>  Delete a session',
      '  /sessions save         Force save current session',
      '',
      'Identity & Collaboration:',
      '  /identity       Identity persistence (save/restore/diff checkpoints)',
      '  /plugins        Plugin management (list/enable/disable)',
      '  /collab         Collaborative sessions (start/join/list)',
      '  /inject         Proactive memory injection (on/off/config)',
      '  /gates          Coherence gates for streaming (on/off/status)',
      '',
      'Advanced:',
      '  /persist        Memory persistence (export/backup/dedupe/consolidate)',
      '  /configure      Natural language operator configuration',
      '  /branch         Conversation branching & time travel',
      '  /discover       Dynamic operator discovery & A/B testing',
      '  /agents         Multi-agent orchestration & coordination',
      '  /presets        Personality marketplace & presets',
      '',
      'System:',
      '  /glow           Show glow markdown renderer status',
      '  /quit           Exit the chat (also /exit, /q)',
      '  Ctrl+C          Interrupt current operation',
      '',
      'Examples:',
      '  /mode frame playful',
      '  /mode intensity 80',
      '  /explore quantum computing implications',
      '  /dialectic "AI will replace human creativity"',
    ];

    return {
      output: lines.join('\n'),
      data: { categories: ['core', 'memory', 'subagents', 'session', 'identity', 'advanced', 'system'] }
    };
  }
};

// ============================================================================
// New Session Command
// ============================================================================

const newCommand: CommandHandler = {
  name: 'new',
  aliases: ['clear', 'new-session'],
  description: 'Start a new chat session',
  category: 'core',
  usage: '/new',
  execute(ctx: CommandContext, _args: string[]): CommandResult {
    // Create a new session via the runtime
    const newSession = ctx.runtime.sessions.createSession({
      name: `Session ${Date.now()}`
    });

    // Update the current context's session reference
    // Note: The CLI will need to handle this specially since it holds
    // its own reference to the session
    return {
      output: `New session created: ${newSession.id.slice(0, 8)}...\nPrevious session data cleared. Ready for a fresh conversation.`,
      data: {
        action: 'new-session',
        newSessionId: newSession.id,
        shouldSwitchSession: true
      }
    };
  }
};

// ============================================================================
// Quit/Exit Command
// ============================================================================

const quitCommand: CommandHandler = {
  name: 'quit',
  aliases: ['exit', 'q', 'bye'],
  description: 'Exit the application',
  category: 'core',
  usage: '/quit',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_ctx: CommandContext, _args: string[]): CommandResult {
    return {
      output: 'Goodbye!',
      data: { action: 'quit', shouldExit: true }
    };
  }
};

// ============================================================================
// Export all core commands
// ============================================================================

export const coreCommands: CommandHandler[] = [
  stanceCommand,
  configCommand,
  historyCommand,
  exportCommand,
  statsCommand,
  helpCommand,
  newCommand,
  quitCommand
];
