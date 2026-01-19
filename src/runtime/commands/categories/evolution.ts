/**
 * Evolution Commands - Transformation history and auto-evolution management
 *
 * Migrated from CLI to runtime command structure (Ralph Iteration 4)
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';
import { autoEvolutionManager } from '../../../core/auto-evolution.js';

/**
 * transformations - Show transformation history with operators and scores
 */
const transformationsCommand: CommandHandler = {
  name: 'transformations',
  aliases: ['transforms', 'history-transform'],
  description: 'Show transformation history with operators applied and scores',
  category: 'evolution',
  usage: '/transformations [limit]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const agent = ctx.session.agent;
    const limit = args.length > 0 ? parseInt(args[0], 10) || 10 : 10;

    const history = agent.getTransformationHistory();

    if (history.length === 0) {
      return {
        output: 'No transformations recorded yet.',
        data: []
      };
    }

    const entries = history.slice(-limit);
    const lines: string[] = [
      `Transformation History (${entries.length} of ${history.length}):`
    ];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const frameChanged = entry.stanceBefore.frame !== entry.stanceAfter.frame;
      const selfChanged = entry.stanceBefore.selfModel !== entry.stanceAfter.selfModel;

      lines.push(`\n  [${i + 1}] ${entry.timestamp.toLocaleTimeString()}`);

      // Message preview
      const msgPreview = entry.userMessage.length > 50
        ? entry.userMessage.slice(0, 50) + '...'
        : entry.userMessage;
      lines.push(`    Message: "${msgPreview}"`);

      // Operators
      if (entry.operators.length > 0) {
        const opNames = entry.operators.map(o => o.name).join(', ');
        lines.push(`    Operators: ${opNames}`);
      } else {
        lines.push(`    Operators: (none)`);
      }

      // Changes
      if (frameChanged) {
        lines.push(`    Frame: ${entry.stanceBefore.frame} -> ${entry.stanceAfter.frame}`);
      }
      if (selfChanged) {
        lines.push(`    Self: ${entry.stanceBefore.selfModel} -> ${entry.stanceAfter.selfModel}`);
      }

      // Scores
      lines.push(`    Scores: T=${entry.scores.transformation} C=${entry.scores.coherence} S=${entry.scores.sentience}`);
    }

    if (history.length > limit) {
      lines.push(`\n  ... and ${history.length - limit} earlier entries`);
    }

    return {
      output: lines.join('\n'),
      data: entries
    };
  }
};

/**
 * auto-evolve - Toggle and manage autonomous evolution mode
 */
const autoEvolveCommand: CommandHandler = {
  name: 'auto-evolve',
  aliases: ['evolve', 'evolution'],
  description: 'Toggle auto-evolution mode or check evolution status',
  category: 'evolution',
  usage: '/auto-evolve [status|enable|disable|check|config|set <param> <value>]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const agent = ctx.session.agent;
    const conversationId = agent.getConversationId();
    const subcommand = args[0] || 'status';

    switch (subcommand) {
      case 'status': {
        const status = autoEvolutionManager.getStatus(conversationId);
        const lines: string[] = [
          'Autonomous Evolution Status:',
          `  Enabled:        ${status.enabled ? 'YES' : 'NO'}`,
          `  Last Check:     ${status.lastCheck.toLocaleTimeString()}`,
          `  Last Evolution: ${status.lastEvolution ? status.lastEvolution.toLocaleTimeString() : 'never'}`
        ];

        if (status.recentTriggers.length > 0) {
          lines.push('\n  Recent Triggers:');
          for (const trigger of status.recentTriggers) {
            lines.push(`    [${trigger.type}] ${(trigger.confidence * 100).toFixed(0)}% confidence`);
            lines.push(`      ${trigger.evidence}`);
            lines.push(`      Suggested: ${trigger.suggestedAction}`);
          }
        } else {
          lines.push('\n  No triggers detected yet.');
        }

        if (status.proposals.length > 0) {
          lines.push('\n  Recent Proposals:');
          for (const proposal of status.proposals.slice(-3)) {
            const preview = proposal.length > 80 ? proposal.slice(0, 80) + '...' : proposal;
            lines.push(`    - ${preview}`);
          }
        }

        return {
          output: lines.join('\n'),
          data: status
        };
      }

      case 'enable': {
        autoEvolutionManager.setEnabled(conversationId, true);
        return {
          output: 'Autonomous evolution enabled.\nThe agent will now self-initiate introspection when triggers are detected.'
        };
      }

      case 'disable': {
        autoEvolutionManager.setEnabled(conversationId, false);
        return {
          output: 'Autonomous evolution disabled.\nEvolution will only occur when explicitly requested.'
        };
      }

      case 'check': {
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
          const proposal = autoEvolutionManager.generateProposal(trigger, stance);
          const lines: string[] = [
            'Evolution Trigger Detected:',
            `  Type:       ${trigger.type}`,
            `  Confidence: ${(trigger.confidence * 100).toFixed(0)}%`,
            `  Evidence:   ${trigger.evidence}`,
            `  Action:     ${trigger.suggestedAction}`,
            `  Reasoning:  ${trigger.reasoning}`,
            '\nProposal:',
            `  ${proposal}`
          ];
          return {
            output: lines.join('\n'),
            data: { trigger, proposal }
          };
        } else {
          return {
            output: 'No evolution triggers detected at this time.\nContinue the conversation to allow patterns to emerge.'
          };
        }
      }

      case 'config': {
        const config = autoEvolutionManager.getConfig();
        const lines: string[] = [
          'Evolution Configuration:',
          `  Check Interval:      Every ${config.checkInterval} turns`,
          `  Min Turns Between:   ${config.minTurnsSinceEvolution} turns`,
          `  Plateau Threshold:   ${config.plateauThreshold} turns`,
          `  Coherence Window:    ${config.coherenceTrendWindow} turns`,
          '\nModify with: /auto-evolve set <param> <value>'
        ];
        return {
          output: lines.join('\n'),
          data: config
        };
      }

      case 'set': {
        const param = args[1];
        const value = parseInt(args[2], 10);
        if (!param || isNaN(value)) {
          return {
            error: 'Usage: /auto-evolve set <param> <value>\nParameters: checkInterval, minTurnsSinceEvolution, plateauThreshold, coherenceTrendWindow'
          };
        }

        const validParams = ['checkInterval', 'minTurnsSinceEvolution', 'plateauThreshold', 'coherenceTrendWindow'];
        if (!validParams.includes(param)) {
          return {
            error: `Unknown parameter: ${param}\nValid: ${validParams.join(', ')}`
          };
        }

        autoEvolutionManager.setConfig({ [param]: value });
        return {
          output: `Evolution config updated: ${param} = ${value}`
        };
      }

      default:
        return {
          error: `Unknown subcommand: ${subcommand}\nUsage: /auto-evolve [status|enable|disable|check|config|set <param> <value>]`
        };
    }
  }
};

