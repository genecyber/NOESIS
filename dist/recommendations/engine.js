/**
 * Stance-Based Recommendation System
 *
 * Intelligent recommendations for stances, frames, values, and templates
 * based on user history, collaborative filtering, and contextual analysis.
 */
const FRAME_SIMILARITY = {
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
const SELF_MODEL_FRAME_AFFINITY = {
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
    config;
    userProfiles = new Map();
    templateDatabase = new Map();
    recommendationHistory = [];
    constructor(config) {
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
    generateRecommendations(currentStance, userProfile, context) {
        const startTime = Date.now();
        const recommendations = [];
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
    generateContentBasedRecommendations(currentStance, userProfile) {
        const recommendations = [];
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
            .map(([model]) => model);
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
    generateCollaborativeRecommendations(_currentStance, userProfile) {
        const recommendations = [];
        // Find similar users (simplified - in production would use actual user data)
        const affinities = userProfile.affinities.filter(a => a.score > 50);
        for (const affinity of affinities.slice(0, 3)) {
            if (affinity.itemType === 'frame') {
                recommendations.push({
                    id: `rec-collab-${affinity.item}-${Date.now()}`,
                    type: 'frame',
                    target: { frame: affinity.item, description: 'Based on your positive interactions' },
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
    generateContextualRecommendations(currentStance, context, _userProfile) {
        const recommendations = [];
        // Time-based recommendations
        const timeFrames = {
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
    generateExplorationRecommendations(currentStance, userProfile) {
        const recommendations = [];
        // Check exploration tendency
        if (userProfile.preferences.explorationTendency > 50) {
            // Recommend unexplored frames
            const exploredFrames = new Set(userProfile.stanceHistory.map(h => h.stance.frame));
            const allFrames = ['existential', 'pragmatic', 'poetic', 'adversarial', 'playful', 'mythic', 'systems', 'psychoanalytic', 'stoic', 'absurdist'];
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
    findComplementaryFrame(frame) {
        const complements = {
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
    scoreAndRank(recommendations, _currentStance, _userProfile) {
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
    applyDiversityFilter(recommendations) {
        const selected = [];
        const selectedTypes = new Set();
        const selectedFrames = new Set();
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
            }
            else if (rec.confidence > 70) {
                // Allow high-confidence duplicates
                rec.confidence *= framePenalty;
                selected.push(rec);
            }
            if (selected.length >= this.config.maxRecommendations * 2)
                break;
        }
        return selected;
    }
    calculateNovelty(frame, userProfile) {
        const frameHistory = userProfile.stanceHistory.filter(h => h.stance.frame === frame);
        if (frameHistory.length === 0)
            return 1.0;
        const recency = Date.now() - (frameHistory[frameHistory.length - 1]?.timestamp.getTime() || 0);
        const daysSince = recency / (1000 * 60 * 60 * 24);
        return Math.min(1, daysSince / 30); // Max novelty after 30 days
    }
    calculateAverageValues(history) {
        if (history.length === 0) {
            return { curiosity: 50, certainty: 50, risk: 50, novelty: 50, empathy: 50, provocation: 50, synthesis: 50 };
        }
        const sum = { curiosity: 0, certainty: 0, risk: 0, novelty: 0, empathy: 0, provocation: 0, synthesis: 0 };
        for (const entry of history) {
            for (const key of Object.keys(sum)) {
                sum[key] += entry.stance.values[key] || 0;
            }
        }
        for (const key of Object.keys(sum)) {
            sum[key] = Math.round(sum[key] / history.length);
        }
        return sum;
    }
    suggestValueAdjustments(current, target) {
        const adjustments = {};
        const threshold = 15;
        for (const key of Object.keys(current)) {
            const diff = target[key] - current[key];
            if (Math.abs(diff) > threshold) {
                adjustments[key] = Math.round(current[key] + diff * 0.3);
            }
        }
        return adjustments;
    }
    calculateDiversityIndex(recommendations) {
        if (recommendations.length <= 1)
            return 1;
        const types = new Set(recommendations.map(r => r.type));
        const frames = new Set(recommendations.filter(r => r.target.frame).map(r => r.target.frame));
        const typeRatio = types.size / recommendations.length;
        const frameRatio = frames.size / recommendations.filter(r => r.target.frame).length || 1;
        return (typeRatio + frameRatio) / 2;
    }
    calculateCoverageScore(recommendations, _userProfile) {
        const hasFrame = recommendations.some(r => r.type === 'frame');
        const hasValues = recommendations.some(r => r.type === 'value-adjustment');
        const hasExploration = recommendations.some(r => r.type === 'exploration');
        const hasSelfModel = recommendations.some(r => r.type === 'self-model');
        const coverage = [hasFrame, hasValues, hasExploration, hasSelfModel].filter(Boolean).length;
        return coverage / 4;
    }
    registerTemplate(id, stance) {
        this.templateDatabase.set(id, stance);
    }
    updateUserProfile(profile) {
        this.userProfiles.set(profile.userId, profile);
    }
    recordInteraction(userId, item, itemType, positive) {
        const profile = this.userProfiles.get(userId);
        if (!profile)
            return;
        const existingAffinity = profile.affinities.find(a => a.item === item && a.itemType === itemType);
        if (existingAffinity) {
            existingAffinity.score = Math.max(-100, Math.min(100, existingAffinity.score + (positive ? 10 : -10)));
            existingAffinity.interactions++;
        }
        else {
            profile.affinities.push({
                item,
                itemType,
                score: positive ? 30 : -30,
                interactions: 1
            });
        }
    }
    getConfig() {
        return { ...this.config };
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getRecommendationHistory() {
        return [...this.recommendationHistory];
    }
    clearHistory() {
        this.recommendationHistory = [];
    }
}
export function createRecommendationEngine(config) {
    return new RecommendationEngine(config);
}
//# sourceMappingURL=engine.js.map