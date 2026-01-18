/**
 * Calendar Integration
 *
 * Integrates with Google Calendar and iCal for scheduled
 * stance transitions and event-triggered changes.
 */
import type { Stance } from '../types/index.js';
export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    allDay: boolean;
    recurrence?: RecurrenceRule;
    stanceProfile?: string;
    tags: string[];
}
export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    byDay?: string[];
    byMonth?: number[];
    until?: Date;
    count?: number;
}
export interface CalendarSource {
    id: string;
    type: 'google' | 'ical' | 'outlook' | 'caldav';
    name: string;
    url?: string;
    credentials?: CalendarCredentials;
    enabled: boolean;
    syncInterval: number;
    lastSynced?: Date;
}
export interface CalendarCredentials {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    apiKey?: string;
}
export interface StanceSchedule {
    id: string;
    name: string;
    description?: string;
    trigger: ScheduleTrigger;
    stanceProfile: string;
    priority: number;
    enabled: boolean;
}
export interface ScheduleTrigger {
    type: 'event-start' | 'event-end' | 'time' | 'recurring';
    eventFilter?: EventFilter;
    time?: string;
    timezone?: string;
    recurrence?: RecurrenceRule;
}
export interface EventFilter {
    titleContains?: string;
    titleRegex?: string;
    hasTags?: string[];
    calendarIds?: string[];
}
export interface TimezoneInfo {
    id: string;
    name: string;
    offset: number;
    isDST: boolean;
    dstStart?: Date;
    dstEnd?: Date;
}
export interface CalendarConflict {
    scheduleA: StanceSchedule;
    scheduleB: StanceSchedule;
    overlapStart: Date;
    overlapEnd: Date;
    resolution: 'priority' | 'merge' | 'manual';
}
export interface SyncResult {
    source: string;
    success: boolean;
    eventsAdded: number;
    eventsUpdated: number;
    eventsRemoved: number;
    errors: string[];
    timestamp: Date;
}
export declare class CalendarIntegration {
    private sources;
    private events;
    private schedules;
    private stanceProfiles;
    private timezone;
    constructor(timezone?: string);
    addSource(source: Omit<CalendarSource, 'id'>): CalendarSource;
    removeSource(sourceId: string): boolean;
    syncSource(sourceId: string): Promise<SyncResult>;
    syncAll(): Promise<SyncResult[]>;
    addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent;
    removeEvent(eventId: string): boolean;
    getEventsInRange(start: Date, end: Date): CalendarEvent[];
    private expandRecurrence;
    addSchedule(schedule: Omit<StanceSchedule, 'id'>): StanceSchedule;
    removeSchedule(scheduleId: string): boolean;
    getActiveSchedules(at?: Date): StanceSchedule[];
    private isScheduleActive;
    private matchesFilter;
    private matchesRecurrence;
    getStanceForTime(at?: Date): Stance | null;
    private buildStance;
    detectConflicts(start: Date, end: Date): CalendarConflict[];
    private findOverlap;
    registerStanceProfile(name: string, profile: Partial<Stance>): void;
    getTimezoneInfo(): TimezoneInfo;
    convertTimezone(date: Date, _fromTz: string, toTz: string): Date;
    parseICalendar(icalData: string): CalendarEvent[];
    private parseICalDate;
    getSources(): CalendarSource[];
    getSchedules(): StanceSchedule[];
    getStanceProfiles(): Array<{
        name: string;
        profile: Partial<Stance>;
    }>;
}
export declare function createCalendarIntegration(timezone?: string): CalendarIntegration;
//# sourceMappingURL=integration.d.ts.map