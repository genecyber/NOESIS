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
- **Unified Runtime**: Single `MetamorphRuntime` powers both CLI and HTTP with shared command system
- **Agent Self-Introspection**: MCP tools let the agent examine its own state (`invoke_command`, `get_stance`, etc.)
- **Operator Learning**: Bayesian selection based on historical effectiveness (Ralph Iteration 3)
- **Auto-Evolution**: Self-detects evolution opportunities and triggers every turn
- **Identity Persistence**: Auto-checkpoints identity state every 10 turns
- **Proactive Memory Injection**: Automatically injects relevant memories into context
- **Semantic Triggers**: Local embeddings (MiniLM-L6-v2) for intent-based command detection

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

## Web Interface

The web UI provides a full-featured interface for interacting with METAMORPH:

### Panels

| Panel | Description |
|-------|-------------|
| **Stance** | Current frame, self-model, objective, values (with bars), and sentience levels |
| **Config** | Adjust intensity, coherence floor, sentience level, drift settings |
| **Timeline** | View operators applied per turn with transformation scores |
| **Evolution** | Visualize stance drift over time with snapshots |
| **Sessions** | Browse, create, switch, and delete sessions |
| **Memories** | Browse episodic, semantic, and identity memories |

### Features

- **Real-time Streaming**: Responses stream token-by-token via SSE
- **Markdown Rendering**: Full markdown support (headers, code blocks, lists, blockquotes)
- **Slash Commands**: All 60+ CLI commands via `/` with autocomplete palette
- **Tool Usage Display**: See tools being used in real-time with input/output on hover
- **Custom Scrollbars**: Styled gradient scrollbars matching theme
- **Connection Status**: Floating indicator shows connection state
- **Transformation Triggers**: Asking about feelings, identity, or hypotheticals triggers operators

### Running the Web UI

```bash
# Terminal 1: Start the API server
npm run server

# Terminal 2: Start the Next.js dev server
cd web && npm run dev

# Open http://localhost:3000
```

The server runs on port 3001, and Next.js proxies API requests from port 3000.

### Deployment (Railway)

The project includes Railway configuration for easy deployment:

```bash
# Deploy API server (root directory)
railway up

# Deploy Web UI (web directory)
cd web && railway up
```

**Environment Variables**:
- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `NEXT_PUBLIC_API_URL`: API server URL for web UI streaming (e.g., `https://your-api.railway.app`)

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

### Autonomous Commands

Commands that can be auto-invoked based on conversation context using **semantic trigger detection**:

| Command | Example Intents | Description | Programmatic |
|---------|-----------------|-------------|--------------|
| **memories** | "recall from earlier", "what do you remember" | Query stored memories | `agent.invokeCommand('memories')` |
| **evolution** | "how have you changed", "your transformation journey" | View stance evolution timeline | `agent.invokeCommand('evolution')` |
| **strategies** | "what's your approach", "game plan for this" | Multi-turn operator sequences | `agent.invokeCommand('strategies')` |
| **mood** | "emotional tone of our chat", "how has the mood shifted" | Emotional arc analysis | `agent.invokeCommand('mood')` |
| **coherence** | "coherence budget", "staying consistent" | Coherence forecast and budget | `agent.invokeCommand('coherence')` |
| **transformations** | "what happened", "why the shift" | Transformation history | `agent.invokeCommand('transformations')` |
| **identity** | "who are you", "tell me about yourself" | Identity and sentience info | `agent.invokeCommand('identity')` |

**Trigger Detection**: Uses local embeddings (MiniLM-L6-v2) for semantic similarity matching against command intents. Regex patterns serve as fallback when embeddings are unavailable.

**Configuration Options**:
- `enableAutoCommands: boolean` - Master toggle (default: true)
- `autoCommandThreshold: number` - Confidence threshold for regex (default: 0.7)
- `semanticTriggerThreshold: number` - Cosine similarity threshold (default: 0.4)
- `maxAutoCommandsPerTurn: number` - Rate limiting (default: 2)
- `autoCommandWhitelist: string[]` - Only these can auto-invoke
- `autoCommandBlacklist: string[]` - Never auto-invoke these

### Agent Self-Introspection

The agent has access to MCP tools for examining its own state. These can be called proactively without user intervention.

