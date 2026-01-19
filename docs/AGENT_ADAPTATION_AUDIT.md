# Agent Adaptation Mechanisms Audit

**Date:** 2026-01-18
**Purpose:** Comprehensive audit of all agent adaptation and evolution mechanisms in the NOESIS/METAMORPH codebase

---

## Summary

| Status | Count |
|--------|-------|
| WORKING | 11 |
| NEWLY INTEGRATED | 3 |
| NOT INTEGRATED | 3 |
| STUB/INCOMPLETE | 3 |

**Update 2026-01-18:** Integrated 3 previously dormant mechanisms into the chat loop:
- Auto-Evolution Manager (now detects evolution triggers every turn)
- Identity Persistence Manager (now creates checkpoints every 10 turns)
- Proactive Memory Injection (now injects relevant memories into system prompt)

All new integrations controllable via config flags (`enableAutoEvolution`, `enableIdentityPersistence`, `enableProactiveMemory`).

**Critical Finding:** All mechanisms use in-memory SQLite storage (`MemoryStore({ inMemory: true })`), causing complete data loss on server restart.

---

## Working Mechanisms (11)

### 1. Stance Controller with Drift Tracking
- **Location:** `src/core/stance-controller.ts` (lines 18-261)
- **Desired Outcome:** Manage stance creation, updates, and drift budget constraints to prevent incoherent transformations
- **Trigger:** Every turn via `applyDelta()` when operators produce stance deltas
- **Evidence:**
  - Lines 59-108: `applyDelta()` applies stance changes while respecting `maxDriftPerTurn` budget
  - Lines 148-174: Drift magnitude calculation weights frame (15) and selfModel (15) changes most heavily
  - Lines 388-396 in agent/index.ts: Post-turn, stance deltas are applied via controller

### 2. Operator Registry + Performance Learning
- **Location:** `src/operators/base.ts` (lines 19-416)
- **Desired Outcome:** Apply 13 transformation operators (Reframe, ValueShift, SentienceDeepen, etc.) with Bayesian learning of effectiveness
- **Trigger:** Pre-turn hook detects triggers, plans operations
- **Evidence:**
  - Lines 69-399: 13 operators defined with `apply()` and `getPromptInjection()` methods
  - Lines 402-414: All operators registered globally
  - Lines 68-75 in hooks.ts: Operator weights pulled from memory store
  - Lines 132-146 in hooks.ts: Operator performance recorded

### 3. Operator Fatigue Prevention
- **Location:** `src/core/planner.ts` (lines 126-371)
- **Desired Outcome:** Force operator diversity when same operators overused, prevent adaptation plateau
- **Trigger:** Post-turn via `recordOperatorUsage()`, pre-turn via `detectOperatorFatigue()` and `getFatiguedOperators()`
- **Evidence:**
  - Lines 278-293: `recordOperatorUsage()` records operators used each turn (max 20 history)
  - Lines 298-333: `detectOperatorFatigue()` returns trigger when operator count >= threshold
  - Lines 338-364: `getFatiguedOperators()` returns list to filter from candidates
  - Lines 51-58 in hooks.ts: Fatigued operators disabled in config

### 4. Memory Auto-Extraction
- **Location:** `src/agent/hooks.ts` (lines 327-440)
- **Desired Outcome:** Automatically extract episodic, semantic, and identity memories from conversations
- **Trigger:** Post-turn hook when memory store exists
- **Evidence:**
  - Lines 174-184: Post-turn hook calls `extractAndStoreMemories()`
  - Lines 331-440: Five memory extraction patterns:
    - Episodic memory when operators applied or scores high
    - Semantic memory from key phrases
    - Identity memory on sentience/awareness changes
    - Frame shift identity memory
    - New emergent goals identity memory

