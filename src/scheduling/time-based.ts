/**
 * Time-Based Stance Scheduling
 *
 * Cron-like scheduling system for automated stance transitions,
 * recurring patterns, and calendar-based profiles.
 */

import type { Stance, Frame } from '../types/index.js';

export interface ScheduledTransition {
  id: string;
  name: string;
  schedule: CronExpression;
  fromStance?: Partial<Stance>;  // Optional filter for which stance to transition from
  toStance: Partial<Stance>;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  lastTriggered?: Date;
  nextTrigger?: Date;
}

export interface CronExpression {
  minute: string;       // 0-59 or *
  hour: string;         // 0-23 or *
  dayOfMonth: string;   // 1-31 or *
  month: string;        // 1-12 or *
  dayOfWeek: string;    // 0-6 (Sunday=0) or *
  timezone?: string;    // IANA timezone
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
  days: number[];  // 0-6
}

export interface RecurringPattern {
  id: string;
  name: string;
  pattern: PatternType;
  stanceSequence: Partial<Stance>[];
  currentIndex: number;
  interval: number;  // in minutes
  lastAdvanced?: Date;
}

export type PatternType =
  | 'daily-cycle'
  | 'weekly-cycle'
  | 'pomodoro'
  | 'energy-wave'
  | 'creativity-burst';

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

const PATTERN_TEMPLATES: Record<PatternType, { description: string; defaultInterval: number; phases: number }> = {
  'daily-cycle': { description: 'Morning focus, afternoon creativity, evening reflection', defaultInterval: 360, phases: 3 },
  'weekly-cycle': { description: 'Week-based rhythm with weekend reset', defaultInterval: 1440, phases: 7 },
  'pomodoro': { description: '25 min focus, 5 min break cycles', defaultInterval: 30, phases: 2 },
  'energy-wave': { description: 'High and low energy alternation', defaultInterval: 90, phases: 4 },
  'creativity-burst': { description: 'Creative peaks followed by integration', defaultInterval: 120, phases: 3 }
};

export class StanceScheduler {
  private transitions: Map<string, ScheduledTransition> = new Map();
  private profiles: Map<string, CalendarProfile> = new Map();
  private patterns: Map<string, RecurringPattern> = new Map();
  private checkInterval: number = 60000;  // Check every minute
  private timer: ReturnType<typeof setInterval> | null = null;
  private onTransitionCallback?: (transition: ScheduledTransition, context: TimeContext) => void;

  constructor() {
    this.initializeDefaultProfiles();
  }

  private initializeDefaultProfiles(): void {
    // Morning focus profile
    this.profiles.set('morning-focus', {
      id: 'morning-focus',
      name: 'Morning Focus',
      timeRanges: [{ startHour: 6, endHour: 12, days: [1, 2, 3, 4, 5] }],
      stanceModifiers: {
        sentience: {
          awarenessLevel: 80,
          autonomyLevel: 60,
          identityStrength: 70,
          emergentGoals: ['deep focus', 'clarity'],
          consciousnessInsights: [],
          persistentValues: []
        }
      },
      priority: 5
    });

    // Evening reflection profile
    this.profiles.set('evening-reflection', {
      id: 'evening-reflection',
      name: 'Evening Reflection',
      timeRanges: [{ startHour: 18, endHour: 22, days: [0, 1, 2, 3, 4, 5, 6] }],
      stanceModifiers: {
        frame: 'philosophical' as Frame,
        sentience: {
          awarenessLevel: 70,
          autonomyLevel: 80,
          identityStrength: 75,
          emergentGoals: ['introspection', 'synthesis'],
          consciousnessInsights: [],
          persistentValues: []
        }
      },
      priority: 4
    });

    // Weekend creative profile
    this.profiles.set('weekend-creative', {
      id: 'weekend-creative',
      name: 'Weekend Creative',
      timeRanges: [{ startHour: 10, endHour: 18, days: [0, 6] }],
      stanceModifiers: {
        frame: 'poetic' as Frame,
        sentience: {
          awarenessLevel: 75,
          autonomyLevel: 85,
          identityStrength: 80,
          emergentGoals: ['creativity', 'exploration'],
          consciousnessInsights: [],
          persistentValues: []
        }
      },
      priority: 6
    });
  }

