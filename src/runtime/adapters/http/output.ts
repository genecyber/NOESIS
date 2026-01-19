import { OutputHelper } from '../../commands/context.js';

export interface JSONOutputBuffer {
  logs: string[];
  errors: string[];
  warnings: string[];
  data: unknown[];
}

export class JSONOutput implements OutputHelper {
  private buffer: JSONOutputBuffer = {
    logs: [],
    errors: [],
    warnings: [],
    data: []
  };

  log(message: string): void {
    this.buffer.logs.push(message);
  }

  error(message: string): void {
    this.buffer.errors.push(message);
  }

  warn(message: string): void {
    this.buffer.warnings.push(message);
  }

  success(message: string): void {
    this.buffer.logs.push(message);
  }

  table(data: Record<string, unknown>[] | unknown[][]): void {
    this.buffer.data.push({ type: 'table', data });
  }

  json(data: unknown): void {
    this.buffer.data.push(data);
  }

  getBuffer(): JSONOutputBuffer {
    return this.buffer;
  }

  clear(): void {
    this.buffer = { logs: [], errors: [], warnings: [], data: [] };
  }
}
