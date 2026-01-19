/**
 * Advanced Commands - Migrated from CLI (Ralph Iteration 3 & 6)
 *
 * Implements advanced cognitive commands:
 * - strategies: Show/manage cognitive strategies
 * - operator-stats: Show operator statistics
 * - branch: Create conversation branch
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';
import { strategyManager, OPERATOR_STRATEGIES } from '../../../core/strategies.js';
import { branchManager } from '../../../conversation/branching.js';

/**
 * Strategies command - Show or manage cognitive strategies
 */
const strategiesCommand: CommandHandler = {
  name: 'strategies',
  aliases: ['strats', 'strategy'],
  description: 'Show or manage cognitive strategies',
  category: 'advanced',
  usage: '/strategies [list|engage <name>|status|cancel]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const subcommand = args[0] || 'list';
    const conversationId = ctx.session.id;

    switch (subcommand) {
      case 'list': {
        const lines: string[] = [];
        lines.push('Operator Strategies (Ralph Iteration 3)');
        lines.push('');

        for (const strategy of OPERATOR_STRATEGIES) {
          lines.push(`${strategy.name}`);
          lines.push(`  ${strategy.description}`);
          lines.push(`  Steps: ${strategy.steps.join(' -> ')}`);
          lines.push(`  Triggers: ${strategy.triggers.join(', ')}`);
          lines.push(`  Min intensity: ${strategy.minIntensity}% | Cooldown: ${strategy.cooldownTurns} turns`);
          lines.push('');
        }

        lines.push('Commands: /strategies list | engage <name> | status | cancel');

        return {
          output: lines.join('\n'),
          data: { strategies: OPERATOR_STRATEGIES }
        };
      }

      case 'engage': {
        const strategyName = args[1];
        if (!strategyName) {
          return {
            output: 'Usage: /strategies engage <strategy-name>\nAvailable: ' +
              OPERATOR_STRATEGIES.map(s => s.name).join(', ')
          };
        }

        const state = strategyManager.startStrategy(conversationId, strategyName);
        if (state) {
          const strategy = OPERATOR_STRATEGIES.find(s => s.name === strategyName);
          return {
            output: `Strategy engaged: ${strategyName}\n` +
              `Steps: ${strategy?.steps.join(' -> ')}\n` +
              'The strategy will unfold over the next few turns.',
            data: { state, strategy }
          };
        } else {
          const inCooldown = strategyManager.isInCooldown(conversationId, strategyName);
          if (inCooldown) {
            return {
              error: `Strategy '${strategyName}' is in cooldown. Try again later.`
            };
          } else if (!OPERATOR_STRATEGIES.find(s => s.name === strategyName)) {
            return {
              error: `Unknown strategy: ${strategyName}`
            };
          } else {
            return {
              error: 'Cannot start strategy (another may be active).'
            };
          }
        }
      }

      case 'status': {
        const progress = strategyManager.getStrategyProgress(conversationId);
        if (progress) {
          const lines: string[] = [];
          lines.push('Active Strategy');
          lines.push(`Strategy: ${progress.name}`);
          lines.push(`Progress: ${progress.current}/${progress.total} steps`);
          if (progress.completedOps.length > 0) {
            lines.push(`Completed: ${progress.completedOps.join(' -> ')}`);
          }
          if (progress.nextOp) {
            lines.push(`Next: ${progress.nextOp}`);
          }
          return {
            output: lines.join('\n'),
            data: { progress }
          };
        } else {
          return {
            output: 'No active strategy.'
          };
        }
      }

      case 'cancel': {
        const activeProgress = strategyManager.getStrategyProgress(conversationId);
        if (activeProgress) {
          strategyManager.cancelStrategy(conversationId);
          return {
            output: `Strategy '${activeProgress.name}' cancelled.`
          };
        } else {
          return {
            output: 'No active strategy to cancel.'
          };
        }
      }

      default:
        return {
          error: `Unknown strategy command: ${subcommand}\n` +
            'Commands: /strategies list | engage <name> | status | cancel'
        };
    }
  }
};

/**
 * Operator Stats command - Show operator performance statistics
 */
