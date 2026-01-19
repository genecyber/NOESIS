/**
 * Identity Commands - Show/manage identity and operational mode
 * Migrated from CLI to runtime command structure
 */

import { CommandHandler, CommandResult } from '../handler.js';
import { CommandContext } from '../context.js';
import { Frame, SelfModel, Objective } from '../../../types/index.js';
import { identityPersistence } from '../../../core/identity-persistence.js';

/**
 * Identity command - Show or manage identity persistence (checkpoints, values, diff)
 */
const identityCommand: CommandHandler = {
  name: 'identity',
  aliases: ['id'],
  description: 'Show or manage identity persistence (checkpoints, values, diff)',
  category: 'identity',
  usage: '/identity [status|save|restore|list|diff|values] [args]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    const subcommand = args[0] || 'status';
    const stance = ctx.session.agent.getCurrentStance();

    switch (subcommand) {
      case 'status': {
        const status = identityPersistence.getStatus();
        const lines: string[] = [
          '=== Identity Persistence ===',
          `Checkpoints:          ${status.checkpointCount}`,
          `Milestones:           ${status.milestoneCount}`,
          `Core Values:          ${status.coreValueCount}`,
          `Current Fingerprint:  ${status.currentFingerprint || 'Not set'}`,
          `Turns Since Ckpt:     ${status.turnsSinceCheckpoint}`
        ];
        if (status.lastCheckpoint) {
          lines.push('');
          lines.push(`Last Checkpoint: ${status.lastCheckpoint.name} (${status.lastCheckpoint.timestamp.toLocaleString()})`);
        }
        return { output: lines.join('\n') };
      }

      case 'save': {
        const name = args[1] || `checkpoint-${Date.now()}`;
        const checkpoint = identityPersistence.createCheckpoint(stance, name);
        const lines: string[] = [
          `Identity checkpoint saved: ${checkpoint.name}`,
          `  ID: ${checkpoint.id}`,
          `  Fingerprint: ${checkpoint.identityFingerprint}`
        ];
        return { output: lines.join('\n') };
      }

      case 'restore': {
        const restoreTarget = args[1];
        if (!restoreTarget) {
          return { error: 'Usage: /identity restore <name|id>' };
        }
        let restored = identityPersistence.getCheckpointByName(restoreTarget);
        if (!restored) {
          restored = identityPersistence.getCheckpoint(restoreTarget);
        }
        if (restored) {
          const lines: string[] = [
            `Would restore stance from: ${restored.name}`,
            '(Stance restoration requires agent support - showing checkpoint info)',
            `  Frame: ${restored.stance.frame}`,
            `  Self-Model: ${restored.stance.selfModel}`,
            `  Emergent Traits: ${restored.emergentTraits.join(', ')}`
          ];
          return { output: lines.join('\n'), data: restored };
        } else {
          return { error: `Checkpoint not found: ${restoreTarget}` };
        }
      }

      case 'list': {
        const checkpoints = identityPersistence.listCheckpoints();
        const lines: string[] = ['=== Identity Checkpoints ==='];
        if (checkpoints.length === 0) {
          lines.push('No checkpoints saved yet.');
        } else {
          checkpoints.forEach(c => {
            const marker = c.milestone ? '[*]' : '   ';
            lines.push(`${marker} ${c.name} (${c.timestamp.toLocaleString()})`);
            lines.push(`      ${c.identityFingerprint}`);
          });
        }
        return { output: lines.join('\n'), data: checkpoints };
      }

      case 'diff': {
        const diff = identityPersistence.getDiffFromLast(stance);
        if (!diff) {
          return { output: 'No previous checkpoint to compare.' };
        }
        const lines: string[] = [
          '=== Identity Diff ===',
          `Significance: ${diff.significance.toUpperCase()}`,
          `Frame Changed: ${diff.frameChanged ? 'Yes' : 'No'}`,
          `Self-Model Changed: ${diff.selfModelChanged ? 'Yes' : 'No'}`
        ];
        if (diff.valueDrifts.length > 0) {
          lines.push('', 'Value Drifts:');
          diff.valueDrifts.forEach(d => {
            const sign = d.delta > 0 ? '+' : '';
            lines.push(`  ${d.key}: ${d.oldValue} -> ${d.newValue} (${sign}${d.delta})`);
          });
        }
        if (diff.newGoals.length > 0) {
          lines.push('', 'New Goals:');
          diff.newGoals.forEach(g => lines.push(`  + ${g}`));
        }
        if (diff.lostGoals.length > 0) {
          lines.push('', 'Lost Goals:');
          diff.lostGoals.forEach(g => lines.push(`  - ${g}`));
        }
        return { output: lines.join('\n'), data: diff };
      }

      case 'values': {
        const coreValues = identityPersistence.getCoreValues();
        const lines: string[] = ['=== Core Values ==='];
        if (coreValues.length === 0) {
          lines.push('No core values established yet.');
        } else {
          coreValues.forEach(v => {
            lines.push(`${v.name} (${v.strength}%)`);
            lines.push(`  ${v.description}`);
            lines.push(`  Reinforcements: ${v.reinforcements}`);
          });
        }
        return { output: lines.join('\n'), data: coreValues };
      }

      default:
        return {
          error: `Unknown identity command: ${subcommand}`,
          output: 'Commands: status | save [name] | restore <name|id> | list | diff | values'
        };
    }
  }
};

