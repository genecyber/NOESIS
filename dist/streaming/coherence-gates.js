/**
 * Adaptive Response Streaming with Coherence Gates - Ralph Iteration 5 Feature 5
 *
 * Provides real-time coherence monitoring during token generation,
 * with early termination and automatic regeneration of problematic segments.
 */
const DEFAULT_CONFIG = {
    enabled: true,
    minCoherence: 0.3,
    warningThreshold: 0.5,
    maxBacktracks: 3,
    windowSize: 20,
    localWeight: 0.6,
    globalWeight: 0.4,
    earlyTerminationEnabled: true,
    visualizationEnabled: true
};
/**
 * Pattern matchers for coherence analysis
 */
const INCOHERENCE_PATTERNS = {
    repetition: /(.{10,})\1{2,}/g,
    contradictions: /\b(but|however|although)\b.*\b(always|never|definitely)\b/gi,
    tangents: /\b(anyway|speaking of|by the way|random thought)\b/gi,
    uncertainty: /\b(maybe|perhaps|possibly|might|could be)\b/gi,
    filler: /\b(um|uh|like|you know|I mean)\b/gi,
    hallucination: /\b(as (I|we) (discussed|mentioned)|earlier you said)\b/gi
};
/**
 * Coherence Gate Manager
 */
