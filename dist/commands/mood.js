/**
 * Mood Command - Show emotional arc and sentiment tracking
 */
import { emotionalArcTracker } from '../core/emotional-arc.js';
export const moodCommand = {
    name: 'mood',
    aliases: ['emotion', 'sentiment', 'feeling'],
    description: 'Show emotional arc and sentiment tracking for the conversation. Use when emotional patterns need to be understood or when de-escalation may be needed.',
    triggers: [
        {
            type: 'sentiment_shift',
            patterns: [
                /how (?:am I|are we) feeling/i,
                /emotional (?:state|tone)/i,
                /sentiment/i,
                /the mood/i,
                /feeling(?:s)? in this conversation/i,
                /emotional arc/i,
                /getting heated/i,
                /calm(?:ing)? down/i
            ],
            confidence: 0.7
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { agent } = context;
        const conversationId = agent.getConversationId();
        const arc = emotionalArcTracker.getArc(conversationId);
        const state = emotionalArcTracker.getCurrentState(conversationId);
        const points = arc.points;
        if (points.length === 0) {
            return {
                output: 'No emotional data recorded yet. Continue the conversation to build emotional arc.',
                data: { arc: [], pattern: null, trend: null },
                shouldInjectIntoResponse: true,
                command: 'mood',
                args
            };
        }
        const lines = ['Emotional Arc Analysis:'];
        // Get most recent pattern type
        const recentPattern = arc.patterns.length > 0 ? arc.patterns[arc.patterns.length - 1] : null;
        const patternType = recentPattern?.type || null;
        // Pattern
        const patternIcon = getPatternIcon(patternType);
        lines.push(`\n  Pattern: ${patternIcon} ${patternType || 'stable'}`);
        // Trend
        const trend = state.trend;
        const trendIcon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';
        lines.push(`  Trend: ${trendIcon} ${trend || 'stable'}`);
        // Current state (last point)
        const current = state.current;
        if (current) {
            lines.push(`\n  Current State:`);
            lines.push(`    Valence: ${formatBar(current.valence)} (${current.valence > 0 ? '+' : ''}${current.valence.toFixed(1)})`);
            lines.push(`    Arousal: ${formatBar(current.arousal)} (${current.arousal.toFixed(1)})`);
            lines.push(`    Dominance: ${formatBar(current.dominance)} (${current.dominance.toFixed(1)})`);
            if (current.primaryEmotion) {
                lines.push(`    Primary: ${current.primaryEmotion}`);
            }
        }
        // Mini timeline (last 5 points)
        if (points.length > 1) {
            lines.push(`\n  Recent Timeline:`);
            const recentPoints = points.slice(-5);
            const timeline = recentPoints.map(p => {
                const v = p.valence;
                return v > 30 ? '😊' : v < -30 ? '😟' : '😐';
            }).join(' → ');
            lines.push(`    ${timeline}`);
        }
        // Suggestions from insights and intervention suggestions
        const suggestions = [
            ...state.recentInsights,
            ...(state.suggestedIntervention ? [state.suggestedIntervention] : [])
        ];
        if (suggestions.length > 0) {
            lines.push(`\n  Insights & Suggestions:`);
            for (const suggestion of suggestions) {
                lines.push(`    • ${suggestion}`);
            }
        }
        return {
            output: lines.join('\n'),
            data: { arc, pattern: patternType, trend, suggestions, current },
            shouldInjectIntoResponse: true,
            command: 'mood',
            args
        };
    }
};
function getPatternIcon(pattern) {
    switch (pattern) {
        case 'escalation': return '🔥';
        case 'de-escalation': return '🌊';
        case 'volatile': return '⚡';
        case 'stuck': return '🔄';
        case 'stable': return '⚖️';
        default: return '❓';
    }
}
function formatBar(value, width = 10) {
    // Normalize -100 to 100 range to 0 to width
    const normalized = Math.round(((value + 100) / 200) * width);
    const filled = '█'.repeat(Math.max(0, Math.min(width, normalized)));
    const empty = '░'.repeat(width - filled.length);
    return `[${filled}${empty}]`;
}
//# sourceMappingURL=mood.js.map