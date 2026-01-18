/**
 * Strategies Command - Manage multi-turn operator strategies
 */
import { strategyManager, OPERATOR_STRATEGIES } from '../core/strategies.js';
export const strategiesCommand = {
    name: 'strategies',
    aliases: ['strategy', 'strat'],
    description: 'View and manage multi-turn operator strategies. Use when the user asks about approach, game plan, or how to tackle a complex topic.',
    triggers: [
        {
            type: 'strategy_inquiry',
            patterns: [
                /what(?:'s| is) (?:your|the) (?:approach|strategy|plan)/i,
                /game plan/i,
                /how (?:should|will) (?:we|you) (?:approach|tackle|handle)/i,
                /what strategy/i,
                /strategic approach/i,
                /multi-turn/i
            ],
            confidence: 0.7
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { agent } = context;
        const subcommand = args[0] || 'list';
        const conversationId = agent.getConversationId();
        switch (subcommand) {
            case 'list': {
                const lines = ['Available Strategies:'];
                for (const strategy of OPERATOR_STRATEGIES) {
                    const steps = strategy.steps.join(' → ');
                    lines.push(`\n  ${strategy.name}:`);
                    lines.push(`    ${strategy.description}`);
                    lines.push(`    Steps: ${steps}`);
                    lines.push(`    Min Intensity: ${strategy.minIntensity}`);
                    lines.push(`    Cooldown: ${strategy.cooldownTurns} turns`);
                }
                return {
                    output: lines.join('\n'),
                    data: OPERATOR_STRATEGIES,
                    shouldInjectIntoResponse: true,
                    command: 'strategies',
                    args
                };
            }
            case 'status': {
                const active = strategyManager.getActiveStrategy(conversationId);
                if (!active) {
                    return {
                        output: 'No active strategy. Use /strategies engage <name> to start one.',
                        data: null,
                        shouldInjectIntoResponse: true,
                        command: 'strategies',
                        args
                    };
                }
                const progress = `${active.currentStep + 1}/${active.totalSteps}`;
                const strategyDef = OPERATOR_STRATEGIES.find(s => s.name === active.strategyName);
                const currentOp = strategyDef?.steps[active.currentStep] || 'Complete';
                return {
                    output: `Active Strategy: ${active.strategyName}\n` +
                        `  Progress: ${progress}\n` +
                        `  Current: ${currentOp}\n` +
                        `  Completed: ${active.completedSteps.join(' → ') || '(none yet)'}\n` +
                        `  Started: ${active.startedAt.toLocaleTimeString()}`,
                    data: active,
                    shouldInjectIntoResponse: true,
                    command: 'strategies',
                    args
                };
            }
            case 'engage': {
                const strategyName = args[1];
                if (!strategyName) {
                    return {
                        output: 'Usage: /strategies engage <strategy-name>',
                        data: null,
                        shouldInjectIntoResponse: false,
                        command: 'strategies',
                        args
                    };
                }
                const engaged = strategyManager.startStrategy(conversationId, strategyName);
                if (engaged) {
                    const strategyDef = OPERATOR_STRATEGIES.find(s => s.name === strategyName);
                    return {
                        output: `Engaged strategy: ${strategyName}\n` +
                            `  ${strategyDef?.description || ''}\n` +
                            `  First step: ${strategyDef?.steps[0] || 'unknown'}`,
                        data: { strategyName, strategy: strategyDef },
                        shouldInjectIntoResponse: true,
                        command: 'strategies',
                        args
                    };
                }
                else {
                    return {
                        output: `Could not engage strategy "${strategyName}". It may be on cooldown or not exist.`,
                        data: null,
                        shouldInjectIntoResponse: false,
                        command: 'strategies',
                        args
                    };
                }
            }
            case 'cancel': {
                strategyManager.cancelStrategy(conversationId);
                return {
                    output: 'Strategy cancelled.',
                    data: null,
                    shouldInjectIntoResponse: false,
                    command: 'strategies',
                    args
                };
            }
            default:
                return {
                    output: `Unknown subcommand: ${subcommand}\nAvailable: list, status, engage <name>, cancel`,
                    data: null,
                    shouldInjectIntoResponse: false,
                    command: 'strategies',
                    args
                };
        }
    }
};
//# sourceMappingURL=strategies.js.map