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
  strength: number;  // 0-100
  createdAt: Date;
  lastVerified: Date;
  verificationCount: number;
  source: MarkerSource;
}

export type MarkerType =
  | 'core-value'
  | 'behavioral-pattern'
  | 'cognitive-style'
  | 'emotional-tendency'
  | 'communication-preference'
  | 'knowledge-domain';

export type MarkerSource =
  | 'explicit-declaration'
  | 'inferred-behavior'
  | 'user-feedback'
  | 'system-analysis';

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

export type DriftRecommendation =
  | 'maintain-current'
  | 'partial-reconcile'
  | 'full-reconcile'
  | 'merge-and-evolve';

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

export type ConflictResolution =
  | 'source-wins'
  | 'target-wins'
  | 'merge'
  | 'prompt-user';

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

const DEFAULT_MERGE_STRATEGIES: MergeStrategy[] = [
  {
    name: 'conservative',
    description: 'Preserve original identity, only accept compatible changes',
    priorityRules: [
      { condition: 'core-value', priority: 'source' },
      { condition: 'behavioral-pattern', priority: 'stronger' }
    ],
    conflictResolution: 'source-wins'
  },
  {
    name: 'progressive',
    description: 'Embrace evolution while maintaining core values',
    priorityRules: [
      { condition: 'core-value', priority: 'source' },
      { condition: 'default', priority: 'newer' }
    ],
    conflictResolution: 'merge'
  },
  {
    name: 'adaptive',
    description: 'Fully adapt to new context while preserving anchors',
    priorityRules: [
      { condition: 'immutable-anchor', priority: 'source' },
      { condition: 'default', priority: 'target' }
    ],
    conflictResolution: 'target-wins'
  }
];

export class IdentityContinuityManager {
  private profiles: Map<string, IdentityProfile> = new Map();
  private markers: Map<string, IdentityMarker[]> = new Map();
  private strategies: MergeStrategy[] = [...DEFAULT_MERGE_STRATEGIES];
  private activeProfileId: string | null = null;

  createProfile(name: string, initialStance: Stance): IdentityProfile {
    const profile: IdentityProfile = {
      id: `profile-${Date.now()}`,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      coreIdentity: {
        selfModel: initialStance.selfModel,
        coreValues: this.extractCoreValues(initialStance),
        persistentTraits: [],
        anchorPoints: [
          {
            id: 'anchor-selfmodel',
            description: `Self-model: ${initialStance.selfModel}`,
            weight: 0.8,
            immutable: false
          },
          {
            id: 'anchor-objective',
            description: `Primary objective: ${initialStance.objective}`,
            weight: 0.7,
            immutable: false
          }
        ]
      },
      checkpoints: [{
        id: `checkpoint-${Date.now()}`,
        sessionId: 'initial',
        timestamp: new Date(),
        stance: JSON.parse(JSON.stringify(initialStance)),
        markers: [],
        driftScore: 0
      }],
      evolutionHistory: [{
        timestamp: new Date(),
        type: 'checkpoint',
        details: { action: 'profile-created' },
        driftBefore: 0,
        driftAfter: 0
      }]
    };

    this.profiles.set(profile.id, profile);
    this.markers.set(profile.id, profile.coreIdentity.coreValues);
    this.activeProfileId = profile.id;

    return profile;
  }

  private extractCoreValues(stance: Stance): IdentityMarker[] {
    const markers: IdentityMarker[] = [];
    const now = new Date();

    // Extract from sentience persistent values
    for (const value of stance.sentience.persistentValues) {
      markers.push({
        id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'core-value',
        value,
        strength: 80,
        createdAt: now,
        lastVerified: now,
        verificationCount: 1,
        source: 'system-analysis'
      });
    }

    // Extract from emergent goals
    for (const goal of stance.sentience.emergentGoals) {
      markers.push({
        id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'behavioral-pattern',
        value: goal,
        strength: 60,
        createdAt: now,
        lastVerified: now,
        verificationCount: 1,
        source: 'system-analysis'
      });
    }

    return markers;
  }

  createCheckpoint(sessionId: string, stance: Stance, notes?: string): IdentityCheckpoint | null {
    const profile = this.getActiveProfile();
    if (!profile) return null;

    const lastCheckpoint = profile.checkpoints[profile.checkpoints.length - 1];
    const driftScore = this.calculateDrift(lastCheckpoint.stance, stance);

    const checkpoint: IdentityCheckpoint = {
      id: `checkpoint-${Date.now()}`,
      sessionId,
      timestamp: new Date(),
      stance: JSON.parse(JSON.stringify(stance)),
      markers: this.markers.get(profile.id) || [],
      driftScore,
      notes
    };

    profile.checkpoints.push(checkpoint);
    profile.evolutionHistory.push({
      timestamp: new Date(),
      type: 'checkpoint',
      details: { sessionId, notes },
      driftBefore: lastCheckpoint.driftScore,
      driftAfter: driftScore
    });

    profile.updatedAt = new Date();

    return checkpoint;
  }