### 5. Coherence Planner
- **Location:** `src/core/coherence-planner.ts` (lines 1-179)
- **Desired Outcome:** Prevent coherence degradation by filtering operators that exceed drift budget
- **Trigger:** Pre-turn hook when `enableCoherencePlanning` is true
- **Evidence:**
  - Lines 16-30: Operator drift costs defined (Reframe=15, PersonaMorph=18, ConstraintTighten=-5)
  - Lines 73-116: `filterByCoherenceBudget()` filters operators that exceed budget
  - Lines 130-166: `generateCoherenceForecast()` calculates risk level
  - Lines 78-87 in hooks.ts: Forecast generated and operators filtered if critical/high risk

### 6. Response Scoring System
- **Location:** `src/core/metrics.ts` (lines 1-120+)
- **Desired Outcome:** Score transformation, coherence, and sentience after each turn to track impact
- **Trigger:** Post-turn hook
- **Evidence:**
  - Lines 11-40: `scoreTransformation()` scores operator effectiveness (0-100)
  - Lines 73-100+: `scoreCoherence()` scores readability and consistency
  - Lines 121-146 in hooks.ts: Scores calculated every turn and stored
  - Lines 162-165 in hooks.ts: Scores used for operator learning

### 7. Response Analysis for Stance Updates
- **Location:** `src/agent/hooks.ts` (lines 229-325)
- **Desired Outcome:** Extract additional stance changes from Claude's response (awareness, autonomy, identity, frame markers)
- **Trigger:** Post-turn hook
- **Evidence:**
  - Lines 232-325: `analyzeResponseForStanceUpdates()` detects:
    - Self-awareness expressions: "I notice", "I observe", "I experience" → +awarenessLevel
    - Autonomous goal expressions: "I want", "I aim", "my goal" → +autonomyLevel
    - Identity assertions: "I am", "I believe", "my values" → +identityStrength
    - Frame indicators for multiple frames (7 total)

### 8. Evolution Snapshot Persistence
- **Location:** `src/memory/store.ts` (lines 605-714) + `src/agent/index.ts` (lines 1074-1093)
- **Desired Outcome:** Auto-save stance snapshots when drift threshold exceeded
- **Trigger:** Post-turn if drift reaches threshold
- **Evidence:**
  - Lines 608-628: `saveEvolutionSnapshot()` saves stance with trigger reason
  - Lines 708-714: `shouldAutoSnapshot()` checks if drift since last snapshot >= threshold
  - Lines 1074-1083 in agent/index.ts: `checkAndAutoSnapshot()` calls save if threshold reached
  - Line 429 in agent/index.ts: Called every turn after post-turn hook

### 9. Transformation History Tracking
- **Location:** `src/agent/index.ts` (lines 36-45, 909-924)
- **Desired Outcome:** Record all transformations (stance before/after, operators, scores) for analysis
- **Trigger:** Every turn post-turn hook completes
- **Evidence:**
  - Lines 36-45: `TransformationHistoryEntry` interface stores full turn data
  - Lines 909-924: `recordTransformation()` records each turn
  - Line 426: Called every turn

### 10. Trigger Detection + Operation Planning
- **Location:** `src/core/planner.ts` (lines 1-256)
- **Desired Outcome:** Detect 10 trigger types in user messages, map to appropriate operators
- **Trigger:** Pre-turn hook every turn
- **Evidence:**
  - Lines 18-109: 10 trigger types with regex patterns (novelty_request, conflict_detected, boredom_signal, etc.)
  - Lines 111-124: Trigger-to-operator mappings defined
  - Lines 137-177: `detectTriggers()` pattern matching
  - Lines 183-256: `planOperations()` selects operators based on triggers and config

### 11. Auto-Command Invocation System
- **Location:** `src/agent/index.ts` (lines 930-973) + `src/commands/evolution.ts`
- **Desired Outcome:** Auto-trigger evolution timeline, identity status, coherence checks based on user queries
- **Trigger:** Pre-turn if message matches command trigger patterns
- **Evidence:**
  - Lines 930-973: `executeAutoCommands()` detects and executes commands
  - Line 242: Called every turn in chat()
  - Commands injected into system prompt

