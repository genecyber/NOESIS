import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { MetamorphRuntime } from '../../runtime.js';
import { TerminalOutput } from './output.js';

export interface CLIAdapterOptions {
  prompt?: string;
  welcomeMessage?: string;
}

export class CLIAdapter {
  private runtime: MetamorphRuntime;
  private currentSessionId: string | null = null;
  private rl: readline.Interface | null = null;
  private output: TerminalOutput;
  private options: CLIAdapterOptions;

  constructor(runtime: MetamorphRuntime, options: CLIAdapterOptions = {}) {
    this.runtime = runtime;
    this.output = new TerminalOutput();
    this.options = {
      prompt: options.prompt || 'You: ',
      welcomeMessage: options.welcomeMessage || 'Welcome to Metamorph CLI'
    };
  }

  async start(): Promise<void> {
    const session = this.runtime.createSession();
    this.currentSessionId = session.id;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(chalk.cyan(this.options.welcomeMessage));
    console.log(chalk.dim('Type /help for commands, /quit to exit\n'));

    this.promptLoop();
  }

  private promptLoop(): void {
    if (!this.rl || !this.currentSessionId) return;

    this.rl.question(chalk.green(this.options.prompt!), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.promptLoop();
        return;
      }

      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else {
        await this.handleChat(trimmed);
      }

      this.promptLoop();
    });
  }

  private async handleCommand(input: string): Promise<void> {
    const [command, ...args] = input.slice(1).split(/\s+/);

    if (command === 'quit' || command === 'exit') {
      this.stop();
      return;
    }

    const session = this.runtime.sessions.getSession(this.currentSessionId!);
    if (!session) {
      this.output.error('No active session');
      return;
    }

    const result = await this.runtime.executeCommand(this.currentSessionId!, command, args);

    if (!result.success) {
      this.output.error(result.error || 'Command failed');
    } else if (result.result?.output) {
      this.output.log(result.result.output);
    }
  }

  private async handleChat(message: string): Promise<void> {
    const spinner = ora('Thinking...').start();

    try {
      spinner.stop();
      await this.runtime.chatStream(this.currentSessionId!, message, {
        onText: (text: string) => process.stdout.write(text),
        onComplete: () => console.log('\n')
      });
    } catch (error) {
      spinner.stop();
      this.output.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    console.log(chalk.cyan('\nGoodbye!'));
    process.exit(0);
  }
}
