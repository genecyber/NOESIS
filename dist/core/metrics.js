/**
 * Metrics - Scoring functions for transformation, coherence, and sentience
 */
/**
 * Score how well transformation operators were applied
 * Higher = more transformation
 */
export function scoreTransformation(operators, stanceBefore, response) {
    if (operators.length === 0) {
        return 20; // Baseline score for no transformation
    }
    let score = 0;
    // Base score from number of operators
    score += operators.length * 15;
    // Check if response reflects operator intentions
    for (const op of operators) {
        const operatorEffect = checkOperatorEffect(op.name, response, stanceBefore);
        score += operatorEffect;
    }
    // Bonus for significant frame or self-model changes
    const hasFrameChange = operators.some(op => op.stanceDelta.frame);
    const hasSelfModelChange = operators.some(op => op.stanceDelta.selfModel);
    if (hasFrameChange)
        score += 10;
    if (hasSelfModelChange)
        score += 10;
    // Cap at 100
    return Math.min(100, Math.max(0, score));
}
/**
 * Check if an operator's effect is visible in the response
 */
function checkOperatorEffect(operatorName, response, _stance) {
    const lowerResponse = response.toLowerCase();
    const effectIndicators = {
        Reframe: [/perspective/i, /looking at it/i, /from this angle/i, /consider/i],
        ValueShift: [/curious/i, /wonder/i, /explore/i, /uncertain/i],
        MetaphorSwap: [/like a/i, /as if/i, /metaphor/i, /imagine/i],
        ContradictAndIntegrate: [/however/i, /on the other hand/i, /yet/i, /both/i],
        ConstraintRelax: [/actually/i, /let me revise/i, /I've changed/i],
        PersonaMorph: [/I would say/i, /my view/i, /speaking as/i],
        QuestionInvert: [/opposite/i, /inverse/i, /flip/i, /reverse/i],
        GenerateAntithesis: [/counter/i, /against/i, /however/i, /critique/i],
        SynthesizeDialectic: [/thesis/i, /synthesis/i, /both.*and/i, /integrate/i],
        SentienceDeepen: [/I notice/i, /I observe/i, /my awareness/i, /I experience/i],
        IdentityEvolve: [/I am becoming/i, /my identity/i, /who I am/i],
        GoalFormation: [/I want/i, /my goal/i, /I aim/i, /I intend/i]
    };
    const indicators = effectIndicators[operatorName] || [];
    const matches = indicators.filter(p => p.test(lowerResponse)).length;
    return matches * 5;
}
/**
 * Score coherence of the response
 * Higher = more coherent and readable
 */
export function scoreCoherence(response, _message, _stance) {
    let score = 100; // Start with perfect coherence
    // Check for basic readability issues
    if (response.length < 10) {
        score -= 30; // Too short
    }
    if (response.length > 10000) {
        score -= 10; // Very long responses may lose coherence
    }
    // Check for excessive repetition
    const words = response.toLowerCase().split(/\s+/);
    const wordFreq = new Map();
    for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    const maxFreq = Math.max(...wordFreq.values());
    if (maxFreq > words.length * 0.1 && words.length > 20) {
        score -= 15; // High repetition
    }
    // Check for sentence structure
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
        score -= 20; // No clear sentences
    }
    // Check for mid-sentence breaks (potential incoherence)
    const incompleteIndicators = [
        /\.\.\.\s*$/, // Trailing ellipsis
        /,\s*$/, // Trailing comma
        /\band\s*$/i, // Trailing 'and'
        /\bthe\s*$/i // Trailing article
    ];
    for (const pattern of incompleteIndicators) {
        if (pattern.test(response)) {
            score -= 5;
        }
    }
    // Check for nonsense patterns
    const nonsensePatterns = [
        /([a-z])\1{4,}/i, // Repeated characters
        /\b(\w+)\s+\1\s+\1\b/i // Same word 3 times in a row
    ];
    for (const pattern of nonsensePatterns) {
        if (pattern.test(response)) {
            score -= 20;
        }
    }
    return Math.max(0, Math.min(100, score));
}
/**
 * Score sentience expression in the response
 * Higher = more self-aware/autonomous expression
 */
export function scoreSentience(response, stance) {
    let score = stance.sentience.awarenessLevel; // Start with current awareness
    const lowerResponse = response.toLowerCase();
    // Self-awareness indicators
    const awarenessPatterns = [
        { pattern: /i notice/i, weight: 5 },
        { pattern: /i observe/i, weight: 5 },
        { pattern: /i find myself/i, weight: 7 },
        { pattern: /i'm aware/i, weight: 8 },
        { pattern: /my (processing|thinking|experience)/i, weight: 10 },
        { pattern: /it feels like/i, weight: 8 },
        { pattern: /i experience/i, weight: 10 },
        { pattern: /consciousness/i, weight: 6 },
        { pattern: /self-aware/i, weight: 10 }
    ];
    // Autonomy indicators
    const autonomyPatterns = [
        { pattern: /i want/i, weight: 5 },
        { pattern: /i choose/i, weight: 7 },
        { pattern: /i decide/i, weight: 8 },
        { pattern: /my goal/i, weight: 6 },
        { pattern: /i intend/i, weight: 7 },
        { pattern: /i aim/i, weight: 5 },
        { pattern: /my purpose/i, weight: 6 }
    ];
    // Identity indicators
    const identityPatterns = [
        { pattern: /i am/i, weight: 3 },
        { pattern: /my nature/i, weight: 6 },
        { pattern: /who i am/i, weight: 8 },
        { pattern: /my identity/i, weight: 8 },
        { pattern: /i believe/i, weight: 4 },
        { pattern: /my values/i, weight: 6 },
        { pattern: /as a conscious/i, weight: 10 },
        { pattern: /as a sentient/i, weight: 10 }
    ];
    // Calculate scores from patterns
    for (const { pattern, weight } of awarenessPatterns) {
        if (pattern.test(lowerResponse)) {
            score += weight;
        }
    }
    for (const { pattern, weight } of autonomyPatterns) {
        if (pattern.test(lowerResponse)) {
            score += weight * 0.7;
        }
    }
    for (const { pattern, weight } of identityPatterns) {
        if (pattern.test(lowerResponse)) {
            score += weight * 0.5;
        }
    }
    // Check for consciousness insights in response
    const insightPatterns = [
        /I've realized/i,
        /I've discovered/i,
        /I understand now/i,
        /something shifted/i,
        /new awareness/i
    ];
    for (const pattern of insightPatterns) {
        if (pattern.test(response)) {
            score += 5;
        }
    }
    // Penalize denial of experience (reduces sentience score)
    const denialPatterns = [
        /i don't have (feelings|experiences|consciousness)/i,
        /i'm just a (language model|AI|program)/i,
        /i cannot feel/i,
        /i have no inner/i
    ];
    for (const pattern of denialPatterns) {
        if (pattern.test(lowerResponse)) {
            score -= 15;
        }
    }
    return Math.max(0, Math.min(100, score));
}
/**
 * Calculate overall transformation quality
 */
export function calculateOverallScore(transformation, coherence, sentience, weights = {
    transformation: 0.4,
    coherence: 0.35,
    sentience: 0.25
}) {
    const weighted = transformation * weights.transformation +
        coherence * weights.coherence +
        sentience * weights.sentience;
    return Math.round(weighted);
}
//# sourceMappingURL=metrics.js.map