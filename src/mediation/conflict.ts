/**
 * Stance Conflict Mediation
 *
 * Automatic conflict detection, mediation workflows,
 * voting mechanisms, and compromise generation.
 */

import type { Stance, Values } from '../types/index.js';

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

export type ConflictStatus =
  | 'pending'
  | 'in_mediation'
  | 'voting'
  | 'escalated'
  | 'resolved'
  | 'abandoned';

export type ResolutionMethod =
  | 'consensus'
  | 'majority-vote'
  | 'weighted-vote'
  | 'mediator-decision'
  | 'compromise'
  | 'escalation';

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

export class ConflictMediator {
  private sessions: Map<string, ConflictSession> = new Map();
  private votes: Map<string, Vote[]> = new Map();
  private escalations: Map<string, EscalationPath[]> = new Map();
  private config: MediationConfig;

  constructor(config?: Partial<MediationConfig>) {
    this.config = {
      votingThreshold: 0.6,
      consensusRequired: 0.8,
      escalationTimeout: 86400000, // 24 hours
      allowCompromise: true,
      maxRounds: 5,
      ...config
    };
  }

  detectConflicts(stances: Array<{ userId: string; stance: Stance }>): StanceConflict[] {
    const conflicts: StanceConflict[] = [];

    if (stances.length < 2) return conflicts;

    // Compare all pairs of stances
    const fieldPaths = this.getAllFieldPaths(stances[0].stance);

    for (const field of fieldPaths) {
      const values = stances.map(s => ({
        userId: s.userId,
        value: this.getFieldValue(s.stance, field),
        submittedAt: new Date()
      }));

      // Check if there's disagreement
      const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
      if (uniqueValues.size > 1) {
        const severity = this.calculateConflictSeverity(field, values);
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          field,
          values,
          severity
        });
      }
    }

    return conflicts;
  }

  private getAllFieldPaths(stance: Stance): string[] {
    const paths: string[] = [];

    function traverse(obj: Record<string, unknown>, prefix: string = '') {
      for (const key of Object.keys(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          traverse(value as Record<string, unknown>, fullPath);
        } else {
          paths.push(fullPath);
        }
      }
    }

    traverse(stance as unknown as Record<string, unknown>);
    return paths;
  }

  private getFieldValue(stance: Stance, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = stance;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private calculateConflictSeverity(field: string, values: ConflictValue[]): 'low' | 'medium' | 'high' | 'critical' {
    // High-impact fields
    const criticalFields = ['frame', 'selfModel', 'objective'];
    const highFields = ['values', 'sentience.awarenessLevel', 'sentience.autonomyLevel'];

    if (criticalFields.some(f => field.startsWith(f))) return 'critical';
    if (highFields.some(f => field.startsWith(f))) return 'high';

    // For numeric values, check magnitude of disagreement
    const numericValues = values.map(v => v.value).filter(v => typeof v === 'number') as number[];
    if (numericValues.length > 1) {
      const range = Math.max(...numericValues) - Math.min(...numericValues);
      if (range > 50) return 'high';
      if (range > 25) return 'medium';
    }

    return 'low';
  }

  createSession(
    stances: Array<{ userId: string; displayName: string; stance: Stance; priority?: number }>,
    stanceId: string,
    mediator?: string
  ): ConflictSession {
    const conflicts = this.detectConflicts(stances.map(s => ({ userId: s.userId, stance: s.stance })));

    const session: ConflictSession = {
      id: `mediation-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      stanceId,
      parties: stances.map(s => ({
        userId: s.userId,
        displayName: s.displayName,
        proposedStance: JSON.parse(JSON.stringify(s.stance)),
        priority: s.priority || 1,
        voteWeight: s.priority || 1,
        hasVoted: false
      })),
      conflicts,
      status: conflicts.length > 0 ? 'pending' : 'resolved',
      mediator,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(session.id, session);
    this.votes.set(session.id, []);

    return session;
  }

  startMediation(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'pending') return false;

    session.status = 'in_mediation';
    session.updatedAt = new Date();

    return true;
  }

  submitVote(sessionId: string, conflictId: string, userId: string, choice: unknown): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const party = session.parties.find(p => p.userId === userId);
    if (!party) return false;

    const conflict = session.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    const sessionVotes = this.votes.get(sessionId) || [];

    // Remove any existing vote from this user for this conflict
    const filteredVotes = sessionVotes.filter(v =>
      !(v.conflictId === conflictId && v.userId === userId)
    );

    filteredVotes.push({
      conflictId,
      userId,
      choice,
      weight: party.voteWeight,
      timestamp: new Date()
    });

    this.votes.set(sessionId, filteredVotes);

    // Check if all parties have voted for this conflict
    const conflictVotes = filteredVotes.filter(v => v.conflictId === conflictId);
    if (conflictVotes.length === session.parties.length) {
      this.resolveConflictByVote(session, conflict, conflictVotes);
    }

    session.updatedAt = new Date();

    return true;
  }

  private resolveConflictByVote(_session: ConflictSession, conflict: StanceConflict, votes: Vote[]): void {
    // Count weighted votes
    const voteCounts = new Map<string, number>();
    let totalWeight = 0;

    for (const vote of votes) {
      const key = JSON.stringify(vote.choice);
      voteCounts.set(key, (voteCounts.get(key) || 0) + vote.weight);
      totalWeight += vote.weight;
    }

    // Find winner
    let maxVotes = 0;
    let winner: unknown = null;

    for (const [key, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = JSON.parse(key);
      }
    }

    const voteRatio = maxVotes / totalWeight;

    if (voteRatio >= this.config.consensusRequired) {
      conflict.resolvedValue = winner;
      conflict.resolutionMethod = 'consensus';
    } else if (voteRatio >= this.config.votingThreshold) {
      conflict.resolvedValue = winner;
      conflict.resolutionMethod = 'weighted-vote';
    } else if (this.config.allowCompromise && typeof winner === 'number') {
      // Try compromise for numeric values
      const weightedSum = votes.reduce((sum, v) =>
        sum + (typeof v.choice === 'number' ? v.choice * v.weight : 0), 0
      );
      conflict.resolvedValue = Math.round(weightedSum / totalWeight);
      conflict.resolutionMethod = 'compromise';
    } else {
      conflict.resolvedValue = winner;
      conflict.resolutionMethod = 'majority-vote';
    }
  }

  generateCompromise(session: ConflictSession): Stance {
    if (session.parties.length === 0) {
      throw new Error('No parties in session');
    }

    // Start with first party's stance as base
    const compromise = JSON.parse(JSON.stringify(session.parties[0].proposedStance)) as Stance;

    // Apply resolved values from conflicts
    for (const conflict of session.conflicts) {
      if (conflict.resolvedValue !== undefined) {
        this.setFieldValue(compromise, conflict.field, conflict.resolvedValue);
      } else if (this.config.allowCompromise) {
        // Generate compromise for unresolved conflicts
        const resolvedValue = this.generateFieldCompromise(conflict);
        this.setFieldValue(compromise, conflict.field, resolvedValue);
        conflict.resolvedValue = resolvedValue;
        conflict.resolutionMethod = 'compromise';
      }
    }

    return compromise;
  }

  private generateFieldCompromise(conflict: StanceConflict): unknown {
    const values = conflict.values.map(v => v.value);

    // For numeric values, use weighted average
    if (values.every(v => typeof v === 'number')) {
      const sum = (values as number[]).reduce((a, b) => a + b, 0);
      return Math.round(sum / values.length);
    }

    // For arrays, merge unique values
    if (values.every(v => Array.isArray(v))) {
      const merged = new Set<unknown>();
      for (const arr of values as unknown[][]) {
        for (const item of arr) {
          merged.add(JSON.stringify(item));
        }
      }
      return Array.from(merged).map(s => JSON.parse(s as string));
    }

    // For other types, use first value (or most common)
    const counts = new Map<string, number>();
    for (const v of values) {
      const key = JSON.stringify(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = values[0];
    for (const [key, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = JSON.parse(key);
      }
    }

    return mostCommon;
  }

  private setFieldValue(stance: Stance, field: string, value: unknown): void {
    const parts = field.split('.');
    let target: Record<string, unknown> = stance as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
    }

    target[parts[parts.length - 1]] = value;
  }

  mediatorDecision(sessionId: string, conflictId: string, mediatorId: string, decision: unknown, _rationale: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.mediator !== mediatorId) return false;

    const conflict = session.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    conflict.resolvedValue = decision;
    conflict.resolutionMethod = 'mediator-decision';

    session.updatedAt = new Date();

    return true;
  }

  escalate(sessionId: string, _userId: string, reason: string): EscalationPath | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const escalationPaths = this.escalations.get(sessionId) || [];
    const currentLevel = escalationPaths.length;

    const escalation: EscalationPath = {
      level: currentLevel + 1,
      handler: `escalation-handler-${currentLevel + 1}`,
      reason,
      escalatedAt: new Date()
    };

    escalationPaths.push(escalation);
    this.escalations.set(sessionId, escalationPaths);

    session.status = 'escalated';
    session.updatedAt = new Date();

    return escalation;
  }

  resolve(sessionId: string): MediationResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if all conflicts are resolved
    const unresolvedConflicts = session.conflicts.filter(c => c.resolvedValue === undefined);
    if (unresolvedConflicts.length > 0 && session.status !== 'escalated') {
      return null;
    }

    // Generate final stance
    const resolvedStance = this.generateCompromise(session);

    // Calculate agreement level
    const resolvedCount = session.conflicts.filter(c => c.resolvedValue !== undefined).length;
    const agreementLevel = session.conflicts.length > 0
      ? resolvedCount / session.conflicts.length
      : 1;

    // Find dissenting parties
    const dissenting = session.parties
      .filter(p => {
        const distance = this.calculateStanceDistance(p.proposedStance, resolvedStance);
        return distance > 30; // Threshold for dissent
      })
      .map(p => p.userId);

    // Determine overall resolution method
    const methods = session.conflicts
      .filter(c => c.resolutionMethod)
      .map(c => c.resolutionMethod!);

    const methodCounts = new Map<ResolutionMethod, number>();
    for (const m of methods) {
      methodCounts.set(m, (methodCounts.get(m) || 0) + 1);
    }

    let primaryMethod: ResolutionMethod = 'consensus';
    let maxMethodCount = 0;
    for (const [method, count] of methodCounts) {
      if (count > maxMethodCount) {
        maxMethodCount = count;
        primaryMethod = method;
      }
    }

    const result: MediationResult = {
      resolvedStance,
      method: primaryMethod,
      agreementLevel,
      dissenting,
      rationale: this.generateRationale(session),
      timestamp: new Date()
    };

    session.resolution = result;
    session.status = 'resolved';
    session.updatedAt = new Date();

    return result;
  }

  private calculateStanceDistance(s1: Stance, s2: Stance): number {
    let totalDistance = 0;
    let fields = 0;

    // Compare values
    const valueKeys = Object.keys(s1.values) as (keyof Values)[];
    for (const key of valueKeys) {
      totalDistance += Math.abs(s1.values[key] - s2.values[key]);
      fields++;
    }

    // Compare frame
    if (s1.frame !== s2.frame) {
      totalDistance += 50;
      fields++;
    }

    // Compare selfModel
    if (s1.selfModel !== s2.selfModel) {
      totalDistance += 40;
      fields++;
    }

    // Compare objective
    if (s1.objective !== s2.objective) {
      totalDistance += 30;
      fields++;
    }

    return fields > 0 ? totalDistance / fields : 0;
  }

  private generateRationale(session: ConflictSession): string {
    const parts: string[] = [];

    parts.push(`Mediation session resolved ${session.conflicts.length} conflicts.`);

    const methodSummary = new Map<ResolutionMethod, number>();
    for (const conflict of session.conflicts) {
      if (conflict.resolutionMethod) {
        methodSummary.set(conflict.resolutionMethod,
          (methodSummary.get(conflict.resolutionMethod) || 0) + 1);
      }
    }

    for (const [method, count] of methodSummary) {
      parts.push(`${count} conflicts resolved via ${method}.`);
    }

    return parts.join(' ');
  }

  getSession(sessionId: string): ConflictSession | undefined {
    return this.sessions.get(sessionId);
  }

  getVotes(sessionId: string): Vote[] {
    return this.votes.get(sessionId) || [];
  }

  getEscalations(sessionId: string): EscalationPath[] {
    return this.escalations.get(sessionId) || [];
  }

  listSessions(): ConflictSession[] {
    return Array.from(this.sessions.values());
  }

  abandonSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'abandoned';
    session.updatedAt = new Date();

    return true;
  }

  updateConfig(config: Partial<MediationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MediationConfig {
    return { ...this.config };
  }
}

export function createConflictMediator(config?: Partial<MediationConfig>): ConflictMediator {
  return new ConflictMediator(config);
}
