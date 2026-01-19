/**
 * Command Registry - Central registry for all slash commands
 * Enables agent-invocable and hook-triggered command execution
 * Supports both regex and semantic (embedding-based) trigger detection
 */

import type { MetamorphAgent } from '../agent/index.js';
import type { Stance, ModeConfig } from '../types/index.js';
import type { SemanticTriggerDetector } from '../embeddings/semantic-triggers.js';
import type { EmbeddingService } from '../embeddings/service.js';

// ============================================================================
// Types
// ============================================================================

export type TriggerType =
  | 'memory_query'
  | 'identity_question'
  | 'evolution_check'
  | 'strategy_inquiry'
  | 'coherence_warning'
  | 'sentiment_shift'
  | 'transformation_query'
  | 'similarity_search';

export interface TriggerCondition {
  type: TriggerType;
  patterns: RegExp[];
  stanceConditions?: StanceCondition[];
  confidence: number; // 0-1 threshold for triggering
}

export interface SemanticTrigger {
  type: TriggerType;
  intents: string[];  // Example phrases representing this intent
  threshold: number;  // Cosine similarity threshold (0-1)
  stanceConditions?: StanceCondition[];
}

export interface StanceCondition {
  field: keyof Stance | string;
  operator: 'lt' | 'gt' | 'eq' | 'contains';
  value: number | string | boolean;
}

export interface CommandResult {
  output: string;
  data?: unknown;
  shouldInjectIntoResponse: boolean;
  command: string;
  args: string[];
}

export interface CommandContext {
  agent: MetamorphAgent;
  stance: Stance;
  config: ModeConfig;
  message?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  triggers: TriggerCondition[];           // Regex-based triggers (fallback)
  semanticTriggers?: SemanticTrigger[];   // Semantic/embedding-based triggers (preferred)
  execute: (context: CommandContext, args: string[]) => CommandResult;
  agentInvocable: boolean;
  hookTriggerable: boolean;
}

export interface DetectedTrigger {
  command: string;
  trigger: TriggerCondition;
  confidence: number;
  matchedPattern?: string;
  semantic?: boolean;  // True if detected via semantic matching
}

// ============================================================================
// Command Registry
// ============================================================================

