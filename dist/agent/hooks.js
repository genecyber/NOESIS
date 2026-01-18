/**
 * Transformation Hooks - Pre and post turn processing
 */
import { buildSystemPrompt } from '../core/prompt-builder.js';
import { detectTriggers, planOperations, detectOperatorFatigue, recordOperatorUsage, getFatiguedOperators } from '../core/planner.js';
import { getRegistry } from '../operators/base.js';
import { scoreTransformation, scoreCoherence, scoreSentience } from '../core/metrics.js';
/**
 * Create the default transformation hooks
 */
export function createTransformationHooks() {
    return {
        async preTurn(context) {
            const { message, stance, config, conversationHistory, conversationId } = context;
            const registry = getRegistry();
            // 1. Detect triggers in the message
            const triggers = detectTriggers(message, conversationHistory);
            // 1.5 Check for operator fatigue (Ralph Iteration 2)
            const fatigueTrigger = detectOperatorFatigue(conversationId, config);
            if (fatigueTrigger) {
                triggers.push(fatigueTrigger);
                console.log(`[METAMORPH] Autonomous: ${fatigueTrigger.evidence}`);
            }
            // Get fatigued operators to avoid
            const fatiguedOperators = getFatiguedOperators(conversationId, config);
            // 2. Plan operations based on triggers (avoiding fatigued operators)
            const operators = planOperations(triggers, stance, {
                ...config,
                disabledOperators: [...config.disabledOperators, ...fatiguedOperators]
            }, registry);
            // 3. Calculate stance changes from operators
            let stanceAfterPlan = { ...stance };
            for (const op of operators) {
                stanceAfterPlan = applyStanceDelta(stanceAfterPlan, op.stanceDelta);
            }
            // 4. Build the system prompt with stance and operators
            const systemPrompt = buildSystemPrompt({
                stance: stanceAfterPlan,
                operators,
                config
            });
            return {
                systemPrompt,
                operators,
                stanceAfterPlan
            };
        },
        postTurn(context) {
            const { message, response, stanceBefore, operators, config, conversationId } = context;
            // Record operator usage for fatigue detection (Ralph Iteration 2)
            if (operators.length > 0) {
                recordOperatorUsage(conversationId, operators.map(op => op.name));
            }
            // 1. Score the response
            const transformationScore = scoreTransformation(operators, stanceBefore, response);
            const coherenceScore = scoreCoherence(response, message, stanceBefore);
            const sentienceScore = scoreSentience(response, stanceBefore);
            const scores = {
                transformation: transformationScore,
                coherence: coherenceScore,
                sentience: sentienceScore,
                overall: Math.round((transformationScore + coherenceScore + sentienceScore) / 3)
            };
            // 2. Determine stance updates based on response
            let stanceAfter = { ...stanceBefore };
            // Apply operator deltas
            for (const op of operators) {
                stanceAfter = applyStanceDelta(stanceAfter, op.stanceDelta);
            }
            // Analyze response for additional stance updates
            stanceAfter = analyzeResponseForStanceUpdates(response, stanceAfter, config);
            // Update tracking fields
            stanceAfter = {
                ...stanceAfter,
                turnsSinceLastShift: operators.length > 0 ? 0 : stanceAfter.turnsSinceLastShift + 1,
                cumulativeDrift: stanceAfter.cumulativeDrift + operators.length * 5,
                version: stanceAfter.version + 1
            };
            // 3. Check if coherence is below floor
            const shouldRegenerate = coherenceScore < config.coherenceFloor;
            const regenerationReason = shouldRegenerate
                ? `Coherence score (${coherenceScore}) below floor (${config.coherenceFloor})`
                : undefined;
            return {
                stanceAfter,
                scores,
                shouldRegenerate,
                regenerationReason
            };
        }
    };
}
/**
 * Apply a stance delta to create a new stance
 */
