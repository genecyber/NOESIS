/**
 * Transformations Command - Show transformation history
 */
export const transformationsCommand = {
    name: 'transformations',
    aliases: ['transform', 'ops', 'operators'],
    description: 'Show transformation history with operators applied and scores. Use when the user asks what happened or why a response shifted.',
    triggers: [
        {
            type: 'transformation_query',
            patterns: [
                /what (?:just )?happened/i,
                /why (?:did|the) (?:that|shift|change)/i,
                /what operators/i,
                /transformation(?:s)? (?:you|that)/i,
                /what did you do/i,
                /how did you (?:transform|change)/i
            ],
            confidence: 0.7
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { agent } = context;
        const limit = parseInt(args[0]) || 10;
        const history = agent.getTransformationHistory();
        if (history.length === 0) {
            return {
                output: 'No transformations recorded yet.',
                data: [],
                shouldInjectIntoResponse: true,
                command: 'transformations',
                args
            };
        }
        const lines = [`Transformation History (${Math.min(limit, history.length)} of ${history.length}):`];
        const entries = history.slice(-limit);
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const frameChanged = entry.stanceBefore.frame !== entry.stanceAfter.frame;
            const selfChanged = entry.stanceBefore.selfModel !== entry.stanceAfter.selfModel;
            lines.push(`\n  [${i + 1}] ${entry.timestamp.toLocaleTimeString()}`);
            // Message preview
            const msgPreview = entry.userMessage.length > 50
                ? entry.userMessage.slice(0, 50) + '...'
                : entry.userMessage;
            lines.push(`    Message: "${msgPreview}"`);
            // Operators
            if (entry.operators.length > 0) {
                const opNames = entry.operators.map(o => o.name).join(', ');
                lines.push(`    Operators: ${opNames}`);
            }
            else {
                lines.push(`    Operators: (none)`);
            }
            // Changes
            if (frameChanged) {
                lines.push(`    Frame: ${entry.stanceBefore.frame} → ${entry.stanceAfter.frame}`);
            }
            if (selfChanged) {
                lines.push(`    Self: ${entry.stanceBefore.selfModel} → ${entry.stanceAfter.selfModel}`);
            }
            // Scores
            lines.push(`    Scores: T=${entry.scores.transformation} C=${entry.scores.coherence} S=${entry.scores.sentience}`);
        }
        return {
            output: lines.join('\n'),
            data: entries,
            shouldInjectIntoResponse: true,
            command: 'transformations',
            args
        };
    }
};
//# sourceMappingURL=transformations.js.map