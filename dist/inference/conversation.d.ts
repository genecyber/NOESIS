/**
 * Conversation-Derived Stance Inference
 *
 * Automatically detects and infers stance configuration from
 * conversation history using pattern recognition.
 */
import type { Stance, Frame, SelfModel, Objective, Values, ConversationMessage } from '../types/index.js';
export interface InferredStance {
    stance: Stance;
    confidence: number;
    evidence: InferenceEvidence[];
    suggestions: string[];
    timestamp: Date;
}
export interface InferenceEvidence {
    field: string;
    value: unknown;
    confidence: number;
    sources: EvidenceSource[];
}
export interface EvidenceSource {
    messageIndex: number;
    snippet: string;
    pattern: string;
    weight: number;
}
export interface FramePattern {
    frame: Frame;
    keywords: string[];
    phrases: string[];
    weight: number;
}
export interface ValuePattern {
    valueKey: keyof Values;
    positiveIndicators: string[];
    negativeIndicators: string[];
    neutralRange: [number, number];
}
export interface SelfModelPattern {
    selfModel: SelfModel;
    indicators: string[];
    behaviorPatterns: string[];
}
export interface ObjectivePattern {
    objective: Objective;
    indicators: string[];
    goalPhrases: string[];
}
export interface InferenceConfig {
    minConfidence: number;
    maxMessages: number;
    weightRecency: boolean;
    includeSystemMessages: boolean;
}
export declare class ConversationStanceInference {
    private config;
    constructor(config?: Partial<InferenceConfig>);
    inferStance(messages: ConversationMessage[]): InferredStance;
    private filterMessages;
    private inferFrame;
    private inferValues;
    private inferSelfModel;
    private inferObjective;
    private extractSnippet;
    private buildStanceFromEvidence;
    private calculateOverallConfidence;
    private generateSuggestions;
    updateConfig(config: Partial<InferenceConfig>): void;
    getConfig(): InferenceConfig;
}
export declare function createStanceInference(config?: Partial<InferenceConfig>): ConversationStanceInference;
//# sourceMappingURL=conversation.d.ts.map