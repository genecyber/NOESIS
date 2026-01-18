/**
 * Environmental Context Sensing
 *
 * Detects and adapts to environmental factors including location,
 * device type, ambient conditions, and network quality.
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
const DEFAULT_PROFILES = [
    {
        id: 'mobile-brief',
        name: 'Mobile Brief Mode',
        conditions: [
            { field: 'device.type', operator: 'in', value: ['mobile', 'wearable'] }
        ],
        stanceModifications: [
            { field: 'values.certainty', operation: 'floor', value: 60 },
            { field: 'values.novelty', operation: 'cap', value: 40 }
        ],
        priority: 1,
        enabled: true
    },
    {
        id: 'night-calm',
        name: 'Night Calm Mode',
        conditions: [
            { field: 'ambient.timeOfDay', operator: 'eq', value: 'night' }
        ],
        stanceModifications: [
            { field: 'values.provocation', operation: 'cap', value: 30 },
            { field: 'values.empathy', operation: 'floor', value: 60 }
        ],
        priority: 2,
        enabled: true
    },
    {
        id: 'office-professional',
        name: 'Office Professional Mode',
        conditions: [
            { field: 'location.type', operator: 'eq', value: 'office' },
            { field: 'ambient.timeOfDay', operator: 'in', value: ['morning', 'afternoon'] }
        ],
        stanceModifications: [
            { field: 'values.certainty', operation: 'floor', value: 65 },
            { field: 'values.risk', operation: 'cap', value: 35 }
        ],
        priority: 3,
        enabled: true
    },
    {
        id: 'poor-network',
        name: 'Poor Network Mode',
        conditions: [
            { field: 'network.quality', operator: 'in', value: ['poor', 'fair'] }
        ],
        stanceModifications: [
            { field: 'values.synthesis', operation: 'floor', value: 70 }
        ],
        priority: 4,
        enabled: true
    }
];
export class EnvironmentalContextSensor {
    profiles = new Map();
    history;
    currentContext = null;
    listeners = [];
    constructor() {
        this.history = {
            contexts: [],
            transitions: [],
            patterns: []
        };
        for (const profile of DEFAULT_PROFILES) {
            this.profiles.set(profile.id, profile);
        }
    }
    detectContext() {
        const now = new Date();
        const context = {
            location: this.detectLocation(),
            device: this.detectDevice(),
            ambient: this.detectAmbient(now),
            network: this.detectNetwork(),
            temporal: this.detectTemporal(now)
        };
        this.recordContext(context);
        return context;
    }
    detectLocation() {
        // In real implementation, use geolocation APIs
        return {
            type: 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            privacyLevel: 'none'
        };
    }
    detectDevice() {
        // In real implementation, use navigator APIs
        const isNode = typeof window === 'undefined';
        return {
            type: isNode ? 'desktop' : 'unknown',
            os: isNode ? process.platform : 'unknown',
            screenSize: 'large',
            inputMethod: 'keyboard',
            capabilities: {
                hasCamera: false,
                hasMicrophone: false,
                hasGPS: false,
                hasBiometrics: false,
                supportsNotifications: false,
                supportsVibration: false
            }
        };
    }
    detectAmbient(now) {
        const hour = now.getHours();
        let timeOfDay;
        if (hour >= 5 && hour < 12)
            timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17)
            timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 21)
            timeOfDay = 'evening';
        else
            timeOfDay = 'night';
        const dayOfWeek = now.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const month = now.getMonth();
        let season;
        if (month >= 2 && month <= 4)
            season = 'spring';
        else if (month >= 5 && month <= 7)
            season = 'summer';
        else if (month >= 8 && month <= 10)
            season = 'fall';
        else
            season = 'winter';
        return {
            timeOfDay,
            dayOfWeek: isWeekend ? 'weekend' : 'weekday',
            season
        };
    }
    detectNetwork() {
        // In real implementation, use Network Information API
        return {
            connectionType: 'wifi',
            quality: 'good',
            latency: 50,
            bandwidth: 100,
            isMetered: false
        };
    }
    detectTemporal(now) {
        const hour = now.getHours();
        const day = now.getDay();
        const isWorkHours = hour >= 9 && hour < 17 && day > 0 && day < 6;
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        return {
            localTime: now,
            utcTime: new Date(now.toISOString()),
            isWorkHours,
            isDST: this.isDST(now),
            weekNumber
        };
    }
    isDST(date) {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);
        const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
        return date.getTimezoneOffset() < stdOffset;
    }
    recordContext(context) {
        const previousContext = this.currentContext;
        this.history.contexts.push({
            context,
            timestamp: new Date()
        });
        // Detect transition
        if (previousContext) {
            const fromType = `${previousContext.location.type}-${previousContext.device.type}`;
            const toType = `${context.location.type}-${context.device.type}`;
            if (fromType !== toType) {
                this.history.transitions.push({
                    from: fromType,
                    to: toType,
                    detectedAt: new Date(),
                    duration: 0,
                    handled: false
                });
            }
        }
        this.currentContext = context;
        // Limit history size
        if (this.history.contexts.length > 1000) {
            this.history.contexts = this.history.contexts.slice(-500);
        }
        // Notify listeners
        for (const listener of this.listeners) {
            listener(context);
        }
    }
    adjustStance(stance, context) {
        const ctx = context || this.currentContext || this.detectContext();
        const adjustedStance = JSON.parse(JSON.stringify(stance));
        const matchingProfiles = this.findMatchingProfiles(ctx);
        for (const profile of matchingProfiles) {
            for (const mod of profile.stanceModifications) {
                this.applyModification(adjustedStance, mod);
            }
        }
        return adjustedStance;
    }
    findMatchingProfiles(context) {
        const matching = [];
        for (const profile of this.profiles.values()) {
            if (!profile.enabled)
                continue;
            const allConditionsMet = profile.conditions.every(condition => this.evaluateCondition(condition, context));
            if (allConditionsMet) {
                matching.push(profile);
            }
        }
        return matching.sort((a, b) => a.priority - b.priority);
    }
    evaluateCondition(condition, context) {
        const value = this.getNestedValue(context, condition.field);
        switch (condition.operator) {
            case 'eq':
                return value === condition.value;
            case 'neq':
                return value !== condition.value;
            case 'in':
                return Array.isArray(condition.value) && condition.value.includes(value);
            case 'contains':
                return typeof value === 'string' && value.includes(String(condition.value));
            case 'gt':
                return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
            case 'lt':
                return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
            default:
                return false;
        }
    }
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    applyModification(stance, mod) {
        const parts = mod.field.split('.');
        let target = stance;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        const finalKey = parts[parts.length - 1];
        const currentValue = target[finalKey];
        if (typeof mod.value === 'number' && typeof currentValue === 'number') {
            switch (mod.operation) {
                case 'set':
                    target[finalKey] = mod.value;
                    break;
                case 'add':
                    target[finalKey] = currentValue + mod.value;
                    break;
                case 'multiply':
                    target[finalKey] = currentValue * mod.value;
                    break;
                case 'cap':
                    target[finalKey] = Math.min(currentValue, mod.value);
                    break;
                case 'floor':
                    target[finalKey] = Math.max(currentValue, mod.value);
                    break;
            }
        }
        else if (mod.operation === 'set') {
            target[finalKey] = mod.value;
        }
    }
    addProfile(profile) {
        const newProfile = {
            ...profile,
            id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        this.profiles.set(newProfile.id, newProfile);
        return newProfile;
    }
    removeProfile(profileId) {
        return this.profiles.delete(profileId);
    }
    getProfile(profileId) {
        return this.profiles.get(profileId);
    }
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }
    onContextChange(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1)
                this.listeners.splice(index, 1);
        };
    }
    getHistory() {
        return { ...this.history };
    }
    getPatterns() {
        // Analyze history to detect patterns
        const transitionCounts = new Map();
        for (const transition of this.history.transitions) {
            const key = `${transition.from}->${transition.to}`;
            transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
        }
        return Array.from(transitionCounts.entries())
            .filter(([_key, count]) => count >= 3)
            .map(([key, count]) => ({
            id: `pattern-${key}`,
            description: `Transition: ${key}`,
            frequency: count,
            typicalDuration: 0,
            associatedProfiles: []
        }));
    }
    generateContextAwareStance() {
        const context = this.currentContext || this.detectContext();
        let frame = 'pragmatic';
        let selfModel = 'guide';
        let objective = 'helpfulness';
        // Adapt based on location
        if (context.location.type === 'office') {
            frame = 'systems';
            selfModel = 'synthesizer';
        }
        else if (context.location.type === 'home') {
            frame = 'playful';
            selfModel = 'guide';
        }
        // Adapt based on time
        if (context.ambient.timeOfDay === 'night') {
            frame = 'poetic';
            objective = 'synthesis';
        }
        else if (context.ambient.timeOfDay === 'morning') {
            frame = 'pragmatic';
            objective = 'helpfulness';
        }
        // Adapt based on device
        if (context.device.type === 'mobile' || context.device.type === 'wearable') {
            selfModel = 'guide';
            objective = 'helpfulness';
        }
        const values = createDefaultValues();
        // Modify values based on context
        if (context.network.quality === 'poor') {
            values.certainty = 70;
            values.synthesis = 70;
        }
        if (context.ambient.dayOfWeek === 'weekend') {
            values.novelty = 60;
            values.risk = 55;
        }
        return {
            frame,
            values,
            selfModel,
            objective,
            metaphors: ['context-aware'],
            constraints: ['context-aware'],
            sentience: createDefaultSentience(),
            ...createStanceMetadata()
        };
    }
}
export function createEnvironmentalSensor() {
    return new EnvironmentalContextSensor();
}
//# sourceMappingURL=environmental.js.map