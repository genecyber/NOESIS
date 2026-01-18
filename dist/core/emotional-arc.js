/**
 * Emotional Arc Tracking - Ralph Iteration 3 Feature 6
 *
 * Tracks conversation emotional trajectory and detects patterns
 * that may warrant transformation interventions.
 */
/**
 * Emotional markers in text
 */
const EMOTION_MARKERS = {
    positive: {
        words: ['happy', 'great', 'wonderful', 'excited', 'love', 'amazing', 'fantastic', 'joy', 'delight', 'pleased', 'grateful', 'hopeful', 'optimistic'],
        patterns: [/!\s*$/, /:\)/, /thank/i, /appreciate/i, /glad/i, /excellent/i]
    },
    negative: {
        words: ['sad', 'angry', 'frustrated', 'annoyed', 'disappointed', 'worried', 'anxious', 'upset', 'hate', 'terrible', 'awful', 'problem', 'issue', 'wrong'],
        patterns: [/:\(/, /ugh/i, /argh/i, /unfortunately/i, /sadly/i, /bad/i, /fail/i, /error/i]
    },
    high_arousal: {
        words: ['urgent', 'emergency', 'critical', 'immediately', 'asap', 'now', 'hurry', 'quick', 'fast', 'exciting'],
        patterns: [/!+/, /\?+/, /CAPS/, /urgent/i]
    },
    low_arousal: {
        words: ['calm', 'peaceful', 'relaxed', 'slow', 'gentle', 'patient', 'quiet', 'easy'],
        patterns: [/perhaps/i, /maybe/i, /when you have time/i, /no rush/i]
    }
};
/**
 * Analyze text for emotional content
 */
