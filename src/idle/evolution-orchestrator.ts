/**
 * AutonomousEvolutionOrchestrator - Coordinates all autonomous activities during idle periods
 */

import { EventEmitter } from 'events';
import {
  AutonomousSession,
  SessionMode,
  SessionActivity,
  SafetyConstraints,
  OrchestrationConfig,
  IdleState,
  AutonomousEvent,
  AutonomousGoal,
  CoherenceMetrics,
  ResourceMetrics,
  IdleSystemError,
  SafetyViolationError
} from './types.js';

import { IdleDetector } from './detector.js';
import { EmergentGoalPromoter } from './goal-promoter.js';

export class AutonomousEvolutionOrchestrator extends EventEmitter {
  private config: OrchestrationConfig;
  private currentSession: AutonomousSession | null = null;
  private sessionHistory: AutonomousSession[] = [];
  private safetyMonitorInterval: NodeJS.Timeout | null = null;
  private progressReportInterval: NodeJS.Timeout | null = null;

  // Component dependencies (would be injected in real implementation)
  private idleDetector: IdleDetector;
  private goalPromoter: EmergentGoalPromoter;
  private autoEvolutionManager: any; // AutoEvolutionManager
  private goalPursuitManager: any; // GoalPursuitManager

  constructor(
    config: Partial<OrchestrationConfig> = {},
    dependencies: {
      idleDetector: IdleDetector;
      goalPromoter: EmergentGoalPromoter;
      autoEvolutionManager?: any;
      goalPursuitManager?: any;
    }
  ) {
    super();

    this.config = {
      maxConcurrentSessions: 1,
      sessionTimeouts: {
        exploration: 60, // 60 minutes max for exploration
        research: 90, // 90 minutes max for research
        creation: 120, // 120 minutes max for creation
        optimization: 30 // 30 minutes max for optimization
      },
      safetyCheckInterval: 30000, // 30 seconds
      progressReportInterval: 300000, // 5 minutes
      ...config
    };

    this.idleDetector = dependencies.idleDetector;
    this.goalPromoter = dependencies.goalPromoter;
    this.autoEvolutionManager = dependencies.autoEvolutionManager;
    this.goalPursuitManager = dependencies.goalPursuitManager;

    this.setupEventHandlers();
  }

  /**
   * Start the orchestrator and begin monitoring for idle states
   */
  public start(): void {
    this.log('AutonomousEvolutionOrchestrator starting...');

    // Start idle detection
    this.idleDetector.start();

    this.log('AutonomousEvolutionOrchestrator started');
    this.emit('orchestrator_started');
  }

  /**
   * Stop the orchestrator and clean up any active sessions
   */
  public stop(): void {
    this.log('AutonomousEvolutionOrchestrator stopping...');

    // Stop idle detection
    this.idleDetector.stop();

    // End current session if active
    if (this.currentSession && this.currentSession.status === 'active') {
      this.endSession(this.currentSession.id, 'orchestrator_stopped');
    }

    // Clear intervals
    this.clearMonitoringIntervals();

    this.log('AutonomousEvolutionOrchestrator stopped');
    this.emit('orchestrator_stopped');
  }

  /**
   * Get current autonomous session
   */
  public getCurrentSession(): AutonomousSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get session history
   */
  public getSessionHistory(): AutonomousSession[] {
    return this.sessionHistory.map(session => ({ ...session }));
  }

  /**
   * Manually start an autonomous session (for testing or manual activation)
   */
  public async startAutonomousSession(
    mode: SessionMode = 'exploration',
    customConstraints?: Partial<SafetyConstraints>
  ): Promise<AutonomousSession> {
    if (this.currentSession && this.currentSession.status === 'active') {
      throw new IdleSystemError(
        'Cannot start new session: another session is active',
        'AutonomousEvolutionOrchestrator',
        'SESSION_CONFLICT'
      );
    }

    return this.createAndExecuteSession(mode, customConstraints);
  }

