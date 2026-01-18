/**
 * AI-Powered Stance Coaching
 *
 * Personalized stance improvement suggestions, goal-oriented
 * coaching sessions, progress tracking, and learning adaptation.
 */
import type { Stance } from '../types/index.js';
export interface CoachingSession {
    id: string;
    userId: string;
    startedAt: Date;
    lastActivity: Date;
    goals: CoachingGoal[];
    progress: ProgressTracker;
    currentFocus: string;
    recommendations: CoachingRecommendation[];
    exercises: Exercise[];
    learningStyle: LearningStyle;
    status: 'active' | 'paused' | 'completed';
}
export interface CoachingGoal {
    id: string;
    title: string;
    description: string;
    targetMetric: string;
    targetValue: number;
    currentValue: number;
    deadline?: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
    milestones: Milestone[];
}
export interface Milestone {
    id: string;
    title: string;
    targetValue: number;
    achieved: boolean;
    achievedAt?: Date;
}
export interface ProgressTracker {
    overallProgress: number;
    weeklyProgress: number;
    streakDays: number;
    totalSessions: number;
    completedGoals: number;
    skillLevels: Record<string, number>;
    achievements: Achievement[];
}
export interface Achievement {
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
    icon: string;
}
export interface CoachingRecommendation {
    id: string;
    type: RecommendationType;
    title: string;
    description: string;
    action: string;
    rationale: string;
    priority: number;
    effort: 'low' | 'medium' | 'high';
    expectedImprovement: number;
    confidence: number;
    relatedGoal?: string;
}
export type RecommendationType = 'value-adjustment' | 'frame-exploration' | 'identity-strengthening' | 'balance-correction' | 'growth-opportunity' | 'stability-focus' | 'experimentation';
export interface Exercise {
    id: string;
    name: string;
    description: string;
    type: ExerciseType;
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    targetSkill: string;
    instructions: string[];
    completed: boolean;
    completedAt?: Date;
    feedback?: ExerciseFeedback;
}
export type ExerciseType = 'reflection' | 'adjustment' | 'exploration' | 'stabilization' | 'challenge' | 'integration';
export interface ExerciseFeedback {
    rating: number;
    comments: string;
    learnings: string[];
}
export interface LearningStyle {
    preference: 'visual' | 'analytical' | 'experiential' | 'social';
    pacePreference: 'slow' | 'moderate' | 'fast';
    feedbackPreference: 'detailed' | 'summary' | 'metrics-only';
    challengeLevel: 'conservative' | 'balanced' | 'aggressive';
}
export interface WeaknessAnalysis {
    field: string;
    currentLevel: number;
    targetLevel: number;
    gap: number;
    recommendation: string;
    exercises: string[];
}
export interface OptimalPath {
    steps: PathStep[];
    estimatedDuration: number;
    confidence: number;
    alternativePaths: number;
}
export interface PathStep {
    order: number;
    action: string;
    field: string;
    change: number;
    rationale: string;
    duration: number;
}
export interface StanceProfile {
    stance: Stance;
    timestamp: Date;
    sessionId: string;
}
export declare class StanceCoach {
    private sessions;
    private stanceHistory;
    private exerciseLibrary;
    constructor();
    private initializeExerciseLibrary;
    startSession(userId: string, learningStyle?: Partial<LearningStyle>): CoachingSession;
    recordStance(sessionId: string, stance: Stance): void;
    addGoal(sessionId: string, goal: Omit<CoachingGoal, 'id' | 'status' | 'milestones'>): CoachingGoal;
    private generateMilestones;
    analyzeWeaknesses(sessionId: string, stance: Stance): WeaknessAnalysis[];
    private calculateCoherence;
    generateRecommendations(sessionId: string, stance: Stance): CoachingRecommendation[];
    private updateRecommendations;
    calculateOptimalPath(_sessionId: string, _currentStance: Stance, targetGoal: CoachingGoal): OptimalPath;
    assignExercise(sessionId: string, exerciseId?: string): Exercise | null;
    completeExercise(sessionId: string, exerciseId: string, feedback?: ExerciseFeedback): boolean;
    updateGoalProgress(sessionId: string, goalId: string, newValue: number): CoachingGoal | null;
    private grantAchievement;
    private updateProgress;
    adaptToLearningStyle(sessionId: string, style: Partial<LearningStyle>): void;
    getSession(sessionId: string): CoachingSession | undefined;
    getProgress(sessionId: string): ProgressTracker | null;
    pauseSession(sessionId: string): boolean;
    resumeSession(sessionId: string): boolean;
    completeSession(sessionId: string): CoachingSession | null;
    getStanceHistory(sessionId: string): StanceProfile[];
    listSessions(): CoachingSession[];
}
export declare function createStanceCoach(): StanceCoach;
//# sourceMappingURL=stance-coach.d.ts.map