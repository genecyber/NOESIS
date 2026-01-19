import { Session } from '../session/session.js';
import { MetamorphRuntime } from '../runtime.js';

export interface OutputHelper {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  success(message: string): void;
  table(data: Record<string, unknown>[] | unknown[][]): void;
  json(data: unknown): void;
}

export interface CommandContext {
  session: Session;
  runtime: MetamorphRuntime;
  output: OutputHelper;
}
