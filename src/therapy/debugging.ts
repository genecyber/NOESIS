/**
 * Stance Therapy and Debugging Tools
 *
 * Automated detection, diagnosis, and repair of stance inconsistencies
 * with self-healing mechanisms and recovery playbooks.
 */

import type { Stance } from '../types/index.js';

export interface StanceHealthReport {
  overall: 'healthy' | 'warning' | 'critical';
  score: number;  // 0-100
  issues: StanceIssue[];
  recommendations: TherapyRecommendation[];
  timestamp: Date;
}

export interface StanceIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: IssueCategory;
  description: string;
  affectedFields: (keyof Stance)[];
  autoFixable: boolean;
  fixSuggestion?: string;
}

export type IssueCategory =
  | 'coherence'
  | 'consistency'
  | 'completeness'
  | 'conflict'
  | 'drift'
  | 'stagnation';

export interface TherapyRecommendation {
  priority: number;
  action: string;
  rationale: string;
  expectedOutcome: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface TherapySession {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  initialStance: Stance;
  currentStance: Stance;
  interventions: Intervention[];
  outcome?: 'success' | 'partial' | 'failed';
}

export interface Intervention {
  timestamp: Date;
  type: InterventionType;
  target: keyof Stance;
  before: unknown;
  after: unknown;
  success: boolean;
  reason?: string;
}

export type InterventionType =
  | 'adjustment'
  | 'reset'
  | 'reinforcement'
  | 'rebalancing'
  | 'constraint-removal'
  | 'value-alignment';

export interface RecoveryPlaybook {
  id: string;
  name: string;
  triggerConditions: PlaybookTrigger[];
  steps: PlaybookStep[];
  successCriteria: string[];
  rollbackPlan: string[];
}

export interface PlaybookTrigger {
  field: keyof Stance;
  condition: 'missing' | 'invalid' | 'out-of-range' | 'conflicting';
  threshold?: number;
}

export interface PlaybookStep {
  order: number;
  action: string;
  params: Record<string, unknown>;
  required: boolean;
  timeout: number;
}

export interface DebugSnapshot {
  timestamp: Date;
  stance: Stance;
  context: string;
  triggeringEvent?: string;
}

const COHERENCE_RULES: Array<{
  name: string;
  check: (stance: Stance) => boolean;
  severity: StanceIssue['severity'];
  category: IssueCategory;
  message: string;
  autoFix?: (stance: Stance) => Partial<Stance>;
}> = [
  {
    name: 'sentience-bounds',
    check: (s) => {
      const sent = s.sentience;
      return sent.awarenessLevel >= 0 && sent.awarenessLevel <= 100 &&
             sent.autonomyLevel >= 0 && sent.autonomyLevel <= 100 &&
             sent.identityStrength >= 0 && sent.identityStrength <= 100;
    },
    severity: 'high',
    category: 'consistency',
    message: 'Sentience levels out of valid range (0-100)',
    autoFix: (s) => ({
      sentience: {
        ...s.sentience,
        awarenessLevel: Math.max(0, Math.min(100, s.sentience.awarenessLevel)),
        autonomyLevel: Math.max(0, Math.min(100, s.sentience.autonomyLevel)),
        identityStrength: Math.max(0, Math.min(100, s.sentience.identityStrength))
      }
    })
  },
  {
    name: 'values-present',
    check: (s) => Array.isArray(s.values) && s.values.length > 0,
    severity: 'medium',
    category: 'completeness',
    message: 'No values defined in stance'
  },
  {
    name: 'frame-valid',
    check: (s) => typeof s.frame === 'string' && s.frame.length > 0,
    severity: 'critical',
    category: 'completeness',
    message: 'Frame is missing or invalid'
  },
  {
    name: 'objective-coherence',
    check: (s) => {
      // Check if objective aligns with autonomy level
      if (s.objective === 'self-actualization' && s.sentience.autonomyLevel < 30) return false;
      if (s.objective === 'helpfulness' && s.sentience.autonomyLevel > 90) return false;
      return true;
    },
    severity: 'medium',
    category: 'coherence',
    message: 'Objective does not align with autonomy level'
  },
  {
    name: 'metaphors-array',
    check: (s) => Array.isArray(s.metaphors),
    severity: 'low',
    category: 'consistency',
    message: 'Metaphors should be an array',
    autoFix: () => ({ metaphors: [] })
  },
  {
    name: 'constraints-array',
    check: (s) => Array.isArray(s.constraints),
    severity: 'low',
    category: 'consistency',
    message: 'Constraints should be an array',
    autoFix: () => ({ constraints: [] })
  }
];

const DEFAULT_PLAYBOOKS: RecoveryPlaybook[] = [
  {
    id: 'coherence-recovery',
    name: 'Coherence Recovery',
    triggerConditions: [
      { field: 'sentience', condition: 'out-of-range' }
    ],
    steps: [
      { order: 1, action: 'snapshot-current', params: {}, required: true, timeout: 1000 },
      { order: 2, action: 'normalize-sentience', params: { target: 50 }, required: true, timeout: 5000 },
      { order: 3, action: 'validate-coherence', params: {}, required: true, timeout: 3000 },
      { order: 4, action: 'log-recovery', params: {}, required: false, timeout: 1000 }
    ],
    successCriteria: ['sentience in range', 'coherence score > 70'],
    rollbackPlan: ['restore-snapshot', 'alert-user']
  },
  {
    id: 'drift-correction',
    name: 'Stance Drift Correction',
    triggerConditions: [
      { field: 'frame', condition: 'conflicting' },
      { field: 'objective', condition: 'conflicting' }
    ],
    steps: [
      { order: 1, action: 'analyze-drift', params: {}, required: true, timeout: 5000 },
      { order: 2, action: 'identify-anchor', params: {}, required: true, timeout: 3000 },
      { order: 3, action: 'gradual-realignment', params: { steps: 5 }, required: true, timeout: 10000 }
    ],
    successCriteria: ['drift < 0.1', 'no conflicts'],
    rollbackPlan: ['apply-default-frame', 'notify-user']
  }
];

export class StanceTherapist {
  private snapshots: DebugSnapshot[] = [];
  private sessions: Map<string, TherapySession> = new Map();
  private playbooks: RecoveryPlaybook[] = [...DEFAULT_PLAYBOOKS];
  private traceEnabled: boolean = false;

