/**
 * Command Tools
 *
 * Tools for invoking slash commands programmatically:
 * - invoke_command: Execute any registered command
 * - list_commands: List all available commands
 *
 * These tools allow the agent to proactively invoke any of the 40+ commands
 * for self-examination, memory retrieval, and introspection.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { MetamorphAgent } from '../agent/index.js';

// Context provider interface - will be injected at runtime
let agentProvider: (() => MetamorphAgent) | null = null;

export function setAgentProvider(provider: () => MetamorphAgent): void {
  agentProvider = provider;
}

function createSuccessResponse(data: unknown, message?: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            message: message || 'Command executed successfully',
            data,
          },
          null,
          2
        ),
      },
    ],
  };
}

function createErrorResponse(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
      },
    ],
    isError: true,
  };
}

// =============================================================================
// TOOL 1: invoke_command
// =============================================================================

const invokeCommandSchema = {
  command: z.string().describe(
    'The command to invoke (e.g., "memories", "evolution", "coherence", "strategies", "mood", "identity", "transformations", "reflect", "explore", "dialectic")'
  ),
  args: z.array(z.string()).optional().describe(
    'Optional arguments for the command (e.g., ["episodic"] for /memories episodic)'
  ),
};

type InvokeCommandArgs = {
  command: string;
  args?: string[];
};

export const invokeCommandTool = tool(
  'invoke_command',
  `Invoke a slash command to retrieve information or perform actions. Use this when you need to:
- Check memories: invoke_command("memories") or invoke_command("memories", ["episodic"])
- See how you've evolved: invoke_command("evolution")
- Check coherence status: invoke_command("coherence")
- View transformation history: invoke_command("transformations")
- Get current stance: invoke_command("stance")
- See emotional arc: invoke_command("mood")
- Check identity status: invoke_command("identity")
- Review strategies: invoke_command("strategies")
- Deep exploration: invoke_command("explore", ["topic to explore"])
- Self-reflection: invoke_command("reflect", ["optional focus area"])
- Dialectical analysis: invoke_command("dialectic", ["thesis to analyze"])

This allows you to proactively gather context and self-examine without waiting for user prompts.`,
  invokeCommandSchema,
  async (args: InvokeCommandArgs) => {
    try {
      if (!agentProvider) {
        throw new Error('Agent provider not configured');
      }

      const agent = agentProvider();
      const { command, args: cmdArgs = [] } = args;

      // Use the agent's invokeCommand method
      const result = agent.invokeCommand(command, cmdArgs);

      if (!result) {
        // List available commands in error message
        const available = agent.listCommands().map(c => c.name).join(', ');
        throw new Error(`Command "${command}" not found or not invocable. Available: ${available}`);
      }

      return createSuccessResponse({
        command: result.command,
        args: result.args,
        output: result.output,
        data: result.data,
      }, `Command /${command} executed successfully`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// TOOL 2: list_commands
// =============================================================================

const listCommandsSchema = {};

export const listCommandsTool = tool(
  'list_commands',
  'List all available commands that can be invoked. Use this to discover what commands are available for self-examination, memory retrieval, and other introspective actions.',
  listCommandsSchema,
  async () => {
    try {
      if (!agentProvider) {
        throw new Error('Agent provider not configured');
      }

      const agent = agentProvider();
      const commands = agent.listCommands();

      return createSuccessResponse({
        count: commands.length,
        commands,
      }, `Found ${commands.length} invocable commands`);
    } catch (error) {
      return createErrorResponse(error);
    }
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

export const commandTools = [
  invokeCommandTool,
  listCommandsTool,
];

export const COMMAND_TOOL_NAMES = [
  'invoke_command',
  'list_commands',
] as const;

export type CommandToolName = (typeof COMMAND_TOOL_NAMES)[number];
