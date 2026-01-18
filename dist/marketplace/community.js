/**
 * Community Preset Marketplace (Ralph Iteration 10, Feature 3)
 *
 * User-submitted preset verification, rating system, featured curation,
 * usage analytics, and moderation.
 */
// ============================================================================
// Community Marketplace Manager
// ============================================================================
export class CommunityMarketplace {
    config;
    presets = new Map();
    reviews = new Map();
    authors = new Map();
    moderationLog = [];
    stats;
    constructor(config = {}) {
        this.config = {
            allowSubmissions: true,
            requireVerification: true,
            minRatingToFeature: 4.0,
            moderationEnabled: true,
            maxPresetsPerUser: 50,
            ...config
        };
        this.stats = {
            totalPresets: 0,
            activePresets: 0,
            featuredPresets: 0,
            totalAuthors: 0,
            totalDownloads: 0,
            averageRating: 0
        };
    }
    /**
     * Submit a new preset
     */
    submitPreset(name, description, authorId, category, stance, tags = [], operatorSequence) {
        if (!this.config.allowSubmissions)
            return null;
        // Get or create author
        let author = this.authors.get(authorId);
        if (!author) {
            author = {
                id: authorId,
                name: `User-${authorId.slice(0, 8)}`,
                reputation: 0,
                presetsPublished: 0,
                verified: false
            };
            this.authors.set(authorId, author);
            this.stats.totalAuthors++;
        }
        // Check preset limit
        if (author.presetsPublished >= this.config.maxPresetsPerUser) {
            return null;
        }
        const preset = {
            id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            description,
            author,
            category,
            tags,
            stance,
            operatorSequence,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0',
            status: this.config.requireVerification ? 'pending_review' : 'approved',
            stats: {
                downloads: 0,
                activeUsers: 0,
                averageRating: 0,
                totalRatings: 0,
                favoriteCount: 0
            },
            verification: null
        };
        this.presets.set(preset.id, preset);
        author.presetsPublished++;
        this.stats.totalPresets++;
        if (preset.status === 'approved') {
            this.stats.activePresets++;
        }
        return preset;
    }
    /**
     * Verify a preset
     */
    verifyPreset(presetId, verifierId, safetyScore, qualityScore, approved, notes = '') {
        const preset = this.presets.get(presetId);
        if (!preset || preset.status !== 'pending_review')
            return false;
        preset.verification = {
            verifiedBy: verifierId,
            verifiedAt: new Date(),
            safetyScore,
            qualityScore,
            notes
        };
        if (approved) {
            preset.status = 'approved';
            this.stats.activePresets++;
            preset.author.reputation += 10;
        }
        else {
            preset.status = 'rejected';
        }
        this.logModerationAction(presetId, approved ? 'approve' : 'reject', verifierId, notes);
        return true;
    }
    /**
     * Feature a preset
     */
    featurePreset(presetId, moderatorId) {
        const preset = this.presets.get(presetId);
        if (!preset || preset.status !== 'approved')
            return false;
        if (preset.stats.averageRating < this.config.minRatingToFeature) {
            return false;
        }
        preset.status = 'featured';
        this.stats.featuredPresets++;
        preset.author.reputation += 50;
        this.logModerationAction(presetId, 'feature', moderatorId, 'Met featuring criteria');
        return true;
    }
    /**
     * Unfeature a preset
     */
    unfeaturePreset(presetId, moderatorId, reason) {
        const preset = this.presets.get(presetId);
        if (!preset || preset.status !== 'featured')
            return false;
        preset.status = 'approved';
        this.stats.featuredPresets--;
        this.logModerationAction(presetId, 'unfeature', moderatorId, reason);
        return true;
    }
    /**
     * Add a review
     */
    addReview(presetId, authorId, rating, title, content) {
        const preset = this.presets.get(presetId);
        if (!preset || preset.status === 'rejected' || preset.status === 'draft')
            return null;
        // Clamp rating
        rating = Math.max(1, Math.min(5, rating));
        const review = {
            id: `review-${Date.now()}`,
            presetId,
            authorId,
            rating,
            title,
            content,
            helpful: 0,
            createdAt: new Date()
        };
        if (!this.reviews.has(presetId)) {
            this.reviews.set(presetId, []);
        }
        this.reviews.get(presetId).push(review);
        // Update preset stats
        const allReviews = this.reviews.get(presetId);
        preset.stats.totalRatings = allReviews.length;
        preset.stats.averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        // Update global average
        this.updateGlobalAverageRating();
        return review;
    }
    /**
     * Record a download
     */
    recordDownload(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset)
            return false;
        preset.stats.downloads++;
        this.stats.totalDownloads++;
        return true;
    }
    /**
     * Toggle favorite
     */
    toggleFavorite(presetId, add) {
        const preset = this.presets.get(presetId);
        if (!preset)
            return false;
        preset.stats.favoriteCount += add ? 1 : -1;
        preset.stats.favoriteCount = Math.max(0, preset.stats.favoriteCount);
        return true;
    }
    /**
     * Search presets
     */
    searchPresets(query, filters = {}) {
        let results = [...this.presets.values()];
        // Filter by status (default to approved and featured)
        if (filters.status) {
            results = results.filter(p => p.status === filters.status);
        }
        else {
            results = results.filter(p => p.status === 'approved' || p.status === 'featured');
        }
        // Filter by category
        if (filters.category) {
            results = results.filter(p => p.category === filters.category);
        }
        // Filter by tags
        if (filters.tags && filters.tags.length > 0) {
            results = results.filter(p => filters.tags.some(tag => p.tags.includes(tag)));
        }
        // Filter by minimum rating
        if (filters.minRating !== undefined) {
            results = results.filter(p => p.stats.averageRating >= filters.minRating);
        }
        // Filter by author
        if (filters.authorId) {
            results = results.filter(p => p.author.id === filters.authorId);
        }
        // Search query
        if (query) {
            const queryLower = query.toLowerCase();
            results = results.filter(p => p.name.toLowerCase().includes(queryLower) ||
                p.description.toLowerCase().includes(queryLower) ||
                p.tags.some(t => t.toLowerCase().includes(queryLower)));
        }
        // Sort
        switch (filters.sortBy) {
            case 'popular':
                results.sort((a, b) => b.stats.downloads - a.stats.downloads);
                break;
            case 'rating':
                results.sort((a, b) => b.stats.averageRating - a.stats.averageRating);
                break;
            case 'recent':
                results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                break;
            case 'downloads':
                results.sort((a, b) => b.stats.downloads - a.stats.downloads);
                break;
            default:
                // Featured first, then by downloads
                results.sort((a, b) => {
                    if (a.status === 'featured' && b.status !== 'featured')
                        return -1;
                    if (b.status === 'featured' && a.status !== 'featured')
                        return 1;
                    return b.stats.downloads - a.stats.downloads;
                });
        }
        return results;
    }
    /**
     * Get featured presets
     */
    getFeaturedPresets(limit = 10) {
        return [...this.presets.values()]
            .filter(p => p.status === 'featured')
            .sort((a, b) => b.stats.downloads - a.stats.downloads)
            .slice(0, limit);
    }
    /**
     * Get preset by ID
     */
    getPreset(presetId) {
        return this.presets.get(presetId) || null;
    }
    /**
     * Get reviews for a preset
     */
    getReviews(presetId) {
        return this.reviews.get(presetId) || [];
    }
    /**
     * Log moderation action
     */
    logModerationAction(presetId, action, moderatorId, reason) {
        this.moderationLog.push({
            id: `mod-${Date.now()}`,
            presetId,
            action,
            moderatorId,
            reason,
            timestamp: new Date()
        });
    }
    /**
     * Update global average rating
     */
    updateGlobalAverageRating() {
        const allPresets = [...this.presets.values()].filter(p => p.stats.totalRatings > 0);
        if (allPresets.length === 0) {
            this.stats.averageRating = 0;
            return;
        }
        this.stats.averageRating = allPresets.reduce((sum, p) => sum + p.stats.averageRating, 0) / allPresets.length;
    }
    /**
     * Get author by ID
     */
    getAuthor(authorId) {
        return this.authors.get(authorId) || null;
    }
    /**
     * Get moderation log
     */
    getModerationLog(presetId) {
        if (presetId) {
            return this.moderationLog.filter(m => m.presetId === presetId);
        }
        return [...this.moderationLog];
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get pending review presets
     */
    getPendingReview() {
        return [...this.presets.values()].filter(p => p.status === 'pending_review');
    }
    /**
     * Update preset version
     */
    updatePreset(presetId, updates) {
        const preset = this.presets.get(presetId);
        if (!preset)
            return false;
        if (updates.name)
            preset.name = updates.name;
        if (updates.description)
            preset.description = updates.description;
        if (updates.tags)
            preset.tags = updates.tags;
        if (updates.stance)
            preset.stance = updates.stance;
        if (updates.operatorSequence)
            preset.operatorSequence = updates.operatorSequence;
        preset.updatedAt = new Date();
        const [major, minor, patch] = preset.version.split('.').map(Number);
        preset.version = `${major}.${minor}.${patch + 1}`;
        return true;
    }
    /**
     * Reset marketplace
     */
    reset() {
        this.presets.clear();
        this.reviews.clear();
        this.authors.clear();
        this.moderationLog = [];
        this.stats = {
            totalPresets: 0,
            activePresets: 0,
            featuredPresets: 0,
            totalAuthors: 0,
            totalDownloads: 0,
            averageRating: 0
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const communityMarketplace = new CommunityMarketplace();
//# sourceMappingURL=community.js.map