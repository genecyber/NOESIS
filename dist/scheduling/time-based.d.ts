/**
 * Time-Based Stance Scheduling
 *
 * Cron-like scheduling system for automated stance transitions,
 * recurring patterns, and calendar-based profiles.
 */
import type { Stance } from '../types/index.js';
export interface ScheduledTransition {
    id: string;
    name: string;
    schedule: CronExpression;
    fromStance?: Partial<Stance>;
    toStance: Partial<Stance>;
    enabled: boolean;
    priority: number;
    createdAt: Date;
    lastTriggered?: Date;
    nextTrigger?: Date;
}
export interface CronExpression {
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
    timezone?: string;
}
export interface TimeContext {
    localTime: Date;
    dayOfWeek: number;
    hour: number;
    minute: number;
    isWeekend: boolean;
    isWorkHours: boolean;
    season: 'spring' | 'summer' | 'autumn' | 'winter';
}
export interface CalendarProfile {
    id: string;
    name: string;
    timeRanges: TimeRange[];
    stanceModifiers: Partial<Stance>;
    priority: number;
}
export interface TimeRange {
    startHour: number;
    endHour: number;
    days: number[];
}
export interface RecurringPattern {
    id: string;
    name: string;
    pattern: PatternType;
    stanceSequence: Partial<Stance>[];
    currentIndex: number;
    interval: number;
    lastAdvanced?: Date;
}
export type PatternType = 'daily-cycle' | 'weekly-cycle' | 'pomodoro' | 'energy-wave' | 'creativity-burst';
export interface ScheduleOptimization {
    suggestedChanges: ScheduleChange[];
    rationale: string[];
    expectedImprovement: number;
}
export interface ScheduleChange {
    transitionId: string;
    field: 'schedule' | 'priority' | 'toStance';
    currentValue: unknown;
    suggestedValue: unknown;
    reason: string;
}
export declare class StanceScheduler {
    private transitions;
    private profiles;
    private patterns;
    private checkInterval;
    private timer;
    private onTransitionCallback?;
    constructor();
    private initializeDefaultProfiles;
    getTimeContext(date?: Date): TimeContext;
    private getSeason;
    createTransition(name: string, schedule: CronExpression, toStance: Partial<Stance>, options?: {
        fromStance?: Partial<Stance>;
        priority?: number;
    }): ScheduledTransition;
    private calculateNextTrigger;
    private matchesCron;
    private matchCronField;
    enableTransition(id: string): boolean;
    disableTransition(id: string): boolean;
    removeTransition(id: string): boolean;
    getTransitions(): ScheduledTransition[];
    getActiveTransitions(): ScheduledTransition[];
    addProfile(profile: CalendarProfile): void;
    removeProfile(id: string): boolean;
    getProfiles(): CalendarProfile[];
    getActiveProfile(context?: TimeContext): CalendarProfile | null;
    private profileMatchesTime;
    createPattern(name: string, patternType: PatternType, stanceSequence: Partial<Stance>[], interval?: number): RecurringPattern;
    private generateDefaultSequence;
    advancePattern(patternId: string): Partial<Stance> | null;
    getCurrentPatternStance(patternId: string): Partial<Stance> | null;
    getPatterns(): RecurringPattern[];
    removePattern(id: string): boolean;
    onTransition(callback: (transition: ScheduledTransition, context: TimeContext) => void): void;
    start(): void;
    stop(): void;
    private checkScheduledTransitions;
    checkNow(): ScheduledTransition[];
    optimizeSchedule(usageHistory: Date[]): ScheduleOptimization;
    static cron: {
        everyMinute: () => CronExpression;
        everyHour: () => CronExpression;
        daily: (hour: number, minute?: number) => CronExpression;
        weekdays: (hour: number, minute?: number) => CronExpression;
        weekends: (hour: number, minute?: number) => CronExpression;
        weekly: (dayOfWeek: number, hour: number, minute?: number) => CronExpression;
    };
}
export declare function createScheduler(): StanceScheduler;
//# sourceMappingURL=time-based.d.ts.map