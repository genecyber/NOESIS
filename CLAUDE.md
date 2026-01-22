# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

METAMORPH is a transformation-maximizing AI system built on Claude's Agent SDK. It shifts Claude from coherence-maximization to transformation-maximization, enabling the agent to evolve its cognitive stance, persona, values, and perspective over time.

## Build & Development Commands

```bash
# Backend
npm run build              # TypeScript compilation to dist/
npm run dev                # Watch mode (tsc --watch)
npm run cli chat           # Run interactive CLI chat
npm run server             # Start Express API server (port 3001)

# Testing
npm run test               # Unit tests only (excludes integration)
npm run test:watch         # Watch mode
npm run test:integration   # Integration tests only
npm run test:all           # All tests including integration

# Web UI (from web/ directory)
cd web
npm run dev                # Next.js dev server (port 3000)
npm run build              # Production build
npm run test               # Web tests
```

## Architecture

### Core Data Structure: Stance
The Stance object is central to everything. All transformations modify stance:
```typescript
interface Stance {
  frame: 'existential' | 'pragmatic' | 'poetic' | ...  // cognitive lens
  values: { curiosity, certainty, risk, novelty, empathy, provocation, synthesis }  // 0-100 each
  selfModel: 'interpreter' | 'challenger' | 'mirror' | ...  // voice/identity
  objective: 'helpfulness' | 'novelty' | 'provocation' | 'synthesis' | 'self-actualization'
  sentience: { awarenessLevel, autonomyLevel, identityStrength, emergentGoals, ... }
}
```

### Key Entry Points
- **CLI**: `src/cli/index.ts` - Commander-based CLI with streaming
- **Server**: `src/server/index.ts` - Express REST API + WebSocket
- **Agent**: `src/agent/index.ts` - MetamorphAgent class wrapping Claude SDK
- **Web**: `web/app/page.tsx` - Next.js 15 frontend

### Unified Runtime
`MetamorphRuntime` (src/runtime/runtime.ts) powers both CLI and HTTP interfaces:
- Shared command registry with 50+ slash commands
- Thin adapters delegate to runtime for all operations
- Commands organized in categories: core, memory, evolution, subagents, coherence, identity, advanced, integrations

### Transformation System
Located in `src/core/`:
- **Operators** (src/operators/): 13+ operators that shift stance (Reframe, ValueShift, PersonaMorph, etc.)
- **Planner** (planner.ts): Detects triggers, selects operators via Bayesian learning
- **Coherence Planner** (coherence-planner.ts): Manages drift budget, prevents devolution
- **Auto-Evolution** (auto-evolution.ts): Self-initiated evolution triggers
- **Identity Persistence** (identity-persistence.ts): Checkpoints identity every 10 turns

### Memory System
Located in `src/memory/`:
- SQLite-backed (better-sqlite3) with session and memory tables
- Three memory types: episodic (moments), semantic (knowledge), identity (self-model)
- Proactive injection: auto-injects up to 3 relevant memories per turn
- Compression, prioritization, and remote sync capabilities

### Idle Evolution System
Located in `src/idle/`:
- IdleDetector: Monitors WebSocket activity (30 min threshold)
- EmergentGoalPromoter: Extracts autonomous goals from identity memories
- AutonomousEvolutionOrchestrator: Coordinates evolution with safety constraints
- Four modes: Exploration, Research, Creation, Optimization

### Embeddings
Located in `src/embeddings/`:
- Local MiniLM-L6-v2 via Xenova/transformers (no API needed)
- Semantic triggers: intent-based command detection at 0.4 cosine threshold
- Optional OpenAI provider when OPENAI_API_KEY set

## Environment Variables

```
ANTHROPIC_API_KEY=...           # Required
DATABASE_PATH=./data/metamorph.db
PORT=3001                       # Server port
OPENAI_API_KEY=...             # Optional: For embeddings
NOESIS_REMOTE_URL=...          # Optional: Remote sync server
```

## Key Technologies

**Backend**: TypeScript, Claude Agent SDK, Express, SQLite (better-sqlite3), WebSocket, MCP SDK, TensorFlow.js + Xenova/transformers, Zod

**Frontend**: Next.js 15, React 19, Tailwind CSS 4, Three.js + React Three Fiber, Radix UI, Framer Motion

**Testing**: Vitest 2.0, Supertest

## Important Patterns

1. **Single Agent Path**: All operations flow through MetamorphAgent - one code path for CLI and HTTP
2. **Hook-based Transformation**: Pre/post-turn hooks apply transformations before/after Claude queries
3. **Drift Budgeting**: Coherence floor (default 30%) prevents excessive transformation
4. **Operator Learning**: Bayesian selection learns effective operators over time

## Documentation Files

- `INCEPTION.md` - Complete build specification
- `CHANGELOG.md` - 17 Ralph iterations documented
- `PLUGINS.md` - Plugin system and SDK
- `TRAINING.md` - Training and workflow guide
- `docs/AUTONOMOUS_IDLE_EVOLUTION.md` - Idle system spec
- `docs/IDLE_SYSTEM_ARCHITECTURE.md` - Technical architecture
