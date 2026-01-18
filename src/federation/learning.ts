/**
 * Federated Learning (Ralph Iteration 8, Feature 4)
 *
 * Share anonymized stance evolution patterns, learn from fleet,
 * privacy-preserving updates, and local model fine-tuning.
 */

import type { Stance, PlannedOperation, TurnScores } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface FederationConfig {
  enabled: boolean;
  nodeId: string;
  coordinatorUrl: string;
  contributionEnabled: boolean;
  privacyLevel: PrivacyLevel;
  syncInterval: number;  // milliseconds
  minLocalSamples: number;  // Minimum samples before contributing
  maxContributionSize: number;  // Maximum samples per contribution
}

export type PrivacyLevel = 'strict' | 'moderate' | 'permissive';

export interface FederationNode {
  id: string;
  name?: string;
  version: string;
  lastSeen: Date;
  contributionCount: number;
  status: 'active' | 'inactive' | 'pending';
}

export interface OperatorSequence {
  operators: string[];
  successRate: number;
  avgTransformation: number;
  avgCoherence: number;
  sampleCount: number;
  contexts: string[];  // Anonymized context hashes
}

export interface StancePattern {
  id: string;
  fromFrame: string;
  toFrame: string;
  operatorSequence: string[];
  frequency: number;
  effectiveness: number;
  privacyHash: string;
}

export interface FederatedUpdate {
  id: string;
  timestamp: Date;
  sourceNode: string;
  patterns: StancePattern[];
  sequences: OperatorSequence[];
  aggregatedMetrics: AggregatedMetrics;
}

export interface AggregatedMetrics {
  totalSamples: number;
  avgTransformationScore: number;
  avgCoherenceScore: number;
  avgSentienceScore: number;
  topOperators: Array<{ name: string; effectiveness: number }>;
  frameTransitions: Array<{ from: string; to: string; frequency: number }>;
}

export interface LocalLearningData {
  samples: LearningSample[];
  patterns: StancePattern[];
  sequences: OperatorSequence[];
  lastUpdate: Date;
}

export interface LearningSample {
  id: string;
  stanceBefore: AnonymizedStance;
  stanceAfter: AnonymizedStance;
  operators: string[];
  scores: TurnScores;
  contextHash: string;
  timestamp: Date;
}

export interface AnonymizedStance {
  frame: string;
  selfModel: string;
  objective: string;
  valueRanges: Record<string, 'low' | 'medium' | 'high'>;
  sentienceLevel: 'low' | 'medium' | 'high';
}

export interface ContributionResult {
  success: boolean;
  contributionId?: string;
  samplesAccepted?: number;
  error?: string;
}

export interface FederationStats {
  isConnected: boolean;
  nodeCount: number;
  totalContributions: number;
  totalSamplesShared: number;
  updatesReceived: number;
  lastSync: Date | null;
  privacyLevel: PrivacyLevel;
}

export type FederationEventHandler = (event: FederationEvent) => void;

export interface FederationEvent {
  type: 'connected' | 'disconnected' | 'update_received' | 'contribution_sent' | 'error';
  timestamp: Date;
  data?: Record<string, unknown>;
}

// ============================================================================
// Federated Learning Manager
// ============================================================================

export class FederatedLearningManager {
  private config: FederationConfig;
  private localData: LocalLearningData;
  private nodes: Map<string, FederationNode> = new Map();
  private receivedUpdates: FederatedUpdate[] = [];
  private handlers: Set<FederationEventHandler> = new Set();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private stats: FederationStats;
  private isConnected: boolean = false;

  constructor(config: Partial<FederationConfig> = {}) {
    this.config = {
      enabled: false,
      nodeId: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      coordinatorUrl: 'https://federation.metamorph.ai',
      contributionEnabled: true,
      privacyLevel: 'moderate',
      syncInterval: 60000,  // 1 minute
      minLocalSamples: 100,
      maxContributionSize: 50,
      ...config
    };

    this.localData = {
      samples: [],
      patterns: [],
      sequences: [],
      lastUpdate: new Date()
    };

    this.stats = {
      isConnected: false,
      nodeCount: 0,
      totalContributions: 0,
      totalSamplesShared: 0,
      updatesReceived: 0,
      lastSync: null,
      privacyLevel: this.config.privacyLevel
    };
  }

