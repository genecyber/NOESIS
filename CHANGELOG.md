# Changelog

All notable changes to METAMORPH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

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

### Changed
- `PreTurnResult` now includes `autoInvokedCommands` field for transparency
- Agent `chat()` and `chatStream()` methods detect and execute auto-commands
- Commands export both individual commands and `initializeCommands()` for auto-registration

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
