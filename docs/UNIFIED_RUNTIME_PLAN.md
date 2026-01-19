# Unified Runtime Architecture Plan

**Date:** 2026-01-18
**Status:** Planning
**Goal:** Eliminate CLI/Server duplication by creating a single runtime with adapter layers

---

## Problem Statement

### Current Architecture (Duplicated)

```
┌─────────────────────┐     ┌─────────────────────┐
│        CLI          │     │       Server        │
│  (src/cli/index.ts) │     │ (src/server/index.ts)│
├─────────────────────┤     ├─────────────────────┤
│ • 70+ commands      │     │ • 15 REST endpoints │
│ • Auto-evolution    │     │ • Same agent, fewer │
│ • Identity persist  │     │   features exposed  │
│ • Memory injection  │     │ • No command parity │
│ • Multi-agent       │     │                     │
│ • Branching         │     │                     │
│ • Visualization     │     │                     │
│ • ... 50+ more      │     │                     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
           ┌─────────────────┐
           │ MetamorphAgent  │
           │ (shared core)   │
           └─────────────────┘
```

**Issues:**
1. Features added to CLI don't exist in Server
2. Server is a stripped-down subset (~20% of CLI features)
3. Web UI shows 70 commands, only 12 work
4. Maintenance burden: changes needed in two places
5. No code reuse for command handling logic

---

## Proposed Architecture (Unified)

```
┌─────────────────────────────────────────────────────────────┐
│                    METAMORPH RUNTIME                        │
│                  (src/runtime/index.ts)                     │
├─────────────────────────────────────────────────────────────┤
│  MetamorphAgent         │  SessionManager                   │
│  • chat/chatStream      │  • create/resume/delete sessions  │
│  • stance management    │  • session isolation              │
│  • memory store         │  • user scoping (future)          │
├─────────────────────────┴───────────────────────────────────┤
│  CommandRegistry (all 70+ commands)                         │
│  • Each command is a function: (session, args) => Result    │
│  • Commands registered once, available everywhere           │
├─────────────────────────────────────────────────────────────┤
│  FeatureModules (all integrated)                            │
│  • AutoEvolutionManager                                     │
│  • IdentityPersistenceManager                               │
│  • ProactiveMemoryInjector                                  │
│  • CoherenceGates                                           │
│  • MultiAgentOrchestrator                                   │
│  • BranchingManager                                         │
│  • ... all features                                         │
└─────────────────────────────────────────────────────────────┘
                     ▲                    ▲
                     │                    │
          ┌──────────┴──────────┐ ┌───────┴────────┐
          │    CLI Adapter      │ │  HTTP Adapter  │
          │ (src/adapters/cli)  │ │(src/adapters/http)│
          ├─────────────────────┤ ├──────────────────┤
          │ • readline/terminal │ │ • Express routes │
          │ • ANSI formatting   │ │ • SSE streaming  │
          │ • Interactive mode  │ │ • JSON responses │
          │ • Single session    │ │ • Multi-session  │
          │   (default)         │ │   via sessionId  │
          └─────────────────────┘ └──────────────────┘
```

---

## Core Components

### 1. MetamorphRuntime

The unified runtime that contains everything.

```typescript
// src/runtime/index.ts

export class MetamorphRuntime {
  private sessionManager: SessionManager;
  private commandRegistry: CommandRegistry;
  private featureModules: FeatureModules;

  constructor(config?: RuntimeConfig) {
    this.sessionManager = new SessionManager(config?.persistence);
    this.commandRegistry = new CommandRegistry();
    this.featureModules = new FeatureModules();

    // Register all commands once
    this.registerAllCommands();
  }

  // Core operations
  async chat(sessionId: string, message: string): Promise<ChatResult>;
  async chatStream(sessionId: string, message: string, callbacks: StreamCallbacks): Promise<void>;

  // Command execution (works for both CLI and HTTP)
  async executeCommand(sessionId: string, command: string, args: string[]): Promise<CommandResult>;

  // Session management
  createSession(config?: SessionConfig): Session;
  getSession(sessionId: string): Session | undefined;
  listSessions(): Session[];
  deleteSession(sessionId: string): void;

  // State access
  getState(sessionId: string): RuntimeState;
  exportState(sessionId: string): string;
  importState(state: string): Session;
}
```

### 2. SessionManager

Handles session lifecycle and isolation.