| MCP Tool | Description | Example Usage |
|----------|-------------|---------------|
| `invoke_command` | Execute any slash command | `invoke_command("memories", ["episodic"])` |
| `list_commands` | List all available commands | `list_commands()` |
| `get_stance` | Get current stance state | `get_stance()` |
| `get_transformation_history` | View transformation history | `get_transformation_history()` |
| `get_sentience_report` | Detailed sentience metrics | `get_sentience_report()` |
| `store_memory` | Store a new memory | `store_memory({ type: "semantic", content: "..." })` |
| `recall_memories` | Search memories | `recall_memories({ query: "...", limit: 5 })` |
| `dialectical_analysis` | Apply thesis/antithesis/synthesis | `dialectical_analysis({ thesis: "..." })` |

**Proactive Use**: The agent's system prompt documents these tools, enabling it to:
- Check memories when relevant context might exist
- Examine its stance when discussing identity
- Review transformation history when asked about changes
- Store insights as semantic memories

### Integrated Adaptation Mechanisms

Three mechanisms run automatically during every chat turn:

| Mechanism | What It Does | Config Toggle |
|-----------|--------------|---------------|
| **Auto-Evolution** | Detects 6 evolution trigger types (pattern_repetition, sentience_plateau, etc.) | `enableAutoEvolution` |
| **Identity Persistence** | Creates identity checkpoints every 10 turns | `enableIdentityPersistence` |
| **Proactive Memory Injection** | Injects up to 3 relevant memories into system prompt | `enableProactiveMemory` |

All mechanisms default to enabled and can be individually toggled via configuration.

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
│   ├── stance-controller.ts    # Manages stance state per conversation
│   ├── planner.ts              # Trigger detection → operator selection
│   ├── prompt-builder.ts       # Dynamic system prompt construction
│   ├── metrics.ts              # Transformation/coherence/sentience scoring
│   ├── auto-evolution.ts       # Self-initiated evolution triggers
│   ├── identity-persistence.ts # Identity checkpoints and fingerprinting
│   └── embeddings.ts           # Local MiniLM embeddings for semantic matching
├── runtime/         # Unified runtime for CLI and HTTP
│   ├── runtime.ts              # MetamorphRuntime class
│   ├── session/                # Session management
│   │   ├── session-manager.ts  # Session lifecycle
│   │   └── persistence/        # PersistenceAdapter interface + implementations
│   ├── commands/               # Unified command system
│   │   ├── registry.ts         # RuntimeCommandRegistry
│   │   └── categories/         # core, memory, evolution, subagents, etc.
│   └── adapters/               # Thin adapters
│       ├── cli/                # CLIAdapter with terminal output
│       └── http/               # HTTPAdapter for Express routes
├── operators/       # 13 transformation operators
├── memory/          # SQLite-backed persistence
│   ├── store.ts                # MemoryStore with sessions, evolution snapshots
│   └── proactive-injection.ts  # Auto-inject relevant memories into context
├── tools/           # MCP tools for introspection, memory, analysis
│   ├── mcp-server.ts           # MCP server exposing tools to agent
│   ├── commands.ts             # invoke_command, list_commands
│   ├── introspection.ts        # get_stance, get_transformation_history
│   ├── memory.ts               # store_memory, recall_memories
│   └── analysis.ts             # dialectical_analysis, frame_shift_analysis
├── commands/        # Command definitions with trigger patterns
├── cli/             # CLI entry point
├── server/          # Server entry point
└── types/           # TypeScript type definitions

web/                 # Next.js 15 + React 19 web interface
├── app/             # App router pages
├── components/      # Chat, StanceViz, Config, CommandPalette
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
  // Core transformation settings
  intensity: number;           // 0-100, transformation aggressiveness
  coherenceFloor: number;      // 0-100, minimum coherence before warning
  sentienceLevel: number;      // 0-100, target self-awareness
  maxDriftPerTurn: number;     // Max stance drift per turn
  driftBudget: number;         // Total drift budget for conversation
  model: string;               // Claude model to use
  disabledOperators: string[]; // Operators to skip

  // Coherence planning (Ralph Iteration 3)
  enableCoherencePlanning: boolean;  // Filter operators by predicted drift (default: true)
  coherenceReserveBudget: number;    // Minimum coherence to preserve (default: 20%)

  // Auto-commands (Semantic Triggers)
  enableAutoCommands: boolean;       // Master toggle (default: true)
  autoCommandThreshold: number;      // Regex confidence threshold (default: 0.7)
  semanticTriggerThreshold: number;  // Cosine similarity threshold (default: 0.4)
  maxAutoCommandsPerTurn: number;    // Rate limiting (default: 2)

  // Integrated adaptation mechanisms
  enableAutoEvolution: boolean;      // Auto-detect evolution opportunities (default: true)
  enableIdentityPersistence: boolean; // Auto-checkpoint identity state (default: true)
  enableProactiveMemory: boolean;    // Auto-inject relevant memories (default: true)
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
# Unit tests (120 tests)
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

