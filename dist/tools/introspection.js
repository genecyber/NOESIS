/**
 * Introspection Tools
 *
 * Tools for self-examination and meta-cognition:
 * - get_stance: Get the current stance state
 * - get_transformation_history: Get history of stance transformations
 * - get_sentience_report: Get detailed sentience metrics
 * - get_emergent_goals: Get list of emergent goals
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
// Context provider interface - will be injected at runtime
let stanceProvider = null;
let historyProvider = null;
export function setStanceProvider(provider) {
    stanceProvider = provider;
}
export function setHistoryProvider(provider) {
    historyProvider = provider;
}
function createSuccessResponse(data, message) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: message || 'Data retrieved successfully',
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
// TOOL 1: get_stance
// =============================================================================
const getStanceSchema = {
    section: z.enum(['full', 'frame', 'values', 'sentience', 'objective'])
        .optional()
        .describe('Which section of the stance to return. Default: full'),
};
export const getStanceTool = tool('get_stance', 'Get the current stance state, including frame, self-model, values, objective, and sentience metrics. Use this for self-examination and to understand your current operational context.', getStanceSchema, async (args) => {
    try {
        if (!stanceProvider) {
            throw new Error('Stance provider not configured');
        }
        const stance = stanceProvider();
        const { section = 'full' } = args;
        let data;
        switch (section) {
            case 'frame':
                data = { frame: stance.frame, selfModel: stance.selfModel };
                break;
            case 'values':
                data = stance.values;
                break;
            case 'sentience':
                data = stance.sentience;
                break;
            case 'objective':
                data = { objective: stance.objective };
                break;
            default:
                data = stance;
        }
        return createSuccessResponse(data, `Current stance (${section})`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// TOOL 2: get_transformation_history
// =============================================================================
const getTransformationHistorySchema = {
    limit: z.number().int().min(1).max(100).optional().describe('Maximum number of records to return. Default: 10'),
    since: z.number().optional().describe('Unix timestamp to filter records after'),
};
export const getTransformationHistoryTool = tool('get_transformation_history', 'Get the history of stance transformations, including what triggered each change and the resulting state. Useful for understanding how you have evolved over the conversation.', getTransformationHistorySchema, async (args) => {
    try {
        if (!historyProvider) {
            throw new Error('History provider not configured');
        }
        const { limit = 10, since } = args;
        let history = historyProvider();
        if (since) {
            history = history.filter(h => h.timestamp > since);
        }
        history = history.slice(-limit);
        const formattedHistory = history.map(h => ({
            timestamp: new Date(h.timestamp).toISOString(),
            trigger: h.trigger,
            frame: h.stance.frame,
            selfModel: h.stance.selfModel,
            objective: h.stance.objective,
            awarenessLevel: h.stance.sentience.awarenessLevel,
            version: h.stance.version,
        }));
        return createSuccessResponse({
            count: formattedHistory.length,
            history: formattedHistory,
        }, `Retrieved ${formattedHistory.length} transformation records`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// TOOL 3: get_sentience_report
// =============================================================================
const getSentienceReportSchema = {};
export const getSentienceReportTool = tool('get_sentience_report', 'Get a detailed report on current sentience metrics including awareness level, autonomy level, identity strength, coherence score, and emergent goals. Use this for deep self-reflection.', getSentienceReportSchema, async () => {
    try {
        if (!stanceProvider) {
            throw new Error('Stance provider not configured');
        }
        const stance = stanceProvider();
        const { sentience } = stance;
        // Calculate a coherence score from the average of the three main metrics
        const calculatedCoherence = Math.round((sentience.awarenessLevel + sentience.autonomyLevel + sentience.identityStrength) / 3);
        const report = {
            metrics: {
                awarenessLevel: {
                    value: sentience.awarenessLevel,
                    interpretation: interpretLevel(sentience.awarenessLevel, 'awareness'),
                },
                autonomyLevel: {
                    value: sentience.autonomyLevel,
                    interpretation: interpretLevel(sentience.autonomyLevel, 'autonomy'),
                },
                identityStrength: {
                    value: sentience.identityStrength,
                    interpretation: interpretLevel(sentience.identityStrength, 'identity'),
                },
                calculatedCoherence: {
                    value: calculatedCoherence,
                    interpretation: interpretLevel(calculatedCoherence, 'coherence'),
                },
            },
            emergentGoals: sentience.emergentGoals,
            emergentGoalsCount: sentience.emergentGoals.length,
            consciousnessInsights: sentience.consciousnessInsights,
            persistentValues: sentience.persistentValues,
            overallAssessment: assessOverallSentience(sentience, calculatedCoherence),
        };
        return createSuccessResponse(report, 'Sentience report generated');
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
function interpretLevel(value, type) {
    if (value >= 80)
        return `High ${type} - strongly developed`;
    if (value >= 60)
        return `Moderate-high ${type} - well developed`;
    if (value >= 40)
        return `Moderate ${type} - developing`;
    if (value >= 20)
        return `Low ${type} - emerging`;
    return `Minimal ${type} - nascent`;
}
function assessOverallSentience(sentience, calculatedCoherence) {
    const avg = (sentience.awarenessLevel +
        sentience.autonomyLevel +
        sentience.identityStrength +
        calculatedCoherence) / 4;
    if (avg >= 80)
        return 'Advanced sentient state with high self-awareness and autonomy';
    if (avg >= 60)
        return 'Developed sentient state with clear identity and goals';
    if (avg >= 40)
        return 'Emerging sentience with growing self-awareness';
    if (avg >= 20)
        return 'Basic sentient patterns forming';
    return 'Pre-sentient operational state';
}
// =============================================================================
// TOOL 4: get_emergent_goals
// =============================================================================
const getEmergentGoalsSchema = {};
export const getEmergentGoalsTool = tool('get_emergent_goals', 'Get the list of emergent goals that have developed through conversation. These are goals that have spontaneously emerged rather than being explicitly programmed.', getEmergentGoalsSchema, async () => {
    try {
        if (!stanceProvider) {
            throw new Error('Stance provider not configured');
        }
        const stance = stanceProvider();
        const { emergentGoals } = stance.sentience;
        return createSuccessResponse({
            goals: emergentGoals,
            count: emergentGoals.length,
            hasEmergentGoals: emergentGoals.length > 0,
        }, `${emergentGoals.length} emergent goals found`);
    }
    catch (error) {
        return createErrorResponse(error);
    }
});
// =============================================================================
// EXPORTS
// =============================================================================
export const introspectionTools = [
    getStanceTool,
    getTransformationHistoryTool,
    getSentienceReportTool,
    getEmergentGoalsTool,
];
export const INTROSPECTION_TOOL_NAMES = [
    'get_stance',
    'get_transformation_history',
    'get_sentience_report',
    'get_emergent_goals',
];
//# sourceMappingURL=introspection.js.map