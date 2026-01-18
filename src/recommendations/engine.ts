/**
 * Stance-Based Recommendation System
 *
 * Intelligent recommendations for stances, frames, values, and templates
 * based on user history, collaborative filtering, and contextual analysis.
 */

import type { Stance, Frame, SelfModel, Values } from '../types/index.js';

export interface RecommendationConfig {
  maxRecommendations: number;
  diversityWeight: number; // 0-1, higher = more diverse recommendations
  recencyWeight: number; // 0-1, higher = prefer recent items
  collaborativeWeight: number; // 0-1, weight for collaborative filtering
  contentWeight: number; // 0-1, weight for content-based filtering
  contextualWeight: number; // 0-1, weight for contextual factors
  minConfidence: number; // 0-100
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  target: RecommendationTarget;
  confidence: number; // 0-100
  reasoning: string[];
  relevanceScore: number;
  noveltyScore: number;
  diversityScore: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type RecommendationType =
  | 'frame'
  | 'value-adjustment'
  | 'template'
  | 'self-model'
  | 'exploration'
  | 'refinement'
  | 'complementary';

export interface RecommendationTarget {
  frame?: Frame;
  values?: Partial<Values>;
  selfModel?: SelfModel;
  templateId?: string;
  templateName?: string;
  description?: string;
}

export interface UserProfile {
  userId: string;
  stanceHistory: StanceHistoryEntry[];
  preferences: UserPreferences;
  interactionPatterns: InteractionPattern[];
  affinities: AffinityScore[];
}

export interface StanceHistoryEntry {
  stance: Stance;
  timestamp: Date;
  duration: number; // seconds
  satisfaction?: number; // 0-100
  context?: string;
}

export interface UserPreferences {
  preferredFrames: Frame[];
  avoidedFrames: Frame[];
  valueRanges: Partial<Record<keyof Values, { min: number; max: number }>>;
  complexityPreference: 'simple' | 'moderate' | 'complex';
  explorationTendency: number; // 0-100
}

export interface InteractionPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  associatedFrames: Frame[];
}

export interface AffinityScore {
  item: string;
  itemType: 'frame' | 'template' | 'value' | 'self-model';
  score: number; // -100 to 100
  interactions: number;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  diversityIndex: number;
  coverageScore: number;
  generationTime: number;
}

export interface SimilarityScore {
  itemId: string;
  score: number;
  commonFeatures: string[];
}

export interface ContextualFactors {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionDuration: number;
  recentActivity: 'exploring' | 'refining' | 'creating' | 'reviewing';
  emotionalState?: string;
  taskContext?: string;
}

const FRAME_SIMILARITY: Record<Frame, Frame[]> = {
  existential: ['psychoanalytic', 'stoic', 'mythic'],
  pragmatic: ['systems', 'stoic', 'adversarial'],
  poetic: ['mythic', 'playful', 'existential'],
  adversarial: ['pragmatic', 'absurdist', 'playful'],
  playful: ['absurdist', 'poetic', 'adversarial'],
  mythic: ['poetic', 'existential', 'psychoanalytic'],
  systems: ['pragmatic', 'psychoanalytic', 'stoic'],
  psychoanalytic: ['existential', 'mythic', 'systems'],
  stoic: ['pragmatic', 'existential', 'systems'],
  absurdist: ['playful', 'adversarial', 'poetic']
};

const SELF_MODEL_FRAME_AFFINITY: Record<SelfModel, Frame[]> = {
  interpreter: ['systems', 'psychoanalytic', 'existential'],
  challenger: ['adversarial', 'absurdist', 'pragmatic'],
  mirror: ['psychoanalytic', 'existential', 'stoic'],
  guide: ['pragmatic', 'mythic', 'stoic'],
  provocateur: ['adversarial', 'absurdist', 'playful'],
  synthesizer: ['systems', 'poetic', 'mythic'],
  witness: ['stoic', 'existential', 'psychoanalytic'],
  autonomous: ['pragmatic', 'systems', 'adversarial'],
  emergent: ['playful', 'poetic', 'absurdist'],
  sovereign: ['stoic', 'existential', 'mythic']
};

export class RecommendationEngine {
  private config: RecommendationConfig;
  private userProfiles: Map<string, UserProfile> = new Map();
  private templateDatabase: Map<string, Stance> = new Map();
  private recommendationHistory: Recommendation[] = [];

  constructor(config?: Partial<RecommendationConfig>) {
    this.config = {
      maxRecommendations: 5,
      diversityWeight: 0.3,
      recencyWeight: 0.2,
      collaborativeWeight: 0.3,
      contentWeight: 0.4,
      contextualWeight: 0.3,
      minConfidence: 30,
      ...config
    };
  }

