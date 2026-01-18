/**
 * Custom Training Data Export (Ralph Iteration 10, Feature 1)
 *
 * Fine-tuning dataset generation from stance patterns, JSONL export,
 * privacy-aware sanitization, and quality scoring.
 */
import type { Stance } from '../types/index.js';
export interface ExportConfig {
    format: ExportFormat;
    includeMetadata: boolean;
    sanitizePrivacy: boolean;
    minQualityScore: number;
    maxExamples: number;
    splitRatio: {
        train: number;
        validation: number;
        test: number;
    };
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
export type AnnotationType = 'frame_label' | 'quality_rating' | 'transformation_type' | 'sentiment' | 'coherence' | 'custom';
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
    distribution: Record<string, number>;
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
    exportTime: number;
}
export interface DatasetStats {
    totalVersions: number;
    totalExamples: number;
    averageQuality: number;
    frameDistribution: Record<string, number>;
    operatorDistribution: Record<string, number>;
}
export declare class TrainingDataExporter {
    private config;
    private privacyConfig;
    private examples;
    private versions;
    private stats;
    constructor(config?: Partial<ExportConfig>, privacyConfig?: Partial<PrivacyConfig>);
    /**
     * Add a training example
     */
    addExample(input: string, output: string, stanceBefore: Stance, stanceAfter: Stance, operator: string, metadata?: Partial<ExampleMetadata>): TrainingExample;
    /**
     * Calculate quality score for an example
     */
    private calculateQualityScore;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Add annotation to an example
     */
    addAnnotation(exampleId: string, type: AnnotationType, label: string, confidence?: number, annotator?: string): Annotation | null;
    /**
     * Sanitize example for privacy
     */
    private sanitizeExample;
    /**
     * Hash a string (simple hash for demo)
     */
    private hashString;
    /**
     * Remove sensitive patterns from text
     */
    private removeSensitivePatterns;
    /**
     * Split examples into train/validation/test
     */
    private splitExamples;
    /**
     * Export dataset to JSONL format
     */
    exportToJSONL(examples: TrainingExample[]): string;
    /**
     * Export dataset to JSON format
     */
    exportToJSON(examples: TrainingExample[]): string;
    /**
     * Export dataset to CSV format
     */
    exportToCSV(examples: TrainingExample[]): string;
    /**
     * Create a versioned dataset export
     */
    createVersion(name: string, description?: string): ExportResult;
    /**
     * Calculate score distribution
     */
    private calculateScoreDistribution;
    /**
     * Get example by ID
     */
    getExample(exampleId: string): TrainingExample | null;
    /**
     * Get all examples
     */
    getExamples(minQuality?: number): TrainingExample[];
    /**
     * Get version by ID
     */
    getVersion(versionId: string): DatasetVersion | null;
    /**
     * List all versions
     */
    listVersions(): DatasetVersion[];
    /**
     * Get statistics
     */
    getStats(): DatasetStats;
    /**
     * Delete an example
     */
    deleteExample(exampleId: string): boolean;
    /**
     * Clear all examples
     */
    clearExamples(): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const trainingDataExporter: TrainingDataExporter;
//# sourceMappingURL=data-export.d.ts.map