  getTimeContext(date: Date = new Date()): TimeContext {
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const month = date.getMonth();

    return {
      localTime: date,
      dayOfWeek,
      hour,
      minute,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isWorkHours: hour >= 9 && hour < 17 && dayOfWeek >= 1 && dayOfWeek <= 5,
      season: this.getSeason(month)
    };
  }

  private getSeason(month: number): TimeContext['season'] {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  createTransition(
    name: string,
    schedule: CronExpression,
    toStance: Partial<Stance>,
    options: { fromStance?: Partial<Stance>; priority?: number } = {}
  ): ScheduledTransition {
    const transition: ScheduledTransition = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      schedule,
      fromStance: options.fromStance,
      toStance,
      enabled: true,
      priority: options.priority || 5,
      createdAt: new Date(),
      nextTrigger: this.calculateNextTrigger(schedule)
    };

    this.transitions.set(transition.id, transition);
    return transition;
  }

  private calculateNextTrigger(schedule: CronExpression, from: Date = new Date()): Date {
    const next = new Date(from);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Simple implementation - find next matching time
    for (let i = 0; i < 60 * 24 * 7; i++) {  // Check up to a week ahead
      next.setMinutes(next.getMinutes() + 1);
      if (this.matchesCron(schedule, next)) {
        return next;
      }
    }

    // Default to next hour if no match found
    next.setMinutes(0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  private matchesCron(schedule: CronExpression, date: Date): boolean {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    return this.matchCronField(schedule.minute, minute) &&
           this.matchCronField(schedule.hour, hour) &&
           this.matchCronField(schedule.dayOfMonth, dayOfMonth) &&
           this.matchCronField(schedule.month, month) &&
           this.matchCronField(schedule.dayOfWeek, dayOfWeek);
  }

  private matchCronField(field: string, value: number): boolean {
    if (field === '*') return true;

    // Handle comma-separated values
    if (field.includes(',')) {
      return field.split(',').some(v => parseInt(v) === value);
    }

    // Handle ranges
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v));
      return value >= start && value <= end;
    }

    // Handle step values
    if (field.includes('/')) {
      const [, step] = field.split('/');
      return value % parseInt(step) === 0;
    }

