/**
 * Haptic Feedback for VR Stance Visualization
 *
 * Tactile feedback mapping for stance dimensions with vibration patterns,
 * texture mapping, force feedback, and accessibility options.
 */
import type { Stance, Frame } from '../types/index.js';
export interface HapticConfig {
    intensity: number;
    enabled: boolean;
    controllers: ControllerConfig[];
    accessibilityMode: AccessibilityMode;
    feedbackProfile: FeedbackProfile;
}
export interface ControllerConfig {
    id: string;
    type: 'left' | 'right' | 'primary' | 'secondary';
    enabled: boolean;
    intensityMultiplier: number;
    channels: HapticChannel[];
}
export interface HapticChannel {
    name: string;
    frequency: number;
    amplitude: number;
    duration: number;
    pattern: HapticPattern;
}
export type HapticPattern = 'continuous' | 'pulse' | 'wave' | 'ramp-up' | 'ramp-down' | 'heartbeat' | 'texture';
export interface FeedbackProfile {
    name: string;
    mappings: DimensionMapping[];
    textureSet: TextureMapping[];
    forceProfile: ForceProfile;
}
export interface DimensionMapping {
    dimension: string;
    feedbackType: 'vibration' | 'texture' | 'force' | 'temperature';
    intensity: (value: number) => number;
    pattern: HapticPattern;
    channel: string;
}
export interface TextureMapping {
    frame: Frame;
    roughness: number;
    density: number;
    pattern: string;
    description: string;
}
export interface ForceProfile {
    coherenceForce: (coherence: number) => number;
    resistanceProfile: 'linear' | 'quadratic' | 'exponential';
    maxForce: number;
    minForce: number;
}
export type AccessibilityMode = 'standard' | 'reduced-motion' | 'high-contrast-haptic' | 'audio-substitute' | 'visual-only';
export interface HapticEvent {
    id: string;
    type: HapticEventType;
    controller: string;
    timestamp: Date;
    duration: number;
    intensity: number;
    pattern: HapticPattern;
    metadata?: Record<string, unknown>;
}
export type HapticEventType = 'value-change' | 'frame-shift' | 'coherence-alert' | 'boundary-touch' | 'selection' | 'confirmation' | 'error' | 'ambient';
export interface HapticFeedbackResult {
    events: HapticEvent[];
    duration: number;
    controllersActivated: string[];
    intensity: number;
}
export declare class HapticFeedbackEngine {
    private config;
    private eventHistory;
    private activeControllers;
    private frameTextures;
    constructor(config?: Partial<HapticConfig>);
    private createDefaultProfile;
    private initializeControllers;
    generateFeedback(stance: Stance, eventType: HapticEventType): HapticFeedbackResult;
    private generateValueChangeEvents;
    private generateFrameShiftEvents;
    private generateCoherenceAlertEvents;
    private generateSelectionEvents;
    private generateErrorEvents;
    private generateAmbientEvents;
    private applyAccessibilityAdjustments;
    private getValueFromPath;
    private calculateCoherence;
    getFrameTexture(frame: Frame): TextureMapping | undefined;
    setAccessibilityMode(mode: AccessibilityMode): void;
    setIntensity(intensity: number): void;
    enableController(controllerId: string, enabled: boolean): void;
    setControllerIntensity(controllerId: string, multiplier: number): void;
    getConfig(): HapticConfig;
    updateConfig(config: Partial<HapticConfig>): void;
    getEventHistory(): HapticEvent[];
    clearEventHistory(): void;
    createCustomProfile(name: string, mappings: DimensionMapping[]): FeedbackProfile;
    setFeedbackProfile(profile: FeedbackProfile): void;
    synchronizeControllers(eventType: HapticEventType, stance: Stance): HapticFeedbackResult;
}
export declare function createHapticFeedbackEngine(config?: Partial<HapticConfig>): HapticFeedbackEngine;
//# sourceMappingURL=feedback.d.ts.map