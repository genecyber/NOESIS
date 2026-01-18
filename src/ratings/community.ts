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
  rating: number; // 1-5
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
  ratingDistribution: Record<number, number>; // 1-5 -> count
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

export type ReputationLevel =
  | 'newcomer'
  | 'contributor'
  | 'trusted'
  | 'expert'
  | 'master'
  | 'legendary';

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

export type ReportReason =
  | 'inappropriate'
  | 'spam'
  | 'copyright'
  | 'misleading'
  | 'offensive'
  | 'other';

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

const REPUTATION_THRESHOLDS: Record<ReputationLevel, number> = {
  'newcomer': 0,
  'contributor': 100,
  'trusted': 500,
  'expert': 2000,
  'master': 5000,
  'legendary': 10000
};

const BADGE_DEFINITIONS: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first-review', name: 'First Review', description: 'Posted your first review', icon: '✍️', rarity: 'common' },
  { id: 'helpful-10', name: 'Helpful', description: '10 helpful votes received', icon: '👍', rarity: 'uncommon' },
  { id: 'helpful-100', name: 'Very Helpful', description: '100 helpful votes received', icon: '⭐', rarity: 'rare' },
  { id: 'prolific', name: 'Prolific Reviewer', description: '50 reviews posted', icon: '📝', rarity: 'rare' },
  { id: 'curator', name: 'Curator', description: 'Created a featured collection', icon: '🎨', rarity: 'epic' },
  { id: 'veteran', name: 'Veteran', description: '1 year of activity', icon: '🏆', rarity: 'epic' }
];

export class CommunityRatingSystem {
  private templates: Map<string, TemplateEntry> = new Map();
  private ratings: Map<string, TemplateRating[]> = new Map();
  private statistics: Map<string, TemplateStatistics> = new Map();
  private users: Map<string, UserReputation> = new Map();
  private collections: Map<string, CuratedCollection> = new Map();
  private reports: Map<string, Report> = new Map();
  private moderationLog: ModerationAction[] = [];

  registerTemplate(template: TemplateEntry): void {
    this.templates.set(template.id, template);
    this.ratings.set(template.id, []);
    this.statistics.set(template.id, {
      templateId: template.id,
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalUses: 0,
      uniqueUsers: 0,
      favoriteCount: 0,
      lastUsed: new Date(),
      trendScore: 0
    });
  }

  registerUser(userId: string, displayName: string): UserReputation {
    const user: UserReputation = {
      userId,
      displayName,
      reputation: 0,
      totalReviews: 0,
      helpfulVotes: 0,
      badges: [],
      level: 'newcomer',
      joinedAt: new Date()
    };
    this.users.set(userId, user);
    return user;
  }

  submitRating(
    templateId: string,
    userId: string,
    rating: number,
    review?: string
  ): TemplateRating | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    if (rating < 1 || rating > 5) return null;

    let user = this.users.get(userId);
    if (!user) {
      user = this.registerUser(userId, `User ${userId.slice(0, 8)}`);
    }

    const templateRatings = this.ratings.get(templateId) || [];

    // Check for existing rating from this user
    const existingIndex = templateRatings.findIndex(r => r.userId === userId);
    if (existingIndex !== -1) {
      // Update existing rating
      const existing = templateRatings[existingIndex];
      existing.rating = rating;
      existing.review = review;
      existing.updatedAt = new Date();
    } else {
      // Create new rating
      const newRating: TemplateRating = {
        templateId,
        userId,
        rating,
        review,
        createdAt: new Date(),
        updatedAt: new Date(),
        helpful: 0,
        reported: false,
        verified: false
      };
      templateRatings.push(newRating);

      // Update user stats
      user.totalReviews++;
      user.reputation += review ? 15 : 5;
      this.updateUserLevel(user);
      this.checkAndAwardBadges(user);
    }

    this.ratings.set(templateId, templateRatings);
    this.updateStatistics(templateId);