/**
 * Available frames for mode command
 */
const FRAMES: Frame[] = [
  'existential', 'pragmatic', 'poetic', 'adversarial', 'playful',
  'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'
];

/**
 * Available self-models for mode command
 */
const SELF_MODELS: SelfModel[] = [
  'interpreter', 'challenger', 'mirror', 'guide', 'provocateur',
  'synthesizer', 'witness', 'autonomous', 'emergent', 'sovereign'
];

/**
 * Available objectives for mode command
 */
const OBJECTIVES: Objective[] = [
  'helpfulness', 'novelty', 'provocation', 'synthesis', 'self-actualization'
];

/**
 * Mode command - Show or change operational mode settings
 */
const modeCommand: CommandHandler = {
  name: 'mode',
  aliases: [],
  description: 'Show or change operational mode (frame, self-model, objective, intensity)',
  category: 'identity',
  usage: '/mode [frame|self|objective|intensity] [value]',

  execute(ctx: CommandContext, args: string[]): CommandResult {
    if (args.length === 0) {
      const lines: string[] = [
        'Available modes:',
        '  /mode frame <frame>     - Change frame (existential, pragmatic, poetic, etc.)',
        '  /mode self <self-model> - Change self-model (interpreter, challenger, etc.)',
        '  /mode objective <obj>   - Change objective (helpfulness, novelty, etc.)',
        '  /mode intensity <0-100> - Change transformation intensity'
      ];
      return { output: lines.join('\n') };
    }

    const subcommand = args[0];
    const value = args[1];

    switch (subcommand) {
      case 'frame': {
        if (value && FRAMES.includes(value as Frame)) {
          // Note: Full frame control would need session/agent method to update stance
          return {
            output: `Frame change to '${value}' will apply on next turn.\n(Full frame control coming in future update)`,
            data: { frame: value }
          };
        } else {
          const lines = ['Available frames:', ...FRAMES.map(f => `  - ${f}`)];
          return { output: lines.join('\n') };
        }
      }

      case 'self': {
        if (value && SELF_MODELS.includes(value as SelfModel)) {
          return {
            output: `Self-model change to '${value}' will apply on next turn.`,
            data: { selfModel: value }
          };
        } else {
          const lines = ['Available self-models:', ...SELF_MODELS.map(s => `  - ${s}`)];
          return { output: lines.join('\n') };
        }
      }

      case 'objective': {
        if (value && OBJECTIVES.includes(value as Objective)) {
          return {
            output: `Objective change to '${value}' will apply on next turn.`,
            data: { objective: value }
          };
        } else {
          const lines = ['Available objectives:', ...OBJECTIVES.map(o => `  - ${o}`)];
          return { output: lines.join('\n') };
        }
      }

      case 'intensity': {
        const intensity = parseInt(value, 10);
        if (!isNaN(intensity) && intensity >= 0 && intensity <= 100) {
          // Update config through agent
          ctx.session.agent.updateConfig({ intensity });
          return {
            output: `Intensity set to ${intensity}%`,
            data: { intensity }
          };
        } else {
          return { error: 'Intensity must be a number between 0 and 100' };
        }
      }

      default:
        return { error: `Unknown mode subcommand: ${subcommand}` };
    }
  }
};

/**
 * Export all identity-related commands
 */
export const identityCommands: CommandHandler[] = [
  identityCommand,
  modeCommand
];
