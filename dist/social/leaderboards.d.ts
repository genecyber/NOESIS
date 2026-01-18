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
export type BadgeCategory = 'coherence' | 'exploration' | 'transformation' | 'streak' | 'social' | 'challenge' | 'achievement';
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
export type ChallengeType = 'coherence-race' | 'transformation-sprint' | 'frame-exploration' | 'value-optimization' | 'head-to-head' | 'team-tournament';
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
export type LeaderboardType = 'overall' | 'coherence' | 'transformations' | 'streak' | 'challenges' | 'social';
export declare class LeaderboardSystem {
    private users;
    private leaderboards;
    private challenges;
    private shares;
    constructor();
    private initializeLeaderboards;
    registerUser(userId: string, username: string, avatar?: string): LeaderboardEntry;
    recordSession(userId: string, _stance: Stance, coherence: number, transformations: number, framesUsed: Frame[]): void;
    private calculateScore;
    private checkBadges;
    private checkAchievements;
    private updateLeaderboards;
    private filterByTimeframe;
    private sortByType;
    createChallenge(challenge: Omit<Challenge, 'id' | 'participants' | 'status'>): Challenge;
    joinChallenge(challengeId: string, userId: string): boolean;
    updateChallengeScore(challengeId: string, userId: string, score: number): void;
    completeChallenge(challengeId: string): void;
    private getEligibleParticipants;
    shareToSocial(userId: string, type: SocialShare['type'], content: string, platforms: SocialPlatform[]): SocialShare;
    generateShareContent(userId: string, type: SocialShare['type']): string;
    getLeaderboard(type: LeaderboardType, timeframe: Leaderboard['timeframe']): Leaderboard | undefined;
    getUserEntry(userId: string): LeaderboardEntry | undefined;
    getChallenge(challengeId: string): Challenge | undefined;
    getActiveChallenges(): Challenge[];
    getUpcomingChallenges(): Challenge[];
}
export declare function createLeaderboardSystem(): LeaderboardSystem;
//# sourceMappingURL=leaderboards.d.ts.map