# Changelog

All notable changes to METAMORPH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