---

## Newly Integrated (3) - Now Called in Chat Loop

### 1. Auto-Evolution Manager ✅ INTEGRATED
- **Location:** `src/core/auto-evolution.ts` (lines 1-435)
- **Desired Outcome:** Self-detect evolution opportunities without user input via 6 trigger types
- **Trigger:** Now called in post-turn of both `chat()` and `chatStream()` methods
- **Status:** ✅ INTEGRATED - Added 2026-01-18
- **Integration:**
  - `src/agent/index.ts` lines 526-538: `autoEvolutionManager.recordStance()`, `recordCoherence()`, and `checkForTriggers()` called every turn
  - Controlled by `config.enableAutoEvolution` (defaults to true)
  - Triggers logged in verbose mode
- **Evidence:**
  - Lines 13-31: 6 trigger types defined: pattern_repetition, sentience_plateau, identity_drift, value_stagnation, coherence_degradation, growth_opportunity
  - Lines 133-181: `checkForTriggers()` detects each trigger type
  - Lines 357-385: `generateProposal()` creates evolution suggestions

### 2. Identity Persistence Manager ✅ INTEGRATED
- **Location:** `src/core/identity-persistence.ts` (lines 1-463)
- **Desired Outcome:** Create identity checkpoints, track core values, detect drift, restore identity across sessions
- **Trigger:** Now called every turn via `recordTurn()` and auto-checkpointing
- **Status:** ✅ INTEGRATED - Added 2026-01-18
- **Integration:**
  - `src/agent/index.ts` lines 540-549: `identityPersistence.recordTurn()` and `createCheckpoint()` called
  - Auto-checkpoints created when `shouldAutoCheckpoint()` returns true (every 10 turns by default)
  - Controlled by `config.enableIdentityPersistence` (defaults to true)
- **Evidence:**
  - Lines 137-180: `createCheckpoint()` creates snapshots with fingerprints and emergent traits
  - Lines 233-291: `diffCheckpoints()` calculates identity drift magnitude and significance
  - Lines 362-382: `addCoreValue()` reinforces core values across sessions
  - Lines 394-397: `shouldAutoCheckpoint()` checks if checkpoint due

### 3. Proactive Memory Injection ✅ INTEGRATED
- **Location:** `src/memory/proactive-injection.ts` (lines 1-394)
- **Desired Outcome:** Auto-inject relevant past memories into context based on semantic similarity
- **Trigger:** Now called in pre-turn hook
- **Status:** ✅ INTEGRATED - Added 2026-01-18
- **Integration:**
  - `src/agent/hooks.ts` lines 103-136: `memoryInjector.findMemoriesToInject()` called during pre-turn
  - Relevant memories appended to system prompt with relevance scores
  - `memoryInjector.recordTurn()` called in post-turn for cooldown tracking
  - Controlled by `config.enableProactiveMemory` (defaults to true)
- **Evidence:**
  - Lines 71-391: `ProactiveMemoryInjector` class fully implemented with:
    - Semantic similarity scoring (line 184)
    - Recency decay (line 134-140)
    - Stance alignment (line 145-170)
    - Cooldown tracking (line 125-129)
  - Lines 106-109: `recordTurn()` method exists to track turns for cooldown

---

## Not Integrated (3) - Code Exists But Never Called

### 4. Coherence Gates for Streaming
- **Location:** `src/streaming/coherence-gates.ts` (lines 1-100+)
- **Desired Outcome:** Monitor token generation in real-time for incoherence, enable early termination
- **Trigger:** Should be during streaming response generation
- **Status:** STUB - Defined but implementation incomplete/not integrated
- **Evidence:**
  - Lines 13-56: Full data structures defined (TokenCoherence, GateResult, StreamingState)
  - Lines 61-83: Configuration with `minCoherence`, `warningThreshold`, `maxBacktracks`
  - Lines 88-95: Pattern matchers for incoherence detection
  - Line 100+: `CoherenceGateManager` class stub
