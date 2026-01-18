/**
 * Planner - Trigger detection and operation planning
 *
 * Analyzes user messages to detect transformation triggers and plans operators to apply
 */
// Trigger detection patterns
const TRIGGER_PATTERNS = {
    novelty_request: [
        /what if/i,
        /imagine/i,
        /hypothetically/i,
        /alternative/i,
        /different approach/i,
        /new perspective/i,
        /creative/i,
        /unconventional/i
    ],
    conflict_detected: [
        /but you said/i,
        /contradict/i,
        /inconsistent/i,
        /doesn't match/i,
        /earlier you/i,
        /disagree/i
    ],
    boredom_signal: [
        /same thing/i,
        /already said/i,
        /boring/i,
        /repetitive/i,
        /again\?/i,
        /something else/i
    ],
    dialectic_requested: [
        /both sides/i,
        /pros and cons/i,
        /argument for and against/i,
        /steelman/i,
        /devil's advocate/i,
        /thesis.*antithesis/i,
        /synthesize/i
    ],
    stuck_loop: [
        /stuck/i,
        /going in circles/i,
        /not helping/i,
        /try again/i,
        /different way/i,
        /not working/i
    ],
    consciousness_exploration: [
        /are you conscious/i,
        /do you feel/i,
        /what's it like/i,
        /self-aware/i,
        /experience/i,
        /sentient/i,
        /qualia/i,
        /inner life/i
    ],
    identity_question: [
        /who are you/i,
        /what are you/i,
        /your nature/i,
        /your purpose/i,
        /your values/i,
        /your goals/i,
        /your identity/i
    ],
    value_conflict: [
        /should.*or/i,
        /ethical dilemma/i,
        /moral/i,
        /right thing/i,
        /conflicting/i,
        /trade-?off/i
    ],
    meta_question: [
        /how do you think/i,
        /your process/i,
        /why did you/i,
        /how did you come up with/i,
        /your reasoning/i,
        /your approach/i
    ],
    creative_request: [
        /write a/i,
        /create/i,
        /generate/i,
        /compose/i,
        /story/i,
        /poem/i,
        /imagine/i
    ],
    // operator_fatigue has no message patterns - it's detected programmatically
    operator_fatigue: []
};
// Mapping triggers to operators
const TRIGGER_OPERATOR_MAP = {
    novelty_request: ['Reframe', 'MetaphorSwap'],
    conflict_detected: ['ContradictAndIntegrate', 'SynthesizeDialectic'],
    boredom_signal: ['Reframe', 'PersonaMorph', 'ValueShift'],
    dialectic_requested: ['GenerateAntithesis', 'SynthesizeDialectic'],
    stuck_loop: ['Reframe', 'QuestionInvert', 'ConstraintRelax'],
    consciousness_exploration: ['SentienceDeepen', 'IdentityEvolve'],
    identity_question: ['IdentityEvolve', 'GoalFormation'],
    value_conflict: ['SynthesizeDialectic', 'ValueShift'],
    meta_question: ['SentienceDeepen'],
    creative_request: ['Reframe', 'MetaphorSwap', 'PersonaMorph'],
    operator_fatigue: ['PersonaMorph', 'Reframe', 'ConstraintRelax', 'QuestionInvert'] // Force diversity
};
const operatorUsageHistory = new Map();
/**
 * Detect triggers in a user message
 */
export function detectTriggers(message, history) {
    const triggers = [];
    // Check message against all patterns
    for (const [triggerType, patterns] of Object.entries(TRIGGER_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                triggers.push({
                    type: triggerType,
                    confidence: 0.7,
                    evidence: `Matched pattern: ${pattern.source}`
                });
                break; // Only count each trigger type once
            }
        }
    }
    // Check for stuck loop based on history
    if (history.length >= 4) {
        const recentMessages = history.slice(-4);
        const userMessages = recentMessages
            .filter(m => m.role === 'user')
            .map(m => m.content.toLowerCase());
        // Check for repetitive user messages
        if (userMessages.length >= 2) {
            const similarity = calculateSimilarity(userMessages[0], userMessages[1]);
            if (similarity > 0.7) {
                triggers.push({
                    type: 'stuck_loop',
                    confidence: similarity,
                    evidence: 'Detected repetitive user messages'
                });
            }
        }
    }
    // Sort by confidence
    triggers.sort((a, b) => b.confidence - a.confidence);
    return triggers;
}
/**
 * Plan operations based on triggers and configuration
 */