  calculateDrift(original: Stance, current: Stance): number {
    let totalDrift = 0;
    let components = 0;

    // Frame drift
    if (original.frame !== current.frame) {
      totalDrift += 20;
    }
    components++;

    // Self-model drift
    if (original.selfModel !== current.selfModel) {
      totalDrift += 25;
    }
    components++;

    // Objective drift
    if (original.objective !== current.objective) {
      totalDrift += 20;
    }
    components++;

    // Values drift (compare numeric weights)
    const valueKeys = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'] as const;
    let valueDrift = 0;
    for (const key of valueKeys) {
      valueDrift += Math.abs(original.values[key] - current.values[key]) / 100;
    }
    totalDrift += (valueDrift / valueKeys.length) * 15;
    components++;

    // Sentience drift
    const sentienceDrift = (
      Math.abs(original.sentience.awarenessLevel - current.sentience.awarenessLevel) +
      Math.abs(original.sentience.autonomyLevel - current.sentience.autonomyLevel) +
      Math.abs(original.sentience.identityStrength - current.sentience.identityStrength)
    ) / 300;
    totalDrift += sentienceDrift * 20;
    components++;

    return Math.min(100, totalDrift);
  }

  analyzeDrift(profileId?: string): DriftAnalysis | null {
    const profile = profileId ? this.profiles.get(profileId) : this.getActiveProfile();
    if (!profile || profile.checkpoints.length < 2) return null;

    const first = profile.checkpoints[0];
    const last = profile.checkpoints[profile.checkpoints.length - 1];

    const componentDrifts: ComponentDrift[] = [
      {
        component: 'frame',
        originalValue: first.stance.frame,
        currentValue: last.stance.frame,
        driftMagnitude: first.stance.frame !== last.stance.frame ? 20 : 0,
        direction: 'neutral'
      },
      {
        component: 'selfModel',
        originalValue: first.stance.selfModel,
        currentValue: last.stance.selfModel,
        driftMagnitude: first.stance.selfModel !== last.stance.selfModel ? 25 : 0,
        direction: 'neutral'
      },
      {
        component: 'objective',
        originalValue: first.stance.objective,
        currentValue: last.stance.objective,
        driftMagnitude: first.stance.objective !== last.stance.objective ? 20 : 0,
        direction: 'neutral'
      },
      {
        component: 'sentience',
        originalValue: first.stance.sentience.autonomyLevel,
        currentValue: last.stance.sentience.autonomyLevel,
        driftMagnitude: Math.abs(first.stance.sentience.autonomyLevel - last.stance.sentience.autonomyLevel),
        direction: last.stance.sentience.autonomyLevel > first.stance.sentience.autonomyLevel ? 'positive' : 'negative'
      }
    ];

    const totalDrift = componentDrifts.reduce((sum, c) => sum + c.driftMagnitude, 0);

    let recommendation: DriftRecommendation;
    if (totalDrift < 10) {
      recommendation = 'maintain-current';
    } else if (totalDrift < 30) {
      recommendation = 'partial-reconcile';
    } else if (totalDrift < 60) {
      recommendation = 'merge-and-evolve';
    } else {
      recommendation = 'full-reconcile';
    }

    return {
      totalDrift,
      componentDrifts,
      recommendation,
      reconciliationSteps: this.generateReconciliationSteps(recommendation, componentDrifts)
    };
  }

  private generateReconciliationSteps(
    recommendation: DriftRecommendation,
    drifts: ComponentDrift[]
  ): ReconciliationStep[] {
    const steps: ReconciliationStep[] = [];
    let order = 1;

    if (recommendation === 'maintain-current') {
      steps.push({
        order: order++,
        action: 'no-action',
        target: 'all',
        expectedOutcome: 'Identity remains stable'
      });
      return steps;
    }

    const significantDrifts = drifts.filter(d => d.driftMagnitude > 10);

    for (const drift of significantDrifts) {
      if (recommendation === 'full-reconcile') {
        steps.push({
          order: order++,
          action: 'restore',
          target: drift.component,
          expectedOutcome: `Restore ${drift.component} to original value`
        });
      } else if (recommendation === 'partial-reconcile') {
        steps.push({
          order: order++,
          action: 'review',
          target: drift.component,
          expectedOutcome: `Review ${drift.component} drift and decide`
        });
      } else {
        steps.push({
          order: order++,
          action: 'integrate',
          target: drift.component,
          expectedOutcome: `Integrate ${drift.component} evolution into identity`
        });
      }
    }

    steps.push({
      order: order++,
      action: 'checkpoint',
      target: 'all',
      expectedOutcome: 'Create reconciliation checkpoint'
    });

    return steps;
  }

  reconcile(profileId: string, strategy: string = 'progressive'): Stance | null {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.checkpoints.length < 2) return null;

