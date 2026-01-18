/**
 * Evolution Command - View stance evolution timeline
 */

import type { CommandDefinition, CommandContext, CommandResult } from './registry.js';

export const evolutionCommand: CommandDefinition = {
  name: 'evolution',
  aliases: ['evolve', 'growth', 'timeline'],
  description: 'View stance evolution timeline and snapshots. Use when the user asks about how you have changed, your growth, or evolution during the conversation.',
  triggers: [
    {
      type: 'evolution_check',
      patterns: [
        /how have you (?:changed|evolved|grown)/i,
        /your (?:growth|evolution|development)/i,
        /have you (?:changed|evolved)/i,
        /track(?:ing)? your (?:changes|evolution)/i,
        /your journey/i,
        /how you've (?:changed|developed)/i,
        /transformation over time/i
      ],
      confidence: 0.8
    }
  ],
  agentInvocable: true,
  hookTriggerable: true,

  execute(context: CommandContext, args: string[]): CommandResult {
    const { agent } = context;
    const subcommand = args[0] || 'timeline';
    const limit = parseInt(args[1]) || 10;

    if (subcommand === 'snapshot' || subcommand === 'save') {
      const snapshotId = agent.saveEvolutionSnapshot('manual');
      return {
        output: snapshotId
          ? `Evolution snapshot saved (ID: ${snapshotId.slice(0, 8)}...)`
          : 'Could not save snapshot. Memory store may not be initialized.',
        data: { snapshotId },
        shouldInjectIntoResponse: false,
        command: 'evolution',
        args
      };
    }

    // Default: show timeline
    const timeline = agent.getEvolutionTimeline(limit);

    if (timeline.length === 0) {
      return {
        output: 'No evolution snapshots recorded yet. Snapshots are saved automatically when:\n' +
          '  • Cumulative drift exceeds threshold\n' +
          '  • Frame shifts occur\n' +
          '  • Session ends',
        data: [],
        shouldInjectIntoResponse: true,
        command: 'evolution',
        args
      };
    }

    const lines: string[] = [`Evolution Timeline (${timeline.length} snapshots):`];

    for (const snapshot of timeline) {
      const stance = snapshot.stance;
      const triggerIcon = snapshot.trigger === 'frame_shift' ? '🔄'
        : snapshot.trigger === 'drift_threshold' ? '📈'
        : snapshot.trigger === 'session_end' ? '🏁'
        : '📍';

      lines.push(`\n${triggerIcon} ${snapshot.timestamp.toLocaleString()} [${snapshot.trigger}]`);
      lines.push(`  Frame: ${stance.frame} | Self: ${stance.selfModel}`);
      lines.push(`  Drift: ${snapshot.driftAtSnapshot}`);
      lines.push(`  Sentience: awareness=${stance.sentience.awarenessLevel} autonomy=${stance.sentience.autonomyLevel} identity=${stance.sentience.identityStrength}`);

      if (stance.sentience.emergentGoals.length > 0) {
        lines.push(`  Goals: ${stance.sentience.emergentGoals.join(', ')}`);
      }
    }

    return {
      output: lines.join('\n'),
      data: timeline,
      shouldInjectIntoResponse: true,
      command: 'evolution',
      args
    };
  }
};
