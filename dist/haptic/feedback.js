/**
 * Haptic Feedback for VR Stance Visualization
 *
 * Tactile feedback mapping for stance dimensions with vibration patterns,
 * texture mapping, force feedback, and accessibility options.
 */
const FRAME_TEXTURES = [
    { frame: 'existential', roughness: 0.7, density: 0.5, pattern: 'deep-rumble', description: 'Heavy, contemplative' },
    { frame: 'pragmatic', roughness: 0.3, density: 0.7, pattern: 'crisp-tap', description: 'Sharp, efficient' },
    { frame: 'poetic', roughness: 0.4, density: 0.3, pattern: 'flowing-wave', description: 'Smooth, rhythmic' },
    { frame: 'adversarial', roughness: 0.8, density: 0.8, pattern: 'sharp-edge', description: 'Intense, edgy' },
    { frame: 'playful', roughness: 0.2, density: 0.4, pattern: 'bubble-pop', description: 'Light, bouncy' },
    { frame: 'mythic', roughness: 0.6, density: 0.6, pattern: 'ancient-pulse', description: 'Resonant, archetypal' },
    { frame: 'systems', roughness: 0.4, density: 0.9, pattern: 'grid-scan', description: 'Precise, interconnected' },
    { frame: 'psychoanalytic', roughness: 0.5, density: 0.4, pattern: 'deep-probe', description: 'Penetrating, layered' },
    { frame: 'stoic', roughness: 0.2, density: 0.2, pattern: 'steady-hum', description: 'Calm, unwavering' },
    { frame: 'absurdist', roughness: 0.9, density: 0.7, pattern: 'chaos-burst', description: 'Unpredictable, humorous' }
];
export class HapticFeedbackEngine {
    config;
    eventHistory = [];
    activeControllers = new Map();
    frameTextures;
    constructor(config) {
        this.config = {
            intensity: 70,
            enabled: true,
            controllers: [
                { id: 'left', type: 'left', enabled: true, intensityMultiplier: 1.0, channels: [] },
                { id: 'right', type: 'right', enabled: true, intensityMultiplier: 1.0, channels: [] }
            ],
            accessibilityMode: 'standard',
            feedbackProfile: this.createDefaultProfile(),
            ...config
        };
        this.frameTextures = new Map(FRAME_TEXTURES.map(t => [t.frame, t]));
        this.initializeControllers();
    }
    createDefaultProfile() {
        return {
            name: 'default',
            mappings: [
                {
                    dimension: 'values.curiosity',
                    feedbackType: 'vibration',
                    intensity: (v) => v / 100,
                    pattern: 'pulse',
                    channel: 'primary'
                },
                {
                    dimension: 'coherence',
                    feedbackType: 'force',
                    intensity: (v) => 1 - (v / 100),
                    pattern: 'continuous',
                    channel: 'secondary'
                }
            ],
            textureSet: FRAME_TEXTURES,
            forceProfile: {
                coherenceForce: (c) => Math.max(0, (100 - c) / 100),
                resistanceProfile: 'quadratic',
                maxForce: 1.0,
                minForce: 0.1
            }
        };
    }
    initializeControllers() {
        for (const controller of this.config.controllers) {
            this.activeControllers.set(controller.id, {
                id: controller.id,
                active: false,
                currentIntensity: 0,
                currentPattern: 'continuous',
                lastUpdate: new Date()
            });
        }
    }
    generateFeedback(stance, eventType) {
        if (!this.config.enabled) {
            return { events: [], duration: 0, controllersActivated: [], intensity: 0 };
        }
        const events = [];
        const controllersActivated = [];
        // Apply accessibility mode adjustments
        const adjustedIntensity = this.applyAccessibilityAdjustments(this.config.intensity);
        // Generate events based on event type
        switch (eventType) {
            case 'value-change':
                events.push(...this.generateValueChangeEvents(stance, adjustedIntensity));
                break;
            case 'frame-shift':
                events.push(...this.generateFrameShiftEvents(stance, adjustedIntensity));
                break;
            case 'coherence-alert':
                events.push(...this.generateCoherenceAlertEvents(stance, adjustedIntensity));
                break;
            case 'selection':
                events.push(...this.generateSelectionEvents(adjustedIntensity));
                break;
            case 'error':
                events.push(...this.generateErrorEvents(adjustedIntensity));
                break;
            default:
                events.push(...this.generateAmbientEvents(stance, adjustedIntensity));
        }
        // Track which controllers were activated
        for (const event of events) {
            if (!controllersActivated.includes(event.controller)) {
                controllersActivated.push(event.controller);
            }
        }
        // Record events
        this.eventHistory.push(...events);
        if (this.eventHistory.length > 1000) {
            this.eventHistory = this.eventHistory.slice(-500);
        }
        const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);
        return {
            events,
            duration: totalDuration,
            controllersActivated,
            intensity: adjustedIntensity
        };
    }
    generateValueChangeEvents(stance, intensity) {
        const events = [];
        // Map value changes to vibration patterns
        for (const mapping of this.config.feedbackProfile.mappings) {
            if (mapping.feedbackType === 'vibration') {
                const value = this.getValueFromPath(stance, mapping.dimension);
                if (value !== undefined) {
                    const eventIntensity = mapping.intensity(value) * intensity / 100;
                    events.push({
                        id: `haptic-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        type: 'value-change',
                        controller: 'left',
                        timestamp: new Date(),
                        duration: 100 + (value / 100) * 200,
                        intensity: eventIntensity,
                        pattern: mapping.pattern,
                        metadata: { dimension: mapping.dimension, value }
                    });
                }
            }
        }
        return events;
    }
    generateFrameShiftEvents(stance, intensity) {
        const texture = this.frameTextures.get(stance.frame);
        if (!texture)
            return [];
        const events = [];
        // Generate texture-based haptic for frame
        events.push({
            id: `haptic-frame-${Date.now()}`,
            type: 'frame-shift',
            controller: 'right',
            timestamp: new Date(),
            duration: 500,
            intensity: texture.roughness * intensity / 100,
            pattern: 'texture',
            metadata: {
                frame: stance.frame,
                texture: texture.pattern,
                description: texture.description
            }
        });
        // Add complementary feedback to left controller
        events.push({
            id: `haptic-frame-l-${Date.now()}`,
            type: 'frame-shift',
            controller: 'left',
            timestamp: new Date(),
            duration: 300,
            intensity: texture.density * intensity / 100,
            pattern: 'wave',
            metadata: { frame: stance.frame }
        });
        return events;
    }
    generateCoherenceAlertEvents(stance, intensity) {
        const coherence = this.calculateCoherence(stance);
        const events = [];
        if (coherence < 40) {
            // Low coherence - strong alert
            events.push({
                id: `haptic-coherence-${Date.now()}`,
                type: 'coherence-alert',
                controller: 'left',
                timestamp: new Date(),
                duration: 600,
                intensity: intensity / 100 * 0.9,
                pattern: 'heartbeat',
                metadata: { coherence, severity: 'high' }
            });
            events.push({
                id: `haptic-coherence-r-${Date.now()}`,
                type: 'coherence-alert',
                controller: 'right',
                timestamp: new Date(),
                duration: 600,
                intensity: intensity / 100 * 0.9,
                pattern: 'heartbeat',
                metadata: { coherence, severity: 'high' }
            });
        }
        else if (coherence < 60) {
            // Medium coherence - gentle warning
            events.push({
                id: `haptic-coherence-warn-${Date.now()}`,
                type: 'coherence-alert',
                controller: 'left',
                timestamp: new Date(),
                duration: 300,
                intensity: intensity / 100 * 0.5,
                pattern: 'pulse',
                metadata: { coherence, severity: 'medium' }
            });
        }
        return events;
    }
    generateSelectionEvents(intensity) {
        return [{
                id: `haptic-select-${Date.now()}`,
                type: 'selection',
                controller: 'right',
                timestamp: new Date(),
                duration: 50,
                intensity: intensity / 100 * 0.7,
                pattern: 'pulse',
                metadata: {}
            }];
    }
    generateErrorEvents(intensity) {
        return [{
                id: `haptic-error-${Date.now()}`,
                type: 'error',
                controller: 'left',
                timestamp: new Date(),
                duration: 200,
                intensity: intensity / 100 * 1.0,
                pattern: 'pulse',
                metadata: {}
            }, {
                id: `haptic-error-r-${Date.now()}`,
                type: 'error',
                controller: 'right',
                timestamp: new Date(),
                duration: 200,
                intensity: intensity / 100 * 1.0,
                pattern: 'pulse',
                metadata: {}
            }];
    }
    generateAmbientEvents(stance, intensity) {
        const coherence = this.calculateCoherence(stance);
        const ambientIntensity = (coherence / 100) * 0.2 * intensity / 100;
        return [{
                id: `haptic-ambient-${Date.now()}`,
                type: 'ambient',
                controller: 'left',
                timestamp: new Date(),
                duration: 1000,
                intensity: ambientIntensity,
                pattern: 'continuous',
                metadata: { coherence }
            }];
    }
    applyAccessibilityAdjustments(intensity) {
        switch (this.config.accessibilityMode) {
            case 'reduced-motion':
                return intensity * 0.5;
            case 'high-contrast-haptic':
                return Math.min(100, intensity * 1.3);
            case 'audio-substitute':
            case 'visual-only':
                return 0;
            default:
                return intensity;
        }
    }
    getValueFromPath(stance, path) {
        const parts = path.split('.');
        let current = stance;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return typeof current === 'number' ? current : undefined;
    }
    calculateCoherence(stance) {
        const values = Object.values(stance.values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.max(0, Math.min(100, 100 - Math.sqrt(variance) * 2));
    }
    getFrameTexture(frame) {
        return this.frameTextures.get(frame);
    }
    setAccessibilityMode(mode) {
        this.config.accessibilityMode = mode;
    }
    setIntensity(intensity) {
        this.config.intensity = Math.max(0, Math.min(100, intensity));
    }
    enableController(controllerId, enabled) {
        const controller = this.config.controllers.find(c => c.id === controllerId);
        if (controller) {
            controller.enabled = enabled;
        }
    }
    setControllerIntensity(controllerId, multiplier) {
        const controller = this.config.controllers.find(c => c.id === controllerId);
        if (controller) {
            controller.intensityMultiplier = Math.max(0, Math.min(2, multiplier));
        }
    }
    getConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getEventHistory() {
        return [...this.eventHistory];
    }
    clearEventHistory() {
        this.eventHistory = [];
    }
    createCustomProfile(name, mappings) {
        return {
            name,
            mappings,
            textureSet: FRAME_TEXTURES,
            forceProfile: this.config.feedbackProfile.forceProfile
        };
    }
    setFeedbackProfile(profile) {
        this.config.feedbackProfile = profile;
    }
    synchronizeControllers(eventType, stance) {
        // Generate synchronized feedback across all controllers
        const result = this.generateFeedback(stance, eventType);
        // Ensure all controllers receive the same timing
        const maxDuration = Math.max(...result.events.map(e => e.duration));
        for (const event of result.events) {
            event.duration = maxDuration;
        }
        return result;
    }
}
export function createHapticFeedbackEngine(config) {
    return new HapticFeedbackEngine(config);
}
//# sourceMappingURL=feedback.js.map