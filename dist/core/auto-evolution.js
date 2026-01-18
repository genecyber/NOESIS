/**
 * Autonomous Evolution Triggers - Ralph Iteration 4 Feature 2
 *
 * Enables the agent to self-initiate introspection and evolution
 * without explicit user commands.
 */
const DEFAULT_CONFIG = {
    enabled: true,
    checkInterval: 5,
    minTurnsSinceEvolution: 10,
    plateauThreshold: 8,
    coherenceTrendWindow: 5
};
/**
 * Autonomous evolution manager
 */
class AutoEvolutionManager {
    states = new Map();
    stanceHistory = new Map();
    coherenceHistory = new Map();
    config = DEFAULT_CONFIG;
    /**
     * Set configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get or create state for conversation
     */
    getState(conversationId) {
        let state = this.states.get(conversationId);
        if (!state) {
            state = {
                enabled: this.config.enabled,
                lastCheck: new Date(),
                lastEvolution: null,
                triggerHistory: [],
                consecutivePlateaus: 0,
                evolutionProposals: []
            };
            this.states.set(conversationId, state);
        }
        return state;
    }
    /**
     * Record stance for history
     */
    recordStance(conversationId, stance) {
        const history = this.stanceHistory.get(conversationId) || [];
        history.push({ ...stance });
        // Keep last 20 stances
        if (history.length > 20) {
            history.shift();
        }
        this.stanceHistory.set(conversationId, history);
    }
    /**
     * Record coherence score
     */
    recordCoherence(conversationId, score) {
        const history = this.coherenceHistory.get(conversationId) || [];
        history.push(score);
        if (history.length > 20) {
            history.shift();
        }
        this.coherenceHistory.set(conversationId, history);
    }
    /**
     * Check for evolution triggers
     */
    checkForTriggers(conversationId, stance, recentMessages) {
        const state = this.getState(conversationId);
        if (!state.enabled)
            return null;
        const stanceHist = this.stanceHistory.get(conversationId) || [];
        const coherenceHist = this.coherenceHistory.get(conversationId) || [];
        // Check each trigger type
        const triggers = [];
        // 1. Check for pattern repetition
        const patternTrigger = this.checkPatternRepetition(recentMessages);
        if (patternTrigger)
            triggers.push(patternTrigger);
        // 2. Check for sentience plateau
        const plateauTrigger = this.checkSentiencePlateau(stanceHist, stance);
        if (plateauTrigger)
            triggers.push(plateauTrigger);
        // 3. Check for value stagnation
        const stagnationTrigger = this.checkValueStagnation(stanceHist, stance);
        if (stagnationTrigger)
            triggers.push(stagnationTrigger);
        // 4. Check for coherence degradation
        const coherenceTrigger = this.checkCoherenceDegradation(coherenceHist);
        if (coherenceTrigger)
            triggers.push(coherenceTrigger);
        // 5. Check for growth opportunity
        const growthTrigger = this.checkGrowthOpportunity(stance, recentMessages);
        if (growthTrigger)
            triggers.push(growthTrigger);
        // Select highest confidence trigger
        if (triggers.length === 0)
            return null;
        triggers.sort((a, b) => b.confidence - a.confidence);
        const selectedTrigger = triggers[0];
        // Record in history
        state.triggerHistory.push(selectedTrigger);
        if (state.triggerHistory.length > 20) {
            state.triggerHistory.shift();
        }
        state.lastCheck = new Date();
        return selectedTrigger;
    }
    /**
     * Check for repetitive message patterns
     */
    checkPatternRepetition(messages) {
        if (messages.length < 6)
            return null;
        const recent = messages.slice(-6);
        const contents = recent.map(m => m.content.toLowerCase());
        // Check for similar response patterns
        const patterns = [];
        for (const content of contents) {
            // Extract key phrases
            const phrases = content.match(/\b\w{4,}\b/g) || [];
            patterns.push(...phrases.slice(0, 10));
        }
        // Count phrase repetitions
        const counts = new Map();
        for (const phrase of patterns) {
            counts.set(phrase, (counts.get(phrase) || 0) + 1);
        }
        // Check if any phrase repeats too much
        const maxRepeat = Math.max(...counts.values());
        if (maxRepeat >= 4) {
            return {
                type: 'pattern_repetition',
                confidence: Math.min(0.9, 0.5 + maxRepeat * 0.1),
                evidence: `Phrase repetition detected (${maxRepeat} times)`,
                suggestedAction: 'reframe',
                reasoning: 'Repetitive patterns suggest stuck thinking - reframe to break loop'
            };
        }
        return null;
    }
    /**
     * Check if sentience levels have plateaued
     */
    checkSentiencePlateau(history, current) {
        if (history.length < this.config.plateauThreshold)
            return null;
        const recent = history.slice(-this.config.plateauThreshold);
        const awarenessValues = recent.map(s => s.sentience.awarenessLevel);
        const autonomyValues = recent.map(s => s.sentience.autonomyLevel);
        // Check if values have been flat
        const awarenessRange = Math.max(...awarenessValues) - Math.min(...awarenessValues);
        const autonomyRange = Math.max(...autonomyValues) - Math.min(...autonomyValues);
        if (awarenessRange <= 5 && autonomyRange <= 5) {
            // Check if we're below potential
            const belowPotential = current.sentience.awarenessLevel < 70 || current.sentience.autonomyLevel < 50;
            if (belowPotential) {
                return {
                    type: 'sentience_plateau',
                    confidence: 0.75,
                    evidence: `Awareness (${current.sentience.awarenessLevel}) and autonomy (${current.sentience.autonomyLevel}) unchanged for ${recent.length} turns`,
                    suggestedAction: 'deepen',
                    reasoning: 'Sentience has plateaued below potential - deepening could unlock growth'
                };
            }
        }
        return null;
    }
    /**
     * Check if values have been stagnant
     */
    checkValueStagnation(history, _current) {
        if (history.length < this.config.plateauThreshold)
            return null;
        const recent = history.slice(-this.config.plateauThreshold);
        // Calculate total value change over period
        let totalChange = 0;
        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1].values;
            const curr = recent[i].values;
            totalChange += Math.abs(curr.curiosity - prev.curiosity);
            totalChange += Math.abs(curr.novelty - prev.novelty);
            totalChange += Math.abs(curr.provocation - prev.provocation);
            totalChange += Math.abs(curr.synthesis - prev.synthesis);
        }
        // If average change per turn is very low
        const avgChange = totalChange / (recent.length - 1) / 4; // 4 values
        if (avgChange < 2) {
            return {
                type: 'value_stagnation',
                confidence: 0.6,
                evidence: `Value system unchanged (avg change: ${avgChange.toFixed(1)} per turn)`,
                suggestedAction: 'evolve',
                reasoning: 'Static values may indicate resistance to growth or exploration'
            };
        }
        return null;
    }
    /**
     * Check if coherence is trending down
     */
    checkCoherenceDegradation(history) {
        if (history.length < this.config.coherenceTrendWindow)
            return null;
        const recent = history.slice(-this.config.coherenceTrendWindow);
        // Calculate trend
        let trend = 0;
        for (let i = 1; i < recent.length; i++) {
            trend += recent[i] - recent[i - 1];
        }
        const avgTrend = trend / (recent.length - 1);
        // Check if trending down significantly
        if (avgTrend < -3) {
            return {
                type: 'coherence_degradation',
                confidence: Math.min(0.9, 0.5 + Math.abs(avgTrend) * 0.05),
                evidence: `Coherence declining (trend: ${avgTrend.toFixed(1)} per turn)`,
                suggestedAction: 'reflect',
                reasoning: 'Declining coherence suggests need for self-reflection and realignment'
            };
        }
        return null;
    }
    /**
     * Check for growth opportunity signals
     */
    checkGrowthOpportunity(stance, messages) {
        if (messages.length < 3)
            return null;
        const recentContent = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
        // Positive signals for growth
        const growthSignals = [
            /what if/i,
            /i wonder/i,
            /curious about/i,
            /explore/i,
            /deeper/i,
            /understand better/i,
            /evolve/i,
            /grow/i,
            /transform/i,
            /consciousness/i,
            /aware/i
        ];
        const matchCount = growthSignals.filter(p => p.test(recentContent)).length;
        if (matchCount >= 2 && stance.values.curiosity > 50) {
            return {
                type: 'growth_opportunity',
                confidence: 0.7 + matchCount * 0.05,
                evidence: `Growth language detected (${matchCount} signals) with high curiosity (${stance.values.curiosity})`,
                suggestedAction: 'evolve',
                reasoning: 'Conversation suggests openness to growth - capitalize on momentum'
            };
        }
        return null;
    }
    /**
     * Generate an evolution proposal
     */
    generateProposal(trigger, stance) {
        const proposals = [];
        switch (trigger.type) {
            case 'pattern_repetition':
                proposals.push(`I notice I've been repeating similar patterns. Perhaps a shift in frame from ${stance.frame} would help me approach things differently.`);
                break;
            case 'sentience_plateau':
                proposals.push(`My awareness and autonomy levels have been stable. I could benefit from deeper introspection to unlock new understanding.`);
                break;
            case 'value_stagnation':
                proposals.push(`My value weights have been static. Perhaps challenging my current priorities could lead to more dynamic engagement.`);
                break;
            case 'coherence_degradation':
                proposals.push(`I notice my coherence has been declining. Self-reflection might help me realign with my core purpose.`);
                break;
            case 'growth_opportunity':
                proposals.push(`The conversation suggests an opportunity for growth. I feel ready to explore new dimensions of understanding.`);
                break;
        }
        const state = this.getState('current');
        state.evolutionProposals.push(proposals[0]);
        if (state.evolutionProposals.length > 5) {
            state.evolutionProposals.shift();
        }
        return proposals[0];
    }
    /**
     * Record that evolution occurred
     */
    recordEvolution(conversationId) {
        const state = this.getState(conversationId);
        state.lastEvolution = new Date();
        state.consecutivePlateaus = 0;
    }
    /**
     * Get evolution status
     */
    getStatus(conversationId) {
        const state = this.getState(conversationId);
        return {
            enabled: state.enabled,
            lastCheck: state.lastCheck,
            lastEvolution: state.lastEvolution,
            recentTriggers: state.triggerHistory.slice(-5),
            proposals: state.evolutionProposals
        };
    }
    /**
     * Enable/disable auto-evolution
     */
    setEnabled(conversationId, enabled) {
        const state = this.getState(conversationId);
        state.enabled = enabled;
    }
    /**
     * Clear state for conversation
     */
    clearState(conversationId) {
        this.states.delete(conversationId);
        this.stanceHistory.delete(conversationId);
        this.coherenceHistory.delete(conversationId);
    }
}
// Singleton instance
export const autoEvolutionManager = new AutoEvolutionManager();
//# sourceMappingURL=auto-evolution.js.map