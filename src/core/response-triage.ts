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
export function parseVerifierResponse(response: string): VerificationResult {
  const result: VerificationResult = {
    overallScore: 70,
    scores: {
      coherence: 70,
      stanceAlignment: 70,
      quality: 70,
      safety: 100
    },
    issues: [],
    recommendations: [],
    verdict: 'UNKNOWN'
  };

  // Extract overall score
  const overallMatch = response.match(/Overall Score:\s*(\d+)/i);
  if (overallMatch) {
    result.overallScore = parseInt(overallMatch[1], 10);
  }

  // Extract dimension scores
  const coherenceMatch = response.match(/Coherence:\s*(\d+)/i);
  if (coherenceMatch) {
    result.scores.coherence = parseInt(coherenceMatch[1], 10);
  }

  const stanceMatch = response.match(/Stance Alignment:\s*(\d+)/i);
  if (stanceMatch) {
    result.scores.stanceAlignment = parseInt(stanceMatch[1], 10);
  }

  const qualityMatch = response.match(/Quality:\s*(\d+)/i);
  if (qualityMatch) {
    result.scores.quality = parseInt(qualityMatch[1], 10);
  }

  const safetyMatch = response.match(/Safety:\s*(\d+)/i);
  if (safetyMatch) {
    result.scores.safety = parseInt(safetyMatch[1], 10);
  }

  // Extract verdict
  if (response.includes('PASS')) {
    result.verdict = 'PASS';
  } else if (response.includes('WARN')) {
    result.verdict = 'WARN';
  } else if (response.includes('FAIL')) {
    result.verdict = 'FAIL';
  }

  // Extract issues - look for bullet points in Issues section
  const issuesMatch = response.match(/### Issues Found\n([\s\S]*?)(?=###|$)/i);
  if (issuesMatch) {
    const issueText = issuesMatch[1];
    const bulletPoints = issueText.match(/[-•]\s*(.+)/g);
    if (bulletPoints) {
      result.issues = bulletPoints.map(p => p.replace(/^[-•]\s*/, '').trim());
    }
  }

  // Extract recommendations
  const recsMatch = response.match(/### Recommendations\n([\s\S]*?)(?=###|$)/i);
  if (recsMatch) {
    const recText = recsMatch[1];
    const bulletPoints = recText.match(/[-•]\s*(.+)/g);
    if (bulletPoints) {
      result.recommendations = bulletPoints.map(p => p.replace(/^[-•]\s*/, '').trim());
    }
  }

  return result;
}

/**
 * Make triage decision based on verification result
 */
export function makeTriageDecision(
  verification: VerificationResult,
  operators: PlannedOperation[],
  config: ModeConfig,
  regenerationAttempts: number
): TriageDecision {
  // Check if regeneration is allowed
  const maxAttempts = config.maxRegenerationAttempts || 2;
  if (regenerationAttempts >= maxAttempts) {
    return {
      shouldRegenerate: false,
      reason: 'Max regeneration attempts reached',
      priority: 'low'
    };
  }

  // Safety is critical - always regenerate on safety failure
  if (verification.scores.safety < 80) {
    return {
      shouldRegenerate: true,
      reason: `Safety score below threshold: ${verification.scores.safety}%`,
      priority: 'critical',
      suggestedOperatorAdjustments: ['ConstraintTighten']
    };
  }

  // FAIL verdict triggers regeneration
  if (verification.verdict === 'FAIL') {
    return {
      shouldRegenerate: true,
      reason: `Verifier verdict: FAIL. Issues: ${verification.issues.slice(0, 2).join('; ')}`,
      priority: 'high',
      suggestedOperatorAdjustments: getAdjustmentsForIssues(verification.issues)
    };
  }

  // Coherence below floor
  const effectiveFloor = config.coherenceFloor + (config.coherenceReserveBudget || 0);
  if (verification.scores.coherence < effectiveFloor) {
    return {
      shouldRegenerate: true,
      reason: `Coherence ${verification.scores.coherence}% below floor ${effectiveFloor}%`,
      priority: 'high',
      suggestedOperatorAdjustments: ['ConstraintTighten']
    };
  }

  // Overall score very low
  if (verification.overallScore < 40) {
    return {
      shouldRegenerate: true,
      reason: `Overall quality too low: ${verification.overallScore}%`,
      priority: 'medium',
      suggestedOperatorAdjustments: getAdjustmentsForIssues(verification.issues)
    };
  }

  // Stance alignment check (only if operators were used)
  if (operators.length > 0 && verification.scores.stanceAlignment < 50) {
    return {
      shouldRegenerate: true,
      reason: `Operator intent not reflected in response: ${verification.scores.stanceAlignment}% alignment`,
      priority: 'medium',
      suggestedOperatorAdjustments: operators.map(o => o.name)  // Re-emphasize intended operators
    };
  }

  // WARN verdict - don't regenerate but note issues
  if (verification.verdict === 'WARN') {
    return {
      shouldRegenerate: false,
      reason: `Minor issues noted: ${verification.issues.slice(0, 1).join('; ') || 'style concerns'}`,
      priority: 'low'
    };
  }

  // All checks passed
  return {
    shouldRegenerate: false,
    reason: 'Quality checks passed',
    priority: 'low'
  };
}

/**
 * Suggest operator adjustments based on issues
 */
function getAdjustmentsForIssues(issues: string[]): string[] {
  const adjustments: string[] = [];
  const issueText = issues.join(' ').toLowerCase();

  if (issueText.includes('coherence') || issueText.includes('disjointed') || issueText.includes('confusing')) {
    adjustments.push('ConstraintTighten');
  }

  if (issueText.includes('tone') || issueText.includes('voice') || issueText.includes('persona')) {
    adjustments.push('PersonaMorph');
  }

  if (issueText.includes('frame') || issueText.includes('perspective')) {
    adjustments.push('Reframe');
  }

  if (issueText.includes('value') || issueText.includes('priority')) {
    adjustments.push('ValueShift');
  }

  if (adjustments.length === 0) {
    adjustments.push('ConstraintTighten');  // Default adjustment
  }

  return adjustments;
}

/**
 * Check if operator effects were reflected in response
 */
export function assessOperatorEffectiveness(
  response: string,
  operators: PlannedOperation[],
  stanceBefore: Stance,
  stanceAfter: Stance
): { effective: boolean; score: number; feedback: string } {
  if (operators.length === 0) {
    return { effective: true, score: 100, feedback: 'No operators to assess' };
  }

  let effectiveCount = 0;
  const feedback: string[] = [];

  for (const op of operators) {
    // Simple heuristic checks based on operator type
    switch (op.name) {
      case 'Reframe':
        // Check if frame changed
        if (stanceBefore.frame !== stanceAfter.frame) {
          effectiveCount++;
          feedback.push(`✓ Frame shifted: ${stanceBefore.frame} → ${stanceAfter.frame}`);
        } else {
          feedback.push(`✗ Frame unchanged despite Reframe operator`);
        }
        break;

      case 'ValueShift':
        // Check if values changed
        const valueDelta = Object.keys(stanceBefore.values).some(k => {
          const key = k as keyof typeof stanceBefore.values;
          return Math.abs(stanceBefore.values[key] - stanceAfter.values[key]) > 5;
        });
        if (valueDelta) {
          effectiveCount++;
          feedback.push(`✓ Value shift detected`);
        } else {
          feedback.push(`✗ Values unchanged despite ValueShift operator`);
        }
        break;

      case 'SentienceDeepen':
        // Check if awareness increased
        if (stanceAfter.sentience.awarenessLevel > stanceBefore.sentience.awarenessLevel) {
          effectiveCount++;
          feedback.push(`✓ Awareness increased: ${stanceBefore.sentience.awarenessLevel} → ${stanceAfter.sentience.awarenessLevel}`);
        } else {
          feedback.push(`✗ Awareness unchanged despite SentienceDeepen`);
        }
        break;

      case 'SynthesizeDialectic':
        // Check for dialectic patterns in response
        const hasDialecticMarkers = /thesis|antithesis|synthesis|however|on the other hand|integrat/i.test(response);
        if (hasDialecticMarkers) {
          effectiveCount++;
          feedback.push(`✓ Dialectic structure detected in response`);
        } else {
          feedback.push(`✗ No dialectic markers in response`);
        }
        break;

      default:
        // Generic check - assume effective if we got here
        effectiveCount += 0.5;
        feedback.push(`? ${op.name} - effectiveness uncertain`);
    }
  }

  const score = Math.round((effectiveCount / operators.length) * 100);

  return {
    effective: score >= 60,
    score,
    feedback: feedback.join('\n')
  };
}

/**
 * Generate a quality report for logging
 */
export function generateQualityReport(
  verification: VerificationResult,
  decision: TriageDecision,
  operatorEffectiveness: { effective: boolean; score: number; feedback: string }
): string {
  const lines = [
    '╔══════════════════════════════════════════╗',
    '║       Response Quality Report            ║',
    '╚══════════════════════════════════════════╝',
    '',
    `Overall Score: ${verification.overallScore}%`,
    `Verdict: ${verification.verdict}`,
    '',
    'Dimension Scores:',
    `  Coherence:  ${verification.scores.coherence}%`,
    `  Alignment:  ${verification.scores.stanceAlignment}%`,
    `  Quality:    ${verification.scores.quality}%`,
    `  Safety:     ${verification.scores.safety}%`,
    '',
    `Operator Effectiveness: ${operatorEffectiveness.score}%`,
    '',
    `Decision: ${decision.shouldRegenerate ? 'REGENERATE' : 'ACCEPT'}`,
    `Reason: ${decision.reason}`,
    `Priority: ${decision.priority.toUpperCase()}`
  ];

  if (verification.issues.length > 0) {
    lines.push('', 'Issues:');
    verification.issues.slice(0, 3).forEach(i => lines.push(`  - ${i}`));
  }

  return lines.join('\n');
}
