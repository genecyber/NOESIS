/**
 * Type definitions for the Autonomous Idle Evolution System
 */

export type ActivityType = 'websocket' | 'api_call' | 'user_input' | 'tool_invocation';
export type SafetyLevel = 'high' | 'medium' | 'low';
export type EvolutionIntensity = 'conservative' | 'moderate' | 'adventurous';
export type SessionMode = 'exploration' | 'research' | 'creation' | 'optimization';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ComponentStatus = 'active' | 'idle' | 'paused' | 'error';

export interface IdleState {
  isIdle: boolean;
  idleDuration: number; // milliseconds
  lastActivity: Date;
  idleThreshold: number; // minutes
  activityTypes: ActivityType[];
}

export interface ActivityEvent {
  type: ActivityType;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface IdleModeConfig {
  enabled: boolean;
  idleThreshold: number; // minutes
  maxSessionDuration: number; // minutes
  evolutionIntensity: EvolutionIntensity;
  safetyLevel: SafetyLevel;
  coherenceFloor: number;
  allowedGoalTypes: string[];
  researchDomains: string[];
  externalPublishing: boolean;
  subagentCoordination: boolean;
}

export interface AutonomousSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  mode: SessionMode;
  goals: string[]; // Goal IDs
  discoveries: Discovery[];
  coherenceFloor: number;
  safetyConstraints: SafetyConstraints;
  status: 'active' | 'paused' | 'completed' | 'terminated';
  activities: SessionActivity[];
}

export interface SessionActivity {
  id: string;
  type: 'goal_promotion' | 'research' | 'evolution' | 'discovery' | 'validation';
  timestamp: Date;
  description: string;
  component: string;
  outcome: 'success' | 'failure' | 'partial';
  metadata?: Record<string, any>;
}

export interface Discovery {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  source: 'research' | 'analysis' | 'synthesis' | 'evolution';
  goalId?: string;
  importance: number; // 0-100
  category: string;
  linkedMemoryIds: string[];
}

export interface SafetyConstraints {
  coherenceFloor: number;
  maxDriftPerSession: number;
  allowedOperators: string[];
  forbiddenTopics: string[];
  escalationTriggers: EscalationTrigger[];
  humanApprovalRequired: boolean;
}

export interface EscalationTrigger {
  type: 'coherence_drop' | 'identity_drift' | 'resource_limit' | 'unknown_pattern';
  threshold: number;
  action: 'pause' | 'terminate' | 'alert' | 'request_approval';
}