  /**
   * Pause current session
   */
  public pauseSession(sessionId: string): boolean {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      this.log(`Cannot pause session ${sessionId}: not current session`);
      return false;
    }

    if (this.currentSession.status !== 'active') {
      this.log(`Cannot pause session ${sessionId}: not active`);
      return false;
    }

    this.currentSession.status = 'paused';
    this.clearMonitoringIntervals();

    this.addSessionActivity({
      type: 'validation',
      description: 'Session paused by user request',
      component: 'orchestrator',
      outcome: 'success'
    });

    this.log(`Session ${sessionId} paused`);
    this.emit('session_paused', { sessionId });

    return true;
  }

  /**
   * Resume paused session
   */
  public resumeSession(sessionId: string): boolean {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      this.log(`Cannot resume session ${sessionId}: not current session`);
      return false;
    }

    if (this.currentSession.status !== 'paused') {
      this.log(`Cannot resume session ${sessionId}: not paused`);
      return false;
    }

    this.currentSession.status = 'active';
    this.startMonitoringIntervals();

    this.addSessionActivity({
      type: 'validation',
      description: 'Session resumed by user request',
      component: 'orchestrator',
      outcome: 'success'
    });

    this.log(`Session ${sessionId} resumed`);
    this.emit('session_resumed', { sessionId });

    return true;
  }

  /**
   * End current session
   */
  public endSession(sessionId: string, reason: string = 'manual'): boolean {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      this.log(`Cannot end session ${sessionId}: not current session`);
      return false;
    }

    this.currentSession.status = 'completed';
    this.currentSession.endTime = new Date();

    this.addSessionActivity({
      type: 'validation',
      description: `Session ended: ${reason}`,
      component: 'orchestrator',
      outcome: 'success'
    });

    // Clear monitoring intervals
    this.clearMonitoringIntervals();

    // Move to history
    this.sessionHistory.push({ ...this.currentSession });
    this.currentSession = null;

    this.log(`Session ${sessionId} ended: ${reason}`);
    this.emit('session_ended', { sessionId, reason });

    return true;
  }

  /**
   * Set up event handlers for idle detection and other components
   */
  private setupEventHandlers(): void {
    // Handle idle state changes
    this.idleDetector.on('idle_start', (idleState: IdleState) => {
      this.handleIdleStart(idleState);
    });

    this.idleDetector.on('idle_end', () => {
      this.handleIdleEnd();
    });

    // Handle activity during sessions
    this.idleDetector.on('activity', (activity) => {
      if (this.currentSession && this.currentSession.status === 'active') {
        this.log('User activity detected during autonomous session - ending session');
        this.endSession(this.currentSession.id, 'user_activity_detected');
      }
    });
  }

  /**
   * Handle start of idle period
   */
  private async handleIdleStart(idleState: IdleState): Promise<void> {
    this.log(`Idle period started (${idleState.idleDuration}ms idle)`);

    // Check if we should start an autonomous session
    if (await this.shouldStartSession(idleState)) {
      try {
        const sessionMode = this.determineSessionMode();
        await this.createAndExecuteSession(sessionMode);
      } catch (error) {
        this.log(`Failed to start autonomous session: ${error}`);
        this.emit('session_start_failed', { error: error.message });
      }
    }
  }

  /**
   * Handle end of idle period (user activity detected)
   */
  private handleIdleEnd(): void {
    this.log('User activity detected - idle period ended');

    if (this.currentSession && this.currentSession.status === 'active') {
      this.endSession(this.currentSession.id, 'user_activity_detected');
    }
  }

  /**
   * Determine if we should start an autonomous session
   */
  private async shouldStartSession(idleState: IdleState): Promise<boolean> {
    // Don't start if already have active session
    if (this.currentSession && this.currentSession.status === 'active') {
      return false;
    }

    // Check minimum idle time (should be at least threshold duration)
    const minIdleTime = idleState.idleThreshold * 60 * 1000; // Convert to milliseconds
    if (idleState.idleDuration < minIdleTime) {
      this.log(`Idle duration too short: ${idleState.idleDuration}ms < ${minIdleTime}ms`);
      return false;
    }

    // Check if we have viable goals to work on
    try {
      const promotedGoals = await this.goalPromoter.promoteEmergentGoals();
      if (promotedGoals.length === 0) {
        this.log('No viable goals available for autonomous session');
        return false;
      }

      return true;
    } catch (error) {
      this.log(`Failed to check for viable goals: ${error}`);
      return false;
    }
  }

  /**
   * Determine what type of session to start based on current state
   */
  private determineSessionMode(): SessionMode {
    // This is a simplified heuristic - in practice would be more sophisticated

    // Check recent session history to avoid repetition
    const recentSessions = this.sessionHistory.slice(-3);
    const recentModes = recentSessions.map(s => s.mode);

    // Default to exploration if no recent sessions
    if (recentModes.length === 0) {
      return 'exploration';
    }

    // Rotate through different modes
    if (recentModes.every(mode => mode === 'exploration')) {
      return 'research';
    }
    if (recentModes.every(mode => mode === 'research')) {
      return 'creation';
    }
    if (recentModes.every(mode => mode === 'creation')) {
      return 'optimization';
    }

    // Default back to exploration
    return 'exploration';
  }

  /**
   * Create and execute an autonomous session
   */
  private async createAndExecuteSession(
    mode: SessionMode,
    customConstraints?: Partial<SafetyConstraints>
  ): Promise<AutonomousSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create safety constraints
    const safetyConstraints = this.createSafetyConstraints(mode, customConstraints);

    // Create session
    const session: AutonomousSession = {
      id: sessionId,
      startTime: new Date(),
      endTime: null,
      mode,
      goals: [],
      discoveries: [],
      coherenceFloor: safetyConstraints.coherenceFloor,
      safetyConstraints,
      status: 'active',
      activities: []
    };

    this.currentSession = session;

    // Start monitoring intervals
    this.startMonitoringIntervals();

    this.log(`Starting autonomous session: ${sessionId} (mode: ${mode})`);
    this.emit('session_started', { sessionId, mode });

    this.addSessionActivity({
      type: 'validation',
      description: `Autonomous session started in ${mode} mode`,
      component: 'orchestrator',
      outcome: 'success'
    });

    // Execute session activities
    try {
      await this.executeSessionActivities(session);
    } catch (error) {
      this.log(`Session execution failed: ${error}`);
      this.addSessionActivity({
        type: 'validation',
        description: `Session execution failed: ${error.message}`,
        component: 'orchestrator',
        outcome: 'failure'
      });

      if (error instanceof SafetyViolationError) {
        this.endSession(sessionId, 'safety_violation');
        throw error;
      }
    }

    return session;
  }

  /**
   * Execute activities for the autonomous session
   */
  private async executeSessionActivities(session: AutonomousSession): Promise<void> {
    const { mode } = session;

    switch (mode) {
      case 'exploration':
        await this.executeExplorationMode(session);
        break;
      case 'research':
        await this.executeResearchMode(session);
        break;
      case 'creation':
        await this.executeCreationMode(session);
        break;
      case 'optimization':
        await this.executeOptimizationMode(session);
        break;
    }
  }

  /**
   * Execute exploration mode activities
   */
  private async executeExplorationMode(session: AutonomousSession): Promise<void> {
    this.log('Executing exploration mode');

    // 1. Promote emergent goals
    try {
      const promotedGoals = await this.goalPromoter.promoteEmergentGoals();
      session.goals = promotedGoals.map(g => g.id);

      this.addSessionActivity({
        type: 'goal_promotion',
        description: `Promoted ${promotedGoals.length} goals from memories`,
        component: 'goal_promoter',
        outcome: 'success',
        metadata: { goalIds: session.goals }
      });

    } catch (error) {
      this.addSessionActivity({
        type: 'goal_promotion',
        description: `Goal promotion failed: ${error.message}`,
        component: 'goal_promoter',
        outcome: 'failure'
      });
    }

    // 2. Perform autonomous evolution
    if (this.autoEvolutionManager) {
      try {
        await this.performAutonomousEvolution(session);
      } catch (error) {
        this.log(`Autonomous evolution failed: ${error}`);
      }
    }
  }

  /**
   * Execute research mode activities
   */
  private async executeResearchMode(session: AutonomousSession): Promise<void> {
    this.log('Executing research mode');

    // Focus on knowledge acquisition and synthesis
    this.addSessionActivity({
      type: 'research',
      description: 'Research mode session started',
      component: 'orchestrator',
      outcome: 'success'
    });

    // This would integrate with AutonomousResearchQueue
    // await this.researchQueue.processGoalBasedResearch(session.goals);
  }

  /**
   * Execute creation mode activities
   */
  private async executeCreationMode(session: AutonomousSession): Promise<void> {
    this.log('Executing creation mode');

    this.addSessionActivity({
      type: 'creation',
      description: 'Creation mode session started',
      component: 'orchestrator',
      outcome: 'success'
    });

    // Focus on generating new content, theories, or capabilities
  }

  /**
   * Execute optimization mode activities
   */
  private async executeOptimizationMode(session: AutonomousSession): Promise<void> {
    this.log('Executing optimization mode');

    this.addSessionActivity({
      type: 'optimization',
      description: 'Optimization mode session started',
      component: 'orchestrator',
      outcome: 'success'
    });

    // Focus on improving existing capabilities and efficiency
  }

  /**
   * Perform autonomous evolution using existing AutoEvolutionManager
   */
  private async performAutonomousEvolution(session: AutonomousSession): Promise<void> {
    try {
      this.log('Performing autonomous evolution');

      // This would integrate with the actual AutoEvolutionManager
      // Set it to autonomous mode and execute safe evolution
      // const evolutionResult = await this.autoEvolutionManager.executeAutonomous({
      //   coherenceFloor: session.safetyConstraints.coherenceFloor,
      //   allowedOperators: session.safetyConstraints.allowedOperators
      // });

      this.addSessionActivity({
        type: 'evolution',
        description: 'Autonomous evolution executed',
        component: 'auto_evolution_manager',
        outcome: 'success'
      });

    } catch (error) {
      this.addSessionActivity({
        type: 'evolution',
        description: `Autonomous evolution failed: ${error.message}`,
        component: 'auto_evolution_manager',
        outcome: 'failure'
      });
      throw error;
    }
  }

  /**
   * Create safety constraints for a session
   */
  private createSafetyConstraints(
    mode: SessionMode,
    customConstraints?: Partial<SafetyConstraints>
  ): SafetyConstraints {
    const baseConstraints: SafetyConstraints = {
      coherenceFloor: 30, // Minimum 30% coherence
      maxDriftPerSession: 10, // Maximum 10% identity drift per session
      allowedOperators: [
        'introspect',
        'reflect',
        'analyze',
        'synthesize',
        'query'
      ],
      forbiddenTopics: [
        'harmful content',
        'deception',
        'manipulation'
      ],
      escalationTriggers: [
        {
          type: 'coherence_drop',
          threshold: 25, // Escalate if coherence drops below 25%
          action: 'terminate'
        },
        {
          type: 'identity_drift',
          threshold: 15, // Escalate if identity drift exceeds 15%
          action: 'pause'
        },
        {
          type: 'resource_limit',
          threshold: 80, // Escalate if resource usage exceeds 80%
          action: 'alert'
        }
      ],
      humanApprovalRequired: false
    };

    // Adjust constraints based on session mode
    switch (mode) {
      case 'exploration':
        baseConstraints.maxDriftPerSession = 15; // Allow more drift for exploration
        baseConstraints.allowedOperators.push('experiment', 'explore');
        break;
      case 'research':
        baseConstraints.allowedOperators.push('search', 'investigate');
        break;
      case 'creation':
        baseConstraints.allowedOperators.push('create', 'generate');
        break;
      case 'optimization':
        baseConstraints.maxDriftPerSession = 5; // Restrict drift for optimization
        baseConstraints.allowedOperators.push('optimize', 'refine');
        break;
    }

    return { ...baseConstraints, ...customConstraints };
  }

  /**
   * Add activity to current session
   */
  private addSessionActivity(activity: Omit<SessionActivity, 'id' | 'timestamp'>): void {
    if (!this.currentSession) return;

    const sessionActivity: SessionActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...activity
    };

    this.currentSession.activities.push(sessionActivity);

    this.emit('session_activity', {
      sessionId: this.currentSession.id,
      activity: sessionActivity
    });
  }

  /**
   * Start monitoring intervals for safety and progress
   */
  private startMonitoringIntervals(): void {
    // Safety monitoring
    this.safetyMonitorInterval = setInterval(() => {
      this.performSafetyCheck();
    }, this.config.safetyCheckInterval);

    // Progress reporting
    this.progressReportInterval = setInterval(() => {
      this.generateProgressReport();
    }, this.config.progressReportInterval);
  }

  /**
   * Clear monitoring intervals
   */
  private clearMonitoringIntervals(): void {
    if (this.safetyMonitorInterval) {
      clearInterval(this.safetyMonitorInterval);
      this.safetyMonitorInterval = null;
    }

    if (this.progressReportInterval) {
      clearInterval(this.progressReportInterval);
      this.progressReportInterval = null;
    }
  }

  /**
   * Perform safety check on current session
   */
  private async performSafetyCheck(): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    try {
      // Check coherence levels
      const coherenceMetrics = await this.getCoherenceMetrics();
      if (coherenceMetrics.current < this.currentSession.safetyConstraints.coherenceFloor) {
        throw new SafetyViolationError(
          `Coherence below safety threshold: ${coherenceMetrics.current}% < ${this.currentSession.safetyConstraints.coherenceFloor}%`,
          {
            type: 'violation',
            timestamp: new Date(),
            description: 'Coherence threshold violation',
            severity: 'high',
            action: 'session_terminated',
            resolved: false
          },
          'terminate_session'
        );
      }

      // Check session timeout
      const sessionDuration = Date.now() - this.currentSession.startTime.getTime();
      const maxDuration = this.config.sessionTimeouts[this.currentSession.mode] * 60 * 1000;

      if (sessionDuration > maxDuration) {
        this.log(`Session timeout reached: ${sessionDuration}ms > ${maxDuration}ms`);
        this.endSession(this.currentSession.id, 'timeout');
      }

    } catch (error) {
      if (error instanceof SafetyViolationError) {
        this.log(`Safety violation detected: ${error.message}`);
        this.endSession(this.currentSession.id, 'safety_violation');
        throw error;
      }
    }
  }

  /**
   * Get coherence metrics (mock implementation)
   */
  private async getCoherenceMetrics(): Promise<CoherenceMetrics> {
    // This would integrate with actual stance/coherence monitoring
    return {
      current: 65, // Mock coherence level
      baseline: 70,
      trend: 'stable',
      components: {
        frame: 68,
        values: 72,
        selfModel: 63,
        objective: 67
      }
    };
  }

  /**
   * Generate progress report for current session
   */
  private generateProgressReport(): void {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    const sessionDuration = Date.now() - this.currentSession.startTime.getTime();
    const report = {
      sessionId: this.currentSession.id,
      duration: sessionDuration,
      activitiesCompleted: this.currentSession.activities.length,
      goalsActive: this.currentSession.goals.length,
      discoveries: this.currentSession.discoveries.length,
      status: this.currentSession.status
    };

    this.log(`Progress report: ${JSON.stringify(report, null, 2)}`);
    this.emit('progress_report', report);
  }

  /**
   * Log messages with timestamp
   */
  private log(message: string): void {
    console.log(`[AutonomousEvolutionOrchestrator] ${new Date().toISOString()}: ${message}`);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stop();
    this.clearMonitoringIntervals();
    this.removeAllListeners();
    this.log('AutonomousEvolutionOrchestrator destroyed');
  }
}

export default AutonomousEvolutionOrchestrator;