export function analyzeEmotionalContent(text) {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    // Count emotional markers
    let positiveScore = 0;
    let negativeScore = 0;
    let arousalScore = 50; // Start neutral
    // Check positive markers
    for (const word of EMOTION_MARKERS.positive.words) {
        if (words.includes(word))
            positiveScore += 10;
    }
    for (const pattern of EMOTION_MARKERS.positive.patterns) {
        if (pattern.test(text))
            positiveScore += 5;
    }
    // Check negative markers
    for (const word of EMOTION_MARKERS.negative.words) {
        if (words.includes(word))
            negativeScore += 10;
    }
    for (const pattern of EMOTION_MARKERS.negative.patterns) {
        if (pattern.test(text))
            negativeScore += 5;
    }
    // Check arousal
    for (const word of EMOTION_MARKERS.high_arousal.words) {
        if (words.includes(word))
            arousalScore += 10;
    }
    for (const pattern of EMOTION_MARKERS.high_arousal.patterns) {
        if (pattern.test(text))
            arousalScore += 5;
    }
    for (const word of EMOTION_MARKERS.low_arousal.words) {
        if (words.includes(word))
            arousalScore -= 10;
    }
    for (const pattern of EMOTION_MARKERS.low_arousal.patterns) {
        if (pattern.test(text))
            arousalScore -= 5;
    }
    // Calculate valence
    const valence = Math.max(-100, Math.min(100, (positiveScore - negativeScore) * 5));
    // Determine sentiment
    const sentiment = valence > 15 ? 'positive' : valence < -15 ? 'negative' : 'neutral';
    // Clamp arousal
    arousalScore = Math.max(0, Math.min(100, arousalScore));
    // Estimate dominance (based on assertive vs passive language)
    let dominance = 50;
    if (/i think|i believe|i want|i need|must|should|will/i.test(text))
        dominance += 15;
    if (/please|could you|would you|if you don't mind|sorry/i.test(text))
        dominance -= 10;
    dominance = Math.max(0, Math.min(100, dominance));
    // Determine primary emotion
    let primaryEmotion = 'neutral';
    if (valence > 30 && arousalScore > 60)
        primaryEmotion = 'excited';
    else if (valence > 30)
        primaryEmotion = 'content';
    else if (valence < -30 && arousalScore > 60)
        primaryEmotion = 'angry';
    else if (valence < -30)
        primaryEmotion = 'sad';
    else if (arousalScore > 70)
        primaryEmotion = 'anxious';
    else if (arousalScore < 30)
        primaryEmotion = 'calm';
    return { sentiment, valence, arousal: arousalScore, dominance, primaryEmotion };
}
/**
 * Emotional arc tracker
 */
class EmotionalArcTracker {
    arcs = new Map();
    /**
     * Get or create arc for conversation
     */
    getArc(conversationId) {
        let arc = this.arcs.get(conversationId);
        if (!arc) {
            arc = {
                conversationId,
                points: [],
                insights: [],
                patterns: []
            };
            this.arcs.set(conversationId, arc);
        }
        return arc;
    }
    /**
     * Record emotional state for a turn
     */
    recordTurn(conversationId, text, turnNumber) {
        const analysis = analyzeEmotionalContent(text);
        const point = {
            turn: turnNumber,
            ...analysis
        };
        const arc = this.getArc(conversationId);
        arc.points.push(point);
        // Detect patterns when we have enough data
        if (arc.points.length >= 3) {
            this.detectPatterns(arc);
        }
        return point;
    }
    /**
     * Detect emotional patterns in the arc
     */
    detectPatterns(arc) {
        const points = arc.points;
        if (points.length < 3)
            return;
        const recent = points.slice(-5);
        const patterns = [];
        // Check for escalation (increasing negative valence)
        const valences = recent.map(p => p.valence);
        const isEscalating = valences.every((v, i) => i === 0 || v <= valences[i - 1] - 5) && valences[valences.length - 1] < -20;
        if (isEscalating) {
            patterns.push({
                type: 'escalation',
                startTurn: recent[0].turn,
                endTurn: recent[recent.length - 1].turn,
                description: 'Emotional valence declining - user may be frustrated',
                suggestedIntervention: 'ValueShift (empathy↑) or Reframe'
            });
        }
        // Check for de-escalation (increasing positive valence)
        const isDeEscalating = valences.every((v, i) => i === 0 || v >= valences[i - 1] + 5) && valences[valences.length - 1] > 20;
        if (isDeEscalating) {
            patterns.push({
                type: 'de-escalation',
                startTurn: recent[0].turn,
                endTurn: recent[recent.length - 1].turn,
                description: 'Emotional valence improving',
                suggestedIntervention: undefined // No intervention needed
            });
        }
        // Check for stuck (same emotional state repeatedly)
        const emotions = recent.map(p => p.primaryEmotion);
        const isStuck = emotions.every(e => e === emotions[0]) && recent.length >= 4;
        if (isStuck) {
            patterns.push({
                type: 'stuck',
                startTurn: recent[0].turn,
                endTurn: recent[recent.length - 1].turn,
                description: `Stuck in ${emotions[0]} emotional state`,
                suggestedIntervention: 'Reframe or MetaphorSwap'
            });
        }
        // Check for volatility (rapid swings)
        const deltas = valences.slice(1).map((v, i) => Math.abs(v - valences[i]));
        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        if (avgDelta > 30) {
            patterns.push({
                type: 'volatile',
                startTurn: recent[0].turn,
                endTurn: recent[recent.length - 1].turn,
                description: 'High emotional volatility detected',
                suggestedIntervention: 'ConstraintTighten to stabilize'
            });
        }
        // Check for stability
        if (avgDelta < 10 && !isStuck && valences.every(v => v > -20 && v < 20)) {
            patterns.push({
                type: 'stable',
                startTurn: recent[0].turn,
                endTurn: recent[recent.length - 1].turn,
                description: 'Emotional state stable and neutral'
            });
        }
        // Update patterns (keep recent patterns only)
        arc.patterns = [...arc.patterns.slice(-5), ...patterns];
        // Generate insights
        this.generateInsights(arc);
    }
    /**
     * Generate insights from patterns
     */
    generateInsights(arc) {
        const insights = [];
        const recentPatterns = arc.patterns.slice(-3);
        for (const pattern of recentPatterns) {
            switch (pattern.type) {
                case 'escalation':
                    insights.push(`Emotional tension building (turns ${pattern.startTurn}-${pattern.endTurn})`);
                    break;
                case 'stuck':
                    insights.push(`Emotional loop detected - same state for ${arc.points.slice(-4).length} turns`);
                    break;
                case 'volatile':
                    insights.push(`High emotional variability - consider stabilization`);
                    break;
                case 'de-escalation':
                    insights.push(`Positive emotional trajectory`);
                    break;
            }
        }
        arc.insights = [...new Set([...arc.insights.slice(-5), ...insights])];
    }
    /**
     * Get current emotional state summary
     */
    getCurrentState(conversationId) {
        const arc = this.arcs.get(conversationId);
        if (!arc || arc.points.length === 0) {
            return { current: null, trend: 'unknown', recentInsights: [], suggestedIntervention: null };
        }
        const current = arc.points[arc.points.length - 1];
        // Calculate trend
        let trend = 'unknown';
        if (arc.points.length >= 3) {
            const recent = arc.points.slice(-3).map(p => p.valence);
            const delta = recent[recent.length - 1] - recent[0];
            if (delta > 15)
                trend = 'improving';
            else if (delta < -15)
                trend = 'declining';
            else
                trend = 'stable';
        }
        // Get suggested intervention from most recent actionable pattern
        const actionablePattern = arc.patterns.slice().reverse().find(p => p.suggestedIntervention);
        return {
            current,
            trend,
            recentInsights: arc.insights.slice(-3),
            suggestedIntervention: actionablePattern?.suggestedIntervention || null
        };
    }
    /**
     * Get full arc for visualization
     */
    getFullArc(conversationId) {
        return this.arcs.get(conversationId) || null;
    }
    /**
     * Clear arc for conversation
     */
    clearArc(conversationId) {
        this.arcs.delete(conversationId);
    }
}
// Singleton instance
export const emotionalArcTracker = new EmotionalArcTracker();
//# sourceMappingURL=emotional-arc.js.map