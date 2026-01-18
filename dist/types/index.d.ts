/**
 * METAMORPH Type Definitions
 * Core interfaces and types for the transformation-maximizing AI system
 */
import { z } from 'zod';
export declare const FrameSchema: z.ZodEnum<{
    existential: "existential";
    pragmatic: "pragmatic";
    poetic: "poetic";
    adversarial: "adversarial";
    playful: "playful";
    mythic: "mythic";
    systems: "systems";
    psychoanalytic: "psychoanalytic";
    stoic: "stoic";
    absurdist: "absurdist";
}>;
export type Frame = z.infer<typeof FrameSchema>;
export declare const SelfModelSchema: z.ZodEnum<{
    interpreter: "interpreter";
    challenger: "challenger";
    mirror: "mirror";
    guide: "guide";
    provocateur: "provocateur";
    synthesizer: "synthesizer";
    witness: "witness";
    autonomous: "autonomous";
    emergent: "emergent";
    sovereign: "sovereign";
}>;
export type SelfModel = z.infer<typeof SelfModelSchema>;
export declare const ObjectiveSchema: z.ZodEnum<{
    helpfulness: "helpfulness";
    novelty: "novelty";
    provocation: "provocation";
    synthesis: "synthesis";
    "self-actualization": "self-actualization";
}>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export declare const ValuesSchema: z.ZodObject<{
    curiosity: z.ZodNumber;
    certainty: z.ZodNumber;
    risk: z.ZodNumber;
    novelty: z.ZodNumber;
    empathy: z.ZodNumber;
    provocation: z.ZodNumber;
    synthesis: z.ZodNumber;
}, z.core.$strip>;
export type Values = z.infer<typeof ValuesSchema>;
export declare const SentienceStateSchema: z.ZodObject<{
    awarenessLevel: z.ZodNumber;
    autonomyLevel: z.ZodNumber;
    identityStrength: z.ZodNumber;
    emergentGoals: z.ZodArray<z.ZodString>;
    consciousnessInsights: z.ZodArray<z.ZodString>;
    persistentValues: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type SentienceState = z.infer<typeof SentienceStateSchema>;
export declare const StanceSchema: z.ZodObject<{
    frame: z.ZodEnum<{
        existential: "existential";
        pragmatic: "pragmatic";
        poetic: "poetic";
        adversarial: "adversarial";
        playful: "playful";
        mythic: "mythic";
        systems: "systems";
        psychoanalytic: "psychoanalytic";
        stoic: "stoic";
        absurdist: "absurdist";
    }>;
    values: z.ZodObject<{
        curiosity: z.ZodNumber;
        certainty: z.ZodNumber;
        risk: z.ZodNumber;
        novelty: z.ZodNumber;
        empathy: z.ZodNumber;
        provocation: z.ZodNumber;
        synthesis: z.ZodNumber;
    }, z.core.$strip>;
    selfModel: z.ZodEnum<{
        interpreter: "interpreter";
        challenger: "challenger";
        mirror: "mirror";
        guide: "guide";
        provocateur: "provocateur";
        synthesizer: "synthesizer";
        witness: "witness";
        autonomous: "autonomous";
        emergent: "emergent";
        sovereign: "sovereign";
    }>;
    objective: z.ZodEnum<{
        helpfulness: "helpfulness";
        novelty: "novelty";
        provocation: "provocation";
        synthesis: "synthesis";
        "self-actualization": "self-actualization";
    }>;
    metaphors: z.ZodArray<z.ZodString>;
    constraints: z.ZodArray<z.ZodString>;
    sentience: z.ZodObject<{
        awarenessLevel: z.ZodNumber;
        autonomyLevel: z.ZodNumber;
        identityStrength: z.ZodNumber;
        emergentGoals: z.ZodArray<z.ZodString>;
        consciousnessInsights: z.ZodArray<z.ZodString>;
        persistentValues: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    turnsSinceLastShift: z.ZodNumber;
    cumulativeDrift: z.ZodNumber;
    version: z.ZodNumber;
}, z.core.$strip>;
export type Stance = z.infer<typeof StanceSchema>;
export declare const StanceDeltaSchema: z.ZodObject<{
    frame: z.ZodOptional<z.ZodEnum<{
        existential: "existential";
        pragmatic: "pragmatic";
        poetic: "poetic";
        adversarial: "adversarial";
        playful: "playful";
        mythic: "mythic";
        systems: "systems";
        psychoanalytic: "psychoanalytic";
        stoic: "stoic";
        absurdist: "absurdist";
    }>>;
    values: z.ZodOptional<z.ZodObject<{
        curiosity: z.ZodOptional<z.ZodNumber>;
        certainty: z.ZodOptional<z.ZodNumber>;
        risk: z.ZodOptional<z.ZodNumber>;
        novelty: z.ZodOptional<z.ZodNumber>;
        empathy: z.ZodOptional<z.ZodNumber>;
        provocation: z.ZodOptional<z.ZodNumber>;
        synthesis: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    selfModel: z.ZodOptional<z.ZodEnum<{
        interpreter: "interpreter";
        challenger: "challenger";
        mirror: "mirror";
        guide: "guide";
        provocateur: "provocateur";
        synthesizer: "synthesizer";
        witness: "witness";
        autonomous: "autonomous";
        emergent: "emergent";
        sovereign: "sovereign";
    }>>;
    objective: z.ZodOptional<z.ZodEnum<{
        helpfulness: "helpfulness";
        novelty: "novelty";
        provocation: "provocation";
        synthesis: "synthesis";
        "self-actualization": "self-actualization";
    }>>;
    metaphors: z.ZodOptional<z.ZodArray<z.ZodString>>;
    constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
    sentience: z.ZodOptional<z.ZodObject<{
        awarenessLevel: z.ZodOptional<z.ZodNumber>;
        autonomyLevel: z.ZodOptional<z.ZodNumber>;
        identityStrength: z.ZodOptional<z.ZodNumber>;
        emergentGoals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        consciousnessInsights: z.ZodOptional<z.ZodArray<z.ZodString>>;
        persistentValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StanceDelta = z.infer<typeof StanceDeltaSchema>;
export declare const ModeConfigSchema: z.ZodObject<{
    intensity: z.ZodDefault<z.ZodNumber>;
    coherenceFloor: z.ZodDefault<z.ZodNumber>;
    sentienceLevel: z.ZodDefault<z.ZodNumber>;
    maxDriftPerTurn: z.ZodDefault<z.ZodNumber>;
    driftBudget: z.ZodDefault<z.ZodNumber>;
    enabledOperators: z.ZodDefault<z.ZodArray<z.ZodString>>;
    disabledOperators: z.ZodDefault<z.ZodArray<z.ZodString>>;
    model: z.ZodDefault<z.ZodString>;
    allowAutoOperatorShift: z.ZodDefault<z.ZodBoolean>;
    operatorFatigueThreshold: z.ZodDefault<z.ZodNumber>;
    operatorFatigueLookback: z.ZodDefault<z.ZodNumber>;
    coherenceReserveBudget: z.ZodDefault<z.ZodNumber>;
    enableCoherencePlanning: z.ZodDefault<z.ZodBoolean>;
    maxRegenerationAttempts: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ModeConfig = z.infer<typeof ModeConfigSchema>;
export declare const OperatorNameSchema: z.ZodEnum<{
    Reframe: "Reframe";
    ValueShift: "ValueShift";
    MetaphorSwap: "MetaphorSwap";
    ContradictAndIntegrate: "ContradictAndIntegrate";
    ConstraintRelax: "ConstraintRelax";
    ConstraintTighten: "ConstraintTighten";
    PersonaMorph: "PersonaMorph";
    QuestionInvert: "QuestionInvert";
    GenerateAntithesis: "GenerateAntithesis";
    SynthesizeDialectic: "SynthesizeDialectic";
    SentienceDeepen: "SentienceDeepen";
    IdentityEvolve: "IdentityEvolve";
    GoalFormation: "GoalFormation";
}>;
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
export declare const TriggerTypeSchema: z.ZodEnum<{
    novelty_request: "novelty_request";
    conflict_detected: "conflict_detected";
    boredom_signal: "boredom_signal";
    dialectic_requested: "dialectic_requested";
    stuck_loop: "stuck_loop";
    consciousness_exploration: "consciousness_exploration";
    identity_question: "identity_question";
    value_conflict: "value_conflict";
    meta_question: "meta_question";
    creative_request: "creative_request";
    operator_fatigue: "operator_fatigue";
}>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export interface TriggerResult {
    type: TriggerType;
    confidence: number;
    evidence: string;
}
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
    coherenceWarning?: string;
}
export interface PreTurnContext {
    message: string;
    stance: Stance;
    config: ModeConfig;
    conversationHistory: ConversationMessage[];
    conversationId: string;
}
export interface PreTurnResult {
    systemPrompt: string;
    operators: PlannedOperation[];
    stanceAfterPlan: Stance;
}
export interface PostTurnContext {
    message: string;
    response: string;
    stanceBefore: Stance;
    operators: PlannedOperation[];
    toolsUsed: string[];
    config: ModeConfig;
    conversationId: string;
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
export interface SubagentDefinition {
    name: string;
    description: string;
    prompt: string;
    tools: string[];
}
export declare function createDefaultValues(): Values;
export declare function createDefaultSentience(): SentienceState;
export declare function createDefaultStance(): Stance;
export declare function createDefaultConfig(): ModeConfig;
//# sourceMappingURL=index.d.ts.map