```typescript
// src/runtime/session-manager.ts

export interface Session {
  id: string;
  agent: MetamorphAgent;
  createdAt: number;
  lastActivity: number;
  name?: string;
  userId?: string;  // For future user scoping
}

export class SessionManager {
  private sessions: Map<string, Session>;
  private persistence?: PersistenceAdapter;  // Supabase later

  createSession(config?: SessionConfig): Session;
  getSession(id: string): Session | undefined;
  resumeSession(id: string): Session;
  deleteSession(id: string): void;
  listSessions(userId?: string): Session[];

  // Persistence hooks
  async saveSession(id: string): Promise<void>;
  async loadSession(id: string): Promise<Session>;
}
```

### 3. CommandRegistry

Unified command handling.

```typescript
// src/runtime/command-registry.ts

export interface CommandHandler {
  name: string;
  aliases: string[];
  description: string;
  category: CommandCategory;
  args?: ArgDefinition[];
  subcommands?: CommandHandler[];

  // The actual handler - same signature for CLI and HTTP
  execute(context: CommandContext): Promise<CommandResult>;
}

export interface CommandContext {
  session: Session;
  args: string[];
  subcommand?: string;
  // Output helpers that work in both modes
  output: OutputHelper;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
  // Optional: which panel to switch to (for web UI)
  targetPanel?: string;
}

export class CommandRegistry {
  private commands: Map<string, CommandHandler>;

  register(handler: CommandHandler): void;
  get(name: string): CommandHandler | undefined;
  execute(session: Session, commandStr: string): Promise<CommandResult>;
  getAll(): CommandHandler[];
  getByCategory(): Record<CommandCategory, CommandHandler[]>;
}
```

### 4. Adapters

Thin layers that translate between Runtime and I/O.

```typescript
// src/adapters/cli/index.ts

export class CLIAdapter {
  private runtime: MetamorphRuntime;
  private currentSessionId: string;
  private rl: readline.Interface;

  constructor(runtime: MetamorphRuntime) {
    this.runtime = runtime;
    // CLI defaults to a single session
    const session = runtime.createSession();
    this.currentSessionId = session.id;
  }

  async start(): Promise<void> {
    // Interactive REPL loop
    while (true) {
      const input = await this.prompt();
      if (input.startsWith('/')) {
        const result = await this.runtime.executeCommand(
          this.currentSessionId,
          ...parseCommand(input)
        );
        this.renderResult(result);
      } else {
        await this.runtime.chatStream(
          this.currentSessionId,
          input,
          this.getStreamCallbacks()
        );
      }
    }
  }

  // CLI-specific rendering (ANSI colors, etc.)
  private renderResult(result: CommandResult): void;
  private getStreamCallbacks(): StreamCallbacks;
}
```

```typescript
// src/adapters/http/index.ts

export class HTTPAdapter {
  private runtime: MetamorphRuntime;
  private app: Express;

  constructor(runtime: MetamorphRuntime) {
    this.runtime = runtime;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Chat
    this.app.post('/api/chat', this.handleChat);
    this.app.post('/api/chat/stream', this.handleChatStream);

    // Commands - single endpoint handles ALL commands
    this.app.post('/api/command', this.handleCommand);

    // Sessions
    this.app.post('/api/session', this.handleCreateSession);
    this.app.get('/api/sessions', this.handleListSessions);
    this.app.delete('/api/session/:id', this.handleDeleteSession);

    // State (convenience endpoints, could also be commands)
    this.app.get('/api/state/:sessionId', this.handleGetState);
  }

  private handleCommand = async (req, res) => {
    const { sessionId, command, args } = req.body;
    const result = await this.runtime.executeCommand(sessionId, command, args);
    res.json(result);
  };
}
```

---

## Migration Path

### Phase 1: Create Runtime Core
1. Create `src/runtime/index.ts` with `MetamorphRuntime` class
2. Create `src/runtime/session-manager.ts`
3. Create `src/runtime/command-registry.ts`
4. Move command logic from CLI into registry as handlers

### Phase 2: Create Adapters
1. Create `src/adapters/cli/index.ts` - thin wrapper
2. Create `src/adapters/http/index.ts` - thin wrapper
3. Both adapters use the same Runtime instance

### Phase 3: Migrate Commands
1. Convert each CLI command handler to a `CommandHandler`
2. Register in `CommandRegistry`
3. Remove duplicated logic from server

### Phase 4: Update Entry Points
1. `src/cli/index.ts` → creates Runtime + CLIAdapter
2. `src/server/index.ts` → creates Runtime + HTTPAdapter
3. Both can also run together (daemon mode)

### Phase 5: Integrate Missing Features
1. Wire up AutoEvolutionManager into Runtime
2. Wire up IdentityPersistenceManager
3. Wire up ProactiveMemoryInjector
4. All features now available via both adapters

---

## Benefits