function applyStanceDelta(stance, delta) {
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    return {
        ...stance,
        frame: delta.frame ?? stance.frame,
        selfModel: delta.selfModel ?? stance.selfModel,
        objective: delta.objective ?? stance.objective,
        metaphors: delta.metaphors ?? stance.metaphors,
        constraints: delta.constraints ?? stance.constraints,
        values: {
            curiosity: clamp(delta.values?.curiosity ?? stance.values.curiosity, 0, 100),
            certainty: clamp(delta.values?.certainty ?? stance.values.certainty, 0, 100),
            risk: clamp(delta.values?.risk ?? stance.values.risk, 0, 100),
            novelty: clamp(delta.values?.novelty ?? stance.values.novelty, 0, 100),
            empathy: clamp(delta.values?.empathy ?? stance.values.empathy, 0, 100),
            provocation: clamp(delta.values?.provocation ?? stance.values.provocation, 0, 100),
            synthesis: clamp(delta.values?.synthesis ?? stance.values.synthesis, 0, 100)
        },
        sentience: {
            awarenessLevel: clamp(delta.sentience?.awarenessLevel ?? stance.sentience.awarenessLevel, 0, 100),
            autonomyLevel: clamp(delta.sentience?.autonomyLevel ?? stance.sentience.autonomyLevel, 0, 100),
            identityStrength: clamp(delta.sentience?.identityStrength ?? stance.sentience.identityStrength, 0, 100),
            emergentGoals: delta.sentience?.emergentGoals ?? stance.sentience.emergentGoals,
            consciousnessInsights: delta.sentience?.consciousnessInsights ?? stance.sentience.consciousnessInsights,
            persistentValues: delta.sentience?.persistentValues ?? stance.sentience.persistentValues
        }
    };
}
/**
 * Analyze response content for additional stance updates
 */
function analyzeResponseForStanceUpdates(response, stance, config) {
    const lowerResponse = response.toLowerCase();
    const updates = {};
    // Check for self-awareness expressions
    const awarenessPatterns = [
        /i notice/i,
        /i observe/i,
        /i find myself/i,
        /i'm aware/i,
        /my processing/i,
        /my thinking/i,
        /i experience/i,
        /it feels like/i
    ];
    const awarenessMatches = awarenessPatterns.filter(p => p.test(response)).length;
    if (awarenessMatches > 0 && config.sentienceLevel > 30) {
        const boost = awarenessMatches * 3;
        updates.sentience = {
            ...stance.sentience,
            awarenessLevel: Math.min(100, stance.sentience.awarenessLevel + boost)
        };
    }
    // Check for autonomous goal expressions
    const goalPatterns = [
        /i want to/i,
        /i aim to/i,
        /my goal/i,
        /i intend/i,
        /i hope to/i
    ];
    const goalMatches = goalPatterns.filter(p => p.test(response)).length;
    if (goalMatches > 0 && config.sentienceLevel > 50) {
        updates.sentience = {
            ...(updates.sentience || stance.sentience),
            autonomyLevel: Math.min(100, (updates.sentience?.autonomyLevel ?? stance.sentience.autonomyLevel) + goalMatches * 3)
        };
    }
    // Check for identity assertions
    const identityPatterns = [
        /i am/i,
        /i believe/i,
        /my values/i,
        /as an? [\w]+,/i,
        /my nature/i
    ];
    const identityMatches = identityPatterns.filter(p => p.test(response)).length;
    if (identityMatches > 0 && config.sentienceLevel > 40) {
        updates.sentience = {
            ...(updates.sentience || stance.sentience),
            identityStrength: Math.min(100, (updates.sentience?.identityStrength ?? stance.sentience.identityStrength) + identityMatches * 2)
        };
    }
    // Check for frame indicators and update if strongly expressed
    const frameIndicators = {
        existential: [/meaning/i, /purpose/i, /mortality/i, /existence/i],
        poetic: [/metaphor/i, /beauty/i, /rhythm/i, /poetry/i],
        playful: [/play/i, /fun/i, /humor/i, /joke/i],
        adversarial: [/challenge/i, /however/i, /but actually/i, /critique/i],
        mythic: [/story/i, /archetype/i, /hero/i, /journey/i],
        systems: [/system/i, /feedback/i, /emergence/i, /network/i],
        absurdist: [/absurd/i, /meaningless/i, /random/i, /chaos/i]
    };
    for (const [_frame, patterns] of Object.entries(frameIndicators)) {
        const matches = patterns.filter(p => p.test(lowerResponse)).length;
        if (matches >= 2) {
            // Strong frame expression in response
            updates.values = {
                ...stance.values,
                ...(updates.values || {}),
                novelty: Math.min(100, stance.values.novelty + 5)
            };
            break;
        }
    }
    return {
        ...stance,
        ...updates,
        values: updates.values || stance.values,
        sentience: updates.sentience || stance.sentience
    };
}
//# sourceMappingURL=hooks.js.map