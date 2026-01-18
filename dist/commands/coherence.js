/**
 * Coherence Command - Show coherence forecast and budget
 */
import { generateCoherenceForecast, calculateAvailableBudget, OPERATOR_DRIFT_COSTS } from '../core/coherence-planner.js';
import { getRegistry } from '../operators/base.js';
export const coherenceCommand = {
    name: 'coherence',
    aliases: ['coh', 'budget'],
    description: 'Show coherence forecast, available budget, and operator drift costs. Auto-triggered when coherence is low.',
    triggers: [
        {
            type: 'coherence_warning',
            patterns: [
                /coherence/i,
                /drift budget/i,
                /operator costs/i,
                /staying consistent/i,
                /losing coherence/i
            ],
            stanceConditions: [
                // Also trigger when cumulative drift is high relative to threshold
                { field: 'cumulativeDrift', operator: 'gt', value: 50 }
            ],
            confidence: 0.65
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { stance, config } = context;
        const registry = getRegistry();
        // Get all operators for forecast
        const allOperators = registry.getAll().map(op => ({
            name: op.name,
            description: op.description,
            promptInjection: '',
            stanceDelta: {} // Empty delta for forecast purposes
        }));
        // Generate forecast with sample operators
        const forecast = generateCoherenceForecast(allOperators.slice(0, 3), stance, config);
        const availableBudget = calculateAvailableBudget(stance, config);
        const lines = ['Coherence Analysis:'];
        // Current state
        lines.push(`\n  Current State:`);
        lines.push(`    Cumulative Drift: ${stance.cumulativeDrift}`);
        lines.push(`    Turns Since Shift: ${stance.turnsSinceLastShift}`);
        lines.push(`    Coherence Floor: ${config.coherenceFloor}`);
        // Budget
        lines.push(`\n  Budget:`);
        lines.push(`    Available: ${availableBudget.toFixed(1)}`);
        lines.push(`    Reserve: ${config.coherenceReserveBudget || 10}`);
        lines.push(`    Max Drift/Turn: ${config.maxDriftPerTurn}`);
        // Risk level
        const riskIcon = forecast.riskLevel === 'critical' ? '🔴'
            : forecast.riskLevel === 'high' ? '🟠'
                : forecast.riskLevel === 'medium' ? '🟡'
                    : '🟢';
        lines.push(`\n  Risk Level: ${riskIcon} ${forecast.riskLevel.toUpperCase()}`);
        lines.push(`    Predicted Drift: ${forecast.predictedDrift}`);
        lines.push(`    Would Exceed Budget: ${forecast.willExceed ? 'YES ⚠️' : 'No'}`);
        // Operator costs reference
        lines.push(`\n  Operator Drift Costs:`);
        const costEntries = Object.entries(OPERATOR_DRIFT_COSTS)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);
        for (const [op, cost] of costEntries) {
            const bar = '█'.repeat(Math.min(10, Math.round(cost / 2)));
            lines.push(`    ${op.padEnd(20)} ${bar} (${cost})`);
        }
        // Recommendations
        if (forecast.riskLevel === 'critical' || forecast.riskLevel === 'high') {
            lines.push(`\n  Recommendations:`);
            lines.push(`    • Use lower-drift operators (Reframe, MetaphorSwap)`);
            lines.push(`    • Avoid high-drift operators (PersonaMorph, SentienceDeepen)`);
            lines.push(`    • Consider /strategies coherence_recovery`);
        }
        return {
            output: lines.join('\n'),
            data: { forecast, availableBudget, stance: { cumulativeDrift: stance.cumulativeDrift } },
            shouldInjectIntoResponse: true,
            command: 'coherence',
            args
        };
    }
};
//# sourceMappingURL=coherence.js.map