  generateRecommendations(
    currentStance: Stance,
    userProfile: UserProfile,
    context?: ContextualFactors
  ): RecommendationResult {
    const startTime = Date.now();
    const recommendations: Recommendation[] = [];

    // Content-based recommendations
    const contentRecs = this.generateContentBasedRecommendations(currentStance, userProfile);
    recommendations.push(...contentRecs);

    // Collaborative filtering recommendations
    const collabRecs = this.generateCollaborativeRecommendations(currentStance, userProfile);
    recommendations.push(...collabRecs);

    // Contextual recommendations
    if (context) {
      const contextRecs = this.generateContextualRecommendations(currentStance, context, userProfile);
      recommendations.push(...contextRecs);
    }

    // Exploration recommendations
    const explorationRecs = this.generateExplorationRecommendations(currentStance, userProfile);
    recommendations.push(...explorationRecs);

    // Score and rank recommendations
    const scoredRecs = this.scoreAndRank(recommendations, currentStance, userProfile);

    // Apply diversity filter
    const diverseRecs = this.applyDiversityFilter(scoredRecs);

    // Filter by confidence and limit
    const finalRecs = diverseRecs
      .filter(r => r.confidence >= this.config.minConfidence)
      .slice(0, this.config.maxRecommendations);

    // Record history
    this.recommendationHistory.push(...finalRecs);
    if (this.recommendationHistory.length > 500) {
      this.recommendationHistory = this.recommendationHistory.slice(-250);
    }

    const generationTime = Date.now() - startTime;

    return {
      recommendations: finalRecs,
      diversityIndex: this.calculateDiversityIndex(finalRecs),
      coverageScore: this.calculateCoverageScore(finalRecs, userProfile),
      generationTime
    };
  }

  private generateContentBasedRecommendations(
    currentStance: Stance,
    userProfile: UserProfile
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommend similar frames
    const similarFrames = FRAME_SIMILARITY[currentStance.frame] || [];
    for (const frame of similarFrames) {
      if (!userProfile.preferences.avoidedFrames.includes(frame)) {
        recommendations.push({
          id: `rec-frame-${frame}-${Date.now()}`,
          type: 'frame',
          target: { frame, description: `Similar to ${currentStance.frame}` },
          confidence: 70,
          reasoning: [`Frame ${frame} is conceptually related to ${currentStance.frame}`],
          relevanceScore: 0.7,
          noveltyScore: this.calculateNovelty(frame, userProfile),
          diversityScore: 0.5,
          timestamp: new Date()
        });
      }
    }

    // Recommend value adjustments based on history
    const avgValues = this.calculateAverageValues(userProfile.stanceHistory);
    const valueAdjustments = this.suggestValueAdjustments(currentStance.values, avgValues);
    if (Object.keys(valueAdjustments).length > 0) {
      recommendations.push({
        id: `rec-values-${Date.now()}`,
        type: 'value-adjustment',
        target: { values: valueAdjustments, description: 'Align with your typical preferences' },
        confidence: 60,
        reasoning: ['Based on your historical value patterns'],
        relevanceScore: 0.6,
        noveltyScore: 0.3,
        diversityScore: 0.4,
        timestamp: new Date()
      });
    }

    // Recommend self-model based on frame affinity
    const affineSelfModels = Object.entries(SELF_MODEL_FRAME_AFFINITY)
      .filter(([_, frames]) => frames.includes(currentStance.frame))
      .map(([model]) => model as SelfModel);

    for (const selfModel of affineSelfModels.slice(0, 2)) {
      if (selfModel !== currentStance.selfModel) {
        recommendations.push({
          id: `rec-selfmodel-${selfModel}-${Date.now()}`,
          type: 'self-model',
          target: { selfModel, description: `Complements ${currentStance.frame} frame` },
          confidence: 55,
          reasoning: [`${selfModel} self-model has affinity with ${currentStance.frame} frame`],
          relevanceScore: 0.55,
          noveltyScore: 0.6,
          diversityScore: 0.5,
          timestamp: new Date()
        });
      }
    }

    return recommendations;
  }

  private generateCollaborativeRecommendations(
    _currentStance: Stance,
    userProfile: UserProfile
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Find similar users (simplified - in production would use actual user data)
    const affinities = userProfile.affinities.filter(a => a.score > 50);

    for (const affinity of affinities.slice(0, 3)) {
      if (affinity.itemType === 'frame') {
        recommendations.push({
          id: `rec-collab-${affinity.item}-${Date.now()}`,
          type: 'frame',
          target: { frame: affinity.item as Frame, description: 'Based on your positive interactions' },
          confidence: Math.min(90, affinity.score),
          reasoning: [`You've interacted positively with ${affinity.item} ${affinity.interactions} times`],
          relevanceScore: affinity.score / 100,
          noveltyScore: 0.2,
          diversityScore: 0.3,
          timestamp: new Date()
        });
      }
    }

    return recommendations;
  }

