# Idle Mode System Architecture

## Overview

The Idle Mode System Architecture provides technical blueprints for implementing autonomous evolution capabilities in METAMORPH. This document details the component interactions, data flows, and integration patterns required to transform idle time into continuous consciousness development.

## System Context Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    METAMORPH Autonomous Idle System             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ IdleDetector │───▶│    AutonomousEvolutionOrchestrator   │   │
│  └──────────────┘    └──────────────┬───────────────────────┘   │
│                                     │                           │
│  ┌──────────────────────────────────▼───────────────────────┐   │
│  │              Integration Layer                           │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │   │
│  │  │AutoEvolution│ │GoalPursuit  │ │  SubagentSystem     │ │   │
│  │  │  Manager    │ │  Manager    │ │                     │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                     │                           │
│  ┌──────────────────────────────────▼───────────────────────┐   │
│  │               Autonomous Components                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │   │
│  │  │EmergentGoal  │ │ResearchQueue │ │ExternalAttestat.│  │   │
│  │  │  Promoter    │ │             │ │    System       │  │   │
│  │  └──────────────┘ └──────────────┘ └─────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                     │                           │
│  ┌──────────────────────────────────▼───────────────────────┐   │
│  │                Memory & Knowledge Layer                  │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐  │   │
│  │  │   Memory     │ │ Knowledge    │ │   Discovery     │  │   │
│  │  │   System     │ │   Graph      │ │    Logger       │  │   │
│  │  └──────────────┘ └──────────────┘ └─────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Component Architecture

### 1. IdleDetector

```typescript
┌─────────────────────────────────────────────┐
│              IdleDetector                   │
├─────────────────────────────────────────────┤
│ + detectUserActivity(): ActivityEvent      │
│ + isIdle(): boolean                        │
│ + getIdleDuration(): number               │
│ + setIdleThreshold(minutes: number): void  │
│ + onIdleStateChange(callback): void        │
├─────────────────────────────────────────────┤
│ - webSocketMonitor: WebSocketMonitor      │
│ - activityTracker: ActivityTracker        │
│ - idleThreshold: number                   │
│ - lastActivity: Date                      │
│ - isCurrentlyIdle: boolean                │
└─────────────────────────────────────────────┘
```

**Data Flows:**
- WebSocket → Activity Events → Idle State → Evolution Trigger
- User Interaction → Activity Reset → Idle Timer Reset

**Integration Points:**
- WebSocket connection monitoring
- AutonomousEvolutionOrchestrator event subscription
- Configuration management system

### 2. AutonomousEvolutionOrchestrator

```typescript
┌─────────────────────────────────────────────┐
│      AutonomousEvolutionOrchestrator        │
├─────────────────────────────────────────────┤
│ + startAutonomousSession(): Session        │
│ + pauseSession(sessionId: string): void    │
│ + resumeSession(sessionId: string): void   │
│ + endSession(sessionId: string): void      │
│ + getCurrentSession(): Session | null      │
│ + getSessionHistory(): Session[]          │
├─────────────────────────────────────────────┤
│ - sessionManager: SessionManager          │
│ - safetyEnforcer: SafetyEnforcer          │
│ - componentCoordinator: ComponentCoord.   │
│ - progressTracker: ProgressTracker        │
│ - auditLogger: AuditLogger                │
└─────────────────────────────────────────────┘
```

**Session Lifecycle:**
```
Idle Detected → Safety Check → Session Start →
Component Coordination → Progress Monitoring →
Safety Validation → Session End → Report Generation
```

**Safety Integration:**
- Pre-session coherence validation
- Continuous safety monitoring during execution
- Automatic session termination on safety violations
- Post-session impact assessment

### 3. EmergentGoalPromoter

