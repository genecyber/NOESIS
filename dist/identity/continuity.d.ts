/**
 * Cross-Session Identity Continuity
 *
 * Maintain identity coherence across sessions with markers,
 * checkpoints, drift reconciliation, and merge strategies.
 */
import type { Stance, SelfModel } from '../types/index.js';
export interface IdentityMarker {
    id: string;
    type: MarkerType;
    value: string;
    strength: number;
    createdAt: Date;
    lastVerified: Date;
    verificationCount: number;
    source: MarkerSource;
}
export type MarkerType = 'core-value' | 'behavioral-pattern' | 'cognitive-style' | 'emotional-tendency' | 'communication-preference' | 'knowledge-domain';
export type MarkerSource = 'explicit-declaration' | 'inferred-behavior' | 'user-feedback' | 'system-analysis';
export interface IdentityCheckpoint {
    id: string;
    sessionId: string;
    timestamp: Date;
    stance: Stance;
    markers: IdentityMarker[];
    driftScore: number;
    notes?: string;
}
export interface DriftAnalysis {
    totalDrift: number;
    componentDrifts: ComponentDrift[];
    recommendation: DriftRecommendation;
    reconciliationSteps: ReconciliationStep[];
}
export interface ComponentDrift {
    component: keyof Stance | 'markers';
    originalValue: unknown;
    currentValue: unknown;
    driftMagnitude: number;
    direction: 'positive' | 'negative' | 'neutral';
}
export type DriftRecommendation = 'maintain-current' | 'partial-reconcile' | 'full-reconcile' | 'merge-and-evolve';
export interface ReconciliationStep {
    order: number;
    action: string;
    target: string;
    expectedOutcome: string;
}
export interface MergeStrategy {
    name: string;
    description: string;
    priorityRules: PriorityRule[];
    conflictResolution: ConflictResolution;
}
export interface PriorityRule {
    condition: string;
    priority: 'source' | 'target' | 'newer' | 'stronger' | 'average';
}
export type ConflictResolution = 'source-wins' | 'target-wins' | 'merge' | 'prompt-user';
export interface ContinuityVerification {
    passed: boolean;
    score: number;
    violations: ContinuityViolation[];
    suggestions: string[];
}
export interface ContinuityViolation {
    marker: IdentityMarker;
    expectedBehavior: string;
    observedBehavior: string;
    severity: 'minor' | 'moderate' | 'major';
}
export interface IdentityProfile {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    coreIdentity: CoreIdentity;
    checkpoints: IdentityCheckpoint[];
    evolutionHistory: EvolutionEvent[];
}
export interface CoreIdentity {
    selfModel: SelfModel;
    coreValues: IdentityMarker[];
    persistentTraits: IdentityMarker[];
    anchorPoints: AnchorPoint[];
}
export interface AnchorPoint {
    id: string;
    description: string;
    weight: number;
    immutable: boolean;
}
export interface EvolutionEvent {
    timestamp: Date;
    type: 'drift' | 'reconciliation' | 'merge' | 'checkpoint' | 'anchor-update';
    details: Record<string, unknown>;
    driftBefore?: number;
    driftAfter?: number;
}
export declare class IdentityContinuityManager {
    private profiles;
    private markers;
    private strategies;
    private activeProfileId;
    createProfile(name: string, initialStance: Stance): IdentityProfile;
    private extractCoreValues;
    createCheckpoint(sessionId: string, stance: Stance, notes?: string): IdentityCheckpoint | null;
    calculateDrift(original: Stance, current: Stance): number;
    analyzeDrift(profileId?: string): DriftAnalysis | null;
    private generateReconciliationSteps;
    reconcile(profileId: string, strategy?: string): Stance | null;
    private mergeStances;
    verifyContinuity(currentStance: Stance): ContinuityVerification | null;
    addMarker(marker: Omit<IdentityMarker, 'id' | 'createdAt' | 'lastVerified' | 'verificationCount'>): IdentityMarker | null;
    setActiveProfile(profileId: string): boolean;
    getActiveProfile(): IdentityProfile | null;
    getProfile(id: string): IdentityProfile | undefined;
    getAllProfiles(): IdentityProfile[];
    addStrategy(strategy: MergeStrategy): void;
    getStrategies(): MergeStrategy[];
}
export declare function createIdentityContinuityManager(): IdentityContinuityManager;
//# sourceMappingURL=continuity.d.ts.map