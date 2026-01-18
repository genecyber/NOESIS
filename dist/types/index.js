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
    operatorFatigueLookback: z.number().min(5).max(20).default(10)
});
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
    'operator_fatigue' // Ralph Iteration 2 - autonomous pattern detection
]);
// ============================================================================
// Default Values
// ============================================================================
export function createDefaultValues() {
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
export function createDefaultSentience() {
    return {
        awarenessLevel: 20,
        autonomyLevel: 10,
        identityStrength: 30,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
    };
}
export function createDefaultStance() {
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
export function createDefaultConfig() {
    return ModeConfigSchema.parse({});
}
//# sourceMappingURL=index.js.map