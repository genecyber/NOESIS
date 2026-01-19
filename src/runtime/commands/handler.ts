import { CommandContext } from './context.js';

export type CommandCategory =
  | 'core'
  | 'subagents'
  | 'memory'
  | 'evolution'
  | 'coherence'
  | 'identity'
  | 'advanced'
  | 'integrations';

export interface CommandResult {
  output?: string;
  data?: unknown;
  error?: string;
}

export interface CommandHandler {
  name: string;
  aliases: string[];
  description: string;
  category: CommandCategory;
  usage?: string;
  execute(ctx: CommandContext, args: string[]): Promise<CommandResult> | CommandResult;
}