class CoherenceGateManager {
    config = DEFAULT_CONFIG;
    state = null;
    stance = null;
    conversationContext = '';
    recentTokens = [];
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
     * Initialize streaming state for new response
     */
    initializeStream(stance, context) {
        this.stance = stance;
        this.conversationContext = context;
        this.recentTokens = [];
        this.state = {
            tokens: [],
            currentScore: 1.0,
            movingAverage: 1.0,
            warningCount: 0,
            backtrackCount: 0,
            isHealthy: true,
            coherenceWave: []
        };
        return this.state;
    }
    /**
     * Process a new token through coherence gates
     */
    processToken(token) {
        if (!this.state || !this.config.enabled) {
            // Disabled - pass everything through
            const coherence = {
                token,
                position: this.state?.tokens.length || 0,
                localScore: 1.0,
                globalScore: 1.0,
                combinedScore: 1.0,
                flags: []
            };
            return {
                coherence,
                gate: { passed: true, score: 1.0, action: 'continue' }
            };
        }
        // Add token to recent buffer
        this.recentTokens.push(token);
        if (this.recentTokens.length > 50) {
            this.recentTokens.shift();
        }
        // Calculate coherence scores
        const localScore = this.calculateLocalCoherence(token);
        const globalScore = this.calculateGlobalCoherence(token);
        const combinedScore = localScore * this.config.localWeight +
            globalScore * this.config.globalWeight;
        // Detect coherence flags
        const flags = this.detectCoherenceFlags(token);
        const coherence = {
            token,
            position: this.state.tokens.length,
            localScore,
            globalScore,
            combinedScore,
            flags
        };
        this.state.tokens.push(coherence);
        this.state.currentScore = combinedScore;
        // Update moving average
        this.updateMovingAverage(combinedScore);
        // Update coherence wave for visualization
        this.state.coherenceWave.push(combinedScore);
        if (this.state.coherenceWave.length > 100) {
            this.state.coherenceWave.shift();
        }
        // Evaluate gate
        const gate = this.evaluateGate(coherence);
        // Update state health
        this.state.isHealthy = gate.passed && this.state.warningCount < 3;
        return { coherence, gate };
    }
    /**
     * Calculate local coherence (with immediate context)
     */
    calculateLocalCoherence(token) {
        const recentText = this.recentTokens.join('');
        let score = 1.0;
        // Check for immediate repetition
        if (this.recentTokens.length > 1) {
            const lastToken = this.recentTokens[this.recentTokens.length - 2];
            if (token === lastToken) {
                score -= 0.2;
            }
        }
        // Check for phrase repetition
        if (INCOHERENCE_PATTERNS.repetition.test(recentText + token)) {
            score -= 0.3;
        }
        // Check syntactic coherence (simple heuristic)
        if (this.hasIncoherentSyntax(token)) {
            score -= 0.2;
        }
        // Check for abrupt topic shifts
        if (INCOHERENCE_PATTERNS.tangents.test(token)) {
            score -= 0.15;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate global coherence (with overall conversation)
     */
    calculateGlobalCoherence(token) {
        let score = 1.0;
        const fullResponse = this.state?.tokens.map(t => t.token).join('') + token;
        // Check for contradictions with context
        if (this.detectContradictions(fullResponse)) {
            score -= 0.3;
        }
        // Check stance alignment
        if (this.stance && this.detectStanceViolation(token)) {
            score -= 0.2;
        }
        // Check for hallucination patterns
        if (INCOHERENCE_PATTERNS.hallucination.test(fullResponse)) {
            score -= 0.4;
        }
        // Check topic relevance
        const topicRelevance = this.calculateTopicRelevance(fullResponse);
        score = score * 0.7 + topicRelevance * 0.3;
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Detect coherence flags
     */
    detectCoherenceFlags(token) {
        const flags = [];
        const recentText = this.recentTokens.join('');
        if (INCOHERENCE_PATTERNS.repetition.test(recentText + token)) {
            flags.push('repetition');
        }
        if (INCOHERENCE_PATTERNS.contradictions.test(recentText + token)) {
            flags.push('contradiction');
        }
        if (INCOHERENCE_PATTERNS.tangents.test(token)) {
            flags.push('topic_drift');
        }
        if (INCOHERENCE_PATTERNS.hallucination.test(recentText + token)) {
            flags.push('hallucination_risk');
        }
        if (this.hasIncoherentSyntax(token)) {
            flags.push('incoherent_syntax');
        }
        if (this.stance && this.detectStanceViolation(token)) {
            flags.push('stance_violation');
        }
        return flags;
    }
    /**
     * Check for incoherent syntax
     */
    hasIncoherentSyntax(token) {
        // Simplified syntax checks
        const lastToken = this.recentTokens[this.recentTokens.length - 1];
        if (!lastToken)
            return false;
        // Double punctuation
        if (/[.!?]/.test(lastToken) && /^[.!?,]/.test(token)) {
            return true;
        }
        // Unclosed structures
        const recentText = this.recentTokens.slice(-10).join('');
        const openParens = (recentText.match(/\(/g) || []).length;
        const closeParens = (recentText.match(/\)/g) || []).length;
        if (Math.abs(openParens - closeParens) > 2) {
            return true;
        }
        return false;
    }
    /**
     * Detect contradictions with context
     */
    detectContradictions(text) {
        // Check for explicit contradiction patterns
        if (INCOHERENCE_PATTERNS.contradictions.test(text)) {
            return true;
        }
        // Check for self-contradiction in response
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length < 2)
            return false;
        // Simple negation detection
        for (let i = 0; i < sentences.length - 1; i++) {
            for (let j = i + 1; j < sentences.length; j++) {
                if (this.sentencesContradict(sentences[i], sentences[j])) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Check if two sentences contradict
     */
    sentencesContradict(s1, s2) {
        const negations = ['not', "n't", 'never', 'no', 'none', 'nobody', 'nothing'];
        // Simple heuristic: same key words but one negated
        const words1 = new Set(s1.toLowerCase().split(/\s+/));
        const words2 = new Set(s2.toLowerCase().split(/\s+/));
        const hasNeg1 = negations.some(n => words1.has(n));
        const hasNeg2 = negations.some(n => words2.has(n));
        if (hasNeg1 !== hasNeg2) {
            // Check for significant overlap
            const overlap = Array.from(words1).filter(w => words2.has(w) && w.length > 3);
            if (overlap.length >= 2) {
                return true;
            }
        }
        return false;
    }
    /**
     * Detect stance violations
     */
    detectStanceViolation(token) {
        if (!this.stance)
            return false;
        const recentText = this.recentTokens.slice(-20).join('').toLowerCase() + token.toLowerCase();
        // Check frame consistency
        if (this.stance.frame === 'pragmatic' && /\b(mystical|spiritual|transcendent)\b/.test(recentText)) {
            return true;
        }
        if (this.stance.frame === 'poetic' && /\b(technically|specifically|precisely)\b/.test(recentText)) {
            return true;
        }
        // Check value alignment
        if (this.stance.values.empathy > 70 && /\b(who cares|doesn't matter|irrelevant)\b/.test(recentText)) {
            return true;
        }
        if (this.stance.values.certainty > 70 && /\b(maybe|perhaps|uncertain)\b/.test(recentText)) {
            return true;
        }
        return false;
    }
    /**
     * Calculate topic relevance
     */
    calculateTopicRelevance(text) {
        if (!this.conversationContext)
            return 1.0;
        // Extract key terms from context
        const contextWords = new Set(this.conversationContext.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4));
        // Extract key terms from response
        const responseWords = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        if (responseWords.length === 0)
            return 1.0;
        // Calculate overlap
        const overlap = responseWords.filter(w => contextWords.has(w)).length;
        const relevance = Math.min(1, overlap / Math.max(5, responseWords.length * 0.3));
        return 0.5 + relevance * 0.5; // Baseline of 0.5
    }
    /**
     * Update moving average
     */
    updateMovingAverage(score) {
        if (!this.state)
            return;
        const windowSize = Math.min(this.config.windowSize, this.state.tokens.length);
        if (windowSize === 0) {
            this.state.movingAverage = score;
            return;
        }
        const recentScores = this.state.tokens
            .slice(-windowSize)
            .map(t => t.combinedScore);
        this.state.movingAverage =
            recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
    }
    /**
     * Evaluate coherence gate
     */
    evaluateGate(coherence) {
        if (!this.state) {
            return { passed: true, score: coherence.combinedScore, action: 'continue' };
        }
        const score = this.state.movingAverage;
        // Check for critical flags
        if (coherence.flags.includes('hallucination_risk')) {
            this.state.warningCount++;
            if (this.config.earlyTerminationEnabled && this.state.backtrackCount >= this.config.maxBacktracks) {
                return {
                    passed: false,
                    score,
                    reason: 'Hallucination risk detected, max backtracks exceeded',
                    action: 'terminate'
                };
            }
            return {
                passed: false,
                score,
                reason: 'Hallucination risk detected',
                action: 'backtrack',
                backtrackTo: this.findBacktrackPoint()
            };
        }
        // Below minimum threshold
        if (score < this.config.minCoherence) {
            this.state.warningCount++;
            if (this.config.earlyTerminationEnabled && this.state.backtrackCount >= this.config.maxBacktracks) {
                return {
                    passed: false,
                    score,
                    reason: 'Coherence below minimum threshold, max backtracks exceeded',
                    action: 'terminate'
                };
            }
            this.state.backtrackCount++;
            return {
                passed: false,
                score,
                reason: 'Coherence dropped below minimum threshold',
                action: 'backtrack',
                backtrackTo: this.findBacktrackPoint()
            };
        }
        // Warning threshold
        if (score < this.config.warningThreshold) {
            this.state.warningCount++;
            return {
                passed: true,
                score,
                reason: 'Coherence below warning threshold',
                action: 'warn'
            };
        }
        // All good
        return { passed: true, score, action: 'continue' };
    }
    /**
     * Find optimal backtrack point
     */
    findBacktrackPoint() {
        if (!this.state || this.state.tokens.length === 0)
            return 0;
        // Find the last point where coherence was good
        for (let i = this.state.tokens.length - 1; i >= 0; i--) {
            if (this.state.tokens[i].combinedScore > this.config.warningThreshold) {
                // Backtrack to just after this good point
                return i + 1;
            }
        }
        // If no good point found, backtrack to beginning
        return 0;
    }
    /**
     * Execute backtrack
     */
    backtrack(toPosition) {
        if (!this.state)
            return '';
        // Remove tokens after backtrack point
        this.state.tokens.splice(toPosition);
        // Update recent tokens buffer
        this.recentTokens = this.state.tokens.slice(-50).map(t => t.token);
        // Recalculate state
        if (this.state.tokens.length > 0) {
            this.state.currentScore = this.state.tokens[this.state.tokens.length - 1].combinedScore;
            this.updateMovingAverage(this.state.currentScore);
        }
        else {
            this.state.currentScore = 1.0;
            this.state.movingAverage = 1.0;
        }
        // Update coherence wave
        this.state.coherenceWave = this.state.tokens.slice(-100).map(t => t.combinedScore);
        // Return the valid response so far
        return this.state.tokens.map(t => t.token).join('');
    }
    /**
     * Get current streaming state
     */
    getState() {
        return this.state ? { ...this.state } : null;
    }
    /**
     * Get coherence visualization data
     */
    getVisualizationData() {
        if (!this.state || !this.config.visualizationEnabled)
            return null;
        // Count flags
        const flagCounts = {
            topic_drift: 0,
            tone_shift: 0,
            contradiction: 0,
            repetition: 0,
            incoherent_syntax: 0,
            stance_violation: 0,
            hallucination_risk: 0
        };
        for (const token of this.state.tokens) {
            for (const flag of token.flags) {
                flagCounts[flag]++;
            }
        }
        // Determine health
        let health;
        if (this.state.movingAverage >= this.config.warningThreshold) {
            health = 'good';
        }
        else if (this.state.movingAverage >= this.config.minCoherence) {
            health = 'warning';
        }
        else {
            health = 'critical';
        }
        return {
            wave: [...this.state.coherenceWave],
            average: this.state.movingAverage,
            health,
            flagCounts
        };
    }
    /**
     * Generate inline coherence indicator for CLI
     */
    getInlineIndicator() {
        if (!this.state || !this.config.visualizationEnabled)
            return '';
        const score = this.state.movingAverage;
        if (score >= 0.8)
            return '\x1b[32m●\x1b[0m'; // Green
        if (score >= 0.6)
            return '\x1b[33m●\x1b[0m'; // Yellow
        if (score >= 0.4)
            return '\x1b[31m●\x1b[0m'; // Red
        return '\x1b[31m○\x1b[0m'; // Red hollow
    }
    /**
     * Get predictive coherence warning before response
     */
    getPredictiveWarning(context) {
        if (!this.config.enabled)
            return null;
        // Analyze context for potential coherence risks
        const risks = [];
        // Check for complex multi-topic context
        const sentences = context.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 10) {
            risks.push('Long context may increase topic drift risk');
        }
        // Check for contradictory instructions
        if (/\b(but also|while also|yet)\b/.test(context)) {
            risks.push('Conflicting requirements detected');
        }
        // Check for abstract concepts
        if (/\b(meaning|consciousness|existence|truth)\b/i.test(context)) {
            risks.push('Abstract concepts may challenge coherence');
        }
        if (risks.length === 0)
            return null;
        return `Coherence risks: ${risks.join('; ')}`;
    }
    /**
     * Finalize stream and return summary
     */
    finalizeStream() {
        if (!this.state)
            return null;
        const vis = this.getVisualizationData();
        const result = {
            success: this.state.isHealthy,
            finalScore: this.state.movingAverage,
            tokenCount: this.state.tokens.length,
            backtrackCount: this.state.backtrackCount,
            warningCount: this.state.warningCount,
            flagSummary: vis?.flagCounts || {}
        };
        // Clear state
        this.state = null;
        this.recentTokens = [];
        return result;
    }
}
// Singleton instance
export const coherenceGates = new CoherenceGateManager();
//# sourceMappingURL=coherence-gates.js.map