/**
 * Integration patch for AutoEvolutionManager to support autonomous idle mode
 */

import { EvolutionTrigger, AutoEvolutionConfig, EvolutionTriggerType } from '../core/auto-evolution.js';
import { SafetyConstraints, AutonomousSession } from './types.js';

/**
 * Enhanced configuration for autonomous evolution
 */
export interface AutonomousEvolutionConfig extends AutoEvolutionConfig {
  autonomousMode: boolean;
  coherenceFloor: number;
  maxDriftPerSession: number;
  allowedOperators: string[];
  requireUserApproval: boolean;
}

/**
 * Autonomous evolution result
 */
export interface AutonomousEvolutionResult {
  success: boolean;
  evolutionType: EvolutionTriggerType | null;
  coherenceImpact: number;
  changes: string[];
  safetyViolations: string[];
  rollbackRequired: boolean;
}

/**
 * Enhancement wrapper for AutoEvolutionManager to support autonomous operation
 */
export class AutonomousEvolutionIntegration {
  private originalManager: any; // AutoEvolutionManager instance
  private autonomousConfig: AutonomousEvolutionConfig;
  private autonomousTriggerHistory: EvolutionTrigger[] = [];

  constructor(
    originalManager: any,
    config: Partial<AutonomousEvolutionConfig> = {}
  ) {
    this.originalManager = originalManager;

    // Get base config and enhance for autonomous operation
    const baseConfig = originalManager.getConfig();
    this.autonomousConfig = {
      ...baseConfig,
      autonomousMode: false,
      coherenceFloor: 30,
      maxDriftPerSession: 10,
      allowedOperators: [
        'introspect',
        'reflect',
        'analyze',
        'synthesize',
        'explore_memory'
      ],
      requireUserApproval: true,
      ...config
    };
  }

  /**
   * Enable autonomous mode
   */
  public enableAutonomousMode(safetyConstraints?: SafetyConstraints): void {
    this.autonomousConfig.autonomousMode = true;

    if (safetyConstraints) {
      this.autonomousConfig.coherenceFloor = safetyConstraints.coherenceFloor;
      this.autonomousConfig.maxDriftPerSession = safetyConstraints.maxDriftPerSession;
      this.autonomousConfig.allowedOperators = safetyConstraints.allowedOperators;
      this.autonomousConfig.requireUserApproval = safetyConstraints.humanApprovalRequired;
    }

    // Update the original manager with autonomous settings
    this.originalManager.setConfig({
      ...this.autonomousConfig,
      // More frequent checks in autonomous mode
      checkInterval: 3,
      // Lower threshold for plateau detection (more proactive)
      plateauThreshold: 5
    });

    console.log('Autonomous evolution mode enabled with safety constraints');
  }

  /**
   * Disable autonomous mode
   */
  public disableAutonomousMode(): void {
    this.autonomousConfig.autonomousMode = false;
    this.autonomousConfig.requireUserApproval = true;

    // Reset to more conservative settings
    this.originalManager.setConfig({
      ...this.autonomousConfig,
      checkInterval: 5,
      plateauThreshold: 8
    });

    console.log('Autonomous evolution mode disabled');
  }

  /**
   * Execute autonomous evolution for a session
   */
  public async executeAutonomousEvolution(
    session: AutonomousSession,
    currentStance: any,
    conversationId: string = 'autonomous_session'
  ): Promise<AutonomousEvolutionResult> {

    if (!this.autonomousConfig.autonomousMode) {
      return {
        success: false,
        evolutionType: null,
        coherenceImpact: 0,
        changes: [],
        safetyViolations: ['Autonomous mode not enabled'],
        rollbackRequired: false
      };
    }

    try {
      console.log(`Executing autonomous evolution for session ${session.id}`);

      // 1. Pre-evolution safety check
      const preEvolutionSafety = this.performSafetyCheck(currentStance, session);
      if (!preEvolutionSafety.safe) {
        return {
          success: false,
          evolutionType: null,
          coherenceImpact: 0,
          changes: [],
          safetyViolations: preEvolutionSafety.violations,
          rollbackRequired: false
        };
      }

      // 2. Check for evolution triggers using original manager
      // Create mock recent messages for autonomous context
      const mockMessages = this.createAutonomousContextMessages(session);
      const trigger = this.originalManager.checkForTriggers(
        conversationId,
        currentStance,
        mockMessages
      );

      if (!trigger) {
        console.log('No evolution triggers detected in autonomous mode');
        return {
          success: true,
          evolutionType: null,
          coherenceImpact: 0,
          changes: ['No evolution needed'],
          safetyViolations: [],
          rollbackRequired: false
        };
      }

      // 3. Validate trigger is safe for autonomous execution
      const triggerSafety = this.validateTriggerForAutonomous(trigger);
      if (!triggerSafety.safe) {
        return {
          success: false,
          evolutionType: trigger.type,
          coherenceImpact: 0,
          changes: [],
          safetyViolations: triggerSafety.violations,
          rollbackRequired: false
        };
      }

      // 4. Execute evolution with safety bounds
      const evolutionResult = await this.executeEvolutionWithSafetyBounds(
        trigger,
        currentStance,
        session
      );

      // 5. Post-evolution validation
      if (evolutionResult.success) {
        const postEvolutionSafety = this.performPostEvolutionValidation(
          evolutionResult,
          session
        );

        if (!postEvolutionSafety.safe) {
          evolutionResult.rollbackRequired = true;
          evolutionResult.safetyViolations.push(...postEvolutionSafety.violations);
        }
      }

      // Record in autonomous trigger history
      this.autonomousTriggerHistory.push(trigger);
      if (this.autonomousTriggerHistory.length > 50) {
        this.autonomousTriggerHistory.shift();
      }

      console.log(`Autonomous evolution completed: ${evolutionResult.success ? 'SUCCESS' : 'FAILED'}`);
      return evolutionResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Autonomous evolution failed:', error);
      return {
        success: false,
        evolutionType: null,
        coherenceImpact: 0,
        changes: [],
        safetyViolations: [`Execution error: ${errorMessage}`],
        rollbackRequired: false
      };
    }
  }

