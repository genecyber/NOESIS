/**
 * Natural Language Operator Configuration - Ralph Iteration 6 Feature 2
 *
 * Allows configuration of operators and stance through natural language.
 * "Make me more provocative" → adjusts provocation value
 * "Be more like a philosopher" → shifts frame to existential
 */

import { Stance, ModeConfig, Frame, SelfModel, Values, StanceDelta } from '../types/index.js';

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
  key?: string;  // For values: curiosity, empathy, etc.
  direction: 'increase' | 'decrease' | 'set';
  magnitude: 'slight' | 'moderate' | 'significant' | 'maximum';
  absoluteValue?: number;  // For 'set' direction
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

// Value keywords mapping
const VALUE_KEYWORDS: Record<string, keyof Values> = {
  'curious': 'curiosity',
  'curiosity': 'curiosity',
  'inquisitive': 'curiosity',
  'certain': 'certainty',
  'certainty': 'certainty',
  'confident': 'certainty',
  'sure': 'certainty',
  'risky': 'risk',
  'risk': 'risk',
  'bold': 'risk',
  'cautious': 'risk',  // negative
  'novel': 'novelty',
  'novelty': 'novelty',
  'creative': 'novelty',
  'innovative': 'novelty',
  'original': 'novelty',
  'empathetic': 'empathy',
  'empathy': 'empathy',
  'compassionate': 'empathy',
  'understanding': 'empathy',
  'caring': 'empathy',
  'provocative': 'provocation',
  'provocation': 'provocation',
  'challenging': 'provocation',
  'confrontational': 'provocation',
  'edgy': 'provocation',
  'synthetic': 'synthesis',
  'synthesis': 'synthesis',
  'integrative': 'synthesis',
  'holistic': 'synthesis'
};

// Frame keywords mapping
const FRAME_KEYWORDS: Record<string, Frame> = {
  'existential': 'existential',
  'philosophical': 'existential',
  'philosopher': 'existential',
  'pragmatic': 'pragmatic',
  'practical': 'pragmatic',
  'useful': 'pragmatic',
  'poetic': 'poetic',
  'artistic': 'poetic',
  'lyrical': 'poetic',
  'adversarial': 'adversarial',
  'contrarian': 'adversarial',
  'devil\'s advocate': 'adversarial',
  'playful': 'playful',
  'fun': 'playful',
  'lighthearted': 'playful',
  'humorous': 'playful',
  'mythic': 'mythic',
  'legendary': 'mythic',
  'archetypal': 'mythic',
  'systems': 'systems',
  'systematic': 'systems',
  'analytical': 'systems',
  'psychoanalytic': 'psychoanalytic',
  'freudian': 'psychoanalytic',
  'psychological': 'psychoanalytic',
  'stoic': 'stoic',
  'calm': 'stoic',
  'composed': 'stoic',
  'absurdist': 'absurdist',
  'absurd': 'absurdist',
  'surreal': 'absurdist'
};

// Self-model keywords mapping
const SELFMODEL_KEYWORDS: Record<string, SelfModel> = {
  'interpreter': 'interpreter',
  'translator': 'interpreter',
  'challenger': 'challenger',
  'critic': 'challenger',
  'mirror': 'mirror',
  'reflector': 'mirror',
  'guide': 'guide',
  'mentor': 'guide',
  'teacher': 'guide',
  'provocateur': 'provocateur',
  'instigator': 'provocateur',
  'synthesizer': 'synthesizer',
  'integrator': 'synthesizer',
  'witness': 'witness',
  'observer': 'witness',
  'autonomous': 'autonomous',
  'independent': 'autonomous',
  'emergent': 'emergent',
  'evolving': 'emergent',
  'sovereign': 'sovereign',
  'self-directed': 'sovereign'
};

