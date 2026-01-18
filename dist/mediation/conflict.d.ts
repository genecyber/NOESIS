/**
 * Stance Conflict Mediation
 *
 * Automatic conflict detection, mediation workflows,
 * voting mechanisms, and compromise generation.
 */
import type { Stance } from '../types/index.js';
export interface ConflictSession {
    id: string;
    stanceId: string;
    parties: ConflictParty[];
    conflicts: StanceConflict[];
    status: ConflictStatus;
    mediator?: string;
    resolution?: MediationResult;
    createdAt: Date;
    updatedAt: Date;
    deadline?: Date;
}
export interface ConflictParty {
    userId: string;
    displayName: string;
    proposedStance: Stance;
    priority: number;
    voteWeight: number;
    hasVoted: boolean;
}
export interface StanceConflict {
    id: string;
    field: string;
    values: ConflictValue[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    resolvedValue?: unknown;
    resolutionMethod?: ResolutionMethod;
}
export interface ConflictValue {
    userId: string;
    value: unknown;
    justification?: string;
    submittedAt: Date;
}
export type ConflictStatus = 'pending' | 'in_mediation' | 'voting' | 'escalated' | 'resolved' | 'abandoned';
export type ResolutionMethod = 'consensus' | 'majority-vote' | 'weighted-vote' | 'mediator-decision' | 'compromise' | 'escalation';
export interface MediationResult {
    resolvedStance: Stance;
    method: ResolutionMethod;
    agreementLevel: number;
    dissenting: string[];
    rationale: string;
    timestamp: Date;
}
export interface Vote {
    conflictId: string;
    userId: string;
    choice: unknown;
    weight: number;
    timestamp: Date;
}
export interface EscalationPath {
    level: number;
    handler: string;
    reason: string;
    escalatedAt: Date;
}
export interface MediationConfig {
    votingThreshold: number;
    consensusRequired: number;
    escalationTimeout: number;
    allowCompromise: boolean;
    maxRounds: number;
}
export declare class ConflictMediator {
    private sessions;
    private votes;
    private escalations;
    private config;
    constructor(config?: Partial<MediationConfig>);
    detectConflicts(stances: Array<{
        userId: string;
        stance: Stance;
    }>): StanceConflict[];
    private getAllFieldPaths;
    private getFieldValue;
    private calculateConflictSeverity;
    createSession(stances: Array<{
        userId: string;
        displayName: string;
        stance: Stance;
        priority?: number;
    }>, stanceId: string, mediator?: string): ConflictSession;
    startMediation(sessionId: string): boolean;
    submitVote(sessionId: string, conflictId: string, userId: string, choice: unknown): boolean;
    private resolveConflictByVote;
    generateCompromise(session: ConflictSession): Stance;
    private generateFieldCompromise;
    private setFieldValue;
    mediatorDecision(sessionId: string, conflictId: string, mediatorId: string, decision: unknown, _rationale: string): boolean;
    escalate(sessionId: string, _userId: string, reason: string): EscalationPath | null;
    resolve(sessionId: string): MediationResult | null;
    private calculateStanceDistance;
    private generateRationale;
    getSession(sessionId: string): ConflictSession | undefined;
    getVotes(sessionId: string): Vote[];
    getEscalations(sessionId: string): EscalationPath[];
    listSessions(): ConflictSession[];
    abandonSession(sessionId: string): boolean;
    updateConfig(config: Partial<MediationConfig>): void;
    getConfig(): MediationConfig;
}
export declare function createConflictMediator(config?: Partial<MediationConfig>): ConflictMediator;
//# sourceMappingURL=conflict.d.ts.map