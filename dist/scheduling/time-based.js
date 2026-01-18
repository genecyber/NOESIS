/**
 * Time-Based Stance Scheduling
 *
 * Cron-like scheduling system for automated stance transitions,
 * recurring patterns, and calendar-based profiles.
 */
const PATTERN_TEMPLATES = {
    'daily-cycle': { description: 'Morning focus, afternoon creativity, evening reflection', defaultInterval: 360, phases: 3 },
    'weekly-cycle': { description: 'Week-based rhythm with weekend reset', defaultInterval: 1440, phases: 7 },
    'pomodoro': { description: '25 min focus, 5 min break cycles', defaultInterval: 30, phases: 2 },
    'energy-wave': { description: 'High and low energy alternation', defaultInterval: 90, phases: 4 },
    'creativity-burst': { description: 'Creative peaks followed by integration', defaultInterval: 120, phases: 3 }
};
export class StanceScheduler {
    transitions = new Map();
    profiles = new Map();
    patterns = new Map();
    checkInterval = 60000; // Check every minute
    timer = null;
    onTransitionCallback;
    constructor() {
        this.initializeDefaultProfiles();
    }
    initializeDefaultProfiles() {
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
                frame: 'philosophical',
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
                frame: 'poetic',
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
    getTimeContext(date = new Date()) {
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
    getSeason(month) {
        if (month >= 2 && month <= 4)
            return 'spring';
        if (month >= 5 && month <= 7)
            return 'summer';
        if (month >= 8 && month <= 10)
            return 'autumn';
        return 'winter';
    }
    createTransition(name, schedule, toStance, options = {}) {
        const transition = {
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
    calculateNextTrigger(schedule, from = new Date()) {
        const next = new Date(from);
        next.setSeconds(0);
        next.setMilliseconds(0);
        // Simple implementation - find next matching time
        for (let i = 0; i < 60 * 24 * 7; i++) { // Check up to a week ahead
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
    matchesCron(schedule, date) {
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
    matchCronField(field, value) {
        if (field === '*')
            return true;
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
    enableTransition(id) {
        const transition = this.transitions.get(id);
        if (!transition)
            return false;
        transition.enabled = true;
        transition.nextTrigger = this.calculateNextTrigger(transition.schedule);
        return true;
    }
    disableTransition(id) {
        const transition = this.transitions.get(id);
        if (!transition)
            return false;
        transition.enabled = false;
        return true;
    }
    removeTransition(id) {
        return this.transitions.delete(id);
    }
    getTransitions() {
        return Array.from(this.transitions.values());
    }
    getActiveTransitions() {
        return this.getTransitions().filter(t => t.enabled);
    }
    addProfile(profile) {
        this.profiles.set(profile.id, profile);
    }
    removeProfile(id) {
        return this.profiles.delete(id);
    }
    getProfiles() {
        return Array.from(this.profiles.values());
    }
    getActiveProfile(context = this.getTimeContext()) {
        const activeProfiles = Array.from(this.profiles.values())
            .filter(profile => this.profileMatchesTime(profile, context))
            .sort((a, b) => b.priority - a.priority);
        return activeProfiles[0] || null;
    }
    profileMatchesTime(profile, context) {
        return profile.timeRanges.some(range => range.days.includes(context.dayOfWeek) &&
            context.hour >= range.startHour &&
            context.hour < range.endHour);
    }
    createPattern(name, patternType, stanceSequence, interval) {
        const template = PATTERN_TEMPLATES[patternType];
        const pattern = {
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
    generateDefaultSequence(patternType) {
        const baseSequence = [];
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
    advancePattern(patternId) {
        const pattern = this.patterns.get(patternId);
        if (!pattern)
            return null;
        pattern.currentIndex = (pattern.currentIndex + 1) % pattern.stanceSequence.length;
        pattern.lastAdvanced = new Date();
        return pattern.stanceSequence[pattern.currentIndex];
    }
    getCurrentPatternStance(patternId) {
        const pattern = this.patterns.get(patternId);
        if (!pattern)
            return null;
        return pattern.stanceSequence[pattern.currentIndex];
    }
    getPatterns() {
        return Array.from(this.patterns.values());
    }
    removePattern(id) {
        return this.patterns.delete(id);
    }
    onTransition(callback) {
        this.onTransitionCallback = callback;
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            this.checkScheduledTransitions();
        }, this.checkInterval);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    checkScheduledTransitions() {
        const now = new Date();
        const context = this.getTimeContext(now);
        for (const transition of this.transitions.values()) {
            if (!transition.enabled)
                continue;
            if (!transition.nextTrigger)
                continue;
            if (now >= transition.nextTrigger) {
                transition.lastTriggered = now;
                transition.nextTrigger = this.calculateNextTrigger(transition.schedule, now);
                if (this.onTransitionCallback) {
                    this.onTransitionCallback(transition, context);
                }
            }
        }
    }
    checkNow() {
        const triggered = [];
        const now = new Date();
        const context = this.getTimeContext(now);
        for (const transition of this.transitions.values()) {
            if (!transition.enabled)
                continue;
            if (!transition.nextTrigger)
                continue;
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
    optimizeSchedule(usageHistory) {
        const suggestions = [];
        const rationale = [];
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
        everyMinute: () => ({ minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }),
        everyHour: () => ({ minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }),
        daily: (hour, minute = 0) => ({
            minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '*'
        }),
        weekdays: (hour, minute = 0) => ({
            minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '1-5'
        }),
        weekends: (hour, minute = 0) => ({
            minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: '0,6'
        }),
        weekly: (dayOfWeek, hour, minute = 0) => ({
            minute: minute.toString(), hour: hour.toString(), dayOfMonth: '*', month: '*', dayOfWeek: dayOfWeek.toString()
        })
    };
}
export function createScheduler() {
    return new StanceScheduler();
}
//# sourceMappingURL=time-based.js.map