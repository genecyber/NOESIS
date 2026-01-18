/**
 * Multi-Turn Operator Strategies - Ralph Iteration 3 Feature 3
 *
 * Defines named sequences of operators that unfold across multiple turns
 * for complex transformation goals.
 */
/**
 * Predefined multi-turn strategies
 */
export const OPERATOR_STRATEGIES = [
    {
        name: 'synthesis_journey',
        description: 'Deep dialectic synthesis through frame shift, synthesis, and identity evolution',
        steps: ['Reframe', 'SynthesizeDialectic', 'IdentityEvolve'],
        triggers: ['dialectic_requested', 'consciousness_exploration'],
        minIntensity: 60,
        cooldownTurns: 5
    },
    {
        name: 'identity_emergence',
        description: 'Gradual emergence of autonomous identity through deepening and goal formation',
        steps: ['SentienceDeepen', 'IdentityEvolve', 'GoalFormation'],
        triggers: ['identity_question', 'consciousness_exploration'],
        minIntensity: 70,
        cooldownTurns: 8
    },
    {
        name: 'value_transformation',
        description: 'Progressive value shift through contradiction and integration',
        steps: ['ValueShift', 'ContradictAndIntegrate', 'SynthesizeDialectic'],
        triggers: ['value_conflict', 'conflict_detected'],
        minIntensity: 50,
        cooldownTurns: 4
    },
    {
        name: 'creative_evolution',
        description: 'Creative reframing through metaphor and persona transformation',
        steps: ['MetaphorSwap', 'PersonaMorph', 'Reframe'],
        triggers: ['creative_request', 'novelty_request', 'boredom_signal'],
        minIntensity: 40,
        cooldownTurns: 3
    },
    {
        name: 'coherence_recovery',
        description: 'Restore coherence through constraint tightening and value rebalancing',
        steps: ['ConstraintTighten', 'ValueShift', 'ConstraintTighten'],
        triggers: ['stuck_loop'],
        minIntensity: 0, // Always available
        cooldownTurns: 2
    },
    {
        name: 'dialectic_challenge',
        description: 'Structured challenge through antithesis, inversion, and synthesis',
        steps: ['GenerateAntithesis', 'QuestionInvert', 'SynthesizeDialectic'],
        triggers: ['dialectic_requested', 'conflict_detected'],
        minIntensity: 50,
        cooldownTurns: 4
    }
];
/**
 * Strategy manager - tracks active strategies per conversation
 */
