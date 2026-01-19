import { CommandHandler, CommandCategory, CommandResult } from './handler.js';
import { CommandContext } from './context.js';

export class RuntimeCommandRegistry {
  private handlers: Map<string, CommandHandler> = new Map();
  private aliasMap: Map<string, string> = new Map();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.name, handler);
    for (const alias of handler.aliases) {
      this.aliasMap.set(alias, handler.name);
    }
  }

  registerAll(handlers: CommandHandler[]): void {
    handlers.forEach(h => this.register(h));
  }

  get(nameOrAlias: string): CommandHandler | undefined {
    const name = this.aliasMap.get(nameOrAlias) || nameOrAlias;
    return this.handlers.get(name);
  }

  async execute(nameOrAlias: string, ctx: CommandContext, args: string[]): Promise<CommandResult | null> {
    const handler = this.get(nameOrAlias);
    if (!handler) return null;
    return handler.execute(ctx, args);
  }

  list(): CommandHandler[] {
    return Array.from(this.handlers.values());
  }

  listByCategory(category: CommandCategory): CommandHandler[] {
    return this.list().filter(h => h.category === category);
  }

  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }
}

export const runtimeRegistry = new RuntimeCommandRegistry();

import { allCommands } from './categories/index.js';

// Auto-register all commands
runtimeRegistry.registerAll(allCommands);