const operatorStatsCommand: CommandHandler = {
  name: 'operator-stats',
  aliases: ['ops'],
  description: 'Show operator performance statistics',
  category: 'advanced',
  usage: '/operator-stats [operator-name]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const operatorFilter = args.length > 0 ? args[0] : undefined;
    const agent = ctx.session.agent;

    if (!agent) {
      return { error: 'No agent available in session.' };
    }

    const memoryStore = agent.getMemoryStore();
    const stats = memoryStore.getOperatorStats(operatorFilter);

    if (stats.length === 0) {
      return {
        output: 'Operator Performance (Ralph Iteration 3)\n\n' +
          'No operator performance data recorded yet.\n' +
          'Performance is recorded as you chat and operators are applied.'
      };
    }

    // Group by operator
    const byOperator = new Map<string, typeof stats>();
    for (const stat of stats) {
      if (!byOperator.has(stat.operatorName)) {
        byOperator.set(stat.operatorName, []);
      }
      byOperator.get(stat.operatorName)!.push(stat);
    }

    const lines: string[] = [];
    lines.push('Operator Performance (Ralph Iteration 3)');
    lines.push('');

    for (const [opName, opStats] of byOperator.entries()) {
      const totalUsage = opStats.reduce((sum, s) => sum + s.usageCount, 0);
      const avgEffectiveness = opStats.reduce((sum, s) => sum + s.avgEffectiveness * s.usageCount, 0) / totalUsage;

      lines.push(`${opName}`);
      lines.push(`  Total uses: ${totalUsage}`);
      lines.push(`  Avg effectiveness: ${avgEffectiveness.toFixed(2)}`);
      lines.push('  By trigger type:');

      for (const s of opStats) {
        const effIndicator = s.avgEffectiveness >= 1.5 ? '[HIGH]'
          : s.avgEffectiveness >= 1.0 ? '[MED]'
          : '[LOW]';
        lines.push(`    ${s.triggerType}: ${s.usageCount}x, eff=${s.avgEffectiveness.toFixed(2)} ${effIndicator}, T=${s.avgTransformation.toFixed(0)}, C=${s.avgCoherence.toFixed(0)}`);
      }
      lines.push('');
    }

    lines.push('Filter by operator: /operator-stats <operator-name>');

    return {
      output: lines.join('\n'),
      data: { stats, byOperator: Object.fromEntries(byOperator) }
    };
  }
};

/**
 * Branch command - Manage conversation branches
 */
const branchCommand: CommandHandler = {
  name: 'branch',
  aliases: ['branches'],
  description: 'Create and manage conversation branches',
  category: 'advanced',
  usage: '/branch [list|create <name>|switch <id>|help]',

  execute(_ctx: CommandContext, args: string[]): CommandResult {
    const subcommand = args[0] || 'list';
    const branches = branchManager.listBranches();
    const activeBranch = branchManager.getActiveBranch();

    switch (subcommand) {
      case 'list': {
        if (branches.length === 0) {
          return {
            output: 'Conversation Branches (Ralph Iteration 6)\n\nNo branches yet.'
          };
        }

        const lines: string[] = [];
        lines.push('Conversation Branches (Ralph Iteration 6)');
        lines.push('');

        branches.forEach(b => {
          const current = activeBranch && b.id === activeBranch.id ? ' (current)' : '';
          lines.push(`${b.name}${current} - ${b.messages.length} messages`);
        });

        return {
          output: lines.join('\n'),
          data: { branches, activeBranchId: activeBranch?.id }
        };
      }

      case 'create': {
        const name = args[1];
        if (!name) {
          return {
            error: 'Usage: /branch create <name>'
          };
        }

        const reason = args.slice(2).join(' ') || undefined;
        const newBranch = branchManager.branchNow(name, reason);

        if (newBranch) {
          return {
            output: `Created branch '${name}' from current position.`,
            data: { branch: newBranch }
          };
        } else {
          return {
            error: 'Failed to create branch. Is there an active branch?'
          };
        }
      }

      case 'switch': {
        const branchId = args[1];
        if (!branchId) {
          return {
            error: 'Usage: /branch switch <branch-id or name>'
          };
        }

        // Try to find by ID or name
        const targetBranch = branches.find(b => b.id === branchId || b.name === branchId);
        if (!targetBranch) {
          return {
            error: `Branch not found: ${branchId}`
          };
        }

        const switched = branchManager.switchBranch(targetBranch.id);
        if (switched) {
          return {
            output: `Switched to branch '${switched.name}'`,
            data: { branch: switched }
          };
        } else {
          return {
            error: 'Failed to switch branch.'
          };
        }
      }

      case 'help':
      default:
        return {
          output: 'Branching Commands:\n' +
            '  /branch list        - List all branches\n' +
            '  /branch create <name> [reason] - Create branch from current point\n' +
            '  /branch switch <id|name>       - Switch to a branch\n' +
            '\nAPI: branchManager.branchAt(), switchBranch(), timeTravelTo(), mergeBranches()'
        };
    }
  }
};

/**
 * Export all advanced commands
 */
export const advancedCommands: CommandHandler[] = [
  strategiesCommand,
  operatorStatsCommand,
  branchCommand
];
