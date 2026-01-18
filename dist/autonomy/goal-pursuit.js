/**
 * Autonomous Goal Pursuit (Ralph Iteration 10, Feature 6)
 *
 * Self-directed objective setting, minimal intervention mode,
 * goal progress tracking, and coherence-bounded autonomy.
 */
// ============================================================================
// Autonomous Goal Pursuit Manager
// ============================================================================
export class GoalPursuitManager {
    config;
    goals = new Map();
    sequences = new Map();
    interventions = new Map();
    currentSession = null;
    stats;
    constructor(config = {}) {
        this.config = {
            enableAutonomy: true,
            maxAutonomyLevel: 0.8,
            coherenceFloor: 30,
            interventionThreshold: 0.7,
            goalTimeout: 300000, // 5 minutes
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
    createGoal(name, description, type, priority = 'medium', constraints = {}, parentGoalId) {
        const goal = {
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
    startGoal(goalId) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'pending')
            return false;
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
    planSequence(goal) {
        const operators = this.selectOperatorsForGoal(goal);
        const sequence = {
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
    selectOperatorsForGoal(goal) {
        const operatorMap = {
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
    executeNextStep(goalId, stance) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'active')
            return null;
        // Find active sequence
        const sequence = [...this.sequences.values()].find(s => s.goalId === goalId && s.status === 'executing');
        if (!sequence)
            return null;
        // Check if we need intervention
        if (this.needsIntervention(goal, stance)) {
            this.requestIntervention(goal, 'coherence_threshold', 'Approaching coherence threshold');
            return null;
        }
        const currentStep = sequence.operators[sequence.currentStep];
        if (!currentStep || currentStep.executed)
            return null;
        // Execute the step
        const result = {
            success: Math.random() > 0.2, // Simulated success
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
    needsIntervention(goal, stance) {
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
    requestIntervention(goal, reason, context) {
        const request = {
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
    resolveIntervention(interventionId, optionId) {
        const intervention = this.interventions.get(interventionId);
        if (!intervention || intervention.resolved)
            return false;
        const option = intervention.options.find(o => o.id === optionId);
        if (!option)
            return false;
        intervention.resolved = true;
        intervention.resolution = option;
        const goal = this.goals.get(intervention.goalId);
        if (!goal)
            return true;
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
    completeGoal(goalId, success) {
        const goal = this.goals.get(goalId);
        if (!goal)
            return;
        goal.status = success ? 'completed' : 'failed';
        goal.metrics.endTime = new Date();
        goal.progress = success ? 1 : goal.progress;
        if (success) {
            this.stats.completedGoals++;
        }
        else {
            this.stats.failedGoals++;
        }
        // Update average completion time
        if (goal.metrics.startTime && goal.metrics.endTime) {
            const duration = goal.metrics.endTime.getTime() - goal.metrics.startTime.getTime();
            const completedCount = this.stats.completedGoals + this.stats.failedGoals;
            this.stats.averageCompletionTime = (this.stats.averageCompletionTime * (completedCount - 1) + duration) / completedCount;
        }
        // Update efficiency
        this.updateEfficiency();
    }
    /**
     * Update autonomy efficiency
     */
    updateEfficiency() {
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
    startSession(autonomyLevel = 0.5) {
        const level = Math.min(autonomyLevel, this.config.maxAutonomyLevel);
        const session = {
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
    endSession() {
        if (!this.currentSession)
            return null;
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
    validateGoal(goalId, stance) {
        const goal = this.goals.get(goalId);
        if (!goal)
            return { valid: false, issues: ['Goal not found'] };
        const issues = [];
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
    getGoal(goalId) {
        return this.goals.get(goalId) || null;
    }
    /**
     * List goals by status
     */
    listGoals(status) {
        const goals = [...this.goals.values()];
        if (status) {
            return goals.filter(g => g.status === status);
        }
        return goals;
    }
    /**
     * Get pending interventions
     */
    getPendingInterventions() {
        return [...this.interventions.values()].filter(i => !i.resolved);
    }
    /**
     * Get current session
     */
    getCurrentSession() {
        return this.currentSession;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset manager
     */
    reset() {
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
//# sourceMappingURL=goal-pursuit.js.map