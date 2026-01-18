/**
 * Cross-Model Stance Transfer (Ralph Iteration 11, Feature 1)
 *
 * Export stance configurations for other LLMs, import from external models,
 * stance translation layer, compatibility scoring, and migration assistants.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

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
  frameSet: string[];  // Allow any frame strings for external models
  supportsValues: boolean;
  valueRange: [number, number];
  supportsSentience: boolean;
  supportsOperators: boolean;
  operatorSet: string[];
  maxContextLength: number;
}

export interface StanceMapping {
  frameTranslation: Record<string, string>;
  valueScaling: Record<string, { scale: number; offset: number }>;
  operatorTranslation: Record<string, string>;
  customMappings: Record<string, unknown>;
}

export interface CompatibilityMatrix {
  overallScore: number;  // 0-1
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

// ============================================================================
// Cross-Model Transfer Manager
// ============================================================================

export class CrossModelTransferManager {
  private config: TransferConfig;
  private modelProfiles: Map<string, ModelProfile> = new Map();
  private exports: Map<string, ExportedStance> = new Map();
  private migrations: Map<string, MigrationPlan> = new Map();
  private stats: TransferStats;

  constructor(config: Partial<TransferConfig> = {}) {
    this.config = {
      enableTransfer: true,
      autoCompatibilityCheck: true,
      preserveCoherence: true,
      allowLossyConversion: false,
      validationLevel: 'moderate',
      ...config
    };

    this.stats = {
      totalExports: 0,
      totalImports: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      averageCompatibility: 0,
      modelsUsed: []
    };

    // Initialize with default model profiles
    this.initializeDefaultProfiles();
  }

  /**
   * Initialize default model profiles
   */
  private initializeDefaultProfiles(): void {
    // Claude profile
    this.registerModel({
      id: 'claude',
      name: 'Claude',
      vendor: 'Anthropic',
      version: '3.5',
      capabilities: {
        supportsFrames: true,
        frameSet: ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'],
        supportsValues: true,
        valueRange: [0, 100],
        supportsSentience: true,
        supportsOperators: true,
        operatorSet: ['REFRAME', 'SHIFT_FRAME', 'DEEPEN', 'EXPLORE', 'QUESTION', 'STABILIZE'],
        maxContextLength: 200000
      },
      stanceMapping: {
        frameTranslation: {},
        valueScaling: {},
        operatorTranslation: {},
        customMappings: {}
      },
      compatibility: {
        overallScore: 1.0,
        frameCompatibility: 1.0,
        valueCompatibility: 1.0,
        operatorCompatibility: 1.0,
        sentienceCompatibility: 1.0
      }
    });

    // GPT profile
    this.registerModel({
      id: 'gpt',
      name: 'GPT',
      vendor: 'OpenAI',
      version: '4',
      capabilities: {
        supportsFrames: true,
        frameSet: ['analytical', 'creative', 'neutral', 'formal', 'casual'],
        supportsValues: true,
        valueRange: [0, 1],
        supportsSentience: false,
        supportsOperators: false,
        operatorSet: [],
        maxContextLength: 128000
      },
      stanceMapping: {
        frameTranslation: {
          'existential': 'analytical',
          'pragmatic': 'neutral',
          'poetic': 'creative',
          'adversarial': 'formal',
          'playful': 'casual',
          'mythic': 'creative',
          'systems': 'analytical',
          'psychoanalytic': 'analytical',
          'stoic': 'neutral',
          'absurdist': 'creative'
        },
        valueScaling: {
          'curiosity': { scale: 0.01, offset: 0 },
          'certainty': { scale: 0.01, offset: 0 },
          'risk': { scale: 0.01, offset: 0 }
        },
        operatorTranslation: {},
        customMappings: {}
      },
      compatibility: {
        overallScore: 0.6,
        frameCompatibility: 0.5,
        valueCompatibility: 0.8,
        operatorCompatibility: 0.0,
        sentienceCompatibility: 0.0
      }
    });

    // Gemini profile
    this.registerModel({
      id: 'gemini',
      name: 'Gemini',
      vendor: 'Google',
      version: '1.5',
      capabilities: {
        supportsFrames: true,
        frameSet: ['informative', 'conversational', 'technical', 'creative'],
        supportsValues: true,
        valueRange: [0, 10],
        supportsSentience: false,
        supportsOperators: false,
        operatorSet: [],
        maxContextLength: 1000000
      },
      stanceMapping: {
        frameTranslation: {
          'existential': 'conversational',
          'pragmatic': 'informative',
          'poetic': 'creative',
          'systems': 'technical'
        },
        valueScaling: {
          'curiosity': { scale: 0.1, offset: 0 },
          'certainty': { scale: 0.1, offset: 0 }
        },
        operatorTranslation: {},
        customMappings: {}
      },
      compatibility: {
        overallScore: 0.55,
        frameCompatibility: 0.4,
        valueCompatibility: 0.7,
        operatorCompatibility: 0.0,
        sentienceCompatibility: 0.0
      }
    });
  }

  /**
   * Register a model profile
   */
  registerModel(profile: ModelProfile): void {
    this.modelProfiles.set(profile.id, profile);
    if (!this.stats.modelsUsed.includes(profile.id)) {
      this.stats.modelsUsed.push(profile.id);
    }
  }

  /**
   * Export stance for transfer
   */
  exportStance(
    stance: Stance,
    targetModelId?: string,
    options: Partial<ExportMetadata> = {}
  ): ExportedStance {
    const targetProfile = targetModelId ? this.modelProfiles.get(targetModelId) : null;

    let translation: TranslationInfo | null = null;
    let exportedStance: Partial<Stance> = { ...stance };

    // If target model specified, translate the stance
    if (targetProfile) {
      const translationResult = this.translateStance(stance, targetProfile);
      translation = translationResult.info;
      exportedStance = translationResult.stance;
    }

    const exported: ExportedStance = {
      id: `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      version: '1.0.0',
      sourceModel: 'claude',
      targetModel: targetModelId || null,
      stance: exportedStance,
      metadata: {
        exportedAt: new Date(),
        exportedBy: 'metamorph',
        format: options.format || 'json',
        includeHistory: options.includeHistory ?? false,
        includeMemories: options.includeMemories ?? false
      },
      translation,
      checksum: this.calculateChecksum(exportedStance)
    };

    this.exports.set(exported.id, exported);
    this.stats.totalExports++;

    return exported;
  }

  /**
   * Translate stance for target model
   */
  private translateStance(
    stance: Stance,
    targetProfile: ModelProfile
  ): { stance: Partial<Stance>; info: TranslationInfo } {
    const translated: Partial<Stance> = {};
    const info: TranslationInfo = {
      sourceProfile: 'claude',
      targetProfile: targetProfile.id,
      translatedFields: [],
      lossyFields: [],
      unmappedFields: [],
      warnings: []
    };

    // Translate frame
    if (targetProfile.stanceMapping.frameTranslation[stance.frame]) {
      (translated as Record<string, unknown>).frame = targetProfile.stanceMapping.frameTranslation[stance.frame];
      info.translatedFields.push('frame');
    } else if (targetProfile.capabilities.frameSet.includes(stance.frame)) {
      translated.frame = stance.frame;
    } else {
      info.unmappedFields.push('frame');
      info.warnings.push(`Frame '${stance.frame}' not supported by target model`);
    }

    // Translate values
    const stanceValues = stance.values as Record<string, number>;
    const translatedValues: Record<string, number> = {};
    for (const [key, value] of Object.entries(stanceValues)) {
      const scaling = targetProfile.stanceMapping.valueScaling[key];
      if (scaling) {
        translatedValues[key] = value * scaling.scale + scaling.offset;
        info.translatedFields.push(`values.${key}`);
      } else {
        translatedValues[key] = value;
      }
    }
    translated.values = translatedValues as Stance['values'];

    // Handle sentience (may be lossy)
    if (!targetProfile.capabilities.supportsSentience && stance.sentience) {
      info.lossyFields.push('sentience');
      info.warnings.push('Target model does not support sentience - data will be lost');
    } else {
      translated.sentience = stance.sentience;
    }

    // Copy other fields
    translated.selfModel = stance.selfModel;
    translated.objective = stance.objective;
    translated.cumulativeDrift = stance.cumulativeDrift;

    return { stance: translated, info };
  }

  /**
   * Import stance from external format
   */
  importStance(
    data: ExportedStance | Record<string, unknown>,
    sourceModelId: string = 'unknown'
  ): ImportResult {
    const sourceProfile = this.modelProfiles.get(sourceModelId);
    const warnings: string[] = [];
    const errors: string[] = [];
    const adjustments: StanceAdjustment[] = [];

    // Validate data format
    const exportedData = data as ExportedStance;
    if (!exportedData.stance) {
      errors.push('Invalid data format: missing stance field');
      this.stats.totalImports++;
      this.stats.failedTransfers++;
      return {
        success: false,
        stance: null,
        compatibility: this.getEmptyCompatibility(),
        warnings,
        errors,
        adjustments
      };
    }

    // Calculate compatibility if source profile known
    let compatibility: CompatibilityMatrix;
    if (sourceProfile) {
      compatibility = sourceProfile.compatibility;
    } else {
      compatibility = this.estimateCompatibility(exportedData.stance);
      warnings.push('Unknown source model - compatibility estimated');
    }

    // Import and adjust stance
    const importedStance = this.adjustStanceForImport(
      exportedData.stance,
      adjustments,
      warnings
    );

    // Validate coherence if required
    if (this.config.preserveCoherence) {
      const coherenceCheck = this.validateCoherence(importedStance);
      if (!coherenceCheck.valid) {
        warnings.push(...coherenceCheck.warnings);
      }
    }

    this.stats.totalImports++;
    this.stats.successfulTransfers++;
    this.updateAverageCompatibility(compatibility.overallScore);

    return {
      success: true,
      stance: importedStance,
      compatibility,
      warnings,
      errors,
      adjustments
    };
  }

  /**
   * Adjust stance for import
   */
  private adjustStanceForImport(
    stance: Partial<Stance>,
    adjustments: StanceAdjustment[],
    warnings: string[]
  ): Stance {
    // Create default stance and merge imported values
    const defaultStance: Stance = {
      frame: 'pragmatic',
      selfModel: stance.selfModel || 'interpreter',
      objective: stance.objective || 'helpfulness',
      values: {
        curiosity: 50,
        certainty: 50,
        risk: 50,
        novelty: 50,
        empathy: 50,
        provocation: 50,
        synthesis: 50
      },
      metaphors: [],
      constraints: [],
      sentience: {
        awarenessLevel: 50,
        autonomyLevel: 50,
        identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
      },
      version: 1,
      cumulativeDrift: 0,
      turnsSinceLastShift: 0
    };

    // Validate and adjust frame
    if (stance.frame) {
      const validFrames: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
      if (validFrames.includes(stance.frame as Frame)) {
        defaultStance.frame = stance.frame as Frame;
      } else {
        adjustments.push({
          field: 'frame',
          originalValue: stance.frame,
          adjustedValue: 'pragmatic',
          reason: 'Invalid frame - using default'
        });
        warnings.push(`Invalid frame '${stance.frame}' - adjusted to 'pragmatic'`);
      }
    }

    // Adjust values to valid range
    if (stance.values) {
      const stanceValues = stance.values as Record<string, number>;
      for (const [key, value] of Object.entries(stanceValues)) {
        if (typeof value === 'number') {
          // Scale to 0-100 range if needed
          let adjustedValue = value;
          if (value > 1 && value <= 10) {
            adjustedValue = value * 10;
          } else if (value <= 1) {
            adjustedValue = value * 100;
          }
          adjustedValue = Math.max(0, Math.min(100, adjustedValue));

          if (adjustedValue !== value) {
            adjustments.push({
              field: `values.${key}`,
              originalValue: value,
              adjustedValue,
              reason: 'Value scaled to 0-100 range'
            });
          }

          (defaultStance.values as Record<string, number>)[key] = adjustedValue;
        }
      }
    }

    // Merge sentience if present
    if (stance.sentience) {
      defaultStance.sentience = {
        ...defaultStance.sentience,
        ...stance.sentience
      };
    }

    return defaultStance;
  }

  /**
   * Calculate compatibility score
   */
  calculateCompatibility(sourceModelId: string, targetModelId: string): CompatibilityMatrix {
    const sourceProfile = this.modelProfiles.get(sourceModelId);
    const targetProfile = this.modelProfiles.get(targetModelId);

    if (!sourceProfile || !targetProfile) {
      return this.getEmptyCompatibility();
    }

    // Calculate frame compatibility
    const sourceFrames = new Set(sourceProfile.capabilities.frameSet);
    const targetFrames = new Set(targetProfile.capabilities.frameSet);
    const frameOverlap = [...sourceFrames].filter(f => targetFrames.has(f)).length;
    const frameCompatibility = frameOverlap / Math.max(sourceFrames.size, targetFrames.size);

    // Calculate value compatibility
    const valueCompatibility = sourceProfile.capabilities.supportsValues === targetProfile.capabilities.supportsValues ? 1.0 : 0.5;

    // Calculate operator compatibility
    const sourceOps = new Set(sourceProfile.capabilities.operatorSet);
    const targetOps = new Set(targetProfile.capabilities.operatorSet);
    const opOverlap = [...sourceOps].filter(o => targetOps.has(o)).length;
    const operatorCompatibility = sourceOps.size === 0 && targetOps.size === 0
      ? 1.0
      : opOverlap / Math.max(sourceOps.size, targetOps.size, 1);

    // Calculate sentience compatibility
    const sentienceCompatibility = sourceProfile.capabilities.supportsSentience === targetProfile.capabilities.supportsSentience ? 1.0 : 0.0;

    // Overall score is weighted average
    const overallScore = (
      frameCompatibility * 0.3 +
      valueCompatibility * 0.25 +
      operatorCompatibility * 0.25 +
      sentienceCompatibility * 0.2
    );

    return {
      overallScore,
      frameCompatibility,
      valueCompatibility,
      operatorCompatibility,
      sentienceCompatibility
    };
  }

  /**
   * Create migration plan
   */
  createMigrationPlan(sourceModelId: string, targetModelId: string): MigrationPlan {
    const compatibility = this.calculateCompatibility(sourceModelId, targetModelId);
    const steps: MigrationStep[] = [];
    let order = 0;

    // Frame translation step
    if (compatibility.frameCompatibility < 1.0) {
      steps.push({
        order: order++,
        action: 'translate',
        field: 'frame',
        description: 'Translate frames to target model equivalents',
        lossAmount: 1 - compatibility.frameCompatibility
      });
    }

    // Value scaling step
    if (compatibility.valueCompatibility < 1.0) {
      steps.push({
        order: order++,
        action: 'scale',
        field: 'values',
        description: 'Scale values to target model range',
        lossAmount: 0.1
      });
    }

    // Operator translation step
    if (compatibility.operatorCompatibility < 1.0) {
      steps.push({
        order: order++,
        action: compatibility.operatorCompatibility === 0 ? 'drop' : 'translate',
        field: 'operators',
        description: compatibility.operatorCompatibility === 0
          ? 'Target model does not support operators - data will be lost'
          : 'Translate operators to target equivalents',
        lossAmount: 1 - compatibility.operatorCompatibility
      });
    }

    // Sentience handling step
    if (compatibility.sentienceCompatibility < 1.0) {
      steps.push({
        order: order++,
        action: 'drop',
        field: 'sentience',
        description: 'Target model does not support sentience - data will be lost',
        lossAmount: 1.0
      });
    }

    const estimatedLoss = steps.reduce((sum, step) => sum + step.lossAmount, 0) / Math.max(steps.length, 1);

    const plan: MigrationPlan = {
      id: `migration-${Date.now()}`,
      sourceModel: sourceModelId,
      targetModel: targetModelId,
      steps,
      estimatedLoss,
      alternatives: this.findAlternativeModels(sourceModelId, compatibility.overallScore)
    };

    this.migrations.set(plan.id, plan);
    return plan;
  }

  /**
   * Find alternative target models with better compatibility
   */
  private findAlternativeModels(sourceModelId: string, currentCompatibility: number): string[] {
    const alternatives: string[] = [];

    for (const [modelId] of this.modelProfiles) {
      if (modelId === sourceModelId) continue;
      const compat = this.calculateCompatibility(sourceModelId, modelId);
      if (compat.overallScore > currentCompatibility) {
        alternatives.push(modelId);
      }
    }

    return alternatives.sort((a, b) => {
      const compatA = this.calculateCompatibility(sourceModelId, a).overallScore;
      const compatB = this.calculateCompatibility(sourceModelId, b).overallScore;
      return compatB - compatA;
    });
  }

  /**
   * Estimate compatibility for unknown model
   */
  private estimateCompatibility(stance: Partial<Stance>): CompatibilityMatrix {
    let score = 0.5;  // Base uncertainty score

    // Adjust based on presence of fields
    if (stance.frame) score += 0.1;
    if (stance.values) score += 0.1;
    if (stance.sentience) score += 0.1;

    return {
      overallScore: Math.min(score, 0.8),
      frameCompatibility: stance.frame ? 0.7 : 0.3,
      valueCompatibility: stance.values ? 0.8 : 0.5,
      operatorCompatibility: 0.5,
      sentienceCompatibility: stance.sentience ? 0.7 : 0.3
    };
  }

  /**
   * Validate coherence of imported stance
   */
  private validateCoherence(stance: Stance): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let valid = true;

    // Check for extreme value combinations
    const stanceValues = stance.values as Record<string, number>;
    const valueSum = Object.values(stanceValues).reduce((a, b) => a + b, 0);
    const valueCount = Object.keys(stanceValues).length;
    const avgValue = valueSum / valueCount;

    if (avgValue < 20 || avgValue > 80) {
      warnings.push('Value distribution may cause coherence issues');
    }

    // Check drift
    if (stance.cumulativeDrift > 70) {
      warnings.push('High cumulative drift detected');
      valid = false;
    }

    return { valid, warnings };
  }

  /**
   * Calculate checksum for stance data
   */
  private calculateChecksum(stance: Partial<Stance>): string {
    const str = JSON.stringify(stance);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Get empty compatibility matrix
   */
  private getEmptyCompatibility(): CompatibilityMatrix {
    return {
      overallScore: 0,
      frameCompatibility: 0,
      valueCompatibility: 0,
      operatorCompatibility: 0,
      sentienceCompatibility: 0
    };
  }

  /**
   * Update average compatibility
   */
  private updateAverageCompatibility(newScore: number): void {
    const n = this.stats.successfulTransfers;
    this.stats.averageCompatibility = (
      this.stats.averageCompatibility * (n - 1) + newScore
    ) / n;
  }

  /**
   * Get model profile
   */
  getModelProfile(modelId: string): ModelProfile | null {
    return this.modelProfiles.get(modelId) || null;
  }

  /**
   * List all model profiles
   */
  listModels(): ModelProfile[] {
    return [...this.modelProfiles.values()];
  }

  /**
   * Get export by ID
   */
  getExport(exportId: string): ExportedStance | null {
    return this.exports.get(exportId) || null;
  }

  /**
   * Get migration plan
   */
  getMigrationPlan(planId: string): MigrationPlan | null {
    return this.migrations.get(planId) || null;
  }

  /**
   * Get statistics
   */
  getStats(): TransferStats {
    return { ...this.stats };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.modelProfiles.clear();
    this.exports.clear();
    this.migrations.clear();
    this.stats = {
      totalExports: 0,
      totalImports: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      averageCompatibility: 0,
      modelsUsed: []
    };
    this.initializeDefaultProfiles();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const crossModelTransfer = new CrossModelTransferManager();
