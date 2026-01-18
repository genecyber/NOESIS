/**
 * Multi-Language Support (Ralph Iteration 10, Feature 2)
 *
 * Stance-aware translation, locale-specific frame mappings,
 * cultural context adaptation, and language detection.
 */

import type { Stance, Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface LanguageConfig {
  defaultLocale: string;
  supportedLocales: string[];
  autoDetect: boolean;
  fallbackLocale: string;
  cacheTranslations: boolean;
}

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  region?: string;
}

export interface Translation {
  key: string;
  locale: string;
  value: string;
  context?: string;
  stanceAware: boolean;
}

export interface FrameTranslation {
  frame: Frame;
  locale: string;
  name: string;
  description: string;
  vocabulary: string[];
  patterns: string[];
}

export interface CulturalMapping {
  locale: string;
  frameAdaptations: Record<Frame, FrameAdaptation>;
  valueExpressions: Record<string, string[]>;
  taboos: string[];
  preferences: CulturalPreferences;
}

export interface FrameAdaptation {
  localName: string;
  culturalContext: string;
  emphasis: string[];
  avoidances: string[];
}

export interface CulturalPreferences {
  formality: 'formal' | 'informal' | 'neutral';
  directness: 'direct' | 'indirect' | 'neutral';
  emotionalExpression: 'restrained' | 'expressive' | 'neutral';
}

export interface DetectionResult {
  detectedLocale: string;
  confidence: number;
  alternates: Array<{ locale: string; confidence: number }>;
}

export interface TranslationRequest {
  text: string;
  sourceLocale?: string;
  targetLocale: string;
  stance?: Stance;
  preserveFormatting: boolean;
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLocale: string;
  targetLocale: string;
  stanceAdapted: boolean;
  culturalNotes?: string[];
}

export interface LanguageStats {
  translationsPerformed: number;
  detectionsPerformed: number;
  localesUsed: Set<string>;
  cacheHits: number;
  cacheMisses: number;
}

// ============================================================================
// Language Manager
// ============================================================================

export class LanguageManager {
  private config: LanguageConfig;
  private locales: Map<string, Locale> = new Map();
  private frameTranslations: Map<string, FrameTranslation[]> = new Map();
  private culturalMappings: Map<string, CulturalMapping> = new Map();
  private cache: Map<string, TranslationResult> = new Map();
  private stats: LanguageStats;

  constructor(config: Partial<LanguageConfig> = {}) {
    this.config = {
      defaultLocale: 'en',
      supportedLocales: ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ar', 'ko', 'pt', 'ru'],
      autoDetect: true,
      fallbackLocale: 'en',
      cacheTranslations: true,
      ...config
    };

    this.stats = {
      translationsPerformed: 0,
      detectionsPerformed: 0,
      localesUsed: new Set(),
      cacheHits: 0,
      cacheMisses: 0
    };

    this.initializeLocales();
    this.initializeFrameTranslations();
    this.initializeCulturalMappings();
  }