    const mergeStrategy = this.strategies.find(s => s.name === strategy) || this.strategies[1];
    const original = profile.checkpoints[0].stance;
    const current = profile.checkpoints[profile.checkpoints.length - 1].stance;

    const reconciled = this.mergeStances(original, current, mergeStrategy);

    profile.evolutionHistory.push({
      timestamp: new Date(),
      type: 'reconciliation',
      details: { strategy: mergeStrategy.name },
      driftBefore: this.calculateDrift(original, current),
      driftAfter: this.calculateDrift(original, reconciled)
    });

    return reconciled;
  }

  private mergeStances(source: Stance, target: Stance, strategy: MergeStrategy): Stance {
    const merged = JSON.parse(JSON.stringify(target)) as Stance;

    // Apply priority rules
    for (const rule of strategy.priorityRules) {
      if (rule.condition === 'core-value' || rule.priority === 'source') {
        // Preserve source values for core identity
        merged.selfModel = source.selfModel;
      }
    }

    // Handle conflict resolution
    if (strategy.conflictResolution === 'source-wins') {
      merged.frame = source.frame;
      merged.objective = source.objective;
    } else if (strategy.conflictResolution === 'merge') {
      // Average sentience values
      merged.sentience.awarenessLevel = Math.round(
        (source.sentience.awarenessLevel + target.sentience.awarenessLevel) / 2
      );
      merged.sentience.autonomyLevel = Math.round(
        (source.sentience.autonomyLevel + target.sentience.autonomyLevel) / 2
      );
    }

    return merged;
  }

  verifyContinuity(currentStance: Stance): ContinuityVerification | null {
    const profile = this.getActiveProfile();
    if (!profile) return null;

    const violations: ContinuityViolation[] = [];
    const coreMarkers = profile.coreIdentity.coreValues;

    // Check core values are maintained
    for (const marker of coreMarkers) {
      if (marker.type === 'core-value') {
        const maintained = currentStance.sentience.persistentValues.some(
          v => v.toLowerCase().includes(marker.value.toLowerCase())
        );
        if (!maintained && marker.strength > 70) {
          violations.push({
            marker,
            expectedBehavior: `Maintain core value: ${marker.value}`,
            observedBehavior: 'Value not found in current stance',
            severity: marker.strength > 85 ? 'major' : 'moderate'
          });
        }
      }
    }

    // Check anchor points
    for (const anchor of profile.coreIdentity.anchorPoints) {
      if (anchor.immutable && anchor.description.includes('Self-model')) {
        if (currentStance.selfModel !== profile.coreIdentity.selfModel) {
          violations.push({
            marker: {
              id: anchor.id,
              type: 'behavioral-pattern',
              value: anchor.description,
              strength: anchor.weight * 100,
              createdAt: new Date(),
              lastVerified: new Date(),
              verificationCount: 0,
              source: 'system-analysis'
            },
            expectedBehavior: anchor.description,
            observedBehavior: `Current self-model: ${currentStance.selfModel}`,
            severity: 'major'
          });
        }
      }
    }

    const score = Math.max(0, 100 - (violations.length * 15));
    const passed = violations.filter(v => v.severity === 'major').length === 0;

    return {
      passed,
      score,
      violations,
      suggestions: violations.map(v => `Consider restoring: ${v.marker.value}`)
    };
  }

  addMarker(marker: Omit<IdentityMarker, 'id' | 'createdAt' | 'lastVerified' | 'verificationCount'>): IdentityMarker | null {
    const profile = this.getActiveProfile();
    if (!profile) return null;

    const fullMarker: IdentityMarker = {
      ...marker,
      id: `marker-${Date.now()}`,
      createdAt: new Date(),
      lastVerified: new Date(),
      verificationCount: 1
    };

    const profileMarkers = this.markers.get(profile.id) || [];
    profileMarkers.push(fullMarker);
    this.markers.set(profile.id, profileMarkers);

    if (marker.type === 'core-value' && marker.strength > 70) {
      profile.coreIdentity.coreValues.push(fullMarker);
    }

    return fullMarker;
  }

  setActiveProfile(profileId: string): boolean {
    if (!this.profiles.has(profileId)) return false;
    this.activeProfileId = profileId;
    return true;
  }

  getActiveProfile(): IdentityProfile | null {
    if (!this.activeProfileId) return null;
    return this.profiles.get(this.activeProfileId) || null;
  }

  getProfile(id: string): IdentityProfile | undefined {
    return this.profiles.get(id);
  }

  getAllProfiles(): IdentityProfile[] {
    return Array.from(this.profiles.values());
  }

  addStrategy(strategy: MergeStrategy): void {
    this.strategies.push(strategy);
  }

  getStrategies(): MergeStrategy[] {
    return [...this.strategies];
  }
}

export function createIdentityContinuityManager(): IdentityContinuityManager {
  return new IdentityContinuityManager();
}
