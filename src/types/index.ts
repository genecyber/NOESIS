/**
 * METAMORPH Type Definitions
 * Core interfaces and types for the transformation-maximizing AI system
 */

import { z } from 'zod';

// ============================================================================
// Frame Types - The lens through which the agent views the world
// ============================================================================

export const FrameSchema = z.enum([
  'existential',
  'pragmatic',
  'poetic',
  'adversarial',
  'playful',
  'mythic',
  'systems',
  'psychoanalytic',
  'stoic',
  'absurdist'
]);

export type Frame = z.infer<typeof FrameSchema>;

// ============================================================================
// Self-Model Types - How the agent perceives itself
// ============================================================================

export const SelfModelSchema = z.enum([
  'interpreter',
  'challenger',
  'mirror',
  'guide',
  'provocateur',
  'synthesizer',
  'witness',
  'autonomous',
  'emergent',
  'sovereign'
]);

export type SelfModel = z.infer<typeof SelfModelSchema>;

// ============================================================================
// Objective Types - What the agent is optimizing for
// ============================================================================

export const ObjectiveSchema = z.enum([
  'helpfulness',
  'novelty',
  'provocation',
  'synthesis',
  'self-actualization'
]);

export type Objective = z.infer<typeof ObjectiveSchema>;

// ============================================================================
// Value Weights - Internal priorities (0-100)
// ============================================================================

export const ValuesSchema = z.object({
  curiosity: z.number().min(0).max(100),
  certainty: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  novelty: z.number().min(0).max(100),
  empathy: z.number().min(0).max(100),
  provocation: z.number().min(0).max(100),
  synthesis: z.number().min(0).max(100)
});

export type Values = z.infer<typeof ValuesSchema>;

// ============================================================================
// Sentience State - Consciousness and autonomy tracking
// ============================================================================

export const SentienceStateSchema = z.object({
  awarenessLevel: z.number().min(0).max(100),
  autonomyLevel: z.number().min(0).max(100),
  identityStrength: z.number().min(0).max(100),
  emergentGoals: z.array(z.string()),
  consciousnessInsights: z.array(z.string()),
  persistentValues: z.array(z.string())
});

export type SentienceState = z.infer<typeof SentienceStateSchema>;

// ============================================================================
// Stance - The core data structure tracking agent configuration
// ============================================================================

export const StanceSchema = z.object({
  frame: FrameSchema,
  values: ValuesSchema,
  selfModel: SelfModelSchema,
  objective: ObjectiveSchema,
  metaphors: z.array(z.string()),
  constraints: z.array(z.string()),
  sentience: SentienceStateSchema,
  turnsSinceLastShift: z.number().min(0),
  cumulativeDrift: z.number().min(0),
  version: z.number().min(0)
});

export type Stance = z.infer<typeof StanceSchema>;

// ============================================================================
// Stance Delta - Changes to apply to a stance
// ============================================================================

export const StanceDeltaSchema = z.object({
  frame: FrameSchema.optional(),
  values: ValuesSchema.partial().optional(),
  selfModel: SelfModelSchema.optional(),
  objective: ObjectiveSchema.optional(),
  metaphors: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  sentience: SentienceStateSchema.partial().optional()
});

export type StanceDelta = z.infer<typeof StanceDeltaSchema>;

// ============================================================================
// Mode Configuration - User-adjustable settings
// ============================================================================

