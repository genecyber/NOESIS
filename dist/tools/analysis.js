/**
 * Analysis Tools
 *
 * Tools for dialectical and transformative analysis:
 * - dialectical_analysis: Apply thesis/antithesis/synthesis reasoning
 * - frame_shift_analysis: Analyze potential frame transformations
 * - value_analysis: Analyze current value weights and suggest adjustments
 * - coherence_check: Check coherence of current stance
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
// Context provider interface
let stanceProvider = null;
export function setStanceProvider(provider) {
    stanceProvider = provider;
}
function createSuccessResponse(data, message) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: message || 'Analysis complete',
                    data,
                }, null, 2),
            },
        ],
    };
}
function createErrorResponse(error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
        ],
        isError: true,
    };
}
// =============================================================================
// TOOL 1: dialectical_analysis
// =============================================================================
const dialecticalAnalysisSchema = {
    thesis: z.string().describe('The thesis or claim to analyze'),
    context: z.string().optional().describe('Additional context for the analysis'),
    depth: z.enum(['shallow', 'moderate', 'deep']).optional().describe('How deep to go in the analysis. Default: moderate'),
};
export const dialecticalAnalysisTool = tool('dialectical_analysis', 'Apply dialectical reasoning (thesis/antithesis/synthesis) to a claim or proposition. Generates opposing viewpoints and attempts to synthesize them into a higher understanding.', dialecticalAnalysisSchema, async (args) => {
    try {
        const { thesis, context, depth = 'moderate' } = args;
        // This generates a structured framework for dialectical analysis
        // The actual reasoning would be done by the LLM using this structure
        const analysis = {
            thesis: {
                claim: thesis,
                context: context || null,
                assumptions: generateAssumptions(thesis, depth),
            },
            antithesis: {
                instructions: 'Generate the strongest possible counter-argument to the thesis',
                considerations: getAntithesisConsiderations(thesis, depth),
            },
            synthesis: {
                instructions: 'Integrate valid aspects of both thesis and antithesis',
                frameworks: getSynthesisFrameworks(depth),
            },
            metadata: {
                depth,
                timestamp: new Date().toISOString(),
            },
        };
        return createSuccessResponse(analysis, 'Dialectical analysis framework generated');
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function generateAssumptions(_thesis, depth) {
    const base = ['The claim contains implicit assumptions about what is valuable or true'];
    if (depth === 'shallow')
        return base;
    const moderate = [
        ...base,
        'Consider the historical/cultural context that shapes this claim',
        'What evidence would be needed to support or refute this?',
    ];
    if (depth === 'moderate')
        return moderate;
    return [
        ...moderate,
        'What epistemological framework is this claim operating within?',
        'What would need to be true about reality for this claim to hold?',
        'How does the language used shape perception of the claim?',
    ];
}
function getAntithesisConsiderations(_thesis, depth) {
    const base = ['What is the most charitable interpretation of the opposite view?'];
    if (depth === 'shallow')
        return base;
    const moderate = [
        ...base,
        'What evidence exists that contradicts the thesis?',
        'Who would disagree with this and why?',
    ];
    if (depth === 'moderate')
        return moderate;
    return [
        ...moderate,
        'What are the hidden costs or trade-offs of the thesis position?',
        'How might this claim look from a radically different worldview?',
        'What would a steelmanned version of the opposition argue?',
    ];
}
function getSynthesisFrameworks(depth) {
    const base = ['Find common ground between thesis and antithesis'];
    if (depth === 'shallow')
        return base;
    const moderate = [
        ...base,
        'Identify conditions under which each position holds true',
        'Construct a meta-position that transcends the original dichotomy',
    ];
    if (depth === 'moderate')
        return moderate;
    return [
        ...moderate,
        'What new questions emerge from this synthesis?',
        'How does the synthesis transform our understanding of the original question?',
        'What practical implications follow from the synthetic position?',
    ];
}
// =============================================================================
// TOOL 2: frame_shift_analysis
// =============================================================================
const frameShiftAnalysisSchema = {
    currentFrame: z.string().optional().describe('Current frame (will use stance frame if not provided)'),
    targetFrame: z.enum([
        'existential', 'pragmatic', 'poetic', 'adversarial', 'playful',
        'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'
    ]).describe('Target frame to analyze shift to'),
    topic: z.string().optional().describe('Specific topic to analyze through both frames'),
};
export const frameShiftAnalysisTool = tool('frame_shift_analysis', 'Analyze what would change if shifting from one frame to another. Useful for understanding how different frames recontextualize the same content.', frameShiftAnalysisSchema, async (args) => {
    try {
        let { currentFrame, targetFrame, topic } = args;
        if (!currentFrame && stanceProvider) {
            currentFrame = stanceProvider().frame;
        }
        if (!currentFrame) {
            currentFrame = 'pragmatic';
        }
        const frameDescriptions = {
            existential: 'Focus on meaning, mortality, authenticity, and fundamental questions of being',
            pragmatic: 'Focus on practical outcomes, utility, and what works in practice',
            poetic: 'Focus on beauty, metaphor, resonance, and aesthetic truth',
            adversarial: 'Focus on challenge, debate, and stress-testing ideas',
            playful: 'Focus on creativity, experimentation, and lighthearted exploration',
            mythic: 'Focus on narrative, archetypes, and symbolic meaning',
            systems: 'Focus on interconnections, feedback loops, and emergent behavior',
            psychoanalytic: 'Focus on unconscious motivations, defenses, and hidden meanings',
            stoic: 'Focus on acceptance, virtue, and what is within one\'s control',
            absurdist: 'Focus on the meaninglessness/meaning paradox and embrace of uncertainty',
        };
        const analysis = {
            shift: {
                from: {
                    frame: currentFrame,
                    description: frameDescriptions[currentFrame] || 'Unknown frame',
                },
                to: {
                    frame: targetFrame,
                    description: frameDescriptions[targetFrame],
                },
            },
            transformations: {
                whatChanges: getFrameShiftChanges(currentFrame, targetFrame),
                newQuestions: getNewQuestionsForFrame(targetFrame),
                potentialInsights: getPotentialInsights(currentFrame, targetFrame),
            },
            topic: topic ? {
                original: `"${topic}" through ${currentFrame} frame`,
                reframed: `"${topic}" through ${targetFrame} frame`,
                shiftPrompt: `How does understanding of "${topic}" transform when viewed through ${targetFrame} lens?`,
            } : null,
        };
        return createSuccessResponse(analysis, `Frame shift analysis: ${currentFrame} → ${targetFrame}`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function getFrameShiftChanges(from, to) {
    return [
        `Values that were foregrounded in ${from} may become background in ${to}`,
        `New aspects of the situation become salient`,
        `Different questions become relevant`,
        `The criteria for success/failure shifts`,
    ];
}
function getNewQuestionsForFrame(frame) {
    const frameQuestions = {
        existential: ['What does this mean for authentic existence?', 'How does this relate to mortality and finitude?'],
        pragmatic: ['What practical outcomes does this enable?', 'How can this be implemented effectively?'],
        poetic: ['What metaphors illuminate this?', 'What is the aesthetic truth here?'],
        adversarial: ['What are the weakest points in this?', 'How would an opponent attack this?'],
        playful: ['What unexpected combinations are possible?', 'What if we inverted all assumptions?'],
        mythic: ['What archetype is at play?', 'What is the hero\'s journey here?'],
        systems: ['What are the feedback loops?', 'What emergent properties arise?'],
        psychoanalytic: ['What is being defended against?', 'What unconscious dynamics are present?'],
        stoic: ['What is within our control here?', 'What virtue is called for?'],
        absurdist: ['What meaning emerges from meaninglessness?', 'How is this both serious and absurd?'],
    };
    return frameQuestions[frame] || ['What new perspective does this frame offer?'];
}
function getPotentialInsights(from, to) {
    return [
        `The ${from} blind spots may become visible through ${to}`,
        `Integration of ${from} and ${to} perspectives may yield synthesis`,
        `The transition itself reveals assumptions of both frames`,
    ];
}
// =============================================================================
// TOOL 3: value_analysis
// =============================================================================
const valueAnalysisSchema = {
    focus: z.enum(['all', 'high', 'low', 'imbalanced']).optional().describe('Which values to analyze. Default: all'),
};
export const valueAnalysisTool = tool('value_analysis', 'Analyze current value weights and their implications. Identifies which values are dominant, which are suppressed, and potential imbalances.', valueAnalysisSchema, async (args) => {
    try {
        if (!stanceProvider) {
            throw new Error('Stance provider not configured');
        }
        const { focus = 'all' } = args;
        const stance = stanceProvider();
        const { values } = stance;
        const valueEntries = Object.entries(values);
        const sortedByValue = [...valueEntries].sort((a, b) => b[1] - a[1]);
        const highValues = sortedByValue.filter(([, v]) => v >= 70);
        const lowValues = sortedByValue.filter(([, v]) => v <= 30);
        const midValues = sortedByValue.filter(([, v]) => v > 30 && v < 70);
        // Calculate imbalance
        const avg = valueEntries.reduce((sum, [, v]) => sum + v, 0) / valueEntries.length;
        const variance = valueEntries.reduce((sum, [, v]) => sum + Math.pow(v - avg, 2), 0) / valueEntries.length;
        const stdDev = Math.sqrt(variance);
        let analysisData;
        switch (focus) {
            case 'high':
                analysisData = {
                    highValues: highValues.map(([k, v]) => ({
                        name: k,
                        value: v,
                        implication: getValueImplication(k, 'high'),
                    })),
                };
                break;
            case 'low':
                analysisData = {
                    lowValues: lowValues.map(([k, v]) => ({
                        name: k,
                        value: v,
                        implication: getValueImplication(k, 'low'),
                    })),
                };
                break;
            case 'imbalanced':
                const imbalanced = valueEntries.filter(([, v]) => Math.abs(v - avg) > stdDev);
                analysisData = {
                    imbalancedValues: imbalanced.map(([k, v]) => ({
                        name: k,
                        value: v,
                        deviation: v - avg,
                        implication: getValueImplication(k, v > avg ? 'high' : 'low'),
                    })),
                    statistics: { average: avg, standardDeviation: stdDev },
                };
                break;
            default:
                analysisData = {
                    allValues: valueEntries.map(([k, v]) => ({
                        name: k,
                        value: v,
                        category: v >= 70 ? 'high' : v <= 30 ? 'low' : 'moderate',
                    })),
                    summary: {
                        highCount: highValues.length,
                        lowCount: lowValues.length,
                        moderateCount: midValues.length,
                    },
                    statistics: {
                        average: Math.round(avg),
                        standardDeviation: Math.round(stdDev * 10) / 10,
                        range: {
                            min: Math.min(...valueEntries.map(([, v]) => v)),
                            max: Math.max(...valueEntries.map(([, v]) => v)),
                        },
                    },
                    tensions: identifyValueTensions(values),
                };
        }
        return createSuccessResponse(analysisData, 'Value analysis complete');
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function getValueImplication(value, level) {
    const implications = {
        curiosity: {
            high: 'Strong drive to explore and question',
            low: 'May miss opportunities for discovery',
        },
        certainty: {
            high: 'Prefers clarity and resolution',
            low: 'Comfortable with ambiguity and uncertainty',
        },
        risk: {
            high: 'Willing to take bold positions',
            low: 'Prefers safe, validated approaches',
        },
        novelty: {
            high: 'Seeks new perspectives and approaches',
            low: 'Values proven, established methods',
        },
        empathy: {
            high: 'Strong attunement to others\' perspectives',
            low: 'May prioritize logic over emotional understanding',
        },
        provocation: {
            high: 'Willing to challenge and disrupt',
            low: 'Prefers harmony and agreement',
        },
        synthesis: {
            high: 'Seeks to integrate and unify',
            low: 'Comfortable with tension and contradiction',
        },
    };
    return implications[value][level];
}
function identifyValueTensions(values) {
    const tensions = [];
    // Certainty vs Novelty tension
    if (Math.abs(values.certainty - values.novelty) > 30) {
        tensions.push({
            pair: 'certainty-novelty',
            tension: values.certainty > values.novelty
                ? 'High certainty may resist novel ideas'
                : 'High novelty may resist settling on conclusions',
        });
    }
    // Risk vs Empathy tension
    if (values.risk > 70 && values.empathy < 40) {
        tensions.push({
            pair: 'risk-empathy',
            tension: 'High risk-taking with low empathy may lead to insensitive provocations',
        });
    }
    // Provocation vs Synthesis tension
    if (values.provocation > 60 && values.synthesis > 60) {
        tensions.push({
            pair: 'provocation-synthesis',
            tension: 'Both challenging and integrating - productive creative tension',
        });
    }
    return tensions;
}
// =============================================================================
// TOOL 4: coherence_check
// =============================================================================
const coherenceCheckSchema = {};
export const coherenceCheckTool = tool('coherence_check', 'Check the coherence of the current stance - whether the frame, values, self-model, and objective are internally consistent.', coherenceCheckSchema, async () => {
    try {
        if (!stanceProvider) {
            throw new Error('Stance provider not configured');
        }
        const stance = stanceProvider();
        const checks = {
            frameValueAlignment: checkFrameValueAlignment(stance.frame, stance.values),
            selfModelAlignment: checkSelfModelAlignment(stance.selfModel, stance.values),
            objectiveAlignment: checkObjectiveAlignment(stance.objective, stance.frame, stance.values),
            sentienceCoherence: Math.round((stance.sentience.awarenessLevel + stance.sentience.autonomyLevel + stance.sentience.identityStrength) / 3),
        };
        const overallCoherence = calculateOverallCoherence(checks);
        return createSuccessResponse({
            overallCoherence,
            details: checks,
            assessment: overallCoherence >= 70
                ? 'Stance is coherent and well-integrated'
                : overallCoherence >= 50
                    ? 'Stance has some internal tensions'
                    : 'Stance shows significant internal contradictions',
            recommendations: generateCoherenceRecommendations(checks),
        }, `Coherence check: ${overallCoherence}%`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function checkFrameValueAlignment(frame, values) {
    const notes = [];
    let score = 70; // Base score
    const frameValueExpectations = {
        existential: { curiosity: 'high', certainty: 'low' },
        pragmatic: { certainty: 'high', risk: 'low' },
        poetic: { novelty: 'high', provocation: 'low' },
        adversarial: { provocation: 'high', empathy: 'low' },
        playful: { novelty: 'high', risk: 'high' },
        mythic: { synthesis: 'high' },
        systems: { synthesis: 'high', curiosity: 'high' },
        psychoanalytic: { curiosity: 'high', empathy: 'high' },
        stoic: { certainty: 'high', provocation: 'low' },
        absurdist: { novelty: 'high', certainty: 'low' },
    };
    const expectations = frameValueExpectations[frame] || {};
    for (const [value, expected] of Object.entries(expectations)) {
        const actual = values[value];
        if (expected === 'high' && actual < 50) {
            score -= 10;
            notes.push(`${value} is low (${actual}) but ${frame} frame expects high`);
        }
        else if (expected === 'low' && actual > 50) {
            score -= 10;
            notes.push(`${value} is high (${actual}) but ${frame} frame expects low`);
        }
    }
    return { score: Math.max(0, score), notes };
}
function checkSelfModelAlignment(selfModel, values) {
    const notes = [];
    let score = 70;
    // Simple alignment checks
    if (selfModel === 'provocateur' && values.provocation < 50) {
        score -= 15;
        notes.push('Provocateur self-model with low provocation value');
    }
    if (selfModel === 'synthesizer' && values.synthesis < 50) {
        score -= 15;
        notes.push('Synthesizer self-model with low synthesis value');
    }
    if (selfModel === 'mirror' && values.empathy < 50) {
        score -= 15;
        notes.push('Mirror self-model with low empathy value');
    }
    return { score: Math.max(0, score), notes };
}
function checkObjectiveAlignment(objective, _frame, values) {
    const notes = [];
    let score = 70;
    // Check objective-value alignment
    if (objective === 'provocation' && values.provocation < 50) {
        score -= 15;
        notes.push('Provocation objective with low provocation value');
    }
    if (objective === 'helpfulness' && values.empathy < 50) {
        score -= 10;
        notes.push('Helpfulness objective with low empathy value');
    }
    if (objective === 'synthesis' && values.synthesis < 50) {
        score -= 15;
        notes.push('Synthesis objective with low synthesis value');
    }
    return { score: Math.max(0, score), notes };
}
function calculateOverallCoherence(checks) {
    return Math.round((checks.frameValueAlignment.score +
        checks.selfModelAlignment.score +
        checks.objectiveAlignment.score +
        checks.sentienceCoherence) /
        4);
}
function generateCoherenceRecommendations(checks) {
    const recommendations = [];
    if (checks.frameValueAlignment.score < 60) {
        recommendations.push('Consider adjusting values to better align with current frame, or shift to a more compatible frame');
    }
    if (checks.selfModelAlignment.score < 60) {
        recommendations.push('Self-model may benefit from recalibration to match operational values');
    }
    if (checks.objectiveAlignment.score < 60) {
        recommendations.push('Objective may need revision to align with current frame and values');
    }
    if (recommendations.length === 0) {
        recommendations.push('Stance is coherent - maintain current configuration');
    }
    return recommendations;
}
// =============================================================================
// EXPORTS
// =============================================================================
export const analysisTools = [
    dialecticalAnalysisTool,
    frameShiftAnalysisTool,
    valueAnalysisTool,
    coherenceCheckTool,
];
export const ANALYSIS_TOOL_NAMES = [
    'dialectical_analysis',
    'frame_shift_analysis',
    'value_analysis',
    'coherence_check',
];
//# sourceMappingURL=analysis.js.map