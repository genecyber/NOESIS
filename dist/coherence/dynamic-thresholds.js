/**
 * Dynamic Coherence Thresholds (Ralph Iteration 11, Feature 3)
 *
 * Context-adaptive coherence floors, conversation phase detection,
 * automatic threshold adjustment, risk-aware bounds, and recovery strategies.
 */
// ============================================================================
// Dynamic Threshold Manager
// ============================================================================
export class DynamicThresholdManager {
    config;
    state;
    phases = new Map();
    recoveryStrategies = new Map();
    stats;
    constructor(config = {}) {
        this.config = {
            enableDynamicThresholds: true,
            baseCoherenceFloor: 30,
            minCoherenceFloor: 15,
            maxCoherenceFloor: 50,
            adaptationRate: 0.1,
            riskSensitivity: 0.7,
            recoveryAggressiveness: 0.5,
            ...config
        };
        this.state = {
            currentThreshold: this.config.baseCoherenceFloor,
            baseThreshold: this.config.baseCoherenceFloor,
            phase: 'opening',
            phaseConfidence: 0.5,
            adjustmentReason: 'Initial state',
            riskLevel: 'low',
            recoveryMode: false,
            history: []
        };
        this.stats = {
            adjustmentCount: 0,
            averageThreshold: this.config.baseCoherenceFloor,
            timeInRecovery: 0,
            phaseDistribution: {
                opening: 0,
                exploration: 0,
                deepening: 0,
                challenging: 0,
                synthesis: 0,
                closing: 0,
                crisis: 0,
                recovery: 0
            },
            riskEvents: 0
        };
        this.initializePhases();
        this.initializeRecoveryStrategies();
    }
    /**
     * Initialize conversation phases
     */
    initializePhases() {
        const phaseConfigs = [
            {
                id: 'opening',
                name: 'Opening',
                description: 'Initial exploration, establishing rapport',
                indicators: [
                    { type: 'keyword', pattern: 'hello|hi|start|begin', weight: 0.3 },
                    { type: 'drift', pattern: 5, weight: 0.2 }
                ],
                suggestedThreshold: 35,
                durationEstimate: 3
            },
            {
                id: 'exploration',
                name: 'Exploration',
                description: 'Broad investigation of topics',
                indicators: [
                    { type: 'keyword', pattern: 'what|how|why|explore|curious', weight: 0.4 },
                    { type: 'operator', pattern: 'EXPLORE', weight: 0.3 }
                ],
                suggestedThreshold: 30,
                durationEstimate: 8
            },
            {
                id: 'deepening',
                name: 'Deepening',
                description: 'Going deeper into specific topics',
                indicators: [
                    { type: 'keyword', pattern: 'more|deeper|specifically|detail', weight: 0.4 },
                    { type: 'operator', pattern: 'DEEPEN', weight: 0.4 }
                ],
                suggestedThreshold: 25,
                durationEstimate: 10
            },
            {
                id: 'challenging',
                name: 'Challenging',
                description: 'Provocative or adversarial exchanges',
                indicators: [
                    { type: 'keyword', pattern: 'challenge|disagree|wrong|but', weight: 0.4 },
                    { type: 'frame', pattern: 'adversarial', weight: 0.5 }
                ],
                suggestedThreshold: 20,
                durationEstimate: 5
            },
            {
                id: 'synthesis',
                name: 'Synthesis',
                description: 'Integrating insights and conclusions',
                indicators: [
                    { type: 'keyword', pattern: 'conclude|summary|together|integrate', weight: 0.4 },
                    { type: 'operator', pattern: 'SYNTHESIZE', weight: 0.4 }
                ],
                suggestedThreshold: 35,
                durationEstimate: 4
            },
            {
                id: 'closing',
                name: 'Closing',
                description: 'Wrapping up the conversation',
                indicators: [
                    { type: 'keyword', pattern: 'thanks|goodbye|done|finished', weight: 0.5 },
                    { type: 'drift', pattern: 3, weight: 0.2 }
                ],
                suggestedThreshold: 40,
                durationEstimate: 2
            },
            {
                id: 'crisis',
                name: 'Crisis',
                description: 'Coherence is critically low',
                indicators: [
                    { type: 'drift', pattern: 60, weight: 0.8 }
                ],
                suggestedThreshold: 45,
                durationEstimate: 3
            },
            {
                id: 'recovery',
                name: 'Recovery',
                description: 'Recovering from crisis state',
                indicators: [
                    { type: 'drift', pattern: 40, weight: 0.3 },
                    { type: 'operator', pattern: 'STABILIZE', weight: 0.5 }
                ],
                suggestedThreshold: 40,
                durationEstimate: 5
            }
        ];
        for (const phase of phaseConfigs) {
            this.phases.set(phase.id, phase);
        }
    }
    /**
     * Initialize recovery strategies
     */
    initializeRecoveryStrategies() {
        const strategies = [
            {
                id: 'gradual',
                name: 'Gradual Recovery',
                applicablePhases: ['crisis', 'challenging'],
                steps: [
                    { order: 1, action: 'stabilize', thresholdAdjustment: 5, description: 'Apply STABILIZE operator' },
                    { order: 2, action: 'ground', thresholdAdjustment: 3, description: 'Ground in current frame' },
                    { order: 3, action: 'validate', thresholdAdjustment: 2, description: 'Validate coherence restoration' }
                ],
                successCriteria: { minCoherence: 40, maxDrift: 50, minTurns: 3 }
            },
            {
                id: 'aggressive',
                name: 'Aggressive Recovery',
                applicablePhases: ['crisis'],
                steps: [
                    { order: 1, action: 'reset_frame', thresholdAdjustment: 10, description: 'Reset to pragmatic frame' },
                    { order: 2, action: 'stabilize', thresholdAdjustment: 5, description: 'Intensive stabilization' }
                ],
                successCriteria: { minCoherence: 50, maxDrift: 40, minTurns: 2 }
            },
            {
                id: 'gentle',
                name: 'Gentle Recovery',
                applicablePhases: ['exploration', 'deepening'],
                steps: [
                    { order: 1, action: 'pause', thresholdAdjustment: 2, description: 'Pause transformation' },
                    { order: 2, action: 'reflect', thresholdAdjustment: 1, description: 'Reflect on current state' },
                    { order: 3, action: 'resume', thresholdAdjustment: -1, description: 'Gradually resume' }
                ],
                successCriteria: { minCoherence: 35, maxDrift: 55, minTurns: 4 }
            }
        ];
        for (const strategy of strategies) {
            this.recoveryStrategies.set(strategy.id, strategy);
        }
    }
    /**
     * Update threshold based on context
     */
    updateThreshold(context) {
        if (!this.config.enableDynamicThresholds) {
            return this.state;
        }
        // Detect current phase
        const detectedPhase = this.detectPhase(context);
        // Assess risk
        const risk = this.assessRisk(context);
        // Calculate new threshold
        const newThreshold = this.calculateThreshold(context, detectedPhase, risk);
        // Record adjustment if changed
        if (Math.abs(newThreshold - this.state.currentThreshold) > 0.5) {
            this.recordAdjustment(newThreshold, detectedPhase, risk.recommendation);
        }
        // Update state
        this.state.currentThreshold = newThreshold;
        this.state.phase = detectedPhase;
        this.state.riskLevel = risk.level;
        // Check if we need recovery
        if (risk.level === 'critical' || risk.level === 'high') {
            this.state.recoveryMode = true;
            this.stats.riskEvents++;
        }
        else if (this.state.recoveryMode && risk.level === 'low') {
            this.state.recoveryMode = false;
        }
        // Update stats
        this.stats.phaseDistribution[detectedPhase]++;
        if (this.state.recoveryMode) {
            this.stats.timeInRecovery++;
        }
        return this.state;
    }
    /**
     * Detect conversation phase
     */
    detectPhase(context) {
        const scores = {
            opening: 0,
            exploration: 0,
            deepening: 0,
            challenging: 0,
            synthesis: 0,
            closing: 0,
            crisis: 0,
            recovery: 0
        };
        // Check crisis condition first
        if (context.stance.cumulativeDrift > 70) {
            return 'crisis';
        }
        // Check if in recovery
        if (this.state.recoveryMode && context.stance.cumulativeDrift < 50) {
            return 'recovery';
        }
        // Score each phase based on indicators
        for (const [phaseType, phase] of this.phases) {
            for (const indicator of phase.indicators) {
                let score = 0;
                switch (indicator.type) {
                    case 'drift':
                        const driftThreshold = indicator.pattern;
                        if (context.stance.cumulativeDrift <= driftThreshold) {
                            score = indicator.weight;
                        }
                        break;
                    case 'frame':
                        if (context.stance.frame === indicator.pattern) {
                            score = indicator.weight;
                        }
                        break;
                    case 'operator':
                        if (context.operatorHistory.includes(indicator.pattern)) {
                            score = indicator.weight;
                        }
                        break;
                    case 'keyword':
                        // Would match against recent messages
                        score = indicator.weight * 0.5; // Base score
                        break;
                }
                scores[phaseType] += score;
            }
        }
        // Message count heuristics
        if (context.messageCount < 3) {
            scores.opening += 0.5;
        }
        else if (context.messageCount > 20) {
            scores.closing += 0.2;
        }
        // Find highest scoring phase
        let maxPhase = 'exploration';
        let maxScore = 0;
        for (const [phase, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxPhase = phase;
            }
        }
        this.state.phaseConfidence = Math.min(1, maxScore);
        return maxPhase;
    }
    /**
     * Assess risk level
     */
    assessRisk(context) {
        const factors = [];
        // Drift-based risk
        const driftRisk = context.stance.cumulativeDrift / 100;
        if (driftRisk > 0.5) {
            factors.push({
                name: 'High cumulative drift',
                severity: driftRisk,
                description: `Drift at ${context.stance.cumulativeDrift}%`
            });
        }
        // Recent drift acceleration
        if (context.recentDrift.length > 2) {
            const recentAvg = context.recentDrift.slice(-3).reduce((a, b) => a + b, 0) / 3;
            if (recentAvg > 5) {
                factors.push({
                    name: 'Drift acceleration',
                    severity: recentAvg / 10,
                    description: `Recent drift averaging ${recentAvg.toFixed(1)} per turn`
                });
            }
        }
        // Frame instability
        if (context.stance.turnsSinceLastShift < 2 && context.stance.turnsSinceLastShift > 0) {
            factors.push({
                name: 'Frame instability',
                severity: 0.4,
                description: 'Recent frame shift detected'
            });
        }
        // Calculate overall risk level
        const totalSeverity = factors.reduce((sum, f) => sum + f.severity, 0) / Math.max(factors.length, 1);
        let level;
        let suggestedAction;
        if (totalSeverity > 0.8) {
            level = 'critical';
            suggestedAction = 'recover';
        }
        else if (totalSeverity > 0.6) {
            level = 'high';
            suggestedAction = 'tighten';
        }
        else if (totalSeverity > 0.4) {
            level = 'elevated';
            suggestedAction = 'tighten';
        }
        else if (totalSeverity > 0.2) {
            level = 'moderate';
            suggestedAction = 'maintain';
        }
        else {
            level = 'low';
            suggestedAction = 'relax';
        }
        return {
            level,
            factors,
            recommendation: this.generateRecommendation(level, factors),
            suggestedAction
        };
    }
    /**
     * Generate risk recommendation
     */
    generateRecommendation(level, factors) {
        if (factors.length === 0) {
            return 'No significant risk factors detected. Continue normal operation.';
        }
        const topFactor = factors.reduce((a, b) => a.severity > b.severity ? a : b);
        switch (level) {
            case 'critical':
                return `Critical: ${topFactor.description}. Immediate recovery recommended.`;
            case 'high':
                return `High risk: ${topFactor.description}. Tighten coherence threshold.`;
            case 'elevated':
                return `Elevated: ${topFactor.description}. Monitor closely.`;
            case 'moderate':
                return `Moderate: ${topFactor.description}. Maintain current threshold.`;
            default:
                return 'Low risk. May relax threshold slightly.';
        }
    }
    /**
     * Calculate new threshold
     */
    calculateThreshold(_context, phase, risk) {
        const phaseConfig = this.phases.get(phase);
        const phaseSuggested = phaseConfig?.suggestedThreshold || this.config.baseCoherenceFloor;
        // Start with phase suggestion
        let threshold = phaseSuggested;
        // Adjust based on risk
        switch (risk.suggestedAction) {
            case 'tighten':
                threshold += 5 * this.config.riskSensitivity;
                break;
            case 'relax':
                threshold -= 3 * (1 - this.config.riskSensitivity);
                break;
            case 'recover':
                threshold += 10 * this.config.recoveryAggressiveness;
                break;
        }
        // Apply adaptation rate (smoothing)
        threshold = this.state.currentThreshold * (1 - this.config.adaptationRate) +
            threshold * this.config.adaptationRate;
        // Clamp to bounds
        return Math.max(this.config.minCoherenceFloor, Math.min(this.config.maxCoherenceFloor, threshold));
    }
    /**
     * Record threshold adjustment
     */
    recordAdjustment(newThreshold, phase, reason) {
        const adjustment = {
            timestamp: new Date(),
            previousThreshold: this.state.currentThreshold,
            newThreshold,
            reason,
            phase,
            triggerEvent: this.state.recoveryMode ? 'recovery' : 'adaptation'
        };
        this.state.history.push(adjustment);
        this.state.adjustmentReason = reason;
        this.stats.adjustmentCount++;
        // Update rolling average
        const n = this.stats.adjustmentCount;
        this.stats.averageThreshold = (this.stats.averageThreshold * (n - 1) + newThreshold) / n;
        // Keep history bounded
        if (this.state.history.length > 100) {
            this.state.history = this.state.history.slice(-50);
        }
    }
    /**
     * Get current threshold
     */
    getCurrentThreshold() {
        return this.state.currentThreshold;
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get recovery strategy
     */
    getRecoveryStrategy() {
        if (!this.state.recoveryMode)
            return null;
        for (const strategy of this.recoveryStrategies.values()) {
            if (strategy.applicablePhases.includes(this.state.phase)) {
                return strategy;
            }
        }
        return this.recoveryStrategies.get('gradual') || null;
    }
    /**
     * Check if coherence is below threshold
     */
    isCoherenceCritical(stance) {
        const coherence = 100 - stance.cumulativeDrift;
        return coherence < this.state.currentThreshold;
    }
    /**
     * Get adjustment history
     */
    getHistory(limit) {
        const history = [...this.state.history];
        return limit ? history.slice(-limit) : history;
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
        this.state = {
            currentThreshold: this.config.baseCoherenceFloor,
            baseThreshold: this.config.baseCoherenceFloor,
            phase: 'opening',
            phaseConfidence: 0.5,
            adjustmentReason: 'Reset',
            riskLevel: 'low',
            recoveryMode: false,
            history: []
        };
        this.stats = {
            adjustmentCount: 0,
            averageThreshold: this.config.baseCoherenceFloor,
            timeInRecovery: 0,
            phaseDistribution: {
                opening: 0,
                exploration: 0,
                deepening: 0,
                challenging: 0,
                synthesis: 0,
                closing: 0,
                crisis: 0,
                recovery: 0
            },
            riskEvents: 0
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const dynamicThresholds = new DynamicThresholdManager();
//# sourceMappingURL=dynamic-thresholds.js.map