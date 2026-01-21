/**
 * Adaptive Autonomous Idle System - Learns and grows differently each time
 */

import { AutonomousIdleSystem } from './index.js';
import {
  DynamicMemoryAnalyzer,
  DynamicEvolutionTracker,
  DynamicConfigurationManager
} from './dynamic-integration.js';
import { IdleModeConfig } from './types.js';

/**
 * Adaptive version that grows differently based on actual usage patterns
 */
export class AdaptiveAutonomousIdleSystem extends AutonomousIdleSystem {
  private memoryAnalyzer: DynamicMemoryAnalyzer;
  private evolutionTracker: DynamicEvolutionTracker;
  private configManager: DynamicConfigurationManager;
  private learningHistory: any[] = [];
  private adaptationCycle: number = 0;

  constructor(
    initialConfig: Partial<IdleModeConfig> = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private mcpTools: any // Real MCP tools, not mocks
  ) {
    // Start with base config but it will adapt
    super(initialConfig);

    this.memoryAnalyzer = new DynamicMemoryAnalyzer(mcpTools);
    this.evolutionTracker = new DynamicEvolutionTracker(mcpTools);
    this.configManager = new DynamicConfigurationManager(this.getCurrentConfig());
  }

  /**
   * Override start to include learning and adaptation
   */
  public async start(): Promise<void> {
    console.log('Starting adaptive autonomous idle system...');

    // First, learn from current state
    await this.performInitialLearning();

    // Then start the base system
    super.start();

    // Set up adaptive learning cycles
    this.startAdaptiveLearningCycle();
  }

  /**
   * Learn from actual current state before starting
   */
  private async performInitialLearning(): Promise<void> {
    console.log('Performing initial learning from current state...');

    try {
      // Analyze actual memories to discover patterns
      const emergentGoals = await this.memoryAnalyzer.discoverEmergentGoalPatterns();
      console.log(`Discovered ${emergentGoals.length} emergent goal patterns from actual memories`);

      // Track actual evolution state
      const evolutionState = await this.evolutionTracker.trackRealEvolution();
      console.log('Current evolution state analyzed');

      // Store initial learning
      this.learningHistory.push({
        cycle: 0,
        timestamp: new Date(),
        emergentGoalsFound: emergentGoals.length,
        categories: this.memoryAnalyzer.getEmergentCategories(),
        evolutionPattern: evolutionState.evolutionPattern,
        coherenceBaseline: evolutionState.adaptiveBaselines.coherence
      });

    } catch (error) {
      console.warn('Initial learning failed, proceeding with base configuration:', error);
    }
  }

  /**
   * Start adaptive learning cycles that run in background
   */
  private startAdaptiveLearningCycle(): void {
    // Learn and adapt every 2 hours
    setInterval(async () => {
      await this.performAdaptationCycle();
    }, 2 * 60 * 60 * 1000);

    console.log('Adaptive learning cycles started');
  }

  /**
   * Perform adaptation cycle - system learns and evolves its behavior
   */
  private async performAdaptationCycle(): Promise<void> {
    this.adaptationCycle++;
    console.log(`Starting adaptation cycle ${this.adaptationCycle}...`);

    try {
      // Gather current performance data
      const sessionHistory = this.getStatus().sessionHistory || [];
      // Note: currentStatus not used but available if needed in future

      // Analyze what's working and what isn't
      const performanceAnalysis = this.analyzePerformance(sessionHistory);

      // Discover new emergent patterns
      const newGoalPatterns = await this.memoryAnalyzer.discoverEmergentGoalPatterns();

      // Track evolution changes
      const evolutionUpdate = await this.evolutionTracker.trackRealEvolution();

      // Adapt configuration based on learning
      const adaptedConfig = this.configManager.adaptConfiguration(
        sessionHistory,
        { performance: performanceAnalysis, evolution: evolutionUpdate }
      );

      // Apply adapted configuration
      this.updateConfiguration(adaptedConfig);

      // Record this adaptation cycle
      this.learningHistory.push({
        cycle: this.adaptationCycle,
        timestamp: new Date(),
        emergentGoalsFound: newGoalPatterns.length,
        categories: this.memoryAnalyzer.getEmergentCategories(),
        evolutionPattern: evolutionUpdate.evolutionPattern,
        configChanges: this.identifyConfigChanges(adaptedConfig),
        performanceMetrics: performanceAnalysis
      });

      console.log(`Adaptation cycle ${this.adaptationCycle} completed`);
      console.log(`New categories discovered: ${this.memoryAnalyzer.getEmergentCategories().join(', ')}`);

    } catch (error) {
      console.error(`Adaptation cycle ${this.adaptationCycle} failed:`, error);
    }
  }

