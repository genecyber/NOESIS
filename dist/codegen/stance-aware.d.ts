/**
 * Stance-Aware Code Generation (Ralph Iteration 8, Feature 3)
 *
 * Code generation influenced by current frame, stance-styled
 * code review feedback, and frame-specific coding approaches.
 */
import type { Stance, Frame } from '../types/index.js';
export interface CodeGenConfig {
    enableStanceInfluence: boolean;
    frameStyleStrength: number;
    valueThreshold: number;
    reviewStyleEnabled: boolean;
    maxSuggestions: number;
}
export interface GenerationRequest {
    type: GenerationType;
    context: CodeContext;
    requirements: string;
    stance: Stance;
    language: ProgrammingLanguage;
}
export type GenerationType = 'function' | 'class' | 'module' | 'test' | 'refactor' | 'fix' | 'documentation';
export type ProgrammingLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java';
export interface CodeContext {
    filePath?: string;
    existingCode?: string;
    imports?: string[];
    dependencies?: string[];
    projectType?: string;
}
export interface GenerationResult {
    code: string;
    explanation: string;
    stanceInfluence: FrameInfluence;
    suggestions: CodeSuggestion[];
    warnings?: string[];
}
export interface FrameInfluence {
    frame: Frame;
    appliedTraits: string[];
    styleModifications: string[];
    confidence: number;
}
export interface CodeSuggestion {
    type: SuggestionType;
    description: string;
    location?: {
        line: number;
        column: number;
    };
    replacement?: string;
    priority: 'low' | 'medium' | 'high';
}
export type SuggestionType = 'style' | 'performance' | 'security' | 'maintainability' | 'error_handling' | 'documentation';
export interface ReviewRequest {
    code: string;
    language: ProgrammingLanguage;
    stance: Stance;
    focusAreas?: SuggestionType[];
}
export interface ReviewResult {
    overallScore: number;
    suggestions: CodeSuggestion[];
    stanceStyledFeedback: string;
    strengths: string[];
    improvements: string[];
}
export interface FrameCodingStyle {
    comments: 'minimal' | 'moderate' | 'extensive';
    errorHandling: 'minimal' | 'defensive' | 'comprehensive';
    abstraction: 'low' | 'medium' | 'high';
    naming: 'concise' | 'descriptive' | 'expressive';
    structure: 'flat' | 'modular' | 'layered';
    testing: 'basic' | 'thorough' | 'exhaustive';
}
export interface CodeGenStats {
    totalGenerations: number;
    totalReviews: number;
    avgGenerationScore: number;
    frameDistribution: Record<Frame, number>;
    suggestionsByType: Record<SuggestionType, number>;
}
export declare class StanceAwareCodeGenerator {
    private config;
    private stats;
    constructor(config?: Partial<CodeGenConfig>);
    /**
     * Generate code based on stance
     */
    generate(request: GenerationRequest): Promise<GenerationResult>;
    /**
     * Get coding style for frame
     */
    private getFrameCodingStyle;
    /**
     * Get value-based influence
     */
    private getValueInfluence;
    /**
     * Get traits that will be applied
     */
    private getAppliedTraits;
    /**
     * Get style modifications
     */
    private getStyleModifications;
    /**
     * Generate code template
     */
    private generateCodeTemplate;
    /**
     * Generate function code
     */
    private generateFunction;
    /**
     * Generate class code
     */
    private generateClass;
    /**
     * Generate test code
     */
    private generateTest;
    /**
     * Generate documentation
     */
    private generateDocumentation;
    /**
     * Generate generic code
     */
    private generateGenericCode;
    /**
     * Generate code suggestions
     */
    private generateSuggestions;
    /**
     * Get generation warnings
     */
    private getGenerationWarnings;
    /**
     * Review code with stance-styled feedback
     */
    review(request: ReviewRequest): Promise<ReviewResult>;
    /**
     * Analyze code for issues
     */
    private analyzeCode;
    /**
     * Generate styled feedback
     */
    private generateStyledFeedback;
    /**
     * Identify code strengths
     */
    private identifyStrengths;
    /**
     * Get statistics
     */
    getStats(): CodeGenStats;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<CodeGenConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): CodeGenConfig;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
export declare const stanceCodeGen: StanceAwareCodeGenerator;
//# sourceMappingURL=stance-aware.d.ts.map