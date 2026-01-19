/**
 * Memories Command - List and search stored memories
 */

import type { CommandDefinition, CommandContext, CommandResult } from './registry.js';

export const memoriesCommand: CommandDefinition = {
  name: 'memories',
  aliases: ['mem', 'recall'],
  description: 'List and search stored memories (episodic, semantic, identity). Use when the user asks about past conversations, what was discussed before, or wants to recall something.',

  // Semantic triggers (preferred) - uses embeddings for flexible matching
  semanticTriggers: [
    {
      type: 'memory_query',
      intents: [
        'recall something from earlier in our conversation',
        'what do you remember about our discussion',
        'you mentioned something before',
        'from our previous conversation',
        'what did we talk about earlier',
        'bring up that thing from before',
        'do you recall when we discussed',
        'what was that thing you said',
        'remember when I told you about',
        'earlier you said something about'
      ],
      threshold: 0.4
    }
  ],

  // Regex triggers (fallback) - used when embeddings unavailable
  triggers: [
    {
      type: 'memory_query',
      patterns: [
        /remember when/i,
        /what do you recall/i,
        /earlier.*(?:conversation|discussion|chat)/i,
        /you mentioned before/i,
        /we talked about/i,
        /do you remember/i,
        /recall.*(?:earlier|before|previous)/i,
        /what did (?:I|we) (?:say|discuss|talk about)/i,
        /from our (?:earlier|previous|last)/i
      ],
      confidence: 0.75
    }
  ],
  agentInvocable: true,
  hookTriggerable: true,

  execute(context: CommandContext, args: string[]): CommandResult {
    const { agent } = context;
    const typeArg = args[0] as 'episodic' | 'semantic' | 'identity' | undefined;

    const memories = agent.searchMemories({
      type: typeArg,
      limit: 10
    });

    if (memories.length === 0) {
      return {
        output: 'No memories found.' + (typeArg ? ` (filtered by type: ${typeArg})` : ''),
        data: [],
        shouldInjectIntoResponse: true,
        command: 'memories',
        args
      };
    }

    const lines: string[] = [`Found ${memories.length} memories:`];

    for (const mem of memories) {
      const importance = Math.round(mem.importance * 100);
      const typeIcon = mem.type === 'episodic' ? '📅' : mem.type === 'semantic' ? '💡' : '🪞';
      const preview = mem.content.length > 100 ? mem.content.slice(0, 100) + '...' : mem.content;

      lines.push(`\n${typeIcon} [${mem.type}] (${importance}% importance)`);
      lines.push(`  ${preview}`);
      lines.push(`  ${mem.timestamp.toLocaleString()}`);
    }

    return {
      output: lines.join('\n'),
      data: memories,
      shouldInjectIntoResponse: true,
      command: 'memories',
      args
    };
  }
};
