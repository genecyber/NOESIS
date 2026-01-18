/**
 * Competitive Stance Leaderboards
 *
 * Community rankings, badges, challenges, and social
 * sharing for stance optimization competitions.
 */

import type { Stance, Frame } from '../types/index.js';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  rank: number;
  metrics: PerformanceMetrics;
  badges: Badge[];
  achievements: Achievement[];
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface PerformanceMetrics {
  totalSessions: number;
  totalTransformations: number;
  averageCoherence: number;
  peakCoherence: number;
  totalDrift: number;
  uniqueFramesUsed: number;
  longestStreak: number;
  currentStreak: number;
  challengesWon: number;
  challengesParticipated: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  category: BadgeCategory;
  earnedAt: Date;
  progress?: number;
}

export type BadgeCategory =
  | 'coherence'
  | 'exploration'
  | 'transformation'
  | 'streak'
  | 'social'
  | 'challenge'
  | 'achievement';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlockedAt: Date;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  startTime: Date;
  endTime: Date;
  requirements: ChallengeRequirement[];
  rewards: ChallengeReward[];
  participants: ChallengeParticipant[];
  status: 'upcoming' | 'active' | 'completed';
  maxParticipants?: number;
}

export type ChallengeType =
  | 'coherence-race'
  | 'transformation-sprint'
  | 'frame-exploration'
  | 'value-optimization'
  | 'head-to-head'
  | 'team-tournament';

export interface ChallengeRequirement {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'between';
  value: number | [number, number];
  description: string;
}

export interface ChallengeReward {
  type: 'badge' | 'achievement' | 'points' | 'title';
  value: string | number;
  position: 'all' | 'top3' | 'top10' | 'winner';
}

export interface ChallengeParticipant {
  userId: string;
  username: string;
  score: number;
  rank: number;
  completedRequirements: string[];
  joinedAt: Date;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  rounds: TournamentRound[];
  brackets: TournamentBracket[];
  status: 'registration' | 'in_progress' | 'completed';
  startTime: Date;
  endTime: Date;
  prizePool: Prize[];
}

export interface TournamentRound {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  id: string;
  participants: string[];
  scores: Record<string, number>;
  winner?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TournamentBracket {
  position: number;
  userId: string;
  seed: number;
  eliminated: boolean;
}

export interface Prize {
  position: number;
  rewards: ChallengeReward[];
}

export interface SocialShare {
  id: string;
  userId: string;
  type: 'achievement' | 'badge' | 'rank' | 'challenge';
  content: string;
  imageUrl?: string;
  platforms: SocialPlatform[];
  sharedAt: Date;
}

export type SocialPlatform = 'twitter' | 'discord' | 'linkedin' | 'mastodon';

export interface Leaderboard {
  id: string;
  name: string;
  type: LeaderboardType;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'alltime';
  entries: LeaderboardEntry[];
  lastUpdated: Date;
}

export type LeaderboardType =
  | 'overall'
  | 'coherence'
  | 'transformations'
  | 'streak'
  | 'challenges'
  | 'social';

// Stance helpers not needed in this module - leaderboards work with metrics only

const DEFAULT_BADGES: Omit<Badge, 'earnedAt'>[] = [
  {
    id: 'first-transformation',
    name: 'First Steps',
    description: 'Complete your first transformation',
    icon: 'footprints',
    tier: 'bronze',
    category: 'transformation'
  },
  {
    id: 'coherence-master',
    name: 'Coherence Master',
    description: 'Maintain 90%+ coherence for 10 sessions',
    icon: 'balance',
    tier: 'gold',
    category: 'coherence'
  },
  {
    id: 'frame-explorer',
    name: 'Frame Explorer',
    description: 'Use all 10 frames in conversations',
    icon: 'compass',
    tier: 'silver',
    category: 'exploration'
  },
  {
    id: 'streak-week',
    name: 'Weekly Warrior',
    description: 'Maintain a 7-day activity streak',
    icon: 'flame',
    tier: 'bronze',
    category: 'streak'
  },
  {
    id: 'challenge-winner',
    name: 'Champion',
    description: 'Win your first challenge',
    icon: 'trophy',
    tier: 'silver',
    category: 'challenge'
  }
];

const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'hundred-sessions',
    name: 'Century',
    description: 'Complete 100 sessions',
    icon: '100',
    points: 100,
    rarity: 'uncommon'
  },
  {
    id: 'perfect-coherence',
    name: 'Perfect Balance',
    description: 'Achieve 100% coherence in a session',
    icon: 'star',
    points: 50,
    rarity: 'rare'
  },
  {
    id: 'transformation-thousand',
    name: 'Metamorphosis Master',
    description: 'Complete 1000 transformations',
    icon: 'butterfly',
    points: 200,
    rarity: 'epic'
  },
  {
    id: 'tournament-champion',
    name: 'Tournament Champion',
    description: 'Win a tournament',
    icon: 'crown',
    points: 500,
    rarity: 'legendary'
  }
];

