/**
 * Coherence Commands - Runtime command handlers for coherence and context management
 *
 * Migrated from CLI implementations to the new runtime command structure.
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';
import {
  generateCoherenceForecast,
  calculateAvailableBudget,
  OPERATOR_DRIFT_COSTS
} from '../../../core/coherence-planner.js';
import { contextManager } from '../../../core/context-manager.js';
import { coherenceGates } from '../../../streaming/coherence-gates.js';
import { getRegistry } from '../../../operators/base.js';

/**
 * coherence - Show coherence status and forecast
 */
const coherenceCommand: CommandHandler = {
  name: 'coherence',
  aliases: ['coh', 'budget'],
  description: 'Show coherence status, forecast, and operator drift costs',
  category: 'coherence',
  usage: '/coherence [gates|forecast]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const { session, output } = ctx;
    const agent = session.agent;
    const stance = agent.getCurrentStance();
    const config = agent.getConfig();
    const subcommand = args[0] || 'status';

    switch (subcommand) {
      case 'gates':
        return handleCoherenceGates(ctx, args.slice(1));

      case 'forecast':
      case 'status':
      default: {
        const registry = getRegistry();

        // Get all operators for forecast
        const allOperators = registry.getAll().map(op => ({
          name: op.name,
          description: op.description,
          promptInjection: '',
          stanceDelta: {}
        }));

        // Generate forecast with sample operators
        const forecast = generateCoherenceForecast(allOperators.slice(0, 3), stance, config);
        const availableBudget = calculateAvailableBudget(stance, config);

        // Estimated coherence calculation
        const estimatedCoherence = Math.max(0, 100 - (stance.cumulativeDrift / 10));

        output.log('=== Coherence Forecast ===');
        output.log('');
        output.log('Current State:');
        output.log(`  Cumulative Drift:    ${stance.cumulativeDrift}`);
        output.log(`  Turns Since Shift:   ${stance.turnsSinceLastShift}`);
        output.log(`  Coherence Floor:     ${config.coherenceFloor}%`);
        output.log(`  Estimated Coherence: ${estimatedCoherence.toFixed(0)}%`);
        output.log('');
        output.log('Budget:');
        output.log(`  Available:           ${availableBudget.toFixed(1)}`);
        output.log(`  Reserve:             ${config.coherenceReserveBudget || 10}%`);
        output.log(`  Max Drift/Turn:      ${config.maxDriftPerTurn}`);
        output.log('');

        // Risk level
        const riskLabel = forecast.riskLevel.toUpperCase();
        output.log(`Risk Level: ${riskLabel}`);
        output.log(`  Predicted Drift:     ${forecast.predictedDrift}`);
        output.log(`  Would Exceed Budget: ${forecast.willExceed ? 'YES' : 'No'}`);
        output.log('');

        // Operator costs reference
        output.log('Operator Drift Costs (Top 8):');
        const costEntries = Object.entries(OPERATOR_DRIFT_COSTS)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8);

        for (const [op, cost] of costEntries) {
          const bar = '|'.repeat(Math.min(10, Math.round(cost / 2)));
          output.log(`  ${op.padEnd(22)} ${bar.padEnd(10)} (${cost})`);
        }

        // Recommendations
        if (forecast.riskLevel === 'critical' || forecast.riskLevel === 'high') {
          output.log('');
          output.warn('Recommendations:');
          output.log('  - Use lower-drift operators (Reframe, MetaphorSwap)');
          output.log('  - Avoid high-drift operators (PersonaMorph, SentienceDeepen)');
          output.log('  - Consider /strategies coherence_recovery');
        }

        return {
          output: 'Coherence forecast displayed',
          data: {
            forecast,
            availableBudget,
            estimatedCoherence,
            stance: {
              cumulativeDrift: stance.cumulativeDrift,
              turnsSinceLastShift: stance.turnsSinceLastShift
            }
          }
        };
      }
    }
  }
};

/**
 * Handle coherence gates subcommand
 */
