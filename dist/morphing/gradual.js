/**
 * Gradual Stance Morphing
 *
 * Smooth transitions between stances with configurable curves,
 * intermediate state generation, and rollback capabilities.
 */
const EASING_FUNCTIONS = {
    'linear': (t) => t,
    'ease-in': (t) => t * t,
    'ease-out': (t) => t * (2 - t),
    'ease-in-out': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    'cubic': (t) => t * t * t,
    'elastic': (t) => {
        if (t === 0 || t === 1)
            return t;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    },
    'bounce': (t) => {
        if (t < 1 / 2.75)
            return 7.5625 * t * t;
        if (t < 2 / 2.75)
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75)
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
};
export class GradualMorpher {
    transitions = new Map();
    onProgressCallbacks = [];
    defaultConfig = {
        duration: 1000,
        steps: 10,
        curve: 'ease-in-out',
        validateCheckpoints: true,
        allowRollback: true
    };
    createTransition(source, target, config) {
        const fullConfig = { ...this.defaultConfig, ...config };
        const id = `morph-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const intermediateStates = this.generateIntermediateStates(source, target, fullConfig);
        const transition = {
            id,
            source: JSON.parse(JSON.stringify(source)),
            target: JSON.parse(JSON.stringify(target)),
            config: fullConfig,
            intermediateStates,
            status: 'pending',
            currentStep: 0,
            rollbackPoints: []
        };
        this.transitions.set(id, transition);
        return transition;
    }
    generateIntermediateStates(source, target, config) {
        const states = [];
        const easingFn = EASING_FUNCTIONS[config.curve];
        for (let step = 0; step <= config.steps; step++) {
            const linearProgress = step / config.steps;
            const easedProgress = easingFn(linearProgress);
            const stance = this.interpolateStance(source, target, easedProgress);
            const coherence = this.calculateCoherence(stance);
            states.push({
                step,
                progress: linearProgress,
                stance,
                coherence,
                validated: false
            });
        }
        return states;
    }
    interpolateStance(source, target, progress) {
        const interpolatedValues = {
            curiosity: this.lerp(source.values.curiosity, target.values.curiosity, progress),
            certainty: this.lerp(source.values.certainty, target.values.certainty, progress),
            risk: this.lerp(source.values.risk, target.values.risk, progress),
            novelty: this.lerp(source.values.novelty, target.values.novelty, progress),
            empathy: this.lerp(source.values.empathy, target.values.empathy, progress),
            provocation: this.lerp(source.values.provocation, target.values.provocation, progress),
            synthesis: this.lerp(source.values.synthesis, target.values.synthesis, progress)
        };
        // Discrete fields change at 50% progress
        const discreteProgress = progress >= 0.5;
        return {
            frame: discreteProgress ? target.frame : source.frame,
            values: interpolatedValues,
            selfModel: discreteProgress ? target.selfModel : source.selfModel,
            objective: discreteProgress ? target.objective : source.objective,
            metaphors: discreteProgress ? target.metaphors : source.metaphors,
            constraints: discreteProgress ? target.constraints : source.constraints,
            sentience: {
                awarenessLevel: this.lerp(source.sentience.awarenessLevel, target.sentience.awarenessLevel, progress),
                autonomyLevel: this.lerp(source.sentience.autonomyLevel, target.sentience.autonomyLevel, progress),
                identityStrength: this.lerp(source.sentience.identityStrength, target.sentience.identityStrength, progress),
                emergentGoals: discreteProgress ? target.sentience.emergentGoals : source.sentience.emergentGoals,
                consciousnessInsights: discreteProgress ? target.sentience.consciousnessInsights : source.sentience.consciousnessInsights,
                persistentValues: discreteProgress ? target.sentience.persistentValues : source.sentience.persistentValues
            },
            turnsSinceLastShift: 0,
            cumulativeDrift: source.cumulativeDrift + Math.abs(progress - 0.5) * 10,
            version: source.version + 1
        };
    }
    lerp(a, b, t) {
        return Math.round(a + (b - a) * t);
    }
    calculateCoherence(stance) {
        const values = Object.values(stance.values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.max(0, Math.min(100, 100 - Math.sqrt(variance) * 2));
    }
    async startTransition(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition || transition.status !== 'pending') {
            throw new Error('Invalid transition or already started');
        }
        transition.status = 'in_progress';
        transition.startedAt = new Date();
        const stepDelay = transition.config.duration / transition.config.steps;
        try {
            for (let i = 0; i <= transition.config.steps; i++) {
                transition.currentStep = i;
                const state = transition.intermediateStates[i];
                // Validate checkpoint
                if (transition.config.validateCheckpoints) {
                    const validation = this.validateState(state.stance);
                    state.validated = validation.valid;
                    state.validationErrors = validation.errors;
                    if (!validation.valid) {
                        transition.status = 'failed';
                        throw new Error(`Validation failed at step ${i}: ${validation.errors.join(', ')}`);
                    }
                }
                // Create rollback point
                if (transition.config.allowRollback && i % 3 === 0) {
                    transition.rollbackPoints.push({
                        step: i,
                        stance: JSON.parse(JSON.stringify(state.stance)),
                        timestamp: new Date(),
                        canRollback: true
                    });
                }
                // Notify progress
                this.notifyProgress(transition);
                // Wait for step delay
                if (i < transition.config.steps) {
                    await this.delay(stepDelay);
                }
            }
            transition.status = 'completed';
            transition.completedAt = new Date();
        }
        catch (error) {
            transition.status = 'failed';
            throw error;
        }
    }
    validateState(stance) {
        const errors = [];
        const warnings = [];
        // Check value ranges
        let valueRangeCheck = true;
        for (const [key, value] of Object.entries(stance.values)) {
            if (value < 0 || value > 100) {
                errors.push(`Value ${key} out of range: ${value}`);
                valueRangeCheck = false;
            }
            if (value < 5 || value > 95) {
                warnings.push(`Value ${key} at extreme level: ${value}`);
            }
        }
        // Check coherence
        const coherence = this.calculateCoherence(stance);
        const coherenceCheck = coherence >= 30;
        if (!coherenceCheck) {
            errors.push(`Coherence too low: ${coherence}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            coherenceCheck,
            valueRangeCheck
        };
    }
    rollback(transitionId, toStep) {
        const transition = this.transitions.get(transitionId);
        if (!transition)
            return null;
        const targetStep = toStep ?? Math.max(0, transition.currentStep - 1);
        const rollbackPoint = transition.rollbackPoints.find(rp => rp.step <= targetStep && rp.canRollback);
        if (!rollbackPoint) {
            // No rollback point, return source
            transition.status = 'rolled_back';
            return JSON.parse(JSON.stringify(transition.source));
        }
        transition.status = 'rolled_back';
        transition.currentStep = rollbackPoint.step;
        return JSON.parse(JSON.stringify(rollbackPoint.stance));
    }
    getProgress(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition)
            return null;
        const currentState = transition.intermediateStates[transition.currentStep];
        const elapsed = transition.startedAt
            ? Date.now() - transition.startedAt.getTime()
            : 0;
        const estimatedTotal = transition.config.duration;
        const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
        return {
            transitionId,
            currentStep: transition.currentStep,
            totalSteps: transition.config.steps,
            progress: transition.currentStep / transition.config.steps,
            currentStance: currentState.stance,
            estimatedTimeRemaining: estimatedRemaining,
            status: transition.status
        };
    }
    getCurrentStance(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition)
            return null;
        return JSON.parse(JSON.stringify(transition.intermediateStates[transition.currentStep].stance));
    }
    getIntermediateStates(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition)
            return [];
        return [...transition.intermediateStates];
    }
    onProgress(callback) {
        this.onProgressCallbacks.push(callback);
        return () => {
            const index = this.onProgressCallbacks.indexOf(callback);
            if (index > -1)
                this.onProgressCallbacks.splice(index, 1);
        };
    }
    notifyProgress(transition) {
        const progress = this.getProgress(transition.id);
        if (progress) {
            for (const callback of this.onProgressCallbacks) {
                callback(progress);
            }
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    cancelTransition(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition || transition.status !== 'in_progress')
            return false;
        transition.status = 'failed';
        return true;
    }
    getTransition(transitionId) {
        return this.transitions.get(transitionId);
    }
    listTransitions() {
        return Array.from(this.transitions.values());
    }
    previewTransition(source, target, config) {
        const fullConfig = { ...this.defaultConfig, ...config };
        return this.generateIntermediateStates(source, target, fullConfig);
    }
    setDefaultConfig(config) {
        this.defaultConfig = { ...this.defaultConfig, ...config };
    }
    getDefaultConfig() {
        return { ...this.defaultConfig };
    }
    // Calculate visual feedback for each step
    getVisualFeedback(transitionId) {
        const transition = this.transitions.get(transitionId);
        if (!transition)
            return [];
        return transition.intermediateStates.map((state, index) => ({
            step: index,
            progress: state.progress,
            coherence: state.coherence,
            color: this.coherenceToColor(state.coherence),
            pulseIntensity: 1 - state.progress + (state.coherence / 100),
            label: this.getStepLabel(state, index, transition.config.steps)
        }));
    }
    coherenceToColor(coherence) {
        const hue = (coherence / 100) * 120; // 0 = red, 120 = green
        return `hsl(${hue}, 70%, 50%)`;
    }
    getStepLabel(state, index, total) {
        if (index === 0)
            return 'Source';
        if (index === total)
            return 'Target';
        if (state.progress < 0.5)
            return `Morphing (${Math.round(state.progress * 100)}%)`;
        return `Converging (${Math.round(state.progress * 100)}%)`;
    }
}
export function createGradualMorpher(config) {
    const morpher = new GradualMorpher();
    if (config)
        morpher.setDefaultConfig(config);
    return morpher;
}
//# sourceMappingURL=gradual.js.map