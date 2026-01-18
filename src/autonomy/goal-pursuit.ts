/**
 * Autonomous Goal Pursuit (Ralph Iteration 10, Feature 6)
 *
 * Self-directed objective setting, minimal intervention mode,
 * goal progress tracking, and coherence-bounded autonomy.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface AutonomyConfig {
  enableAutonomy: boolean;
  maxAutonomyLevel: number;  // 0-1
  coherenceFloor: number;
  interventionThreshold: number;
  goalTimeout: number;  // milliseconds
  maxConcurrentGoals: number;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;  // 0-1
  createdAt: Date;
  deadline: Date | null;
  parentGoalId: string | null;
  subgoals: string[];
  metrics: GoalMetrics;
  constraints: GoalConstraints;
}

export type GoalType =
  | 'transformation'
  | 'exploration'
  | 'optimization'
  | 'maintenance'
  | 'learning'
  | 'creative';

export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export type GoalStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GoalMetrics {
  startTime: Date | null;
  endTime: Date | null;
  attemptCount: number;
  operatorsUsed: string[];
  coherenceImpact: number;
  successProbability: number;
}

export interface GoalConstraints {
  maxDrift: number;
  allowedFrames: Frame[];
  forbiddenOperators: string[];
  requireHumanApproval: boolean;
}

export interface OperatorSequence {
  id: string;
  goalId: string;
  operators: SequenceStep[];
  status: 'planned' | 'executing' | 'completed' | 'aborted';
  currentStep: number;
}

export interface SequenceStep {
  operator: string;
  parameters: Record<string, unknown>;
  expectedOutcome: string;
  executed: boolean;
  result: StepResult | null;
}

export interface StepResult {
  success: boolean;
  actualOutcome: string;
  driftCost: number;
  timestamp: Date;
}

export interface InterventionRequest {
  id: string;
  goalId: string;
  reason: InterventionReason;
  context: string;
  options: InterventionOption[];
  urgency: 'low' | 'medium' | 'high';
  timestamp: Date;
  resolved: boolean;
  resolution: InterventionOption | null;
}

export type InterventionReason =
  | 'coherence_threshold'
  | 'goal_conflict'
  | 'uncertain_action'
  | 'ethics_check'
  | 'user_requested'
  | 'timeout';

export interface InterventionOption {
  id: string;
  label: string;
  description: string;
  action: 'continue' | 'pause' | 'modify' | 'abort';
  parameters?: Record<string, unknown>;
}

export interface AutonomySession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  autonomyLevel: number;
  activeGoals: string[];
  completedGoals: string[];
  interventions: string[];
  totalOperations: number;
}

export interface AutonomyStats {
  totalGoals: number;
  completedGoals: number;
  failedGoals: number;
  averageCompletionTime: number;
  interventionRate: number;
  autonomyEfficiency: number;
}

// ============================================================================
// Autonomous Goal Pursuit Manager
// ============================================================================

export class GoalPursuitManager {
  private config: AutonomyConfig;
  private goals: Map<string, Goal> = new Map();
  private sequences: Map<string, OperatorSequence> = new Map();
  private interventions: Map<string, InterventionRequest> = new Map();
  private currentSession: AutonomySession | null = null;
  private stats: AutonomyStats;

  constructor(config: Partial<AutonomyConfig> = {}) {
    this.config = {
      enableAutonomy: true,
      maxAutonomyLevel: 0.8,
      coherenceFloor: 30,
      interventionThreshold: 0.7,
      goalTimeout: 300000,  // 5 minutes
      maxConcurrentGoals: 3,
      ...config
    };

    this.stats = {
      totalGoals: 0,
      completedGoals: 0,
      failedGoals: 0,
      averageCompletionTime: 0,
      interventionRate: 0,
      autonomyEfficiency: 0
    };
  }

  /**
   * Create a new goal
   */
  createGoal(
    name: string,
    description: string,
    type: GoalType,
    priority: GoalPriority = 'medium',
    constraints: Partial<GoalConstraints> = {},
    parentGoalId?: string
  ): Goal {
    const goal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      type,
      priority,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      deadline: null,
      parentGoalId: parentGoalId || null,
      subgoals: [],
      metrics: {
        startTime: null,
        endTime: null,
        attemptCount: 0,
        operatorsUsed: [],
        coherenceImpact: 0,
        successProbability: 0.5
      },
      constraints: {
        maxDrift: constraints.maxDrift ?? 30,
        allowedFrames: constraints.allowedFrames ?? ['pragmatic', 'existential', 'playful', 'systems', 'stoic', 'mythic', 'poetic', 'adversarial', 'psychoanalytic', 'absurdist'],
        forbiddenOperators: constraints.forbiddenOperators ?? [],
        requireHumanApproval: constraints.requireHumanApproval ?? false
      }
    };

    this.goals.set(goal.id, goal);
    this.stats.totalGoals++;

    // Update parent goal if exists
    if (parentGoalId) {
      const parent = this.goals.get(parentGoalId);
      if (parent) {
        parent.subgoals.push(goal.id);
      }
    }

    return goal;
  }

  /**
   * Start pursuing a goal
   */
  startGoal(goalId: string): boolean {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status !== 'pending') return false;

    // Check concurrent goals limit
    const activeGoals = [...this.goals.values()].filter(g => g.status === 'active');
    if (activeGoals.length >= this.config.maxConcurrentGoals) {
      return false;
    }

    goal.status = 'active';
    goal.metrics.startTime = new Date();
    goal.metrics.attemptCount++;

    // Plan operator sequence
    this.planSequence(goal);

    return true;
  }

  /**
   * Plan an operator sequence for a goal
   */
  private planSequence(goal: Goal): OperatorSequence {
    const operators = this.selectOperatorsForGoal(goal);

    const sequence: OperatorSequence = {
      id: `seq-${Date.now()}`,
      goalId: goal.id,
      operators: operators.map(op => ({
        operator: op,
        parameters: {},
        expectedOutcome: `Apply ${op} towards ${goal.name}`,
        executed: false,
        result: null
      })),
      status: 'planned',
      currentStep: 0
    };

    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  /**
   * Select operators for a goal based on type
   */
  private selectOperatorsForGoal(goal: Goal): string[] {
    const operatorMap: Record<GoalType, string[]> = {
      transformation: ['REFRAME', 'SHIFT_FRAME', 'DEEPEN'],
      exploration: ['EXPLORE', 'DIVERGE', 'QUESTION'],
      optimization: ['REFINE', 'OPTIMIZE', 'FOCUS'],
      maintenance: ['STABILIZE', 'GROUND', 'VALIDATE'],
      learning: ['REFLECT', 'SYNTHESIZE', 'INTEGRATE'],
      creative: ['PLAY', 'METAPHOR', 'COMBINE']
    };

    return operatorMap[goal.type] || ['EXPLORE'];
  }

  /**
   * Execute next step in a goal's sequence
   */
  executeNextStep(goalId: string, stance: Stance): StepResult | null {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status !== 'active') return null;

    // Find active sequence
    const sequence = [...this.sequences.values()].find(
      s => s.goalId === goalId && s.status === 'executing'
    );

    if (!sequence) return null;

    // Check if we need intervention
    if (this.needsIntervention(goal, stance)) {
      this.requestIntervention(goal, 'coherence_threshold', 'Approaching coherence threshold');
      return null;
    }

    const currentStep = sequence.operators[sequence.currentStep];
    if (!currentStep || currentStep.executed) return null;

    // Execute the step
    const result: StepResult = {
      success: Math.random() > 0.2,  // Simulated success
      actualOutcome: `Executed ${currentStep.operator}`,
      driftCost: Math.random() * 5,
      timestamp: new Date()
    };

    currentStep.executed = true;
    currentStep.result = result;
    goal.metrics.operatorsUsed.push(currentStep.operator);
    goal.metrics.coherenceImpact += result.driftCost;

    // Update progress
    sequence.currentStep++;
    goal.progress = sequence.currentStep / sequence.operators.length;

    // Check if sequence is complete
    if (sequence.currentStep >= sequence.operators.length) {
      this.completeGoal(goalId, result.success);
    }

    return result;
  }

  /**
   * Check if intervention is needed
   */
  private needsIntervention(goal: Goal, stance: Stance): boolean {
    // Check coherence floor
    const coherence = 100 - stance.cumulativeDrift;
    if (coherence < this.config.coherenceFloor) {
      return true;
    }

    // Check if approaching max drift
    if (goal.metrics.coherenceImpact > goal.constraints.maxDrift * 0.8) {
      return true;
    }

    // Check if human approval required
    if (goal.constraints.requireHumanApproval && goal.progress > 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Request human intervention
   */
  requestIntervention(
    goal: Goal,
    reason: InterventionReason,
    context: string
  ): InterventionRequest {
    const request: InterventionRequest = {
      id: `intervention-${Date.now()}`,
      goalId: goal.id,
      reason,
      context,
      options: [
        { id: 'continue', label: 'Continue', description: 'Proceed with goal', action: 'continue' },
        { id: 'pause', label: 'Pause', description: 'Pause goal pursuit', action: 'pause' },
        { id: 'modify', label: 'Modify', description: 'Adjust goal parameters', action: 'modify' },
        { id: 'abort', label: 'Abort', description: 'Cancel goal', action: 'abort' }
      ],
      urgency: reason === 'coherence_threshold' ? 'high' : 'medium',
      timestamp: new Date(),
      resolved: false,
      resolution: null
    };

    this.interventions.set(request.id, request);
    goal.status = 'paused';

    return request;
  }

  /**
   * Resolve an intervention
   */
  resolveIntervention(interventionId: string, optionId: string): boolean {
    const intervention = this.interventions.get(interventionId);
    if (!intervention || intervention.resolved) return false;

    const option = intervention.options.find(o => o.id === optionId);
    if (!option) return false;

    intervention.resolved = true;
    intervention.resolution = option;

    const goal = this.goals.get(intervention.goalId);
    if (!goal) return true;

    switch (option.action) {
      case 'continue':
        goal.status = 'active';
        break;
      case 'pause':
        goal.status = 'paused';
        break;
      case 'abort':
        goal.status = 'cancelled';
        break;
      case 'modify':
        // Would apply modifications from option.parameters
        goal.status = 'active';
        break;
    }

    return true;
  }

  /**
   * Complete a goal
   */
  private completeGoal(goalId: string, success: boolean): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.status = success ? 'completed' : 'failed';
    goal.metrics.endTime = new Date();
    goal.progress = success ? 1 : goal.progress;

    if (success) {
      this.stats.completedGoals++;
    } else {
      this.stats.failedGoals++;
    }

    // Update average completion time
    if (goal.metrics.startTime && goal.metrics.endTime) {
      const duration = goal.metrics.endTime.getTime() - goal.metrics.startTime.getTime();
      const completedCount = this.stats.completedGoals + this.stats.failedGoals;
      this.stats.averageCompletionTime = (
        this.stats.averageCompletionTime * (completedCount - 1) + duration
      ) / completedCount;
    }

    // Update efficiency
    this.updateEfficiency();
  }

  /**
   * Update autonomy efficiency
   */
  private updateEfficiency(): void {
    const total = this.stats.completedGoals + this.stats.failedGoals;
    if (total === 0) {
      this.stats.autonomyEfficiency = 0;
      return;
    }

    const completionRate = this.stats.completedGoals / total;
    const interventionCount = [...this.interventions.values()].length;
    const interventionRate = total > 0 ? interventionCount / total : 0;

    this.stats.interventionRate = interventionRate;
    this.stats.autonomyEfficiency = completionRate * (1 - interventionRate * 0.5);
  }

  /**
   * Start an autonomy session
   */
  startSession(autonomyLevel: number = 0.5): AutonomySession {
    const level = Math.min(autonomyLevel, this.config.maxAutonomyLevel);

    const session: AutonomySession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      autonomyLevel: level,
      activeGoals: [],
      completedGoals: [],
      interventions: [],
      totalOperations: 0
    };

    this.currentSession = session;
    return session;
  }

  /**
   * End the current session
   */
  endSession(): AutonomySession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = new Date();

    // Pause all active goals
    for (const goalId of this.currentSession.activeGoals) {
      const goal = this.goals.get(goalId);
      if (goal && goal.status === 'active') {
        goal.status = 'paused';
      }
    }

    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  /**
   * Validate a goal against constraints
   */
  validateGoal(goalId: string, stance: Stance): { valid: boolean; issues: string[] } {
    const goal = this.goals.get(goalId);
    if (!goal) return { valid: false, issues: ['Goal not found'] };

    const issues: string[] = [];

    // Check frame constraint
    if (!goal.constraints.allowedFrames.includes(stance.frame)) {
      issues.push(`Current frame ${stance.frame} not allowed`);
    }

    // Check drift constraint
    if (stance.cumulativeDrift > goal.constraints.maxDrift) {
      issues.push(`Drift ${stance.cumulativeDrift} exceeds max ${goal.constraints.maxDrift}`);
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Get goal by ID
   */
  getGoal(goalId: string): Goal | null {
    return this.goals.get(goalId) || null;
  }

  /**
   * List goals by status
   */
  listGoals(status?: GoalStatus): Goal[] {
    const goals = [...this.goals.values()];
    if (status) {
      return goals.filter(g => g.status === status);
    }
    return goals;
  }

  /**
   * Get pending interventions
   */
  getPendingInterventions(): InterventionRequest[] {
    return [...this.interventions.values()].filter(i => !i.resolved);
  }

  /**
   * Get current session
   */
  getCurrentSession(): AutonomySession | null {
    return this.currentSession;
  }

  /**
   * Get statistics
   */
  getStats(): AutonomyStats {
    return { ...this.stats };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.goals.clear();
    this.sequences.clear();
    this.interventions.clear();
    this.currentSession = null;
    this.stats = {
      totalGoals: 0,
      completedGoals: 0,
      failedGoals: 0,
      averageCompletionTime: 0,
      interventionRate: 0,
      autonomyEfficiency: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const goalPursuit = new GoalPursuitManager();
