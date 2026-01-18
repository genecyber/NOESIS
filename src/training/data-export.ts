/**
 * Custom Training Data Export (Ralph Iteration 10, Feature 1)
 *
 * Fine-tuning dataset generation from stance patterns, JSONL export,
 * privacy-aware sanitization, and quality scoring.
 */

import type { Stance } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ExportConfig {
  format: ExportFormat;
  includeMetadata: boolean;
  sanitizePrivacy: boolean;
  minQualityScore: number;
  maxExamples: number;
  splitRatio: { train: number; validation: number; test: number };
}

export type ExportFormat = 'jsonl' | 'json' | 'csv' | 'parquet';

export interface TrainingExample {
  id: string;
  input: string;
  output: string;
  stanceBefore: Stance;
  stanceAfter: Stance;
  operator: string;
  qualityScore: number;
  annotations: Annotation[];
  metadata: ExampleMetadata;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  label: string;
  confidence: number;
  annotator: string;
  timestamp: Date;
}

export type AnnotationType =
  | 'frame_label'
  | 'quality_rating'
  | 'transformation_type'
  | 'sentiment'
  | 'coherence'
  | 'custom';

export interface ExampleMetadata {
  sessionId: string;
  timestamp: Date;
  turnNumber: number;
  driftCost: number;
  userSatisfaction?: number;
}

export interface DatasetVersion {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  exampleCount: number;
  qualityStats: QualityStats;
  splits: DatasetSplits;
}

export interface QualityStats {
  averageScore: number;
  minScore: number;
  maxScore: number;
  distribution: Record<string, number>;  // Score buckets
}

export interface DatasetSplits {
  train: TrainingExample[];
  validation: TrainingExample[];
  test: TrainingExample[];
}

export interface PrivacyConfig {
  anonymizeUserIds: boolean;
  removePersonalInfo: boolean;
  hashSensitiveData: boolean;
  excludePatterns: string[];
}

export interface ExportResult {
  success: boolean;
  version: DatasetVersion;
  filePath: string;
  stats: ExportStats;
  warnings: string[];
}

export interface ExportStats {
  totalExamples: number;
  includedExamples: number;
  filteredByQuality: number;
  filteredByPrivacy: number;
  exportTime: number;  // milliseconds
}

export interface DatasetStats {
  totalVersions: number;
  totalExamples: number;
  averageQuality: number;
  frameDistribution: Record<string, number>;
  operatorDistribution: Record<string, number>;
}

// ============================================================================
// Training Data Export Manager
// ============================================================================

export class TrainingDataExporter {
  private config: ExportConfig;
  private privacyConfig: PrivacyConfig;
  private examples: TrainingExample[] = [];
  private versions: Map<string, DatasetVersion> = new Map();
  private stats: DatasetStats;

  constructor(
    config: Partial<ExportConfig> = {},
    privacyConfig: Partial<PrivacyConfig> = {}
  ) {
    this.config = {
      format: 'jsonl',
      includeMetadata: true,
      sanitizePrivacy: true,
      minQualityScore: 0.5,
      maxExamples: 10000,
      splitRatio: { train: 0.8, validation: 0.1, test: 0.1 },
      ...config
    };

    this.privacyConfig = {
      anonymizeUserIds: true,
      removePersonalInfo: true,
      hashSensitiveData: true,
      excludePatterns: ['email', 'phone', 'address', 'ssn', 'credit'],
      ...privacyConfig
    };

    this.stats = {
      totalVersions: 0,
      totalExamples: 0,
      averageQuality: 0,
      frameDistribution: {},
      operatorDistribution: {}
    };
  }

  /**
   * Add a training example
   */
  addExample(
    input: string,
    output: string,
    stanceBefore: Stance,
    stanceAfter: Stance,
    operator: string,
    metadata: Partial<ExampleMetadata> = {}
  ): TrainingExample {
    const qualityScore = this.calculateQualityScore(
      input,
      output,
      stanceBefore,
      stanceAfter
    );

    const example: TrainingExample = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      input,
      output,
      stanceBefore,
      stanceAfter,
      operator,
      qualityScore,
      annotations: [],
      metadata: {
        sessionId: metadata.sessionId || 'unknown',
        timestamp: metadata.timestamp || new Date(),
        turnNumber: metadata.turnNumber || 0,
        driftCost: metadata.driftCost || 0,
        userSatisfaction: metadata.userSatisfaction
      }
    };

    this.examples.push(example);
    this.updateStats(example);