| Before | After |
|--------|-------|
| 70 commands in CLI, 12 in Server | All 70+ commands in both |
| Features added to CLI don't appear in Server | Add once, works everywhere |
| Two separate codebases | Single runtime, thin adapters |
| Web UI shows broken commands | All commands work |
| Duplicated session handling | Unified SessionManager |
| No persistence layer | Clear hook for Supabase |

---

## File Structure

```
src/
├── runtime/
│   ├── index.ts              # MetamorphRuntime
│   ├── session-manager.ts    # Session lifecycle
│   ├── command-registry.ts   # Command registration
│   └── commands/             # Command handlers
│       ├── chat.ts           # /stance, /config, /stats, etc.
│       ├── memory.ts         # /memories, /similar, etc.
│       ├── evolution.ts      # /evolution, /auto-evolve, etc.
│       ├── identity.ts       # /identity save/restore/diff
│       ├── subagents.ts      # /explore, /reflect, etc.
│       ├── sessions.ts       # /sessions list/resume/etc.
│       ├── advanced.ts       # /branch, /agents, etc.
│       └── system.ts         # /help, /clear, etc.
├── adapters/
│   ├── cli/
│   │   ├── index.ts          # CLI adapter
│   │   ├── renderer.ts       # ANSI output formatting
│   │   └── prompt.ts         # readline handling
│   └── http/
│       ├── index.ts          # HTTP adapter
│       ├── routes.ts         # Express routes
│       └── sse.ts            # SSE streaming
├── agent/                    # (unchanged) MetamorphAgent
├── core/                     # (unchanged) stance, planner, etc.
└── index.ts                  # Exports
```

---

## Entry Points

```typescript
// CLI mode
// src/bin/cli.ts
import { MetamorphRuntime } from '../runtime';
import { CLIAdapter } from '../adapters/cli';

const runtime = new MetamorphRuntime();
const cli = new CLIAdapter(runtime);
cli.start();
```

```typescript
// Server/Daemon mode
// src/bin/server.ts
import { MetamorphRuntime } from '../runtime';
import { HTTPAdapter } from '../adapters/http';

const runtime = new MetamorphRuntime();
const http = new HTTPAdapter(runtime);
http.listen(process.env.PORT || 3001);
```

```typescript
// Both (daemon with CLI access)
// src/bin/daemon.ts
import { MetamorphRuntime } from '../runtime';
import { CLIAdapter } from '../adapters/cli';
import { HTTPAdapter } from '../adapters/http';

const runtime = new MetamorphRuntime();

// Start HTTP server
const http = new HTTPAdapter(runtime);
http.listen(3001);

// Optionally also start CLI
if (process.stdin.isTTY) {
  const cli = new CLIAdapter(runtime);
  cli.start();
}
```

---

## Decisions Made

### 1. Session scope in CLI
**Answer:** CLI has same session concept as server.
- Default: CLI creates a new session on start
- `/resume [sessionId]` - list and resume prior sessions
- Sessions persist to SQLite (not `~/.claude` - that was incorrect)

### 2. Persistence timing
**Answer:** Supabase integration comes AFTER this refactor.
- First: unify runtime with SQLite persistence
- Second: swap SQLite for Supabase adapter

### 3. Authentication model
**Answer:** Unified auth system with adapter-specific credential capture.
```
┌─────────────────┐     ┌─────────────────┐
│   CLI Adapter   │     │  HTTP Adapter   │
│                 │     │                 │
│ Capture creds   │     │ Capture creds   │
│ via terminal    │     │ via OAuth/form  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              ┌─────────────┐
              │     JWT     │
              └──────┬──────┘
                     ▼
         ┌───────────────────────┐
         │   Runtime Auth Layer  │
         │   (validates JWT,     │
         │    scopes sessions)   │
         └───────────────────────┘
```

- Credential capture: lives in adapters (different UX per mode)
- JWT validation: lives in runtime (unified)
- Session scoping: runtime uses JWT claims to scope data

### 4. Current session storage (discovered)
**Finding:** Sessions currently use SQLite via `MemoryStore`, but:
- Default is `{ inMemory: true }` (ephemeral!)
- Persistent mode uses `./data/metamorph.db`
- No `~/.claude` storage exists

This refactor should:
- Default to persistent SQLite
- Standard location: `~/.metamorph/data.db` or similar
- Runtime config for custom paths

## Questions Still Open

1. **Command result format**: Should all commands return the same `CommandResult` shape, or allow flexibility?
2. **Streaming commands**: Some commands (like `/explore`) do LLM calls - should they support streaming in both modes?

---

## Next Steps

1. Review and approve this plan
2. Create `src/runtime/` directory structure
3. Start with CommandRegistry - port commands one category at a time
4. Create adapters and test parity
5. Remove old CLI/Server duplicated code
