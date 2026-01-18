/**
 * Context-Aware Prompt Rewriting (Ralph Iteration 9, Feature 4)
 *
 * Stance-influenced prompt enhancement, frame-specific language adaptation,
 * value-aligned phrasing, and coherence-optimized rewrites.
 */
import type { Stance, Frame } from '../types/index.js';
export interface RewriterConfig {
    enableRewriting: boolean;
    preserveIntent: boolean;
    maxRewriteIterations: number;
    coherenceThreshold: number;
    styleStrength: 'subtle' | 'moderate' | 'strong';
    trackChanges: boolean;
}
export interface RewriteRequest {
    originalPrompt: string;
    stance: Stance;
    context: ConversationContext;
    constraints?: RewriteConstraints;
}
export interface ConversationContext {
    history: ContextMessage[];
    topic: string;
    tone: string;
    userPreferences: Record<string, unknown>;
}
export interface ContextMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface RewriteConstraints {
    maxLength?: number;
    requiredKeywords?: string[];
    forbiddenKeywords?: string[];
    targetReadingLevel?: 'simple' | 'standard' | 'advanced';
}
export interface RewriteResult {
    originalPrompt: string;
    rewrittenPrompt: string;
    changes: RewriteChange[];
    coherenceScore: number;
    stanceAlignment: number;
    suggestions: string[];
}
export interface RewriteChange {
    type: 'addition' | 'removal' | 'replacement' | 'reorder';
    original: string;
    modified: string;
    reason: string;
}
export interface FrameStyle {
    frame: Frame;
    vocabulary: string[];
    patterns: string[];
    tone: string;
    emphasis: string[];
}
export interface PhraseMapping {
    generic: string;
    framed: Record<Frame, string>;
}
export interface RewriterStats {
    promptsRewritten: number;
    averageCoherenceImprovement: number;
    averageStanceAlignment: number;
    mostCommonChanges: string[];
}
export declare class PromptRewriter {
    private config;
    private frameStyles;
    private phraseMappings;
    private stats;
    constructor(config?: Partial<RewriterConfig>);
    /**
     * Initialize frame-specific styles
     */
    private initializeFrameStyles;
    /**
     * Initialize phrase mappings
     */
    private initializePhraseMappings;
    /**
     * Rewrite a prompt based on stance
     */
    rewrite(request: RewriteRequest): RewriteResult;
    /**
     * Apply frame-specific vocabulary
     */
    private applyFrameVocabulary;
    /**
     * Check if prompt already has frame indicators
     */
    private hasFrameIndicator;
    /**
     * Apply phrase mappings
     */
    private applyPhraseMappings;
    /**
     * Apply value-aligned phrasing
     */
    private applyValueAlignment;
    /**
     * Integrate conversation context
     */
    private integrateContext;
    /**
     * Extract topics from messages
     */
    private extractTopics;
    /**
     * Apply constraints
     */
    private applyConstraints;
    /**
     * Calculate coherence score
     */
    private calculateCoherenceScore;
    /**
     * Calculate stance alignment
     */
    private calculateStanceAlignment;
    /**
     * Generate suggestions for improvement
     */
    private generateSuggestions;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Batch rewrite multiple prompts
     */
    batchRewrite(requests: RewriteRequest[]): RewriteResult[];
    /**
     * Preview rewrite without tracking
     */
    preview(request: RewriteRequest): RewriteResult;
    /**
     * Get frame style
     */
    getFrameStyle(frame: Frame): FrameStyle | null;
    /**
     * Get statistics
     */
    getStats(): RewriterStats;
    /**
     * Reset statistics
     */
    reset(): void;
}
export declare const promptRewriter: PromptRewriter;
//# sourceMappingURL=rewriter.d.ts.map