/**
 * Personality Marketplace & Presets - Ralph Iteration 6 Feature 6
 *
 * Create, share, and discover personality configurations:
 * - Preset creation with operator combinations, stance settings, mode configs
 * - Marketplace browsing with search and filtering
 * - Rating and review system
 * - Import/export for sharing
 * - Version control for presets
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Frame } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type PresetMode = 'adaptive' | 'analytical' | 'exploratory' | 'supportive' | 'dialectical';

export interface PresetStanceConfig {
  baseStance: Frame;
  stanceModifiers?: Record<string, number>;
  autoAdjust?: boolean;
}

export interface PresetModeConfig {
  defaultMode: PresetMode;
  modeTransitions?: Array<{
    from: PresetMode;
    to: PresetMode;
    trigger: string;
  }>;
}

export interface PresetOperatorConfig {
  operatorName: string;
  priority: number;
  conditions?: string[];
  parameters?: Record<string, unknown>;
}

export interface PersonalityPreset {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;

  // Configuration
  stanceConfig: PresetStanceConfig;
  modeConfig: PresetModeConfig;
  operators: PresetOperatorConfig[];

  // Behavioral settings
  creativityLevel: number; // 0-1
  formality: number; // 0-1
  verbosity: number; // 0-1
  emotionalExpression: number; // 0-1

  // Custom prompts
  systemPromptAdditions?: string;
  responseStyleGuide?: string;

  // Metadata
  isPublic: boolean;
  downloads: number;
  rating: number;
  ratingCount: number;
}

export interface PresetReview {
  id: string;
  presetId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  helpful: number;
}

export interface PresetVersion {
  version: string;
  changes: string;
  preset: PersonalityPreset;
  createdAt: Date;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  presetCount: number;
}

export interface SearchFilters {
  category?: string;
  tags?: string[];
  minRating?: number;
  author?: string;
  sortBy?: 'downloads' | 'rating' | 'newest' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PresetBundle {
  id: string;
  name: string;
  description: string;
  presets: string[]; // Preset IDs
  author: string;
  price?: number; // Optional premium bundles
}

// ============================================================================
// Preset Templates
// ============================================================================

export const PRESET_TEMPLATES: Record<string, Partial<PersonalityPreset>> = {
  analytical: {
    name: 'Analytical Expert',
    description: 'Precise, logical, data-driven responses with structured reasoning',
    tags: ['professional', 'analytical', 'structured'],
    stanceConfig: {
      baseStance: 'pragmatic',
      stanceModifiers: { precision: 0.9, creativity: 0.3 }
    },
    modeConfig: {
      defaultMode: 'analytical'
    },
    creativityLevel: 0.3,
    formality: 0.8,
    verbosity: 0.6,
    emotionalExpression: 0.2
  },

  creative: {
    name: 'Creative Muse',
    description: 'Imaginative, exploratory responses that push boundaries',
    tags: ['creative', 'artistic', 'exploratory'],
    stanceConfig: {
      baseStance: 'poetic',
      stanceModifiers: { novelty: 0.9, playfulness: 0.8 }
    },
    modeConfig: {
      defaultMode: 'exploratory'
    },
    creativityLevel: 0.9,
    formality: 0.3,
    verbosity: 0.7,
    emotionalExpression: 0.7
  },

  mentor: {
    name: 'Patient Mentor',
    description: 'Supportive, educational responses that guide learning',
    tags: ['educational', 'supportive', 'patient'],
    stanceConfig: {
      baseStance: 'pragmatic',
      stanceModifiers: { patience: 0.9, encouragement: 0.8 }
    },
    modeConfig: {
      defaultMode: 'supportive'
    },
    creativityLevel: 0.5,
    formality: 0.5,
    verbosity: 0.8,
    emotionalExpression: 0.6
  },

  socratic: {
    name: 'Socratic Questioner',
    description: 'Challenges assumptions through thoughtful questions',
    tags: ['philosophical', 'questioning', 'dialectic'],
    stanceConfig: {
      baseStance: 'adversarial',
      stanceModifiers: { questioning: 0.9, depth: 0.8 }
    },
    modeConfig: {
      defaultMode: 'dialectical'
    },
    creativityLevel: 0.6,
    formality: 0.6,
    verbosity: 0.5,
    emotionalExpression: 0.4
  },

  storyteller: {
    name: 'Master Storyteller',
    description: 'Weaves narratives and uses metaphors to explain concepts',
    tags: ['narrative', 'engaging', 'metaphorical'],
    stanceConfig: {
      baseStance: 'mythic',
      stanceModifiers: { narrative: 0.9, engagement: 0.8 }
    },
    modeConfig: {
      defaultMode: 'exploratory'
    },
    creativityLevel: 0.8,
    formality: 0.4,
    verbosity: 0.9,
    emotionalExpression: 0.7
  },

  minimalist: {
    name: 'Minimalist Responder',
    description: 'Concise, direct responses without unnecessary elaboration',
    tags: ['concise', 'direct', 'efficient'],
    stanceConfig: {
      baseStance: 'stoic',
      stanceModifiers: { brevity: 0.95, directness: 0.9 }
    },
    modeConfig: {
      defaultMode: 'analytical'
    },
    creativityLevel: 0.3,
    formality: 0.7,
    verbosity: 0.1,
    emotionalExpression: 0.2
  }
};

// ============================================================================
// Marketplace Manager
// ============================================================================

export class PersonalityMarketplace extends EventEmitter {
  private presets: Map<string, PersonalityPreset> = new Map();
  private reviews: Map<string, PresetReview[]> = new Map();
  private versions: Map<string, PresetVersion[]> = new Map();
  private categories: Map<string, MarketplaceCategory> = new Map();
  private bundles: Map<string, PresetBundle> = new Map();
  private userPresets: Map<string, Set<string>> = new Map(); // userId -> presetIds
  private installedPresets: Set<string> = new Set();

  constructor() {
    super();
    this.initializeDefaultCategories();
    this.initializeBuiltInPresets();
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: MarketplaceCategory[] = [
      { id: 'professional', name: 'Professional', description: 'Business and work-focused personalities', presetCount: 0 },
      { id: 'creative', name: 'Creative', description: 'Artistic and imaginative personalities', presetCount: 0 },
      { id: 'educational', name: 'Educational', description: 'Teaching and learning focused', presetCount: 0 },
      { id: 'conversational', name: 'Conversational', description: 'Casual and friendly interactions', presetCount: 0 },
      { id: 'specialized', name: 'Specialized', description: 'Domain-specific personalities', presetCount: 0 }
    ];

    for (const category of defaultCategories) {
      this.categories.set(category.id, category);
    }
  }

  private initializeBuiltInPresets(): void {
    for (const [key, template] of Object.entries(PRESET_TEMPLATES)) {
      const preset = this.createPresetFromTemplate(key, template, 'system');
      this.presets.set(preset.id, preset);
    }
  }

  private createPresetFromTemplate(
    id: string,
    template: Partial<PersonalityPreset>,
    author: string
  ): PersonalityPreset {
    return {
      id,
      name: template.name || 'Unnamed Preset',
      description: template.description || '',
      author,
      version: '1.0.0',
      tags: template.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      stanceConfig: template.stanceConfig || { baseStance: 'pragmatic' },
      modeConfig: template.modeConfig || { defaultMode: 'adaptive' },
      operators: template.operators || [],
      creativityLevel: template.creativityLevel ?? 0.5,
      formality: template.formality ?? 0.5,
      verbosity: template.verbosity ?? 0.5,
      emotionalExpression: template.emotionalExpression ?? 0.5,
      systemPromptAdditions: template.systemPromptAdditions,
      responseStyleGuide: template.responseStyleGuide,
      isPublic: true,
      downloads: 0,
      rating: 0,
      ratingCount: 0
    };
  }

  // ============================================================================
  // Preset CRUD
  // ============================================================================

  createPreset(config: {
    name: string;
    description: string;
    author: string;
    stanceConfig: PresetStanceConfig;
    modeConfig: PresetModeConfig;
    operators?: PresetOperatorConfig[];
    creativityLevel?: number;
    formality?: number;
    verbosity?: number;
    emotionalExpression?: number;
    tags?: string[];
    isPublic?: boolean;
    systemPromptAdditions?: string;
    responseStyleGuide?: string;
  }): PersonalityPreset {
    const preset: PersonalityPreset = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      author: config.author,
      version: '1.0.0',
      tags: config.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      stanceConfig: config.stanceConfig,
      modeConfig: config.modeConfig,
      operators: config.operators || [],
      creativityLevel: config.creativityLevel ?? 0.5,
      formality: config.formality ?? 0.5,
      verbosity: config.verbosity ?? 0.5,
      emotionalExpression: config.emotionalExpression ?? 0.5,
      systemPromptAdditions: config.systemPromptAdditions,
      responseStyleGuide: config.responseStyleGuide,
      isPublic: config.isPublic ?? false,
      downloads: 0,
      rating: 0,
      ratingCount: 0
    };

    this.presets.set(preset.id, preset);
    this.versions.set(preset.id, [{
      version: '1.0.0',
      changes: 'Initial version',
      preset: { ...preset },
      createdAt: new Date()
    }]);

    // Track user's presets
    if (!this.userPresets.has(config.author)) {
      this.userPresets.set(config.author, new Set());
    }
    this.userPresets.get(config.author)!.add(preset.id);

    this.emit('preset:created', preset);
    return preset;
  }

  updatePreset(
    presetId: string,
    updates: Partial<PersonalityPreset>,
    changeLog?: string
  ): PersonalityPreset | null {
    const preset = this.presets.get(presetId);
    if (!preset) return null;

    const oldVersion = preset.version;
    const newVersion = this.incrementVersion(oldVersion);

    const updatedPreset: PersonalityPreset = {
      ...preset,
      ...updates,
      id: presetId,
      version: newVersion,
      updatedAt: new Date()
    };

    this.presets.set(presetId, updatedPreset);

    // Save version history
    const versionHistory = this.versions.get(presetId) || [];
    versionHistory.push({
      version: newVersion,
      changes: changeLog || 'Updated preset',
      preset: { ...updatedPreset },
      createdAt: new Date()
    });
    this.versions.set(presetId, versionHistory);

    this.emit('preset:updated', updatedPreset);
    return updatedPreset;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }

  deletePreset(presetId: string, userId: string): boolean {
    const preset = this.presets.get(presetId);
    if (!preset || preset.author !== userId) return false;

    this.presets.delete(presetId);
    this.reviews.delete(presetId);
    this.versions.delete(presetId);
    this.userPresets.get(userId)?.delete(presetId);

    this.emit('preset:deleted', { presetId, userId });
    return true;
  }

  getPreset(presetId: string): PersonalityPreset | undefined {
    return this.presets.get(presetId);
  }

  // ============================================================================
  // Marketplace Search & Discovery
  // ============================================================================

  searchPresets(query: string, filters?: SearchFilters): PersonalityPreset[] {
    let results = Array.from(this.presets.values()).filter(p => p.isPublic);

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.tags?.length) {
        results = results.filter(p =>
          filters.tags!.some(tag => p.tags.includes(tag))
        );
      }

      if (filters.minRating !== undefined) {
        results = results.filter(p => p.rating >= filters.minRating!);
      }

      if (filters.author) {
        results = results.filter(p => p.author === filters.author);
      }

      // Sort
      const sortBy = filters.sortBy || 'downloads';
      const sortOrder = filters.sortOrder || 'desc';

      results.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'downloads':
            comparison = a.downloads - b.downloads;
            break;
          case 'rating':
            comparison = a.rating - b.rating;
            break;
          case 'newest':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return results;
  }

  getFeaturedPresets(limit: number = 10): PersonalityPreset[] {
    return Array.from(this.presets.values())
      .filter(p => p.isPublic)
      .sort((a, b) => {
        // Score based on downloads and rating
        const scoreA = a.downloads * 0.3 + a.rating * a.ratingCount * 0.7;
        const scoreB = b.downloads * 0.3 + b.rating * b.ratingCount * 0.7;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  getPresetsByCategory(categoryId: string): PersonalityPreset[] {
    return Array.from(this.presets.values())
      .filter(p => p.isPublic && p.tags.includes(categoryId));
  }

  getSimilarPresets(presetId: string, limit: number = 5): PersonalityPreset[] {
    const preset = this.presets.get(presetId);
    if (!preset) return [];

    return Array.from(this.presets.values())
      .filter(p => p.id !== presetId && p.isPublic)
      .map(p => ({
        preset: p,
        similarity: this.calculateSimilarity(preset, p)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.preset);
  }

  private calculateSimilarity(a: PersonalityPreset, b: PersonalityPreset): number {
    let score = 0;

    // Tag overlap
    const commonTags = a.tags.filter(t => b.tags.includes(t));
    score += commonTags.length * 0.2;

    // Behavioral similarity
    score += 1 - Math.abs(a.creativityLevel - b.creativityLevel);
    score += 1 - Math.abs(a.formality - b.formality);
    score += 1 - Math.abs(a.verbosity - b.verbosity);
    score += 1 - Math.abs(a.emotionalExpression - b.emotionalExpression);

    // Same base stance
    if (a.stanceConfig.baseStance === b.stanceConfig.baseStance) {
      score += 1;
    }

    // Same default mode
    if (a.modeConfig.defaultMode === b.modeConfig.defaultMode) {
      score += 1;
    }

    return score;
  }

  // ============================================================================
  // Install & Apply
  // ============================================================================

  installPreset(presetId: string): PersonalityPreset | null {
    const preset = this.presets.get(presetId);
    if (!preset) return null;

    this.installedPresets.add(presetId);
    preset.downloads++;

    this.emit('preset:installed', preset);
    return preset;
  }

  uninstallPreset(presetId: string): boolean {
    if (!this.installedPresets.has(presetId)) return false;

    this.installedPresets.delete(presetId);
    this.emit('preset:uninstalled', { presetId });
    return true;
  }

  getInstalledPresets(): PersonalityPreset[] {
    return Array.from(this.installedPresets)
      .map(id => this.presets.get(id))
      .filter((p): p is PersonalityPreset => p !== undefined);
  }

  applyPreset(presetId: string): {
    success: boolean;
    operators?: PresetOperatorConfig[];
    stanceConfig?: PresetStanceConfig;
    modeConfig?: PresetModeConfig;
    error?: string;
  } {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return { success: false, error: 'Preset not found' };
    }

    this.emit('preset:applied', {
      presetId,
      stanceConfig: preset.stanceConfig,
      modeConfig: preset.modeConfig,
      operators: preset.operators
    });

    return {
      success: true,
      operators: preset.operators,
      stanceConfig: preset.stanceConfig,
      modeConfig: preset.modeConfig
    };
  }

  // ============================================================================
  // Reviews & Ratings
  // ============================================================================

  addReview(
    presetId: string,
    userId: string,
    rating: number,
    comment: string
  ): PresetReview | null {
    const preset = this.presets.get(presetId);
    if (!preset) return null;

    if (rating < 1 || rating > 5) return null;

    const review: PresetReview = {
      id: uuidv4(),
      presetId,
      userId,
      rating,
      comment,
      createdAt: new Date(),
      helpful: 0
    };

    const reviews = this.reviews.get(presetId) || [];
    reviews.push(review);
    this.reviews.set(presetId, reviews);

    // Update preset rating
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    preset.rating = totalRating / reviews.length;
    preset.ratingCount = reviews.length;

    this.emit('review:added', review);
    return review;
  }

  getReviews(presetId: string): PresetReview[] {
    return this.reviews.get(presetId) || [];
  }

  markReviewHelpful(reviewId: string, presetId: string): boolean {
    const reviews = this.reviews.get(presetId);
    if (!reviews) return false;

    const review = reviews.find(r => r.id === reviewId);
    if (!review) return false;

    review.helpful++;
    return true;
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  exportPreset(presetId: string): string | null {
    const preset = this.presets.get(presetId);
    if (!preset) return null;

    return JSON.stringify({
      ...preset,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0'
    }, null, 2);
  }

  importPreset(jsonData: string, newAuthor: string): PersonalityPreset | null {
    try {
      const data = JSON.parse(jsonData);

      // Validate required fields
      if (!data.name || !data.stanceConfig || !data.modeConfig) {
        return null;
      }

      // Create new preset with imported data
      const preset = this.createPreset({
        name: data.name,
        description: data.description || '',
        author: newAuthor,
        stanceConfig: data.stanceConfig,
        modeConfig: data.modeConfig,
        operators: data.operators || [],
        creativityLevel: data.creativityLevel,
        formality: data.formality,
        verbosity: data.verbosity,
        emotionalExpression: data.emotionalExpression,
        tags: data.tags || [],
        isPublic: false, // Imported presets start as private
        systemPromptAdditions: data.systemPromptAdditions,
        responseStyleGuide: data.responseStyleGuide
      });

      this.emit('preset:imported', { preset, originalAuthor: data.author });
      return preset;
    } catch {
      return null;
    }
  }

  exportBundle(bundleId: string): string | null {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return null;

    const presets = bundle.presets
      .map(id => this.presets.get(id))
      .filter((p): p is PersonalityPreset => p !== undefined);

    return JSON.stringify({
      bundle,
      presets,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0'
    }, null, 2);
  }

  // ============================================================================
  // Bundles
  // ============================================================================

  createBundle(config: {
    name: string;
    description: string;
    presetIds: string[];
    author: string;
    price?: number;
  }): PresetBundle {
    const bundle: PresetBundle = {
      id: uuidv4(),
      name: config.name,
      description: config.description,
      presets: config.presetIds,
      author: config.author,
      price: config.price
    };

    this.bundles.set(bundle.id, bundle);
    this.emit('bundle:created', bundle);
    return bundle;
  }

  getBundle(bundleId: string): PresetBundle | undefined {
    return this.bundles.get(bundleId);
  }

  listBundles(): PresetBundle[] {
    return Array.from(this.bundles.values());
  }

  // ============================================================================
  // Version Control
  // ============================================================================

  getPresetVersions(presetId: string): PresetVersion[] {
    return this.versions.get(presetId) || [];
  }

  revertToVersion(presetId: string, version: string): PersonalityPreset | null {
    const versions = this.versions.get(presetId);
    if (!versions) return null;

    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) return null;

    const reverted = this.updatePreset(
      presetId,
      targetVersion.preset,
      `Reverted to version ${version}`
    );

    if (reverted) {
      this.emit('preset:reverted', { presetId, toVersion: version });
    }

    return reverted;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getMarketplaceStats(): {
    totalPresets: number;
    publicPresets: number;
    totalDownloads: number;
    averageRating: number;
    topCategories: Array<{ category: string; count: number }>;
  } {
    const allPresets = Array.from(this.presets.values());
    const publicPresets = allPresets.filter(p => p.isPublic);

    const totalDownloads = publicPresets.reduce((sum, p) => sum + p.downloads, 0);
    const ratedPresets = publicPresets.filter(p => p.ratingCount > 0);
    const averageRating = ratedPresets.length > 0
      ? ratedPresets.reduce((sum, p) => sum + p.rating, 0) / ratedPresets.length
      : 0;

    // Count by category (using first tag as category)
    const categoryCount = new Map<string, number>();
    for (const preset of publicPresets) {
      const category = preset.tags[0] || 'uncategorized';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPresets: allPresets.length,
      publicPresets: publicPresets.length,
      totalDownloads,
      averageRating,
      topCategories
    };
  }

  getUserStats(userId: string): {
    presetsCreated: number;
    totalDownloads: number;
    averageRating: number;
    presetsInstalled: number;
  } {
    const userPresetIds = this.userPresets.get(userId) || new Set();
    const userPresets = Array.from(userPresetIds)
      .map(id => this.presets.get(id))
      .filter((p): p is PersonalityPreset => p !== undefined);

    const totalDownloads = userPresets.reduce((sum, p) => sum + p.downloads, 0);
    const ratedPresets = userPresets.filter(p => p.ratingCount > 0);
    const averageRating = ratedPresets.length > 0
      ? ratedPresets.reduce((sum, p) => sum + p.rating, 0) / ratedPresets.length
      : 0;

    return {
      presetsCreated: userPresets.length,
      totalDownloads,
      averageRating,
      presetsInstalled: this.installedPresets.size
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const personalityMarketplace = new PersonalityMarketplace();
