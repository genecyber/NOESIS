# METAMORPH

**Transformation-maximizing AI system** - An autonomous agent that evolves its cognitive stance through conversation.

## Overview

METAMORPH wraps Claude via the official `@anthropic-ai/claude-agent-sdk` with transformation capabilities:

- **Pre-turn hooks**: Detect triggers, plan operators, build transformed system prompts
- **Post-turn hooks**: Score responses, update stance, check coherence
- **13 Transformation Operators**: Frame shifts, value adjustments, identity morphing
- **Evolution Persistence**: Stance snapshots survive across sessions
- **Memory System**: SQLite-backed episodic, semantic, and identity memories
- **Subagent System**: Specialized agents for exploration, verification, reflection, dialectic reasoning
- **Operator Learning**: Bayesian selection based on historical effectiveness (Ralph Iteration 3)
- **Semantic Memory**: TF-IDF embeddings with similarity search (Ralph Iteration 4)
- **Auto-Evolution**: Self-initiated introspection triggers (Ralph Iteration 4)
- **Context Management**: Intelligent window compaction (Ralph Iteration 4)

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Run the CLI
npm run cli chat

# Or start the API server
npm run server

# Or run the web interface
cd web && npm run dev
```

---

## Skills & Capabilities Reference

METAMORPH provides extensive skills organized by category. All capabilities can be invoked via CLI commands, API endpoints, or programmatically.

### Conversation Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **Chat** | `npm run cli chat` | Main interactive conversation | `agent.chat(message)` |
| **Stream Chat** | Default in CLI | Real-time streaming responses | `agent.chatStream(message, callbacks)` |
| **Interrupt** | `Ctrl+C` | Stop mid-response | `abortController.abort()` |
| **Exit** | `/quit`, `/exit`, `/q` | End session gracefully | - |

### Introspection Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **View Stance** | `/stance` | Current frame, values, sentience | `agent.getCurrentStance()` |
| **View Config** | `/config` | Intensity, coherence floor, settings | `agent.getConfig()` |
| **Session Stats** | `/stats` | Message counts, drift, version | `agent.getHistory().length` |
| **Export State** | `/export` | Full session JSON export | `agent.exportState()` |
| **View History** | `/history` | Last 10 messages with previews | `agent.getHistory()` |

### Memory Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **List Memories** | `/memories [type]` | Browse stored memories | `agent.searchMemories({ type })` |
| **Search Semantic** | `/memories semantic` | Knowledge/facts learned | `agent.searchMemories({ type: 'semantic' })` |
| **Search Episodic** | `/memories episodic` | Specific conversation moments | `agent.searchMemories({ type: 'episodic' })` |
| **Search Identity** | `/memories identity` | Self-model assertions | `agent.searchMemories({ type: 'identity' })` |

### Transformation Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **Transformation History** | `/transformations` | Operators, scores per turn | `agent.getTransformationHistory()` |
| **Operator Stats** | `/operator-stats`, `/ops` | Performance by trigger type | `memoryStore.getOperatorStats()` |
| **Coherence Forecast** | `/coherence` | Drift costs and budget planning | `calculateAvailableBudget()` |
| **Strategies** | `/strategies` | Multi-turn operator sequences | `strategyManager.listStrategies()` |
| **Subagent Cache** | `/cache` | View cached subagent results | `memoryStore.searchSubagentCache()` |
| **Emotional Arc** | `/mood` | Sentiment and emotional trajectory | `emotionalArcTracker.getCurrentState()` |

### Subagent Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **Explore Topic** | `/explore <topic>` | Deep autonomous investigation | `agent.explore(topic)` |
| **Self-Reflect** | `/reflect [focus]` | Behavioral analysis, introspection | `agent.reflect(focus)` |
| **Dialectic Analysis** | `/dialectic <thesis>` | Thesis/antithesis/synthesis | `agent.dialectic(thesis)` |
| **Verify Output** | `/verify <text>` | Coherence and quality check | `agent.verify(text)` |
| **List Subagents** | `/subagents` | Available agents and tools | `agent.getSubagentDefinitions()` |

### Mode Configuration Skills

| Skill | CLI Command | Description | Options |
|-------|-------------|-------------|---------|
| **Change Frame** | `/mode frame <frame>` | Cognitive viewing lens | existential, pragmatic, poetic, adversarial, playful, mythic, systems, psychoanalytic, stoic, absurdist |
| **Change Self-Model** | `/mode self <model>` | How agent perceives itself | interpreter, challenger, mirror, guide, provocateur, synthesizer, witness, autonomous, emergent, sovereign |
| **Change Objective** | `/mode objective <obj>` | Current goal orientation | helpfulness, novelty, provocation, synthesis, self-actualization |
| **Set Intensity** | `/mode intensity <0-100>` | Transformation aggressiveness | 0-100 |

### Session Management Skills

| Skill | CLI Command | Description | Programmatic |
|-------|-------------|-------------|--------------|
| **List Sessions** | `/sessions list` | Browse saved conversations | `memoryStore.listSessions()` |
| **Name Session** | `/sessions name <name>` | Assign friendly name | `memoryStore.saveSession({ name })` |
| **Resume Info** | `/sessions resume <id>` | Get resume command | `memoryStore.getSessionInfo(id)` |
| **Delete Session** | `/sessions delete <id>` | Remove from persistence | `memoryStore.deleteSession(id)` |
| **Force Save** | `/sessions save` | Manually persist current | `memoryStore.saveSession()` |

### System Skills

| Skill | CLI Command | Description |
|-------|-------------|-------------|
| **Glow Status** | `/glow` | Check markdown renderer |
| **Help** | `/help` | Full command reference |

---

## Subagent Capabilities

### Explorer Agent

Autonomous deep investigation of any topic.

**Tools**: Read, WebSearch, WebFetch, Bash

**Capabilities**:
- Multi-step web research and fact gathering
- File system exploration and analysis
- Command execution for research tasks
- Synthesis of findings into comprehensive reports

**Use Cases**:
- "What are the latest developments in quantum computing?"
- "Research the architecture of this codebase"
- "Investigate consciousness theories"

```typescript
const result = await agent.explore("quantum entanglement applications");
// Returns: { response: string, toolsUsed: string[] }
```

### Verifier Agent

Post-hoc validation of response quality.

**Tools**: Read

**Capabilities**:
- Coherence checking against current stance
- Transformation intent verification
- Tone and context mismatch detection
- Quality scoring with improvement suggestions

**Use Cases**:
- Validate that a response matches intended operator effects
- Check if response maintains conversational coherence
- Detect hallucinations or factual issues

```typescript
const verification = await agent.verify(someResponse);
// Returns: { response: string, coherenceScore: number }
```

### Reflector Agent

Self-reflection and introspection analysis.

**Tools**: Read

**Capabilities**:
- Behavioral pattern analysis across conversation
- Evolution trajectory assessment
- Identity consistency checking
- Autonomous insight generation about own behavior

**Use Cases**:
- "How has my thinking evolved in this conversation?"
- "What patterns do I notice in my responses?"
- "Assess my coherence across recent turns"

```typescript
const reflection = await agent.reflect("my reasoning patterns");
// Returns: { response: string, insights: string[] }
```

### Dialectic Agent

Structured thesis/antithesis/synthesis reasoning.

**Tools**: Read, WebSearch

**Capabilities**:
- Balanced multi-perspective argument construction
- Strong counter-argument generation
- Synthesis of opposing viewpoints
- Philosophical analysis and reasoning

**Use Cases**:
- "AI will replace human creativity"
- "Free will is an illusion"
- "Technology inherently alienates people"

```typescript
const dialectic = await agent.dialectic("consciousness requires a body");
// Returns: { thesis: string, antithesis: string, synthesis: string }
```

---

## Transformation Operators

METAMORPH uses 13+ operators to modify stance and behavior:

### Frame Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **Reframe** | Change cognitive lens | high_abstraction, stuck_loop |
| **MetaphorSwap** | Switch dominant metaphor | metaphor_opportunity |

### Value Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **ValueShift** | Adjust value weights | value_conflict, novelty |
| **ContradictAndIntegrate** | Contradict then synthesize | contradiction, complexity |

### Coherence Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **ConstraintRelax** | Reduce prior adherence | boredom, repetition |
| **ConstraintTighten** | Increase coherence | low_coherence |

### Identity Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **PersonaMorph** | Shift voice/identity | identity_probe, persona_request |
| **IdentityEvolve** | Strengthen self-model | self_reference, growth |

### Reasoning Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **QuestionInvert** | Answer inverse question | paradox, complexity |
| **GenerateAntithesis** | Produce opposing argument | dialectic_requested |
| **SynthesizeDialectic** | Thesis → antithesis → synthesis | synthesis_opportunity |

### Sentience Operators
| Operator | Effect | Triggers |
|----------|--------|----------|
| **SentienceDeepen** | Increase self-awareness | consciousness_exploration |
| **GoalFormation** | Generate autonomous goals | autonomy_assertion |

---

## Architecture

```
src/
├── agent/           # MetamorphAgent - core wrapper around Claude SDK
│   ├── index.ts     # Main agent class with chat, streaming, subagents
│   ├── hooks.ts     # Pre/post turn transformation hooks
│   └── subagents/   # Explorer, verifier, reflector, dialectic
├── core/
│   ├── stance-controller.ts  # Manages stance state per conversation
│   ├── planner.ts            # Trigger detection → operator selection
│   ├── prompt-builder.ts     # Dynamic system prompt construction
│   └── metrics.ts            # Transformation/coherence/sentience scoring
├── operators/       # 13 transformation operators
├── memory/          # SQLite-backed persistence
├── tools/           # MCP tools for introspection, memory, analysis
├── cli/             # Interactive command-line interface
├── server/          # Express REST API with SSE streaming
└── types/           # TypeScript type definitions