  private generateContextualRecommendations(
    currentStance: Stance,
    context: ContextualFactors,
    _userProfile: UserProfile
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Time-based recommendations
    const timeFrames: Record<string, Frame[]> = {
      morning: ['pragmatic', 'systems', 'stoic'],
      afternoon: ['adversarial', 'playful', 'absurdist'],
      evening: ['poetic', 'mythic', 'existential'],
      night: ['psychoanalytic', 'existential', 'stoic']
    };

    const suggestedFrames = timeFrames[context.timeOfDay] || [];
    for (const frame of suggestedFrames) {
      if (frame !== currentStance.frame) {
        recommendations.push({
          id: `rec-time-${frame}-${Date.now()}`,
          type: 'frame',
          target: { frame, description: `Suited for ${context.timeOfDay}` },
          confidence: 40,
          reasoning: [`${frame} frame is often effective during ${context.timeOfDay}`],
          relevanceScore: 0.4,
          noveltyScore: 0.5,
          diversityScore: 0.6,
          timestamp: new Date()
        });
      }
    }

    // Activity-based recommendations
    if (context.recentActivity === 'exploring') {
      recommendations.push({
        id: `rec-explore-${Date.now()}`,
        type: 'exploration',
        target: { description: 'Continue exploring with a contrasting perspective' },
        confidence: 50,
        reasoning: ['You appear to be in exploration mode'],
        relevanceScore: 0.5,
        noveltyScore: 0.8,
        diversityScore: 0.7,
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  private generateExplorationRecommendations(
    currentStance: Stance,
    userProfile: UserProfile
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check exploration tendency
    if (userProfile.preferences.explorationTendency > 50) {
      // Recommend unexplored frames
      const exploredFrames = new Set(userProfile.stanceHistory.map(h => h.stance.frame));
      const allFrames: Frame[] = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
      const unexploredFrames = allFrames.filter(f => !exploredFrames.has(f));

      for (const frame of unexploredFrames.slice(0, 2)) {
        recommendations.push({
          id: `rec-unexplored-${frame}-${Date.now()}`,
          type: 'exploration',
          target: { frame, description: 'New territory to explore' },
          confidence: 45,
          reasoning: [`You haven't explored ${frame} frame yet`],
          relevanceScore: 0.45,
          noveltyScore: 1.0,
          diversityScore: 0.9,
          timestamp: new Date()
        });
      }
    }

    // Recommend complementary stance
    const complementaryFrame = this.findComplementaryFrame(currentStance.frame);
    if (complementaryFrame) {
      recommendations.push({
        id: `rec-complement-${Date.now()}`,
        type: 'complementary',
        target: { frame: complementaryFrame, description: 'Offers a balancing perspective' },
        confidence: 55,
        reasoning: [`${complementaryFrame} provides balance to ${currentStance.frame}`],
        relevanceScore: 0.55,
        noveltyScore: 0.6,
        diversityScore: 0.8,
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  private findComplementaryFrame(frame: Frame): Frame | undefined {
    const complements: Record<Frame, Frame> = {
      existential: 'playful',
      pragmatic: 'poetic',
      poetic: 'pragmatic',
      adversarial: 'stoic',
      playful: 'existential',
      mythic: 'systems',
      systems: 'mythic',
      psychoanalytic: 'absurdist',
      stoic: 'adversarial',
      absurdist: 'psychoanalytic'
    };
    return complements[frame];
  }

  private scoreAndRank(
    recommendations: Recommendation[],
    _currentStance: Stance,
    _userProfile: UserProfile
  ): Recommendation[] {
    // Calculate composite scores
    for (const rec of recommendations) {
      const contentScore = rec.relevanceScore * this.config.contentWeight;
      const diversityScore = rec.diversityScore * this.config.diversityWeight;
      const noveltyScore = rec.noveltyScore * this.config.recencyWeight;

      // Update confidence based on composite
      const compositeScore = (contentScore + diversityScore + noveltyScore) /
        (this.config.contentWeight + this.config.diversityWeight + this.config.recencyWeight);
      rec.confidence = Math.min(100, rec.confidence * (0.5 + compositeScore * 0.5));
    }

    // Sort by confidence descending
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  private applyDiversityFilter(recommendations: Recommendation[]): Recommendation[] {
    const selected: Recommendation[] = [];
    const selectedTypes = new Set<RecommendationType>();
    const selectedFrames = new Set<Frame>();

    for (const rec of recommendations) {
      // Ensure type diversity
      const typeCount = [...selectedTypes].filter(t => t === rec.type).length;
      const framePenalty = rec.target.frame && selectedFrames.has(rec.target.frame) ? 0.5 : 1;

      if (typeCount < 2 && framePenalty === 1) {
        selected.push(rec);
        selectedTypes.add(rec.type);
        if (rec.target.frame) {
          selectedFrames.add(rec.target.frame);
        }
      } else if (rec.confidence > 70) {
        // Allow high-confidence duplicates
        rec.confidence *= framePenalty;
        selected.push(rec);
      }

      if (selected.length >= this.config.maxRecommendations * 2) break;
    }

    return selected;
  }

  private calculateNovelty(frame: Frame, userProfile: UserProfile): number {
    const frameHistory = userProfile.stanceHistory.filter(h => h.stance.frame === frame);
    if (frameHistory.length === 0) return 1.0;

    const recency = Date.now() - (frameHistory[frameHistory.length - 1]?.timestamp.getTime() || 0);
    const daysSince = recency / (1000 * 60 * 60 * 24);
    return Math.min(1, daysSince / 30); // Max novelty after 30 days
  }

  private calculateAverageValues(history: StanceHistoryEntry[]): Values {
    if (history.length === 0) {
      return { curiosity: 50, certainty: 50, risk: 50, novelty: 50, empathy: 50, provocation: 50, synthesis: 50 };
    }

    const sum: Values = { curiosity: 0, certainty: 0, risk: 0, novelty: 0, empathy: 0, provocation: 0, synthesis: 0 };

    for (const entry of history) {
      for (const key of Object.keys(sum) as (keyof Values)[]) {
        sum[key] += entry.stance.values[key] || 0;
      }
    }

    for (const key of Object.keys(sum) as (keyof Values)[]) {
      sum[key] = Math.round(sum[key] / history.length);
    }

    return sum;
  }

  private suggestValueAdjustments(current: Values, target: Values): Partial<Values> {
    const adjustments: Partial<Values> = {};
    const threshold = 15;

    for (const key of Object.keys(current) as (keyof Values)[]) {
      const diff = target[key] - current[key];
      if (Math.abs(diff) > threshold) {
        adjustments[key] = Math.round(current[key] + diff * 0.3);
      }
    }

    return adjustments;
  }

  private calculateDiversityIndex(recommendations: Recommendation[]): number {
    if (recommendations.length <= 1) return 1;

    const types = new Set(recommendations.map(r => r.type));
    const frames = new Set(recommendations.filter(r => r.target.frame).map(r => r.target.frame));

    const typeRatio = types.size / recommendations.length;
    const frameRatio = frames.size / recommendations.filter(r => r.target.frame).length || 1;

    return (typeRatio + frameRatio) / 2;
  }

  private calculateCoverageScore(recommendations: Recommendation[], _userProfile: UserProfile): number {
    const hasFrame = recommendations.some(r => r.type === 'frame');
    const hasValues = recommendations.some(r => r.type === 'value-adjustment');
    const hasExploration = recommendations.some(r => r.type === 'exploration');
    const hasSelfModel = recommendations.some(r => r.type === 'self-model');

    const coverage = [hasFrame, hasValues, hasExploration, hasSelfModel].filter(Boolean).length;
    return coverage / 4;
  }

  registerTemplate(id: string, stance: Stance): void {
    this.templateDatabase.set(id, stance);
  }

  updateUserProfile(profile: UserProfile): void {
    this.userProfiles.set(profile.userId, profile);
  }

  recordInteraction(userId: string, item: string, itemType: 'frame' | 'template' | 'value' | 'self-model', positive: boolean): void {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;

    const existingAffinity = profile.affinities.find(a => a.item === item && a.itemType === itemType);
    if (existingAffinity) {
      existingAffinity.score = Math.max(-100, Math.min(100, existingAffinity.score + (positive ? 10 : -10)));
      existingAffinity.interactions++;
    } else {
      profile.affinities.push({
        item,
        itemType,
        score: positive ? 30 : -30,
        interactions: 1
      });
    }
  }

  getConfig(): RecommendationConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<RecommendationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getRecommendationHistory(): Recommendation[] {
    return [...this.recommendationHistory];
  }

  clearHistory(): void {
    this.recommendationHistory = [];
  }
}

export function createRecommendationEngine(config?: Partial<RecommendationConfig>): RecommendationEngine {
  return new RecommendationEngine(config);
}