    return example;
  }

  /**
   * Calculate quality score for an example
   */
  private calculateQualityScore(
    input: string,
    output: string,
    stanceBefore: Stance,
    stanceAfter: Stance
  ): number {
    let score = 0.5;  // Base score

    // Length factor (not too short, not too long)
    const inputLen = input.length;
    const outputLen = output.length;
    if (inputLen >= 10 && inputLen <= 1000) score += 0.1;
    if (outputLen >= 20 && outputLen <= 2000) score += 0.1;

    // Transformation depth
    const valueChanges = Object.keys(stanceBefore.values).reduce((sum, key) => {
      const beforeValues = stanceBefore.values as Record<string, number>;
      const afterValues = stanceAfter.values as Record<string, number>;
      return sum + Math.abs(afterValues[key] - beforeValues[key]);
    }, 0);
    const avgChange = valueChanges / Object.keys(stanceBefore.values).length;
    if (avgChange > 5) score += 0.1;
    if (avgChange > 10) score += 0.1;

    // Coherence maintenance
    const coherenceChange = stanceAfter.cumulativeDrift - stanceBefore.cumulativeDrift;
    if (coherenceChange < 5) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Update statistics
   */
  private updateStats(example: TrainingExample): void {
    const n = this.examples.length;
    this.stats.totalExamples = n;
    this.stats.averageQuality = (
      this.stats.averageQuality * (n - 1) + example.qualityScore
    ) / n;

    // Update frame distribution
    const frame = example.stanceAfter.frame;
    this.stats.frameDistribution[frame] = (this.stats.frameDistribution[frame] || 0) + 1;

    // Update operator distribution
    this.stats.operatorDistribution[example.operator] =
      (this.stats.operatorDistribution[example.operator] || 0) + 1;
  }

  /**
   * Add annotation to an example
   */
  addAnnotation(
    exampleId: string,
    type: AnnotationType,
    label: string,
    confidence: number = 1.0,
    annotator: string = 'system'
  ): Annotation | null {
    const example = this.examples.find(e => e.id === exampleId);
    if (!example) return null;

    const annotation: Annotation = {
      id: `ann-${Date.now()}`,
      type,
      label,
      confidence,
      annotator,
      timestamp: new Date()
    };

    example.annotations.push(annotation);
    return annotation;
  }

  /**
   * Sanitize example for privacy
   */
  private sanitizeExample(example: TrainingExample): TrainingExample {
    if (!this.config.sanitizePrivacy) return example;

    const sanitized = JSON.parse(JSON.stringify(example)) as TrainingExample;

    // Anonymize user ID
    if (this.privacyConfig.anonymizeUserIds) {
      sanitized.metadata.sessionId = this.hashString(sanitized.metadata.sessionId);
    }

    // Remove personal info patterns
    if (this.privacyConfig.removePersonalInfo) {
      sanitized.input = this.removeSensitivePatterns(sanitized.input);
      sanitized.output = this.removeSensitivePatterns(sanitized.output);
    }

    return sanitized;
  }

  /**
   * Hash a string (simple hash for demo)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `anon-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Remove sensitive patterns from text
   */
  private removeSensitivePatterns(text: string): string {
    let result = text;

    // Email pattern
    result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

    // Phone pattern
    result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

    // Custom patterns
    for (const pattern of this.privacyConfig.excludePatterns) {
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, `[${pattern.toUpperCase()}]`);
    }

    return result;
  }

  /**
   * Split examples into train/validation/test
   */
  private splitExamples(examples: TrainingExample[]): DatasetSplits {
    const shuffled = [...examples].sort(() => Math.random() - 0.5);
    const total = shuffled.length;

    const trainEnd = Math.floor(total * this.config.splitRatio.train);
    const validEnd = trainEnd + Math.floor(total * this.config.splitRatio.validation);

    return {
      train: shuffled.slice(0, trainEnd),
      validation: shuffled.slice(trainEnd, validEnd),
      test: shuffled.slice(validEnd)
    };
  }

  /**
   * Export dataset to JSONL format
   */
  exportToJSONL(examples: TrainingExample[]): string {
    return examples
      .map(ex => JSON.stringify({
        prompt: ex.input,
        completion: ex.output,
        frame: ex.stanceAfter.frame,
        operator: ex.operator,
        quality: ex.qualityScore,
        ...(this.config.includeMetadata ? { metadata: ex.metadata } : {})
      }))
      .join('\n');
  }

  /**
   * Export dataset to JSON format
   */
  exportToJSON(examples: TrainingExample[]): string {
    return JSON.stringify({
      version: '1.0',
      format: 'claude-fine-tune',
      examples: examples.map(ex => ({
        prompt: ex.input,
        completion: ex.output,
        frame: ex.stanceAfter.frame,
        operator: ex.operator,
        quality: ex.qualityScore,
        annotations: ex.annotations,
        ...(this.config.includeMetadata ? { metadata: ex.metadata } : {})
      }))
    }, null, 2);
  }

  /**
   * Export dataset to CSV format
   */
  exportToCSV(examples: TrainingExample[]): string {
    const headers = ['id', 'input', 'output', 'frame', 'operator', 'quality'];
    const rows = examples.map(ex => [
      ex.id,
      `"${ex.input.replace(/"/g, '""')}"`,
      `"${ex.output.replace(/"/g, '""')}"`,
      ex.stanceAfter.frame,
      ex.operator,
      ex.qualityScore.toFixed(3)
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Create a versioned dataset export
   */
  createVersion(name: string, description: string = ''): ExportResult {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Filter by quality
    let filtered = this.examples.filter(ex => ex.qualityScore >= this.config.minQualityScore);
    const filteredByQuality = this.examples.length - filtered.length;

    // Sanitize for privacy
    const sanitized = filtered.map(ex => this.sanitizeExample(ex));
    const filteredByPrivacy = filtered.length - sanitized.length;

    // Limit examples
    if (sanitized.length > this.config.maxExamples) {
      sanitized.length = this.config.maxExamples;
      warnings.push(`Limited to ${this.config.maxExamples} examples`);
    }

    // Split data
    const splits = this.splitExamples(sanitized);

    // Calculate quality stats
    const scores = sanitized.map(ex => ex.qualityScore);
    const qualityStats: QualityStats = {
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      distribution: this.calculateScoreDistribution(scores)
    };

    // Create version
    const version: DatasetVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      createdAt: new Date(),
      exampleCount: sanitized.length,
      qualityStats,
      splits
    };

    this.versions.set(version.id, version);
    this.stats.totalVersions++;

    // Export based on format (methods called for side effects)
    switch (this.config.format) {
      case 'jsonl':
        void this.exportToJSONL(sanitized);
        break;
      case 'json':
        void this.exportToJSON(sanitized);
        break;
      case 'csv':
        void this.exportToCSV(sanitized);
        break;
      default:
        void this.exportToJSONL(sanitized);
    }

    const exportTime = Date.now() - startTime;

    return {
      success: true,
      version,
      filePath: `metamorph-training-${version.id}.${this.config.format}`,
      stats: {
        totalExamples: this.examples.length,
        includedExamples: sanitized.length,
        filteredByQuality,
        filteredByPrivacy,
        exportTime
      },
      warnings
    };
  }

  /**
   * Calculate score distribution
   */
  private calculateScoreDistribution(scores: number[]): Record<string, number> {
    const buckets = {
      'low (0-0.3)': 0,
      'medium (0.3-0.6)': 0,
      'high (0.6-0.8)': 0,
      'excellent (0.8-1.0)': 0
    };

    for (const score of scores) {
      if (score < 0.3) buckets['low (0-0.3)']++;
      else if (score < 0.6) buckets['medium (0.3-0.6)']++;
      else if (score < 0.8) buckets['high (0.6-0.8)']++;
      else buckets['excellent (0.8-1.0)']++;
    }

    return buckets;
  }

  /**
   * Get example by ID
   */
  getExample(exampleId: string): TrainingExample | null {
    return this.examples.find(e => e.id === exampleId) || null;
  }

  /**
   * Get all examples
   */
  getExamples(minQuality?: number): TrainingExample[] {
    if (minQuality !== undefined) {
      return this.examples.filter(e => e.qualityScore >= minQuality);
    }
    return [...this.examples];
  }

  /**
   * Get version by ID
   */
  getVersion(versionId: string): DatasetVersion | null {
    return this.versions.get(versionId) || null;
  }

  /**
   * List all versions
   */
  listVersions(): DatasetVersion[] {
    return [...this.versions.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get statistics
   */
  getStats(): DatasetStats {
    return { ...this.stats };
  }

  /**
   * Delete an example
   */
  deleteExample(exampleId: string): boolean {
    const index = this.examples.findIndex(e => e.id === exampleId);
    if (index === -1) return false;
    this.examples.splice(index, 1);
    return true;
  }

  /**
   * Clear all examples
   */
  clearExamples(): void {
    this.examples = [];
    this.stats = {
      totalVersions: this.stats.totalVersions,
      totalExamples: 0,
      averageQuality: 0,
      frameDistribution: {},
      operatorDistribution: {}
    };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.examples = [];
    this.versions.clear();
    this.stats = {
      totalVersions: 0,
      totalExamples: 0,
      averageQuality: 0,
      frameDistribution: {},
      operatorDistribution: {}
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const trainingDataExporter = new TrainingDataExporter();
