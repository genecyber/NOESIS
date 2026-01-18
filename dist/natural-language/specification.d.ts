/**
 * Natural Language Stance Specification
 *
 * Convert prose descriptions to formal stance configurations
 * with semantic interpretation and validation.
 */
import type { Stance } from '../types/index.js';
export interface NLSpecification {
    input: string;
    parsedStance: Partial<Stance>;
    confidence: number;
    ambiguities: Ambiguity[];
    suggestions: string[];
    validationErrors: ValidationError[];
}
export interface Ambiguity {
    field: keyof Stance;
    interpretations: Interpretation[];
    resolvedTo?: unknown;
    question?: string;
}
export interface Interpretation {
    value: unknown;
    confidence: number;
    reasoning: string;
}
export interface ValidationError {
    field: keyof Stance;
    message: string;
    suggestion?: string;
}
export interface RefinementDialogue {
    id: string;
    originalInput: string;
    currentSpec: NLSpecification;
    questions: ClarificationQuestion[];
    answers: Map<string, string>;
    refinementHistory: RefinementStep[];
}
export interface ClarificationQuestion {
    id: string;
    question: string;
    targetField: keyof Stance;
    options?: string[];
    required: boolean;
}
export interface RefinementStep {
    timestamp: Date;
    question?: string;
    answer?: string;
    stanceChange: Partial<Stance>;
}
export interface ExampleMapping {
    input: string;
    output: Stance;
    explanation: string;
    tags: string[];
}
export declare class NaturalLanguageSpecifier {
    private examples;
    private dialogues;
    constructor();
    private initializeExamples;
    parse(input: string): NLSpecification;
    private tokenize;
    private parseFrame;
    private parseSelfModel;
    private parseObjective;
    private parseValues;
    private parseSentience;
    private extractMetaphors;
    private extractConstraints;
    private validate;
    private generateSuggestions;
    startRefinement(input: string): RefinementDialogue;
    answerQuestion(dialogueId: string, questionId: string, answer: string): NLSpecification | null;
    getDialogue(id: string): RefinementDialogue | undefined;
    addExample(example: ExampleMapping): void;
    findSimilarExamples(input: string): ExampleMapping[];
    generateFromExample(input: string): NLSpecification | null;
    getExamples(): ExampleMapping[];
}
export declare function createNLSpecifier(): NaturalLanguageSpecifier;
//# sourceMappingURL=specification.d.ts.map