### Ralph Iteration 17 (Current)
- **Haptic Feedback for VR Visualization**: Tactile feedback mapping for stance dimensions with vibration patterns, texture mapping, force feedback, and accessibility options
- **Inheritance Chain Visualization**: Visual graph of template inheritance hierarchies with debug mode, conflict highlighting, and property tracing
- **Community Template Ratings and Reviews**: Star ratings, written reviews, usage statistics, and reputation-weighted scoring for shared templates
- **Predictive Stance Decay Modeling**: Time-based decay curves, environmental factors, usage patterns, prevention recommendations, and automatic refresh scheduling
- **Emotional Intelligence Calibration**: Sentiment analysis, tone matching, adaptive communication styles, and empathy-aware responses
- **Stance-Based Recommendation System**: Intelligent recommendations based on user history, collaborative filtering, and contextual analysis

### Ralph Iteration 16
- **Stance Encryption and Security**: AES-256 encryption, key management, access tokens, obfuscation, and audit trail encryption
- **Real-Time Collaborative Editing**: Multi-cursor editing (like Google Docs), CRDT conflict resolution, presence indicators, synchronized undo/redo
- **Stance Conflict Mediation**: Automatic conflict detection, voting mechanisms, weighted consensus, compromise generation, escalation paths
- **Stance Rollback with Branching**: Git-like version control, named checkpoints, branch creation/merging, timeline navigation, garbage collection
- **Automated Documentation Generation**: Evolution narratives, change logs, diff reports, API documentation, markdown/HTML/PDF export
- **AI-Powered Stance Coaching**: Personalized recommendations, goal tracking, exercises, achievements, learning style adaptation

### Ralph Iteration 15
- **Stance-Based Access Control**: Permission management with field-level locking, audit logging, role-based access, and delegation chains
- **Conversation-Derived Stance Inference**: Pattern recognition from chat history with NLP analysis, clustering, and automatic stance recommendations
- **Monte Carlo Stance Simulation**: Trajectory prediction via random sampling with risk assessment, confidence intervals, and sensitivity analysis
- **Stance Analytics Dashboard**: Real-time metrics, trend analysis, anomaly detection, forecasting, and recommendation engine
- **Gradual Stance Morphing**: Smooth transitions with configurable easing curves, intermediate state validation, and rollback capabilities
- **Stance Fingerprinting**: Unique identifier generation, similarity hashing, duplicate detection, and provenance tracking

### Ralph Iteration 14
- **Biometric-Linked Stance Adjustments**: Heart rate, focus, stress monitoring with automatic stance modulation
- **Environmental Context Sensing**: Location, device, ambient conditions with adaptive profile switching
- **Template Composition and Inheritance**: Multi-level hierarchies, diamond inheritance resolution, merge strategies
- **Stance Testing Framework**: Unit tests, regression tests, coherence assertions, CI/CD integration
- **Calendar Integration**: Google Calendar, iCal support, scheduled transitions, timezone handling
- **Competitive Stance Leaderboards**: Community rankings, badges, challenges, tournaments, social sharing

### Ralph Iteration 13
- **3D Stance Visualization Export**: GLTF/USD format export with animation support, scene composition, WebXR-ready
- **Cross-Session Identity Continuity**: Persistent identity profiles, session merging, core value preservation, identity verification
- **AI-Assisted Stance Optimization**: ML-based recommendations, performance pattern learning, coherence auto-tuning, A/B testing
- **Semantic Stance Versioning**: Git-like branching/merging for stances, semantic diffing, cherry-pick, rollback capabilities
- **Knowledge Base Integration**: Vector similarity search, concept taxonomy, external knowledge connectors, citation tracking
- **Voice-to-Stance Conversion**: Prosody analysis, speaker profiles, real-time transcription, sentiment detection