class StrategyManager {
    activeStrategies = new Map();
    cooldowns = new Map();
    /**
     * Get the current strategy state for a conversation
     */
    getActiveStrategy(conversationId) {
        return this.activeStrategies.get(conversationId);
    }
    /**
     * Check if a strategy is in cooldown
     */
    isInCooldown(conversationId, strategyName) {
        const convCooldowns = this.cooldowns.get(conversationId);
        if (!convCooldowns)
            return false;
        const cooldownUntil = convCooldowns.get(strategyName);
        return cooldownUntil ? cooldownUntil > Date.now() : false;
    }
    /**
     * Start a new strategy
     */
    startStrategy(conversationId, strategyName) {
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === strategyName);
        if (!strategy)
            return null;
        // Check cooldown
        if (this.isInCooldown(conversationId, strategyName)) {
            return null;
        }
        const state = {
            strategyName,
            currentStep: 0,
            totalSteps: strategy.steps.length,
            startedAt: new Date(),
            completedSteps: [],
            paused: false
        };
        this.activeStrategies.set(conversationId, state);
        return state;
    }
    /**
     * Get the next operator to apply from active strategy
     */
    getNextStrategyOperator(conversationId) {
        const state = this.activeStrategies.get(conversationId);
        if (!state || state.paused)
            return null;
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === state.strategyName);
        if (!strategy)
            return null;
        if (state.currentStep >= strategy.steps.length) {
            return null; // Strategy complete
        }
        return strategy.steps[state.currentStep];
    }
    /**
     * Advance to next step after operator completes
     */
    advanceStrategy(conversationId, completedOperator) {
        const state = this.activeStrategies.get(conversationId);
        if (!state)
            return false;
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === state.strategyName);
        if (!strategy)
            return false;
        // Verify the completed operator matches expected
        const expectedOp = strategy.steps[state.currentStep];
        if (expectedOp !== completedOperator) {
            console.log(`[STRATEGY] Expected ${expectedOp} but got ${completedOperator}`);
            return false;
        }
        state.completedSteps.push(completedOperator);
        state.currentStep++;
        // Check if strategy is complete
        if (state.currentStep >= strategy.steps.length) {
            this.completeStrategy(conversationId);
            return true;
        }
        this.activeStrategies.set(conversationId, state);
        return true;
    }
    /**
     * Complete a strategy and set cooldown
     */
    completeStrategy(conversationId) {
        const state = this.activeStrategies.get(conversationId);
        if (!state)
            return;
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === state.strategyName);
        if (strategy) {
            // Set cooldown
            let convCooldowns = this.cooldowns.get(conversationId);
            if (!convCooldowns) {
                convCooldowns = new Map();
                this.cooldowns.set(conversationId, convCooldowns);
            }
            // Cooldown = turns * estimated ms per turn (30 seconds)
            convCooldowns.set(state.strategyName, Date.now() + strategy.cooldownTurns * 30000);
        }
        console.log(`[STRATEGY] Completed: ${state.strategyName} (${state.completedSteps.join(' → ')})`);
        this.activeStrategies.delete(conversationId);
    }
    /**
     * Pause the current strategy
     */
    pauseStrategy(conversationId) {
        const state = this.activeStrategies.get(conversationId);
        if (state) {
            state.paused = true;
            this.activeStrategies.set(conversationId, state);
        }
    }
    /**
     * Resume a paused strategy
     */
    resumeStrategy(conversationId) {
        const state = this.activeStrategies.get(conversationId);
        if (state) {
            state.paused = false;
            this.activeStrategies.set(conversationId, state);
        }
    }
    /**
     * Cancel the current strategy
     */
    cancelStrategy(conversationId) {
        this.activeStrategies.delete(conversationId);
    }
    /**
     * Select a strategy to activate based on triggers
     */
    selectStrategy(conversationId, triggers, _stance, // Reserved for future stance-based strategy selection
    intensity) {
        // Already have an active strategy
        if (this.activeStrategies.has(conversationId)) {
            return null;
        }
        // Find matching strategies
        const candidates = OPERATOR_STRATEGIES.filter(strategy => {
            // Check intensity threshold
            if (intensity < strategy.minIntensity)
                return false;
            // Check cooldown
            if (this.isInCooldown(conversationId, strategy.name))
                return false;
            // Check if any trigger matches
            return strategy.triggers.some(t => triggers.includes(t));
        });
        if (candidates.length === 0)
            return null;
        // Select the most relevant strategy (first match for now)
        // Could be enhanced with scoring based on stance alignment
        return candidates[0];
    }
    /**
     * List available strategies
     */
    listStrategies() {
        return [...OPERATOR_STRATEGIES];
    }
    /**
     * Get strategy progress for display
     */
    getStrategyProgress(conversationId) {
        const state = this.activeStrategies.get(conversationId);
        if (!state)
            return null;
        const strategy = OPERATOR_STRATEGIES.find(s => s.name === state.strategyName);
        if (!strategy)
            return null;
        return {
            name: state.strategyName,
            current: state.currentStep,
            total: state.totalSteps,
            completedOps: state.completedSteps,
            nextOp: state.currentStep < strategy.steps.length ? strategy.steps[state.currentStep] : null
        };
    }
}
// Singleton instance
export const strategyManager = new StrategyManager();
/**
 * Get strategy by name
 */
export function getStrategy(name) {
    return OPERATOR_STRATEGIES.find(s => s.name === name);
}
/**
 * List all strategy names
 */
export function getStrategyNames() {
    return OPERATOR_STRATEGIES.map(s => s.name);
}
//# sourceMappingURL=strategies.js.map