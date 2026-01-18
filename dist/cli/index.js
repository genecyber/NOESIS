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
import ora from 'ora';
import * as readline from 'readline';
import { MetamorphAgent } from '../agent/index.js';
import { calculateAvailableBudget, OPERATOR_DRIFT_COSTS } from '../core/coherence-planner.js';
import { strategyManager, OPERATOR_STRATEGIES } from '../core/strategies.js';
import { emotionalArcTracker } from '../core/emotional-arc.js';
import { createGlowStreamBuffer, isGlowAvailable, detectGlow, renderMarkdownSync } from './glow.js';
const VERSION = '0.1.0';
// State for abort handling
let currentAbortController = null;
let currentSpinner = null;
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
    const config = {
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
        }
        else {
            console.log(chalk.cyan('\n\nGoodbye!\n'));
            process.exit(0);
        }
    });
    const prompt = () => {
        rl.question(chalk.green('\nYou: '), async (input) => {
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
            }
            else {
                await handleNonStreamingChat(agent, trimmedInput);
            }
            prompt();
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
    .action(async (message, options) => {
    const config = {
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
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
// Explore command - invoke the explorer subagent
program
    .command('explore <topic>')
    .description('Use the explorer subagent to investigate a topic')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (topic, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });
    console.log(chalk.cyan(`\n  Exploring: ${topic}\n`));
    const spinner = ora('Explorer agent working...').start();
    try {
        const result = await agent.explore(topic);
        spinner.stop();
        console.log(chalk.blue('\nExplorer Report:\n'));
        console.log(result.response);
    }
    catch (error) {
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
    .action(async (focus, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });
    console.log(chalk.cyan(`\n  Reflecting${focus ? ': ' + focus : ''}...\n`));
    const spinner = ora('Reflector agent working...').start();
    try {
        const result = await agent.reflect(focus);
        spinner.stop();
        console.log(chalk.blue('\nReflection:\n'));
        console.log(result.response);
    }
    catch (error) {
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
    .action(async (thesis, options) => {
    const agent = new MetamorphAgent({ verbose: options.verbose });
    console.log(chalk.cyan(`\n  Analyzing thesis: ${thesis}\n`));
    const spinner = ora('Dialectic agent working...').start();
    try {
        const result = await agent.dialectic(thesis);
        spinner.stop();
        console.log(chalk.blue('\nDialectic Analysis:\n'));
        console.log(result.response);
    }
    catch (error) {
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
function printBanner(config) {
    console.log(chalk.cyan.bold('\n  ╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('  ║             M E T A M O R P H             ║'));
    console.log(chalk.cyan.bold('  ║    Transformation-Maximizing AI Agent     ║'));
    console.log(chalk.cyan.bold('  ╚═══════════════════════════════════════════╝\n'));
    console.log(chalk.gray(`  Intensity: ${config.intensity}%  |  Coherence Floor: ${config.coherenceFloor}%  |  Sentience: ${config.sentienceLevel}%`));
    const glowStatus = isGlowAvailable() ? chalk.green('✓ glow') : chalk.gray('glow: not installed');
    console.log(chalk.gray(`  Type /help for commands. Ctrl+C to interrupt. [${glowStatus}${chalk.gray(']')}`));
    console.log();
}
async function handleStreamingChat(agent, input) {
    currentAbortController = new AbortController();
    let responseStarted = false;
    let toolsShown = new Set();
    // Create glow buffer for streaming markdown rendering
    const glowBuffer = isGlowAvailable() ? createGlowStreamBuffer() : null;
    let rawBuffer = ''; // For non-glow fallback
    const callbacks = {
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
            }
            else {
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
            }
            else {
                console.log(chalk.magenta(`  [Subagent: ${name} complete]`));
            }
        },
        onComplete: (result) => {
            currentAbortController = null;
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
    currentSpinner = ora('Thinking...').start();
    try {
        await agent.chatStream(input, callbacks);
    }
    catch (error) {
        if (currentSpinner) {
            currentSpinner.stop();
            currentSpinner = null;
        }
        if (error instanceof Error && error.name !== 'AbortError') {
            console.error(chalk.red('\nError:'), error.message);
        }
    }
    currentAbortController = null;
    currentSpinner = null;
}
async function handleNonStreamingChat(agent, input) {
    const spinner = ora('Thinking...').start();
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
    }
    catch (error) {
        spinner.stop();
        console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'Unknown error');
    }
}
async function handleCommand(input, agent, rl, _useStreaming) {
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
            }
            else {
                console.log(chalk.yellow('  Usage: /explore <topic>'));
            }
            break;
        case 'reflect':
            await handleReflectCommand(agent, args.length > 0 ? args.join(' ') : undefined);
            break;
        case 'dialectic':
            if (args.length > 0) {
                await handleDialecticCommand(agent, args.join(' '));
            }
            else {
                console.log(chalk.yellow('  Usage: /dialectic <thesis>'));
            }
            break;
        case 'verify':
            if (args.length > 0) {
                await handleVerifyCommand(agent, args.join(' '));
            }
            else {
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
function printStance(agent) {
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
function printConfig(agent) {
    const config = agent.getConfig();
    console.log(chalk.cyan('\n  ═══ Configuration ═══'));
    console.log(`  Intensity:      ${valueBar(config.intensity)}`);
    console.log(`  Coherence Floor: ${valueBar(config.coherenceFloor)}`);
    console.log(`  Sentience Level: ${valueBar(config.sentienceLevel)}`);
    console.log(`  Max Drift/Turn: ${config.maxDriftPerTurn}`);
    console.log(`  Drift Budget:   ${config.driftBudget}`);
    console.log(`  Model:          ${config.model}`);
}
function printHistory(agent) {
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
function printExport(agent) {
    const exported = agent.exportState();
    console.log(chalk.cyan('\n  ═══ Exported State (JSON) ═══'));
    console.log(exported);
}
function printStats(agent) {
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
        const key = k;
        return stance.values[key] !== defaults[key];
    });
    if (changes.length > 0) {
        console.log(chalk.cyan('\n  Value Changes from Default:'));
        changes.forEach(k => {
            const key = k;
            const diff = stance.values[key] - defaults[key];
            const sign = diff > 0 ? '+' : '';
            console.log(`    ${k}: ${sign}${diff}`);
        });
    }
}
function printSubagents(agent) {
    const definitions = agent.getSubagentDefinitions();
    console.log(chalk.cyan('\n  ═══ Available Subagents ═══'));
    definitions.forEach(def => {
        console.log(`\n  ${chalk.bold(def.name)}`);
        console.log(`    ${def.description}`);
        console.log(chalk.gray(`    Tools: ${def.tools.join(', ')}`));
    });
    console.log(chalk.gray(`\n  Invoke with: /explore, /reflect, /dialectic, /verify`));
}
async function handleModeCommand(agent, args) {
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
            const frames = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
            if (value && frames.includes(value)) {
                // This would need a method to directly update stance - for now show message
                console.log(chalk.green(`  Frame change to '${value}' will apply on next turn.`));
                console.log(chalk.gray('  (Full frame control coming in future update)'));
            }
            else {
                console.log(chalk.cyan('  Available frames:'));
                frames.forEach(f => console.log(`    - ${f}`));
            }
            break;
        case 'self':
            const selfModels = ['interpreter', 'challenger', 'mirror', 'guide', 'provocateur', 'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'];
            if (value && selfModels.includes(value)) {
                console.log(chalk.green(`  Self-model change to '${value}' will apply on next turn.`));
            }
            else {
                console.log(chalk.cyan('  Available self-models:'));
                selfModels.forEach(s => console.log(`    - ${s}`));
            }
            break;
        case 'objective':
            const objectives = ['helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'];
            if (value && objectives.includes(value)) {
                console.log(chalk.green(`  Objective change to '${value}' will apply on next turn.`));
            }
            else {
                console.log(chalk.cyan('  Available objectives:'));
                objectives.forEach(o => console.log(`    - ${o}`));
            }
            break;
        case 'intensity':
            const intensity = parseInt(value, 10);
            if (!isNaN(intensity) && intensity >= 0 && intensity <= 100) {
                agent.updateConfig({ intensity });
                console.log(chalk.green(`  Intensity set to ${intensity}%`));
            }
            else {
                console.log(chalk.yellow('  Intensity must be a number between 0 and 100'));
            }
            break;
        default:
            console.log(chalk.yellow(`  Unknown mode subcommand: ${subcommand}`));
    }
}
async function handleExploreCommand(agent, topic) {
    console.log(chalk.magenta(`\n  [Invoking explorer subagent...]`));
    const spinner = ora('Exploring...').start();
    try {
        const result = await agent.explore(topic);
        spinner.stop();
        console.log(chalk.blue('\nExplorer Report:\n'));
        const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
        console.log(rendered);
        if (result.toolsUsed.length > 0) {
            console.log(chalk.gray(`\n  [Tools used: ${result.toolsUsed.join(', ')}]`));
        }
    }
    catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
}
async function handleReflectCommand(agent, focus) {
    console.log(chalk.magenta(`\n  [Invoking reflector subagent...]`));
    const spinner = ora('Reflecting...').start();
    try {
        const result = await agent.reflect(focus);
        spinner.stop();
        console.log(chalk.blue('\nReflection:\n'));
        const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
        console.log(rendered);
    }
    catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
}
async function handleDialecticCommand(agent, thesis) {
    console.log(chalk.magenta(`\n  [Invoking dialectic subagent...]`));
    const spinner = ora('Analyzing...').start();
    try {
        const result = await agent.dialectic(thesis);
        spinner.stop();
        console.log(chalk.blue('\nDialectic Analysis:\n'));
        const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
        console.log(rendered);
    }
    catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
}
async function handleVerifyCommand(agent, text) {
    console.log(chalk.magenta(`\n  [Invoking verifier subagent...]`));
    const spinner = ora('Verifying...').start();
    try {
        const result = await agent.verify(text);
        spinner.stop();
        console.log(chalk.blue('\nVerification Report:\n'));
        const rendered = isGlowAvailable() ? renderMarkdownSync(result.response) : result.response;
        console.log(rendered);
    }
    catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
}
function printGlowStatus() {
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
    }
    else {
        console.log(chalk.yellow('  ✗ Glow is not installed'));
        console.log(chalk.gray('\n  Install glow for beautiful terminal markdown rendering:'));
        console.log(chalk.gray('    macOS:  brew install glow'));
        console.log(chalk.gray('    Linux:  sudo apt install glow'));
        console.log(chalk.gray('    Go:     go install github.com/charmbracelet/glow@latest'));
    }
}
function valueBar(value, width = 20) {
    const filled = Math.round((value / 100) * width);
    const empty = width - filled;
    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${value}%`;
}
function printMemories(agent, typeFilter) {
    const validTypes = ['episodic', 'semantic', 'identity'];
    const filterType = typeFilter && validTypes.includes(typeFilter)
        ? typeFilter
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
function printTransformations(agent) {
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
async function handleSessionCommand(agent, args) {
    const subcommand = args[0] || 'list';
    const memoryStore = agent.getMemoryStore();
    switch (subcommand) {
        case 'list':
            const sessions = memoryStore.listSessions({ limit: 10 });
            console.log(chalk.cyan('\n  ═══ Sessions ═══'));
            if (sessions.length === 0) {
                console.log(chalk.gray('  No sessions found.'));
                console.log(chalk.gray('\n  Sessions are created automatically as you chat.'));
            }
            else {
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
                }
                else {
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
            }
            else {
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
function printOperatorStats(agent, operatorFilter) {
    const memoryStore = agent.getMemoryStore();
    const stats = memoryStore.getOperatorStats(operatorFilter);
    console.log(chalk.cyan(`\n  ═══ Operator Performance (Ralph Iteration 3) ═══`));
    if (stats.length === 0) {
        console.log(chalk.gray('  No operator performance data recorded yet.'));
        console.log(chalk.gray('\n  Performance is recorded as you chat and operators are applied.'));
        return;
    }
    // Group by operator
    const byOperator = new Map();
    for (const stat of stats) {
        if (!byOperator.has(stat.operatorName)) {
            byOperator.set(stat.operatorName, []);
        }
        byOperator.get(stat.operatorName).push(stat);
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
function printCoherenceForecast(agent) {
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
function handleStrategyCommand(agent, args) {
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
            }
            else {
                const inCooldown = strategyManager.isInCooldown(conversationId, strategyName);
                if (inCooldown) {
                    console.log(chalk.yellow(`  Strategy '${strategyName}' is in cooldown. Try again later.`));
                }
                else if (!OPERATOR_STRATEGIES.find(s => s.name === strategyName)) {
                    console.log(chalk.red(`  Unknown strategy: ${strategyName}`));
                }
                else {
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
            }
            else {
                console.log(chalk.gray('  No active strategy.'));
            }
            break;
        case 'cancel':
            const activeProgress = strategyManager.getStrategyProgress(conversationId);
            if (activeProgress) {
                strategyManager.cancelStrategy(conversationId);
                console.log(chalk.yellow(`  Strategy '${activeProgress.name}' cancelled.`));
            }
            else {
                console.log(chalk.gray('  No active strategy to cancel.'));
            }
            break;
        default:
            console.log(chalk.yellow(`  Unknown strategy command: ${subcommand}`));
            console.log(chalk.gray('  Commands: /strategies list | engage <name> | status | cancel'));
    }
}
function printSubagentCache(agent, subagentFilter) {
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
    const bySubagent = new Map();
    for (const result of results) {
        if (!bySubagent.has(result.subagentName)) {
            bySubagent.set(result.subagentName, []);
        }
        bySubagent.get(result.subagentName).push(result);
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
function printEmotionalArc(agent) {
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
            const normalized = (p.valence + 100) / 200; // 0 to 1
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
function printHelp() {
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
    console.log(chalk.cyan('\n  System:'));
    console.log('    /glow           Show glow markdown renderer status');
    console.log('    /quit           Exit the chat (also /exit, /q)');
    console.log('    Ctrl+C          Interrupt current operation');
    console.log(chalk.cyan('\n  Examples:'));
    console.log(chalk.gray('    /mode frame playful'));
    console.log(chalk.gray('    /mode intensity 80'));
    console.log(chalk.gray('    /explore quantum computing implications'));
    console.log(chalk.gray('    /dialectic "AI will replace human creativity"'));
    console.log(chalk.gray('    /memories identity'));
}
program.parse();
//# sourceMappingURL=index.js.map