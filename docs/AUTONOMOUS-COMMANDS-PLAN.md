# Autonomous Slash Command Invocation Plan

## Overview

This plan outlines how to make slash commands (like `/memories`, `/evolution`, `/strategies`) invocable by the agent itself based on conversation context, or triggered automatically by hooks.

## Goals

1. **Agent-Invocable**: The LLM agent can choose to invoke commands when appropriate
2. **Hook-Triggered**: Commands fire automatically based on conversation patterns
3. **Consistent Behavior**: CLI and Server operate identically
4. **Transparent**: User sees when commands are invoked and why

---

## Architecture

### Current State
```
User Input → CLI Parser → Command Handler → Output
                ↓
            Chat Flow → Agent → Response
```

### Target State
```
User Input → CLI Parser → Command Handler → Output
                ↓                    ↑
            Chat Flow → Agent → Response
                ↓           ↑
            Hooks → Command Registry → Auto-Invoke
```

---

## Implementation Phases

### Phase 1: Command Registry & Interface

Create a unified command registry that both CLI and agent can access.

**New file: `src/commands/registry.ts`**

```typescript
interface CommandDefinition {
  name: string;                    // e.g., 'memories', 'evolution'
  aliases: string[];               // e.g., ['mem']
  description: string;             // For agent to understand when to use
  triggers: TriggerCondition[];    // When to auto-invoke
  execute: (agent: MetamorphAgent, args: string[]) => CommandResult;
  agentInvocable: boolean;         // Can agent call this?
  hookTriggerable: boolean;        // Can hooks auto-call this?
}

interface TriggerCondition {
  type: 'memory_query' | 'identity_question' | 'evolution_check' |
        'strategy_inquiry' | 'coherence_warning' | 'sentiment_shift';
  patterns?: RegExp[];             // Message patterns
  stanceConditions?: StanceCondition[];
  confidence: number;              // 0-1 threshold
}

interface CommandResult {
  output: string;                  // Text output
  data?: unknown;                  // Structured data
  shouldInjectIntoResponse: boolean;
}
```

### Phase 2: Refactor Existing Commands

Extract command logic from CLI into reusable functions.

**Example: `/memories` command**

```typescript
// src/commands/memories.ts
export const memoriesCommand: CommandDefinition = {
  name: 'memories',
  aliases: ['mem'],
  description: 'List and search stored memories (episodic, semantic, identity)',
  triggers: [
    {
      type: 'memory_query',
      patterns: [
        /remember when/i,
        /what do you recall/i,
        /earlier.*conversation/i,
        /you mentioned before/i
      ],
      confidence: 0.7
    }
  ],
  agentInvocable: true,
  hookTriggerable: true,
  execute: (agent, args) => {
    const type = args[0] as 'episodic' | 'semantic' | 'identity' | undefined;
    const memories = agent.searchMemories({ type, limit: 10 });
    return {
      output: formatMemoriesOutput(memories),
      data: memories,
      shouldInjectIntoResponse: true
    };
  }
};
```

### Phase 3: Hook Integration

Extend hooks to detect command triggers and auto-invoke.

**Modify: `src/agent/hooks.ts`**

```typescript
// In preTurn hook
async preTurn(context: PreTurnContext): Promise<PreTurnResult> {
  // ... existing trigger detection ...

  // NEW: Detect command triggers
  const commandTriggers = detectCommandTriggers(message, stance, conversationHistory);

  if (commandTriggers.length > 0) {
    const commandResults = await executeTriggeredCommands(
      commandTriggers,
      agent,
      context
    );

    // Inject command outputs into system prompt or context
    const commandContext = formatCommandResultsForContext(commandResults);
    systemPrompt = `${systemPrompt}\n\n[RELEVANT CONTEXT FROM SYSTEM]\n${commandContext}`;
  }

  return { systemPrompt, operators, stanceAfterPlan };
}
```

### Phase 4: Agent Tool Integration

Expose commands as tools the agent can call.

**New MCP tools or internal tools:**

