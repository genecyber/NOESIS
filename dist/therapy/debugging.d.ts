/**
 * Stance Therapy and Debugging Tools
 *
 * Automated detection, diagnosis, and repair of stance inconsistencies
 * with self-healing mechanisms and recovery playbooks.
 */
import type { Stance } from '../types/index.js';
export interface StanceHealthReport {
    overall: 'healthy' | 'warning' | 'critical';
    score: number;
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
export type IssueCategory = 'coherence' | 'consistency' | 'completeness' | 'conflict' | 'drift' | 'stagnation';
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
export type InterventionType = 'adjustment' | 'reset' | 'reinforcement' | 'rebalancing' | 'constraint-removal' | 'value-alignment';
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
export declare class StanceTherapist {
    private snapshots;
    private sessions;
    private playbooks;
    private traceEnabled;
    enableTracing(): void;
    disableTracing(): void;
    isTracingEnabled(): boolean;
    takeSnapshot(stance: Stance, context: string, event?: string): void;
    getSnapshots(): DebugSnapshot[];
    diagnose(stance: Stance): StanceHealthReport;
    private inferAffectedFields;
    private detectDrift;
    private calculateHealthScore;
    private generateRecommendations;
    autoHeal(stance: Stance): {
        healed: Stance;
        interventions: Intervention[];
    };
    startTherapySession(stance: Stance): TherapySession;
    applyIntervention(sessionId: string, type: InterventionType, target: keyof Stance, newValue: unknown): boolean;
    completeSession(sessionId: string): TherapySession | null;
    getSession(sessionId: string): TherapySession | undefined;
    addPlaybook(playbook: RecoveryPlaybook): void;
    getPlaybooks(): RecoveryPlaybook[];
    findApplicablePlaybook(_stance: Stance): RecoveryPlaybook | null;
    executePlaybook(playbook: RecoveryPlaybook, stance: Stance): {
        success: boolean;
        result: Stance;
    };
    private executePlaybookStep;
}
export declare function createTherapist(): StanceTherapist;
//# sourceMappingURL=debugging.d.ts.map