/**
 * Community Preset Marketplace (Ralph Iteration 10, Feature 3)
 *
 * User-submitted preset verification, rating system, featured curation,
 * usage analytics, and moderation.
 */
import type { Stance } from '../types/index.js';
export interface MarketplaceConfig {
    allowSubmissions: boolean;
    requireVerification: boolean;
    minRatingToFeature: number;
    moderationEnabled: boolean;
    maxPresetsPerUser: number;
}
export interface CommunityPreset {
    id: string;
    name: string;
    description: string;
    author: PresetAuthor;
    category: PresetCategory;
    tags: string[];
    stance: Partial<Stance>;
    operatorSequence?: string[];
    createdAt: Date;
    updatedAt: Date;
    version: string;
    status: PresetStatus;
    stats: PresetStats;
    verification: VerificationInfo | null;
}
export interface PresetAuthor {
    id: string;
    name: string;
    reputation: number;
    presetsPublished: number;
    verified: boolean;
}
export type PresetCategory = 'creative' | 'analytical' | 'therapeutic' | 'educational' | 'professional' | 'experimental' | 'general';
export type PresetStatus = 'draft' | 'pending_review' | 'approved' | 'featured' | 'rejected' | 'deprecated';
export interface PresetStats {
    downloads: number;
    activeUsers: number;
    averageRating: number;
    totalRatings: number;
    favoriteCount: number;
}
export interface VerificationInfo {
    verifiedBy: string;
    verifiedAt: Date;
    safetyScore: number;
    qualityScore: number;
    notes: string;
}
export interface PresetReview {
    id: string;
    presetId: string;
    authorId: string;
    rating: number;
    title: string;
    content: string;
    helpful: number;
    createdAt: Date;
}
export interface ModerationAction {
    id: string;
    presetId: string;
    action: 'approve' | 'reject' | 'flag' | 'remove' | 'feature' | 'unfeature';
    moderatorId: string;
    reason: string;
    timestamp: Date;
}
export interface SearchFilters {
    category?: PresetCategory;
    tags?: string[];
    minRating?: number;
    sortBy?: 'popular' | 'recent' | 'rating' | 'downloads';
    status?: PresetStatus;
    authorId?: string;
}
export interface MarketplaceStats {
    totalPresets: number;
    activePresets: number;
    featuredPresets: number;
    totalAuthors: number;
    totalDownloads: number;
    averageRating: number;
}
export declare class CommunityMarketplace {
    private config;
    private presets;
    private reviews;
    private authors;
    private moderationLog;
    private stats;
    constructor(config?: Partial<MarketplaceConfig>);
    /**
     * Submit a new preset
     */
    submitPreset(name: string, description: string, authorId: string, category: PresetCategory, stance: Partial<Stance>, tags?: string[], operatorSequence?: string[]): CommunityPreset | null;
    /**
     * Verify a preset
     */
    verifyPreset(presetId: string, verifierId: string, safetyScore: number, qualityScore: number, approved: boolean, notes?: string): boolean;
    /**
     * Feature a preset
     */
    featurePreset(presetId: string, moderatorId: string): boolean;
    /**
     * Unfeature a preset
     */
    unfeaturePreset(presetId: string, moderatorId: string, reason: string): boolean;
    /**
     * Add a review
     */
    addReview(presetId: string, authorId: string, rating: number, title: string, content: string): PresetReview | null;
    /**
     * Record a download
     */
    recordDownload(presetId: string): boolean;
    /**
     * Toggle favorite
     */
    toggleFavorite(presetId: string, add: boolean): boolean;
    /**
     * Search presets
     */
    searchPresets(query: string, filters?: SearchFilters): CommunityPreset[];
    /**
     * Get featured presets
     */
    getFeaturedPresets(limit?: number): CommunityPreset[];
    /**
     * Get preset by ID
     */
    getPreset(presetId: string): CommunityPreset | null;
    /**
     * Get reviews for a preset
     */
    getReviews(presetId: string): PresetReview[];
    /**
     * Log moderation action
     */
    private logModerationAction;
    /**
     * Update global average rating
     */
    private updateGlobalAverageRating;
    /**
     * Get author by ID
     */
    getAuthor(authorId: string): PresetAuthor | null;
    /**
     * Get moderation log
     */
    getModerationLog(presetId?: string): ModerationAction[];
    /**
     * Get statistics
     */
    getStats(): MarketplaceStats;
    /**
     * Get pending review presets
     */
    getPendingReview(): CommunityPreset[];
    /**
     * Update preset version
     */
    updatePreset(presetId: string, updates: Partial<Pick<CommunityPreset, 'name' | 'description' | 'tags' | 'stance' | 'operatorSequence'>>): boolean;
    /**
     * Reset marketplace
     */
    reset(): void;
}
export declare const communityMarketplace: CommunityMarketplace;
//# sourceMappingURL=community.d.ts.map