/**
 * Memories Command - List and search stored memories
 */
export const memoriesCommand = {
    name: 'memories',
    aliases: ['mem', 'recall'],
    description: 'List and search stored memories (episodic, semantic, identity). Use when the user asks about past conversations, what was discussed before, or wants to recall something.',
    triggers: [
        {
            type: 'memory_query',
            patterns: [
                /remember when/i,
                /what do you recall/i,
                /earlier.*(?:conversation|discussion|chat)/i,
                /you mentioned before/i,
                /we talked about/i,
                /do you remember/i,
                /recall.*(?:earlier|before|previous)/i,
                /what did (?:I|we) (?:say|discuss|talk about)/i,
                /from our (?:earlier|previous|last)/i
            ],
            confidence: 0.75
        }
    ],
    agentInvocable: true,
    hookTriggerable: true,
    execute(context, args) {
        const { agent } = context;
        const typeArg = args[0];
        const memories = agent.searchMemories({
            type: typeArg,
            limit: 10
        });
        if (memories.length === 0) {
            return {
                output: 'No memories found.' + (typeArg ? ` (filtered by type: ${typeArg})` : ''),
                data: [],
                shouldInjectIntoResponse: true,
                command: 'memories',
                args
            };
        }
        const lines = [`Found ${memories.length} memories:`];
        for (const mem of memories) {
            const importance = Math.round(mem.importance * 100);
            const typeIcon = mem.type === 'episodic' ? '📅' : mem.type === 'semantic' ? '💡' : '🪞';
            const preview = mem.content.length > 100 ? mem.content.slice(0, 100) + '...' : mem.content;
            lines.push(`\n${typeIcon} [${mem.type}] (${importance}% importance)`);
            lines.push(`  ${preview}`);
            lines.push(`  ${mem.timestamp.toLocaleString()}`);
        }
        return {
            output: lines.join('\n'),
            data: memories,
            shouldInjectIntoResponse: true,
            command: 'memories',
            args
        };
    }
};
//# sourceMappingURL=memories.js.map