/**
 * Calendar Integration
 *
 * Integrates with Google Calendar and iCal for scheduled
 * stance transitions and event-triggered changes.
 */
function createDefaultValues() {
    return {
        curiosity: 50, certainty: 50, risk: 50,
        novelty: 50, empathy: 50, provocation: 50, synthesis: 50
    };
}
function createDefaultSentience() {
    return {
        awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
        emergentGoals: [],
        consciousnessInsights: [],
        persistentValues: []
    };
}
function createStanceMetadata() {
    return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}
const STANCE_PROFILES = {
    'work-focused': {
        frame: 'systems',
        selfModel: 'synthesizer',
        objective: 'helpfulness',
        values: { ...createDefaultValues(), certainty: 70, synthesis: 65, risk: 30 }
    },
    'creative-session': {
        frame: 'poetic',
        selfModel: 'provocateur',
        objective: 'novelty',
        values: { ...createDefaultValues(), novelty: 80, curiosity: 75, risk: 60 }
    },
    'relaxed-evening': {
        frame: 'playful',
        selfModel: 'guide',
        objective: 'helpfulness',
        values: { ...createDefaultValues(), empathy: 70, provocation: 20 }
    },
    'deep-thinking': {
        frame: 'existential',
        selfModel: 'witness',
        objective: 'synthesis',
        values: { ...createDefaultValues(), curiosity: 85, synthesis: 80 }
    },
    'meeting-mode': {
        frame: 'pragmatic',
        selfModel: 'synthesizer',
        objective: 'helpfulness',
        values: { ...createDefaultValues(), certainty: 65, empathy: 60, risk: 25 }
    }
};
export class CalendarIntegration {
    sources = new Map();
    events = new Map();
    schedules = new Map();
    stanceProfiles = new Map();
    timezone;
    constructor(timezone) {
        this.timezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Register default profiles
        for (const [name, profile] of Object.entries(STANCE_PROFILES)) {
            this.stanceProfiles.set(name, profile);
        }
    }
    addSource(source) {
        const newSource = {
            ...source,
            id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        this.sources.set(newSource.id, newSource);
        return newSource;
    }
    removeSource(sourceId) {
        return this.sources.delete(sourceId);
    }
    async syncSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (!source) {
            return {
                source: sourceId,
                success: false,
                eventsAdded: 0,
                eventsUpdated: 0,
                eventsRemoved: 0,
                errors: ['Source not found'],
                timestamp: new Date()
            };
        }
        // In real implementation, this would call calendar APIs
        // For now, simulate a sync
        const result = {
            source: sourceId,
            success: true,
            eventsAdded: 0,
            eventsUpdated: 0,
            eventsRemoved: 0,
            errors: [],
            timestamp: new Date()
        };
        source.lastSynced = new Date();
        return result;
    }
    async syncAll() {
        const results = [];
        for (const sourceId of this.sources.keys()) {
            const result = await this.syncSource(sourceId);
            results.push(result);
        }
        return results;
    }
    addEvent(event) {
        const newEvent = {
            ...event,
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        this.events.set(newEvent.id, newEvent);
        return newEvent;
    }
    removeEvent(eventId) {
        return this.events.delete(eventId);
    }
    getEventsInRange(start, end) {
        const events = [];
        for (const event of this.events.values()) {
            if (event.start >= start && event.start <= end) {
                events.push(event);
            }
            else if (event.recurrence) {
                const occurrences = this.expandRecurrence(event, start, end);
                events.push(...occurrences);
            }
        }
        return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    expandRecurrence(event, start, end) {
        const occurrences = [];
        const rule = event.recurrence;
        let current = new Date(event.start);
        let count = 0;
        const maxIterations = 1000;
        while (current <= end && count < maxIterations) {
            if (rule.until && current > rule.until)
                break;
            if (rule.count && count >= rule.count)
                break;
            if (current >= start) {
                const duration = event.end.getTime() - event.start.getTime();
                occurrences.push({
                    ...event,
                    id: `${event.id}-${count}`,
                    start: new Date(current),
                    end: new Date(current.getTime() + duration)
                });
            }
            // Advance to next occurrence
            switch (rule.frequency) {
                case 'daily':
                    current.setDate(current.getDate() + rule.interval);
                    break;
                case 'weekly':
                    current.setDate(current.getDate() + 7 * rule.interval);
                    break;
                case 'monthly':
                    current.setMonth(current.getMonth() + rule.interval);
                    break;
                case 'yearly':
                    current.setFullYear(current.getFullYear() + rule.interval);
                    break;
            }
            count++;
        }
        return occurrences;
    }
    addSchedule(schedule) {
        const newSchedule = {
            ...schedule,
            id: `sch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        this.schedules.set(newSchedule.id, newSchedule);
        return newSchedule;
    }
    removeSchedule(scheduleId) {
        return this.schedules.delete(scheduleId);
    }
    getActiveSchedules(at = new Date()) {
        const active = [];
        const events = this.getEventsInRange(new Date(at.getTime() - 24 * 60 * 60 * 1000), new Date(at.getTime() + 24 * 60 * 60 * 1000));
        for (const schedule of this.schedules.values()) {
            if (!schedule.enabled)
                continue;
            if (this.isScheduleActive(schedule, at, events)) {
                active.push(schedule);
            }
        }
        return active.sort((a, b) => b.priority - a.priority);
    }
    isScheduleActive(schedule, at, events) {
        const { trigger } = schedule;
        switch (trigger.type) {
            case 'event-start':
                return events.some(e => this.matchesFilter(e, trigger.eventFilter) &&
                    e.start <= at && e.end > at);
            case 'event-end':
                return events.some(e => this.matchesFilter(e, trigger.eventFilter) &&
                    e.end <= at &&
                    at.getTime() - e.end.getTime() < 30 * 60 * 1000 // Within 30 min of end
                );
            case 'time':
                if (!trigger.time)
                    return false;
                const [hours, minutes] = trigger.time.split(':').map(Number);
                const targetTime = new Date(at);
                targetTime.setHours(hours, minutes, 0, 0);
                return Math.abs(at.getTime() - targetTime.getTime()) < 30 * 60 * 1000;
            case 'recurring':
                // Check if current time matches recurrence
                return this.matchesRecurrence(trigger.recurrence, at);
            default:
                return false;
        }
    }
    matchesFilter(event, filter) {
        if (!filter)
            return true;
        if (filter.titleContains && !event.title.includes(filter.titleContains)) {
            return false;
        }
        if (filter.titleRegex && !new RegExp(filter.titleRegex).test(event.title)) {
            return false;
        }
        if (filter.hasTags && !filter.hasTags.some(t => event.tags.includes(t))) {
            return false;
        }
        return true;
    }
    matchesRecurrence(rule, at) {
        const day = at.getDay();
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        if (rule.byDay && !rule.byDay.includes(dayNames[day])) {
            return false;
        }
        if (rule.byMonth && !rule.byMonth.includes(at.getMonth() + 1)) {
            return false;
        }
        return true;
    }
    getStanceForTime(at = new Date()) {
        const activeSchedules = this.getActiveSchedules(at);
        if (activeSchedules.length === 0)
            return null;
        const topSchedule = activeSchedules[0];
        const profile = this.stanceProfiles.get(topSchedule.stanceProfile);
        if (!profile)
            return null;
        return this.buildStance(profile);
    }
    buildStance(profile) {
        return {
            frame: profile.frame || 'pragmatic',
            values: profile.values || createDefaultValues(),
            selfModel: profile.selfModel || 'guide',
            objective: profile.objective || 'helpfulness',
            metaphors: profile.metaphors || ['scheduled'],
            constraints: profile.constraints || ['scheduled'],
            sentience: createDefaultSentience(),
            ...createStanceMetadata()
        };
    }
    detectConflicts(start, end) {
        const conflicts = [];
        const schedules = Array.from(this.schedules.values()).filter(s => s.enabled);
        for (let i = 0; i < schedules.length; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
                const overlap = this.findOverlap(schedules[i], schedules[j], start, end);
                if (overlap) {
                    conflicts.push(overlap);
                }
            }
        }
        return conflicts;
    }
    findOverlap(a, b, _start, _end) {
        // Simplified overlap detection
        // In real implementation, would check actual activation times
        if (a.trigger.type === b.trigger.type && a.trigger.time === b.trigger.time) {
            return {
                scheduleA: a,
                scheduleB: b,
                overlapStart: new Date(),
                overlapEnd: new Date(),
                resolution: a.priority > b.priority ? 'priority' : 'manual'
            };
        }
        return null;
    }
    registerStanceProfile(name, profile) {
        this.stanceProfiles.set(name, profile);
    }
    getTimezoneInfo() {
        const now = new Date();
        const jan = new Date(now.getFullYear(), 0, 1);
        const jul = new Date(now.getFullYear(), 6, 1);
        const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        const isDST = now.getTimezoneOffset() < stdOffset;
        return {
            id: this.timezone,
            name: this.timezone,
            offset: now.getTimezoneOffset(),
            isDST
        };
    }
    convertTimezone(date, _fromTz, toTz) {
        // Simplified timezone conversion
        // In real implementation, would use proper timezone library
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: toTz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(date);
        const getPart = (type) => parts.find(p => p.type === type)?.value || '0';
        return new Date(parseInt(getPart('year')), parseInt(getPart('month')) - 1, parseInt(getPart('day')), parseInt(getPart('hour')), parseInt(getPart('minute')), parseInt(getPart('second')));
    }
    parseICalendar(icalData) {
        const events = [];
        const lines = icalData.split('\n').map(l => l.trim());
        let currentEvent = null;
        for (const line of lines) {
            if (line === 'BEGIN:VEVENT') {
                currentEvent = { tags: [] };
            }
            else if (line === 'END:VEVENT' && currentEvent) {
                if (currentEvent.title && currentEvent.start && currentEvent.end) {
                    events.push({
                        id: `ical-${Date.now()}-${events.length}`,
                        title: currentEvent.title,
                        description: currentEvent.description,
                        start: currentEvent.start,
                        end: currentEvent.end,
                        allDay: currentEvent.allDay || false,
                        tags: currentEvent.tags || []
                    });
                }
                currentEvent = null;
            }
            else if (currentEvent) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':');
                switch (key) {
                    case 'SUMMARY':
                        currentEvent.title = value;
                        break;
                    case 'DESCRIPTION':
                        currentEvent.description = value;
                        break;
                    case 'DTSTART':
                        currentEvent.start = this.parseICalDate(value);
                        break;
                    case 'DTEND':
                        currentEvent.end = this.parseICalDate(value);
                        break;
                }
            }
        }
        return events;
    }
    parseICalDate(value) {
        // Basic iCal date parsing
        const match = value.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
        if (!match)
            return new Date();
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4] || '0'), parseInt(match[5] || '0'), parseInt(match[6] || '0'));
    }
    getSources() {
        return Array.from(this.sources.values());
    }
    getSchedules() {
        return Array.from(this.schedules.values());
    }
    getStanceProfiles() {
        return Array.from(this.stanceProfiles.entries()).map(([name, profile]) => ({
            name,
            profile
        }));
    }
}
export function createCalendarIntegration(timezone) {
    return new CalendarIntegration(timezone);
}
//# sourceMappingURL=integration.js.map