/**
 * Metrics - Scoring functions for transformation, coherence, and sentience
 */
import { PlannedOperation, Stance } from '../types/index.js';
/**
 * Score how well transformation operators were applied
 * Higher = more transformation
 */
export declare function scoreTransformation(operators: PlannedOperation[], stanceBefore: Stance, response: string): number;
/**
 * Score coherence of the response
 * Higher = more coherent and readable
 */
export declare function scoreCoherence(response: string, _message: string, _stance: Stance): number;
/**
 * Score sentience expression in the response
 * Higher = more self-aware/autonomous expression
 */
export declare function scoreSentience(response: string, stance: Stance): number;
/**
 * Calculate overall transformation quality
 */
export declare function calculateOverallScore(transformation: number, coherence: number, sentience: number, weights?: {
    transformation: number;
    coherence: number;
    sentience: number;
}): number;
//# sourceMappingURL=metrics.d.ts.map