    return templateRatings.find(r => r.userId === userId) || null;
  }

  private updateStatistics(templateId: string): void {
    const ratings = this.ratings.get(templateId) || [];
    const stats = this.statistics.get(templateId);
    if (!stats) return;

    if (ratings.length === 0) {
      stats.averageRating = 0;
      stats.totalRatings = 0;
      return;
    }

    // Calculate average
    const sum = ratings.reduce((s, r) => s + r.rating, 0);
    stats.averageRating = Math.round((sum / ratings.length) * 10) / 10;
    stats.totalRatings = ratings.length;

    // Update distribution
    stats.ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) {
      stats.ratingDistribution[r.rating]++;
    }

    // Calculate trend score (recency-weighted)
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentRatings = ratings.filter(r => r.createdAt.getTime() > weekAgo);
    stats.trendScore = recentRatings.length * 10 + stats.totalUses * 0.1;
  }

  private updateUserLevel(user: UserReputation): void {
    for (const [level, threshold] of Object.entries(REPUTATION_THRESHOLDS).reverse()) {
      if (user.reputation >= threshold) {
        user.level = level as ReputationLevel;
        break;
      }
    }
  }

  private checkAndAwardBadges(user: UserReputation): void {
    const earnedIds = new Set(user.badges.map(b => b.id));

    // First review badge
    if (user.totalReviews >= 1 && !earnedIds.has('first-review')) {
      const badge = BADGE_DEFINITIONS.find(b => b.id === 'first-review')!;
      user.badges.push({ ...badge, earnedAt: new Date() });
    }

    // Helpful badges
    if (user.helpfulVotes >= 10 && !earnedIds.has('helpful-10')) {
      const badge = BADGE_DEFINITIONS.find(b => b.id === 'helpful-10')!;
      user.badges.push({ ...badge, earnedAt: new Date() });
    }
    if (user.helpfulVotes >= 100 && !earnedIds.has('helpful-100')) {
      const badge = BADGE_DEFINITIONS.find(b => b.id === 'helpful-100')!;
      user.badges.push({ ...badge, earnedAt: new Date() });
    }

    // Prolific reviewer
    if (user.totalReviews >= 50 && !earnedIds.has('prolific')) {
      const badge = BADGE_DEFINITIONS.find(b => b.id === 'prolific')!;
      user.badges.push({ ...badge, earnedAt: new Date() });
    }
  }

  markHelpful(templateId: string, ratingUserId: string, voterId: string): boolean {
    const ratings = this.ratings.get(templateId);
    if (!ratings) return false;

    const rating = ratings.find(r => r.userId === ratingUserId);
    if (!rating || rating.userId === voterId) return false;

    rating.helpful++;

    // Award reputation to reviewer
    const reviewer = this.users.get(ratingUserId);
    if (reviewer) {
      reviewer.helpfulVotes++;
      reviewer.reputation += 5;
      this.updateUserLevel(reviewer);
      this.checkAndAwardBadges(reviewer);
    }

    return true;
  }

  recordUsage(templateId: string, _userId: string): void {
    const stats = this.statistics.get(templateId);
    if (!stats) return;

    stats.totalUses++;
    stats.lastUsed = new Date();

    // Track unique users (simplified - in production use a Set)
    stats.uniqueUsers = Math.min(stats.uniqueUsers + 1, stats.totalUses);

    this.updateStatistics(templateId);
  }

  toggleFavorite(templateId: string, _userId: string, favorite: boolean): boolean {
    const stats = this.statistics.get(templateId);
    if (!stats) return false;

    stats.favoriteCount += favorite ? 1 : -1;
    stats.favoriteCount = Math.max(0, stats.favoriteCount);

    return true;
  }

  createCollection(
    name: string,
    description: string,
    templateIds: string[],
    curatorId: string,
    category: string,
    tags: string[]
  ): CuratedCollection {
    const collection: CuratedCollection = {
      id: `collection-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      templateIds,
      curatedBy: curatorId,
      featured: false,
      category,
      tags,
      createdAt: new Date(),
      viewCount: 0
    };

    this.collections.set(collection.id, collection);

    // Award reputation for creating collection
    const curator = this.users.get(curatorId);
    if (curator) {
      curator.reputation += 25;
      this.updateUserLevel(curator);
    }

    return collection;
  }

  featureCollection(collectionId: string, moderatorId: string): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    collection.featured = true;

    // Award curator badge
    const curator = this.users.get(collection.curatedBy);
    if (curator && !curator.badges.some(b => b.id === 'curator')) {
      const badge = BADGE_DEFINITIONS.find(b => b.id === 'curator')!;
      curator.badges.push({ ...badge, earnedAt: new Date() });
      curator.reputation += 100;
      this.updateUserLevel(curator);
    }

    this.logModeration({
      targetType: 'collection',
      targetId: collectionId,
      action: 'approve',
      moderatorId,
      reason: 'Featured collection'
    });

    return true;
  }

  submitReport(
    targetType: 'template' | 'review' | 'collection',
    targetId: string,
    reporterId: string,
    reason: ReportReason,
    description?: string
  ): Report {
    const report: Report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      targetType,
      targetId,
      reporterId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    };

    this.reports.set(report.id, report);

    // Mark rating as reported if applicable
    if (targetType === 'review') {
      for (const ratings of this.ratings.values()) {
        const rating = ratings.find(r => `${r.templateId}-${r.userId}` === targetId);
        if (rating) {
          rating.reported = true;
          break;
        }
      }
    }

    return report;
  }

  resolveReport(
    reportId: string,
    moderatorId: string,
    action: 'approve' | 'remove' | 'warn' | 'ban',
    reason: string
  ): boolean {
    const report = this.reports.get(reportId);
    if (!report) return false;

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.moderatorId = moderatorId;

    this.logModeration({
      targetType: report.targetType,
      targetId: report.targetId,
      action,
      moderatorId,
      reason
    });

    return true;
  }

  private logModeration(action: Omit<ModerationAction, 'id' | 'timestamp'>): void {
    this.moderationLog.push({
      id: `mod-${Date.now()}`,
      ...action,
      timestamp: new Date()
    });

    // Limit log size
    if (this.moderationLog.length > 1000) {
      this.moderationLog = this.moderationLog.slice(-500);
    }
  }

  searchTemplates(filter: SearchFilter): TemplateEntry[] {
    let results = Array.from(this.templates.values());

    // Apply filters
    if (filter.category) {
      results = results.filter(t => t.category === filter.category);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(t =>
        filter.tags!.some(tag => t.tags.includes(tag))
      );
    }
    if (filter.minRating) {
      results = results.filter(t => {
        const stats = this.statistics.get(t.id);
        return stats && stats.averageRating >= filter.minRating!;
      });
    }

    // Sort
    switch (filter.sortBy) {
      case 'rating':
        results.sort((a, b) => {
          const statsA = this.statistics.get(a.id);
          const statsB = this.statistics.get(b.id);
          return (statsB?.averageRating || 0) - (statsA?.averageRating || 0);
        });
        break;
      case 'popularity':
        results.sort((a, b) => {
          const statsA = this.statistics.get(a.id);
          const statsB = this.statistics.get(b.id);
          return (statsB?.totalUses || 0) - (statsA?.totalUses || 0);
        });
        break;
      case 'trending':
        results.sort((a, b) => {
          const statsA = this.statistics.get(a.id);
          const statsB = this.statistics.get(b.id);
          return (statsB?.trendScore || 0) - (statsA?.trendScore || 0);
        });
        break;
      case 'recent':
      default:
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 20;
    return results.slice(offset, offset + limit);
  }

  getTopRated(limit: number = 10): TemplateEntry[] {
    return this.searchTemplates({ sortBy: 'rating', limit });
  }

  getTrending(limit: number = 10): TemplateEntry[] {
    return this.searchTemplates({ sortBy: 'trending', limit });
  }

  getFeaturedCollections(): CuratedCollection[] {
    return Array.from(this.collections.values()).filter(c => c.featured);
  }

  getTemplateStatistics(templateId: string): TemplateStatistics | undefined {
    return this.statistics.get(templateId);
  }

  getTemplateRatings(templateId: string): TemplateRating[] {
    return this.ratings.get(templateId) || [];
  }

  getUserReputation(userId: string): UserReputation | undefined {
    return this.users.get(userId);
  }

  getTemplate(templateId: string): TemplateEntry | undefined {
    return this.templates.get(templateId);
  }

  getCollection(collectionId: string): CuratedCollection | undefined {
    return this.collections.get(collectionId);
  }

  getPendingReports(): Report[] {
    return Array.from(this.reports.values()).filter(r => r.status === 'pending');
  }

  getModerationLog(limit: number = 50): ModerationAction[] {
    return this.moderationLog.slice(-limit);
  }
}

export function createCommunityRatingSystem(): CommunityRatingSystem {
  return new CommunityRatingSystem();
}