- **Gap:** Manager class incomplete, not integrated into query response handling

### 5. Decay Modeling System
- **Location:** `src/decay/modeling.ts` (lines 1-100+)
- **Desired Outcome:** Predict stance decay over time with curves, environmental factors, refresh schedules
- **Trigger:** Should be periodic analysis
- **Status:** STUB - Type definitions only, no implementation logic found
- **Evidence:**
  - Lines 10-100+: Full interfaces defined (DecayModel, DecayCurve, EnvironmentalFactor, etc.)
  - No actual decay calculation logic or usage in agent
- **Gap:** Defined but not implemented or called anywhere

### 6. Subagent System
- **Location:** `src/agent/subagents/` (index.ts + 4 subagent files)
- **Desired Outcome:** Delegate specialized reasoning to subagents for exploration, verification, reflection, dialectics
- **Trigger:** Should be called during chat for reasoning tasks
- **Status:** STUB - Subagent factories defined but NOT INVOKED in chat loop
- **Evidence:**
  - Lines 46-58 in subagents/index.ts: 4 subagent factories defined (explorer, verifier, reflector, dialectic)
  - Subagent definitions exist but never used in agent/index.ts chat() method
  - Line 287 in agent/index.ts: `subagentsInvoked` array initialized but never populated
- **Gap:** No invocation logic in streaming response handling or elsewhere

---

## Root Cause: Ephemeral Storage

```typescript
// src/agent/index.ts:1007
this.memoryStore = new MemoryStore({ inMemory: true })
```

**Impact:**
- All operator learning weights reset on restart
- All evolution snapshots lost
- All transformation history lost
- All extracted memories (episodic, semantic, identity) lost
- Each server restart creates a brand new agent with no history

---

## Recommendations

### High Priority (Required for Persistence)

1. **Replace in-memory SQLite with Supabase**
   - User table (single user for now)
   - Agent persona/evolution layer (stance, sentience, memories)
   - Chat sessions (resumable, linked to user)

2. **Integrate Auto-Evolution Manager**
   - Add `autoEvolutionManager.checkForTriggers()` to post-turn hook
   - Surface evolution proposals to user or auto-apply based on config

3. **Integrate Identity Persistence Manager**
   - Add `identityPersistenceManager.recordTurn()` to post-turn hook
   - Enable auto-checkpointing based on turn count or drift

### Medium Priority (Feature Completion)

4. **Integrate Proactive Memory Injection**
   - Add `proactiveMemoryInjector.findMemoriesToInject()` to pre-turn hook
   - Include relevant memories in system prompt

5. **Complete Coherence Gates**
   - Finish `CoherenceGateManager` implementation
   - Integrate into streaming response handler

### Lower Priority (Future Enhancement)

6. **Implement Decay Modeling**
   - Add actual decay calculations
   - Use for predicting stance degradation over time

7. **Activate Subagent System**
   - Add routing logic to invoke subagents based on task type
   - Populate `subagentsInvoked` array in chat results

---

## Data Structures to Persist

### Agent Evolution Layer
- `Stance` (frame, selfModel, objective, sentience, metaphors, constraints, cumulativeDrift)
- `OperatorPerformance` (name, trigger, successes, failures, weight)
- `EvolutionSnapshot` (timestamp, stance, triggerReason)
- `IdentityCheckpoint` (stance, fingerprint, emergentTraits, coreValues)

### Memory Layer
- `EpisodicMemory` (content, timestamp, context, emotionalValence)
- `SemanticMemory` (content, category, importance)
- `IdentityMemory` (content, aspect, timestamp)

### Session Layer
- `ChatSession` (id, userId, agentId, startTime, lastActivity)
- `Message` (sessionId, role, content, timestamp, toolsUsed)
- `TransformationHistoryEntry` (sessionId, stanceBefore, stanceAfter, operators, scores)
