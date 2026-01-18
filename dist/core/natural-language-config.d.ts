/**
 * Natural Language Operator Configuration - Ralph Iteration 6 Feature 2
 *
 * Allows configuration of operators and stance through natural language.
 * "Make me more provocative" → adjusts provocation value
 * "Be more like a philosopher" → shifts frame to existential
 */
import { Stance, ModeConfig, StanceDelta } from '../types/index.js';
/**
 * Configuration intent parsed from natural language
 */
export interface ConfigIntent {
    type: 'value_change' | 'frame_change' | 'selfmodel_change' | 'intensity_change' | 'compound';
    confidence: number;
    changes: ConfigChange[];
    originalText: string;
    explanation: string;
}
/**
 * Single configuration change
 */
export interface ConfigChange {
    target: 'value' | 'frame' | 'selfModel' | 'intensity' | 'coherence' | 'sentience';
    key?: string;
    direction: 'increase' | 'decrease' | 'set';
    magnitude: 'slight' | 'moderate' | 'significant' | 'maximum';
    absoluteValue?: number;
}
/**
 * Configuration preview before applying
 */
export interface ConfigPreview {
    intent: ConfigIntent;
    currentValues: Partial<Stance & ModeConfig>;
    proposedValues: Partial<Stance & ModeConfig>;
    stanceDelta: StanceDelta;
    warnings: string[];
    reversible: boolean;
}
/**
 * Configuration history entry for undo/redo
 */
export interface ConfigHistoryEntry {
    id: string;
    timestamp: Date;
    intent: ConfigIntent;
    stanceBefore: Stance;
    configBefore: ModeConfig;
    stanceAfter: Stance;
    configAfter: ModeConfig;
}
/**
 * Saved configuration preset
 */
export interface ConfigPreset {
    name: string;
    description: string;
    stance: Partial<Stance>;
    config: Partial<ModeConfig>;
    createdAt: Date;
    usageCount: number;
}
/**
 * Natural Language Configuration Manager
 */
declare class NaturalLanguageConfigManager {
    private history;
    private historyIndex;
    private presets;
    private maxHistory;
    /**
     * Parse natural language into configuration intent
     */
    parseIntent(text: string): ConfigIntent;
    /**
     * Detect direction from context
     */
    private detectDirection;
    /**
     * Detect magnitude from text
     */
    private detectMagnitude;
    /**
     * Calculate confidence in the parse
     */
    private calculateConfidence;
    /**
     * Generate human-readable explanation
     */
    private generateExplanation;
    /**
     * Convert magnitude to numeric delta
     */
    private magnitudeToDelta;
    /**
     * Apply configuration changes and generate preview
     */
    generatePreview(intent: ConfigIntent, currentStance: Stance, currentConfig: ModeConfig): ConfigPreview;
    /**
     * Apply configuration with history tracking
     */
    applyConfiguration(intent: ConfigIntent, stance: Stance, config: ModeConfig): {
        stance: Stance;
        config: ModeConfig;
    };
    /**
     * Undo last configuration change
     */
    undo(): ConfigHistoryEntry | null;
    /**
     * Redo last undone configuration change
     */
    redo(): ConfigHistoryEntry | null;
    /**
     * Can undo?
     */
    canUndo(): boolean;
    /**
     * Can redo?
     */
    canRedo(): boolean;
    /**
     * Get configuration history
     */
    getHistory(): ConfigHistoryEntry[];
    /**
     * Save configuration as preset
     */
    savePreset(name: string, description: string, stance: Stance, config: ModeConfig): ConfigPreset;
    /**
     * Load preset
     */
    loadPreset(name: string): ConfigPreset | null;
    /**
     * List presets
     */
    listPresets(): ConfigPreset[];
    /**
     * Delete preset
     */
    deletePreset(name: string): boolean;
    /**
     * Get suggestions for natural language input
     */
    getSuggestions(): string[];
}
export declare const nlConfig: NaturalLanguageConfigManager;
export {};
//# sourceMappingURL=natural-language-config.d.ts.map