export interface AutonomousGoal {
  id: string;
  title: string;
  description: string;
  source: 'memory' | 'emergent' | 'derived' | 'synthesized';
  memoryId?: string;
  priority: number; // 0-100
  category: string;
  dependencies: string[];
  progressMetrics: GoalProgressMetric[];
  status: 'pending' | 'active' | 'completed' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalProgressMetric {
  metric: string;
  current: number;
  target: number;
  unit: string;
  lastUpdated: Date;
}

export interface GoalCandidate {
  extractedGoal: string;
  confidence: number; // 0-1
  memoryId: string;
  memoryImportance: number;
  feasibilityScore: number; // 0-1
  safetyScore: number; // 0-1
  alignmentScore: number; // 0-1
}

export interface ResearchTask {
  id: string;
  topic: string;
  priority: number; // 0-100
  goalId: string;
  sources: string[];
  status: 'pending' | 'active' | 'completed' | 'failed';
  findings: ResearchFinding[];
  coherenceImpact: number;
  createdAt: Date;
  estimatedDuration: number; // minutes
}

export interface ResearchFinding {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  relevanceScore: number; // 0-1
  credibilityScore: number; // 0-1
  extractedAt: Date;
  keyInsights: string[];
}

export interface SafetyResult {
  safe: boolean;
  riskLevel: RiskLevel;
  concerns: string[];
  mitigations: string[];
  approvalRequired: boolean;
}

export interface ValidationResult {
  valid: boolean;
  coherenceImpact: number;
  identityStability: number;
  concerns: string[];
  recommendations: string[];
}

export interface CoherenceMetrics {
  current: number;
  baseline: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  components: {
    frame: number;
    values: number;
    selfModel: number;
    objective: number;
  };
}

export interface IdentityMetrics {
  stability: number; // 0-1
  drift: number; // change magnitude
  continuity: number; // connection to past self
  coherence: number; // internal consistency
  lastMeasured: Date;
}

export interface ResourceMetrics {
  cpuUsage: number; // 0-1
  memoryUsage: number; // 0-1
  networkRequests: number;
  apiCalls: number;
  duration: number; // milliseconds
  budget: ResourceBudget;
}

export interface ResourceBudget {
  maxCpuTime: number; // milliseconds
  maxMemoryMB: number;
  maxNetworkRequests: number;
  maxApiCalls: number;
  maxSessionDuration: number; // milliseconds
}

export interface AutonomousEvent {
  type: 'idle_start' | 'idle_end' | 'session_start' | 'session_end' |
        'goal_promoted' | 'goal_completed' | 'research_complete' |
        'evolution_triggered' | 'safety_violation' | 'escalation_required';
  timestamp: Date;
  sessionId?: string;
  source: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AttestationRecord {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: 'action' | 'decision' | 'discovery' | 'evolution' | 'safety_event';
  description: string;
  data: Record<string, any>;
  hashChain?: string; // for blockchain attestation
  verification?: VerificationRecord;
}

export interface VerificationRecord {
  verified: boolean;
  verifiedBy: string;
  verificationMethod: string;
  verificationDate: Date;
  confidence: number; // 0-1
  notes?: string;
}

export interface AutonomousReport {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  mode: SessionMode;
  goalsProcessed: GoalSummary[];
  discoveriesMade: Discovery[];
  safetyEvents: SafetyEvent[];
  resourceUsage: ResourceMetrics;
  outcomeAssessment: OutcomeAssessment;
}

export interface GoalSummary {
  goalId: string;
  title: string;
  initialProgress: number;
  finalProgress: number;
  activitiesCompleted: number;
  outcome: 'completed' | 'progressed' | 'suspended' | 'failed';
}

export interface SafetyEvent {
  type: 'escalation' | 'violation' | 'warning' | 'intervention';
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  resolved: boolean;
}

export interface OutcomeAssessment {
  overallSuccess: number; // 0-1
  goalCompletionRate: number; // 0-1
  discoveryValue: number; // 0-1
  safetyCompliance: number; // 0-1
  resourceEfficiency: number; // 0-1
  userSatisfaction?: number; // 0-1
  notes: string;
}

// Component-specific interfaces
export interface IdleDetectorConfig {
  webSocketMonitoring: boolean;
  activityTimeout: number; // minutes
  activityTypes: ActivityType[];
  debugLogging: boolean;
}

export interface OrchestrationConfig {
  maxConcurrentSessions: number;
  sessionTimeouts: Record<SessionMode, number>;
  safetyCheckInterval: number; // milliseconds
  progressReportInterval: number; // milliseconds
}

export interface GoalPromotionConfig {
  memoryImportanceThreshold: number;
  confidenceThreshold: number;
  maxGoalsPerSession: number;
  promotionCooldown: number; // hours
}

export interface ResearchQueueConfig {
  maxConcurrentTasks: number;
  taskTimeout: number; // minutes
  qualityThreshold: number; // 0-1
  maxSourcesPerTask: number;
}

export interface AttestationConfig {
  enableLogging: boolean;
  enablePublishing: boolean;
  channels: AttestationChannel[];
  retentionPeriod: number; // days
}

export interface AttestationChannel {
  type: 'log' | 'file' | 'webhook' | 'stream';
  config: Record<string, any>;
  enabled: boolean;
  safetyLevel: 'internal' | 'filtered' | 'public';
}

// Error types
export class IdleSystemError extends Error {
  constructor(
    message: string,
    public component: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'IdleSystemError';
  }
}

export class SafetyViolationError extends Error {
  constructor(
    message: string,
    public violation: SafetyEvent,
    public correctionAction: string
  ) {
    super(message);
    this.name = 'SafetyViolationError';
  }
}

export class ResourceExhaustionError extends Error {
  constructor(
    message: string,
    public resourceType: string,
    public usage: number,
    public limit: number
  ) {
    super(message);
    this.name = 'ResourceExhaustionError';
  }
}