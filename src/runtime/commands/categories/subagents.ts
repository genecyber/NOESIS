/**
 * Subagent Commands - Spawn and manage subagents for specialized tasks
 *
 * Commands:
 * - explore: Spawn exploration subagent to investigate a topic
 * - reflect: Spawn reflection subagent for self-analysis
 * - dialectic: Start dialectic session for thesis/antithesis/synthesis
 * - verify: Spawn verification subagent to validate output
 * - subagents: List/manage active subagents
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';

/**
 * Explore command - Invoke the explorer subagent for deep investigation
 */
const exploreCommand: CommandHandler = {
  name: 'explore',
  aliases: ['ex', 'investigate'],
  description: 'Spawn an exploration subagent to analyze a topic',
  category: 'subagents',
  usage: 'explore <topic>',
  async execute(ctx: CommandContext, args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return { error: 'Usage: explore <topic>' };
    }

    const topic = args.join(' ');
    ctx.output.log(`Invoking explorer subagent...`);

    try {
      const result = await ctx.session.agent.explore(topic);
      return {
        output: result.response,
        data: {
          topic,
          toolsUsed: result.toolsUsed,
          subagentsInvoked: result.subagentsInvoked
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Explorer failed: ${message}` };
    }
  }
};

/**
 * Reflect command - Invoke the reflector subagent for self-analysis
 */
const reflectCommand: CommandHandler = {
  name: 'reflect',
  aliases: ['ref', 'introspect'],
  description: 'Spawn a reflection subagent for self-analysis',
  category: 'subagents',
  usage: 'reflect [focus]',
  async execute(ctx: CommandContext, args: string[]): Promise<CommandResult> {
    const focus = args.length > 0 ? args.join(' ') : undefined;
    ctx.output.log(`Invoking reflector subagent...`);

    try {
      const result = await ctx.session.agent.reflect(focus);
      return {
        output: result.response,
        data: {
          focus,
          toolsUsed: result.toolsUsed,
          subagentsInvoked: result.subagentsInvoked
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Reflector failed: ${message}` };
    }
  }
};

/**
 * Dialectic command - Apply thesis/antithesis/synthesis reasoning
 */
const dialecticCommand: CommandHandler = {
  name: 'dialectic',
  aliases: ['dial', 'thesis'],
  description: 'Start dialectic session between subagents for thesis/antithesis/synthesis',
  category: 'subagents',
  usage: 'dialectic <thesis>',
  async execute(ctx: CommandContext, args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return { error: 'Usage: dialectic <thesis>' };
    }

    const thesis = args.join(' ');
    ctx.output.log(`Invoking dialectic subagent...`);

    try {
      const result = await ctx.session.agent.dialectic(thesis);
      return {
        output: result.response,
        data: {
          thesis,
          toolsUsed: result.toolsUsed,
          subagentsInvoked: result.subagentsInvoked
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Dialectic failed: ${message}` };
    }
  }
};

/**
 * Verify command - Invoke the verifier subagent to validate output
 */
const verifyCommand: CommandHandler = {
  name: 'verify',
  aliases: ['check', 'validate'],
  description: 'Spawn a verification subagent to validate output or claims',
  category: 'subagents',
  usage: 'verify <text to verify>',
  async execute(ctx: CommandContext, args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return { error: 'Usage: verify <text to verify>' };
    }

    const text = args.join(' ');
    ctx.output.log(`Invoking verifier subagent...`);

    try {
      const result = await ctx.session.agent.verify(text);
      return {
        output: result.response,
        data: {
          claim: text,
          toolsUsed: result.toolsUsed,
          subagentsInvoked: result.subagentsInvoked
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Verifier failed: ${message}` };
    }
  }
};

/**
 * Subagents command - List and manage available subagents
 */
const subagentsCommand: CommandHandler = {
  name: 'subagents',
  aliases: ['agents', 'subs'],
  description: 'List available subagents and their capabilities',
  category: 'subagents',
  usage: 'subagents [name]',
  execute(ctx: CommandContext, args: string[]): CommandResult {
    const agent = ctx.session.agent;

    // If a specific subagent name is provided, show details
    if (args.length > 0) {
      const name = args[0].toLowerCase();
      const definition = agent.getSubagentDefinition(name);

      if (!definition) {
        const available = agent.getAvailableSubagents().join(', ');
        return { error: `Unknown subagent: ${name}. Available: ${available}` };
      }

      const lines = [
        `Subagent: ${definition.name}`,
        `Description: ${definition.description}`,
        `Tools: ${definition.tools.join(', ')}`,
        '',
        'System Prompt:',
        definition.systemPrompt.slice(0, 500) + (definition.systemPrompt.length > 500 ? '...' : '')
      ];

      return {
        output: lines.join('\n'),
        data: { subagent: definition }
      };
    }

    // List all available subagents
    const definitions = agent.getSubagentDefinitions();
    const lines = ['Available Subagents:', ''];

    for (const def of definitions) {
      lines.push(`  ${def.name}`);
      lines.push(`    ${def.description}`);
      lines.push(`    Tools: ${def.tools.join(', ')}`);
      lines.push('');
    }

    lines.push('Usage:');
    lines.push('  /explore <topic>     - Deep investigation');
    lines.push('  /reflect [focus]     - Self-reflection');
    lines.push('  /dialectic <thesis>  - Thesis/antithesis/synthesis');
    lines.push('  /verify <text>       - Output verification');

    return {
      output: lines.join('\n'),
      data: {
        subagents: definitions.map(d => ({
          name: d.name,
          description: d.description,
          tools: d.tools
        }))
      }
    };
  }
};

/**
 * All subagent commands exported as an array
 */
export const subagentCommands: CommandHandler[] = [
  exploreCommand,
  reflectCommand,
  dialecticCommand,
  verifyCommand,
  subagentsCommand
];