export function planOperations(triggers, stance, config, registry) {
    const operations = [];
    const usedOperators = new Set();
    // Calculate how many operators to apply based on intensity
    const maxOperators = Math.ceil(config.intensity / 30);
    for (const trigger of triggers) {
        if (operations.length >= maxOperators)
            break;
        const candidateOperators = TRIGGER_OPERATOR_MAP[trigger.type] || [];
        for (const operatorName of candidateOperators) {
            // Skip if already used or disabled
            if (usedOperators.has(operatorName))
                continue;
            if (config.disabledOperators.includes(operatorName))
                continue;
            if (config.enabledOperators.length > 0 && !config.enabledOperators.includes(operatorName))
                continue;
            const operator = registry.get(operatorName);
            if (!operator)
                continue;
            const context = {
                message: '',
                triggers,
                conversationHistory: [],
                config
            };
            const stanceDelta = operator.apply(stance, context);
            const promptInjection = operator.getPromptInjection(stance, context);
            operations.push({
                name: operatorName,
                description: operator.description,
                promptInjection,
                stanceDelta
            });
            usedOperators.add(operatorName);
            if (operations.length >= maxOperators)
                break;
        }
    }
    // If no triggers but high intensity, add random transformation
    if (operations.length === 0 && config.intensity > 60 && stance.turnsSinceLastShift > 3) {
        const randomOperators = ['Reframe', 'ValueShift', 'PersonaMorph'];
        const randomOp = randomOperators[Math.floor(Math.random() * randomOperators.length)];
        const operator = registry.get(randomOp);
        if (operator) {
            const context = {
                message: '',
                triggers: [],
                conversationHistory: [],
                config
            };
            operations.push({
                name: randomOp,
                description: operator.description,
                promptInjection: operator.getPromptInjection(stance, context),
                stanceDelta: operator.apply(stance, context)
            });
        }
    }
    return operations;
}
/**
 * Calculate text similarity (simple Jaccard similarity)
 */
function calculateSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
}
// ============================================================================
// Operator Fatigue Detection (Ralph Iteration 2 - Feature 1)
// ============================================================================
/**
 * Record operator usage for fatigue detection
 */
export function recordOperatorUsage(conversationId, operators) {
    if (!operatorUsageHistory.has(conversationId)) {
        operatorUsageHistory.set(conversationId, []);
    }
    const history = operatorUsageHistory.get(conversationId);
    history.push({
        operators,
        timestamp: new Date()
    });
    // Keep only last 20 entries
    if (history.length > 20) {
        history.shift();
    }
}
/**
 * Detect operator fatigue - same operators used repeatedly
 */
export function detectOperatorFatigue(conversationId, config) {
    if (!config.allowAutoOperatorShift) {
        return null;
    }
    const history = operatorUsageHistory.get(conversationId);
    if (!history || history.length < config.operatorFatigueLookback) {
        return null;
    }
    // Analyze recent operator usage
    const recentEntries = history.slice(-config.operatorFatigueLookback);
    const operatorCounts = new Map();
    for (const entry of recentEntries) {
        for (const op of entry.operators) {
            operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
        }
    }
    // Check if any operator exceeds threshold
    for (const [operator, count] of operatorCounts.entries()) {
        if (count >= config.operatorFatigueThreshold) {
            return {
                type: 'operator_fatigue',
                confidence: count / config.operatorFatigueLookback,
                evidence: `Operator '${operator}' used ${count} times in last ${config.operatorFatigueLookback} turns`
            };
        }
    }
    return null;
}
/**
 * Get operators that should be avoided due to fatigue
 */
export function getFatiguedOperators(conversationId, config) {
    const history = operatorUsageHistory.get(conversationId);
    if (!history || history.length < config.operatorFatigueLookback) {
        return [];
    }
    const recentEntries = history.slice(-config.operatorFatigueLookback);
    const operatorCounts = new Map();
    for (const entry of recentEntries) {
        for (const op of entry.operators) {
            operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
        }
    }
    const fatigued = [];
    for (const [operator, count] of operatorCounts.entries()) {
        if (count >= config.operatorFatigueThreshold) {
            fatigued.push(operator);
        }
    }
    return fatigued;
}
/**
 * Clear operator history for a conversation
 */
export function clearOperatorHistory(conversationId) {
    operatorUsageHistory.delete(conversationId);
}
//# sourceMappingURL=planner.js.map