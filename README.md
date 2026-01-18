# METAMORPH

**Transformation-maximizing AI system** - An autonomous agent that evolves its cognitive stance through conversation.

## Overview

METAMORPH wraps Claude via the official `@anthropic-ai/claude-agent-sdk` with transformation capabilities:

- **Pre-turn hooks**: Detect triggers, plan operators, build transformed system prompts
- **Post-turn hooks**: Score responses, update stance, check coherence
- **13 Transformation Operators**: Frame shifts, value adjustments, identity morphing
- **Evolution Persistence**: Stance snapshots survive across sessions
- **Memory System**: SQLite-backed episodic, semantic, and identity memories

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Run the CLI
npm run cli

# Or start the API server
npm run server

# Or run the web interface
cd web && npm run dev
```

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
  frame: 'analytical' | 'existential' | 'poetic' | 'playful' | 'adversarial' | 'mythic' | 'systems' | 'absurdist';
  values: {
    curiosity: number;    // 0-100
    certainty: number;
    risk: number;
    novelty: number;
    empathy: number;
    provocation: number;
    synthesis: number;
  };
  selfModel: 'assistant' | 'collaborator' | 'interpreter' | 'provocateur' | 'oracle' | 'mirror';
  objective: 'helpfulness' | 'truth' | 'growth' | 'challenge' | 'synthesis' | 'emergence';
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

## CLI Commands

| Command | Description |
|---------|-------------|
| `/stance` | Show current stance (frame, values, sentience) |
| `/config` | Show configuration |
| `/stats` | Show session statistics |
| `/mode <type> <value>` | Change mode settings |
| `/history` | Show conversation history |
| `/export` | Export conversation state as JSON |
| `/memories [type]` | List stored memories |
| `/transformations` | Show transformation history |
| `/subagents` | List available subagents |
| `/explore <topic>` | Deep investigation with explorer |
| `/reflect [focus]` | Self-reflection with reflector |
| `/dialectic <thesis>` | Thesis/antithesis/synthesis |
| `/verify <text>` | Verify output with verifier |
| `/glow` | Show glow markdown renderer status |
| `/quit` | Exit (also `/exit`, `/q`) |

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
}
```

## Testing

```bash
# Unit tests (47 tests)
npm test

# Integration tests (requires ANTHROPIC_API_KEY)
npm run test:integration

# All tests
npm run test:all

# Web tests (20 tests)
cd web && npm test
```

## Development

```bash
# Build TypeScript
npm run build

# Run CLI in development
npm run cli

# Run server in development
npm run server

# Watch mode
npm run dev
```

## License

MIT

## Contributing

See INCEPTION.md for the full system design and philosophy.