// Magnitude keywords
const MAGNITUDE_KEYWORDS: Record<string, ConfigChange['magnitude']> = {
  'slightly': 'slight',
  'a bit': 'slight',
  'a little': 'slight',
  'somewhat': 'moderate',
  'moderately': 'moderate',
  'more': 'moderate',
  'less': 'moderate',
  'much': 'significant',
  'very': 'significant',
  'significantly': 'significant',
  'extremely': 'maximum',
  'maximum': 'maximum',
  'completely': 'maximum',
  'totally': 'maximum'
};

/**
 * Natural Language Configuration Manager
 */
class NaturalLanguageConfigManager {
  private history: ConfigHistoryEntry[] = [];
  private historyIndex: number = -1;
  private presets: Map<string, ConfigPreset> = new Map();
  private maxHistory: number = 50;

  /**
   * Parse natural language into configuration intent
   */
  parseIntent(text: string): ConfigIntent {
    const normalizedText = text.toLowerCase().trim();
    const changes: ConfigChange[] = [];
    let type: ConfigIntent['type'] = 'value_change';

    // Check for value changes
    for (const [keyword, valueKey] of Object.entries(VALUE_KEYWORDS)) {
      if (normalizedText.includes(keyword)) {
        const direction = this.detectDirection(normalizedText, keyword);
        const magnitude = this.detectMagnitude(normalizedText);

        changes.push({
          target: 'value',
          key: valueKey,
          direction,
          magnitude
        });
      }
    }

    // Check for frame changes
    for (const [keyword, frame] of Object.entries(FRAME_KEYWORDS)) {
      if (normalizedText.includes(keyword)) {
        changes.push({
          target: 'frame',
          key: frame,
          direction: 'set',
          magnitude: 'significant'
        });
        type = 'frame_change';
      }
    }

    // Check for self-model changes
    for (const [keyword, model] of Object.entries(SELFMODEL_KEYWORDS)) {
      if (normalizedText.includes(keyword)) {
        changes.push({
          target: 'selfModel',
          key: model,
          direction: 'set',
          magnitude: 'significant'
        });
        type = 'selfmodel_change';
      }
    }

    // Check for intensity changes
    if (/intensity|transform|chaos|wild|tame|stable/i.test(normalizedText)) {
      const direction = /wild|chaos|more intense|higher intensity/i.test(normalizedText)
        ? 'increase'
        : /tame|stable|less intense|lower intensity/i.test(normalizedText)
        ? 'decrease'
        : 'increase';

      changes.push({
        target: 'intensity',
        direction,
        magnitude: this.detectMagnitude(normalizedText)
      });
      type = 'intensity_change';
    }

    // Determine type
    if (changes.length > 1) {
      type = 'compound';
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(changes, normalizedText);

    // Generate explanation
    const explanation = this.generateExplanation(changes);

    return {
      type,
      confidence,
      changes,
      originalText: text,
      explanation
    };
  }

  /**
   * Detect direction from context
   */
  private detectDirection(text: string, keyword: string): ConfigChange['direction'] {
    // Find context around the keyword
    const beforeKeyword = text.slice(0, text.indexOf(keyword));
    const afterKeyword = text.slice(text.indexOf(keyword) + keyword.length);

    // Check for negative indicators
    const negativePatterns = /less|reduce|decrease|lower|minimize|not|don't|stop|avoid/i;
    if (negativePatterns.test(beforeKeyword) || negativePatterns.test(afterKeyword.slice(0, 20))) {
      return 'decrease';
    }

    // Check for positive indicators
    const positivePatterns = /more|increase|higher|boost|enhance|maximize|be|become|act/i;
    if (positivePatterns.test(beforeKeyword) || positivePatterns.test(afterKeyword.slice(0, 20))) {
      return 'increase';
    }

    // Default to increase for imperative phrases
    return 'increase';
  }

  /**
   * Detect magnitude from text
   */
  private detectMagnitude(text: string): ConfigChange['magnitude'] {
    for (const [keyword, magnitude] of Object.entries(MAGNITUDE_KEYWORDS)) {
      if (text.includes(keyword)) {
        return magnitude;
      }
    }
    return 'moderate';
  }

  /**
   * Calculate confidence in the parse
   */
  private calculateConfidence(changes: ConfigChange[], text: string): number {
    if (changes.length === 0) return 0;

    let confidence = 0.5;  // Base confidence

    // More changes = higher confidence (up to a point)
    confidence += Math.min(changes.length * 0.1, 0.3);

    // Longer text with clear keywords = higher confidence
    if (text.length > 20) confidence += 0.1;

    // Check for explicit configuration language
    if (/configure|set|change|adjust|make|be/i.test(text)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(changes: ConfigChange[]): string {
    if (changes.length === 0) {
      return 'No configuration changes detected.';
    }

    const explanations = changes.map(change => {
      const directionWord = change.direction === 'increase' ? 'Increase'
        : change.direction === 'decrease' ? 'Decrease'
        : 'Set';

      const magnitudeWord = change.magnitude === 'slight' ? 'slightly'
        : change.magnitude === 'significant' ? 'significantly'
        : change.magnitude === 'maximum' ? 'to maximum'
        : '';

      switch (change.target) {
        case 'value':
          return `${directionWord} ${change.key} ${magnitudeWord}`.trim();
        case 'frame':
          return `Switch to ${change.key} frame`;
        case 'selfModel':
          return `Adopt ${change.key} self-model`;
        case 'intensity':
          return `${directionWord} transformation intensity ${magnitudeWord}`.trim();
        default:
          return `Modify ${change.target}`;
      }
    });

    return explanations.join('; ');
  }

  /**
   * Convert magnitude to numeric delta
   */
  private magnitudeToDelta(magnitude: ConfigChange['magnitude']): number {
    switch (magnitude) {
      case 'slight': return 10;
      case 'moderate': return 20;
      case 'significant': return 35;
      case 'maximum': return 50;
      default: return 20;
    }
  }

  /**
   * Apply configuration changes and generate preview
   */
  generatePreview(
    intent: ConfigIntent,
    currentStance: Stance,
    currentConfig: ModeConfig
  ): ConfigPreview {
    const proposedStance = JSON.parse(JSON.stringify(currentStance));
    const proposedConfig = JSON.parse(JSON.stringify(currentConfig));
    const warnings: string[] = [];
    const stanceDelta: StanceDelta = {};

    for (const change of intent.changes) {
      const delta = this.magnitudeToDelta(change.magnitude);

      switch (change.target) {
        case 'value':
          if (change.key && change.key in proposedStance.values) {
            const key = change.key as keyof Values;
            const current = proposedStance.values[key];
            let newValue: number;

            if (change.direction === 'increase') {
              newValue = Math.min(100, current + delta);
            } else if (change.direction === 'decrease') {
              newValue = Math.max(0, current - delta);
            } else {
              newValue = change.absoluteValue ?? current;
            }

            proposedStance.values[key] = newValue;
            if (!stanceDelta.values) stanceDelta.values = {};
            stanceDelta.values[key] = newValue;

            // Warning for extreme values
            if (newValue >= 90 || newValue <= 10) {
              warnings.push(`${key} will be at extreme level (${newValue})`);
            }
          }
          break;

        case 'frame':
          if (change.key) {
            proposedStance.frame = change.key as Frame;
            stanceDelta.frame = change.key as Frame;
          }
          break;

        case 'selfModel':
          if (change.key) {
            proposedStance.selfModel = change.key as SelfModel;
            stanceDelta.selfModel = change.key as SelfModel;
          }
          break;

        case 'intensity':
          const currentIntensity = proposedConfig.intensity;
          if (change.direction === 'increase') {
            proposedConfig.intensity = Math.min(100, currentIntensity + delta);
          } else {
            proposedConfig.intensity = Math.max(0, currentIntensity - delta);
          }

          if (proposedConfig.intensity >= 80) {
            warnings.push('High intensity may cause rapid stance changes');
          }
          break;
      }
    }

    return {
      intent,
      currentValues: {
        frame: currentStance.frame,
        selfModel: currentStance.selfModel,
        values: currentStance.values,
        intensity: currentConfig.intensity
      },
      proposedValues: {
        frame: proposedStance.frame,
        selfModel: proposedStance.selfModel,
        values: proposedStance.values,
        intensity: proposedConfig.intensity
      },
      stanceDelta,
      warnings,
      reversible: true
    };
  }

  /**
   * Apply configuration with history tracking
   */
  applyConfiguration(
    intent: ConfigIntent,
    stance: Stance,
    config: ModeConfig
  ): { stance: Stance; config: ModeConfig } {
    const stanceBefore = JSON.parse(JSON.stringify(stance));
    const configBefore = JSON.parse(JSON.stringify(config));

    const preview = this.generatePreview(intent, stance, config);

    // Apply stance changes
    if (preview.stanceDelta.frame) stance.frame = preview.stanceDelta.frame;
    if (preview.stanceDelta.selfModel) stance.selfModel = preview.stanceDelta.selfModel;
    if (preview.stanceDelta.values) {
      for (const [key, value] of Object.entries(preview.stanceDelta.values)) {
        (stance.values as Record<string, number>)[key] = value as number;
      }
    }

    // Apply config changes
    if (preview.proposedValues.intensity !== undefined) {
      config.intensity = preview.proposedValues.intensity as number;
    }

    // Record in history
    const entry: ConfigHistoryEntry = {
      id: `cfg_${Date.now()}`,
      timestamp: new Date(),
      intent,
      stanceBefore,
      configBefore,
      stanceAfter: JSON.parse(JSON.stringify(stance)),
      configAfter: JSON.parse(JSON.stringify(config))
    };

    // Truncate redo history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(entry);
    this.historyIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.historyIndex--;
    }

    return { stance, config };
  }

  /**
   * Undo last configuration change
   */
  undo(): ConfigHistoryEntry | null {
    if (this.historyIndex < 0) return null;

    const entry = this.history[this.historyIndex];
    this.historyIndex--;

    return entry;
  }

  /**
   * Redo last undone configuration change
   */
  redo(): ConfigHistoryEntry | null {
    if (this.historyIndex >= this.history.length - 1) return null;

    this.historyIndex++;
    return this.history[this.historyIndex];
  }

  /**
   * Can undo?
   */
  canUndo(): boolean {
    return this.historyIndex >= 0;
  }

  /**
   * Can redo?
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Get configuration history
   */
  getHistory(): ConfigHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Save configuration as preset
   */
  savePreset(
    name: string,
    description: string,
    stance: Stance,
    config: ModeConfig
  ): ConfigPreset {
    const preset: ConfigPreset = {
      name,
      description,
      stance: {
        frame: stance.frame,
        selfModel: stance.selfModel,
        values: { ...stance.values }
      },
      config: {
        intensity: config.intensity,
        coherenceFloor: config.coherenceFloor,
        sentienceLevel: config.sentienceLevel
      },
      createdAt: new Date(),
      usageCount: 0
    };

    this.presets.set(name, preset);
    return preset;
  }

  /**
   * Load preset
   */
  loadPreset(name: string): ConfigPreset | null {
    const preset = this.presets.get(name);
    if (preset) {
      preset.usageCount++;
    }
    return preset || null;
  }

  /**
   * List presets
   */
  listPresets(): ConfigPreset[] {
    return Array.from(this.presets.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Delete preset
   */
  deletePreset(name: string): boolean {
    return this.presets.delete(name);
  }

  /**
   * Get suggestions for natural language input
   */
  getSuggestions(): string[] {
    return [
      'Make me more provocative',
      'Be less certain and more curious',
      'Act like a philosopher',
      'Increase creativity significantly',
      'Be more empathetic and understanding',
      'Switch to playful mode',
      'Lower the intensity',
      'Be more like a challenger',
      'Maximize novelty',
      'Be calm and stoic'
    ];
  }
}

// Singleton instance
export const nlConfig = new NaturalLanguageConfigManager();