class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private semanticDetector: SemanticTriggerDetector | null = null;
  private semanticInitialized = false;

  /**
   * Register a command
   */
  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);

    // Register aliases
    for (const alias of command.aliases) {
      this.aliasMap.set(alias, command.name);
    }
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): CommandDefinition | undefined {
    const name = this.aliasMap.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(name);
  }

  /**
   * List all registered commands
   */
  list(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * List agent-invocable commands
   */
  listAgentInvocable(): CommandDefinition[] {
    return this.list().filter(cmd => cmd.agentInvocable);
  }

  /**
   * List hook-triggerable commands
   */
  listHookTriggerable(): CommandDefinition[] {
    return this.list().filter(cmd => cmd.hookTriggerable);
  }

  /**
   * List commands with semantic triggers
   */
  listWithSemanticTriggers(): CommandDefinition[] {
    return this.list().filter(cmd => cmd.semanticTriggers && cmd.semanticTriggers.length > 0);
  }

  /**
   * Initialize semantic trigger detection
   */
  async initializeSemanticTriggers(embeddingService: EmbeddingService): Promise<void> {
    if (this.semanticInitialized) return;

    const { SemanticTriggerDetector } = await import('../embeddings/semantic-triggers.js');
    this.semanticDetector = new SemanticTriggerDetector(embeddingService);

    // Collect commands with semantic triggers
    const commandsWithSemantic = this.listWithSemanticTriggers().map(cmd => ({
      name: cmd.name,
      semanticTriggers: cmd.semanticTriggers,
    }));

    if (commandsWithSemantic.length > 0) {
      await this.semanticDetector.initialize(commandsWithSemantic);
      this.semanticInitialized = true;
    }
  }

  /**
   * Check if semantic triggers are initialized
   */
  isSemanticInitialized(): boolean {
    return this.semanticInitialized;
  }

  /**
   * Execute a command
   */
  execute(nameOrAlias: string, context: CommandContext, args: string[] = []): CommandResult | null {
    const command = this.get(nameOrAlias);
    if (!command) {
      return null;
    }
    return command.execute(context, args);
  }

  /**
   * Detect which commands should be triggered based on message and stance
   * Tries semantic detection first, falls back to regex
   */
  async detectTriggersAsync(
    message: string,
    stance: Stance,
    config: ModeConfig,
    maxTriggers: number = 2
  ): Promise<DetectedTrigger[]> {
    if (!config.enableAutoCommands) {
      return [];
    }

    // Try semantic detection first if available
    if (this.semanticDetector && this.semanticInitialized) {
      try {
        const semanticTriggers = await this.semanticDetector.detectTriggers(
          message,
          stance,
          config,
          maxTriggers
        );

        if (semanticTriggers.length > 0) {
          // Mark as semantic matches
          return semanticTriggers.map(t => ({ ...t, semantic: true }));
        }
      } catch (error) {
        console.warn('Semantic trigger detection failed, falling back to regex:', error);
      }
    }

    // Fall back to regex detection
    return this.detectTriggersRegex(message, stance, config, maxTriggers);
  }

  /**
   * Synchronous regex-based trigger detection (original method, kept for backward compatibility)
   */
  detectTriggers(
    message: string,
    stance: Stance,
    config: ModeConfig,
    maxTriggers: number = 2
  ): DetectedTrigger[] {
    return this.detectTriggersRegex(message, stance, config, maxTriggers);
  }

  /**
   * Regex-based trigger detection
   */
  private detectTriggersRegex(
    message: string,
    stance: Stance,
    config: ModeConfig,
    maxTriggers: number = 2
  ): DetectedTrigger[] {
    if (!config.enableAutoCommands) {
      return [];
    }

    const detected: DetectedTrigger[] = [];
    const threshold = config.autoCommandThreshold || 0.6;
    const whitelist = config.autoCommandWhitelist || [];
    const blacklist = config.autoCommandBlacklist || [];

    for (const command of this.listHookTriggerable()) {
      // Check whitelist/blacklist
      if (whitelist.length > 0 && !whitelist.includes(command.name)) {
        continue;
      }
      if (blacklist.includes(command.name)) {
        continue;
      }

      for (const trigger of command.triggers) {
        // Check pattern matches
        for (const pattern of trigger.patterns) {
          if (pattern.test(message)) {
            const confidence = trigger.confidence;

            if (confidence >= threshold) {
              // Check stance conditions if any
              let stanceMatch = true;
              if (trigger.stanceConditions) {
                stanceMatch = this.checkStanceConditions(stance, trigger.stanceConditions);
              }

              if (stanceMatch) {
                detected.push({
                  command: command.name,
                  trigger,
                  confidence,
                  matchedPattern: pattern.source,
                  semantic: false
                });
                break; // Only one trigger per command
              }
            }
          }
        }
      }
    }

    // Sort by confidence and limit
    return detected
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTriggers);
  }

  /**
   * Check if stance matches conditions
   */
  private checkStanceConditions(stance: Stance, conditions: StanceCondition[]): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(stance, condition.field);

      switch (condition.operator) {
        case 'lt':
          if (typeof value !== 'number' || value >= (condition.value as number)) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (condition.value as number)) return false;
          break;
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'contains':
          if (Array.isArray(value)) {
            if (!value.includes(condition.value as string)) return false;
          } else if (typeof value === 'string') {
            if (!value.includes(condition.value as string)) return false;
          } else {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format command results for injection into system prompt
 */
export function formatCommandResultsForContext(results: CommandResult[]): string {
  if (results.length === 0) return '';

  const sections = results.map(result => {
    return `[/${result.command}${result.args.length > 0 ? ' ' + result.args.join(' ') : ''}]\n${result.output}`;
  });

  return sections.join('\n\n');
}

/**
 * Format auto-invoked commands for transparency
 */
export function formatAutoInvokedNotice(triggers: DetectedTrigger[]): string {
  if (triggers.length === 0) return '';

  const names = triggers.map(t => `/${t.command}`).join(', ');
  return `[Auto-invoked: ${names}]`;
}
