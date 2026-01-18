/**
 * Multi-Language Support (Ralph Iteration 10, Feature 2)
 *
 * Stance-aware translation, locale-specific frame mappings,
 * cultural context adaptation, and language detection.
 */
import type { Stance, Frame } from '../types/index.js';
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
    alternates: Array<{
        locale: string;
        confidence: number;
    }>;
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
export declare class LanguageManager {
    private config;
    private locales;
    private frameTranslations;
    private culturalMappings;
    private cache;
    private stats;
    constructor(config?: Partial<LanguageConfig>);
    /**
     * Initialize supported locales
     */
    private initializeLocales;
    /**
     * Initialize frame translations
     */
    private initializeFrameTranslations;
    /**
     * Get frame description (English)
     */
    private getFrameDescription;
    /**
     * Get frame vocabulary (English)
     */
    private getFrameVocabulary;
    /**
     * Initialize cultural mappings
     */
    private initializeCulturalMappings;
    /**
     * Detect language from text
     */
    detectLanguage(text: string): DetectionResult;
    /**
     * Translate text with stance awareness
     */
    translate(request: TranslationRequest): TranslationResult;
    /**
     * Perform basic translation (mock implementation)
     */
    private performTranslation;
    /**
     * Adapt translation for current stance
     */
    private adaptForStance;
    /**
     * Get frame translation
     */
    getFrameTranslation(frame: Frame, locale: string): FrameTranslation | null;
    /**
     * Get locale info
     */
    getLocale(code: string): Locale | null;
    /**
     * List supported locales
     */
    listLocales(): Locale[];
    /**
     * Check if locale is supported
     */
    isSupported(locale: string): boolean;
    /**
     * Get cultural mapping
     */
    getCulturalMapping(locale: string): CulturalMapping | null;
    /**
     * Get statistics
     */
    getStats(): {
        translationsPerformed: number;
        detectionsPerformed: number;
        localesUsed: string[];
        cacheHits: number;
        cacheMisses: number;
    };
    /**
     * Clear translation cache
     */
    clearCache(): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const languageManager: LanguageManager;
//# sourceMappingURL=language.d.ts.map