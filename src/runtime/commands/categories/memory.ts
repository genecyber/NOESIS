/**
 * Memory Commands - Runtime command handlers for memory operations
 *
 * Migrated from CLI to the new runtime command structure.
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';
import { LocalEmbeddingProvider } from '../../../embeddings/providers/local.js';
import { memoryInjector } from '../../../memory/proactive-injection.js';

/**
 * Format age of a date for display
 */
function formatAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * memories command - List or search memories
 */
const memoriesCommand: CommandHandler = {
  name: 'memories',
  aliases: ['memory', 'mem'],
  description: 'List or search memories (episodic, semantic, identity)',
  category: 'memory',
  usage: 'memories [type]  - type can be: episodic, semantic, or identity',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const memoryStore = ctx.session.agent.getMemoryStore();
    const typeArg = args[0] as 'episodic' | 'semantic' | 'identity' | undefined;

    // Validate type filter if provided
    const validTypes = ['episodic', 'semantic', 'identity'] as const;
    const filterType = typeArg && validTypes.includes(typeArg as typeof validTypes[number])
      ? typeArg as 'episodic' | 'semantic' | 'identity'
      : undefined;

    const memories = memoryStore.searchMemories({
      type: filterType,
      limit: 20
    });

    if (memories.length === 0) {
      const lines: string[] = [];
      lines.push(`No memories stored yet${filterType ? ` (type: ${filterType})` : ''}.`);
      lines.push('');
      lines.push('Memories are created during conversation as important');
      lines.push('information is detected and stored automatically.');

      return {
        output: lines.join('\n'),
        data: []
      };
    }

    const lines: string[] = [];
    lines.push(`=== Memories${filterType ? ` (${filterType})` : ''} ===`);
    lines.push('');

    memories.forEach((mem, i) => {
      const typeLabel = `[${mem.type}]`;
      const preview = mem.content.slice(0, 60).replace(/\n/g, ' ');
      const importance = Math.round(mem.importance * 100);

      lines.push(`${i + 1}. ${typeLabel} ${preview}${mem.content.length > 60 ? '...' : ''}`);
      lines.push(`   Importance: ${importance}% | ${mem.timestamp.toLocaleString()}`);
    });

    lines.push('');
    lines.push('Filter by type: /memories episodic | semantic | identity');

    return {
      output: lines.join('\n'),
      data: memories
    };
  }
};

/**
 * similar command - Find similar memories using semantic search
 */
const similarCommand: CommandHandler = {
  name: 'similar',
  aliases: ['sim', 'search'],
  description: 'Find semantically similar memories using embeddings',
  category: 'memory',
  usage: 'similar <search text>',

  async execute(ctx: CommandContext, args: string[]): Promise<CommandResult> {
    const query = args.join(' ').trim();

    if (!query) {
      return {
        output: 'Usage: /similar <search text>\nFinds semantically similar memories using embeddings.',
        error: 'No search query provided'
      };
    }

    const memoryStore = ctx.session.agent.getMemoryStore();
    const embeddingProvider = new LocalEmbeddingProvider();

    const lines: string[] = [];
    lines.push('=== Semantic Search ===');
    lines.push(`Query: "${query}"`);
    lines.push('');

    try {
      // Get query embedding
      const queryEmbedding = await embeddingProvider.embed(query);

      // Search memories
      const results = memoryStore.semanticSearch(queryEmbedding, {
        minSimilarity: 0.2,
        limit: 10
      });

      if (results.length === 0) {
        lines.push('No similar memories found.');
        lines.push('Memories need embeddings to be searchable.');
        lines.push('Use the agent to store memories with embeddings.');

        return {
          output: lines.join('\n'),
          data: []
        };
      }

      lines.push(`Found ${results.length} similar memories:`);
      lines.push('');

      for (const memory of results) {
        const similarity = (memory.similarity * 100).toFixed(1);
        const preview = memory.content.slice(0, 80) + (memory.content.length > 80 ? '...' : '');

        lines.push(`[${memory.type}] ${similarity}% match`);
        lines.push(`  "${preview}"`);
        lines.push(`  importance: ${memory.importance.toFixed(2)}, age: ${formatAge(memory.timestamp)}`);
        lines.push('');
      }

      return {
        output: lines.join('\n'),
        data: results
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        output: `Semantic search failed: ${errorMessage}`,
        error: errorMessage
      };
    }
  }
};

/**
 * inject command - Manage proactive memory injection
 */
const injectCommand: CommandHandler = {
  name: 'inject',
  aliases: ['memory-inject', 'injection'],
  description: 'Manage proactive memory injection settings',
  category: 'memory',
  usage: 'inject [status|on|off|config|clear]',

  execute(_ctx: CommandContext, args: string[]): CommandResult {
    const subcommand = args[0] || 'status';
    const lines: string[] = [];

    switch (subcommand) {
      case 'status': {
        const status = memoryInjector.getStatus();
        lines.push('=== Memory Injection Status ===');
        lines.push(`Enabled:          ${status.enabled ? 'Yes' : 'No'}`);
        lines.push(`Current Turn:     ${status.currentTurn}`);
        lines.push(`In Cooldown:      ${status.memoriesInCooldown}`);
        lines.push(`Cache Size:       ${status.cacheSize}`);

        return {
          output: lines.join('\n'),
          data: status
        };
      }

      case 'on':
      case 'enable':
        memoryInjector.setEnabled(true);
        return {
          output: 'Proactive memory injection enabled.'
        };

      case 'off':
      case 'disable':
        memoryInjector.setEnabled(false);
        return {
          output: 'Proactive memory injection disabled.'
        };

      case 'config': {
        const config = memoryInjector.getConfig();
        lines.push('=== Injection Configuration ===');
        lines.push(`Max Memories:       ${config.maxMemories}`);
        lines.push(`Max Tokens:         ${config.maxTokens}`);
        lines.push(`Min Relevance:      ${config.minRelevanceScore}`);
        lines.push(`Cooldown Turns:     ${config.cooldownTurns}`);
        lines.push(`Attribution Style:  ${config.attributionStyle}`);
        lines.push('');
        lines.push('Weights:');
        lines.push(`  Semantic:         ${config.weights.semantic}`);
        lines.push(`  Recency:          ${config.weights.recency}`);
        lines.push(`  Importance:       ${config.weights.importance}`);
        lines.push(`  Stance Align:     ${config.weights.stanceAlign}`);

        return {
          output: lines.join('\n'),
          data: config
        };
      }

      case 'clear':
        memoryInjector.clearCaches();
        return {
          output: 'Injection caches cleared.'
        };

      default:
        return {
          output: `Unknown inject command: ${subcommand}\nCommands: status | on | off | config | clear`,
          error: `Unknown subcommand: ${subcommand}`
        };
    }
  }
};

/**
 * Export all memory commands
 */
export const memoryCommands: CommandHandler[] = [
  memoriesCommand,
  similarCommand,
  injectCommand
];