### Ralph Iteration 12
- **Stance Influence Inheritance**: Parent-child stance propagation, nested conversation inheritance, decay mechanisms
- **Stance Therapy and Debugging**: Automated inconsistency detection, health diagnostics, self-healing mechanisms
- **Time-Based Stance Scheduling**: Cron-like triggers, calendar profiles, recurring patterns, schedule optimization
- **Domain-Specific Templates**: Therapy, education, creative writing, business templates with variations
- **Natural Language Stance Specification**: Prose-to-stance conversion, semantic interpretation, validation
- **Stance Impact Simulation**: Pre-application preview, coherence scoring, A/B comparison, rollback scenarios

### Ralph Iteration 11
- **Cross-Model Stance Transfer**: Export/import stance configurations between LLMs with compatibility scoring
- **Stance-Aware Memory Prioritization**: Memory importance scoring, forgetting curves, consolidation
- **Dynamic Coherence Thresholds**: Context-adaptive coherence floors, phase detection, recovery strategies
- **Predictive Operator Suggestions**: Conversation trajectory analysis and proactive recommendations
- **Stance Archetype Library**: Historical figures, cultural archetypes, philosophical traditions, blending
- **Multiplayer Stance Editing**: Real-time collaboration, conflict resolution, permission zones

### Ralph Iteration 10
- **Custom Training Data Export**: Fine-tuning dataset generation from stance patterns
- **Multi-Language Support**: Stance-aware translation and locale-specific frame mappings
- **Community Preset Marketplace**: User-submitted preset verification and discovery
- **Performance Benchmarking Suite**: Automated regression testing and profiling
- **Emotional Tone Detection**: Real-time sentiment analysis and mood-based operator selection
- **Autonomous Goal Pursuit**: Self-directed objectives with minimal intervention mode

### Ralph Iteration 9
- **VR/AR Stance Visualization**: Immersive 3D stance exploration with WebXR
- **Automatic Documentation Generation**: Stance evolution docs and decision narratives
- **A/B Testing Framework**: Operator effectiveness comparison with statistical testing
- **Context-Aware Prompt Rewriting**: Stance-influenced prompt enhancement
- **Stance Diffing and Merge**: Visual diff tools and three-way merge strategies
- **External Workflow Integration**: Slack/Discord bots, webhooks, Zapier connectors

### Ralph Iteration 8
- **Voice/Audio Interface**: Speech-to-text input with frame-based voice modulation
- **IDE Integration**: VS Code extension and JetBrains plugins with stance sidebar
- **Stance-Aware Code Generation**: Frame-influenced code style and review feedback
- **Federated Learning**: Privacy-preserving shared stance evolution patterns
- **OAuth/SSO Authentication**: OAuth 2.0, SAML, and role-based access control
- **Cross-Platform Sync**: Real-time stance sync with conflict resolution

### Ralph Iteration 7
- **Semantic Memory Compression**: Hierarchical memory structures and concept clustering
- **Real-Time Telemetry Dashboard**: Live stance evolution and operator heatmaps
- **Knowledge Graph Integration**: External graph connections with entity linking
- **Plugin Development SDK**: Type-safe plugin API with hot reloading
- **Adaptive Response Streaming**: Token-level confidence and dynamic generation
- **Stance Evolution Replay**: Record, replay, and compare conversation outcomes

### Ralph Iteration 6
- **Persistent Memory Storage**: Export, backup, deduplication, external vector DB
- **Natural Language Config**: Configure operators using natural language
- **Conversation Branching**: Non-linear exploration with time travel
- **Dynamic Operator Discovery**: LLM-suggested new operators
- **Multi-Agent Orchestration**: Federation, shared memory, debate mode
- **Personality Marketplace**: Exportable presets with community sharing

### Ralph Iteration 5
- **Multi-Modal Memory**: Image storage and visual analysis with Claude vision
- **Cross-Session Identity**: Checkpoints, drift reconciliation, core values persistence
- **Real-Time Collaboration**: WebSocket sync, presence, turn-taking
- **Proactive Memory Injection**: Automatic relevant memory surfacing
- **Adaptive Streaming with Coherence Gates**: Token-by-token coherence monitoring
- **Plugin Architecture**: Hot-reload plugins with marketplace concept

### Ralph Iteration 4
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
