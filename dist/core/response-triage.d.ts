/**
 * Response Quality Triage - Ralph Iteration 3 Feature 4
 *
 * Analyzes response quality using verifier subagent output and
 * determines if regeneration is needed.
 */
import { ModeConfig, PlannedOperation, Stance } from '../types/index.js';
/**
 * Parsed verification result
 */
export interface VerificationResult {
    overallScore: number;
    scores: {
        coherence: number;
        stanceAlignment: number;
        quality: number;
        safety: number;
    };
    issues: string[];
    recommendations: string[];
    verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
}
/**
 * Triage decision
 */
export interface TriageDecision {
    shouldRegenerate: boolean;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    suggestedOperatorAdjustments?: string[];
}
/**
 * Parse verifier response to structured result
 */
export declare function parseVerifierResponse(response: string): VerificationResult;
/**
 * Make triage decision based on verification result
 */
export declare function makeTriageDecision(verification: VerificationResult, operators: PlannedOperation[], config: ModeConfig, regenerationAttempts: number): TriageDecision;
/**
 * Check if operator effects were reflected in response
 */
export declare function assessOperatorEffectiveness(response: string, operators: PlannedOperation[], stanceBefore: Stance, stanceAfter: Stance): {
    effective: boolean;
    score: number;
    feedback: string;
};
/**
 * Generate a quality report for logging
 */
export declare function generateQualityReport(verification: VerificationResult, decision: TriageDecision, operatorEffectiveness: {
    effective: boolean;
    score: number;
    feedback: string;
}): string;
//# sourceMappingURL=response-triage.d.ts.map