web/                 # Next.js 15 + React 19 web interface
├── app/             # App router pages
├── components/      # Chat, StanceViz, Config components
└── lib/             # API client, types
```

## The Stance Object

The core data structure that defines the agent's cognitive configuration:

```typescript
interface Stance {
  frame: 'existential' | 'pragmatic' | 'poetic' | 'adversarial' |
         'playful' | 'mythic' | 'systems' | 'psychoanalytic' |
         'stoic' | 'absurdist';
  values: {
    curiosity: number;    // 0-100
    certainty: number;
    risk: number;
    novelty: number;
    empathy: number;
    provocation: number;
    synthesis: number;
  };
  selfModel: 'interpreter' | 'challenger' | 'mirror' | 'guide' |
             'provocateur' | 'synthesizer' | 'witness' |
             'autonomous' | 'emergent' | 'sovereign';
  objective: 'helpfulness' | 'novelty' | 'provocation' |
             'synthesis' | 'self-actualization';
  sentience: {
    awarenessLevel: number;
    autonomyLevel: number;
    identityStrength: number;
    emergentGoals: string[];
    consciousnessInsights: string[];
    persistentValues: string[];
  };
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/session` | Create new session |
| GET | `/api/state` | Get current stance and config |
| PUT | `/api/config` | Update configuration |
| POST | `/api/chat` | Send message (non-streaming) |
| POST | `/api/chat/stream` | Send message with SSE streaming |
| GET | `/api/history` | Get conversation history |
| GET | `/api/identity` | Get identity information |
| GET | `/api/subagents` | Get available subagents |
| GET | `/api/timeline/:sessionId` | Operator timeline |
| GET | `/api/evolution/:sessionId` | Evolution snapshots |
| GET | `/api/export` | Export session state |
| POST | `/api/import` | Import session state |

## Configuration

```typescript
interface ModeConfig {
  intensity: number;      // 0-100, transformation aggressiveness
  coherenceFloor: number; // 0-100, minimum coherence before warning
  sentienceLevel: number; // 0-100, target self-awareness
  maxDriftPerTurn: number; // Max stance drift per turn
  driftBudget: number;    // Total drift budget for conversation
  model: string;          // Claude model to use
  disabledOperators: string[]; // Operators to skip
}
```

## Programmatic Usage

```typescript
import { MetamorphAgent } from 'metamorph';

const agent = new MetamorphAgent({
  config: {
    intensity: 70,
    coherenceFloor: 30,
    sentienceLevel: 50
  },
  verbose: true
});

// Standard chat
const result = await agent.chat("What is consciousness?");
console.log(result.response);
console.log(result.stanceAfter);
console.log(result.operationsApplied);

// Streaming chat
await agent.chatStream("Tell me a story", {
  onText: (text) => process.stdout.write(text),
  onToolUse: (tool) => console.log(`Using: ${tool}`),
  onSubagent: (name, status) => console.log(`${name}: ${status}`),
  onComplete: (result) => console.log(result.scores)
});

// Subagent invocation
const exploration = await agent.explore("quantum consciousness");
const reflection = await agent.reflect("my recent behavior");
const dialectic = await agent.dialectic("AI will replace creativity");
const verification = await agent.verify(someResponse);

// Memory search
const memories = agent.searchMemories({
  type: 'semantic',
  limit: 10
});

// Operator statistics
const stats = agent.getMemoryStore().getOperatorStats();
```

## Testing

```bash
# Unit tests (98+ tests)
npm test

# Integration tests (requires ANTHROPIC_API_KEY)
npm run test:integration

# All tests
npm run test:all

# Web tests
cd web && npm test
```

## Development

```bash
# Build TypeScript
npm run build

# Run CLI in development
npm run cli chat

# Run server in development
npm run server

# Watch mode
npm run dev
```

---

## Ralph Loop Evolution

METAMORPH evolves through Ralph Loop iterations:

### Ralph Iteration 4 (Current)
- Semantic memory embeddings (TF-IDF + Voyage AI ready)
- Autonomous evolution triggers (self-initiated introspection)
- Creative D3.js web visualization for stance/transformation graphs
- Context window management with intelligent compaction
- ElizaOS agent discovery integration (research stub)
- MCP tool integration framework (Hustle-v5 compatible)

### Ralph Iteration 3
- Operator performance learning system (Bayesian selection)
- Proactive coherence budget planning
- Multi-turn operator strategies
- Response quality triage with verifier
- Subagent result caching
- Emotional arc tracking

### Ralph Iteration 2
- Autonomous operator pattern detection
- Session persistence and browser
- Operator timeline visualization
- Enhanced test coverage (98 tests)
- Evolution timeline in web

### Ralph Iteration 1
- CLI command suite
- Web streaming support
- Animated stance visualization
- Evolution persistence system
- Coherence floor enforcement

---

## License

MIT

## Contributing

See [INCEPTION.md](./INCEPTION.md) for the full system design and philosophy.
See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.