```typescript
// src/tools/commands.ts
export const invokeCommandTool = tool(
  async (input, { agent }) => {
    const { command, args } = input;
    const result = await commandRegistry.execute(command, agent, args);
    return result.output;
  },
  'invoke_command',
  {
    command: z.string().describe('Command to invoke (memories, evolution, strategies, etc.)'),
    args: z.array(z.string()).optional().describe('Command arguments')
  }
);
```

### Phase 5: Transparent Invocation Logging

Show the user when commands are auto-invoked.

```typescript
// In CLI
if (autoInvokedCommands.length > 0) {
  console.log(chalk.gray(`\n  [Auto-invoked: ${autoInvokedCommands.join(', ')}]`));
}

// In Web UI
interface SystemMessage {
  type: 'command_invoked';
  command: string;
  reason: string;
  result: CommandResult;
}
```

---

## Command Trigger Mappings

| Command | Trigger Type | Example Patterns | Auto-Invoke |
|---------|-------------|------------------|-------------|
| `/memories` | memory_query | "remember when", "earlier you said" | Yes |
| `/evolution timeline` | evolution_check | "how have you changed", "your growth" | Yes |
| `/strategies` | strategy_inquiry | "what approach", "game plan" | Yes |
| `/coherence` | coherence_warning | Low coherence score detected | Yes (hook) |
| `/mood` | sentiment_shift | Emotional arc pattern detected | Yes (hook) |
| `/transformations` | transformation_query | "what happened there", "why the shift" | Yes |
| `/similar` | similarity_search | "like before", "related to" | Yes |
| `/identity` | identity_question | "who are you", "your values" | Yes |
| `/explore` | deep_investigation | Complex topic requiring exploration | Optional |

---

## Safeguards

1. **Rate Limiting**: Max 2 auto-invoked commands per turn
2. **User Override**: User can disable auto-invocation in config
3. **Transparency**: Always show what was invoked and why
4. **Relevance Check**: Agent validates command output before injecting

---

## Configuration

```typescript
// In ModeConfig
interface ModeConfig {
  // ... existing ...
  enableAutoCommands: boolean;        // Master toggle
  autoCommandThreshold: number;       // 0-1 confidence threshold
  maxAutoCommandsPerTurn: number;     // Rate limit
  autoCommandWhitelist: string[];     // Only these can auto-invoke
  autoCommandBlacklist: string[];     // Never auto-invoke these
}
```

---

## Implementation Order

1. **Create command registry** - Central place for all commands
2. **Extract 5 key commands** - memories, evolution, strategies, mood, coherence
3. **Add trigger detection** - Pattern matching in hooks
4. **Wire up auto-invocation** - Actually call commands from hooks
5. **Add agent tool** - Let agent explicitly invoke commands
6. **Add transparency layer** - Show user what's happening
7. **Add configuration** - Let users control behavior
8. **Test thoroughly** - Ensure CLI/Server parity

---

## Files to Create/Modify

### New Files
- `src/commands/registry.ts` - Command registry
- `src/commands/memories.ts` - Memories command
- `src/commands/evolution.ts` - Evolution command
- `src/commands/strategies.ts` - Strategies command
- `src/commands/coherence.ts` - Coherence command
- `src/commands/mood.ts` - Mood command
- `src/commands/index.ts` - Exports
- `src/tools/commands.ts` - Agent tool for commands

### Modified Files
- `src/cli/index.ts` - Use registry instead of inline handlers
- `src/agent/hooks.ts` - Add command trigger detection
- `src/server/index.ts` - Expose command API endpoints
- `src/types/index.ts` - Add command types
- `web/lib/api.ts` - Add command invocation

---

## Success Criteria

1. User asks "what do you remember about our earlier discussion" → Agent automatically recalls and incorporates relevant memories
2. User asks "how have you evolved during our conversation" → Agent automatically shows evolution timeline
3. Coherence drops below threshold → System automatically shows coherence report to agent
4. Emotional arc detects escalation → System automatically suggests de-escalation
5. All of this works identically in CLI and Web UI