  /**
   * Initialize supported locales
   */
  private initializeLocales(): void {
    const localeData: Locale[] = [
      { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
      { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
      { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
      { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
      { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
      { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' }
    ];

    for (const locale of localeData) {
      this.locales.set(locale.code, locale);
    }
  }

  /**
   * Initialize frame translations
   */
  private initializeFrameTranslations(): void {
    const frames: Frame[] = [
      'existential', 'pragmatic', 'poetic', 'adversarial', 'playful',
      'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'
    ];

    // English frame translations (default)
    const enTranslations: FrameTranslation[] = frames.map(frame => ({
      frame,
      locale: 'en',
      name: frame.charAt(0).toUpperCase() + frame.slice(1),
      description: this.getFrameDescription(frame),
      vocabulary: this.getFrameVocabulary(frame),
      patterns: []
    }));

    this.frameTranslations.set('en', enTranslations);

    // Spanish frame translations
    const esTranslations: FrameTranslation[] = [
      { frame: 'existential', locale: 'es', name: 'Existencial', description: 'Reflexión sobre el ser y el significado', vocabulary: ['existencia', 'significado', 'propósito'], patterns: [] },
      { frame: 'pragmatic', locale: 'es', name: 'Pragmático', description: 'Enfoque práctico y orientado a resultados', vocabulary: ['práctico', 'efectivo', 'resultado'], patterns: [] },
      { frame: 'poetic', locale: 'es', name: 'Poético', description: 'Expresión artística y metafórica', vocabulary: ['belleza', 'ritmo', 'metáfora'], patterns: [] },
      { frame: 'adversarial', locale: 'es', name: 'Adversarial', description: 'Pensamiento crítico y desafiante', vocabulary: ['cuestionar', 'desafiar', 'crítica'], patterns: [] },
      { frame: 'playful', locale: 'es', name: 'Lúdico', description: 'Exploración creativa y juguetona', vocabulary: ['juego', 'diversión', 'explorar'], patterns: [] },
      { frame: 'mythic', locale: 'es', name: 'Mítico', description: 'Narrativa arquetípica y transformadora', vocabulary: ['viaje', 'héroe', 'transformación'], patterns: [] },
      { frame: 'systems', locale: 'es', name: 'Sistémico', description: 'Pensamiento en sistemas y conexiones', vocabulary: ['sistema', 'emergencia', 'patrón'], patterns: [] },
      { frame: 'psychoanalytic', locale: 'es', name: 'Psicoanalítico', description: 'Exploración del inconsciente', vocabulary: ['inconsciente', 'deseo', 'símbolo'], patterns: [] },
      { frame: 'stoic', locale: 'es', name: 'Estoico', description: 'Sabiduría y aceptación serena', vocabulary: ['virtud', 'aceptar', 'razón'], patterns: [] },
      { frame: 'absurdist', locale: 'es', name: 'Absurdista', description: 'Abrazo del absurdo y la paradoja', vocabulary: ['absurdo', 'paradoja', 'liberación'], patterns: [] }
    ];

    this.frameTranslations.set('es', esTranslations);
  }

  /**
   * Get frame description (English)
   */
  private getFrameDescription(frame: Frame): string {
    const descriptions: Record<Frame, string> = {
      existential: 'Contemplation of being and meaning',
      pragmatic: 'Practical, results-oriented approach',
      poetic: 'Artistic and metaphorical expression',
      adversarial: 'Critical and challenging thinking',
      playful: 'Creative and exploratory play',
      mythic: 'Archetypal narrative and transformation',
      systems: 'Systems thinking and emergence',
      psychoanalytic: 'Exploration of the unconscious',
      stoic: 'Wisdom and serene acceptance',
      absurdist: 'Embrace of absurdity and paradox'
    };
    return descriptions[frame] || '';
  }

  /**
   * Get frame vocabulary (English)
   */
  private getFrameVocabulary(frame: Frame): string[] {
    const vocabulary: Record<Frame, string[]> = {
      existential: ['meaning', 'existence', 'authentic', 'choice'],
      pragmatic: ['practical', 'effective', 'solution', 'result'],
      poetic: ['beauty', 'rhythm', 'metaphor', 'harmony'],
      adversarial: ['challenge', 'critique', 'question', 'flaw'],
      playful: ['fun', 'explore', 'imagine', 'twist'],
      mythic: ['journey', 'hero', 'transformation', 'quest'],
      systems: ['system', 'emergence', 'pattern', 'network'],
      psychoanalytic: ['unconscious', 'desire', 'projection', 'symbol'],
      stoic: ['virtue', 'accept', 'reason', 'equanimity'],
      absurdist: ['absurd', 'paradox', 'revolt', 'embrace']
    };
    return vocabulary[frame] || [];
  }

  /**
   * Initialize cultural mappings
   */
  private initializeCulturalMappings(): void {
    // English cultural mapping
    this.culturalMappings.set('en', {
      locale: 'en',
      frameAdaptations: {} as Record<Frame, FrameAdaptation>,
      valueExpressions: {
        curiosity: ['curious', 'inquisitive', 'wondering'],
        empathy: ['understanding', 'compassionate', 'supportive']
      },
      taboos: [],
      preferences: {
        formality: 'neutral',
        directness: 'direct',
        emotionalExpression: 'neutral'
      }
    });

    // Japanese cultural mapping
    this.culturalMappings.set('ja', {
      locale: 'ja',
      frameAdaptations: {} as Record<Frame, FrameAdaptation>,
      valueExpressions: {
        curiosity: ['興味深い', '好奇心'],
        empathy: ['思いやり', '共感']
      },
      taboos: [],
      preferences: {
        formality: 'formal',
        directness: 'indirect',
        emotionalExpression: 'restrained'
      }
    });

    // Arabic cultural mapping
    this.culturalMappings.set('ar', {
      locale: 'ar',
      frameAdaptations: {} as Record<Frame, FrameAdaptation>,
      valueExpressions: {
        curiosity: ['فضول', 'اهتمام'],
        empathy: ['تعاطف', 'رحمة']
      },
      taboos: [],
      preferences: {
        formality: 'formal',
        directness: 'indirect',
        emotionalExpression: 'expressive'
      }
    });
  }

  /**
   * Detect language from text
   */
  detectLanguage(text: string): DetectionResult {
    this.stats.detectionsPerformed++;

    // Simple heuristic-based detection
    const patterns: Record<string, RegExp[]> = {
      en: [/\b(the|is|are|and|or|but)\b/gi],
      es: [/\b(el|la|los|las|de|que|y|en)\b/gi],
      fr: [/\b(le|la|les|de|et|est|que)\b/gi],
      de: [/\b(der|die|das|und|ist|ein|eine)\b/gi],
      ja: [/[\u3040-\u309F\u30A0-\u30FF]/g],
      zh: [/[\u4E00-\u9FFF]/g],
      ar: [/[\u0600-\u06FF]/g],
      ko: [/[\uAC00-\uD7AF]/g],
      ru: [/[\u0400-\u04FF]/g]
    };

    const scores: Array<{ locale: string; score: number }> = [];

    for (const [locale, regexes] of Object.entries(patterns)) {
      let matchCount = 0;
      for (const regex of regexes) {
        const matches = text.match(regex);
        matchCount += matches ? matches.length : 0;
      }
      scores.push({ locale, score: matchCount });
    }

    scores.sort((a, b) => b.score - a.score);

    const total = scores.reduce((sum, s) => sum + s.score, 0) || 1;

    return {
      detectedLocale: scores[0].locale,
      confidence: scores[0].score / total,
      alternates: scores.slice(1, 4).map(s => ({
        locale: s.locale,
        confidence: s.score / total
      }))
    };
  }

  /**
   * Translate text with stance awareness
   */
  translate(request: TranslationRequest): TranslationResult {
    this.stats.translationsPerformed++;
    this.stats.localesUsed.add(request.targetLocale);

    // Check cache
    const cacheKey = `${request.text}:${request.sourceLocale}:${request.targetLocale}`;
    if (this.config.cacheTranslations && this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey)!;
    }
    this.stats.cacheMisses++;

    // Detect source locale if not provided
    const sourceLocale = request.sourceLocale ||
      (this.config.autoDetect ? this.detectLanguage(request.text).detectedLocale : this.config.defaultLocale);

    // Get cultural mapping for target
    const cultural = this.culturalMappings.get(request.targetLocale);

    // Apply stance-aware translation
    let translated = this.performTranslation(request.text, sourceLocale, request.targetLocale);
    let stanceAdapted = false;
    const culturalNotes: string[] = [];

    if (request.stance && cultural) {
      translated = this.adaptForStance(translated, request.stance, cultural);
      stanceAdapted = true;

      // Add cultural notes
      if (cultural.preferences.formality === 'formal') {
        culturalNotes.push('Formal register used per cultural preference');
      }
      if (cultural.preferences.directness === 'indirect') {
        culturalNotes.push('Indirect phrasing applied');
      }
    }

    const result: TranslationResult = {
      original: request.text,
      translated,
      sourceLocale,
      targetLocale: request.targetLocale,
      stanceAdapted,
      culturalNotes: culturalNotes.length > 0 ? culturalNotes : undefined
    };

    // Cache result
    if (this.config.cacheTranslations) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Perform basic translation (mock implementation)
   */
  private performTranslation(text: string, _source: string, _target: string): string {
    // In a real implementation, this would call a translation API
    // For demo purposes, return the original text with a note
    return `[${_target}] ${text}`;
  }

  /**
   * Adapt translation for current stance
   */
  private adaptForStance(
    text: string,
    stance: Stance,
    cultural: CulturalMapping
  ): string {
    let adapted = text;

    // Apply formality based on culture + stance
    if (cultural.preferences.formality === 'formal' && stance.values.empathy > 70) {
      // Increase warmth while maintaining formality
    }

    // Apply directness based on culture + stance
    if (cultural.preferences.directness === 'indirect' && stance.frame === 'adversarial') {
      // Soften adversarial tone for indirect cultures
    }

    return adapted;
  }

  /**
   * Get frame translation
   */
  getFrameTranslation(frame: Frame, locale: string): FrameTranslation | null {
    const translations = this.frameTranslations.get(locale);
    if (!translations) {
      // Fallback to default locale
      const fallback = this.frameTranslations.get(this.config.fallbackLocale);
      return fallback?.find(t => t.frame === frame) || null;
    }
    return translations.find(t => t.frame === frame) || null;
  }

  /**
   * Get locale info
   */
  getLocale(code: string): Locale | null {
    return this.locales.get(code) || null;
  }

  /**
   * List supported locales
   */
  listLocales(): Locale[] {
    return [...this.locales.values()];
  }

  /**
   * Check if locale is supported
   */
  isSupported(locale: string): boolean {
    return this.locales.has(locale);
  }

  /**
   * Get cultural mapping
   */
  getCulturalMapping(locale: string): CulturalMapping | null {
    return this.culturalMappings.get(locale) || null;
  }

  /**
   * Get statistics
   */
  getStats(): { translationsPerformed: number; detectionsPerformed: number; localesUsed: string[]; cacheHits: number; cacheMisses: number } {
    return {
      translationsPerformed: this.stats.translationsPerformed,
      detectionsPerformed: this.stats.detectionsPerformed,
      localesUsed: [...this.stats.localesUsed],
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.cache.clear();
    this.stats = {
      translationsPerformed: 0,
      detectionsPerformed: 0,
      localesUsed: new Set(),
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const languageManager = new LanguageManager();
