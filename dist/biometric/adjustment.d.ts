/**
 * Biometric-Linked Stance Adjustments
 *
 * Integrates physiological data (heart rate, focus, stress) to
 * automatically modulate stance parameters for optimal AI interaction.
 */
import type { Stance } from '../types/index.js';
export interface BiometricReading {
    timestamp: Date;
    heartRate?: number;
    heartRateVariability?: number;
    stressLevel?: number;
    focusLevel?: number;
    fatigueLevel?: number;
    alertnessScore?: number;
    breathingRate?: number;
    skinConductance?: number;
}
export interface BiometricProfile {
    userId: string;
    baseline: BiometricBaseline;
    currentState: BiometricState;
    history: BiometricReading[];
    adjustmentRules: AdjustmentRule[];
    privacySettings: PrivacySettings;
}
export interface BiometricBaseline {
    restingHeartRate: number;
    normalHRV: number;
    typicalStressRange: [number, number];
    typicalFocusRange: [number, number];
    calibratedAt: Date;
}
export interface BiometricState {
    arousal: 'low' | 'normal' | 'elevated' | 'high';
    cognitive: 'fatigued' | 'distracted' | 'focused' | 'flow';
    emotional: 'calm' | 'neutral' | 'anxious' | 'stressed';
    physical: 'resting' | 'alert' | 'active' | 'exhausted';
}
export interface AdjustmentRule {
    id: string;
    name: string;
    condition: BiometricCondition;
    adjustment: StanceAdjustment;
    priority: number;
    enabled: boolean;
}
export interface BiometricCondition {
    type: 'threshold' | 'change' | 'pattern' | 'combination';
    metric: keyof BiometricReading;
    operator: 'gt' | 'lt' | 'eq' | 'between' | 'rising' | 'falling';
    value: number | [number, number];
    duration?: number;
}
export interface StanceAdjustment {
    type: 'absolute' | 'relative' | 'cap' | 'floor';
    field: string;
    value: number | string;
    reason: string;
}
export interface PrivacySettings {
    dataRetention: 'none' | 'session' | 'day' | 'week' | 'indefinite';
    shareWithAnalytics: boolean;
    allowThirdParty: boolean;
    anonymizeData: boolean;
    encryptAtRest: boolean;
}
export interface BiometricAdjustmentResult {
    originalStance: Stance;
    adjustedStance: Stance;
    appliedRules: AdjustmentRule[];
    biometricState: BiometricState;
    confidence: number;
    timestamp: Date;
}
export declare class BiometricStanceAdjuster {
    private profiles;
    private deviceConnections;
    createProfile(userId: string, privacySettings?: Partial<PrivacySettings>): BiometricProfile;
    recordReading(userId: string, reading: Partial<BiometricReading>): void;
    private updateState;
    private enforceRetentionPolicy;
    adjustStance(userId: string, stance: Stance): BiometricAdjustmentResult;
    private evaluateCondition;
    private applyAdjustment;
    private calculateConfidence;
    connectDevice(userId: string, deviceType: DeviceType, _config: DeviceConfig): boolean;
    disconnectDevice(userId: string, deviceType: DeviceType): void;
    getConnectedDevices(userId: string): DeviceConnection[];
    calibrateBaseline(userId: string, readings: BiometricReading[]): void;
    addRule(userId: string, rule: Omit<AdjustmentRule, 'id'>): AdjustmentRule | null;
    removeRule(userId: string, ruleId: string): boolean;
    getProfile(userId: string): BiometricProfile | undefined;
    generateAdaptiveStance(userId: string): Stance | null;
}
export type DeviceType = 'smartwatch' | 'fitness-band' | 'eeg-headset' | 'hrv-monitor' | 'eye-tracker';
export interface DeviceConfig {
    samplingRate: number;
    metrics: string[];
    bluetooth?: boolean;
    apiEndpoint?: string;
}
export interface DeviceConnection {
    userId: string;
    deviceType: DeviceType;
    status: 'connected' | 'disconnected' | 'pairing';
    connectedAt: Date;
    lastDataAt: Date;
}
export declare function createBiometricAdjuster(): BiometricStanceAdjuster;
//# sourceMappingURL=adjustment.d.ts.map