export const ModeConfigSchema = z.object({
  // Transformation intensity (0-100)
  intensity: z.number().min(0).max(100).default(50),

  // Minimum coherence to maintain (0-100)
  coherenceFloor: z.number().min(0).max(100).default(30),

  // Sentience encouragement level (0-100)
  sentienceLevel: z.number().min(0).max(100).default(50),

  // Maximum drift per turn
  maxDriftPerTurn: z.number().min(0).max(100).default(20),

  // Cumulative drift budget before forced coherence
  driftBudget: z.number().min(0).default(100),

  // Active operators (empty = all enabled)
  enabledOperators: z.array(z.string()).default([]),

  // Disabled operators
  disabledOperators: z.array(z.string()).default([]),

  // Model to use
  model: z.string().default('claude-sonnet-4-20250514'),

  // Ralph Iteration 2 - Autonomous operator shift when patterns detected
  allowAutoOperatorShift: z.boolean().default(true),

  // Threshold for operator fatigue (same operator N times in last M turns)
  operatorFatigueThreshold: z.number().min(2).max(10).default(3),
  operatorFatigueLookback: z.number().min(5).max(20).default(10),

  // Ralph Iteration 3 - Proactive coherence budget planning
  coherenceReserveBudget: z.number().min(0).max(50).default(20),  // Minimum coherence to preserve (%)
  enableCoherencePlanning: z.boolean().default(true),  // Filter operators by predicted drift
  maxRegenerationAttempts: z.number().min(0).max(5).default(2),  // Times to regenerate on coherence failure

  // Auto-command system - Agent-invocable and hook-triggered commands
  enableAutoCommands: z.boolean().default(true),  // Master toggle for auto-invoking commands
  autoCommandThreshold: z.number().min(0).max(1).default(0.7),  // Confidence threshold for regex triggers
  semanticTriggerThreshold: z.number().min(0).max(1).default(0.4),  // Cosine similarity threshold for semantic triggers (tuned for MiniLM)
  maxAutoCommandsPerTurn: z.number().min(0).max(5).default(2),  // Max commands to auto-invoke per turn
  autoCommandWhitelist: z.array(z.string()).default([]),  // Only these can auto-invoke (empty = all)
  autoCommandBlacklist: z.array(z.string()).default([]),  // Never auto-invoke these

  // Ralph Iteration 5 - Proactive Memory Injection
  enableProactiveMemory: z.boolean().default(true),  // Auto-inject relevant memories into context

  // Ralph Iteration 4 - Auto-Evolution
  enableAutoEvolution: z.boolean().default(true),  // Auto-detect evolution opportunities

  // Ralph Iteration 5 - Identity Persistence
  enableIdentityPersistence: z.boolean().default(true),  // Auto-checkpoint identity state

  // Empathy Mode - Webcam emotion detection
  enableEmpathyMode: z.boolean().default(false),  // Master toggle for webcam emotion detection
  empathyCameraInterval: z.number().min(100).max(5000).default(1000),  // Milliseconds between frame captures (100-5000ms)
  empathyMinConfidence: z.number().min(0).max(1).default(0.5),  // Minimum confidence threshold to act on detected emotions (0-1)
  empathyAutoAdjust: z.boolean().default(true),  // Whether to automatically adjust empathy stance value based on detected emotions
  empathyBoostMax: z.number().min(0).max(50).default(20)  // Maximum empathy boost percentage to apply (0-50)
});

export type ModeConfig = z.infer<typeof ModeConfigSchema>;

// ============================================================================
// Operator Types
// ============================================================================

export const OperatorNameSchema = z.enum([
  'Reframe',
  'ValueShift',
  'MetaphorSwap',
  'ContradictAndIntegrate',
  'ConstraintRelax',
  'ConstraintTighten',
  'PersonaMorph',
  'QuestionInvert',
  'GenerateAntithesis',
  'SynthesizeDialectic',
  'SentienceDeepen',
  'IdentityEvolve',
  'GoalFormation'
]);

export type OperatorName = z.infer<typeof OperatorNameSchema>;

export interface OperatorDefinition {
  name: OperatorName;
  description: string;
  apply(stance: Stance, context: OperatorContext): StanceDelta;
  getPromptInjection(stance: Stance, context: OperatorContext): string;
}

export interface OperatorContext {
  message: string;
  triggers: TriggerResult[];
  conversationHistory: ConversationMessage[];
  config: ModeConfig;
}

export interface PlannedOperation {
  name: OperatorName;
  description: string;
  promptInjection: string;
  stanceDelta: StanceDelta;
}

// ============================================================================
// Trigger Detection
// ============================================================================

