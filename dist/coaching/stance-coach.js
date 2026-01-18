/**
 * AI-Powered Stance Coaching
 *
 * Personalized stance improvement suggestions, goal-oriented
 * coaching sessions, progress tracking, and learning adaptation.
 */
const FRAME_SYNERGIES = {
    'existential': ['mythic', 'psychoanalytic', 'absurdist'],
    'pragmatic': ['systems', 'stoic'],
    'poetic': ['mythic', 'playful', 'existential'],
    'adversarial': ['stoic', 'psychoanalytic'],
    'playful': ['poetic', 'absurdist'],
    'mythic': ['existential', 'poetic'],
    'systems': ['pragmatic', 'stoic'],
    'psychoanalytic': ['existential', 'adversarial'],
    'stoic': ['pragmatic', 'systems', 'adversarial'],
    'absurdist': ['playful', 'existential']
};
const VALUE_DESCRIPTIONS = {
    curiosity: {
        low: 'May miss opportunities for growth',
        high: 'Risk of distraction and shallow exploration',
        optimal: 'Balanced inquiry drives meaningful discovery'
    },
    certainty: {
        low: 'Indecision may slow progress',
        high: 'Overconfidence may blind to alternatives',
        optimal: 'Confident yet open to revision'
    },
    risk: {
        low: 'Excessive caution limits growth',
        high: 'Recklessness may cause setbacks',
        optimal: 'Calculated risks drive innovation'
    },
    novelty: {
        low: 'Routine may lead to stagnation',
        high: 'Constant change prevents mastery',
        optimal: 'Fresh approaches enhance established skills'
    },
    empathy: {
        low: 'Disconnection from context',
        high: 'May lose objective perspective',
        optimal: 'Understanding enhances communication'
    },
    provocation: {
        low: 'May miss growth through challenge',
        high: 'Constant friction exhausts',
        optimal: 'Strategic challenges spark insight'
    },
    synthesis: {
        low: 'Fragmented understanding',
        high: 'May oversimplify complexity',
        optimal: 'Integration reveals patterns'
    }
};
export class StanceCoach {
    sessions = new Map();
    stanceHistory = new Map();
    exerciseLibrary = [];
    constructor() {
        this.initializeExerciseLibrary();
    }
    initializeExerciseLibrary() {
        this.exerciseLibrary = [
            {
                id: 'ex-reflection-basic',
                name: 'Value Reflection',
                description: 'Reflect on your current value settings and their effects',
                type: 'reflection',
                duration: 10,
                difficulty: 'beginner',
                targetSkill: 'self-awareness',
                instructions: [
                    'Review your current value weights',
                    'Identify which values feel most/least aligned',
                    'Note any tension between values'
                ],
                completed: false
            },
            {
                id: 'ex-frame-explore',
                name: 'Frame Exploration',
                description: 'Experiment with a different cognitive frame',
                type: 'exploration',
                duration: 15,
                difficulty: 'intermediate',
                targetSkill: 'flexibility',
                instructions: [
                    'Choose a frame different from your default',
                    'Apply this frame to a familiar problem',
                    'Note new insights that emerge'
                ],
                completed: false
            },
            {
                id: 'ex-balance-check',
                name: 'Balance Assessment',
                description: 'Evaluate the balance of your value configuration',
                type: 'stabilization',
                duration: 10,
                difficulty: 'beginner',
                targetSkill: 'coherence',
                instructions: [
                    'Calculate the variance in your values',
                    'Identify extreme values (below 20 or above 80)',
                    'Consider if extremes serve your goals'
                ],
                completed: false
            },
            {
                id: 'ex-challenge-comfort',
                name: 'Comfort Zone Challenge',
                description: 'Push beyond your usual stance boundaries',
                type: 'challenge',
                duration: 20,
                difficulty: 'advanced',
                targetSkill: 'growth',
                instructions: [
                    'Identify your most "comfortable" stance settings',
                    'Intentionally adjust them by 20-30 points',
                    'Observe the effects and your reactions'
                ],
                completed: false
            },
            {
                id: 'ex-integration',
                name: 'Value Integration',
                description: 'Practice holding seemingly opposing values',
                type: 'integration',
                duration: 15,
                difficulty: 'advanced',
                targetSkill: 'synthesis',
                instructions: [
                    'Choose two values that seem to conflict',
                    'Find a perspective where both can coexist',
                    'Adjust settings to embody this integration'
                ],
                completed: false
            }
        ];
    }
    startSession(userId, learningStyle) {
        const sessionId = `coach-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const session = {
            id: sessionId,
            userId,
            startedAt: new Date(),
            lastActivity: new Date(),
            goals: [],
            progress: {
                overallProgress: 0,
                weeklyProgress: 0,
                streakDays: 0,
                totalSessions: 1,
                completedGoals: 0,
                skillLevels: {
                    'self-awareness': 50,
                    'flexibility': 50,
                    'coherence': 50,
                    'growth': 50,
                    'synthesis': 50
                },
                achievements: []
            },
            currentFocus: 'initial-assessment',
            recommendations: [],
            exercises: [],
            learningStyle: {
                preference: 'analytical',
                pacePreference: 'moderate',
                feedbackPreference: 'detailed',
                challengeLevel: 'balanced',
                ...learningStyle
            },
            status: 'active'
        };
        this.sessions.set(sessionId, session);
        this.stanceHistory.set(sessionId, []);
        return session;
    }
    recordStance(sessionId, stance) {
        const history = this.stanceHistory.get(sessionId) || [];
        history.push({
            stance: JSON.parse(JSON.stringify(stance)),
            timestamp: new Date(),
            sessionId
        });
        this.stanceHistory.set(sessionId, history);
        // Update session activity
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }
    addGoal(sessionId, goal) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error('Session not found');
        const fullGoal = {
            id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            ...goal,
            status: 'not_started',
            milestones: this.generateMilestones(goal.currentValue, goal.targetValue)
        };
        session.goals.push(fullGoal);
        session.lastActivity = new Date();
        // Generate recommendations for new goal
        this.updateRecommendations(sessionId);
        return fullGoal;
    }
    generateMilestones(current, target) {
        const milestones = [];
        const diff = target - current;
        const steps = Math.ceil(Math.abs(diff) / 20);
        for (let i = 1; i <= Math.min(steps, 5); i++) {
            const progress = (i / steps);
            milestones.push({
                id: `milestone-${i}`,
                title: `${Math.round(progress * 100)}% Progress`,
                targetValue: Math.round(current + diff * progress),
                achieved: false
            });
        }
        return milestones;
    }
    analyzeWeaknesses(sessionId, stance) {
        const analyses = [];
        const session = this.sessions.get(sessionId);
        if (!session)
            return analyses;
        // Analyze values
        const valueKeys = Object.keys(stance.values);
        for (const key of valueKeys) {
            const value = stance.values[key];
            // Identify extremes
            if (value < 20 || value > 80) {
                const isLow = value < 20;
                const desc = VALUE_DESCRIPTIONS[key];
                analyses.push({
                    field: `values.${key}`,
                    currentLevel: value,
                    targetLevel: 50,
                    gap: Math.abs(50 - value),
                    recommendation: isLow ? desc.low : desc.high,
                    exercises: ['ex-balance-check', 'ex-challenge-comfort']
                });
            }
        }
        // Analyze coherence
        const coherence = this.calculateCoherence(stance);
        if (coherence < 60) {
            analyses.push({
                field: 'coherence',
                currentLevel: coherence,
                targetLevel: 70,
                gap: 70 - coherence,
                recommendation: 'Values are highly varied, consider balancing',
                exercises: ['ex-balance-check', 'ex-integration']
            });
        }
        // Analyze sentience
        if (stance.sentience.awarenessLevel < 40) {
            analyses.push({
                field: 'sentience.awarenessLevel',
                currentLevel: stance.sentience.awarenessLevel,
                targetLevel: 60,
                gap: 60 - stance.sentience.awarenessLevel,
                recommendation: 'Low awareness may limit self-insight',
                exercises: ['ex-reflection-basic']
            });
        }
        return analyses;
    }
    calculateCoherence(stance) {
        const values = Object.values(stance.values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.max(0, Math.min(100, 100 - Math.sqrt(variance) * 2));
    }
    generateRecommendations(sessionId, stance) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return [];
        const recommendations = [];
        const weaknesses = this.analyzeWeaknesses(sessionId, stance);
        // Weakness-based recommendations
        for (const weakness of weaknesses) {
            recommendations.push({
                id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                type: 'value-adjustment',
                title: `Address ${weakness.field} imbalance`,
                description: weakness.recommendation,
                action: `Adjust ${weakness.field} toward ${weakness.targetLevel}`,
                rationale: `Current gap of ${weakness.gap} points affects overall balance`,
                priority: weakness.gap > 40 ? 3 : weakness.gap > 20 ? 2 : 1,
                effort: weakness.gap > 40 ? 'high' : 'medium',
                expectedImprovement: Math.min(20, weakness.gap),
                confidence: 0.8
            });
        }
        // Goal-based recommendations
        for (const goal of session.goals.filter(g => g.status === 'in_progress')) {
            const gap = goal.targetValue - goal.currentValue;
            if (Math.abs(gap) > 10) {
                recommendations.push({
                    id: `rec-goal-${goal.id}`,
                    type: 'growth-opportunity',
                    title: `Progress toward: ${goal.title}`,
                    description: goal.description,
                    action: `Move ${goal.targetMetric} by ${Math.sign(gap) * Math.min(10, Math.abs(gap))}`,
                    rationale: `${Math.round((goal.currentValue / goal.targetValue) * 100)}% complete`,
                    priority: goal.priority === 'critical' ? 4 : goal.priority === 'high' ? 3 : 2,
                    effort: Math.abs(gap) > 30 ? 'high' : 'medium',
                    expectedImprovement: Math.min(10, Math.abs(gap)),
                    confidence: 0.7,
                    relatedGoal: goal.id
                });
            }
        }
        // Frame exploration recommendation
        const synergisticFrames = FRAME_SYNERGIES[stance.frame];
        if (synergisticFrames && synergisticFrames.length > 0) {
            const suggestedFrame = synergisticFrames[Math.floor(Math.random() * synergisticFrames.length)];
            recommendations.push({
                id: `rec-frame-explore`,
                type: 'frame-exploration',
                title: `Explore ${suggestedFrame} frame`,
                description: `Your current ${stance.frame} frame pairs well with ${suggestedFrame}`,
                action: `Try switching to ${suggestedFrame} frame for new perspective`,
                rationale: 'Frame synergy can unlock new insights',
                priority: 1,
                effort: 'low',
                expectedImprovement: 5,
                confidence: 0.6
            });
        }
        // Sort by priority
        recommendations.sort((a, b) => b.priority - a.priority);
        session.recommendations = recommendations;
        return recommendations.slice(0, 5);
    }
    updateRecommendations(sessionId) {
        const history = this.stanceHistory.get(sessionId);
        if (history && history.length > 0) {
            const latestStance = history[history.length - 1].stance;
            this.generateRecommendations(sessionId, latestStance);
        }
    }
    calculateOptimalPath(_sessionId, _currentStance, targetGoal) {
        const steps = [];
        // Parse target metric
        const parts = targetGoal.targetMetric.split('.');
        const field = parts[parts.length - 1];
        const gap = targetGoal.targetValue - targetGoal.currentValue;
        const direction = Math.sign(gap);
        // Calculate number of steps (max 10 points per step for stability)
        const numSteps = Math.ceil(Math.abs(gap) / 10);
        const stepSize = gap / numSteps;
        for (let i = 0; i < numSteps; i++) {
            steps.push({
                order: i + 1,
                action: `Adjust ${field}`,
                field: targetGoal.targetMetric,
                change: stepSize,
                rationale: `Step ${i + 1}: Move ${field} ${direction > 0 ? 'up' : 'down'} by ${Math.abs(stepSize).toFixed(0)}`,
                duration: 5 // minutes
            });
        }
        return {
            steps,
            estimatedDuration: steps.reduce((sum, s) => sum + s.duration, 0),
            confidence: 0.75,
            alternativePaths: 2
        };
    }
    assignExercise(sessionId, exerciseId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        let exercise;
        if (exerciseId) {
            const found = this.exerciseLibrary.find(e => e.id === exerciseId);
            if (!found)
                return null;
            exercise = JSON.parse(JSON.stringify(found));
        }
        else {
            // Auto-select based on weaknesses and learning style
            const difficulty = session.learningStyle.challengeLevel === 'aggressive' ? 'advanced' :
                session.learningStyle.challengeLevel === 'conservative' ? 'beginner' : 'intermediate';
            const suitable = this.exerciseLibrary.filter(e => e.difficulty === difficulty && !session.exercises.some(se => se.id === e.id && se.completed));
            if (suitable.length === 0)
                return null;
            exercise = JSON.parse(JSON.stringify(suitable[Math.floor(Math.random() * suitable.length)]));
        }
        exercise.id = `${exercise.id}-${Date.now()}`;
        session.exercises.push(exercise);
        session.lastActivity = new Date();
        return exercise;
    }
    completeExercise(sessionId, exerciseId, feedback) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const exercise = session.exercises.find(e => e.id === exerciseId);
        if (!exercise)
            return false;
        exercise.completed = true;
        exercise.completedAt = new Date();
        exercise.feedback = feedback;
        // Update skill levels
        if (exercise.targetSkill && session.progress.skillLevels[exercise.targetSkill] !== undefined) {
            const improvement = exercise.difficulty === 'advanced' ? 5 :
                exercise.difficulty === 'intermediate' ? 3 : 1;
            session.progress.skillLevels[exercise.targetSkill] = Math.min(100, session.progress.skillLevels[exercise.targetSkill] + improvement);
        }
        // Update overall progress
        this.updateProgress(session);
        return true;
    }
    updateGoalProgress(sessionId, goalId, newValue) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const goal = session.goals.find(g => g.id === goalId);
        if (!goal)
            return null;
        goal.currentValue = newValue;
        // Check milestones
        for (const milestone of goal.milestones) {
            if (!milestone.achieved && newValue >= milestone.targetValue) {
                milestone.achieved = true;
                milestone.achievedAt = new Date();
                // Grant achievement
                this.grantAchievement(session, {
                    id: `ach-milestone-${milestone.id}`,
                    name: `Milestone Reached: ${milestone.title}`,
                    description: `Achieved ${milestone.title} for ${goal.title}`,
                    earnedAt: new Date(),
                    icon: '🎯'
                });
            }
        }
        // Check goal completion
        if (newValue >= goal.targetValue) {
            goal.status = 'completed';
            session.progress.completedGoals++;
            this.grantAchievement(session, {
                id: `ach-goal-${goal.id}`,
                name: `Goal Completed: ${goal.title}`,
                description: goal.description,
                earnedAt: new Date(),
                icon: '🏆'
            });
        }
        else if (goal.status === 'not_started') {
            goal.status = 'in_progress';
        }
        this.updateProgress(session);
        return goal;
    }
    grantAchievement(session, achievement) {
        if (!session.progress.achievements.some(a => a.id === achievement.id)) {
            session.progress.achievements.push(achievement);
        }
    }
    updateProgress(session) {
        const goals = session.goals;
        if (goals.length === 0) {
            session.progress.overallProgress = 0;
            return;
        }
        const totalProgress = goals.reduce((sum, g) => {
            const goalProgress = g.targetValue !== 0
                ? Math.min(100, (g.currentValue / g.targetValue) * 100)
                : 0;
            return sum + goalProgress;
        }, 0);
        session.progress.overallProgress = Math.round(totalProgress / goals.length);
    }
    adaptToLearningStyle(sessionId, style) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.learningStyle = { ...session.learningStyle, ...style };
        // Regenerate recommendations based on new style
        this.updateRecommendations(sessionId);
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getProgress(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? { ...session.progress } : null;
    }
    pauseSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        session.status = 'paused';
        return true;
    }
    resumeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'paused')
            return false;
        session.status = 'active';
        session.lastActivity = new Date();
        return true;
    }
    completeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        session.status = 'completed';
        // Grant completion achievement
        if (session.progress.overallProgress >= 80) {
            this.grantAchievement(session, {
                id: 'ach-session-complete',
                name: 'Coaching Session Complete',
                description: 'Completed a coaching session with 80%+ progress',
                earnedAt: new Date(),
                icon: '🎓'
            });
        }
        return session;
    }
    getStanceHistory(sessionId) {
        return this.stanceHistory.get(sessionId) || [];
    }
    listSessions() {
        return Array.from(this.sessions.values());
    }
}
export function createStanceCoach() {
    return new StanceCoach();
}
//# sourceMappingURL=stance-coach.js.map