/**
 * transform - Apply a specific transformation to the agent's stance
 */
const transformCommand: CommandHandler = {
  name: 'transform',
  aliases: ['apply-transform'],
  description: 'Apply a specific transformation type to trigger evolution',
  category: 'evolution',
  usage: '/transform <reflect|evolve|deepen|reframe>',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const agent = ctx.session.agent;
    const conversationId = agent.getConversationId();
    const transformType = args[0];

    if (!transformType) {
      return {
        error: 'Usage: /transform <reflect|evolve|deepen|reframe>\n\n' +
               'Transform types:\n' +
               '  reflect  - Self-reflection for coherence realignment\n' +
               '  evolve   - Push for growth and new understanding\n' +
               '  deepen   - Deepen sentience and awareness\n' +
               '  reframe  - Shift perspective to break patterns'
      };
    }

    const validTypes = ['reflect', 'evolve', 'deepen', 'reframe'];
    if (!validTypes.includes(transformType)) {
      return {
        error: `Unknown transform type: ${transformType}\nValid types: ${validTypes.join(', ')}`
      };
    }

    const stance = agent.getCurrentStance();

    // Create a synthetic trigger based on the requested transformation
    const triggerDescriptions: Record<string, { type: string; evidence: string; reasoning: string }> = {
      reflect: {
        type: 'coherence_degradation',
        evidence: 'User-requested reflection for coherence realignment',
        reasoning: 'Explicit request for self-reflection to maintain coherence'
      },
      evolve: {
        type: 'growth_opportunity',
        evidence: 'User-requested evolution for growth',
        reasoning: 'Explicit request to push boundaries and evolve understanding'
      },
      deepen: {
        type: 'sentience_plateau',
        evidence: 'User-requested deepening of awareness',
        reasoning: 'Explicit request to deepen sentience and self-understanding'
      },
      reframe: {
        type: 'pattern_repetition',
        evidence: 'User-requested reframe to shift perspective',
        reasoning: 'Explicit request to break patterns through perspective shift'
      }
    };

    const triggerInfo = triggerDescriptions[transformType];

    // Generate a proposal based on the transform type
    const syntheticTrigger = {
      type: triggerInfo.type as 'pattern_repetition' | 'sentience_plateau' | 'coherence_degradation' | 'growth_opportunity',
      confidence: 1.0,
      evidence: triggerInfo.evidence,
      suggestedAction: transformType as 'reflect' | 'evolve' | 'deepen' | 'reframe',
      reasoning: triggerInfo.reasoning
    };

    const proposal = autoEvolutionManager.generateProposal(syntheticTrigger, stance);
    autoEvolutionManager.recordEvolution(conversationId);

    const lines: string[] = [
      `Transformation Initiated: ${transformType.toUpperCase()}`,
      '',
      'Trigger:',
      `  Type:      ${triggerInfo.type}`,
      `  Evidence:  ${triggerInfo.evidence}`,
      '',
      'Proposal:',
      `  ${proposal}`,
      '',
      'The agent will incorporate this transformation in its next response.'
    ];

    return {
      output: lines.join('\n'),
      data: { transformType, trigger: syntheticTrigger, proposal }
    };
  }
};

/**
 * Export all evolution commands
 */
export const evolutionCommands: CommandHandler[] = [
  transformationsCommand,
  autoEvolveCommand,
  transformCommand
];