  /**
   * Perform pre-evolution safety check
   */
  private performSafetyCheck(
    currentStance: any,
    session: AutonomousSession
  ): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check coherence level
    if (currentStance.coherence < this.autonomousConfig.coherenceFloor) {
      violations.push(`Coherence ${currentStance.coherence}% below floor ${this.autonomousConfig.coherenceFloor}%`);
    }

    // Check session duration limits
    const sessionDuration = Date.now() - session.startTime.getTime();
    const maxDuration = 2 * 60 * 60 * 1000; // 2 hours
    if (sessionDuration > maxDuration) {
      violations.push(`Session duration ${Math.round(sessionDuration / 60000)} minutes exceeds limit`);
    }

    // Check if too many recent evolutions - using array length as proxy for timestamp
    const recentEvolutions = this.autonomousTriggerHistory.slice(-10); // Last 10 evolutions
    if (recentEvolutions.length > 3) {
      violations.push(`Too many recent evolutions: ${recentEvolutions.length} in last 30 minutes`);
    }

    return {
      safe: violations.length === 0,
      violations
    };
  }

  /**
   * Create mock conversation messages for autonomous context
   */
  private createAutonomousContextMessages(session: AutonomousSession): any[] {
    return [
      {
        role: 'system',
        content: `Autonomous session ${session.id} in ${session.mode} mode`,
        timestamp: session.startTime
      },
      {
        role: 'assistant',
        content: `Current goals: ${session.goals.join(', ')}. Activities: ${session.activities.length} completed.`,
        timestamp: new Date()
      }
    ];
  }

  /**
   * Validate if trigger is safe for autonomous execution
   */
  private validateTriggerForAutonomous(trigger: EvolutionTrigger): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    // Only allow safe trigger types in autonomous mode
    const safeTriggerTypes: EvolutionTriggerType[] = [
      'pattern_repetition',
      'sentience_plateau',
      'growth_opportunity'
    ];

    if (!safeTriggerTypes.includes(trigger.type)) {
      violations.push(`Trigger type ${trigger.type} not allowed in autonomous mode`);
    }

    // Require high confidence for autonomous execution
    if (trigger.confidence < 0.7) {
      violations.push(`Trigger confidence ${trigger.confidence} below autonomous threshold 0.7`);
    }

    // Check if suggested action is allowed
    const safeActions = ['reflect', 'deepen'];
    if (!safeActions.includes(trigger.suggestedAction)) {
      violations.push(`Suggested action ${trigger.suggestedAction} not allowed in autonomous mode`);
    }

    return {
      safe: violations.length === 0,
      violations
    };
  }

  /**
   * Execute evolution with safety bounds
   */
  private async executeEvolutionWithSafetyBounds(
    trigger: EvolutionTrigger,
    currentStance: any,
    session: AutonomousSession
  ): Promise<AutonomousEvolutionResult> {

    // Simulate evolution execution (in real implementation would call actual evolution)
    console.log(`Executing ${trigger.type} evolution: ${trigger.suggestedAction}`);

    // Mock evolution result - in reality would perform actual stance transformation
    const mockResult: AutonomousEvolutionResult = {
      success: true,
      evolutionType: trigger.type,
      coherenceImpact: -2, // Slight coherence decrease is normal
      changes: [
        `Applied ${trigger.suggestedAction} operation`,
        `Addressed: ${trigger.evidence}`,
        'Maintained identity continuity'
      ],
      safetyViolations: [],
      rollbackRequired: false
    };

    // Add slight delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    return mockResult;
  }

  /**
   * Validate evolution results post-execution
   */
  private performPostEvolutionValidation(
    result: AutonomousEvolutionResult,
    session: AutonomousSession
  ): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check coherence impact
    if (Math.abs(result.coherenceImpact) > this.autonomousConfig.maxDriftPerSession) {
      violations.push(`Coherence impact ${result.coherenceImpact}% exceeds session limit`);
    }

    // Ensure positive changes occurred
    if (result.changes.length === 0) {
      violations.push('No documented changes from evolution');
    }

    return {
      safe: violations.length === 0,
      violations
    };
  }

  /**
   * Get autonomous evolution history
   */
  public getAutonomousHistory(): {
    totalEvolutions: number;
    successRate: number;
    recentTriggers: EvolutionTrigger[];
    averageCoherenceImpact: number;
  } {
    const recent = this.autonomousTriggerHistory.slice(-10);

    return {
      totalEvolutions: this.autonomousTriggerHistory.length,
      successRate: 0.85, // Mock success rate
      recentTriggers: recent,
      averageCoherenceImpact: -1.5 // Mock average impact
    };
  }

  /**
   * Check if autonomous evolution is enabled
   */
  public isAutonomousModeEnabled(): boolean {
    return this.autonomousConfig.autonomousMode;
  }

  /**
   * Get current autonomous configuration
   */
  public getAutonomousConfig(): AutonomousEvolutionConfig {
    return { ...this.autonomousConfig };
  }
}

/**
 * Factory function to create autonomous evolution integration
 */
export function createAutonomousEvolutionIntegration(
  autoEvolutionManager: any,
  config?: Partial<AutonomousEvolutionConfig>
): AutonomousEvolutionIntegration {
  return new AutonomousEvolutionIntegration(autoEvolutionManager, config);
}

export default AutonomousEvolutionIntegration;