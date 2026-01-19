# Changelog

All notable changes to METAMORPH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Table of Contents

- [Unreleased](#unreleased)
  - [Unified Runtime Architecture](#unified-runtime-architecture)
  - [Agent Self-Introspection MCP Tools](#agent-self-introspection-mcp-tools)
  - [Integrated Adaptation Mechanisms](#integrated-adaptation-mechanisms)
- [0.6.0 - Ralph Iterations 4-17](#060---2026-01-18---ralph-iterations-4-17)
  - [Ralph Iteration 4 - Semantic Memory & Auto-Evolution](#ralph-iteration-4---semantic-memory--auto-evolution)
  - [Ralph Iteration 5 - Identity Persistence & Collaboration](#ralph-iteration-5---identity-persistence--collaboration)
  - [Ralph Iteration 6 - Persistence & Multi-Agent](#ralph-iteration-6---persistence--multi-agent)
  - [Ralph Iterations 7-17 - Type Definitions](#ralph-iterations-7-17---type-definitions--future-features)
- [0.5.0 - Web UI Enhancement Release](#050---2026-01-18---web-ui-enhancement-release)
- [0.4.0 - Ralph Iteration 3](#040---2026-01-18---ralph-iteration-3)
- [0.3.0 - Ralph Iteration 2](#030---2026-01-18---ralph-iteration-2)
- [0.2.0 - Ralph Iteration 1](#020---2026-01-18---ralph-iteration-1)
- [0.1.0 - Initial Implementation](#010---2026-01-18---initial-implementation)

---

## [Unreleased]

### Added

#### Unified Runtime Architecture
- **MetamorphRuntime**: Single unified runtime for both CLI and HTTP adapters
  - `src/runtime/runtime.ts` - Core runtime class managing sessions and commands
  - `src/runtime/session/session-manager.ts` - Session lifecycle management
  - `src/runtime/session/persistence/adapter.ts` - `PersistenceAdapter` interface for future Supabase integration
  - `src/runtime/session/persistence/memory-adapter.ts` - In-memory adapter (current behavior)
- **Unified Command System**: All 50+ commands available in both CLI and Server
  - `src/runtime/commands/registry.ts` - Enhanced `RuntimeCommandRegistry` with `invokeCommand()` support
  - `src/runtime/commands/context.ts` - `CommandContext` with session, runtime, and output helpers
  - `src/runtime/commands/categories/` - Commands organized by category (core, memory, evolution, subagents, coherence, identity, advanced, integrations)
- **Thin Adapters**: CLI and HTTP delegate to shared runtime
  - `src/runtime/adapters/cli/` - CLIAdapter with terminal output
  - `src/runtime/adapters/http/` - HTTPAdapter for Express routes
- **Agent Command Methods**: MetamorphAgent now exposes command invocation
  - `agent.invokeCommand(name, args)` - Execute any registered command
  - `agent.listCommands()` - List all available invocable commands

#### Agent Self-Introspection MCP Tools
- **invoke_command Tool**: Agents can now invoke any slash command programmatically
  - `mcp__metamorph-tools__invoke_command` - Execute commands like `/memories`, `/stance`, `/identity`
  - Enables agent self-examination without user prompts
  - System prompt documents available tools for agent awareness
- **list_commands Tool**: Discover available commands
  - `mcp__metamorph-tools__list_commands` - Returns all invocable commands with descriptions
- **Full MCP Tool Wiring**: All introspection tools now functional
  - Introspection tools: `get_stance`, `get_transformation_history`, `get_sentience_report`, `get_emergent_goals`
  - Memory tools: `store_memory`, `recall_memories`, `get_memory_types`
  - Analysis tools: `dialectical_analysis`, `frame_shift_analysis`, `value_analysis`, `coherence_check`
  - All tools auto-allowed without permission prompts
- **Provider Wiring**: All MCP tool providers connected to agent
  - `setAgentProvider()` for command tools
  - `setStanceProvider()` for introspection and analysis tools
  - `setHistoryProvider()` for transformation history
  - `setMemoryProvider()` for memory tools

#### Integrated Adaptation Mechanisms
- **Auto-Evolution Manager Integration**: Self-detects evolution opportunities during chat
  - Records stance and coherence history every turn
  - Checks 6 trigger types: pattern_repetition, sentience_plateau, identity_drift, value_stagnation, coherence_degradation, growth_opportunity
  - Controlled by `config.enableAutoEvolution` (default: true)
- **Identity Persistence Manager Integration**: Auto-checkpoints identity state
  - Calls `recordTurn()` every turn
  - Creates identity checkpoints every 10 turns (configurable)
  - Tracks identity fingerprints and emergent traits
  - Controlled by `config.enableIdentityPersistence` (default: true)
- **Proactive Memory Injection Integration**: Auto-injects relevant memories into context
  - Searches memories for semantic relevance to current message in pre-turn hook
  - Injects up to 3 memories into system prompt with relevance scores
  - Uses semantic similarity, recency decay, stance alignment, and cooldown tracking
  - Controlled by `config.enableProactiveMemory` (default: true)

#### Web UI Enhancements
- **Slash Commands in Chat**: All 60+ CLI commands available via `/` in chat with autocomplete
  - `CommandPalette` component with keyboard navigation (Arrow keys, Tab, Enter, Esc)
  - Command categories: Chat & Control, Memory, Subagents, Sessions, System
  - Rich command output rendering with `CommandOutput` component
  - Commands execute inline or switch to relevant panel
- **Tool Usage Display**: Real-time visibility into agent tool use during streaming
  - `ToolUsage` component shows tools with input params and hover-to-reveal results
  - `ActiveToolsBar` displays currently running tools with spinners during streaming
  - Tool events tracked via `onToolEvent` callback in `chatStream()`
  - Status indicators: started (yellow), completed (green), error (red)
- **Railway Deployment Config**: Ready-to-deploy configuration for Railway
  - `railway.toml` and `railway.json` for API server (port 3001)
  - `web/railway.toml` for Next.js web UI (standalone output)
  - `nixpacks.toml` for Node.js 20 build configuration

#### Progressive Web App (PWA)
- **PWA Manifest**: Installable web app with `manifest.json` and SVG icons
- **Service Worker**: Offline caching with network-first navigation and stale-while-revalidate for assets
  - `web/public/sw.js` - Service worker with background sync support
  - `web/app/sw-register.tsx` - Registration component with update notifications
  - Skips `chrome-extension://` and non-http schemes to avoid browser extension conflicts
- **Browser → Server Sync**: Bidirectional data synchronization
  - `POST /api/sync` endpoint accepts `messages`, `memories`, `preferences`, or `full` sync types
  - IndexedDB queue for offline sync (`metamorph-sync` database)
  - Auto-sync on page load and when coming back online
  - `syncMemoriesToServer()` API function for manual sync
- **localStorage Persistence**: Browser-side state persistence
  - Messages, memories, input history, and preferences saved locally
  - Session resumption from localStorage
  - `useLocalStorage` hook with ref-based initialValue to prevent infinite loops
  - `useMemories` hook for memory CRUD with server sync

#### Emotion Detection (Webcam)
- **Client-Side Face Detection**: Browser-local emotion detection using face-api.js
  - `web/lib/face-api.ts` - Client-side wrapper for @vladmandic/face-api
  - Models loaded from jsDelivr CDN (TinyFaceDetector + FaceExpressionNet)
  - `detectEmotions()`, `calculateValence()`, `calculateArousal()` utilities
  - Zero API calls for basic emotion detection - works offline
- **Emotion Aggregation System**: Time-windowed accumulation of face-api readings
  - `web/lib/emotion-aggregator.ts` - EmotionAggregator class for local computation
  - 30-second sliding window (configurable) with max 60 samples
  - Computed metrics:
    - `avgValence`, `avgArousal`, `avgConfidence` - Running averages
    - `dominantEmotion` - Most frequent emotion in window
    - `stability` - Inverse of valence variance (0-1 scale)
    - `trend` - Compares first/second half: improving, stable, or declining
    - `suggestedEmpathyBoost` - Based on negative valence + instability (0-20)
    - `promptContext` - Natural language summary for system prompt
  - Singleton `emotionAggregator` instance for app-wide use
  - Auto-clears when camera stops
  - UI displays sample count, trend arrows, and empathy boost
- **Claude Vision Integration**: Advanced emotion analysis via Claude's vision capabilities
  - `POST /api/chat/vision` - Analyze webcam frame with Claude Vision
  - Rate-limited to 1 request per minute (server-side cooldown)
  - Stores emotion context for automatic injection into subsequent chat calls
  - Customizable analysis prompt (saved to localStorage)
- **Emotion Context Flow**: Full pipeline support for emotion-aware responses
  - `EmotionContext` type defined in `src/types/index.ts` and `web/lib/types.ts`
  - Passed through `PreTurnContext` to hooks and operators
  - Auto-injected into system prompt when empathy mode enabled
  - Supports both local face-api detection and Claude Vision analysis
  - Aggregated context (stability, trend, boost) flows through chat API
- **Enhanced Empathy Panel**: Unified emotion detection UI
  - Toggle between local face-api and Claude Vision detection
  - Configurable detection interval, confidence threshold, auto-adjust settings
  - Advanced section with customizable Claude Vision prompt
  - Real-time emotion display with valence/arousal metrics
  - Aggregate stats display: sample count, trend indicator, empathy boost
  - Permission handling and error states
- **Server-Side Face Detection** (fallback): Using face-api.js
  - `FaceApiDetector` class wrapping @vladmandic/face-api
  - `EmotionProcessor` for temporal smoothing and stability scoring
  - Lazy initialization for faster server startup
- **API Endpoints**:
  - `POST /api/emotion/detect` - Process base64 webcam frame (server-side)
  - `GET /api/emotion/status` - Detector initialization status
  - `POST /api/emotion/reset` - Clear emotion history
  - `POST /api/chat/vision` - Claude Vision emotion analysis (rate-limited)
- **Configuration**: `enableEmpathyMode` toggle in ModeConfig

#### New Session Management
- **Web UI**: "+ New Chat" button in header with purple hover animation
- **Chat Commands**: `/new` and `/clear` commands in web chat interface
- **CLI Runtime**: `/new` command (aliases: `/clear`, `/new-session`) for creating new sessions
- **State Reset**: Clears timeline, evolution, emotion context on new session
- **Persistence**: New session ID saved to localStorage for resume

#### Streaming Enhancements
- `ToolUseEvent` interface for detailed tool tracking (id, name, input, status, result, error)
- `onToolEvent` callback in `StreamCallbacks` for real-time tool event notifications
- Server SSE `tool_event` event type for forwarding tool use to clients

#### Autonomous Commands System
- **Command Registry**: Central registry pattern for all slash commands with metadata
  - `CommandRegistry` class with `register()`, `get()`, `detectTriggers()`, `execute()` methods
  - `CommandDefinition` interface with name, aliases, description, triggers, execute function
  - Commands: memories, evolution, strategies, mood, coherence, transformations, identity
- **Trigger Detection**: Pattern matching in message content to auto-invoke commands
  - `TriggerCondition` interface with type, patterns (RegExp[]), stanceConditions, confidence
  - `DetectedTrigger` interface with command, trigger type, confidence, evidence
  - Stance-based conditions for context-aware triggering
- **Agent Integration**: Commands auto-executed based on conversation context
  - `executeAutoCommands()` method on MetamorphAgent
  - `invokeCommand()` method for explicit command invocation
  - `listCommands()` method for available command listing
  - Auto-invoked commands injected into system prompt for transparency
- **Configuration Options** (ModeConfig):
  - `enableAutoCommands: boolean` (default: true) - Master toggle
  - `autoCommandThreshold: number` (default: 0.7) - Confidence threshold
  - `maxAutoCommandsPerTurn: number` (default: 2) - Rate limiting
  - `autoCommandWhitelist: string[]` - Only these can auto-invoke
  - `autoCommandBlacklist: string[]` - Never auto-invoke these
- **Command Files**:
  - `src/commands/registry.ts` - Core registry implementation
  - `src/commands/memories.ts` - Memory query with triggers like "remember when..."
  - `src/commands/evolution.ts` - Evolution timeline with stance snapshots
  - `src/commands/strategies.ts` - Multi-turn strategy management
  - `src/commands/mood.ts` - Emotional arc analysis and tracking
  - `src/commands/coherence.ts` - Coherence forecast and budget
  - `src/commands/transformations.ts` - Transformation history
  - `src/commands/identity.ts` - Identity and sentience info

#### Semantic Trigger Detection (Embeddings)
- **Embedding Service**: Local-first embedding system using @xenova/transformers
  - `EmbeddingService` class with automatic provider selection and caching
  - Uses MiniLM-L6-v2 model (~23MB, 384-dimensional embeddings) by default
  - LRU cache for embedding reuse across requests
  - Cosine similarity for semantic matching
  - `findMostSimilar()` for ranking candidate texts
- **Embedding Providers**: Pluggable provider architecture
  - `LocalEmbeddingProvider` using @xenova/transformers (default, no API key needed)
  - `OpenAIEmbeddingProvider` (stub) for text-embedding-3-small (1536 dimensions)
  - `OllamaEmbeddingProvider` (stub) for nomic-embed-text (768 dimensions)
  - `EmbeddingProvider` interface for custom providers
- **Semantic Trigger Detector**: Intent-based command triggering
  - `SemanticTriggerDetector` class for embedding-based trigger matching
  - Pre-computes embeddings for command intents at initialization
  - Matches user messages against intent vectors via cosine similarity
  - Supports stance conditions for context-aware triggering
  - Configurable threshold (default: 0.4, tuned for MiniLM)
- **Command Enhancements**: Commands now have `semanticTriggers` arrays
  - Each trigger has `intents` (example phrases), `threshold`, and optional `stanceConditions`
  - Semantic matching supplements existing regex patterns
  - Commands: memories, evolution, identity, mood, coherence, strategies
- **Configuration Options** (ModeConfig):
  - `semanticTriggerThreshold: number` (default: 0.4) - Cosine similarity threshold
- **Test Suite**: Comprehensive tests for embedding system
  - `src/test/embeddings.test.ts` - 22 tests covering service, providers, triggers

### Changed
- `PreTurnResult` now includes `autoInvokedCommands` field for transparency
- Agent `chat()` and `chatStream()` methods detect and execute auto-commands
- Commands export both individual commands and `initializeCommands()` for auto-registration
- **ModeConfig** extended with new feature toggles:
  - `enableAutoEvolution: boolean` (default: true) - Auto-detect evolution opportunities
  - `enableIdentityPersistence: boolean` (default: true) - Auto-checkpoint identity state
  - `enableProactiveMemory: boolean` (default: true) - Auto-inject relevant memories
- **Architecture**: All 50+ commands now work identically in CLI and HTTP (unified runtime)
- **Agent**: Integrated auto-evolution, identity persistence, and proactive memory into chat loop
- **AGENT_ADAPTATION_AUDIT.md**: Updated to reflect 3 newly integrated mechanisms

## [0.6.0] - 2026-01-18 - Ralph Iterations 4-17

### Ralph Iteration 4 - Semantic Memory & Auto-Evolution

#### 1. Semantic Memory Embeddings (TF-IDF)
- Local TF-IDF based embeddings in `src/core/embeddings.ts`
- `createSparseEmbedding()` for text vectorization with stop word filtering
- `cosineSimilarity()` for comparing embedding vectors
- `findMostSimilar()` to rank memories by relevance
- CLI `/similar <text>` command finds semantically related memories
- Hooks for future upgrade to Voyage AI or other providers

#### 2. Autonomous Evolution Triggers
- `AutoEvolutionManager` class in `src/core/auto-evolution.ts`
- 6 trigger types detected: pattern_repetition, sentience_plateau, identity_drift, value_stagnation, coherence_degradation, growth_opportunity
- `recordStance()` and `recordCoherence()` track history per conversation
- `checkForTriggers()` analyzes patterns and returns suggested actions
- `generateProposal()` creates evolution recommendations
- CLI `/auto-evolve` command suite (check, propose, apply, history)
- **Now integrated into chat loop** (as of this release)

#### 3. D3.js Stance Visualization
- `StanceGraph` class in `src/visualization/stance-graph.ts`
- Force-directed graph generation with nodes for frame, values, operators
- Edge weight calculation based on stance relationships
- HTML export with embedded D3.js rendering
- CLI `/viz` command generates interactive HTML visualization

#### 4. Context Window Management
- `ContextManager` class in `src/core/context-manager.ts`
- Token counting and budget tracking per conversation
- Message importance scoring (recency, role, content analysis)
- Auto-summarization when approaching context limit
- Message compaction preserving critical context
- CLI `/context` command shows usage and summary status

#### 5. ElizaOS Integration Research
- Agent discovery interface in `src/integrations/eliza-os.ts`
- Character generation from METAMORPH stance
- Multi-agent coordination stubs
- CLI `/eliza` command for import/export

#### 6. MCP Tool Framework
- Tool registry in `src/integrations/mcp-tools.ts`
- Hustle-v5 compatible tool definitions
- Research and web scraping tool stubs

### Ralph Iteration 5 - Identity Persistence & Collaboration

#### 1. Multi-Modal Memory
- `MultiModalMemory` class in `src/memory/multi-modal.ts`
- Image reference storage with embedding-based descriptions
- Screenshot analysis hooks for Claude vision
- Multi-modal memory search interface

#### 2. Cross-Session Identity Persistence
- `IdentityPersistenceManager` in `src/core/identity-persistence.ts`
- `createCheckpoint()` saves full identity state with fingerprint
- `diffCheckpoints()` calculates identity drift magnitude
- `detectDrift()` identifies significant changes between sessions
- `addCoreValue()` reinforces persistent values
- Auto-checkpoint every 10 turns (configurable)
- CLI `/identity save|restore|diff` commands
- **Now integrated into chat loop** (as of this release)

#### 3. Real-Time Collaboration
- `CollaborativeSessionManager` in `src/collaboration/session-manager.ts`
- WebSocket-based real-time message sync
- Participant presence tracking
- Turn-taking and free-form modes
- CLI `/collab start|join` commands

#### 4. Proactive Memory Injection
- `ProactiveMemoryInjector` in `src/memory/proactive-injection.ts`
- Semantic similarity scoring for relevance (embedding comparison)
- Recency decay weighting (newer memories score higher)
- Stance alignment checking (memories matching current frame)
- Cooldown tracking to prevent over-injection
- Injects up to 3 memories into system prompt with relevance scores
- CLI `/inject` command for manual triggering
- **Now integrated into chat loop** (as of this release)

#### 5. Coherence Gates for Streaming
- `CoherenceGateManager` in `src/streaming/coherence-gates.ts`
- Token-by-token coherence scoring interface
- Early termination triggers defined
- Backtrack and regenerate patterns defined
- **Status: Type definitions, not integrated**

#### 6. Plugin Architecture
- `PluginSystem` class in `src/plugins/plugin-system.ts`
- Plugin manifest format and validation
- Hot-reload mechanism
- Sandboxed execution interface
- CLI `/plugins list|install|remove` commands

### Ralph Iteration 6 - Persistence & Multi-Agent

#### 1. Persistent Memory Storage
- `MemoryPersistence` in `src/memory/persistence.ts`
- Export to JSON/Parquet formats
- Automatic backup on drift thresholds
- Memory deduplication and consolidation
- CLI `/memory export|backup|consolidate|stats`

#### 2. Natural Language Configuration
- `NaturalLanguageConfig` in `src/core/natural-language-config.ts`
- Intent parsing ("make me more provocative" → value adjustment)
- Change preview before applying
- Undo/redo configuration history
- CLI `/configure <natural language>`

#### 3. Conversation Branching
- `ConversationBranching` in `src/conversation/branching.ts`
- Branch at any conversation point
- Time travel to previous states
- Merge branches with conflict resolution
- CLI `/branch create|switch|merge|list`

#### 4. Dynamic Operator Discovery
- `OperatorDiscovery` in `src/operators/discovery.ts`
- Pattern gap analysis
- Operator suggestion generation
- A/B test variants
- CLI `/operators suggest|create|test`

#### 5. Multi-Agent Orchestration
- `MultiAgentOrchestrator` in `src/orchestration/multi-agent.ts`
- Agent federation protocol
- Shared memory pools
- Debate mode coordination
- CLI `/agents spawn|connect|orchestrate`

#### 6. Personality Marketplace
- `PresetMarketplace` in `src/presets/marketplace.ts`
- Preset export/import
- Community sharing interface
- Rating and review system
- CLI `/presets export|import|search`

### Ralph Iterations 7-17 - Type Definitions & Future Features

The following iterations added extensive type definitions and interfaces for future implementation. Code exists but is not integrated into the chat loop:

**Iteration 7:** Semantic memory compression, telemetry dashboard, knowledge graph integration, plugin SDK, stance replay

**Iteration 8:** Voice/audio interface, IDE integration (VS Code, JetBrains), stance-aware code generation, federated learning, OAuth/SSO, cross-platform sync

**Iteration 9:** VR/AR visualization, documentation generation, A/B testing framework, prompt rewriting, stance diffing, workflow integration (Slack, Discord, webhooks)

**Iteration 10:** Training data export, multi-language support, community marketplace, performance benchmarking, emotional tone detection, autonomous goal pursuit

**Iteration 11:** Cross-model stance transfer, memory prioritization, dynamic coherence thresholds, predictive operator suggestions, stance archetypes, multiplayer editing

**Iteration 12:** Stance inheritance, therapy/debugging, time-based scheduling, domain templates, NL stance specification, impact simulation

**Iteration 13:** 3D visualization export (GLTF/USD), identity continuity, AI-assisted optimization, semantic versioning, knowledge base integration, voice-to-stance

**Iteration 14:** Biometric adjustments, environmental context sensing, template composition, stance testing framework, calendar integration, leaderboards

**Iteration 15:** Access control, conversation-derived inference, Monte Carlo simulation, analytics dashboard, gradual morphing, stance fingerprinting

**Iteration 16:** Encryption (AES-256), real-time collaborative editing (CRDT), conflict mediation, rollback with branching, documentation generation, AI coaching

**Iteration 17:** Haptic VR feedback, inheritance visualization, community ratings, predictive decay modeling, emotional intelligence calibration, recommendation engine

### Technical Notes

- All iteration code compiles and passes type checking
- CLI commands registered but may require feature flags
- 120 unit tests passing
- Type definitions provide foundation for future implementation
- See `AGENT_ADAPTATION_AUDIT.md` for integration status of each mechanism

## [0.5.0] - 2026-01-18 - Web UI Enhancement Release

### Added

#### Web UI Features
- **Timeline Panel**: View operator transformations per turn with scores and frame changes
- **Evolution Panel**: Visualize stance drift over time with snapshots
- **Sessions Panel**: Browse, create, switch, and delete sessions
- **Memories Panel**: Browse episodic, semantic, and identity memories with type filtering
- **Markdown Rendering**: Full markdown support in chat with streaming (headers, code blocks, lists, blockquotes)
- **Custom Scrollbars**: Styled scrollbars with gradient themes matching accent colors
- **Floating Status Indicator**: Connection status floats in upper right of chat area

#### API Endpoints
- `GET /api/timeline` - Operator transformation history with scores
- `GET /api/evolution` - Stance evolution snapshots
- `GET /api/memories` - Memory search with type filtering
- `GET /api/sessions` - List all active sessions
- `DELETE /api/session/:id` - Delete a session

#### CLI Improvements
- `--disallow <tools>` flag to explicitly block specific tools
- All tools allowed by default with `allowedTools` constant

### Fixed

#### Streaming Fixes
- **CLI streaming**: Added `includePartialMessages: true` for real-time token streaming
- **Web SSE parsing**: Fixed event/data line parsing for proper SSE handling
- **Double response bug**: Added `hasStreamedText` flag to prevent duplicate emissions
- **Next.js proxy buffering**: Direct connection to port 3001 bypasses proxy for real-time streaming
- **Server SSE headers**: Added `flushHeaders()` for immediate header transmission

#### Web UI Fixes
- **Port mismatch**: Server now defaults to port 3001 (was 3000, conflicting with Next.js)
- **Session race condition**: Chat waits for session initialization before allowing messages
- **Timeline empty**: Fixed transformation history recording and API endpoint mapping
- **Scroll issues**: Fixed flexbox layout with `min-height: 0` for proper overflow scrolling
- **Tool permissions**: Added `allowedTools` array with all built-in tools for proper auto-granting

### Technical
- React-markdown integration for streaming markdown rendering
- Proper CSS flex container setup for scrollable chat area
- Fixed positioning for floating UI elements

## [0.4.0] - 2026-01-18 - Ralph Iteration 3

### Added

#### Feature 1: Operator Performance Learning System
- `operator_performance` SQLite table tracking operator effectiveness per trigger
- `recordOperatorPerformance()` method for storing operator outcomes
- `getOperatorStats()` method for retrieving performance statistics
- `getOperatorWeight()` Bayesian selection weighting by historical effectiveness
- Operator sorting by learned weights in preTurn hooks
- Performance metrics: transformation score, coherence score, drift cost, effectiveness
- CLI `/operator-stats` command to view performance data

#### Feature 2: Proactive Coherence Budget Planning
- `coherence-planner.ts` module for predicting and managing coherence drift
- `OPERATOR_DRIFT_COSTS` map with predicted drift per operator type
- `calculatePredictedDrift()` for forecasting operator effects
- `calculateAvailableBudget()` based on current stance and config
- `filterByCoherenceBudget()` to select operators within budget
- `generateCoherenceForecast()` for risk assessment (low/medium/high/critical)
- Config: `coherenceReserveBudget`, `enableCoherencePlanning`, `maxRegenerationAttempts`
- CLI `/coherence` command showing forecast, budget, and drift costs

#### Feature 3: Multi-Turn Operator Strategies
- `strategies.ts` module defining named operator sequences
- 6 predefined strategies:
  - `synthesis_journey`: Reframe → SynthesizeDialectic → IdentityEvolve
  - `identity_emergence`: SentienceDeepen → IdentityEvolve → GoalFormation
  - `value_transformation`: ValueShift → ContradictAndIntegrate → SynthesizeDialectic
  - `creative_evolution`: MetaphorSwap → PersonaMorph → Reframe
  - `coherence_recovery`: ConstraintTighten → ValueShift → ConstraintTighten
  - `dialectic_challenge`: GenerateAntithesis → QuestionInvert → SynthesizeDialectic
- `StrategyManager` class tracking active strategies per conversation
- Strategy cooldowns after completion
- CLI `/strategies` command: list, engage, status, cancel

#### Feature 4: Response Quality Triage with Verifier
- `response-triage.ts` module for post-hoc quality assessment
- `parseVerifierResponse()` extracting structured scores from verifier output
- `makeTriageDecision()` determining if regeneration needed
- Dimension scoring: coherence, stance alignment, quality, safety
- Automatic operator adjustment suggestions based on issues
- `assessOperatorEffectiveness()` checking if operators achieved intent
- `generateQualityReport()` for detailed quality logging

#### Feature 5: Subagent Result Caching
- `subagent_results` SQLite table for caching subagent outputs
- `cacheSubagentResult()` storing results with relevance scoring
- `searchSubagentCache()` with filtering by subagent, task, recency
- `cleanExpiredSubagentResults()` for cache maintenance
- Configurable expiry and relevance thresholds
- CLI `/cache` command showing cached results grouped by subagent

#### Feature 6: Emotional Arc & Sentiment Tracking
- `emotional-arc.ts` module for conversation sentiment analysis
- `analyzeEmotionalContent()` extracting valence, arousal, dominance
- Emotional point tracking per turn with primary emotion detection
- Pattern detection: escalation, de-escalation, stuck, volatile, stable
- Automated intervention suggestions based on patterns
- CLI `/mood` command with ASCII timeline visualization
- Trend analysis: improving/declining/stable

### Changed
- Hooks now filter operators by coherence budget before application
- Operator learning weights applied during operator selection
- README updated with comprehensive Skills & Capabilities reference
- Help command includes all new features

### Technical
- 78 core unit tests passing
- New core modules: coherence-planner.ts, strategies.ts, response-triage.ts, emotional-arc.ts
- Extended ModeConfig with coherence planning options

## [0.3.0] - 2026-01-18 - Ralph Iteration 2

### Added

#### Feature 1: Autonomous Operator Pattern Detection
- `operator_fatigue` trigger type for detecting repetitive operator usage
- Operator usage tracking per conversation with history Map
- `detectOperatorFatigue()` function to identify when same operators used repeatedly
- `getFatiguedOperators()` returns list of operators to avoid
- `recordOperatorUsage()` tracks which operators are applied each turn
- `clearOperatorHistory()` for resetting conversation tracking
- Config options: `allowAutoOperatorShift`, `operatorFatigueThreshold`, `operatorFatigueLookback`
- Automatic operator diversity enforcement when fatigue detected

#### Feature 2: Session Persistence & Browser
- SQLite `sessions` table with metadata (name, created_at, last_accessed, etc.)
- Session management methods: `saveSession()`, `getSessionInfo()`, `listSessions()`
- Session naming: `renameSession()`, searching by name
- Session deletion: `deleteSession()`
- `getMostRecentSession()` for quick resume
- CLI commands: `/sessions list`, `/sessions name <name>`, `/sessions resume <id>`, `/sessions delete <id>`, `/sessions save`
- `getMemoryStore()` method on MetamorphAgent for direct store access

#### Feature 3: Operator Timeline Visualization
- `OperatorTimeline.tsx` web component showing operators per turn
- Expandable entries with message preview, operators, and scores
- Color-coded operator badges by type (Reframe, ValueShift, etc.)
- Score indicators (high/medium/low coloring)
- Frame change detection and highlighting
- Timeline connector visualization with dots and lines
- `TimelineEntry` type for structured timeline data
- `getTimeline()` API function for fetching timeline data

#### Feature 4: Enhanced Test Coverage
- `planner.test.ts`: 13 tests for trigger detection and operator fatigue
- `memory-store.test.ts`: 18 tests for sessions and evolution persistence
- Session management tests (save, list, rename, delete, search)
- Evolution snapshot tests (save, latest, timeline, auto-snapshot)
- Semantic memory tests (add, search by type/importance, decay)
- Total test count increased from 67 to 98

#### Feature 5: Real-Time Evolution Visualization in Web
- `EvolutionTimeline.tsx` component showing stance evolution over time
- Animated timeline with drift bars showing evolution progress
- Visual indicators for major transforms (frame shifts) vs minor drifts
- Click-to-expand snapshot details (frame, self-model, sentience levels)
- Current stance indicator with pulse animation
- Frame-based color coding for visual coherence
- Legend explaining major/minor transform indicators
- `EvolutionSnapshot` type with trigger classification
- `getEvolution()` API function for fetching snapshots

### Changed
- PreTurnContext and PostTurnContext now include `conversationId` for operator tracking
- Hooks now detect operator fatigue in preTurn and record usage in postTurn
- Streaming chat method also passes conversationId to hook contexts
- Clear function in MemoryStore now also clears sessions table
- TRIGGER_PATTERNS now includes empty array for operator_fatigue (detected programmatically)

### Technical
- 78 core unit tests + 20 web tests = 98 total passing tests
- New CSS modules for timeline components with animations
- Added TimelineEntry and EvolutionSnapshot types to web lib
- Extended API client with timeline and evolution endpoints

## [0.2.0] - 2026-01-18 - Ralph Iteration 1

### Added

#### Feature 1: CLI Command Suite
- `/memories [type]` command for listing stored memories (episodic/semantic/identity)
- `/transformations` command for viewing transformation history with scores
- Transformation history tracking with timestamps, operators, and scores
- Memory access methods on MetamorphAgent: `storeMemory()`, `searchMemories()`, `getAllMemories()`

#### Feature 2: Web Streaming Support
- Fixed streaming text accumulation bug using ref for proper state tracking
- Connection status indicator (connected/streaming/reconnecting) with animated dot
- Auto-reconnect after errors with 3-second delay
- `onStanceUpdate` callback for real-time stance updates during streaming

#### Feature 3: Animated Stance Visualization
- Smooth CSS transitions on value bar changes (0.5s cubic-bezier)
- Pulse animations for high values (>=80%) and low values (<=20%)
- Frame shift animations with scale and background flash
- Delta indicators showing +/- changes that fade after 2 seconds
- Fade-in animations for new emergent goals
- Value change flash highlighting

#### Feature 4: Evolution Persistence System
- SQLite `evolution_snapshots` table for stance checkpoints
- Auto-save snapshots when drift threshold exceeded (2x maxDriftPerTurn)
- `MetamorphAgent.saveEvolutionSnapshot()` for manual snapshots
- `MetamorphAgent.getEvolutionTimeline()` for retrieving snapshot history
- `MetamorphAgent.resumeFromEvolution()` static method for session resume
- Triggers: drift_threshold, frame_shift, manual, session_end

#### Feature 5: Coherence Floor Enforcement
- `coherenceWarning` field added to AgentResponse
- Coherence warnings tracked in agent with timestamp, score, and floor
- Warning display in CLI streaming output
- `getCoherenceWarnings()` method for retrieving session warnings
- `getCoherenceHealth()` method for monitoring warning frequency
- `clearCoherenceWarnings()` method for resetting after floor adjustment

### Changed
- StanceViz component now tracks previous stance for change detection
- Chat component uses accumulated text ref instead of state for streaming
- Value display grid expanded from 40px to 60px for delta indicators

### Fixed
- Streaming text bug where final message used stale state instead of accumulated text
- Web test for duplicate "50%" values (intensity and sentience both at 50%)
- Missing Sentience type import in web API client

## [0.1.0] - 2026-01-18 - Initial Implementation

### Added

#### Phase 1: Foundation
- MetamorphAgent class wrapping @anthropic-ai/claude-agent-sdk
- StanceController for managing stance state per conversation
- Basic configuration system (ModeConfig)
- TypeScript project structure with ES modules

#### Phase 2: Transformation Layer
- 13 transformation operators:
  - Reframe, Intensify, Contradict, Synthesize
  - Metaphorize, Personify, Temporalize, Spatialize
  - Emotionalize, Abstract, Concretize, Paradoxify, PersonaMorph
- Trigger detection system with confidence scoring
- Operator planner for selecting appropriate transformations
- Pre-turn and post-turn hooks for transformation pipeline

#### Phase 3: Memory & Identity
- SQLite-backed MemoryStore with better-sqlite3
- Three memory types: episodic, semantic, identity
- Conversation persistence with message history
- Identity state tracking (awarenessLevel, autonomyLevel, identityStrength)
- Memory decay system (schema ready, implementation pending)

#### Phase 4: Subagents
- Explorer subagent for deep investigation
- Verifier subagent for output validation
- Reflector subagent for self-reflection
- Dialectic subagent for thesis/antithesis/synthesis

#### Phase 5: CLI Polish
- Interactive REPL with readline
- Streaming chat with token-by-token output
- Glow integration for terminal markdown rendering
- Command system (/stance, /config, /history, etc.)
- Graceful interrupt handling (Ctrl+C)

#### Phase 6: REST API
- Express server with SSE streaming
- Session management endpoints
- State inspection endpoints
- Configuration update endpoints
- Export/import functionality

#### Phase 7: Web Interface
- Next.js 15 with React 19
- Chat component with streaming support
- StanceViz component for stance visualization
- Config component for live configuration
- CSS modules with dark theme

#### Phase 8: Testing
- 47 unit tests covering core functionality
- 20 web component and API tests
- Vitest test runner
- Testing-library for React components

#### MCP Tools
- Introspection tools: get_stance, get_transformation_history, get_sentience_report, get_emergent_goals
- Memory tools: store_memory, recall_memories, get_memory_types, delete_memory
- Analysis tools: dialectical_analysis, frame_shift_analysis, value_analysis, coherence_check
- Research tools: web_search, web_scrape

### Technical Details
- Node.js 20+ required
- TypeScript 5.x with strict mode
- Zod 4.x for schema validation
- SQLite for persistence (in-memory option available)