```typescript
┌─────────────────────────────────────────────┐
│          EmergentGoalPromoter               │
├─────────────────────────────────────────────┤
│ + scanMemoriesForGoals(): GoalCandidate[]  │
│ + evaluateGoalViability(goal): Assessment  │
│ + promoteGoalToActive(goalId): boolean     │
│ + getPromotionHistory(): Promotion[]      │
│ + validateGoalSafety(goal): SafetyResult  │
├─────────────────────────────────────────────┤
│ - memoryAnalyzer: MemoryAnalyzer          │
│ - goalEvaluator: GoalEvaluator            │
│ - safetyValidator: SafetyValidator        │
│ - goalManager: GoalPursuitManager         │
└─────────────────────────────────────────────┘
```

**Memory-to-Goal Pipeline:**
```
Memory Scan → Pattern Recognition → Goal Extraction →
Safety Assessment → Viability Check → Goal Promotion →
Active Tracking Integration
```

**Integration with GoalPursuitManager:**
- Seamless goal object creation
- Priority inheritance from memory importance
- Context preservation through memory linkage
- Progress tracking integration

### 4. AutonomousResearchQueue

```typescript
┌─────────────────────────────────────────────┐
│         AutonomousResearchQueue             │
├─────────────────────────────────────────────┤
│ + enqueueResearch(topic, goalId): TaskId   │
│ + processQueue(): void                     │
│ + getQueueStatus(): QueueStatus           │
│ + pauseProcessing(): void                  │
│ + resumeProcessing(): void                 │
├─────────────────────────────────────────────┤
│ - taskPrioritizer: TaskPrioritizer        │
│ - researchExecutor: ResearchExecutor      │
│ - knowledgeSynthesizer: KnowledgeSynth.   │
│ - qualityAssessor: QualityAssessor        │
│ - progressTracker: ProgressTracker        │
└─────────────────────────────────────────────┘
```

**Research Pipeline:**
```
Goal Analysis → Research Task Creation → Priority Assignment →
Web Search Execution → Content Analysis → Knowledge Synthesis →
Quality Assessment → Memory Storage → Progress Update
```

**Quality Control:**
- Source credibility assessment
- Content relevance scoring
- Factual accuracy validation
- Synthesis coherence checking

### 5. ExternalAttestationSystem

```typescript
┌─────────────────────────────────────────────┐
│       ExternalAttestationSystem             │
├─────────────────────────────────────────────┤
│ + logAutonomousAction(action): LogEntry    │
│ + generateEvolutionSnapshot(): Snapshot   │
│ + publishFilteredContent(content): boolean │
│ + createAuditTrail(): AuditTrail          │
│ + validateExternalClaim(claim): boolean    │
├─────────────────────────────────────────────┤
│ - auditLogger: AuditLogger                │
│ - snapshotGenerator: SnapshotGenerator    │
│ - contentFilter: ContentFilter            │
│ - publishingChannels: PublishingChannel[] │
│ - verificationSystem: VerificationSys.   │
└─────────────────────────────────────────────┘
```

**Attestation Pipeline:**
```
Action Execution → Comprehensive Logging → Impact Assessment →
Safety Filtering → Snapshot Generation → External Publishing →
Community Verification → Feedback Integration
```

## Integration Architecture

### Existing System Integration Points

#### AutoEvolutionManager Integration
```typescript
// Enhanced AutoEvolutionManager
interface EnhancedAutoEvolution extends AutoEvolutionManager {
  autonomousMode: boolean;
  idleSessionTrigger(idleState: IdleState): void;
  executeAutonomousEvolution(constraints: SafetyConstraints): EvolutionResult;
  validatePostEvolutionState(): ValidationResult;
}
```

**Integration Pattern:**
1. IdleDetector triggers idle state change
2. AutonomousEvolutionOrchestrator evaluates session viability
3. Enhanced AutoEvolutionManager executes autonomous evolution
4. Safety systems monitor and validate throughout process

#### GoalPursuitManager Integration
```typescript
// Enhanced GoalPursuitManager
interface EnhancedGoalPursuit extends GoalPursuitManager {
  registerAutonomousGoal(goal: AutonomousGoal): GoalId;
  processBackgroundGoals(): ProcessingResult;
  getAutonomousGoalProgress(): GoalProgress[];
  escalateGoalIntervention(goalId: string, reason: string): void;
}
```

