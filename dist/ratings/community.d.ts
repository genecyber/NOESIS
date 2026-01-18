/**
 * Community Template Ratings and Reviews
 *
 * Star ratings, written reviews, usage statistics,
 * user reputation, and content moderation.
 */
import type { Stance } from '../types/index.js';
export interface TemplateRating {
    templateId: string;
    userId: string;
    rating: number;
    review?: string;
    createdAt: Date;
    updatedAt: Date;
    helpful: number;
    reported: boolean;
    verified: boolean;
}
export interface TemplateStatistics {
    templateId: string;
    averageRating: number;
    totalRatings: number;
    ratingDistribution: Record<number, number>;
    totalUses: number;
    uniqueUsers: number;
    favoriteCount: number;
    lastUsed: Date;
    trendScore: number;
}
export interface UserReputation {
    userId: string;
    displayName: string;
    reputation: number;
    totalReviews: number;
    helpfulVotes: number;
    badges: Badge[];
    level: ReputationLevel;
    joinedAt: Date;
}
export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: Date;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}
export type ReputationLevel = 'newcomer' | 'contributor' | 'trusted' | 'expert' | 'master' | 'legendary';
export interface CuratedCollection {
    id: string;
    name: string;
    description: string;
    templateIds: string[];
    curatedBy: string;
    featured: boolean;
    category: string;
    tags: string[];
    createdAt: Date;
    viewCount: number;
}
export interface Report {
    id: string;
    targetType: 'template' | 'review' | 'collection';
    targetId: string;
    reporterId: string;
    reason: ReportReason;
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
    createdAt: Date;
    resolvedAt?: Date;
    moderatorId?: string;
}
export type ReportReason = 'inappropriate' | 'spam' | 'copyright' | 'misleading' | 'offensive' | 'other';
export interface ModerationAction {
    id: string;
    targetType: string;
    targetId: string;
    action: 'approve' | 'remove' | 'warn' | 'ban';
    moderatorId: string;
    reason: string;
    timestamp: Date;
}
export interface TemplateEntry {
    id: string;
    name: string;
    description: string;
    authorId: string;
    stance: Partial<Stance>;
    category: string;
    tags: string[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface SearchFilter {
    category?: string;
    tags?: string[];
    minRating?: number;
    sortBy?: 'rating' | 'popularity' | 'recent' | 'trending';
    limit?: number;
    offset?: number;
}
export declare class CommunityRatingSystem {
    private templates;
    private ratings;
    private statistics;
    private users;
    private collections;
    private reports;
    private moderationLog;
    registerTemplate(template: TemplateEntry): void;
    registerUser(userId: string, displayName: string): UserReputation;
    submitRating(templateId: string, userId: string, rating: number, review?: string): TemplateRating | null;
    private updateStatistics;
    private updateUserLevel;
    private checkAndAwardBadges;
    markHelpful(templateId: string, ratingUserId: string, voterId: string): boolean;
    recordUsage(templateId: string, _userId: string): void;
    toggleFavorite(templateId: string, _userId: string, favorite: boolean): boolean;
    createCollection(name: string, description: string, templateIds: string[], curatorId: string, category: string, tags: string[]): CuratedCollection;
    featureCollection(collectionId: string, moderatorId: string): boolean;
    submitReport(targetType: 'template' | 'review' | 'collection', targetId: string, reporterId: string, reason: ReportReason, description?: string): Report;
    resolveReport(reportId: string, moderatorId: string, action: 'approve' | 'remove' | 'warn' | 'ban', reason: string): boolean;
    private logModeration;
    searchTemplates(filter: SearchFilter): TemplateEntry[];
    getTopRated(limit?: number): TemplateEntry[];
    getTrending(limit?: number): TemplateEntry[];
    getFeaturedCollections(): CuratedCollection[];
    getTemplateStatistics(templateId: string): TemplateStatistics | undefined;
    getTemplateRatings(templateId: string): TemplateRating[];
    getUserReputation(userId: string): UserReputation | undefined;
    getTemplate(templateId: string): TemplateEntry | undefined;
    getCollection(collectionId: string): CuratedCollection | undefined;
    getPendingReports(): Report[];
    getModerationLog(limit?: number): ModerationAction[];
}
export declare function createCommunityRatingSystem(): CommunityRatingSystem;
//# sourceMappingURL=community.d.ts.map