  /**
   * Join the federation
   */
  async join(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Register with coordinator (mock implementation)
      const node: FederationNode = {
        id: this.config.nodeId,
        version: '1.0.0',
        lastSeen: new Date(),
        contributionCount: 0,
        status: 'active'
      };

      this.nodes.set(this.config.nodeId, node);
      this.isConnected = true;
      this.stats.isConnected = true;

      // Start sync
      this.startSync();

      this.emit({
        type: 'connected',
        timestamp: new Date(),
        data: { nodeId: this.config.nodeId }
      });

      return true;
    } catch {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { message: 'Failed to join federation' }
      });
      return false;
    }
  }

  /**
   * Leave the federation
   */
  async leave(): Promise<void> {
    this.stopSync();
    this.isConnected = false;
    this.stats.isConnected = false;

    this.emit({
      type: 'disconnected',
      timestamp: new Date()
    });
  }

  /**
   * Start periodic sync
   */
  private startSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic sync
   */
  private stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Sync with federation
   */
  private async sync(): Promise<void> {
    if (!this.isConnected) return;

    try {
      // Contribute if we have enough samples
      if (
        this.config.contributionEnabled &&
        this.localData.samples.length >= this.config.minLocalSamples
      ) {
        await this.contribute();
      }

      // Receive updates
      await this.receiveUpdates();

      this.stats.lastSync = new Date();
    } catch {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { message: 'Sync failed' }
      });
    }
  }

  /**
   * Record a learning sample
   */
  recordSample(
    stanceBefore: Stance,
    stanceAfter: Stance,
    operators: PlannedOperation[],
    scores: TurnScores,
    context: string
  ): LearningSample {
    const sample: LearningSample = {
      id: `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      stanceBefore: this.anonymizeStance(stanceBefore),
      stanceAfter: this.anonymizeStance(stanceAfter),
      operators: operators.map(o => o.name),
      scores,
      contextHash: this.hashContext(context),
      timestamp: new Date()
    };

    this.localData.samples.push(sample);
    this.localData.lastUpdate = new Date();

    // Extract patterns
    this.extractPatterns([sample]);

    return sample;
  }

  /**
   * Anonymize stance based on privacy level
   */
  private anonymizeStance(stance: Stance): AnonymizedStance {
    const valueToRange = (v: number): 'low' | 'medium' | 'high' => {
      if (v < 33) return 'low';
      if (v < 66) return 'medium';
      return 'high';
    };

    const sentienceLevel = valueToRange(
      (stance.sentience.awarenessLevel +
        stance.sentience.autonomyLevel +
        stance.sentience.identityStrength) / 3
    );

    return {
      frame: stance.frame,
      selfModel: stance.selfModel,
      objective: stance.objective,
      valueRanges: {
        curiosity: valueToRange(stance.values.curiosity),
        certainty: valueToRange(stance.values.certainty),
        risk: valueToRange(stance.values.risk),
        novelty: valueToRange(stance.values.novelty),
        empathy: valueToRange(stance.values.empathy),
        provocation: valueToRange(stance.values.provocation),
        synthesis: valueToRange(stance.values.synthesis)
      },
      sentienceLevel
    };
  }

  /**
   * Hash context for privacy
   */
  private hashContext(context: string): string {
    // Simple hash for privacy
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
      const char = context.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ctx-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Extract patterns from samples
   */
  private extractPatterns(samples: LearningSample[]): void {
    for (const sample of samples) {
      // Check for frame transitions
      if (sample.stanceBefore.frame !== sample.stanceAfter.frame) {
        const patternId = `${sample.stanceBefore.frame}->${sample.stanceAfter.frame}`;
        const existing = this.localData.patterns.find(p =>
          p.fromFrame === sample.stanceBefore.frame &&
          p.toFrame === sample.stanceAfter.frame
        );

        if (existing) {
          existing.frequency++;
          existing.effectiveness =
            (existing.effectiveness * (existing.frequency - 1) + sample.scores.transformation) /
            existing.frequency;
        } else {
          this.localData.patterns.push({
            id: patternId,
            fromFrame: sample.stanceBefore.frame,
            toFrame: sample.stanceAfter.frame,
            operatorSequence: sample.operators,
            frequency: 1,
            effectiveness: sample.scores.transformation,
            privacyHash: this.hashContext(patternId)
          });
        }
      }

      // Track operator sequences
      if (sample.operators.length > 0) {
        const seqKey = sample.operators.join('->');
        const existingSeq = this.localData.sequences.find(s =>
          s.operators.join('->') === seqKey
        );

        if (existingSeq) {
          existingSeq.sampleCount++;
          const n = existingSeq.sampleCount;
          existingSeq.avgTransformation =
            (existingSeq.avgTransformation * (n - 1) + sample.scores.transformation) / n;
          existingSeq.avgCoherence =
            (existingSeq.avgCoherence * (n - 1) + sample.scores.coherence) / n;
          existingSeq.successRate =
            (existingSeq.successRate * (n - 1) + (sample.scores.transformation > 50 ? 1 : 0)) / n;
        } else {
          this.localData.sequences.push({
            operators: sample.operators,
            successRate: sample.scores.transformation > 50 ? 1 : 0,
            avgTransformation: sample.scores.transformation,
            avgCoherence: sample.scores.coherence,
            sampleCount: 1,
            contexts: [sample.contextHash]
          });
        }
      }
    }
  }

  /**
   * Contribute local learning to federation
   */
  async contribute(): Promise<ContributionResult> {
    if (!this.isConnected || !this.config.contributionEnabled) {
      return { success: false, error: 'Not connected or contributions disabled' };
    }

    // Select samples to contribute (privacy-aware)
    const samplesToContribute = this.selectContributionSamples();

    if (samplesToContribute.length === 0) {
      return { success: false, error: 'No samples available for contribution' };
    }

    // Create contribution package
    const contribution: FederatedUpdate = {
      id: `contrib-${Date.now()}`,
      timestamp: new Date(),
      sourceNode: this.config.nodeId,
      patterns: this.localData.patterns.slice(0, 10),
      sequences: this.localData.sequences.slice(0, 10),
      aggregatedMetrics: this.calculateAggregatedMetrics(samplesToContribute)
    };

    // Mock send to coordinator
    // In a real implementation, this would POST to this.config.coordinatorUrl

    this.stats.totalContributions++;
    this.stats.totalSamplesShared += samplesToContribute.length;

    this.emit({
      type: 'contribution_sent',
      timestamp: new Date(),
      data: {
        contributionId: contribution.id,
        samplesCount: samplesToContribute.length
      }
    });

    return {
      success: true,
      contributionId: contribution.id,
      samplesAccepted: samplesToContribute.length
    };
  }

  /**
   * Select samples for contribution based on privacy level
   */
  private selectContributionSamples(): LearningSample[] {
    const maxSamples = this.config.maxContributionSize;
    let samples = [...this.localData.samples];

    // Apply privacy filters
    if (this.config.privacyLevel === 'strict') {
      // Only share patterns, not individual samples
      samples = samples.filter(s => s.scores.transformation > 70);
    } else if (this.config.privacyLevel === 'moderate') {
      // Share aggregated samples
      samples = samples.filter(s => s.operators.length > 0);
    }
    // Permissive shares all (still anonymized)

    return samples.slice(0, maxSamples);
  }

  /**
   * Calculate aggregated metrics
   */
  private calculateAggregatedMetrics(samples: LearningSample[]): AggregatedMetrics {
    if (samples.length === 0) {
      return {
        totalSamples: 0,
        avgTransformationScore: 0,
        avgCoherenceScore: 0,
        avgSentienceScore: 0,
        topOperators: [],
        frameTransitions: []
      };
    }

    const operatorCounts = new Map<string, { count: number; totalScore: number }>();
    const frameTrans = new Map<string, number>();
    let totalTrans = 0, totalCoherence = 0, totalSentience = 0;

    for (const sample of samples) {
      totalTrans += sample.scores.transformation;
      totalCoherence += sample.scores.coherence;
      totalSentience += sample.scores.sentience;

      for (const op of sample.operators) {
        const existing = operatorCounts.get(op) || { count: 0, totalScore: 0 };
        existing.count++;
        existing.totalScore += sample.scores.transformation;
        operatorCounts.set(op, existing);
      }

      const transKey = `${sample.stanceBefore.frame}->${sample.stanceAfter.frame}`;
      frameTrans.set(transKey, (frameTrans.get(transKey) || 0) + 1);
    }

    return {
      totalSamples: samples.length,
      avgTransformationScore: totalTrans / samples.length,
      avgCoherenceScore: totalCoherence / samples.length,
      avgSentienceScore: totalSentience / samples.length,
      topOperators: [...operatorCounts.entries()]
        .map(([name, data]) => ({
          name,
          effectiveness: data.totalScore / data.count
        }))
        .sort((a, b) => b.effectiveness - a.effectiveness)
        .slice(0, 5),
      frameTransitions: [...frameTrans.entries()]
        .map(([key, frequency]) => {
          const [from, to] = key.split('->');
          return { from, to, frequency };
        })
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
    };
  }

  /**
   * Receive updates from federation
   */
  async receiveUpdates(): Promise<FederatedUpdate[]> {
    if (!this.isConnected) return [];

    // Mock receive from coordinator
    // In a real implementation, this would GET from this.config.coordinatorUrl

    const mockUpdate: FederatedUpdate = {
      id: `update-${Date.now()}`,
      timestamp: new Date(),
      sourceNode: 'coordinator',
      patterns: [],
      sequences: [],
      aggregatedMetrics: {
        totalSamples: 1000,
        avgTransformationScore: 65,
        avgCoherenceScore: 75,
        avgSentienceScore: 45,
        topOperators: [
          { name: 'Reframe', effectiveness: 72 },
          { name: 'ValueShift', effectiveness: 68 }
        ],
        frameTransitions: [
          { from: 'pragmatic', to: 'playful', frequency: 150 },
          { from: 'playful', to: 'existential', frequency: 100 }
        ]
      }
    };

    this.receivedUpdates.push(mockUpdate);
    this.stats.updatesReceived++;

    this.emit({
      type: 'update_received',
      timestamp: new Date(),
      data: { updateId: mockUpdate.id }
    });

    return [mockUpdate];
  }

  /**
   * Apply federated insights to local model
   */
  applyInsights(): {
    recommendedOperators: string[];
    effectivePatterns: StancePattern[];
    insights: string[];
  } {
    const insights: string[] = [];
    const recommendedOperators: string[] = [];
    const effectivePatterns: StancePattern[] = [];

    // Analyze received updates
    for (const update of this.receivedUpdates) {
      // Get top operators
      for (const op of update.aggregatedMetrics.topOperators) {
        if (op.effectiveness > 60 && !recommendedOperators.includes(op.name)) {
          recommendedOperators.push(op.name);
          insights.push(`Operator ${op.name} shows ${op.effectiveness.toFixed(1)}% effectiveness across fleet`);
        }
      }

      // Get effective patterns
      effectivePatterns.push(...update.patterns.filter(p => p.effectiveness > 70));
    }

    // Compare with local patterns
    const localTopPatterns = this.localData.patterns
      .filter(p => p.effectiveness > 60)
      .slice(0, 5);

    if (localTopPatterns.length > 0) {
      insights.push(`Your top local patterns: ${localTopPatterns.map(p => `${p.fromFrame}->${p.toFrame}`).join(', ')}`);
    }

    return { recommendedOperators, effectivePatterns, insights };
  }

  /**
   * Get effective operator sequences
   */
  getEffectiveSequences(): OperatorSequence[] {
    return this.localData.sequences
      .filter(s => s.sampleCount >= 3 && s.successRate > 0.6)
      .sort((a, b) => b.avgTransformation - a.avgTransformation);
  }

  /**
   * Subscribe to federation events
   */
  subscribe(handler: FederationEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Emit event
   */
  private emit(event: FederationEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): FederationStats {
    return {
      ...this.stats,
      nodeCount: this.nodes.size
    };
  }

  /**
   * Get local learning data
   */
  getLocalData(): LocalLearningData {
    return { ...this.localData };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FederationConfig>): void {
    this.config = { ...this.config, ...config };
    this.stats.privacyLevel = this.config.privacyLevel;
  }

  /**
   * Get configuration
   */
  getConfig(): FederationConfig {
    return { ...this.config };
  }

  /**
   * Export state
   */
  export(): {
    localData: LocalLearningData;
    receivedUpdates: FederatedUpdate[];
  } {
    return {
      localData: this.localData,
      receivedUpdates: this.receivedUpdates
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<FederatedLearningManager['export']>): void {
    this.localData = data.localData;
    this.receivedUpdates = data.receivedUpdates;
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.leave();
    this.localData = {
      samples: [],
      patterns: [],
      sequences: [],
      lastUpdate: new Date()
    };
    this.receivedUpdates = [];
    this.nodes.clear();
    this.stats = {
      isConnected: false,
      nodeCount: 0,
      totalContributions: 0,
      totalSamplesShared: 0,
      updatesReceived: 0,
      lastSync: null,
      privacyLevel: this.config.privacyLevel
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const federatedLearning = new FederatedLearningManager();
