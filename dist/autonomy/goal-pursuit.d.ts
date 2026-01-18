/**
 * Autonomous Goal Pursuit (Ralph Iteration 10, Feature 6)
 *
 * Self-directed objective setting, minimal intervention mode,
 * goal progress tracking, and coherence-bounded autonomy.
 */
import type { Stance, Frame } from '../types/index.js';
export interface AutonomyConfig {
    enableAutonomy: boolean;
    maxAutonomyLevel: number;
    coherenceFloor: number;
    interventionThreshold: number;
    goalTimeout: number;
    maxConcurrentGoals: number;
}
export interface Goal {
    id: string;
    name: string;
    description: string;
    type: GoalType;
    priority: GoalPriority;
    status: GoalStatus;
    progress: number;
    createdAt: Date;
    deadline: Date | null;
    parentGoalId: string | null;
    subgoals: string[];
    metrics: GoalMetrics;
    constraints: GoalConstraints;
}
export type GoalType = 'transformation' | 'exploration' | 'optimization' | 'maintenance' | 'learning' | 'creative';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';
export type GoalStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
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
export type InterventionReason = 'coherence_threshold' | 'goal_conflict' | 'uncertain_action' | 'ethics_check' | 'user_requested' | 'timeout';
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
export declare class GoalPursuitManager {
    private config;
    private goals;
    private sequences;
    private interventions;
    private currentSession;
    private stats;
    constructor(config?: Partial<AutonomyConfig>);
    /**
     * Create a new goal
     */
    createGoal(name: string, description: string, type: GoalType, priority?: GoalPriority, constraints?: Partial<GoalConstraints>, parentGoalId?: string): Goal;
    /**
     * Start pursuing a goal
     */
    startGoal(goalId: string): boolean;
    /**
     * Plan an operator sequence for a goal
     */
    private planSequence;
    /**
     * Select operators for a goal based on type
     */
    private selectOperatorsForGoal;
    /**
     * Execute next step in a goal's sequence
     */
    executeNextStep(goalId: string, stance: Stance): StepResult | null;
    /**
     * Check if intervention is needed
     */
    private needsIntervention;
    /**
     * Request human intervention
     */
    requestIntervention(goal: Goal, reason: InterventionReason, context: string): InterventionRequest;
    /**
     * Resolve an intervention
     */
    resolveIntervention(interventionId: string, optionId: string): boolean;
    /**
     * Complete a goal
     */
    private completeGoal;
    /**
     * Update autonomy efficiency
     */
    private updateEfficiency;
    /**
     * Start an autonomy session
     */
    startSession(autonomyLevel?: number): AutonomySession;
    /**
     * End the current session
     */
    endSession(): AutonomySession | null;
    /**
     * Validate a goal against constraints
     */
    validateGoal(goalId: string, stance: Stance): {
        valid: boolean;
        issues: string[];
    };
    /**
     * Get goal by ID
     */
    getGoal(goalId: string): Goal | null;
    /**
     * List goals by status
     */
    listGoals(status?: GoalStatus): Goal[];
    /**
     * Get pending interventions
     */
    getPendingInterventions(): InterventionRequest[];
    /**
     * Get current session
     */
    getCurrentSession(): AutonomySession | null;
    /**
     * Get statistics
     */
    getStats(): AutonomyStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const goalPursuit: GoalPursuitManager;
//# sourceMappingURL=goal-pursuit.d.ts.map