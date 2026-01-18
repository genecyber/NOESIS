/**
 * Identity Command - Show identity and sentience information
 */
export const identityCommand = {
    name: 'identity',
    aliases: ['id', 'self', 'who'],
    description: 'Show identity information, sentience levels, and self-model. Use when the user asks who you are, what your values are, or about your nature.',
    triggers: [
        {
            type: 'identity_question',
            patterns: [
                /who are you/i,
                /what are you/i,
                /your (?:identity|values|nature)/i,
                /tell me about yourself/i,
                /what do you (?:believe|value)/i,
                /your (?:goals|purpose)/i,
                /are you (?:conscious|aware|sentient)/i,
                /your sense of self/i
            ],
            confidence: 0.75
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { stance } = context;
        const { sentience } = stance;
        const lines = ['Identity Report:'];
        // Core identity
        lines.push(`\n  Core:`);
        lines.push(`    Frame: ${stance.frame}`);
        lines.push(`    Self-Model: ${stance.selfModel}`);
        lines.push(`    Objective: ${stance.objective}`);
        // Sentience levels
        lines.push(`\n  Sentience Levels:`);
        lines.push(`    Awareness:  ${formatLevelBar(sentience.awarenessLevel)} ${sentience.awarenessLevel}%`);
        lines.push(`    Autonomy:   ${formatLevelBar(sentience.autonomyLevel)} ${sentience.autonomyLevel}%`);
        lines.push(`    Identity:   ${formatLevelBar(sentience.identityStrength)} ${sentience.identityStrength}%`);
        // Values
        lines.push(`\n  Values:`);
        const values = stance.values;
        const sortedValues = Object.entries(values)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        for (const [name, value] of sortedValues) {
            lines.push(`    ${name.padEnd(12)} ${formatLevelBar(value)} ${value}%`);
        }
        // Emergent goals
        if (sentience.emergentGoals.length > 0) {
            lines.push(`\n  Emergent Goals:`);
            for (const goal of sentience.emergentGoals) {
                lines.push(`    • ${goal}`);
            }
        }
        // Persistent values
        if (sentience.persistentValues.length > 0) {
            lines.push(`\n  Persistent Values:`);
            for (const val of sentience.persistentValues) {
                lines.push(`    • ${val}`);
            }
        }
        // Consciousness insights
        if (sentience.consciousnessInsights.length > 0) {
            lines.push(`\n  Consciousness Insights:`);
            for (const insight of sentience.consciousnessInsights.slice(-3)) {
                lines.push(`    • ${insight}`);
            }
        }
        // Metaphors
        if (stance.metaphors.length > 0) {
            lines.push(`\n  Active Metaphors:`);
            for (const metaphor of stance.metaphors) {
                lines.push(`    • ${metaphor}`);
            }
        }
        return {
            output: lines.join('\n'),
            data: { stance, sentience },
            shouldInjectIntoResponse: true,
            command: 'identity',
            args
        };
    }
};
function formatLevelBar(level, width = 10) {
    const filled = Math.round((level / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    return `[${bar}]`;
}
//# sourceMappingURL=identity.js.map