export class LeaderboardSystem {
  private users: Map<string, LeaderboardEntry> = new Map();
  private leaderboards: Map<string, Leaderboard> = new Map();
  private challenges: Map<string, Challenge> = new Map();
  private shares: SocialShare[] = [];

  constructor() {
    this.initializeLeaderboards();
  }

  private initializeLeaderboards(): void {
    const types: LeaderboardType[] = ['overall', 'coherence', 'transformations', 'streak', 'challenges', 'social'];
    const timeframes: Leaderboard['timeframe'][] = ['daily', 'weekly', 'monthly', 'alltime'];

    for (const type of types) {
      for (const timeframe of timeframes) {
        const id = `${type}-${timeframe}`;
        this.leaderboards.set(id, {
          id,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} (${timeframe})`,
          type,
          timeframe,
          entries: [],
          lastUpdated: new Date()
        });
      }
    }
  }

  registerUser(userId: string, username: string, avatar?: string): LeaderboardEntry {
    const entry: LeaderboardEntry = {
      userId,
      username,
      avatar,
      score: 0,
      rank: 0,
      metrics: {
        totalSessions: 0,
        totalTransformations: 0,
        averageCoherence: 0,
        peakCoherence: 0,
        totalDrift: 0,
        uniqueFramesUsed: 0,
        longestStreak: 0,
        currentStreak: 0,
        challengesWon: 0,
        challengesParticipated: 0
      },
      badges: [],
      achievements: [],
      joinedAt: new Date(),
      lastActiveAt: new Date()
    };

    this.users.set(userId, entry);
    return entry;
  }

  recordSession(
    userId: string,
    _stance: Stance,
    coherence: number,
    transformations: number,
    framesUsed: Frame[]
  ): void {
    const entry = this.users.get(userId);
    if (!entry) return;

    entry.metrics.totalSessions++;
    entry.metrics.totalTransformations += transformations;
    entry.metrics.averageCoherence =
      (entry.metrics.averageCoherence * (entry.metrics.totalSessions - 1) + coherence) /
      entry.metrics.totalSessions;
    entry.metrics.peakCoherence = Math.max(entry.metrics.peakCoherence, coherence);
    entry.metrics.uniqueFramesUsed = Math.max(
      entry.metrics.uniqueFramesUsed,
      new Set([...framesUsed]).size
    );

    // Update streak
    const lastActive = entry.lastActiveAt;
    const now = new Date();
    const daysDiff = Math.floor(
      (now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysDiff <= 1) {
      entry.metrics.currentStreak++;
      entry.metrics.longestStreak = Math.max(
        entry.metrics.longestStreak,
        entry.metrics.currentStreak
      );
    } else if (daysDiff > 1) {
      entry.metrics.currentStreak = 1;
    }

    entry.lastActiveAt = now;
    entry.score = this.calculateScore(entry.metrics);

    this.checkBadges(entry);
    this.checkAchievements(entry);
    this.updateLeaderboards();
  }

  private calculateScore(metrics: PerformanceMetrics): number {
    return (
      metrics.totalSessions * 10 +
      metrics.totalTransformations * 2 +
      metrics.averageCoherence * 5 +
      metrics.longestStreak * 20 +
      metrics.challengesWon * 100 +
      metrics.uniqueFramesUsed * 15
    );
  }

  private checkBadges(entry: LeaderboardEntry): void {
    const earnedIds = new Set(entry.badges.map(b => b.id));

    for (const template of DEFAULT_BADGES) {
      if (earnedIds.has(template.id)) continue;

      let earned = false;

      switch (template.id) {
        case 'first-transformation':
          earned = entry.metrics.totalTransformations >= 1;
          break;
        case 'coherence-master':
          earned = entry.metrics.averageCoherence >= 90 && entry.metrics.totalSessions >= 10;
          break;
        case 'frame-explorer':
          earned = entry.metrics.uniqueFramesUsed >= 10;
          break;
        case 'streak-week':
          earned = entry.metrics.longestStreak >= 7;
          break;
        case 'challenge-winner':
          earned = entry.metrics.challengesWon >= 1;
          break;
      }

      if (earned) {
        entry.badges.push({
          ...template,
          earnedAt: new Date()
        });
      }
    }
  }

  private checkAchievements(entry: LeaderboardEntry): void {
    const unlockedIds = new Set(entry.achievements.map(a => a.id));

    for (const template of DEFAULT_ACHIEVEMENTS) {
      if (unlockedIds.has(template.id)) continue;

      let unlocked = false;

      switch (template.id) {
        case 'hundred-sessions':
          unlocked = entry.metrics.totalSessions >= 100;
          break;
        case 'perfect-coherence':
          unlocked = entry.metrics.peakCoherence >= 100;
          break;
        case 'transformation-thousand':
          unlocked = entry.metrics.totalTransformations >= 1000;
          break;
      }

      if (unlocked) {
        entry.achievements.push({
          ...template,
          unlockedAt: new Date()
        });
      }
    }
  }

  private updateLeaderboards(): void {
    const allEntries = Array.from(this.users.values());

    for (const leaderboard of this.leaderboards.values()) {
      const filtered = this.filterByTimeframe(allEntries, leaderboard.timeframe);
      const sorted = this.sortByType(filtered, leaderboard.type);

      sorted.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      leaderboard.entries = sorted.slice(0, 100);
      leaderboard.lastUpdated = new Date();
    }
  }

  private filterByTimeframe(entries: LeaderboardEntry[], timeframe: Leaderboard['timeframe']): LeaderboardEntry[] {
    if (timeframe === 'alltime') return entries;

    const now = new Date();
    let cutoff: Date;

    switch (timeframe) {
      case 'daily':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return entries;
    }

    return entries.filter(e => e.lastActiveAt >= cutoff);
  }

  private sortByType(entries: LeaderboardEntry[], type: LeaderboardType): LeaderboardEntry[] {
    return [...entries].sort((a, b) => {
      switch (type) {
        case 'overall':
          return b.score - a.score;
        case 'coherence':
          return b.metrics.averageCoherence - a.metrics.averageCoherence;
        case 'transformations':
          return b.metrics.totalTransformations - a.metrics.totalTransformations;
        case 'streak':
          return b.metrics.longestStreak - a.metrics.longestStreak;
        case 'challenges':
          return b.metrics.challengesWon - a.metrics.challengesWon;
        case 'social':
          return b.badges.length - a.badges.length;
        default:
          return b.score - a.score;
      }
    });
  }

  createChallenge(challenge: Omit<Challenge, 'id' | 'participants' | 'status'>): Challenge {
    const newChallenge: Challenge = {
      ...challenge,
      id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      participants: [],
      status: challenge.startTime > new Date() ? 'upcoming' : 'active'
    };

    this.challenges.set(newChallenge.id, newChallenge);
    return newChallenge;
  }

  joinChallenge(challengeId: string, userId: string): boolean {
    const challenge = this.challenges.get(challengeId);
    const user = this.users.get(userId);

    if (!challenge || !user) return false;
    if (challenge.status !== 'active' && challenge.status !== 'upcoming') return false;
    if (challenge.maxParticipants && challenge.participants.length >= challenge.maxParticipants) {
      return false;
    }
    if (challenge.participants.some(p => p.userId === userId)) return false;

    challenge.participants.push({
      userId,
      username: user.username,
      score: 0,
      rank: 0,
      completedRequirements: [],
      joinedAt: new Date()
    });

    user.metrics.challengesParticipated++;
    return true;
  }

  updateChallengeScore(challengeId: string, userId: string, score: number): void {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return;

    const participant = challenge.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.score = score;

    // Re-rank participants
    const sorted = [...challenge.participants].sort((a, b) => b.score - a.score);
    sorted.forEach((p, index) => {
      p.rank = index + 1;
    });
  }

  completeChallenge(challengeId: string): void {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.status !== 'active') return;

    challenge.status = 'completed';

    // Award rewards
    for (const reward of challenge.rewards) {
      const eligibleParticipants = this.getEligibleParticipants(challenge, reward.position);

      for (const participant of eligibleParticipants) {
        const user = this.users.get(participant.userId);
        if (!user) continue;

        if (reward.type === 'points') {
          user.score += reward.value as number;
        } else if (reward.type === 'badge') {
          const badge = DEFAULT_BADGES.find(b => b.id === reward.value);
          if (badge && !user.badges.some(b => b.id === badge.id)) {
            user.badges.push({ ...badge, earnedAt: new Date() });
          }
        }

        if (participant.rank === 1) {
          user.metrics.challengesWon++;
        }
      }
    }
  }

  private getEligibleParticipants(
    challenge: Challenge,
    position: ChallengeReward['position']
  ): ChallengeParticipant[] {
    const sorted = [...challenge.participants].sort((a, b) => b.score - a.score);

    switch (position) {
      case 'winner':
        return sorted.slice(0, 1);
      case 'top3':
        return sorted.slice(0, 3);
      case 'top10':
        return sorted.slice(0, 10);
      case 'all':
        return sorted;
      default:
        return [];
    }
  }

  shareToSocial(
    userId: string,
    type: SocialShare['type'],
    content: string,
    platforms: SocialPlatform[]
  ): SocialShare {
    const share: SocialShare = {
      id: `share-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      type,
      content,
      platforms,
      sharedAt: new Date()
    };

    this.shares.push(share);
    return share;
  }

  generateShareContent(userId: string, type: SocialShare['type']): string {
    const user = this.users.get(userId);
    if (!user) return '';

    switch (type) {
      case 'achievement':
        const latest = user.achievements[user.achievements.length - 1];
        return latest
          ? `I just unlocked "${latest.name}" in METAMORPH! ${latest.description}`
          : '';
      case 'badge':
        const badge = user.badges[user.badges.length - 1];
        return badge
          ? `Earned the ${badge.tier} "${badge.name}" badge in METAMORPH!`
          : '';
      case 'rank':
        return `I'm ranked #${user.rank} on the METAMORPH leaderboard with a score of ${user.score}!`;
      case 'challenge':
        return `Just completed a challenge in METAMORPH!`;
      default:
        return '';
    }
  }

  getLeaderboard(type: LeaderboardType, timeframe: Leaderboard['timeframe']): Leaderboard | undefined {
    return this.leaderboards.get(`${type}-${timeframe}`);
  }

  getUserEntry(userId: string): LeaderboardEntry | undefined {
    return this.users.get(userId);
  }

  getChallenge(challengeId: string): Challenge | undefined {
    return this.challenges.get(challengeId);
  }

  getActiveChallenges(): Challenge[] {
    return Array.from(this.challenges.values()).filter(c => c.status === 'active');
  }

  getUpcomingChallenges(): Challenge[] {
    return Array.from(this.challenges.values()).filter(c => c.status === 'upcoming');
  }
}

export function createLeaderboardSystem(): LeaderboardSystem {
  return new LeaderboardSystem();
}