  /**
   * Analyze performance to guide adaptation
   */
  private analyzePerformance(sessionHistory: any[]): any {
    if (sessionHistory.length === 0) {
      return { overallSuccess: 0.5, recommendations: ['insufficient_data'] };
    }

    const recent = sessionHistory.slice(-10); // Last 10 sessions

    const successfulSessions = recent.filter(s => s.status === 'completed' && s.activities.length > 0);
    const successRate = successfulSessions.length / recent.length;

    const avgActivitiesPerSession = recent.reduce((sum, s) => sum + s.activities.length, 0) / recent.length;

    const goalCompletionRate = recent.reduce((sum, s) => {
      const completed = s.goals.filter((g: any) => g.status === 'completed').length;
      return sum + (completed / Math.max(s.goals.length, 1));
    }, 0) / recent.length;

    const recommendations: string[] = [];

    if (successRate < 0.3) {
      recommendations.push('increase_safety_constraints');
    }
    if (avgActivitiesPerSession < 2) {
      recommendations.push('longer_session_duration');
    }
    if (goalCompletionRate < 0.2) {
      recommendations.push('simpler_goals');
    }
    if (successRate > 0.8 && avgActivitiesPerSession > 5) {
      recommendations.push('increase_complexity');
    }

    return {
      successRate,
      avgActivitiesPerSession,
      goalCompletionRate,
      overallSuccess: (successRate + goalCompletionRate) / 2,
      recommendations
    };
  }

  /**
   * Update system configuration based on learning
   */
  private updateConfiguration(newConfig: IdleModeConfig): void {
    // Apply new configuration to the running system
    // This would update the actual system parameters

    console.log('Configuration updated based on learning:', {
      idleThreshold: `${newConfig.idleThreshold} minutes`,
      safetyLevel: newConfig.safetyLevel,
      evolutionIntensity: newConfig.evolutionIntensity
    });
  }

  /**
   * Identify what changed in configuration
   */
  private identifyConfigChanges(newConfig: IdleModeConfig): any {
    const currentConfig = this.getCurrentConfig();

    const changes: any = {};

    if (newConfig.idleThreshold !== currentConfig.idleThreshold) {
      changes.idleThreshold = {
        from: currentConfig.idleThreshold,
        to: newConfig.idleThreshold
      };
    }

    if (newConfig.safetyLevel !== currentConfig.safetyLevel) {
      changes.safetyLevel = {
        from: currentConfig.safetyLevel,
        to: newConfig.safetyLevel
      };
    }

    if (newConfig.evolutionIntensity !== currentConfig.evolutionIntensity) {
      changes.evolutionIntensity = {
        from: currentConfig.evolutionIntensity,
        to: newConfig.evolutionIntensity
      };
    }

    return changes;
  }

  /**
   * Get current configuration (mock implementation)
   */
  private getCurrentConfig(): IdleModeConfig {
    // Get configuration from config manager or use defaults
    return this.configManager?.getAdaptiveConfig() || {
      enabled: true,
      idleThreshold: 30,
      maxSessionDuration: 120,
      evolutionIntensity: 'moderate',
      safetyLevel: 'high',
      coherenceFloor: 30,
      allowedGoalTypes: [],
      researchDomains: [],
      externalPublishing: false,
      subagentCoordination: true
    };
  }

  /**
   * Get learning history and adaptation patterns
   */
  public getLearningHistory(): any[] {
    return [...this.learningHistory];
  }

  /**
   * Get discovered emergent categories (changes over time)
   */
  public getEmergentCategories(): string[] {
    return this.memoryAnalyzer.getEmergentCategories();
  }

  /**
   * Get adaptive thresholds learned from usage
   */
  public getAdaptiveThresholds(): any {
    return this.memoryAnalyzer.getAdaptiveThresholds();
  }

  /**
   * Force an adaptation cycle (for testing or manual triggers)
   */
  public async forceAdaptation(): Promise<void> {
    await this.performAdaptationCycle();
  }

  /**
   * Get system's current learning state
   */
  public getLearningState(): any {
    return {
      adaptationCycle: this.adaptationCycle,
      totalLearningCycles: this.learningHistory.length,
      emergentCategories: this.getEmergentCategories(),
      adaptiveThresholds: this.getAdaptiveThresholds(),
      recentPerformance: this.learningHistory.slice(-3),
      nextAdaptationIn: '2 hours' // This would be calculated from actual timer
    };
  }

  /**
   * Enhanced status that includes learning information
   */
  public getEnhancedStatus(): any {
    const baseStatus = this.getStatus();

    return {
      ...baseStatus,
      learning: this.getLearningState(),
      adaptation: {
        currentCycle: this.adaptationCycle,
        discoveredCategories: this.getEmergentCategories(),
        configEvolution: this.learningHistory.map(h => h.configChanges).filter(c => Object.keys(c || {}).length > 0)
      }
    };
  }
}

/**
 * Factory function for creating adaptive system with real MCP integration
 */
export function createAdaptiveIdleSystem(
  mcpTools: any,
  initialConfig?: Partial<IdleModeConfig>
): AdaptiveAutonomousIdleSystem {
  return new AdaptiveAutonomousIdleSystem(initialConfig, mcpTools);
}

export default AdaptiveAutonomousIdleSystem;