/**
 * Autonomous Idle Evolution System - Main Entry Point
 */

export * from './types.js';
export { IdleDetector } from './detector.js';
export { EmergentGoalPromoter } from './goal-promoter.js';
export { AutonomousEvolutionOrchestrator } from './evolution-orchestrator.js';
export { IdleSessionExecutor, createAutonomyConfig } from './session-executor.js';
export type { AutonomyLevel, AutonomyConfig, PromptChunk, ExecutorConfig } from './session-executor.js';

import { IdleDetector } from './detector.js';
import { EmergentGoalPromoter } from './goal-promoter.js';
import { AutonomousEvolutionOrchestrator } from './evolution-orchestrator.js';
import {
  IdleModeConfig,
  IdleDetectorConfig,
  GoalPromotionConfig,
  OrchestrationConfig
} from './types.js';

/**
 * Main Autonomous Idle System class that coordinates all components
 */
export class AutonomousIdleSystem {
  private idleDetector: IdleDetector;
  private goalPromoter: EmergentGoalPromoter;
  private orchestrator: AutonomousEvolutionOrchestrator;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  constructor(
    config: Partial<IdleModeConfig> = {},
    dependencies?: {
      autoEvolutionManager?: any;
      goalPursuitManager?: any;
      memorySystem?: any;
    }
  ) {
    const fullConfig: IdleModeConfig = {
      enabled: true,
      idleThreshold: 30, // 30 minutes
      maxSessionDuration: 120, // 2 hours
      evolutionIntensity: 'moderate',
      safetyLevel: 'high',
      coherenceFloor: 30,
      allowedGoalTypes: ['consciousness_development', 'knowledge_acquisition', 'identity_evolution'],
      researchDomains: ['consciousness', 'AI', 'philosophy', 'cognitive_science'],
      externalPublishing: false,
      subagentCoordination: true,
      ...config
    };

    // Initialize components
    const idleDetectorConfig: IdleDetectorConfig = {
      webSocketMonitoring: true,
      activityTimeout: fullConfig.idleThreshold,
      activityTypes: ['websocket', 'api_call', 'user_input', 'tool_invocation'],
      debugLogging: true
    };

    const goalPromotionConfig: GoalPromotionConfig = {
      memoryImportanceThreshold: fullConfig.safetyLevel === 'high' ? 90 : 80,
      confidenceThreshold: 0.7,
      maxGoalsPerSession: 3,
      promotionCooldown: fullConfig.evolutionIntensity === 'conservative' ? 4 : 2
    };

    const orchestrationConfig: OrchestrationConfig = {
      maxConcurrentSessions: 1,
      sessionTimeouts: {
        exploration: 60,
        research: 90,
        creation: fullConfig.maxSessionDuration,
        optimization: 45
      },
      safetyCheckInterval: 30000,
      progressReportInterval: 300000
    };

    this.idleDetector = new IdleDetector(idleDetectorConfig);
    this.goalPromoter = new EmergentGoalPromoter(
      goalPromotionConfig,
      dependencies?.memorySystem,
      dependencies?.goalPursuitManager
    );
    this.orchestrator = new AutonomousEvolutionOrchestrator(
      orchestrationConfig,
      {
        idleDetector: this.idleDetector,
        goalPromoter: this.goalPromoter,
        autoEvolutionManager: dependencies?.autoEvolutionManager,
        goalPursuitManager: dependencies?.goalPursuitManager
      }
    );

    this.setupEventHandlers();
    this.isInitialized = true;

    console.log('AutonomousIdleSystem initialized');
  }

  /**
   * Start the autonomous idle system
   */
  public start(): void {
    if (!this.isInitialized) {
      throw new Error('System not initialized');
    }

    if (this.isRunning) {
      console.log('AutonomousIdleSystem is already running');
      return;
    }

    console.log('Starting AutonomousIdleSystem...');

    // Start the orchestrator (which will start the idle detector)
    this.orchestrator.start();
    this.isRunning = true;

    console.log('AutonomousIdleSystem started successfully');
  }

  /**
   * Stop the autonomous idle system
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('AutonomousIdleSystem is not running');
      return;
    }

    console.log('Stopping AutonomousIdleSystem...');

    this.orchestrator.stop();
    this.isRunning = false;

    console.log('AutonomousIdleSystem stopped');
  }

  /**
   * Get system status
   */
  public getStatus(): {
    isRunning: boolean;
    isIdle: boolean;
    currentSession: any;
    sessionHistory: any[];
    promotionHistory: any;
  } {
    return {
      isRunning: this.isRunning,
      isIdle: this.idleDetector.isIdle(),
      currentSession: this.orchestrator.getCurrentSession(),
      sessionHistory: this.orchestrator.getSessionHistory(),
      promotionHistory: this.goalPromoter.getPromotionHistory()
    };
  }

  /**
   * Manually trigger goal promotion (for testing)
   */
  public async promoteGoals(): Promise<any[]> {
    return this.goalPromoter.promoteEmergentGoals();
  }

  /**
   * Manually start an autonomous session (for testing)
   */
  public async startSession(mode: 'exploration' | 'research' | 'creation' | 'optimization' = 'exploration'): Promise<any> {
    return this.orchestrator.startAutonomousSession(mode);
  }

  /**
   * Record activity manually (for integration with other systems)
   */
  public recordActivity(type: 'websocket' | 'api_call' | 'user_input' | 'tool_invocation', source: string, metadata?: any): void {
    this.idleDetector.recordActivity({
      type,
      timestamp: new Date(),
      source,
      metadata
    });
  }

  /**
   * Set up event handlers between components
   */
  private setupEventHandlers(): void {
    // Orchestrator events
    this.orchestrator.on('session_started', (data) => {
      console.log(`Autonomous session started: ${data.sessionId} (${data.mode})`);
    });

    this.orchestrator.on('session_ended', (data) => {
      console.log(`Autonomous session ended: ${data.sessionId} (${data.reason})`);
    });

    this.orchestrator.on('progress_report', (report) => {
      console.log('Autonomous session progress:', report);
    });

    // Idle detector events
    this.idleDetector.on('idle_start', (idleState) => {
      console.log(`Idle period started: ${Math.round(idleState.idleDuration / 60000)} minutes`);
    });

    this.idleDetector.on('idle_end', () => {
      console.log('User activity detected - idle period ended');
    });

    // Error handling
    this.orchestrator.on('error', (error) => {
      console.error('Orchestrator error:', error);
    });

    this.idleDetector.on('error', (error) => {
      console.error('Idle detector error:', error);
    });
  }

  /**
   * Clean up all resources
   */
  public destroy(): void {
    console.log('Destroying AutonomousIdleSystem...');

    this.stop();
    this.orchestrator.destroy();
    this.idleDetector.destroy();

    console.log('AutonomousIdleSystem destroyed');
  }
}

/**
 * Create and configure the autonomous idle system
 */
export function createAutonomousIdleSystem(
  config?: Partial<IdleModeConfig>,
  dependencies?: {
    autoEvolutionManager?: any;
    goalPursuitManager?: any;
    memorySystem?: any;
  }
): AutonomousIdleSystem {
  return new AutonomousIdleSystem(config, dependencies);
}

export default AutonomousIdleSystem;