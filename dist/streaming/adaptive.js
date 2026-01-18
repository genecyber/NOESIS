/**
 * Adaptive Response Streaming (Ralph Iteration 7, Feature 5)
 *
 * Token-level confidence scoring, dynamic generation parameters,
 * early termination, backtracking, and streaming coherence visualization.
 */
// ============================================================================
// Adaptive Streaming Controller
// ============================================================================
export class AdaptiveStreamingController {
    config;
    state;
    handlers = new Set();
    stats;
    constructor(config = {}) {
        this.config = {
            confidenceThreshold: 0.5,
            earlyTerminationThreshold: 0.95,
            backtrackingEnabled: true,
            maxBacktrackTokens: 50,
            coherenceCheckInterval: 20,
            dynamicTemperature: true,
            baseTemperature: 0.7,
            minTemperature: 0.1,
            maxTemperature: 1.5,
            ...config
        };
        this.state = this.createInitialState();
        this.stats = this.createInitialStats();
    }
    /**
     * Create initial state
     */
    createInitialState() {
        return {
            segments: [],
            currentSegment: null,
            totalTokens: 0,
            avgConfidence: 0,
            coherenceHistory: [],
            backtrackCount: 0,
            earlyTerminated: false,
            dynamicParams: {
                temperature: this.config.baseTemperature,
                topP: 0.95,
                topK: 40,
                presencePenalty: 0,
                frequencyPenalty: 0
            }
        };
    }
    /**
     * Create initial stats
     */
    createInitialStats() {
        return {
            totalTokens: 0,
            avgConfidence: 0,
            segmentsCompleted: 0,
            backtrackCount: 0,
            earlyTerminations: 0,
            avgCoherence: 0,
            temperatureAdjustments: 0
        };
    }
    /**
     * Start a new streaming session
     */
    startStream() {
        this.state = this.createInitialState();
        this.startNewSegment();
    }
    /**
     * Start a new segment
     */
    startNewSegment() {
        this.state.currentSegment = {
            id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tokens: [],
            avgConfidence: 0,
            coherenceScore: 1,
            revised: false
        };
    }
    /**
     * Process a new token
     */
    processToken(token, logProb, alternatives = []) {
        const confidence = this.calculateConfidence(logProb);
        const tokenConfidence = {
            token,
            confidence,
            logProb,
            alternatives: alternatives.map(a => ({
                token: a.token,
                confidence: this.calculateConfidence(a.logProb)
            })),
            timestamp: Date.now()
        };
        // Emit token event
        this.emit({ type: 'token', data: tokenConfidence, timestamp: Date.now() });
        // Update state
        this.state.totalTokens++;
        this.updateAvgConfidence(confidence);
        // Add to current segment
        if (this.state.currentSegment) {
            this.state.currentSegment.tokens.push(tokenConfidence);
            this.updateSegmentConfidence();
        }
        // Check for early termination
        if (this.shouldTerminateEarly()) {
            this.terminateStream();
            return { accepted: true, shouldBacktrack: false, shouldTerminate: true };
        }
        // Check for backtracking
        if (this.shouldBacktrack(confidence)) {
            return { accepted: false, shouldBacktrack: true, shouldTerminate: false };
        }
        // Check coherence periodically
        if (this.state.totalTokens % this.config.coherenceCheckInterval === 0) {
            this.checkCoherence();
        }
        // Update dynamic parameters
        if (this.config.dynamicTemperature) {
            this.adjustDynamicParams(confidence);
        }
        return { accepted: confidence >= this.config.confidenceThreshold, shouldBacktrack: false, shouldTerminate: false };
    }
    /**
     * Calculate confidence from log probability
     */
    calculateConfidence(logProb) {
        // Convert log probability to confidence (0-1)
        // logProb is typically negative, closer to 0 = higher confidence
        return Math.exp(logProb);
    }
    /**
     * Update running average confidence
     */
    updateAvgConfidence(newConfidence) {
        const oldTotal = this.state.avgConfidence * (this.state.totalTokens - 1);
        this.state.avgConfidence = (oldTotal + newConfidence) / this.state.totalTokens;
    }
    /**
     * Update segment confidence
     */
    updateSegmentConfidence() {
        if (!this.state.currentSegment)
            return;
        const tokens = this.state.currentSegment.tokens;
        if (tokens.length === 0)
            return;
        this.state.currentSegment.avgConfidence =
            tokens.reduce((sum, t) => sum + t.confidence, 0) / tokens.length;
    }
    /**
     * Check if we should terminate early
     */
    shouldTerminateEarly() {
        if (this.state.totalTokens < 10)
            return false;
        // High sustained confidence
        const recentTokens = this.state.currentSegment?.tokens.slice(-5) || [];
        const avgRecent = recentTokens.reduce((s, t) => s + t.confidence, 0) / recentTokens.length;
        return avgRecent >= this.config.earlyTerminationThreshold;
    }
    /**
     * Check if we should backtrack
     */
    shouldBacktrack(currentConfidence) {
        if (!this.config.backtrackingEnabled)
            return false;
        if (!this.state.currentSegment)
            return false;
        const tokens = this.state.currentSegment.tokens;
        if (tokens.length < 5)
            return false;
        // Check for sustained low confidence
        const recentTokens = tokens.slice(-5);
        const avgRecent = recentTokens.reduce((s, t) => s + t.confidence, 0) / recentTokens.length;
        return avgRecent < this.config.confidenceThreshold * 0.7 &&
            currentConfidence < this.config.confidenceThreshold;
    }
    /**
     * Perform backtracking
     */
    backtrack(tokensToRemove = 10) {
        if (!this.state.currentSegment)
            return [];
        const actualRemove = Math.min(tokensToRemove, this.config.maxBacktrackTokens, this.state.currentSegment.tokens.length);
        // Store original for visualization
        if (!this.state.currentSegment.originalContent) {
            this.state.currentSegment.originalContent =
                this.state.currentSegment.tokens.map(t => t.token).join('');
        }
        // Remove tokens
        const removed = this.state.currentSegment.tokens.splice(-actualRemove);
        this.state.currentSegment.revised = true;
        this.state.backtrackCount++;
        this.stats.backtrackCount++;
        // Emit backtrack event
        this.emit({
            type: 'backtrack',
            data: { tokensRemoved: actualRemove, removedContent: removed.map(t => t.token).join('') },
            timestamp: Date.now()
        });
        // Adjust parameters to increase exploration
        this.state.dynamicParams.temperature = Math.min(this.config.maxTemperature, this.state.dynamicParams.temperature * 1.2);
        return removed.map(t => t.token);
    }
    /**
     * Complete current segment
     */
    completeSegment() {
        if (!this.state.currentSegment)
            return null;
        if (this.state.currentSegment.tokens.length === 0)
            return null;
        const segment = this.state.currentSegment;
        this.state.segments.push(segment);
        this.stats.segmentsCompleted++;
        // Emit segment complete event
        this.emit({
            type: 'segment_complete',
            data: segment,
            timestamp: Date.now()
        });
        // Start new segment
        this.startNewSegment();
        return segment;
    }
    /**
     * Terminate the stream
     */
    terminateStream() {
        this.state.earlyTerminated = true;
        this.stats.earlyTerminations++;
        // Complete any pending segment
        this.completeSegment();
        this.emit({
            type: 'terminate',
            data: { reason: 'early_termination', confidence: this.state.avgConfidence },
            timestamp: Date.now()
        });
    }
    /**
     * Check coherence of current content
     */
    checkCoherence() {
        if (!this.state.currentSegment)
            return;
        const tokens = this.state.currentSegment.tokens;
        if (tokens.length < 5)
            return;
        // Simple coherence check based on confidence patterns
        const recentConfidences = tokens.slice(-10).map(t => t.confidence);
        // Coherence drops if confidence becomes erratic
        const variance = this.calculateVariance(recentConfidences);
        const coherence = Math.max(0, 1 - variance * 2);
        this.state.currentSegment.coherenceScore = coherence;
        this.state.coherenceHistory.push({
            position: this.state.totalTokens,
            score: coherence
        });
        // Update average coherence
        const totalCoherence = this.state.coherenceHistory.reduce((s, h) => s + h.score, 0);
        this.stats.avgCoherence = totalCoherence / this.state.coherenceHistory.length;
    }
    /**
     * Calculate variance of array
     */
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((s, v) => s + v, 0) / values.length;
    }
    /**
     * Adjust dynamic parameters based on context
     */
    adjustDynamicParams(currentConfidence) {
        const oldTemp = this.state.dynamicParams.temperature;
        if (currentConfidence > 0.8) {
            // High confidence - can be more creative
            this.state.dynamicParams.temperature = Math.min(this.config.maxTemperature, this.state.dynamicParams.temperature * 1.05);
        }
        else if (currentConfidence < 0.4) {
            // Low confidence - be more conservative
            this.state.dynamicParams.temperature = Math.max(this.config.minTemperature, this.state.dynamicParams.temperature * 0.95);
        }
        // Adjust top-p based on confidence
        this.state.dynamicParams.topP = 0.9 + (currentConfidence * 0.1);
        if (Math.abs(oldTemp - this.state.dynamicParams.temperature) > 0.01) {
            this.stats.temperatureAdjustments++;
            this.emit({
                type: 'params_adjust',
                data: { ...this.state.dynamicParams },
                timestamp: Date.now()
            });
        }
    }
    /**
     * Get dynamic generation parameters adjusted for context
     */
    getGenerationParams(stance, config) {
        const params = { ...this.state.dynamicParams };
        // Adjust based on stance
        if (stance.frame === 'playful' || stance.frame === 'absurdist') {
            params.temperature = Math.min(this.config.maxTemperature, params.temperature * 1.2);
        }
        else if (stance.frame === 'pragmatic' || stance.frame === 'stoic') {
            params.temperature = Math.max(this.config.minTemperature, params.temperature * 0.8);
        }
        // Adjust based on transformation intensity
        params.temperature *= (0.5 + (config.intensity / 100));
        // Clamp values
        params.temperature = Math.max(this.config.minTemperature, Math.min(this.config.maxTemperature, params.temperature));
        return params;
    }
    /**
     * Get coherence visualization data
     */
    getCoherenceVisualization() {
        return this.state.coherenceHistory.map((h) => ({
            position: h.position,
            score: h.score,
            context: this.getContextAtPosition(h.position),
            issues: h.score < 0.5 ? ['Low coherence detected'] : []
        }));
    }
    /**
     * Get context around a position
     */
    getContextAtPosition(position) {
        let tokenCount = 0;
        for (const segment of this.state.segments) {
            for (const token of segment.tokens) {
                tokenCount++;
                if (tokenCount >= position - 5 && tokenCount <= position + 5) {
                    return segment.tokens.slice(Math.max(0, segment.tokens.indexOf(token) - 5), segment.tokens.indexOf(token) + 5).map(t => t.token).join('');
                }
            }
        }
        return '';
    }
    /**
     * Subscribe to stream events
     */
    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    /**
     * Emit event to handlers
     */
    emit(event) {
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch {
                // Ignore handler errors
            }
        }
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalTokens: this.state.totalTokens,
            avgConfidence: this.state.avgConfidence
        };
    }
    /**
     * Get all segments
     */
    getSegments() {
        return [...this.state.segments];
    }
    /**
     * Get full generated content
     */
    getContent() {
        return this.state.segments
            .flatMap(s => s.tokens)
            .map(t => t.token)
            .join('');
    }
    /**
     * Analyze streaming performance
     */
    analyze() {
        const confidences = this.state.segments
            .flatMap(s => s.tokens)
            .map(t => t.confidence);
        // Distribution
        const distribution = {
            'very_low': 0,
            'low': 0,
            'medium': 0,
            'high': 0,
            'very_high': 0
        };
        for (const c of confidences) {
            if (c < 0.2)
                distribution['very_low']++;
            else if (c < 0.4)
                distribution['low']++;
            else if (c < 0.6)
                distribution['medium']++;
            else if (c < 0.8)
                distribution['high']++;
            else
                distribution['very_high']++;
        }
        // Normalize
        const total = confidences.length || 1;
        for (const key of Object.keys(distribution)) {
            distribution[key] = distribution[key] / total;
        }
        // Coherence trend
        const history = this.state.coherenceHistory;
        let trend = 'stable';
        if (history.length >= 3) {
            const firstHalf = history.slice(0, Math.floor(history.length / 2));
            const secondHalf = history.slice(Math.floor(history.length / 2));
            const firstAvg = firstHalf.reduce((s, h) => s + h.score, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((s, h) => s + h.score, 0) / secondHalf.length;
            if (secondAvg > firstAvg + 0.1)
                trend = 'improving';
            else if (secondAvg < firstAvg - 0.1)
                trend = 'declining';
        }
        // Recommendations
        const recommendations = [];
        if (distribution['very_low'] + distribution['low'] > 0.3) {
            recommendations.push('Consider reducing temperature for more focused outputs');
        }
        if (this.stats.backtrackCount > this.state.segments.length) {
            recommendations.push('High backtrack rate - prompt may need refinement');
        }
        if (trend === 'declining') {
            recommendations.push('Coherence declining - consider shorter outputs or clearer prompts');
        }
        return {
            avgConfidence: this.state.avgConfidence,
            confidenceDistribution: distribution,
            backtrackRate: this.stats.backtrackCount / (this.state.segments.length || 1),
            coherenceTrend: trend,
            recommendations
        };
    }
    /**
     * Reset controller
     */
    reset() {
        this.state = this.createInitialState();
        this.stats = this.createInitialStats();
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const adaptiveStreaming = new AdaptiveStreamingController();
//# sourceMappingURL=adaptive.js.map