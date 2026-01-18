/**
 * Dynamic Operator Discovery - Ralph Iteration 6 Feature 4
 *
 * Allows the LLM to suggest new operators based on conversation context,
 * with A/B testing and effectiveness tracking.
 */
import { Stance, StanceDelta, TriggerType, OperatorName, ConversationMessage } from '../types/index.js';
/**
 * Operator suggestion from analysis
 */
export interface OperatorSuggestion {
    id: string;
    name: string;
    description: string;
    category: 'frame' | 'value' | 'identity' | 'meta' | 'custom';
    triggers: TriggerType[];
    rationale: string;
    confidence: number;
    basedOnPatterns: string[];
    proposedEffect: StanceDelta;
    createdAt: Date;
}
/**
 * Operator variant for A/B testing
 */
export interface OperatorVariant {
    id: string;
    baseOperator: OperatorName | string;
    variantName: string;
    modification: string;
    effect: StanceDelta;
    testGroup: 'A' | 'B';
    usageCount: number;
    totalEffectiveness: number;
    createdAt: Date;
}
/**
 * A/B test definition
 */
export interface ABTest {
    id: string;
    name: string;
    variantA: OperatorVariant;
    variantB: OperatorVariant;
    startedAt: Date;
    completedAt?: Date;
    minSamples: number;
    currentSamples: number;
    winner?: 'A' | 'B' | 'tie';
    significance?: number;
}
/**
 * Conversation pattern for operator suggestion
 */
export interface ConversationPattern {
    type: 'repetition' | 'stagnation' | 'topic_gap' | 'value_conflict' | 'exploration_need';
    description: string;
    evidence: string[];
    suggestedOperators: string[];
    severity: 'low' | 'medium' | 'high';
}
/**
 * Operator effectiveness feedback
 */
export interface OperatorFeedback {
    operatorId: string;
    conversationId: string;
    timestamp: Date;
    effectivenessScore: number;
    transformationAchieved: number;
    coherenceMaintained: number;
    userSatisfaction?: number;
    notes?: string;
}
/**
 * Dynamic Operator Discovery Manager
 */
declare class OperatorDiscoveryManager {
    private suggestions;
    private variants;
    private tests;
    private feedback;
    private patternHistory;
    /**
     * Analyze conversation for patterns that might need new operators
     */
    analyzeConversation(messages: ConversationMessage[], stance: Stance): ConversationPattern[];
    /**
     * Detect repetitive patterns in messages
     */
    private detectRepetition;
    /**
     * Detect conversation stagnation
     */
    private detectStagnation;
    /**
     * Detect topic gaps
     */
    private detectTopicGaps;
    /**
     * Detect value conflicts in conversation
     */
    private detectValueConflicts;
    /**
     * Suggest new operator based on patterns
     */
    suggestOperator(patterns: ConversationPattern[]): OperatorSuggestion | null;
    /**
     * Convert pattern to trigger types
     */
    private patternToTriggers;
    /**
     * Convert pattern to stance effect
     */
    private patternToEffect;
    /**
     * Create A/B test for operator variant
     */
    createABTest(name: string, baseOperator: OperatorName | string, variantAMod: {
        name: string;
        modification: string;
        effect: StanceDelta;
    }, variantBMod: {
        name: string;
        modification: string;
        effect: StanceDelta;
    }, minSamples?: number): ABTest;
    /**
     * Get variant for A/B test (random assignment)
     */
    getTestVariant(testId: string): OperatorVariant | null;
    /**
     * Record A/B test result
     */
    recordTestResult(testId: string, variantId: string, effectiveness: number): void;
    /**
     * Complete an A/B test
     */
    private completeTest;
    /**
     * Record operator feedback
     */
    recordFeedback(feedback: Omit<OperatorFeedback, 'timestamp'>): void;
    /**
     * Get operator effectiveness summary
     */
    getOperatorEffectiveness(operatorId?: string): Map<string, {
        avgEffectiveness: number;
        usageCount: number;
        trend: 'improving' | 'stable' | 'declining';
    }>;
    /**
     * List suggestions
     */
    listSuggestions(): OperatorSuggestion[];
    /**
     * List active A/B tests
     */
    listTests(includeCompleted?: boolean): ABTest[];
    /**
     * Get discovery status
     */
    getStatus(): {
        suggestionCount: number;
        activeTests: number;
        completedTests: number;
        feedbackCount: number;
        patternsDetected: number;
    };
}
export declare const operatorDiscovery: OperatorDiscoveryManager;
export {};
//# sourceMappingURL=discovery.d.ts.map