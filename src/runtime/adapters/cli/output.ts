import chalk from 'chalk';
import { OutputHelper } from '../../commands/context.js';

export class TerminalOutput implements OutputHelper {
  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.log(chalk.red(message));
  }

  warn(message: string): void {
    console.log(chalk.yellow(message));
  }

  success(message: string): void {
    console.log(chalk.green(message));
  }

  table(data: Record<string, unknown>[] | unknown[][]): void {
    console.table(data);
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}