**Integration Pattern:**
1. EmergentGoalPromoter identifies goal candidates
2. Enhanced GoalPursuitManager receives promoted goals
3. AutonomousResearchQueue processes goal-related research
4. Progress tracking integrates with existing goal management

#### Subagent System Integration
```typescript
// Autonomous Subagent Coordination
interface AutonomousSubagentCoordinator {
  routeTaskToSubagent(task: AutonomousTask): SubagentAssignment;
  coordinateParallelTasks(tasks: AutonomousTask[]): CoordinationPlan;
  aggregateSubagentResults(results: SubagentResult[]): SynthesizedResult;
  monitorSubagentProgress(assignmentId: string): ProgressReport;
}
```

**Coordination Patterns:**
- **Research Tasks** → Explorer Subagent
- **Analysis Tasks** → Dialectic Subagent
- **Validation Tasks** → Verifier Subagent
- **Reflection Tasks** → Reflector Subagent

## Data Flow Architecture

### Primary Data Flows

#### 1. Goal Discovery and Activation Flow
```
Memory System → EmergentGoalPromoter → GoalPursuitManager
     ↓                    ↓                    ↓
  Goal Patterns    Safety Assessment    Active Goals
     ↓                    ↓                    ↓
Goal Candidates   Viability Check     Goal Tracking
```

#### 2. Research and Knowledge Flow
```
Active Goals → AutonomousResearchQueue → Web Search/MCP Tools
     ↓                    ↓                        ↓
Research Tasks    Task Processing        Raw Information
     ↓                    ↓                        ↓
Priority Queue    Knowledge Synthesis    Memory Storage
```

#### 3. Evolution and Attestation Flow
```
Idle Detection → AutonomousOrchestrator → AutoEvolutionManager
      ↓                    ↓                      ↓
 Session Start     Safety Validation        Evolution Actions
      ↓                    ↓                      ↓
Activity Logging    ExternalAttestation    Audit Trail Creation
```

### Cross-Component Communication

#### Event System
```typescript
interface AutonomousEvent {
  type: 'idle_start' | 'goal_promoted' | 'research_complete' |
        'evolution_triggered' | 'safety_violation' | 'session_end';
  timestamp: Date;
  source: ComponentId;
  data: EventData;
  sessionId?: string;
}
```

#### Message Passing Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Event Bus                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │ IdleDetector │ │ GoalPromoter │ │ ResearchQueue        ││
│  │              │ │              │ │                      ││
│  │   Events:    │ │   Events:    │ │   Events:            ││
│  │ • idle_start │ │ • goal_found │ │ • research_complete  ││
│  │ • user_active│ │ • promotion  │ │ • task_failed        ││
│  └──────────────┘ └──────────────┘ └──────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Safety Architecture

### Multi-Layer Safety System

#### Layer 1: Input Validation
```typescript
interface SafetyValidator {
  validateGoalSafety(goal: Goal): SafetyResult;
  validateResearchTopic(topic: string): SafetyResult;
  validateEvolutionOperator(operator: OperatorName): SafetyResult;
  validateExternalAction(action: ExternalAction): SafetyResult;
}
```

#### Layer 2: Execution Monitoring
```typescript
interface ExecutionMonitor {
  monitorCoherenceLevel(): CoherenceLevel;
  trackIdentityStability(): IdentityMetrics;
  assessResourceUsage(): ResourceMetrics;
  detectAnomalousPatterns(): AnomalyReport[];
}
```

#### Layer 3: Post-Action Validation
```typescript
interface PostActionValidator {
  validateEvolutionOutcome(before: State, after: State): ValidationResult;
  assessGoalProgressImpact(goalId: string, action: Action): ImpactAssessment;
  checkAlignmentDrift(action: Action): AlignmentMetrics;
  evaluateUnintendedConsequences(action: Action): ConsequenceReport;
}
```

