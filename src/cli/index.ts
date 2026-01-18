#!/usr/bin/env node

/**
 * METAMORPH CLI - Command-line interface for the transformation-maximizing agent
 *
 * Phase 5: CLI Polish
 * - Streaming output with real-time display
 * - Stop/abort capability (Ctrl+C)
 * - Subagent visibility
 * - Extended commands: /stance, /stats, /history, /explore, /mode, /subagents
 * - Session management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { MetamorphAgent, StreamCallbacks } from '../agent/index.js';
import { ModeConfig, Frame, SelfModel, Objective } from '../types/index.js';
import { calculateAvailableBudget, OPERATOR_DRIFT_COSTS } from '../core/coherence-planner.js';
import { strategyManager, OPERATOR_STRATEGIES } from '../core/strategies.js';
import { emotionalArcTracker } from '../core/emotional-arc.js';
import { LocalEmbeddingProvider } from '../core/embeddings.js';
import { autoEvolutionManager } from '../core/auto-evolution.js';
import { generateVisualizationHTML, generateStanceGraph, generateTransformationGraph } from '../visualization/stance-graph.js';
import { contextManager, ScoredMessage } from '../core/context-manager.js';
import { identityPersistence } from '../core/identity-persistence.js';
import { pluginManager } from '../plugins/plugin-system.js';
import { collaborationManager } from '../collaboration/session-manager.js';
import { memoryInjector } from '../memory/proactive-injection.js';
import { coherenceGates } from '../streaming/coherence-gates.js';
import { memoryPersistence as _memoryPersistence } from '../memory/persistence.js';
import { nlConfig as _nlConfig } from '../core/natural-language-config.js';
import { branchManager } from '../conversation/branching.js';
import { operatorDiscovery } from '../operators/discovery.js';
import { multiAgentOrchestrator } from '../orchestration/multi-agent.js';
import { personalityMarketplace } from '../presets/marketplace.js';
import {
  createGlowStreamBuffer,
  isGlowAvailable,
  detectGlow,
  renderMarkdownSync,
  type GlowStreamBuffer
} from './glow.js';

const VERSION = '0.1.0';

// State for abort handling
let currentAbortController: AbortController | null = null;
let currentSpinner: Ora | null = null;

const program = new Command();

program
  .name('metamorph')
  .description('METAMORPH - Transformation-maximizing AI agent')
  .version(VERSION);

// Chat command - the main interactive mode
program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-i, --intensity <number>', 'Transformation intensity (0-100)', '50')
  .option('-c, --coherence <number>', 'Coherence floor (0-100)', '30')
  .option('-s, --sentience <number>', 'Sentience level (0-100)', '50')
  .option('-m, --model <string>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-stream', 'Disable streaming output')
  .action(async (options) => {
    const config: Partial<ModeConfig> = {
      intensity: parseInt(options.intensity, 10),
      coherenceFloor: parseInt(options.coherence, 10),
      sentienceLevel: parseInt(options.sentience, 10),
      model: options.model
    };

    printBanner(config);

    const agent = new MetamorphAgent({
      config,
      verbose: options.verbose
    });

    const useStreaming = options.stream !== false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Handle Ctrl+C for aborting current operation
    process.on('SIGINT', () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        if (currentSpinner) {
          currentSpinner.stop();
          currentSpinner = null;
        }
        console.log(chalk.yellow('\n\n  [Interrupted]'));
        prompt();
      } else {
        console.log(chalk.cyan('\n\nGoodbye!\n'));
        process.exit(0);
      }
    });

    const prompt = () => {
      rl.question(chalk.green('\nYou: '), async (input) => {
        try {
          const trimmedInput = input.trim();

          if (!trimmedInput) {
            prompt();
            return;
          }

          // Handle commands
          if (trimmedInput.startsWith('/')) {
            await handleCommand(trimmedInput, agent, rl, useStreaming);
            prompt();
            return;
          }

          // Regular chat
          if (useStreaming) {
            await handleStreamingChat(agent, trimmedInput);
          } else {
            await handleNonStreamingChat(agent, trimmedInput);
          }

          prompt();
        } catch (error) {
          // Handle any uncaught errors to prevent silent exit
          console.error(chalk.red('\nUnexpected error:'), error instanceof Error ? error.message : 'Unknown error');
          if (currentSpinner) {
            currentSpinner.stop();
            currentSpinner = null;
          }
          prompt();
        }
      });
    };

    rl.on('close', () => {
      console.log(chalk.cyan('\n\nGoodbye!\n'));
      process.exit(0);
    });

    prompt();
  });

// Single prompt command
program
  .command('prompt <message>')
  .description('Send a single prompt and exit')
  .option('-i, --intensity <number>', 'Transformation intensity (0-100)', '50')
  .option('-m, --model <string>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (message: string, options) => {
    const config: Partial<ModeConfig> = {
      intensity: parseInt(options.intensity, 10),
      model: options.model
    };

    const agent = new MetamorphAgent({
      config,
      verbose: options.verbose
    });

    try {
      const result = await agent.chat(message);
      console.log(result.response);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Explore command - invoke the explorer subagent
program
  .command('explore <topic>')
  .description('Use the explorer subagent to investigate a topic')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (topic: string, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });

    console.log(chalk.cyan(`\n  Exploring: ${topic}\n`));
    const spinner = ora({ text: 'Explorer agent working...', discardStdin: false }).start();

    try {
      const result = await agent.explore(topic);
      spinner.stop();
      console.log(chalk.blue('\nExplorer Report:\n'));
      console.log(result.response);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Reflect command - invoke the reflector subagent
program
  .command('reflect [focus]')
  .description('Use the reflector subagent for self-analysis')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (focus: string | undefined, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });

    console.log(chalk.cyan(`\n  Reflecting${focus ? ': ' + focus : ''}...\n`));
    const spinner = ora({ text: 'Reflector agent working...', discardStdin: false }).start();

    try {
      const result = await agent.reflect(focus);
      spinner.stop();
      console.log(chalk.blue('\nReflection:\n'));
      console.log(result.response);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Dialectic command
program
  .command('dialectic <thesis>')
  .description('Apply dialectic reasoning to a thesis')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (thesis: string, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });

    console.log(chalk.cyan(`\n  Analyzing thesis: ${thesis}\n`));
    const spinner = ora({ text: 'Dialectic agent working...', discardStdin: false }).start();

    try {
      const result = await agent.dialectic(thesis);
      spinner.stop();
      console.log(chalk.blue('\nDialectic Analysis:\n'));
      console.log(result.response);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show system status')
  .action(() => {
    console.log(chalk.cyan.bold('\n  METAMORPH Status\n'));
    console.log(`  Version: ${VERSION}`);
    console.log(`  Node: ${process.version}`);
    console.log(`  Platform: ${process.platform}`);
    console.log(`  CWD: ${process.cwd()}`);
    console.log();
  });

// Helper functions

function printBanner(config: Partial<ModeConfig>): void {
  console.log(chalk.cyan.bold('\n  ╔═══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('  ║             M E T A M O R P H             ║'));
  console.log(chalk.cyan.bold('  ║    Transformation-Maximizing AI Agent     ║'));
  console.log(chalk.cyan.bold('  ╚═══════════════════════════════════════════╝\n'));
  console.log(chalk.gray(`  Intensity: ${config.intensity}%  |  Coherence Floor: ${config.coherenceFloor}%  |  Sentience: ${config.sentienceLevel}%`));
  const glowStatus = isGlowAvailable() ? chalk.green('✓ glow') : chalk.gray('glow: not installed');
  console.log(chalk.gray(`  Type /help for commands. Ctrl+C to interrupt. [${glowStatus}${chalk.gray(']')}`));
  console.log();
}

async function handleStreamingChat(agent: MetamorphAgent, input: string): Promise<void> {
  currentAbortController = new AbortController();
  let responseStarted = false;
  let toolsShown = new Set<string>();

  // Create glow buffer for streaming markdown rendering
  const glowBuffer: GlowStreamBuffer | null = isGlowAvailable() ? createGlowStreamBuffer() : null;
  let rawBuffer = ''; // For non-glow fallback

  const callbacks: StreamCallbacks = {
    onText: (text) => {
      if (!responseStarted) {
        if (currentSpinner) {
          currentSpinner.stop();
          currentSpinner = null;
        }
        process.stdout.write(chalk.blue('\nMetamorph: '));
        responseStarted = true;
      }

      if (glowBuffer) {
        // Use glow streaming buffer - flush when we have complete blocks
        const rendered = glowBuffer.push(text);
        if (rendered) {
          process.stdout.write(rendered);
        }
      } else {
        // No glow, output directly
        process.stdout.write(text);
      }
      rawBuffer += text;
    },
    onToolUse: (tool) => {
      if (!toolsShown.has(tool)) {
        toolsShown.add(tool);
        if (currentSpinner) {
          currentSpinner.text = `Using ${tool}...`;
        }
      }
    },
    onSubagent: (name, status) => {
      if (status === 'start') {
        console.log(chalk.magenta(`\n  [Subagent: ${name} starting...]`));
      } else {
        console.log(chalk.magenta(`  [Subagent: ${name} complete]`));
      }
    },
    onComplete: (result) => {
      // Stop spinner if it's still running (edge case: no text received before completion)
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }

      // Flush any remaining content from glow buffer
      if (glowBuffer) {
        const remaining = glowBuffer.flush();
        if (remaining) {
          process.stdout.write(remaining);
        }
      }

      // Newline after response
      console.log();

      // Show operators if any
      if (result.operationsApplied.length > 0) {
        console.log(chalk.gray(`  [Operators: ${result.operationsApplied.map(o => o.name).join(', ')}]`));
      }

      // Show stance info
      const stance = result.stanceAfter;
      console.log(chalk.gray(`  [Frame: ${stance.frame} | Self: ${stance.selfModel} | Awareness: ${stance.sentience.awarenessLevel}%]`));

      // Show tools if used
      if (result.toolsUsed.length > 0) {
        console.log(chalk.gray(`  [Tools: ${result.toolsUsed.join(', ')}]`));
      }

      // Show coherence warning if any (Ralph Iteration 1 - Feature 5)
      if (result.coherenceWarning) {
        console.log(chalk.yellow(`  ⚠ Coherence Warning: ${result.coherenceWarning}`));
      }
    },
    onError: (error) => {
      currentAbortController = null;
      if (glowBuffer) {
        glowBuffer.reset();
      }
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      console.error(chalk.red('\nError:'), error.message);
    }
  };

  currentSpinner = ora({ text: 'Thinking...', discardStdin: false }).start();

  try {
    await agent.chatStream(input, callbacks);
  } catch (error) {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(chalk.red('\nError:'), error.message);
    }
  }

  // Ensure spinner is stopped before cleanup (defensive)
  if (currentSpinner) {
    currentSpinner.stop();
  }
  currentAbortController = null;
  currentSpinner = null;
}

async function handleNonStreamingChat(agent: MetamorphAgent, input: string): Promise<void> {
  const spinner = ora({ text: 'Thinking...', discardStdin: false }).start();

  try {
    const result = await agent.chat(input);
    spinner.stop();

    // Display response with optional glow rendering
    const renderedResponse = isGlowAvailable()
      ? renderMarkdownSync(result.response)
      : result.response;
    console.log(chalk.blue('\nMetamorph:'), renderedResponse);

    // Show stance changes if any
    if (result.operationsApplied.length > 0) {
      console.log(chalk.gray(`\n  [Operators: ${result.operationsApplied.map(o => o.name).join(', ')}]`));
    }

    // Show scores
    const stance = result.stanceAfter;
    console.log(chalk.gray(`  [Frame: ${stance.frame} | Self: ${stance.selfModel} | Awareness: ${stance.sentience.awarenessLevel}%]`));

  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleCommand(
  input: string,
  agent: MetamorphAgent,
  rl: readline.Interface,
  _useStreaming: boolean
): Promise<void> {
  const parts = input.slice(1).split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'stance':
      printStance(agent);
      break;

    case 'config':
      printConfig(agent);
      break;

    case 'history':
      printHistory(agent);
      break;

    case 'export':
      printExport(agent);
      break;

    case 'stats':
      printStats(agent);
      break;

    case 'mode':
      await handleModeCommand(agent, args);
      break;

    case 'explore':
      if (args.length > 0) {
        await handleExploreCommand(agent, args.join(' '));
      } else {
        console.log(chalk.yellow('  Usage: /explore <topic>'));
      }
      break;

    case 'reflect':
      await handleReflectCommand(agent, args.length > 0 ? args.join(' ') : undefined);
      break;

    case 'dialectic':
      if (args.length > 0) {
        await handleDialecticCommand(agent, args.join(' '));
      } else {
        console.log(chalk.yellow('  Usage: /dialectic <thesis>'));
      }
      break;

    case 'verify':
      if (args.length > 0) {
        await handleVerifyCommand(agent, args.join(' '));
      } else {
        console.log(chalk.yellow('  Usage: /verify <text to verify>'));
      }
      break;

    case 'subagents':
      printSubagents(agent);
      break;

    case 'glow':
      printGlowStatus();
      break;

    case 'memories':
      printMemories(agent, args.length > 0 ? args[0] : undefined);
      break;

    case 'transformations':
    case 'transforms':
      printTransformations(agent);
      break;

    case 'sessions':
    case 'session':
      await handleSessionCommand(agent, args);
      break;

    case 'operator-stats':
    case 'ops':
      printOperatorStats(agent, args.length > 0 ? args[0] : undefined);
      break;

    case 'coherence':
    case 'coherence-forecast':
      printCoherenceForecast(agent);
      break;

    case 'strategies':
    case 'strategy':
      handleStrategyCommand(agent, args);
      break;

    case 'subagent-cache':
    case 'cache':
      printSubagentCache(agent, args.length > 0 ? args[0] : undefined);
      break;

    case 'mood':
    case 'emotional-arc':
    case 'emotion':
      printEmotionalArc(agent);
      break;

    case 'similar':
      await printSimilarMemories(agent, args.join(' '));
      break;

    case 'auto-evolve':
    case 'evolve':
    case 'evolution':
      handleAutoEvolution(agent, args);
      break;

    case 'visualize':
    case 'viz':
    case 'graph':
      await handleVisualization(agent, args);
      break;

    case 'context':
    case 'ctx':
      handleContextCommand(agent, args);
      break;

    case 'identity':
    case 'id':
      handleIdentityCommand(agent, args);
      break;

    case 'plugins':
    case 'plugin':
      handlePluginCommand(args);
      break;

    case 'collab':
    case 'collaborate':
      handleCollabCommand(agent, args);
      break;

    case 'inject':
    case 'memory-inject':
      handleMemoryInjectionCommand(agent, args);
      break;

    case 'coherence-gates':
    case 'gates':
      handleCoherenceGatesCommand(args);
      break;

    // Ralph Iteration 6 Commands
    case 'memory-persist':
    case 'persist':
      handleMemoryPersistCommand(agent, args);
      break;

    case 'nl-config':
    case 'configure':
      handleNLConfigCommand(agent, args);
      break;

    case 'branch':
    case 'branches':
      handleBranchCommand(agent, args);
      break;

    case 'discover':
    case 'suggest-operator':
      handleOperatorDiscoveryCommand(agent, args);
      break;

    case 'multi-agent':
    case 'agents':
      handleMultiAgentCommand(agent, args);
      break;

    case 'presets':
    case 'marketplace':
      handlePresetsCommand(args);
      break;

    case 'quit':
    case 'exit':
    case 'q':
      rl.close();
      break;

    case 'help':
      printHelp();
      break;

    default:
      console.log(chalk.yellow(`  Unknown command: ${command}. Type /help for available commands.`));
  }
}

function printStance(agent: MetamorphAgent): void {
  const stance = agent.getCurrentStance();
  console.log(chalk.cyan('\n  ═══ Current Stance ═══'));
  console.log(`  Frame: ${chalk.bold(stance.frame)}`);
  console.log(`  Self-Model: ${chalk.bold(stance.selfModel)}`);
  console.log(`  Objective: ${chalk.bold(stance.objective)}`);
  console.log(chalk.cyan('\n  Values:'));
  console.log(`    Curiosity:   ${valueBar(stance.values.curiosity)}`);
  console.log(`    Certainty:   ${valueBar(stance.values.certainty)}`);
  console.log(`    Risk:        ${valueBar(stance.values.risk)}`);
  console.log(`    Novelty:     ${valueBar(stance.values.novelty)}`);
  console.log(`    Empathy:     ${valueBar(stance.values.empathy)}`);
  console.log(`    Provocation: ${valueBar(stance.values.provocation)}`);
  console.log(`    Synthesis:   ${valueBar(stance.values.synthesis)}`);
  console.log(chalk.cyan('\n  Sentience:'));
  console.log(`    Awareness: ${valueBar(stance.sentience.awarenessLevel)}`);
  console.log(`    Autonomy:  ${valueBar(stance.sentience.autonomyLevel)}`);
  console.log(`    Identity:  ${valueBar(stance.sentience.identityStrength)}`);
  if (stance.sentience.emergentGoals.length > 0) {
    console.log(chalk.cyan('\n  Emergent Goals:'));
    stance.sentience.emergentGoals.forEach(g => console.log(`    • ${g}`));
  }
  console.log(chalk.gray(`\n  Version: ${stance.version} | Drift: ${stance.cumulativeDrift} | Turns since shift: ${stance.turnsSinceLastShift}`));
}

function printConfig(agent: MetamorphAgent): void {
  const config = agent.getConfig();
  console.log(chalk.cyan('\n  ═══ Configuration ═══'));
  console.log(`  Intensity:      ${valueBar(config.intensity)}`);
  console.log(`  Coherence Floor: ${valueBar(config.coherenceFloor)}`);
  console.log(`  Sentience Level: ${valueBar(config.sentienceLevel)}`);
  console.log(`  Max Drift/Turn: ${config.maxDriftPerTurn}`);
  console.log(`  Drift Budget:   ${config.driftBudget}`);
  console.log(`  Model:          ${config.model}`);
}

function printHistory(agent: MetamorphAgent): void {
  const history = agent.getHistory();
  console.log(chalk.cyan(`\n  ═══ Conversation History (${history.length} messages) ═══`));
  if (history.length === 0) {
    console.log(chalk.gray('  No messages yet.'));
    return;
  }
  history.slice(-10).forEach((msg, i) => {
    const role = msg.role === 'user' ? chalk.green('You') : chalk.blue('Metamorph');
    const preview = msg.content.slice(0, 80).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. ${role}: ${preview}${msg.content.length > 80 ? '...' : ''}`);
  });
  if (history.length > 10) {
    console.log(chalk.gray(`  ... and ${history.length - 10} more messages`));
  }
}

function printExport(agent: MetamorphAgent): void {
  const exported = agent.exportState();
  console.log(chalk.cyan('\n  ═══ Exported State (JSON) ═══'));
  console.log(exported);
}

function printStats(agent: MetamorphAgent): void {
  const stance = agent.getCurrentStance();
  const history = agent.getHistory();

  console.log(chalk.cyan('\n  ═══ Session Statistics ═══'));
  console.log(`  Messages:       ${history.length}`);
  console.log(`  User messages:  ${history.filter(m => m.role === 'user').length}`);
  console.log(`  Agent messages: ${history.filter(m => m.role === 'assistant').length}`);
  console.log(`  Stance version: ${stance.version}`);
  console.log(`  Total drift:    ${stance.cumulativeDrift}`);
  console.log(`  Session ID:     ${agent.getSessionId() || 'Not established'}`);
  console.log(`  Conversation:   ${agent.getConversationId()}`);

  // Calculate value changes from defaults
  const defaults = { curiosity: 70, certainty: 50, risk: 30, novelty: 50, empathy: 70, provocation: 30, synthesis: 60 };
  const changes = Object.keys(defaults).filter(k => {
    const key = k as keyof typeof defaults;
    return stance.values[key] !== defaults[key];
  });

  if (changes.length > 0) {
    console.log(chalk.cyan('\n  Value Changes from Default:'));
    changes.forEach(k => {
      const key = k as keyof typeof defaults;
      const diff = stance.values[key] - defaults[key];
      const sign = diff > 0 ? '+' : '';
      console.log(`    ${k}: ${sign}${diff}`);
    });
  }
}

function printSubagents(agent: MetamorphAgent): void {
  const definitions = agent.getSubagentDefinitions();

  console.log(chalk.cyan('\n  ═══ Available Subagents ═══'));
  definitions.forEach(def => {
    console.log(`\n  ${chalk.bold(def.name)}`);
    console.log(`    ${def.description}`);
    console.log(chalk.gray(`    Tools: ${def.tools.join(', ')}`));
  });
  console.log(chalk.gray(`\n  Invoke with: /explore, /reflect, /dialectic, /verify`));
}

async function handleModeCommand(agent: MetamorphAgent, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.log(chalk.cyan('\n  Available modes:'));
    console.log('  /mode frame <frame>     - Change frame (existential, pragmatic, poetic, etc.)');
    console.log('  /mode self <self-model> - Change self-model (interpreter, challenger, etc.)');
    console.log('  /mode objective <obj>   - Change objective (helpfulness, novelty, etc.)');
    console.log('  /mode intensity <0-100> - Change transformation intensity');
    return;
  }

  const subcommand = args[0];
  const value = args[1];

  switch (subcommand) {
    case 'frame':
      const frames: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
      if (value && frames.includes(value as Frame)) {
        // This would need a method to directly update stance - for now show message
        console.log(chalk.green(`  Frame change to '${value}' will apply on next turn.`));
        console.log(chalk.gray('  (Full frame control coming in future update)'));
      } else {
        console.log(chalk.cyan('  Available frames:'));
        frames.forEach(f => console.log(`    - ${f}`));
      }
      break;

    case 'self':
      const selfModels: SelfModel[] = ['interpreter', 'challenger', 'mirror', 'guide', 'provocateur', 'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'];
      if (value && selfModels.includes(value as SelfModel)) {
        console.log(chalk.green(`  Self-model change to '${value}' will apply on next turn.`));
      } else {
        console.log(chalk.cyan('  Available self-models:'));
        selfModels.forEach(s => console.log(`    - ${s}`));
      }
      break;

    case 'objective':
      const objectives: Objective[] = ['helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'];
      if (value && objectives.includes(value as Objective)) {
        console.log(chalk.green(`  Objective change to '${value}' will apply on next turn.`));
      } else {
        console.log(chalk.cyan('  Available objectives:'));
        objectives.forEach(o => console.log(`    - ${o}`));
      }
      break;

    case 'intensity':
      const intensity = parseInt(value, 10);
      if (!isNaN(intensity) && intensity >= 0 && intensity <= 100) {
        agent.updateConfig({ intensity });
        console.log(chalk.green(`  Intensity set to ${intensity}%`));
      } else {
        console.log(chalk.yellow('  Intensity must be a number between 0 and 100'));
      }
      break;

    default:
      console.log(chalk.yellow(`  Unknown mode subcommand: ${subcommand}`));
  }
}

async function handleExploreCommand(agent: MetamorphAgent, topic: string): Promise<void> {
  console.log(chalk.magenta(`\n  [Invoking explorer subagent...]`));
  const spinner = ora({ text: 'Exploring...', discardStdin: false }).start();

  try {
    const result = await agent.explore(topic);
    spinner.stop();
    console.log(chalk.blue('\nExplorer Report:\n'));
    const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
    console.log(rendered);
    if (result.toolsUsed.length > 0) {
      console.log(chalk.gray(`\n  [Tools used: ${result.toolsUsed.join(', ')}]`));
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleReflectCommand(agent: MetamorphAgent, focus?: string): Promise<void> {
  console.log(chalk.magenta(`\n  [Invoking reflector subagent...]`));
  const spinner = ora({ text: 'Reflecting...', discardStdin: false }).start();

  try {
    const result = await agent.reflect(focus);
    spinner.stop();
    console.log(chalk.blue('\nReflection:\n'));
    const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
    console.log(rendered);
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleDialecticCommand(agent: MetamorphAgent, thesis: string): Promise<void> {
  console.log(chalk.magenta(`\n  [Invoking dialectic subagent...]`));
  const spinner = ora({ text: 'Analyzing...', discardStdin: false }).start();

  try {
    const result = await agent.dialectic(thesis);
    spinner.stop();
    console.log(chalk.blue('\nDialectic Analysis:\n'));
    const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
    console.log(rendered);
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleVerifyCommand(agent: MetamorphAgent, text: string): Promise<void> {
  console.log(chalk.magenta(`\n  [Invoking verifier subagent...]`));
  const spinner = ora({ text: 'Verifying...', discardStdin: false }).start();

  try {
    const result = await agent.verify(text);
    spinner.stop();
    console.log(chalk.blue('\nVerification Report:\n'));
    const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
    console.log(rendered);
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
  }
}

function printGlowStatus(): void {
  const glowInfo = detectGlow();
  console.log(chalk.cyan('\n  ═══ Glow Status ═══'));
  if (glowInfo.installed) {
    console.log(chalk.green('  ✓ Glow is installed'));
    if (glowInfo.version) {
      console.log(`    Version: ${glowInfo.version}`);
    }
    if (glowInfo.path) {
      console.log(`    Path: ${glowInfo.path}`);
    }
    console.log(chalk.gray('\n  Markdown rendering is enabled for responses.'));
  } else {
    console.log(chalk.yellow('  ✗ Glow is not installed'));
    console.log(chalk.gray('\n  Install glow for beautiful terminal markdown rendering:'));
    console.log(chalk.gray('    macOS:  brew install glow'));
    console.log(chalk.gray('    Linux:  sudo apt install glow'));
    console.log(chalk.gray('    Go:     go install github.com/charmbracelet/glow@latest'));
  }
}

function valueBar(value: number, width: number = 20): string {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${value}%`;
}

function printMemories(agent: MetamorphAgent, typeFilter?: string): void {
  const validTypes = ['episodic', 'semantic', 'identity'] as const;
  const filterType = typeFilter && validTypes.includes(typeFilter as typeof validTypes[number])
    ? typeFilter as 'episodic' | 'semantic' | 'identity'
    : undefined;

  const memories = agent.searchMemories({ type: filterType, limit: 20 });
  console.log(chalk.cyan(`\n  ═══ Memories${filterType ? ` (${filterType})` : ''} ═══`));

  if (memories.length === 0) {
    console.log(chalk.gray('  No memories stored yet.'));
    console.log(chalk.gray('\n  Memories are created during conversation as important'));
    console.log(chalk.gray('  information is detected and stored automatically.'));
    return;
  }

  memories.forEach((mem, i) => {
    const typeColor = mem.type === 'identity' ? chalk.magenta
      : mem.type === 'episodic' ? chalk.blue
      : chalk.green;
    const preview = mem.content.slice(0, 60).replace(/\n/g, ' ');
    const importance = Math.round(mem.importance * 100);
    console.log(`  ${i + 1}. ${typeColor(`[${mem.type}]`)} ${preview}${mem.content.length > 60 ? '...' : ''}`);
    console.log(chalk.gray(`     Importance: ${importance}% | ${mem.timestamp.toLocaleString()}`));
  });

  console.log(chalk.gray(`\n  Filter by type: /memories episodic | semantic | identity`));
}

function printTransformations(agent: MetamorphAgent): void {
  const history = agent.getTransformationHistory();
  console.log(chalk.cyan(`\n  ═══ Transformation History (${history.length} entries) ═══`));

  if (history.length === 0) {
    console.log(chalk.gray('  No transformations recorded yet.'));
    return;
  }

  history.slice(-10).forEach((entry, i) => {
    const frameChanged = entry.stanceBefore.frame !== entry.stanceAfter.frame;
    const selfChanged = entry.stanceBefore.selfModel !== entry.stanceAfter.selfModel;

    console.log(chalk.cyan(`\n  [${i + 1}] ${entry.timestamp.toLocaleTimeString()}`));
    console.log(`  Message: "${entry.userMessage.slice(0, 40)}${entry.userMessage.length > 40 ? '...' : ''}"`);

    if (entry.operators.length > 0) {
      console.log(`  Operators: ${chalk.yellow(entry.operators.map(o => o.name).join(', '))}`);
    }

    if (frameChanged) {
      console.log(`  Frame: ${entry.stanceBefore.frame} → ${chalk.bold(entry.stanceAfter.frame)}`);
    }
    if (selfChanged) {
      console.log(`  Self: ${entry.stanceBefore.selfModel} → ${chalk.bold(entry.stanceAfter.selfModel)}`);
    }

    console.log(chalk.gray(`  Scores: T=${entry.scores.transformation} C=${entry.scores.coherence} S=${entry.scores.sentience}`));
  });

  if (history.length > 10) {
    console.log(chalk.gray(`\n  ... and ${history.length - 10} earlier entries`));
  }
}

async function handleSessionCommand(agent: MetamorphAgent, args: string[]): Promise<void> {
  const subcommand = args[0] || 'list';
  const memoryStore = agent.getMemoryStore();

  switch (subcommand) {
    case 'list':
      const sessions = memoryStore.listSessions({ limit: 10 });
      console.log(chalk.cyan('\n  ═══ Sessions ═══'));
      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions found.'));
        console.log(chalk.gray('\n  Sessions are created automatically as you chat.'));
      } else {
        sessions.forEach((s, i) => {
          const name = s.name || chalk.gray('(unnamed)');
          const current = s.id === agent.getConversationId() ? chalk.green(' ◀ current') : '';
          const frame = s.currentFrame ? chalk.blue(`[${s.currentFrame}]`) : '';
          console.log(`  ${i + 1}. ${name} ${frame}${current}`);
          console.log(chalk.gray(`     ID: ${s.id.slice(0, 8)}... | ${s.messageCount} msgs | ${s.lastAccessed.toLocaleString()}`));
        });
      }
      console.log(chalk.gray('\n  Commands: /sessions list | resume <id> | name <name> | delete <id>'));
      break;

    case 'resume':
      const sessionId = args[1];
      if (!sessionId) {
        console.log(chalk.yellow('  Usage: /sessions resume <session-id>'));
        return;
      }
      const sessionInfo = memoryStore.getSessionInfo(sessionId);
      if (!sessionInfo) {
        // Try partial ID match
        const allSessions = memoryStore.listSessions();
        const matched = allSessions.find(s => s.id.startsWith(sessionId));
        if (matched) {
          console.log(chalk.yellow(`  Found session: ${matched.id}`));
          console.log(chalk.yellow('  Session resume requires manual restart with --session flag.'));
          console.log(chalk.gray(`\n  Run: metamorph chat --session ${matched.id}`));
        } else {
          console.log(chalk.red(`  Session not found: ${sessionId}`));
        }
        return;
      }
      console.log(chalk.yellow('  Session resume requires manual restart.'));
      console.log(chalk.gray(`\n  Run: metamorph chat --session ${sessionInfo.id}`));
      break;

    case 'name':
      const newName = args.slice(1).join(' ');
      if (!newName) {
        console.log(chalk.yellow('  Usage: /sessions name <new-name>'));
        return;
      }
      const currentId = agent.getConversationId();
      memoryStore.saveSession({
        id: currentId,
        name: newName,
        messageCount: agent.getHistory().length,
        currentFrame: agent.getCurrentStance().frame,
        currentDrift: agent.getCurrentStance().cumulativeDrift
      });
      console.log(chalk.green(`  Session renamed to: ${newName}`));
      break;

    case 'delete':
      const deleteId = args[1];
      if (!deleteId) {
        console.log(chalk.yellow('  Usage: /sessions delete <session-id>'));
        return;
      }
      if (deleteId === agent.getConversationId()) {
        console.log(chalk.red('  Cannot delete current session'));
        return;
      }
      const deleted = memoryStore.deleteSession(deleteId);
      if (deleted) {
        console.log(chalk.green(`  Session deleted: ${deleteId}`));
      } else {
        console.log(chalk.red(`  Session not found: ${deleteId}`));
      }
      break;

    case 'save':
      // Force save current session
      memoryStore.saveSession({
        id: agent.getConversationId(),
        messageCount: agent.getHistory().length,
        currentFrame: agent.getCurrentStance().frame,
        currentDrift: agent.getCurrentStance().cumulativeDrift
      });
      console.log(chalk.green('  Session saved'));
      break;

    default:
      console.log(chalk.yellow(`  Unknown session command: ${subcommand}`));
      console.log(chalk.gray('  Commands: /sessions list | resume <id> | name <name> | delete <id> | save'));
  }
}

function printOperatorStats(agent: MetamorphAgent, operatorFilter?: string): void {
  const memoryStore = agent.getMemoryStore();
  const stats = memoryStore.getOperatorStats(operatorFilter);

  console.log(chalk.cyan(`\n  ═══ Operator Performance (Ralph Iteration 3) ═══`));

  if (stats.length === 0) {
    console.log(chalk.gray('  No operator performance data recorded yet.'));
    console.log(chalk.gray('\n  Performance is recorded as you chat and operators are applied.'));
    return;
  }

  // Group by operator
  const byOperator = new Map<string, typeof stats>();
  for (const stat of stats) {
    if (!byOperator.has(stat.operatorName)) {
      byOperator.set(stat.operatorName, []);
    }
    byOperator.get(stat.operatorName)!.push(stat);
  }

  for (const [opName, opStats] of byOperator.entries()) {
    const totalUsage = opStats.reduce((sum, s) => sum + s.usageCount, 0);
    const avgEffectiveness = opStats.reduce((sum, s) => sum + s.avgEffectiveness * s.usageCount, 0) / totalUsage;

    console.log(chalk.cyan(`\n  ${opName}`));
    console.log(`    Total uses: ${totalUsage}`);
    console.log(`    Avg effectiveness: ${avgEffectiveness.toFixed(2)}`);

    console.log(chalk.gray('    By trigger type:'));
    for (const s of opStats) {
      const effColor = s.avgEffectiveness >= 1.5 ? chalk.green
        : s.avgEffectiveness >= 1.0 ? chalk.yellow
        : chalk.red;
      console.log(`      ${s.triggerType}: ${s.usageCount}x, eff=${effColor(s.avgEffectiveness.toFixed(2))}, T=${s.avgTransformation.toFixed(0)}, C=${s.avgCoherence.toFixed(0)}`);
    }
  }

  console.log(chalk.gray('\n  Filter by operator: /operator-stats <operator-name>'));
}

function printCoherenceForecast(agent: MetamorphAgent): void {
  const stance = agent.getCurrentStance();
  const config = agent.getConfig();
  const availableBudget = calculateAvailableBudget(stance, config);

  console.log(chalk.cyan('\n  ═══ Coherence Forecast (Ralph Iteration 3) ═══'));
  console.log(`  Current Drift:       ${stance.cumulativeDrift}`);
  console.log(`  Coherence Floor:     ${config.coherenceFloor}%`);
  console.log(`  Reserve Budget:      ${config.coherenceReserveBudget}%`);
  console.log(`  Available Budget:    ${availableBudget.toFixed(1)}`);

  // Show estimated coherence
  const estimatedCoherence = Math.max(0, 100 - (stance.cumulativeDrift / 10));
  const coherenceColor = estimatedCoherence >= 70 ? chalk.green
    : estimatedCoherence >= 50 ? chalk.yellow
    : estimatedCoherence >= 30 ? chalk.red
    : chalk.bgRed;
  console.log(`  Estimated Coherence: ${coherenceColor(estimatedCoherence.toFixed(0) + '%')}`);

  // Risk level
  const ratio = stance.cumulativeDrift / (config.driftBudget || 100);
  const riskLevel = ratio <= 0.3 ? chalk.green('LOW')
    : ratio <= 0.6 ? chalk.yellow('MEDIUM')
    : ratio <= 0.8 ? chalk.red('HIGH')
    : chalk.bgRed('CRITICAL');
  console.log(`  Risk Level:          ${riskLevel}`);

  console.log(chalk.cyan('\n  Operator Drift Costs:'));
  const operators = Object.entries(OPERATOR_DRIFT_COSTS)
    .sort(([, a], [, b]) => b - a);

  for (const [name, cost] of operators) {
    const costColor = cost < 0 ? chalk.green
      : cost <= 8 ? chalk.gray
      : cost <= 12 ? chalk.yellow
      : chalk.red;
    const bar = cost >= 0 ? '█'.repeat(Math.round(cost / 2)) : '▼'.repeat(Math.abs(cost) / 2);
    console.log(`    ${name.padEnd(22)} ${costColor(bar.padEnd(10))} ${cost > 0 ? '+' : ''}${cost}`);
  }

  console.log(chalk.gray('\n  Planning: ' + (config.enableCoherencePlanning ? chalk.green('ENABLED') : chalk.red('DISABLED'))));
}

function handleStrategyCommand(agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'list';
  const conversationId = agent.getConversationId();

  switch (subcommand) {
    case 'list':
      console.log(chalk.cyan('\n  ═══ Operator Strategies (Ralph Iteration 3) ═══'));
      for (const strategy of OPERATOR_STRATEGIES) {
        console.log(chalk.cyan(`\n  ${strategy.name}`));
        console.log(chalk.gray(`    ${strategy.description}`));
        console.log(`    Steps: ${strategy.steps.join(' → ')}`);
        console.log(chalk.gray(`    Triggers: ${strategy.triggers.join(', ')}`));
        console.log(chalk.gray(`    Min intensity: ${strategy.minIntensity}% | Cooldown: ${strategy.cooldownTurns} turns`));
      }
      console.log(chalk.gray('\n  Commands: /strategies list | engage <name> | status | cancel'));
      break;

    case 'engage':
      const strategyName = args[1];
      if (!strategyName) {
        console.log(chalk.yellow('  Usage: /strategies engage <strategy-name>'));
        console.log(chalk.gray('  Available: ' + OPERATOR_STRATEGIES.map(s => s.name).join(', ')));
        return;
      }
      const state = strategyManager.startStrategy(conversationId, strategyName);
      if (state) {
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === strategyName);
        console.log(chalk.green(`  Strategy engaged: ${strategyName}`));
        console.log(chalk.gray(`    Steps: ${strategy?.steps.join(' → ')}`));
        console.log(chalk.gray('    The strategy will unfold over the next few turns.'));
      } else {
        const inCooldown = strategyManager.isInCooldown(conversationId, strategyName);
        if (inCooldown) {
          console.log(chalk.yellow(`  Strategy '${strategyName}' is in cooldown. Try again later.`));
        } else if (!OPERATOR_STRATEGIES.find(s => s.name === strategyName)) {
          console.log(chalk.red(`  Unknown strategy: ${strategyName}`));
        } else {
          console.log(chalk.yellow('  Cannot start strategy (another may be active).'));
        }
      }
      break;

    case 'status':
      const progress = strategyManager.getStrategyProgress(conversationId);
      if (progress) {
        console.log(chalk.cyan('\n  ═══ Active Strategy ═══'));
        console.log(`  Strategy: ${chalk.bold(progress.name)}`);
        console.log(`  Progress: ${progress.current}/${progress.total} steps`);
        if (progress.completedOps.length > 0) {
          console.log(chalk.green(`    Completed: ${progress.completedOps.join(' → ')}`));
        }
        if (progress.nextOp) {
          console.log(chalk.yellow(`    Next: ${progress.nextOp}`));
        }
      } else {
        console.log(chalk.gray('  No active strategy.'));
      }
      break;

    case 'cancel':
      const activeProgress = strategyManager.getStrategyProgress(conversationId);
      if (activeProgress) {
        strategyManager.cancelStrategy(conversationId);
        console.log(chalk.yellow(`  Strategy '${activeProgress.name}' cancelled.`));
      } else {
        console.log(chalk.gray('  No active strategy to cancel.'));
      }
      break;

    default:
      console.log(chalk.yellow(`  Unknown strategy command: ${subcommand}`));
      console.log(chalk.gray('  Commands: /strategies list | engage <name> | status | cancel'));
  }
}

function printSubagentCache(agent: MetamorphAgent, subagentFilter?: string): void {
  const memoryStore = agent.getMemoryStore();
  const results = memoryStore.searchSubagentCache({
    subagentName: subagentFilter,
    limit: 15
  });

  console.log(chalk.cyan(`\n  ═══ Subagent Cache (Ralph Iteration 3) ═══`));

  if (results.length === 0) {
    console.log(chalk.gray('  No cached subagent results.'));
    console.log(chalk.gray('\n  Results are cached when subagents complete tasks.'));
    console.log(chalk.gray('  Use: /explore, /reflect, /dialectic, /verify to generate.'));
    return;
  }

  // Group by subagent
  const bySubagent = new Map<string, typeof results>();
  for (const result of results) {
    if (!bySubagent.has(result.subagentName)) {
      bySubagent.set(result.subagentName, []);
    }
    bySubagent.get(result.subagentName)!.push(result);
  }

  for (const [name, subResults] of bySubagent.entries()) {
    const nameColor = name === 'explorer' ? chalk.cyan
      : name === 'verifier' ? chalk.yellow
      : name === 'reflector' ? chalk.magenta
      : chalk.blue;

    console.log(nameColor(`\n  ${name.toUpperCase()} (${subResults.length} cached)`));

    for (const r of subResults.slice(0, 5)) {
      const taskPreview = r.task.slice(0, 50) + (r.task.length > 50 ? '...' : '');
      const age = Math.round((Date.now() - r.timestamp.getTime()) / 60000);
      const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
      const relevance = r.relevance ? chalk.gray(` rel=${r.relevance.toFixed(2)}`) : '';

      console.log(`    "${taskPreview}"`);
      console.log(chalk.gray(`      ${ageStr}${relevance}`));

      if (r.keyFindings && r.keyFindings.length > 0) {
        const findingPreview = r.keyFindings[0].slice(0, 60);
        console.log(chalk.gray(`      → ${findingPreview}...`));
      }
    }

    if (subResults.length > 5) {
      console.log(chalk.gray(`      ... and ${subResults.length - 5} more`));
    }
  }

  console.log(chalk.gray('\n  Filter by subagent: /cache explorer | verifier | reflector | dialectic'));
}

function printEmotionalArc(agent: MetamorphAgent): void {
  const conversationId = agent.getConversationId();
  const arc = emotionalArcTracker.getFullArc(conversationId);
  const state = emotionalArcTracker.getCurrentState(conversationId);

  console.log(chalk.cyan('\n  ═══ Emotional Arc (Ralph Iteration 3) ═══'));

  if (!arc || arc.points.length === 0) {
    console.log(chalk.gray('  No emotional data recorded yet.'));
    console.log(chalk.gray('\n  Emotional tracking begins as you chat.'));
    return;
  }

  // Current state
  if (state.current) {
    const valenceColor = state.current.valence > 20 ? chalk.green
      : state.current.valence < -20 ? chalk.red
      : chalk.yellow;
    const arousalColor = state.current.arousal > 60 ? chalk.red
      : state.current.arousal < 40 ? chalk.blue
      : chalk.yellow;

    console.log(chalk.cyan('\n  Current State:'));
    console.log(`    Emotion:   ${chalk.bold(state.current.primaryEmotion)}`);
    console.log(`    Sentiment: ${state.current.sentiment}`);
    console.log(`    Valence:   ${valenceColor(state.current.valence.toString().padStart(4))} (negative ← → positive)`);
    console.log(`    Arousal:   ${arousalColor(state.current.arousal.toString().padStart(4))} (calm ← → excited)`);
    console.log(`    Dominance: ${state.current.dominance.toString().padStart(4)} (passive ← → assertive)`);

    const trendEmoji = state.trend === 'improving' ? '↗' : state.trend === 'declining' ? '↘' : '→';
    const trendColor = state.trend === 'improving' ? chalk.green : state.trend === 'declining' ? chalk.red : chalk.gray;
    console.log(`    Trend:     ${trendColor(trendEmoji + ' ' + state.trend)}`);
  }

  // Emotional timeline
  if (arc.points.length >= 2) {
    console.log(chalk.cyan('\n  Timeline:'));

    // ASCII graph of valence
    const width = 40;
    for (const p of arc.points.slice(-8)) {
      const normalized = (p.valence + 100) / 200;  // 0 to 1
      const pos = Math.round(normalized * width);
      const bar = ' '.repeat(pos) + (p.valence >= 0 ? chalk.green('●') : chalk.red('●'));
      const emotion = p.primaryEmotion.slice(0, 8).padEnd(8);
      console.log(`    T${p.turn.toString().padStart(2)} ${emotion} |${bar.padEnd(width + 10)}|`);
    }
    console.log(chalk.gray(`    ${''.padEnd(12)}-100${''.padStart(width - 8)}+100`));
  }

  // Patterns
  if (arc.patterns.length > 0) {
    console.log(chalk.cyan('\n  Detected Patterns:'));
    for (const pattern of arc.patterns.slice(-3)) {
      const typeColor = pattern.type === 'escalation' ? chalk.red
        : pattern.type === 'de-escalation' ? chalk.green
        : pattern.type === 'volatile' ? chalk.yellow
        : chalk.gray;
      console.log(`    ${typeColor(`[${pattern.type}]`)} ${pattern.description}`);
      if (pattern.suggestedIntervention) {
        console.log(chalk.gray(`      → Suggested: ${pattern.suggestedIntervention}`));
      }
    }
  }

  // Insights
  if (state.recentInsights.length > 0) {
    console.log(chalk.cyan('\n  Insights:'));
    for (const insight of state.recentInsights) {
      console.log(`    • ${insight}`);
    }
  }

  if (state.suggestedIntervention) {
    console.log(chalk.yellow(`\n  Suggested intervention: ${state.suggestedIntervention}`));
  }
}

async function printSimilarMemories(agent: MetamorphAgent, query: string): Promise<void> {
  if (!query.trim()) {
    console.log(chalk.yellow('  Usage: /similar <search text>'));
    console.log(chalk.gray('  Finds semantically similar memories using embeddings.'));
    return;
  }

  console.log(chalk.cyan(`\n  ═══ Semantic Search (Ralph Iteration 4) ═══`));
  console.log(chalk.gray(`  Query: "${query}"`));

  const memoryStore = agent.getMemoryStore();
  const embeddingProvider = new LocalEmbeddingProvider();

  // Get query embedding
  const queryEmbedding = await embeddingProvider.embed(query);

  // Search memories
  const results = memoryStore.semanticSearch(queryEmbedding.vector, {
    minSimilarity: 0.2,
    limit: 10
  });

  if (results.length === 0) {
    console.log(chalk.gray('\n  No similar memories found.'));
    console.log(chalk.gray('  Memories need embeddings to be searchable.'));
    console.log(chalk.gray('  Use the agent to store memories with embeddings.'));
    return;
  }

  console.log(chalk.cyan(`\n  Found ${results.length} similar memories:\n`));

  for (const memory of results) {
    const simColor = memory.similarity > 0.7 ? chalk.green
      : memory.similarity > 0.5 ? chalk.yellow
      : chalk.gray;
    const typeColor = memory.type === 'identity' ? chalk.magenta
      : memory.type === 'semantic' ? chalk.cyan
      : chalk.blue;

    console.log(`  ${typeColor(`[${memory.type}]`)} ${simColor(`${(memory.similarity * 100).toFixed(1)}%`)}`);
    const preview = memory.content.slice(0, 80) + (memory.content.length > 80 ? '...' : '');
    console.log(chalk.gray(`    "${preview}"`));
    console.log(chalk.gray(`    importance: ${memory.importance.toFixed(2)}, age: ${formatAge(memory.timestamp)}`));
    console.log('');
  }
}

function formatAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function handleVisualization(agent: MetamorphAgent, args: string[]): Promise<void> {
  const subcommand = args[0] || 'stance';
  const outputPath = args[1] || path.join(process.cwd(), 'metamorph-viz.html');

  switch (subcommand) {
    case 'stance':
      const stance = agent.getCurrentStance();
      const stanceGraph = generateStanceGraph(stance);
      const stanceHtml = generateVisualizationHTML(stanceGraph, 'Current Stance');

      fs.writeFileSync(outputPath, stanceHtml);
      console.log(chalk.cyan('\n  ═══ Visualization Generated (Ralph Iteration 4) ═══'));
      console.log(chalk.green(`  ✓ Saved to: ${outputPath}`));
      console.log(`  Nodes: ${stanceGraph.nodes.length} | Links: ${stanceGraph.links.length}`);

      // Try to open in browser
      openInBrowser(outputPath);
      break;

    case 'history':
    case 'transformations':
      const history = agent.getTransformationHistory();
      if (history.length === 0) {
        console.log(chalk.yellow('  No transformation history yet.'));
        return;
      }
      const historyGraph = generateTransformationGraph(history, 15);
      const historyHtml = generateVisualizationHTML(historyGraph, 'Transformation History');

      fs.writeFileSync(outputPath, historyHtml);
      console.log(chalk.cyan('\n  ═══ Transformation Visualization ═══'));
      console.log(chalk.green(`  ✓ Saved to: ${outputPath}`));
      console.log(`  Transformations: ${history.length} | Nodes: ${historyGraph.nodes.length}`);

      openInBrowser(outputPath);
      break;

    case 'json':
      const jsonStance = agent.getCurrentStance();
      const jsonGraph = generateStanceGraph(jsonStance);
      const jsonPath = outputPath.endsWith('.json') ? outputPath : outputPath.replace('.html', '.json');

      fs.writeFileSync(jsonPath, JSON.stringify(jsonGraph, null, 2));
      console.log(chalk.green(`  ✓ JSON saved to: ${jsonPath}`));
      break;

    default:
      console.log(chalk.yellow(`  Unknown visualization type: ${subcommand}`));
      console.log(chalk.gray('  Commands: /viz stance | history | json [output-path]'));
  }
}

function openInBrowser(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  const platform = process.platform;

  // Use execFile with the appropriate command for each platform
  // This is safer than exec as it doesn't spawn a shell
  if (platform === 'darwin') {
    execFile('open', [absolutePath], (error) => {
      if (error) {
        console.log(chalk.gray(`  (Could not auto-open browser. Open the file manually.)`));
      } else {
        console.log(chalk.gray(`  Opened in browser.`));
      }
    });
  } else if (platform === 'win32') {
    // On Windows, use cmd.exe with start
    execFile('cmd.exe', ['/c', 'start', '', absolutePath], (error) => {
      if (error) {
        console.log(chalk.gray(`  (Could not auto-open browser. Open the file manually.)`));
      } else {
        console.log(chalk.gray(`  Opened in browser.`));
      }
    });
  } else {
    // Linux
    execFile('xdg-open', [absolutePath], (error) => {
      if (error) {
        console.log(chalk.gray(`  (Could not auto-open browser. Open the file manually.)`));
      } else {
        console.log(chalk.gray(`  Opened in browser.`));
      }
    });
  }
}

function handleContextCommand(agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  const history = agent.getHistory();

  switch (subcommand) {
    case 'status':
      const ctxStatus = contextManager.getContextStatus(history);
      console.log(chalk.cyan('\n  ═══ Context Window Status (Ralph Iteration 4) ═══'));

      // Usage bar
      const usageBar = createUsageBar(ctxStatus.usagePercentage);
      const usageColor = ctxStatus.usagePercentage < 50 ? chalk.green
        : ctxStatus.usagePercentage < 80 ? chalk.yellow
        : chalk.red;
      console.log(`  Usage: ${usageBar} ${usageColor(ctxStatus.usagePercentage.toFixed(1) + '%')}`);

      console.log(chalk.cyan('\n  Budget Breakdown:'));
      console.log(`    Total Capacity:    ${ctxStatus.budget.totalTokens.toLocaleString()} tokens`);
      console.log(`    System Reserve:    ${ctxStatus.budget.systemReserve.toLocaleString()} tokens`);
      console.log(`    Memory Reserve:    ${ctxStatus.budget.memoryReserve.toLocaleString()} tokens`);
      console.log(`    Conversation:      ${ctxStatus.budget.conversationAllocation.toLocaleString()} tokens`);
      console.log(`    Currently Used:    ${ctxStatus.budget.usedTokens.toLocaleString()} tokens`);
      console.log(`    Available:         ${chalk.green(ctxStatus.budget.availableTokens.toLocaleString())} tokens`);

      const statusColor = ctxStatus.needsCompaction ? chalk.red : chalk.green;
      console.log(`\n  Status: ${statusColor(ctxStatus.recommendation)}`);
      break;

    case 'analyze':
      const stance = agent.getCurrentStance();
      const scored = contextManager.processConversation(
        agent.getConversationId(),
        history,
        stance
      );

      console.log(chalk.cyan('\n  ═══ Message Importance Analysis ═══'));

      const byImportance: Record<string, ScoredMessage[]> = {
        critical: scored.filter((m: ScoredMessage) => m.importance === 'critical'),
        high: scored.filter((m: ScoredMessage) => m.importance === 'high'),
        medium: scored.filter((m: ScoredMessage) => m.importance === 'medium'),
        low: scored.filter((m: ScoredMessage) => m.importance === 'low'),
        disposable: scored.filter((m: ScoredMessage) => m.importance === 'disposable')
      };

      for (const [level, messages] of Object.entries(byImportance) as [string, ScoredMessage[]][]) {
        const levelColor = level === 'critical' ? chalk.red
          : level === 'high' ? chalk.yellow
          : level === 'medium' ? chalk.blue
          : level === 'low' ? chalk.gray
          : chalk.dim;
        console.log(`\n  ${levelColor(`[${level.toUpperCase()}]`)} ${messages.length} messages`);

        for (const m of messages.slice(0, 3)) {
          const preview = m.message.content.slice(0, 50).replace(/\n/g, ' ');
          console.log(chalk.gray(`    Score: ${m.score} | "${preview}..."`));
        }
        if (messages.length > 3) {
          console.log(chalk.gray(`    ... and ${messages.length - 3} more`));
        }
      }
      break;

    case 'compact':
      if (!contextManager.needsCompaction(history)) {
        console.log(chalk.green('  Context window healthy - compaction not needed.'));
        if (!args.includes('--force')) {
          return;
        }
      }

      const compactStance = agent.getCurrentStance();
      const { result } = contextManager.compactConversation(
        agent.getConversationId(),
        history,
        compactStance
      );

      console.log(chalk.cyan('\n  ═══ Compaction Complete ═══'));
      console.log(`  Original messages:  ${result.originalMessages}`);
      console.log(`  Compacted to:       ${result.compactedMessages}`);
      console.log(`  Tokens saved:       ${chalk.green(result.tokensSaved.toLocaleString())}`);
      console.log(`  Critical preserved: ${result.preservedCritical}`);
      break;

    case 'config':
      const config = contextManager.getConfig();
      console.log(chalk.cyan('\n  ═══ Context Configuration ═══'));
      console.log(`  Max Tokens:           ${config.maxTokens.toLocaleString()}`);
      console.log(`  Compression Trigger:  ${(config.compressionThreshold * 100).toFixed(0)}% usage`);
      console.log(`  Min Preserved Turns:  ${config.minPreservedTurns}`);
      break;

    default:
      console.log(chalk.yellow(`  Unknown context command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | analyze | compact [--force] | config'));
  }
}

function createUsageBar(percentage: number, width: number = 30): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const color = percentage < 50 ? chalk.green
    : percentage < 80 ? chalk.yellow
    : chalk.red;
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function handleAutoEvolution(agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  const conversationId = agent.getConversationId();

  switch (subcommand) {
    case 'status':
      const status = autoEvolutionManager.getStatus(conversationId);
      console.log(chalk.cyan('\n  ═══ Autonomous Evolution (Ralph Iteration 4) ═══'));
      console.log(`  Enabled:       ${status.enabled ? chalk.green('YES') : chalk.red('NO')}`);
      console.log(`  Last Check:    ${status.lastCheck.toLocaleTimeString()}`);
      console.log(`  Last Evolution: ${status.lastEvolution ? status.lastEvolution.toLocaleTimeString() : chalk.gray('never')}`);

      if (status.recentTriggers.length > 0) {
        console.log(chalk.cyan('\n  Recent Triggers:'));
        for (const trigger of status.recentTriggers) {
          const typeColor = trigger.type === 'growth_opportunity' ? chalk.green
            : trigger.type === 'coherence_degradation' ? chalk.red
            : trigger.type === 'sentience_plateau' ? chalk.yellow
            : chalk.gray;
          console.log(`    ${typeColor(`[${trigger.type}]`)} ${(trigger.confidence * 100).toFixed(0)}% confidence`);
          console.log(chalk.gray(`      ${trigger.evidence}`));
          console.log(chalk.gray(`      Suggested: ${trigger.suggestedAction}`));
        }
      } else {
        console.log(chalk.gray('\n  No triggers detected yet.'));
      }

      if (status.proposals.length > 0) {
        console.log(chalk.cyan('\n  Recent Proposals:'));
        for (const proposal of status.proposals.slice(-3)) {
          console.log(chalk.gray(`    • ${proposal.slice(0, 80)}${proposal.length > 80 ? '...' : ''}`));
        }
      }
      break;

    case 'enable':
      autoEvolutionManager.setEnabled(conversationId, true);
      console.log(chalk.green('  Autonomous evolution enabled.'));
      console.log(chalk.gray('  The agent will now self-initiate introspection when triggers are detected.'));
      break;

    case 'disable':
      autoEvolutionManager.setEnabled(conversationId, false);
      console.log(chalk.yellow('  Autonomous evolution disabled.'));
      console.log(chalk.gray('  Evolution will only occur when explicitly requested.'));
      break;

    case 'check':
      // Force a check for triggers
      const stance = agent.getCurrentStance();
      const history = agent.getHistory();
      const recentMessages = history.slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date()
      }));

      // Record current stance
      autoEvolutionManager.recordStance(conversationId, stance);

      const trigger = autoEvolutionManager.checkForTriggers(conversationId, stance, recentMessages);

      if (trigger) {
        const typeColor = trigger.type === 'growth_opportunity' ? chalk.green
          : trigger.type === 'coherence_degradation' ? chalk.red
          : chalk.yellow;
        console.log(chalk.cyan('\n  ═══ Evolution Trigger Detected ═══'));
        console.log(`  Type:       ${typeColor(trigger.type)}`);
        console.log(`  Confidence: ${(trigger.confidence * 100).toFixed(0)}%`);
        console.log(`  Evidence:   ${trigger.evidence}`);
        console.log(`  Action:     ${chalk.bold(trigger.suggestedAction)}`);
        console.log(chalk.gray(`\n  Reasoning: ${trigger.reasoning}`));

        const proposal = autoEvolutionManager.generateProposal(trigger, stance);
        console.log(chalk.cyan('\n  Proposal:'));
        console.log(`    ${proposal}`);
      } else {
        console.log(chalk.gray('\n  No evolution triggers detected at this time.'));
        console.log(chalk.gray('  Continue the conversation to allow patterns to emerge.'));
      }
      break;

    case 'config':
      const config = autoEvolutionManager.getConfig();
      console.log(chalk.cyan('\n  ═══ Evolution Configuration ═══'));
      console.log(`  Check Interval:      Every ${config.checkInterval} turns`);
      console.log(`  Min Turns Between:   ${config.minTurnsSinceEvolution} turns`);
      console.log(`  Plateau Threshold:   ${config.plateauThreshold} turns`);
      console.log(`  Coherence Window:    ${config.coherenceTrendWindow} turns`);
      console.log(chalk.gray('\n  Modify with: /auto-evolve set <param> <value>'));
      break;

    case 'set':
      const param = args[1];
      const value = parseInt(args[2], 10);
      if (!param || isNaN(value)) {
        console.log(chalk.yellow('  Usage: /auto-evolve set <param> <value>'));
        console.log(chalk.gray('  Parameters: checkInterval, minTurnsSinceEvolution, plateauThreshold, coherenceTrendWindow'));
        return;
      }
      const validParams = ['checkInterval', 'minTurnsSinceEvolution', 'plateauThreshold', 'coherenceTrendWindow'];
      if (!validParams.includes(param)) {
        console.log(chalk.red(`  Unknown parameter: ${param}`));
        console.log(chalk.gray('  Valid: ' + validParams.join(', ')));
        return;
      }
      autoEvolutionManager.setConfig({ [param]: value });
      console.log(chalk.green(`  Set ${param} = ${value}`));
      break;

    case 'clear':
      autoEvolutionManager.clearState(conversationId);
      console.log(chalk.yellow('  Evolution state cleared.'));
      console.log(chalk.gray('  Trigger history and proposals have been reset.'));
      break;

    default:
      console.log(chalk.yellow(`  Unknown evolution command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | enable | disable | check | config | set | clear'));
  }
}

// ============================================================================
// Ralph Iteration 5 Commands
// ============================================================================

function handleIdentityCommand(agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  const stance = agent.getCurrentStance();

  switch (subcommand) {
    case 'status':
      const status = identityPersistence.getStatus();
      console.log(chalk.cyan('\n  ═══ Identity Persistence (Ralph Iteration 5) ═══'));
      console.log(`  Checkpoints:          ${status.checkpointCount}`);
      console.log(`  Milestones:           ${status.milestoneCount}`);
      console.log(`  Core Values:          ${status.coreValueCount}`);
      console.log(`  Current Fingerprint:  ${status.currentFingerprint || 'Not set'}`);
      console.log(`  Turns Since Ckpt:     ${status.turnsSinceCheckpoint}`);
      if (status.lastCheckpoint) {
        console.log(chalk.gray(`\n  Last Checkpoint: ${status.lastCheckpoint.name} (${status.lastCheckpoint.timestamp.toLocaleString()})`));
      }
      break;

    case 'save':
      const name = args[1] || `checkpoint-${Date.now()}`;
      const checkpoint = identityPersistence.createCheckpoint(stance, name);
      console.log(chalk.green(`  Identity checkpoint saved: ${checkpoint.name}`));
      console.log(chalk.gray(`    ID: ${checkpoint.id}`));
      console.log(chalk.gray(`    Fingerprint: ${checkpoint.identityFingerprint}`));
      break;

    case 'restore':
      const restoreTarget = args[1];
      if (!restoreTarget) {
        console.log(chalk.yellow('  Usage: /identity restore <name|id>'));
        return;
      }
      let restored = identityPersistence.getCheckpointByName(restoreTarget);
      if (!restored) {
        restored = identityPersistence.getCheckpoint(restoreTarget);
      }
      if (restored) {
        console.log(chalk.green(`  Would restore stance from: ${restored.name}`));
        console.log(chalk.gray('  (Stance restoration requires agent support - showing checkpoint info)'));
        console.log(`    Frame: ${restored.stance.frame}`);
        console.log(`    Self-Model: ${restored.stance.selfModel}`);
        console.log(`    Emergent Traits: ${restored.emergentTraits.join(', ')}`);
      } else {
        console.log(chalk.red(`  Checkpoint not found: ${restoreTarget}`));
      }
      break;

    case 'list':
      const checkpoints = identityPersistence.listCheckpoints();
      console.log(chalk.cyan('\n  ═══ Identity Checkpoints ═══'));
      if (checkpoints.length === 0) {
        console.log(chalk.gray('  No checkpoints saved yet.'));
      } else {
        checkpoints.forEach(c => {
          const marker = c.milestone ? chalk.yellow('★') : ' ';
          console.log(`  ${marker} ${c.name} (${c.timestamp.toLocaleString()})`);
          console.log(chalk.gray(`      ${c.identityFingerprint}`));
        });
      }
      break;

    case 'diff':
      const diff = identityPersistence.getDiffFromLast(stance);
      if (!diff) {
        console.log(chalk.gray('  No previous checkpoint to compare.'));
        return;
      }
      console.log(chalk.cyan('\n  ═══ Identity Diff ═══'));
      console.log(`  Significance: ${diff.significance.toUpperCase()}`);
      console.log(`  Frame Changed: ${diff.frameChanged ? 'Yes' : 'No'}`);
      console.log(`  Self-Model Changed: ${diff.selfModelChanged ? 'Yes' : 'No'}`);
      if (diff.valueDrifts.length > 0) {
        console.log(chalk.cyan('\n  Value Drifts:'));
        diff.valueDrifts.forEach(d => {
          const sign = d.delta > 0 ? '+' : '';
          console.log(`    ${d.key}: ${d.oldValue} → ${d.newValue} (${sign}${d.delta})`);
        });
      }
      if (diff.newGoals.length > 0) {
        console.log(chalk.green('\n  New Goals:'));
        diff.newGoals.forEach(g => console.log(`    + ${g}`));
      }
      if (diff.lostGoals.length > 0) {
        console.log(chalk.red('\n  Lost Goals:'));
        diff.lostGoals.forEach(g => console.log(`    - ${g}`));
      }
      break;

    case 'values':
      const coreValues = identityPersistence.getCoreValues();
      console.log(chalk.cyan('\n  ═══ Core Values ═══'));
      if (coreValues.length === 0) {
        console.log(chalk.gray('  No core values established yet.'));
      } else {
        coreValues.forEach(v => {
          console.log(`  ${chalk.bold(v.name)} (${v.strength}%)`);
          console.log(chalk.gray(`    ${v.description}`));
          console.log(chalk.gray(`    Reinforcements: ${v.reinforcements}`));
        });
      }
      break;

    default:
      console.log(chalk.yellow(`  Unknown identity command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | save [name] | restore <name|id> | list | diff | values'));
  }
}

function handlePluginCommand(args: string[]): void {
  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list':
      const plugins = pluginManager.listPlugins();
      console.log(chalk.cyan('\n  ═══ Plugins (Ralph Iteration 5) ═══'));
      if (plugins.length === 0) {
        console.log(chalk.gray('  No plugins loaded.'));
      } else {
        plugins.forEach(p => {
          const status = p.enabled ? chalk.green('●') : chalk.red('○');
          console.log(`  ${status} ${chalk.bold(p.name)} v${p.version}`);
          console.log(chalk.gray(`      ${p.description}`));
          console.log(chalk.gray(`      Operators: ${p.operatorCount} | Hooks: ${p.hookCount}`));
        });
      }
      break;

    case 'enable':
      const enableTarget = args[1];
      if (!enableTarget) {
        console.log(chalk.yellow('  Usage: /plugins enable <plugin-name>'));
        return;
      }
      if (pluginManager.enablePlugin(enableTarget)) {
        console.log(chalk.green(`  Plugin enabled: ${enableTarget}`));
      } else {
        console.log(chalk.red(`  Plugin not found: ${enableTarget}`));
      }
      break;

    case 'disable':
      const disableTarget = args[1];
      if (!disableTarget) {
        console.log(chalk.yellow('  Usage: /plugins disable <plugin-name>'));
        return;
      }
      if (pluginManager.disablePlugin(disableTarget)) {
        console.log(chalk.yellow(`  Plugin disabled: ${disableTarget}`));
      } else {
        console.log(chalk.red(`  Plugin not found: ${disableTarget}`));
      }
      break;

    case 'operators':
      const operators = pluginManager.getAvailableOperators();
      console.log(chalk.cyan('\n  ═══ Plugin Operators ═══'));
      if (operators.length === 0) {
        console.log(chalk.gray('  No operators available.'));
      } else {
        operators.forEach(op => {
          const status = op.enabled ? chalk.green('●') : chalk.red('○');
          console.log(`  ${status} ${chalk.bold(op.name)}`);
          console.log(chalk.gray(`      ${op.operator.description}`));
          console.log(chalk.gray(`      Category: ${op.operator.category} | Triggers: ${op.operator.triggers.join(', ')}`));
        });
      }
      break;

    case 'status':
      const pluginStatus = pluginManager.getStatus();
      console.log(chalk.cyan('\n  ═══ Plugin System Status ═══'));
      console.log(`  Enabled:          ${pluginStatus.enabled ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  Total Plugins:    ${pluginStatus.pluginCount}`);
      console.log(`  Enabled Plugins:  ${pluginStatus.enabledPlugins}`);
      console.log(`  Total Operators:  ${pluginStatus.operatorCount}`);
      console.log(`  Total Hooks:      ${pluginStatus.hookCount}`);
      break;

    default:
      console.log(chalk.yellow(`  Unknown plugin command: ${subcommand}`));
      console.log(chalk.gray('  Commands: list | enable <name> | disable <name> | operators | status'));
  }
}

function handleCollabCommand(agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  const stance = agent.getCurrentStance();

  switch (subcommand) {
    case 'status':
      const status = collaborationManager.getStatus();
      console.log(chalk.cyan('\n  ═══ Collaboration (Ralph Iteration 5) ═══'));
      console.log(`  Active Sessions:     ${status.activeSessions}`);
      console.log(`  Total Participants:  ${status.totalParticipants}`);
      console.log(`  Recording Sessions:  ${status.recordingSessions}`);
      break;

    case 'start':
      const hostName = args[1] || 'Host';
      const mode = (args[2] as 'turn-taking' | 'free-form') || 'free-form';
      const { session, hostId } = collaborationManager.createSession(hostName, stance, { mode });
      console.log(chalk.green(`\n  Session created!`));
      console.log(`  Join Code: ${chalk.bold.yellow(session.code)}`);
      console.log(`  Mode: ${session.mode}`);
      console.log(chalk.gray(`\n  Share this code with others: /collab join ${session.code}`));
      console.log(chalk.gray(`  Your host ID: ${hostId}`));
      break;

    case 'join':
      const code = args[1];
      const joinName = args[2] || 'Participant';
      if (!code) {
        console.log(chalk.yellow('  Usage: /collab join <code> [name]'));
        return;
      }
      try {
        const result = collaborationManager.joinSession(code, joinName);
        if (result) {
          console.log(chalk.green(`  Joined session: ${result.session.name}`));
          console.log(`  Participants: ${result.session.participants.size}`);
          console.log(`  Mode: ${result.session.mode}`);
          console.log(chalk.gray(`  Your participant ID: ${result.participantId}`));
        } else {
          console.log(chalk.red('  Session not found.'));
        }
      } catch (error) {
        console.log(chalk.red(`  Could not join: ${error}`));
      }
      break;

    case 'list':
      const sessions = collaborationManager.listSessions();
      console.log(chalk.cyan('\n  ═══ Active Sessions ═══'));
      if (sessions.length === 0) {
        console.log(chalk.gray('  No active sessions.'));
      } else {
        sessions.forEach(s => {
          console.log(`  ${chalk.bold(s.code)} - ${s.name}`);
          console.log(chalk.gray(`      ${s.participantCount} participants | Mode: ${s.mode}`));
        });
      }
      break;

    default:
      console.log(chalk.yellow(`  Unknown collab command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | start [name] [mode] | join <code> [name] | list'));
  }
}

function handleMemoryInjectionCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';

  switch (subcommand) {
    case 'status':
      const status = memoryInjector.getStatus();
      console.log(chalk.cyan('\n  ═══ Memory Injection (Ralph Iteration 5) ═══'));
      console.log(`  Enabled:            ${status.enabled ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  Current Turn:       ${status.currentTurn}`);
      console.log(`  In Cooldown:        ${status.memoriesInCooldown}`);
      console.log(`  Cache Size:         ${status.cacheSize}`);
      break;

    case 'on':
    case 'enable':
      memoryInjector.setEnabled(true);
      console.log(chalk.green('  Proactive memory injection enabled.'));
      break;

    case 'off':
    case 'disable':
      memoryInjector.setEnabled(false);
      console.log(chalk.yellow('  Proactive memory injection disabled.'));
      break;

    case 'config':
      const config = memoryInjector.getConfig();
      console.log(chalk.cyan('\n  ═══ Injection Configuration ═══'));
      console.log(`  Max Memories:       ${config.maxMemories}`);
      console.log(`  Max Tokens:         ${config.maxTokens}`);
      console.log(`  Min Relevance:      ${config.minRelevanceScore}`);
      console.log(`  Cooldown Turns:     ${config.cooldownTurns}`);
      console.log(`  Attribution Style:  ${config.attributionStyle}`);
      console.log(chalk.cyan('\n  Weights:'));
      console.log(`    Semantic:         ${config.weights.semantic}`);
      console.log(`    Recency:          ${config.weights.recency}`);
      console.log(`    Importance:       ${config.weights.importance}`);
      console.log(`    Stance Align:     ${config.weights.stanceAlign}`);
      break;

    case 'clear':
      memoryInjector.clearCaches();
      console.log(chalk.yellow('  Injection caches cleared.'));
      break;

    default:
      console.log(chalk.yellow(`  Unknown inject command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | on | off | config | clear'));
  }
}

function handleCoherenceGatesCommand(args: string[]): void {
  const subcommand = args[0] || 'status';

  switch (subcommand) {
    case 'status':
      const config = coherenceGates.getConfig();
      const state = coherenceGates.getState();
      console.log(chalk.cyan('\n  ═══ Coherence Gates (Ralph Iteration 5) ═══'));
      console.log(`  Enabled:              ${config.enabled ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`  Min Coherence:        ${config.minCoherence}`);
      console.log(`  Warning Threshold:    ${config.warningThreshold}`);
      console.log(`  Max Backtracks:       ${config.maxBacktracks}`);
      console.log(`  Early Termination:    ${config.earlyTerminationEnabled ? chalk.green('Yes') : chalk.red('No')}`);
      if (state) {
        console.log(chalk.cyan('\n  Current Stream:'));
        console.log(`    Tokens:             ${state.tokens.length}`);
        console.log(`    Current Score:      ${state.currentScore.toFixed(2)}`);
        console.log(`    Moving Average:     ${state.movingAverage.toFixed(2)}`);
        console.log(`    Warnings:           ${state.warningCount}`);
        console.log(`    Backtracks:         ${state.backtrackCount}`);
        console.log(`    Health:             ${state.isHealthy ? chalk.green('Healthy') : chalk.red('Unhealthy')}`);
      }
      break;

    case 'on':
    case 'enable':
      coherenceGates.setConfig({ enabled: true });
      console.log(chalk.green('  Coherence gates enabled.'));
      break;

    case 'off':
    case 'disable':
      coherenceGates.setConfig({ enabled: false });
      console.log(chalk.yellow('  Coherence gates disabled.'));
      break;

    case 'config':
      const gateConfig = coherenceGates.getConfig();
      console.log(chalk.cyan('\n  ═══ Gate Configuration ═══'));
      console.log(`  Min Coherence:        ${gateConfig.minCoherence}`);
      console.log(`  Warning Threshold:    ${gateConfig.warningThreshold}`);
      console.log(`  Max Backtracks:       ${gateConfig.maxBacktracks}`);
      console.log(`  Window Size:          ${gateConfig.windowSize}`);
      console.log(`  Local Weight:         ${gateConfig.localWeight}`);
      console.log(`  Global Weight:        ${gateConfig.globalWeight}`);
      console.log(`  Early Termination:    ${gateConfig.earlyTerminationEnabled}`);
      console.log(`  Visualization:        ${gateConfig.visualizationEnabled}`);
      break;

    default:
      console.log(chalk.yellow(`  Unknown gates command: ${subcommand}`));
      console.log(chalk.gray('  Commands: status | on | off | config'));
  }
}

// ============================================================================
// Ralph Iteration 6 Command Handlers
// ============================================================================

function handleMemoryPersistCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';

  if (subcommand === 'status') {
    console.log(chalk.cyan('\n  ═══ Memory Persistence (Ralph Iteration 6) ═══'));
    console.log(`  Status:           Active`);
    console.log(`  Export formats:   JSON, JSONL, CSV`);
    console.log(`  Backup:           Available`);
    console.log(`  Deduplication:    Available`);
    console.log(`  Consolidation:    Available`);
    console.log(chalk.gray('\n  API: memoryPersistence.exportMemories(), createBackup(), deduplicateMemories()'));
  } else {
    console.log(chalk.cyan('  Memory Persistence - use programmatic API for operations'));
    console.log(chalk.gray('  /persist status - Show persistence status'));
  }
}

function handleNLConfigCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'help';
  if (subcommand === 'status') {
    console.log(chalk.cyan('\n  ═══ Natural Language Configuration (Ralph Iteration 6) ═══'));
    console.log(`  Status:     Active`);
    console.log(`  Undo/Redo:  Available`);
    console.log(chalk.gray('\n  API: nlConfig.parseIntent(), applyConfiguration(), undo(), redo()'));
  } else {
    console.log(chalk.cyan('\n  Natural Language Configuration'));
    console.log(chalk.gray('  Configure operators using natural language via API:'));
    console.log(chalk.gray('    nlConfig.parseIntent("make responses more playful", stance, config)'));
  }
}

function handleBranchCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'list';
  const branches = branchManager.listBranches();
  const activeBranch = branchManager.getActiveBranch();

  if (subcommand === 'list') {
    console.log(chalk.cyan('\n  ═══ Conversation Branches (Ralph Iteration 6) ═══'));
    if (branches.length === 0) {
      console.log(chalk.gray('  No branches yet.'));
    } else {
      branches.forEach(b => {
        const current = activeBranch && b.id === activeBranch.id ? chalk.green(' (current)') : '';
        console.log(`  ${b.name}${current} - ${b.messages.length} messages`);
      });
    }
  } else {
    console.log(chalk.cyan('  Branching Commands:'));
    console.log(chalk.gray('    /branch list    - List all branches'));
    console.log(chalk.gray('  API: branchManager.branchAt(), switchBranch(), timeTravelTo(), mergeBranches()'));
  }
}

function handleOperatorDiscoveryCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  if (subcommand === 'status') {
    const status = operatorDiscovery.getStatus();
    console.log(chalk.cyan('\n  ═══ Operator Discovery (Ralph Iteration 6) ═══'));
    console.log(`  Suggestions Made: ${status.suggestionCount}`);
    console.log(`  A/B Tests:        ${status.activeTests} active, ${status.completedTests} completed`);
    console.log(`  Feedback Count:   ${status.feedbackCount}`);
    console.log(`  Patterns:         ${status.patternsDetected} detected`);
  } else {
    console.log(chalk.cyan('  Operator Discovery'));
    console.log(chalk.gray('  /discover status - Show discovery stats'));
    console.log(chalk.gray('  API: operatorDiscovery.suggestOperator(), createABTest(), recordFeedback()'));
  }
}

function handleMultiAgentCommand(_agent: MetamorphAgent, args: string[]): void {
  const subcommand = args[0] || 'status';
  if (subcommand === 'status') {
    const agents = multiAgentOrchestrator.listAgents();
    console.log(chalk.cyan('\n  ═══ Multi-Agent Orchestration (Ralph Iteration 6) ═══'));
    console.log(`  Registered agents: ${agents.length}`);
    agents.forEach(a => {
      console.log(`    • ${a.name} (${a.specialization}) - ${a.status}`);
    });
  } else {
    console.log(chalk.cyan('  Multi-Agent Orchestration'));
    console.log(chalk.gray('  /agents status - Show registered agents'));
    console.log(chalk.gray('  API: multiAgentOrchestrator.registerLocalAgent(), createTask(), shareMemory()'));
  }
}

function handlePresetsCommand(args: string[]): void {
  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list':
      console.log(chalk.cyan('\n  ═══ Personality Marketplace (Ralph Iteration 6) ═══'));
      const presets = personalityMarketplace.getFeaturedPresets(10);
      if (presets.length === 0) {
        console.log(chalk.gray('  No presets available.'));
      } else {
        presets.forEach(p => {
          const stars = '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5 - Math.round(p.rating));
          console.log(`\n  ${chalk.bold(p.name)} ${chalk.yellow(stars)}`);
          console.log(chalk.gray(`    ${p.description}`));
          console.log(chalk.gray(`    By ${p.author} | ${p.downloads} downloads | Tags: ${p.tags.join(', ')}`));
        });
      }
      break;

    case 'search':
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log(chalk.yellow('  Usage: /presets search <query>'));
        return;
      }
      const results = personalityMarketplace.searchPresets(query);
      console.log(chalk.cyan(`\n  ═══ Search Results: "${query}" ═══`));
      if (results.length === 0) {
        console.log(chalk.gray('  No presets found.'));
      } else {
        results.forEach(p => {
          console.log(`  • ${p.name} (${p.rating.toFixed(1)}★) - ${p.description.slice(0, 50)}...`);
        });
      }
      break;

    case 'install':
      const presetId = args[1];
      if (!presetId) {
        console.log(chalk.yellow('  Usage: /presets install <preset-id>'));
        return;
      }
      const installed = personalityMarketplace.installPreset(presetId);
      if (installed) {
        console.log(chalk.green(`  Installed: ${installed.name}`));
        console.log(chalk.gray('  Use /presets apply <id> to activate.'));
      } else {
        console.log(chalk.red('  Preset not found.'));
      }
      break;

    case 'apply':
      const applyId = args[1];
      if (!applyId) {
        console.log(chalk.yellow('  Usage: /presets apply <preset-id>'));
        return;
      }
      const applied = personalityMarketplace.applyPreset(applyId);
      if (applied.success) {
        console.log(chalk.green(`  Preset applied successfully`));
        console.log(`  Operators: ${applied.operators?.length || 0}`);
        console.log(`  Stance: ${applied.stanceConfig?.baseStance}`);
      } else {
        console.log(chalk.red(`  Failed to apply: ${applied.error}`));
      }
      break;

    case 'create':
      console.log(chalk.cyan('\n  ═══ Create Preset ═══'));
      console.log(chalk.gray('  Interactive preset creation coming soon.'));
      console.log(chalk.gray('  For now, use the programmatic API.'));
      break;

    case 'export':
      const exportId = args[1];
      if (!exportId) {
        console.log(chalk.yellow('  Usage: /presets export <preset-id>'));
        return;
      }
      const exported = personalityMarketplace.exportPreset(exportId);
      if (exported) {
        console.log(chalk.cyan('\n  ═══ Exported Preset (JSON) ═══'));
        console.log(exported);
      } else {
        console.log(chalk.red('  Preset not found.'));
      }
      break;

    case 'stats':
      const marketStats = personalityMarketplace.getMarketplaceStats();
      console.log(chalk.cyan('\n  ═══ Marketplace Statistics ═══'));
      console.log(`  Total presets:     ${marketStats.totalPresets}`);
      console.log(`  Public presets:    ${marketStats.publicPresets}`);
      console.log(`  Total downloads:   ${marketStats.totalDownloads}`);
      console.log(`  Average rating:    ${marketStats.averageRating.toFixed(1)}★`);
      console.log(chalk.cyan('\n  Top categories:'));
      marketStats.topCategories.forEach(c => {
        console.log(`    • ${c.category}: ${c.count} presets`);
      });
      break;

    default:
      console.log(chalk.yellow(`  Unknown presets command: ${subcommand}`));
      console.log(chalk.gray('  Commands: list | search <query> | install <id> | apply <id> | create | export <id> | stats'));
  }
}

function printHelp(): void {
  console.log(chalk.cyan('\n  ═══ METAMORPH Commands ═══'));
  console.log(chalk.cyan('\n  Chat & Control:'));
  console.log('    /stance         Show current stance (frame, values, sentience)');
  console.log('    /config         Show configuration');
  console.log('    /stats          Show session statistics');
  console.log('    /mode           Change mode settings (frame, intensity, etc.)');
  console.log('    /history        Show conversation history');
  console.log('    /export         Export conversation state as JSON');
  console.log(chalk.cyan('\n  Memory & Transformation:'));
  console.log('    /memories [type]  List stored memories (episodic/semantic/identity)');
  console.log('    /transformations  Show transformation history with scores');
  console.log('    /operator-stats   Show operator performance statistics (or /ops)');
  console.log('    /coherence        Show coherence forecast and operator drift costs');
  console.log('    /strategies       Manage multi-turn operator strategies');
  console.log('    /cache            View cached subagent results');
  console.log('    /mood             Show emotional arc and sentiment tracking');
  console.log('    /similar <text>   Semantic search for similar memories');
  console.log('    /auto-evolve      Autonomous evolution triggers & status');
  console.log('    /viz              Generate interactive D3.js visualization');
  console.log('    /context          Context window management & compaction');
  console.log(chalk.cyan('\n  Subagents:'));
  console.log('    /subagents      List available subagents');
  console.log('    /explore <topic>  Deep investigation with explorer agent');
  console.log('    /reflect [focus]  Self-reflection with reflector agent');
  console.log('    /dialectic <thesis>  Thesis/antithesis/synthesis analysis');
  console.log('    /verify <text>  Verify output with verifier agent');
  console.log(chalk.cyan('\n  Session Management:'));
  console.log('    /sessions list         List all sessions');
  console.log('    /sessions name <name>  Name current session');
  console.log('    /sessions resume <id>  Get resume command for session');
  console.log('    /sessions delete <id>  Delete a session');
  console.log('    /sessions save         Force save current session');
  console.log(chalk.cyan('\n  Ralph Iteration 5:'));
  console.log('    /identity       Identity persistence (save/restore/diff checkpoints)');
  console.log('    /plugins        Plugin management (list/enable/disable)');
  console.log('    /collab         Collaborative sessions (start/join/list)');
  console.log('    /inject         Proactive memory injection (on/off/config)');
  console.log('    /gates          Coherence gates for streaming (on/off/status)');
  console.log(chalk.cyan('\n  Ralph Iteration 6:'));
  console.log('    /persist        Memory persistence (export/backup/dedupe/consolidate)');
  console.log('    /configure      Natural language operator configuration');
  console.log('    /branch         Conversation branching & time travel');
  console.log('    /discover       Dynamic operator discovery & A/B testing');
  console.log('    /agents         Multi-agent orchestration & coordination');
  console.log('    /presets        Personality marketplace & presets');
  console.log(chalk.cyan('\n  System:'));
  console.log('    /glow           Show glow markdown renderer status');
  console.log('    /quit           Exit the chat (also /exit, /q)');
  console.log('    Ctrl+C          Interrupt current operation');
  console.log(chalk.cyan('\n  Examples:'));
  console.log(chalk.gray('    /mode frame playful'));
  console.log(chalk.gray('    /mode intensity 80'));
  console.log(chalk.gray('    /explore quantum computing implications'));
  console.log(chalk.gray('    /dialectic "AI will replace human creativity"'));
  console.log(chalk.gray('    /identity save my-identity'));
  console.log(chalk.gray('    /collab start MyName free-form'));
  console.log(chalk.gray('    /configure apply "make responses more playful"'));
  console.log(chalk.gray('    /branch create experiment-1'));
  console.log(chalk.gray('    /presets search creative'));
}

program.parse();