function handleCoherenceGates(ctx: CommandContext, args: string[]): CommandResult {
  const { output } = ctx;
  const subcommand = args[0] || 'status';

  switch (subcommand) {
    case 'status': {
      const gateConfig = coherenceGates.getConfig();
      const state = coherenceGates.getState();

      output.log('=== Coherence Gates ===');
      output.log('');
      output.log('Configuration:');
      output.log(`  Enabled:             ${gateConfig.enabled ? 'Yes' : 'No'}`);
      output.log(`  Min Coherence:       ${gateConfig.minCoherence}`);
      output.log(`  Warning Threshold:   ${gateConfig.warningThreshold}`);
      output.log(`  Max Backtracks:      ${gateConfig.maxBacktracks}`);
      output.log(`  Window Size:         ${gateConfig.windowSize}`);
      output.log(`  Local Weight:        ${gateConfig.localWeight}`);
      output.log(`  Global Weight:       ${gateConfig.globalWeight}`);
      output.log('');

      if (state) {
        output.log('Current Stream State:');
        output.log(`  Tokens Processed:    ${state.tokens.length}`);
        output.log(`  Current Score:       ${state.currentScore.toFixed(3)}`);
        output.log(`  Moving Average:      ${state.movingAverage.toFixed(3)}`);
        output.log(`  Warning Count:       ${state.warningCount}`);
        output.log(`  Backtrack Count:     ${state.backtrackCount}`);
        output.log(`  Is Healthy:          ${state.isHealthy ? 'Yes' : 'No'}`);
      } else {
        output.log('No active stream state.');
      }

      return {
        output: 'Coherence gates status displayed',
        data: { config: gateConfig, state }
      };
    }

    case 'on':
    case 'enable':
      coherenceGates.setConfig({ enabled: true });
      output.success('Coherence gates enabled.');
      return { output: 'Coherence gates enabled' };

    case 'off':
    case 'disable':
      coherenceGates.setConfig({ enabled: false });
      output.warn('Coherence gates disabled.');
      return { output: 'Coherence gates disabled' };

    case 'config': {
      const gateConfig = coherenceGates.getConfig();
      output.log('=== Gate Configuration ===');
      output.log(`  Min Coherence:             ${gateConfig.minCoherence}`);
      output.log(`  Warning Threshold:         ${gateConfig.warningThreshold}`);
      output.log(`  Max Backtracks:            ${gateConfig.maxBacktracks}`);
      output.log(`  Window Size:               ${gateConfig.windowSize}`);
      output.log(`  Early Termination:         ${gateConfig.earlyTerminationEnabled ? 'Yes' : 'No'}`);
      output.log(`  Visualization:             ${gateConfig.visualizationEnabled ? 'Yes' : 'No'}`);

      return {
        output: 'Gate configuration displayed',
        data: { config: gateConfig }
      };
    }

    default:
      output.warn(`Unknown gates subcommand: ${subcommand}`);
      output.log('Commands: status | on | off | config');
      return { error: `Unknown subcommand: ${subcommand}` };
  }
}

/**
 * context - Show and manage context window
 */