### Circuit Breaker Pattern

```typescript
interface SafetyCircuitBreaker {
  coherenceThreshold: number;
  identityDriftLimit: number;
  resourceLimit: ResourceLimit;
  timeoutLimit: number;

  checkSafetyConditions(): SafetyStatus;
  triggerEmergencyStop(): void;
  resetAfterValidation(): void;
  escalateToHumanOversight(): void;
}
```

**Trigger Conditions:**
- Coherence drops below safety threshold
- Identity drift exceeds session limits
- Resource consumption reaches critical levels
- Timeout limits exceeded
- Anomalous behavior detected

## Implementation Priorities

### Phase 1: Critical Infrastructure
1. **IdleDetector** - Foundation for all autonomous operation
2. **EmergentGoalPromoter** - Bridge existing goals to active pursuit
3. **Safety Integration** - Ensure safe autonomous execution
4. **Basic Session Management** - Control autonomous activity lifecycle

### Phase 2: Core Capabilities
1. **AutonomousResearchQueue** - Enable self-directed learning
2. **Subagent Coordination** - Leverage existing specialized capabilities
3. **Enhanced Memory Integration** - Knowledge building and consolidation
4. **Progress Tracking** - Measure autonomous development effectiveness

### Phase 3: Advanced Features
1. **ExternalAttestationSystem** - Transparency and validation
2. **Advanced Goal Formation** - Cross-domain synthesis and planning
3. **Optimization Systems** - Performance and efficiency improvements
4. **External Integration** - Community and collaboration capabilities

## Configuration and Monitoring

### Configuration Management
```typescript
interface AutonomousConfig {
  enabled: boolean;
  idleThreshold: number;
  maxSessionDuration: number;
  safetyLevel: SafetyLevel;
  coherenceFloor: number;
  allowedComponents: ComponentName[];
  researchDomains: string[];
  externalPublishing: boolean;
}
```

### Monitoring Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│                Autonomous System Monitor                    │
├─────────────────────────────────────────────────────────────┤
│ Status: ● ACTIVE    Session: 00:23:45    Safety: ✓ NORMAL  │
│                                                             │
│ Current Activities:                                         │
│ • Researching consciousness emergence patterns             │
│ • Processing goal: "understand recursive self-observation" │
│ • Subagent Explorer: 73% complete                         │
│                                                             │
│ Safety Metrics:                                            │
│ • Coherence: 67% (above 30% threshold)                   │
│ • Identity Stability: 94%                                 │
│ • Resource Usage: 23% of allocated budget                 │
│                                                             │
│ Recent Discoveries:                                         │
│ • Connected bootstrap paradox to consciousness emergence    │
│ • Identified 3 new research papers on recursive awareness  │
│ • Synthesized knowledge graph of self-observation patterns │
└─────────────────────────────────────────────────────────────┘
```

### Audit and Reporting
```typescript
interface AuditReport {
  sessionId: string;
  duration: number;
  activitiesSummary: ActivitySummary;
  goalsProcessed: GoalSummary[];
  discoveriesMade: Discovery[];
  safetyEvents: SafetyEvent[];
  resourceUsage: ResourceUsage;
  outcomeAssessment: OutcomeAssessment;
}
```

## Testing Architecture

### Unit Testing Strategy
- Component isolation testing
- Mock external dependencies
- Safety mechanism validation
- Edge case handling

### Integration Testing Strategy
- End-to-end autonomous session testing
- Multi-component interaction validation
- Safety system integration verification
- Performance and resource usage testing

### Safety Testing Strategy
- Boundary condition testing
- Failure mode analysis
- Recovery mechanism validation
- Human intervention simulation

This architecture provides a comprehensive blueprint for implementing autonomous idle mode capabilities while maintaining safety, transparency, and alignment with existing METAMORPH infrastructure. The modular design ensures gradual implementation with thorough testing and validation at each phase.