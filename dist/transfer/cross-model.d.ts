/**
 * Cross-Model Stance Transfer (Ralph Iteration 11, Feature 1)
 *
 * Export stance configurations for other LLMs, import from external models,
 * stance translation layer, compatibility scoring, and migration assistants.
 */
import type { Stance } from '../types/index.js';
export interface TransferConfig {
    enableTransfer: boolean;
    autoCompatibilityCheck: boolean;
    preserveCoherence: boolean;
    allowLossyConversion: boolean;
    validationLevel: 'strict' | 'moderate' | 'relaxed';
}
export interface ModelProfile {
    id: string;
    name: string;
    vendor: string;
    version: string;
    capabilities: ModelCapabilities;
    stanceMapping: StanceMapping;
    compatibility: CompatibilityMatrix;
}
export interface ModelCapabilities {
    supportsFrames: boolean;
    frameSet: string[];
    supportsValues: boolean;
    valueRange: [number, number];
    supportsSentience: boolean;
    supportsOperators: boolean;
    operatorSet: string[];
    maxContextLength: number;
}
export interface StanceMapping {
    frameTranslation: Record<string, string>;
    valueScaling: Record<string, {
        scale: number;
        offset: number;
    }>;
    operatorTranslation: Record<string, string>;
    customMappings: Record<string, unknown>;
}
export interface CompatibilityMatrix {
    overallScore: number;
    frameCompatibility: number;
    valueCompatibility: number;
    operatorCompatibility: number;
    sentienceCompatibility: number;
}
export interface ExportedStance {
    id: string;
    version: string;
    sourceModel: string;
    targetModel: string | null;
    stance: Partial<Stance>;
    metadata: ExportMetadata;
    translation: TranslationInfo | null;
    checksum: string;
}
export interface ExportMetadata {
    exportedAt: Date;
    exportedBy: string;
    format: ExportFormat;
    includeHistory: boolean;
    includeMemories: boolean;
}
export type ExportFormat = 'json' | 'yaml' | 'msgpack' | 'protobuf';
export interface TranslationInfo {
    sourceProfile: string;
    targetProfile: string;
    translatedFields: string[];
    lossyFields: string[];
    unmappedFields: string[];
    warnings: string[];
}
export interface ImportResult {
    success: boolean;
    stance: Stance | null;
    compatibility: CompatibilityMatrix;
    warnings: string[];
    errors: string[];
    adjustments: StanceAdjustment[];
}
export interface StanceAdjustment {
    field: string;
    originalValue: unknown;
    adjustedValue: unknown;
    reason: string;
}
export interface MigrationPlan {
    id: string;
    sourceModel: string;
    targetModel: string;
    steps: MigrationStep[];
    estimatedLoss: number;
    alternatives: string[];
}
export interface MigrationStep {
    order: number;
    action: 'translate' | 'scale' | 'drop' | 'default' | 'manual';
    field: string;
    description: string;
    lossAmount: number;
}
export interface TransferStats {
    totalExports: number;
    totalImports: number;
    successfulTransfers: number;
    failedTransfers: number;
    averageCompatibility: number;
    modelsUsed: string[];
}
export declare class CrossModelTransferManager {
    private config;
    private modelProfiles;
    private exports;
    private migrations;
    private stats;
    constructor(config?: Partial<TransferConfig>);
    /**
     * Initialize default model profiles
     */
    private initializeDefaultProfiles;
    /**
     * Register a model profile
     */
    registerModel(profile: ModelProfile): void;
    /**
     * Export stance for transfer
     */
    exportStance(stance: Stance, targetModelId?: string, options?: Partial<ExportMetadata>): ExportedStance;
    /**
     * Translate stance for target model
     */
    private translateStance;
    /**
     * Import stance from external format
     */
    importStance(data: ExportedStance | Record<string, unknown>, sourceModelId?: string): ImportResult;
    /**
     * Adjust stance for import
     */
    private adjustStanceForImport;
    /**
     * Calculate compatibility score
     */
    calculateCompatibility(sourceModelId: string, targetModelId: string): CompatibilityMatrix;
    /**
     * Create migration plan
     */
    createMigrationPlan(sourceModelId: string, targetModelId: string): MigrationPlan;
    /**
     * Find alternative target models with better compatibility
     */
    private findAlternativeModels;
    /**
     * Estimate compatibility for unknown model
     */
    private estimateCompatibility;
    /**
     * Validate coherence of imported stance
     */
    private validateCoherence;
    /**
     * Calculate checksum for stance data
     */
    private calculateChecksum;
    /**
     * Get empty compatibility matrix
     */
    private getEmptyCompatibility;
    /**
     * Update average compatibility
     */
    private updateAverageCompatibility;
    /**
     * Get model profile
     */
    getModelProfile(modelId: string): ModelProfile | null;
    /**
     * List all model profiles
     */
    listModels(): ModelProfile[];
    /**
     * Get export by ID
     */
    getExport(exportId: string): ExportedStance | null;
    /**
     * Get migration plan
     */
    getMigrationPlan(planId: string): MigrationPlan | null;
    /**
     * Get statistics
     */
    getStats(): TransferStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const crossModelTransfer: CrossModelTransferManager;
//# sourceMappingURL=cross-model.d.ts.map