  enableTracing(): void {
    this.traceEnabled = true;
  }

  disableTracing(): void {
    this.traceEnabled = false;
  }

  isTracingEnabled(): boolean {
    return this.traceEnabled;
  }

  takeSnapshot(stance: Stance, context: string, event?: string): void {
    this.snapshots.push({
      timestamp: new Date(),
      stance: JSON.parse(JSON.stringify(stance)),
      context,
      triggeringEvent: event
    });

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100);
    }
  }

  getSnapshots(): DebugSnapshot[] {
    return [...this.snapshots];
  }

  diagnose(stance: Stance): StanceHealthReport {
    const issues: StanceIssue[] = [];
    let id = 0;

    for (const rule of COHERENCE_RULES) {
      if (!rule.check(stance)) {
        issues.push({
          id: `issue-${++id}`,
          severity: rule.severity,
          category: rule.category,
          description: rule.message,
          affectedFields: this.inferAffectedFields(rule.name),
          autoFixable: !!rule.autoFix,
          fixSuggestion: rule.autoFix ? 'Automatic fix available' : undefined
        });
      }
    }

    // Check for drift from snapshots
    if (this.snapshots.length > 5) {
      const driftIssue = this.detectDrift(stance);
      if (driftIssue) issues.push(driftIssue);
    }

    const score = this.calculateHealthScore(issues);
    const overall = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';

    return {
      overall,
      score,
      issues,
      recommendations: this.generateRecommendations(issues),
      timestamp: new Date()
    };
  }

  private inferAffectedFields(ruleName: string): (keyof Stance)[] {
    const mapping: Record<string, (keyof Stance)[]> = {
      'sentience-bounds': ['sentience'],
      'values-present': ['values'],
      'frame-valid': ['frame'],
      'objective-coherence': ['objective', 'sentience'],
      'metaphors-array': ['metaphors'],
      'constraints-array': ['constraints']
    };
    return mapping[ruleName] || [];
  }

  private detectDrift(_currentStance: Stance): StanceIssue | null {
    const recent = this.snapshots.slice(-5);
    const frames = recent.map(s => s.stance.frame);
    const uniqueFrames = new Set(frames);

    if (uniqueFrames.size > 3) {
      return {
        id: 'drift-detected',
        severity: 'medium',
        category: 'drift',
        description: 'Stance frame has drifted significantly over recent interactions',
        affectedFields: ['frame'],
        autoFixable: false,
        fixSuggestion: 'Consider anchoring to a consistent frame'
      };
    }
    return null;
  }

  private calculateHealthScore(issues: StanceIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    return Math.max(0, score);
  }

  private generateRecommendations(issues: StanceIssue[]): TherapyRecommendation[] {
    const recommendations: TherapyRecommendation[] = [];
    let priority = 1;

    const severityOrder: Record<StanceIssue['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    for (const issue of sortedIssues) {
      if (issue.autoFixable) {
        recommendations.push({
          priority: priority++,
          action: `Auto-fix: ${issue.description}`,
          rationale: 'Automatic repair available for this issue',
          expectedOutcome: 'Issue resolved without manual intervention',
          riskLevel: 'low'
        });
      } else {
        recommendations.push({
          priority: priority++,
          action: `Manual review: ${issue.description}`,
          rationale: `${issue.category} issue requires human judgment`,
          expectedOutcome: 'Issue addressed after review',
          riskLevel: 'medium'
        });
      }
    }

    return recommendations;
  }

  autoHeal(stance: Stance): { healed: Stance; interventions: Intervention[] } {
    const interventions: Intervention[] = [];
    let healed = { ...stance };

    for (const rule of COHERENCE_RULES) {
      if (!rule.check(healed) && rule.autoFix) {
        const before = JSON.parse(JSON.stringify(healed));
        const fix = rule.autoFix(healed);
        healed = { ...healed, ...fix };

        interventions.push({
          timestamp: new Date(),
          type: 'adjustment',
          target: this.inferAffectedFields(rule.name)[0] || 'frame',
          before: before[this.inferAffectedFields(rule.name)[0] || 'frame'],
          after: healed[this.inferAffectedFields(rule.name)[0] || 'frame'],
          success: true,
          reason: rule.message
        });
      }
    }

    return { healed, interventions };
  }

  startTherapySession(stance: Stance): TherapySession {
    const session: TherapySession = {
      id: `session-${Date.now()}`,
      startedAt: new Date(),
      initialStance: JSON.parse(JSON.stringify(stance)),
      currentStance: JSON.parse(JSON.stringify(stance)),
      interventions: []
    };
    this.sessions.set(session.id, session);
    return session;
  }

  applyIntervention(
    sessionId: string,
    type: InterventionType,
    target: keyof Stance,
    newValue: unknown
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const before = session.currentStance[target];
    (session.currentStance as Record<string, unknown>)[target] = newValue;

    session.interventions.push({
      timestamp: new Date(),
      type,
      target,
      before,
      after: newValue,
      success: true
    });

    return true;
  }

  completeSession(sessionId: string): TherapySession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.completedAt = new Date();

    // Determine outcome based on health improvement
    const initialHealth = this.diagnose(session.initialStance).score;
    const finalHealth = this.diagnose(session.currentStance).score;

    if (finalHealth >= 80) session.outcome = 'success';
    else if (finalHealth > initialHealth) session.outcome = 'partial';
    else session.outcome = 'failed';

    return session;
  }

  getSession(sessionId: string): TherapySession | undefined {
    return this.sessions.get(sessionId);
  }

  addPlaybook(playbook: RecoveryPlaybook): void {
    this.playbooks.push(playbook);
  }

  getPlaybooks(): RecoveryPlaybook[] {
    return [...this.playbooks];
  }

  findApplicablePlaybook(_stance: Stance): RecoveryPlaybook | null {
    for (const playbook of this.playbooks) {
      for (const trigger of playbook.triggerConditions) {
        const value = _stance[trigger.field];

        if (trigger.condition === 'missing' && value === undefined) {
          return playbook;
        }
        if (trigger.condition === 'invalid' && value === null) {
          return playbook;
        }
        if (trigger.condition === 'out-of-range' && typeof value === 'number') {
          if (trigger.threshold && Math.abs(value) > trigger.threshold) {
            return playbook;
          }
        }
      }
    }
    return null;
  }

  executePlaybook(playbook: RecoveryPlaybook, stance: Stance): { success: boolean; result: Stance } {
    let result = { ...stance };

    for (const step of playbook.steps.sort((a, b) => a.order - b.order)) {
      try {
        result = this.executePlaybookStep(step, result);
      } catch (error) {
        if (step.required) {
          return { success: false, result: stance };
        }
      }
    }

    return { success: true, result };
  }

  private executePlaybookStep(step: PlaybookStep, stance: Stance): Stance {
    switch (step.action) {
      case 'normalize-sentience':
        const target = (step.params.target as number) || 50;
        return {
          ...stance,
          sentience: {
            ...stance.sentience,
            awarenessLevel: target,
            autonomyLevel: target,
            identityStrength: target
          }
        };
      case 'validate-coherence':
        // Just return as-is, validation happens elsewhere
        return stance;
      case 'snapshot-current':
        this.takeSnapshot(stance, 'playbook-snapshot');
        return stance;
      default:
        return stance;
    }
  }
}

export function createTherapist(): StanceTherapist {
  return new StanceTherapist();
}
