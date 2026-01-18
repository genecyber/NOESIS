/**
 * Environmental Context Sensing
 *
 * Detects and adapts to environmental factors including location,
 * device type, ambient conditions, and network quality.
 */
import type { Stance } from '../types/index.js';
export interface EnvironmentContext {
    location: LocationContext;
    device: DeviceContext;
    ambient: AmbientContext;
    network: NetworkContext;
    temporal: TemporalContext;
}
export interface LocationContext {
    type: 'home' | 'office' | 'public' | 'transit' | 'outdoor' | 'unknown';
    country?: string;
    timezone: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    privacyLevel: 'exact' | 'city' | 'country' | 'none';
}
export interface DeviceContext {
    type: 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'wearable' | 'vr' | 'unknown';
    os: string;
    browser?: string;
    screenSize: 'small' | 'medium' | 'large' | 'xlarge';
    inputMethod: 'keyboard' | 'touch' | 'voice' | 'gesture';
    capabilities: DeviceCapabilities;
}
export interface DeviceCapabilities {
    hasCamera: boolean;
    hasMicrophone: boolean;
    hasGPS: boolean;
    hasBiometrics: boolean;
    supportsNotifications: boolean;
    supportsVibration: boolean;
}
export interface AmbientContext {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 'weekday' | 'weekend';
    season: 'spring' | 'summer' | 'fall' | 'winter';
    weather?: WeatherInfo;
    lightLevel?: 'dark' | 'dim' | 'normal' | 'bright';
    noiseLevel?: 'quiet' | 'moderate' | 'loud';
}
export interface WeatherInfo {
    condition: 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
    temperature: number;
    humidity: number;
}
export interface NetworkContext {
    connectionType: 'wifi' | 'cellular' | 'ethernet' | 'offline';
    quality: 'poor' | 'fair' | 'good' | 'excellent';
    latency: number;
    bandwidth: number;
    isMetered: boolean;
}
export interface TemporalContext {
    localTime: Date;
    utcTime: Date;
    isWorkHours: boolean;
    isDST: boolean;
    weekNumber: number;
}
export interface ContextProfile {
    id: string;
    name: string;
    conditions: ContextCondition[];
    stanceModifications: StanceModification[];
    priority: number;
    enabled: boolean;
}
export interface ContextCondition {
    field: string;
    operator: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'lt';
    value: unknown;
}
export interface StanceModification {
    field: string;
    operation: 'set' | 'add' | 'multiply' | 'cap' | 'floor';
    value: unknown;
}
export interface ContextTransition {
    from: string;
    to: string;
    detectedAt: Date;
    duration: number;
    handled: boolean;
}
export interface EnvironmentHistory {
    contexts: Array<{
        context: EnvironmentContext;
        timestamp: Date;
    }>;
    transitions: ContextTransition[];
    patterns: ContextPattern[];
}
export interface ContextPattern {
    id: string;
    description: string;
    frequency: number;
    typicalDuration: number;
    associatedProfiles: string[];
}
export declare class EnvironmentalContextSensor {
    private profiles;
    private history;
    private currentContext;
    private listeners;
    constructor();
    detectContext(): EnvironmentContext;
    private detectLocation;
    private detectDevice;
    private detectAmbient;
    private detectNetwork;
    private detectTemporal;
    private isDST;
    private recordContext;
    adjustStance(stance: Stance, context?: EnvironmentContext): Stance;
    private findMatchingProfiles;
    private evaluateCondition;
    private getNestedValue;
    private applyModification;
    addProfile(profile: Omit<ContextProfile, 'id'>): ContextProfile;
    removeProfile(profileId: string): boolean;
    getProfile(profileId: string): ContextProfile | undefined;
    getAllProfiles(): ContextProfile[];
    onContextChange(listener: (context: EnvironmentContext) => void): () => void;
    getHistory(): EnvironmentHistory;
    getPatterns(): ContextPattern[];
    generateContextAwareStance(): Stance;
}
export declare function createEnvironmentalSensor(): EnvironmentalContextSensor;
//# sourceMappingURL=environmental.d.ts.map