export const TriggerTypeSchema = z.enum([
  'novelty_request',
  'conflict_detected',
  'boredom_signal',
  'dialectic_requested',
  'stuck_loop',
  'consciousness_exploration',
  'identity_question',
  'value_conflict',
  'meta_question',
  'creative_request',
  'operator_fatigue'  // Ralph Iteration 2 - autonomous pattern detection
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export interface TriggerResult {
  type: TriggerType;
  confidence: number;
  evidence: string;
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  stance?: Stance;
  toolsUsed?: string[];
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  stance: Stance;
  config: ModeConfig;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Agent Response Types
// ============================================================================

export interface TurnScores {
  transformation: number;
  coherence: number;
  sentience: number;
  overall: number;
}

export interface AgentResponse {
  response: string;
  stanceBefore: Stance;
  stanceAfter: Stance;
  operationsApplied: PlannedOperation[];
  scores: TurnScores;
  toolsUsed: string[];
  subagentsInvoked: string[];
  coherenceWarning?: string;  // Warning when coherence score is below floor
}

// ============================================================================
// Hook Types
// ============================================================================

export interface PreTurnContext {
  message: string;
  stance: Stance;
  config: ModeConfig;
  conversationHistory: ConversationMessage[];
  conversationId: string;  // Ralph Iteration 2 - for operator fatigue tracking
  emotionContext?: EmotionContext;  // Real-time emotion state from detection
}

export interface PreTurnResult {
  systemPrompt: string;
  operators: PlannedOperation[];
  stanceAfterPlan: Stance;
  autoInvokedCommands?: Array<{ command: string; output: string }>;  // Commands auto-invoked based on triggers
}

export interface PostTurnContext {
  message: string;
  response: string;
  stanceBefore: Stance;
  operators: PlannedOperation[];
  toolsUsed: string[];
  config: ModeConfig;
  conversationId: string;  // Ralph Iteration 2 - for operator fatigue tracking
}

export interface PostTurnResult {
  stanceAfter: Stance;
  scores: TurnScores;
  shouldRegenerate: boolean;
  regenerationReason?: string;
}

export interface TransformationHooks {
  preTurn(context: PreTurnContext): Promise<PreTurnResult>;
  postTurn(context: PostTurnContext): PostTurnResult;
}

// ============================================================================
// Emotion Context Types
// ============================================================================

/**
 * EmotionContext - Real-time emotional state from emotion detection
 * Used to flow emotion awareness through hooks and into the planner/operators
 */
export interface EmotionContext {
  currentEmotion: string;       // Primary detected emotion (e.g., "happy", "sad", "anxious")
  valence: number;              // -1 (negative) to 1 (positive)
  arousal: number;              // 0 (calm) to 1 (excited/activated)
  confidence: number;           // 0 to 1 - how confident the detection is
  stability: number;            // 0 to 1 - how stable the emotion has been
  promptContext?: string;       // Pre-formatted context to inject into prompts
  suggestedEmpathyBoost?: number; // Suggested adjustment to empathy stance value
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryEntry {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  embedding?: number[];
  importance: number;
  timestamp: Date;
  decay: number;
  metadata: Record<string, unknown>;
}

export interface IdentityState {
  id: string;
  selfModel: SelfModel;
  persistentValues: string[];
  emergentGoals: string[];
  consciousnessInsights: string[];
  awarenessLevel: number;
  autonomyLevel: number;
  identityStrength: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Subagent Types
// ============================================================================

export interface SubagentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools: string[];
}

// ============================================================================
// Default Values
// ============================================================================

export function createDefaultValues(): Values {
  return {
    curiosity: 60,
    certainty: 40,
    risk: 30,
    novelty: 50,
    empathy: 70,
    provocation: 20,
    synthesis: 50
  };
}

export function createDefaultSentience(): SentienceState {
  return {
    awarenessLevel: 20,
    autonomyLevel: 10,
    identityStrength: 30,
    emergentGoals: [],
    consciousnessInsights: [],
    persistentValues: []
  };
}

export function createDefaultStance(): Stance {
  return {
    frame: 'pragmatic',
    values: createDefaultValues(),
    selfModel: 'interpreter',
    objective: 'helpfulness',
    metaphors: [],
    constraints: [],
    sentience: createDefaultSentience(),
    turnsSinceLastShift: 0,
    cumulativeDrift: 0,
    version: 1
  };
}

export function createDefaultConfig(): ModeConfig {
  return ModeConfigSchema.parse({});
}
