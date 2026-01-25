/**
 * MetamorphRuntime - Unified runtime for CLI and HTTP
 *
 * Provides a single API surface that both adapters use.
 */

import { SessionManager, SessionManagerOptions } from './session/session-manager.js';
import { Session } from './session/session.js';
import { FileAdapter } from './session/persistence/file-adapter.js';
import { runtimeRegistry } from './commands/registry.js';
import { CommandContext, OutputHelper } from './commands/context.js';
import { CommandResult } from './commands/handler.js';
import { AgentResponse, ModeConfig, EmotionContext } from '../types/index.js';
import type { StreamCallbacks, ChatOptions as AgentChatOptions } from '../agent/index.js';

export interface RuntimeOptions extends SessionManagerOptions {
  /** Use in-memory storage (default: false - uses file-based storage) */
  inMemory?: boolean;
  /** Directory for session files (default: ./data/sessions) */
  sessionDataDir?: string;
}

export interface CommandExecutionResult {
  success: boolean;
  result?: CommandResult;
  output?: string[];
  error?: string;
}

/**
 * Chat options including emotion context from webcam detection
 * Note: Uses EmotionContext from types/index.ts, allows null from frontend
 */
export interface ChatOptions {
  emotionContext?: EmotionContext | null;
}

/**
 * Output helper that collects output for HTTP responses
 */
class CollectingOutput implements OutputHelper {
  public lines: string[] = [];

  log(message: string): void {
    this.lines.push(message);
  }

  error(message: string): void {
    this.lines.push(`ERROR: ${message}`);
  }

  warn(message: string): void {
    this.lines.push(`WARN: ${message}`);
  }

  success(message: string): void {
    this.lines.push(message);
  }

  table(data: Record<string, unknown>[] | unknown[][]): void {
    this.lines.push(JSON.stringify(data, null, 2));
  }

  json(data: unknown): void {
    this.lines.push(JSON.stringify(data, null, 2));
  }
}

export class MetamorphRuntime {
  public readonly sessions: SessionManager;

  constructor(options: RuntimeOptions = {}) {
    // Use file-based persistence by default, in-memory for tests
    let persistence = options.persistence;
    if (!persistence && !options.inMemory) {
      persistence = new FileAdapter({
        dataDir: options.sessionDataDir ?? './data/sessions'
      });
    }

    this.sessions = new SessionManager({
      ...options,
      persistence
    });
  }

  /**
   * Chat with a session (non-streaming)
   */
  async chat(sessionId: string, message: string): Promise<AgentResponse> {
    const session = this.sessions.getOrCreate(sessionId);
    session.lastActivity = new Date();
    return session.agent.chat(message);
  }

  /**
   * Chat with a session (streaming)
   */
  async chatStream(
    sessionId: string,
    message: string,
    callbacks: StreamCallbacks,
    options?: ChatOptions
  ): Promise<AgentResponse> {
    const session = this.sessions.getOrCreate(sessionId);
    session.lastActivity = new Date();
    // Convert null to undefined for agent (agent doesn't accept null)
    const agentOptions: AgentChatOptions | undefined = options ? {
      emotionContext: options.emotionContext ?? undefined
    } : undefined;
    return session.agent.chatStream(message, callbacks, agentOptions);
  }

  /**
   * Execute a command on a session
   */
  async executeCommand(
    sessionId: string,
    command: string,
    args: string[] = []
  ): Promise<CommandExecutionResult> {
    const session = this.sessions.getSession(sessionId);
    if (!session) {
      return { success: false, error: `Session not found: ${sessionId}` };
    }

    // Check if command exists
    if (!runtimeRegistry.has(command)) {
      return { success: false, error: `Command not found: ${command}` };
    }

    // Create output collector for HTTP responses
    const output = new CollectingOutput();

    const context: CommandContext = {
      session,
      runtime: this,
      output
    };

    try {
      const result = await runtimeRegistry.execute(command, context, args);
      return {
        success: true,
        result: result ?? undefined,
        output: output.lines
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        output: output.lines
      };
    }
  }

  /**
   * List available commands
   */
  listCommands(): Array<{ name: string; description: string; aliases: string[] }> {
    return runtimeRegistry.list().map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      aliases: cmd.aliases
    }));
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string) {
    const session = this.sessions.getSession(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      stance: session.agent.getCurrentStance(),
      config: session.agent.getConfig(),
      messageCount: session.agent.getHistory().length
    };
  }

  /**
   * Create a new session explicitly
   * @param config - Optional mode configuration
   * @param name - Optional session name
   * @param id - Optional custom session ID
   * @param vaultId - Optional vault ID for multitenancy
   */
  createSession(config?: Partial<ModeConfig>, name?: string, id?: string, vaultId?: string): Session {
    return this.sessions.createSession({ config, name, id, vaultId });
  }

  /**
   * Delete a session
   * @param sessionId - Session ID to delete
   * @param vaultId - Optional vault ID for multitenancy access control
   */
  deleteSession(sessionId: string, vaultId?: string): boolean {
    return this.sessions.deleteSession(sessionId, vaultId);
  }
}