const contextCommand: CommandHandler = {
  name: 'context',
  aliases: ['ctx'],
  description: 'Show context window status and manage compaction',
  category: 'coherence',
  usage: '/context [status|analyze|compact|config]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const { session, output } = ctx;
    const agent = session.agent;
    const history = agent.getHistory();
    const subcommand = args[0] || 'status';

    switch (subcommand) {
      case 'status': {
        const ctxStatus = contextManager.getContextStatus(history);

        output.log('=== Context Window Status ===');
        output.log('');

        // Usage indicator
        const usageLevel = ctxStatus.usagePercentage < 50 ? 'HEALTHY'
          : ctxStatus.usagePercentage < 80 ? 'FILLING'
          : ctxStatus.usagePercentage < 95 ? 'NEAR FULL'
          : 'CRITICAL';

        output.log(`Usage: ${ctxStatus.usagePercentage.toFixed(1)}% [${usageLevel}]`);
        output.log('');
        output.log('Budget Breakdown:');
        output.log(`  Total Capacity:      ${ctxStatus.budget.totalTokens.toLocaleString()} tokens`);
        output.log(`  System Reserve:      ${ctxStatus.budget.systemReserve.toLocaleString()} tokens`);
        output.log(`  Memory Reserve:      ${ctxStatus.budget.memoryReserve.toLocaleString()} tokens`);
        output.log(`  Conversation:        ${ctxStatus.budget.conversationAllocation.toLocaleString()} tokens`);
        output.log(`  Currently Used:      ${ctxStatus.budget.usedTokens.toLocaleString()} tokens`);
        output.log(`  Available:           ${ctxStatus.budget.availableTokens.toLocaleString()} tokens`);
        output.log('');
        output.log(`Status: ${ctxStatus.recommendation}`);

        if (ctxStatus.needsCompaction) {
          output.warn('Compaction recommended. Run /context compact');
        }

        return {
          output: 'Context status displayed',
          data: ctxStatus
        };
      }

      case 'analyze': {
        const stance = agent.getCurrentStance();
        const scored = contextManager.processConversation(
          agent.getConversationId(),
          history,
          stance
        );

        output.log('=== Message Importance Analysis ===');
        output.log('');

        const byImportance = {
          critical: scored.filter(m => m.importance === 'critical'),
          high: scored.filter(m => m.importance === 'high'),
          medium: scored.filter(m => m.importance === 'medium'),
          low: scored.filter(m => m.importance === 'low'),
          disposable: scored.filter(m => m.importance === 'disposable')
        };

        for (const [level, messages] of Object.entries(byImportance)) {
          output.log(`[${level.toUpperCase()}] ${messages.length} messages`);

          for (const m of messages.slice(0, 3)) {
            const preview = m.message.content.slice(0, 50).replace(/\n/g, ' ');
            output.log(`  Score: ${m.score} | "${preview}..."`);
          }
          if (messages.length > 3) {
            output.log(`  ... and ${messages.length - 3} more`);
          }
          output.log('');
        }

        return {
          output: 'Message analysis displayed',
          data: { scored, byImportance }
        };
      }

      case 'compact': {
        const force = args.includes('--force');

        if (!contextManager.needsCompaction(history) && !force) {
          output.success('Context window healthy - compaction not needed.');
          output.log('Use --force to compact anyway.');
          return { output: 'Compaction not needed' };
        }

        const stance = agent.getCurrentStance();
        const { result } = contextManager.compactConversation(
          agent.getConversationId(),
          history,
          stance
        );

        output.log('=== Compaction Complete ===');
        output.log('');
        output.log(`Original messages:     ${result.originalMessages}`);
        output.log(`Compacted to:          ${result.compactedMessages}`);
        output.log(`Tokens saved:          ${result.tokensSaved.toLocaleString()}`);
        output.log(`Critical preserved:    ${result.preservedCritical}`);

        return {
          output: 'Compaction complete',
          data: result
        };
      }

      case 'config': {
        const config = contextManager.getConfig();

        output.log('=== Context Configuration ===');
        output.log('');
        output.log(`Max Tokens:            ${config.maxTokens.toLocaleString()}`);
        output.log(`Compression Trigger:   ${(config.compressionThreshold * 100).toFixed(0)}% usage`);
        output.log(`Min Preserved Turns:   ${config.minPreservedTurns}`);
        output.log(`System Reserve:        ${(config.systemReserveRatio * 100).toFixed(0)}%`);
        output.log(`Memory Reserve:        ${(config.memoryReserveRatio * 100).toFixed(0)}%`);
        output.log(`Summary Max Length:    ${config.summaryMaxLength} chars`);

        return {
          output: 'Context configuration displayed',
          data: config
        };
      }

      default:
        output.warn(`Unknown context command: ${subcommand}`);
        output.log('Commands: status | analyze | compact [--force] | config');
        return { error: `Unknown subcommand: ${subcommand}` };
    }
  }
};

/**
 * Export all coherence-related commands
 */
export const coherenceCommands: CommandHandler[] = [
  coherenceCommand,
  contextCommand
];