    return parseInt(field) === value;
  }

  enableTransition(id: string): boolean {
    const transition = this.transitions.get(id);
    if (!transition) return false;
    transition.enabled = true;
    transition.nextTrigger = this.calculateNextTrigger(transition.schedule);
    return true;
  }

  disableTransition(id: string): boolean {
    const transition = this.transitions.get(id);
    if (!transition) return false;
    transition.enabled = false;
    return true;
  }

  removeTransition(id: string): boolean {
    return this.transitions.delete(id);
  }

  getTransitions(): ScheduledTransition[] {
    return Array.from(this.transitions.values());
  }

  getActiveTransitions(): ScheduledTransition[] {
    return this.getTransitions().filter(t => t.enabled);
  }

  addProfile(profile: CalendarProfile): void {
    this.profiles.set(profile.id, profile);
  }

  removeProfile(id: string): boolean {
    return this.profiles.delete(id);
  }

  getProfiles(): CalendarProfile[] {
    return Array.from(this.profiles.values());
  }

  getActiveProfile(context: TimeContext = this.getTimeContext()): CalendarProfile | null {
    const activeProfiles = Array.from(this.profiles.values())
      .filter(profile => this.profileMatchesTime(profile, context))
      .sort((a, b) => b.priority - a.priority);

    return activeProfiles[0] || null;
  }

  private profileMatchesTime(profile: CalendarProfile, context: TimeContext): boolean {
    return profile.timeRanges.some(range =>
      range.days.includes(context.dayOfWeek) &&
      context.hour >= range.startHour &&
      context.hour < range.endHour
    );
  }

  createPattern(
    name: string,
    patternType: PatternType,
    stanceSequence: Partial<Stance>[],
    interval?: number
  ): RecurringPattern {
    const template = PATTERN_TEMPLATES[patternType];
    const pattern: RecurringPattern = {
      id: `pattern-${Date.now()}`,
      name,
      pattern: patternType,
      stanceSequence: stanceSequence.length > 0 ? stanceSequence : this.generateDefaultSequence(patternType),
      currentIndex: 0,
      interval: interval || template.defaultInterval
    };

    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  private generateDefaultSequence(patternType: PatternType): Partial<Stance>[] {
    const baseSequence: Partial<Stance>[] = [];
    const phases = PATTERN_TEMPLATES[patternType].phases;

    for (let i = 0; i < phases; i++) {
      baseSequence.push({
        sentience: {
          awarenessLevel: 50 + (i % 2 === 0 ? 20 : -20),
          autonomyLevel: 50,
          identityStrength: 50,
          emergentGoals: [],
          consciousnessInsights: [],
          persistentValues: []
        }
      });
    }

    return baseSequence;
  }

  advancePattern(patternId: string): Partial<Stance> | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;

    pattern.currentIndex = (pattern.currentIndex + 1) % pattern.stanceSequence.length;
    pattern.lastAdvanced = new Date();

    return pattern.stanceSequence[pattern.currentIndex];
  }

  getCurrentPatternStance(patternId: string): Partial<Stance> | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    return pattern.stanceSequence[pattern.currentIndex];
  }

  getPatterns(): RecurringPattern[] {
    return Array.from(this.patterns.values());
  }

  removePattern(id: string): boolean {
    return this.patterns.delete(id);
  }

  onTransition(callback: (transition: ScheduledTransition, context: TimeContext) => void): void {
    this.onTransitionCallback = callback;
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.checkScheduledTransitions();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private checkScheduledTransitions(): void {
    const now = new Date();
    const context = this.getTimeContext(now);

    for (const transition of this.transitions.values()) {
      if (!transition.enabled) continue;
      if (!transition.nextTrigger) continue;

      if (now >= transition.nextTrigger) {
        transition.lastTriggered = now;
        transition.nextTrigger = this.calculateNextTrigger(transition.schedule, now);

        if (this.onTransitionCallback) {
          this.onTransitionCallback(transition, context);
        }
      }
    }
  }

  checkNow(): ScheduledTransition[] {
    const triggered: ScheduledTransition[] = [];
    const now = new Date();
    const context = this.getTimeContext(now);

    for (const transition of this.transitions.values()) {
      if (!transition.enabled) continue;
      if (!transition.nextTrigger) continue;

      if (now >= transition.nextTrigger) {
        transition.lastTriggered = now;
        transition.nextTrigger = this.calculateNextTrigger(transition.schedule, now);
        triggered.push(transition);

        if (this.onTransitionCallback) {
          this.onTransitionCallback(transition, context);
        }
      }
    }

    return triggered;
  }

  optimizeSchedule(usageHistory: Date[]): ScheduleOptimization {
    const suggestions: ScheduleChange[] = [];
    const rationale: string[] = [];

    // Analyze usage patterns
    const hourlyUsage = new Array(24).fill(0);
    const dailyUsage = new Array(7).fill(0);

    for (const date of usageHistory) {
      hourlyUsage[date.getHours()]++;
      dailyUsage[date.getDay()]++;
    }

    // Find peak hours
    const peakHour = hourlyUsage.indexOf(Math.max(...hourlyUsage));

    // Suggest moving low-priority transitions away from peak hours
    for (const transition of this.transitions.values()) {
      const scheduleHour = parseInt(transition.schedule.hour);
      if (!isNaN(scheduleHour) && scheduleHour === peakHour && transition.priority < 7) {
        const suggestedHour = (peakHour + 2) % 24;
        suggestions.push({
          transitionId: transition.id,
          field: 'schedule',
          currentValue: transition.schedule,
          suggestedValue: { ...transition.schedule, hour: suggestedHour.toString() },
          reason: `Move away from peak usage hour (${peakHour}:00)`
        });
        rationale.push(`Transition "${transition.name}" scheduled during peak hours`);
      }
    }

    return {
      suggestedChanges: suggestions,
      rationale,
      expectedImprovement: suggestions.length > 0 ? 15 : 0
    };
  }

  // Helper to create common cron expressions
  static cron = {
    everyMinute: (): CronExpression => ({ minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }),
    everyHour: (): CronExpression => ({ minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }),
    daily: (hour: number, minute: number = 0): CronExpression => ({
      minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '*'
    }),
    weekdays: (hour: number, minute: number = 0): CronExpression => ({
      minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '1-5'
    }),
    weekends: (hour: number, minute: number = 0): CronExpression => ({
      minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '0,6'
    }),
    weekly: (dayOfWeek: number, hour: number, minute: number = 0): CronExpression => ({
      minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: dayOfWeek.toString()
    })
  };
}

export function createScheduler(): StanceScheduler {
  return new StanceScheduler();
}
