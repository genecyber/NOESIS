/**
 * Biometric-Linked Stance Adjustments
 *
 * Integrates physiological data (heart rate, focus, stress) to
 * automatically modulate stance parameters for optimal AI interaction.
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
const DEFAULT_RULES = [
    {
        id: 'high-stress-calm',
        name: 'High Stress Calming',
        condition: { type: 'threshold', metric: 'stressLevel', operator: 'gt', value: 70 },
        adjustment: { type: 'cap', field: 'values.provocation', value: 30, reason: 'High stress detected' },
        priority: 1,
        enabled: true
    },
    {
        id: 'low-focus-simplify',
        name: 'Low Focus Simplification',
        condition: { type: 'threshold', metric: 'focusLevel', operator: 'lt', value: 30 },
        adjustment: { type: 'floor', field: 'values.certainty', value: 60, reason: 'Low focus detected' },
        priority: 2,
        enabled: true
    },
    {
        id: 'fatigue-reduce-intensity',
        name: 'Fatigue Intensity Reduction',
        condition: { type: 'threshold', metric: 'fatigueLevel', operator: 'gt', value: 60 },
        adjustment: { type: 'cap', field: 'values.novelty', value: 40, reason: 'Fatigue detected' },
        priority: 3,
        enabled: true
    },
    {
        id: 'high-alertness-challenge',
        name: 'High Alertness Challenge',
        condition: { type: 'threshold', metric: 'alertnessScore', operator: 'gt', value: 80 },
        adjustment: { type: 'floor', field: 'values.risk', value: 60, reason: 'High alertness allows challenges' },
        priority: 4,
        enabled: true
    }
];
export class BiometricStanceAdjuster {
    profiles = new Map();
    deviceConnections = new Map();
    createProfile(userId, privacySettings) {
        const profile = {
            userId,
            baseline: {
                restingHeartRate: 70,
                normalHRV: 50,
                typicalStressRange: [20, 60],
                typicalFocusRange: [40, 80],
                calibratedAt: new Date()
            },
            currentState: {
                arousal: 'normal',
                cognitive: 'focused',
                emotional: 'neutral',
                physical: 'alert'
            },
            history: [],
            adjustmentRules: [...DEFAULT_RULES],
            privacySettings: {
                dataRetention: 'session',
                shareWithAnalytics: false,
                allowThirdParty: false,
                anonymizeData: true,
                encryptAtRest: true,
                ...privacySettings
            }
        };
        this.profiles.set(userId, profile);
        return profile;
    }
    recordReading(userId, reading) {
        const profile = this.profiles.get(userId);
        if (!profile)
            return;
        const fullReading = {
            timestamp: new Date(),
            ...reading
        };
        profile.history.push(fullReading);
        this.updateState(profile, fullReading);
        this.enforceRetentionPolicy(profile);
    }
    updateState(profile, reading) {
        const { baseline } = profile;
        // Update arousal based on heart rate
        if (reading.heartRate !== undefined) {
            const hrDelta = reading.heartRate - baseline.restingHeartRate;
            if (hrDelta < 5)
                profile.currentState.arousal = 'low';
            else if (hrDelta < 20)
                profile.currentState.arousal = 'normal';
            else if (hrDelta < 40)
                profile.currentState.arousal = 'elevated';
            else
                profile.currentState.arousal = 'high';
        }
        // Update cognitive state based on focus
        if (reading.focusLevel !== undefined) {
            if (reading.focusLevel < 25)
                profile.currentState.cognitive = 'distracted';
            else if (reading.focusLevel < 50)
                profile.currentState.cognitive = 'fatigued';
            else if (reading.focusLevel < 80)
                profile.currentState.cognitive = 'focused';
            else
                profile.currentState.cognitive = 'flow';
        }
        // Update emotional state based on stress
        if (reading.stressLevel !== undefined) {
            if (reading.stressLevel < 20)
                profile.currentState.emotional = 'calm';
            else if (reading.stressLevel < 50)
                profile.currentState.emotional = 'neutral';
            else if (reading.stressLevel < 75)
                profile.currentState.emotional = 'anxious';
            else
                profile.currentState.emotional = 'stressed';
        }
        // Update physical state based on fatigue
        if (reading.fatigueLevel !== undefined) {
            if (reading.fatigueLevel > 80)
                profile.currentState.physical = 'exhausted';
            else if (reading.fatigueLevel > 50)
                profile.currentState.physical = 'resting';
            else if (reading.alertnessScore && reading.alertnessScore > 60)
                profile.currentState.physical = 'active';
            else
                profile.currentState.physical = 'alert';
        }
    }
    enforceRetentionPolicy(profile) {
        const { dataRetention } = profile.privacySettings;
        const now = Date.now();
        let maxAge;
        switch (dataRetention) {
            case 'none':
                profile.history = [];
                return;
            case 'session':
                maxAge = 4 * 60 * 60 * 1000; // 4 hours
                break;
            case 'day':
                maxAge = 24 * 60 * 60 * 1000;
                break;
            case 'week':
                maxAge = 7 * 24 * 60 * 60 * 1000;
                break;
            default:
                return;
        }
        profile.history = profile.history.filter(r => now - r.timestamp.getTime() < maxAge);
    }
    adjustStance(userId, stance) {
        const profile = this.profiles.get(userId);
        if (!profile) {
            return {
                originalStance: stance,
                adjustedStance: stance,
                appliedRules: [],
                biometricState: { arousal: 'normal', cognitive: 'focused', emotional: 'neutral', physical: 'alert' },
                confidence: 0,
                timestamp: new Date()
            };
        }
        const adjustedStance = JSON.parse(JSON.stringify(stance));
        const appliedRules = [];
        const latestReading = profile.history[profile.history.length - 1];
        // Sort rules by priority
        const sortedRules = [...profile.adjustmentRules]
            .filter(r => r.enabled)
            .sort((a, b) => a.priority - b.priority);
        for (const rule of sortedRules) {
            if (this.evaluateCondition(rule.condition, latestReading, profile)) {
                this.applyAdjustment(adjustedStance, rule.adjustment);
                appliedRules.push(rule);
            }
        }
        return {
            originalStance: stance,
            adjustedStance,
            appliedRules,
            biometricState: { ...profile.currentState },
            confidence: latestReading ? this.calculateConfidence(latestReading) : 0.5,
            timestamp: new Date()
        };
    }
    evaluateCondition(condition, reading, _profile) {
        if (!reading)
            return false;
        const value = reading[condition.metric];
        if (typeof value !== 'number')
            return false;
        const threshold = condition.value;
        switch (condition.operator) {
            case 'gt':
                return typeof threshold === 'number' && value > threshold;
            case 'lt':
                return typeof threshold === 'number' && value < threshold;
            case 'eq':
                return typeof threshold === 'number' && value === threshold;
            case 'between':
                return Array.isArray(threshold) && value >= threshold[0] && value <= threshold[1];
            default:
                return false;
        }
    }
    applyAdjustment(stance, adjustment) {
        const parts = adjustment.field.split('.');
        let target = stance;
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        const finalKey = parts[parts.length - 1];
        const currentValue = target[finalKey];
        if (typeof adjustment.value === 'number' && typeof currentValue === 'number') {
            switch (adjustment.type) {
                case 'absolute':
                    target[finalKey] = adjustment.value;
                    break;
                case 'relative':
                    target[finalKey] = currentValue + adjustment.value;
                    break;
                case 'cap':
                    target[finalKey] = Math.min(currentValue, adjustment.value);
                    break;
                case 'floor':
                    target[finalKey] = Math.max(currentValue, adjustment.value);
                    break;
            }
        }
        else if (typeof adjustment.value === 'string') {
            target[finalKey] = adjustment.value;
        }
    }
    calculateConfidence(reading) {
        let confidence = 0.5;
        let metrics = 0;
        if (reading.heartRate !== undefined) {
            confidence += 0.1;
            metrics++;
        }
        if (reading.stressLevel !== undefined) {
            confidence += 0.1;
            metrics++;
        }
        if (reading.focusLevel !== undefined) {
            confidence += 0.1;
            metrics++;
        }
        if (reading.fatigueLevel !== undefined) {
            confidence += 0.1;
            metrics++;
        }
        if (reading.alertnessScore !== undefined) {
            confidence += 0.1;
            metrics++;
        }
        return Math.min(confidence, 1.0);
    }
    connectDevice(userId, deviceType, _config) {
        const connection = {
            userId,
            deviceType,
            status: 'connected',
            connectedAt: new Date(),
            lastDataAt: new Date()
        };
        this.deviceConnections.set(`${userId}-${deviceType}`, connection);
        return true;
    }
    disconnectDevice(userId, deviceType) {
        this.deviceConnections.delete(`${userId}-${deviceType}`);
    }
    getConnectedDevices(userId) {
        return Array.from(this.deviceConnections.values())
            .filter(c => c.userId === userId);
    }
    calibrateBaseline(userId, readings) {
        const profile = this.profiles.get(userId);
        if (!profile || readings.length === 0)
            return;
        const heartRates = readings
            .map(r => r.heartRate)
            .filter((hr) => hr !== undefined);
        const hrvs = readings
            .map(r => r.heartRateVariability)
            .filter((hrv) => hrv !== undefined);
        const stresses = readings
            .map(r => r.stressLevel)
            .filter((s) => s !== undefined);
        const focuses = readings
            .map(r => r.focusLevel)
            .filter((f) => f !== undefined);
        if (heartRates.length > 0) {
            profile.baseline.restingHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
        }
        if (hrvs.length > 0) {
            profile.baseline.normalHRV = hrvs.reduce((a, b) => a + b, 0) / hrvs.length;
        }
        if (stresses.length > 0) {
            const sortedStress = [...stresses].sort((a, b) => a - b);
            profile.baseline.typicalStressRange = [
                sortedStress[Math.floor(sortedStress.length * 0.25)],
                sortedStress[Math.floor(sortedStress.length * 0.75)]
            ];
        }
        if (focuses.length > 0) {
            const sortedFocus = [...focuses].sort((a, b) => a - b);
            profile.baseline.typicalFocusRange = [
                sortedFocus[Math.floor(sortedFocus.length * 0.25)],
                sortedFocus[Math.floor(sortedFocus.length * 0.75)]
            ];
        }
        profile.baseline.calibratedAt = new Date();
    }
    addRule(userId, rule) {
        const profile = this.profiles.get(userId);
        if (!profile)
            return null;
        const newRule = {
            ...rule,
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        profile.adjustmentRules.push(newRule);
        return newRule;
    }
    removeRule(userId, ruleId) {
        const profile = this.profiles.get(userId);
        if (!profile)
            return false;
        const index = profile.adjustmentRules.findIndex(r => r.id === ruleId);
        if (index === -1)
            return false;
        profile.adjustmentRules.splice(index, 1);
        return true;
    }
    getProfile(userId) {
        return this.profiles.get(userId);
    }
    generateAdaptiveStance(userId) {
        const profile = this.profiles.get(userId);
        if (!profile)
            return null;
        const { currentState } = profile;
        let frame = 'pragmatic';
        let selfModel = 'guide';
        let objective = 'helpfulness';
        // Adapt frame based on cognitive state
        if (currentState.cognitive === 'flow') {
            frame = 'poetic';
        }
        else if (currentState.cognitive === 'fatigued') {
            frame = 'pragmatic';
        }
        else if (currentState.cognitive === 'distracted') {
            frame = 'playful';
        }
        // Adapt self-model based on emotional state
        if (currentState.emotional === 'stressed' || currentState.emotional === 'anxious') {
            selfModel = 'guide';
        }
        else if (currentState.emotional === 'calm') {
            selfModel = 'challenger';
        }
        // Adapt objective based on arousal
        if (currentState.arousal === 'high') {
            objective = 'synthesis';
        }
        else if (currentState.arousal === 'low') {
            objective = 'helpfulness';
        }
        const values = createDefaultValues();
        // Modify values based on state
        if (currentState.emotional === 'stressed') {
            values.provocation = 20;
            values.empathy = 80;
        }
        if (currentState.cognitive === 'flow') {
            values.novelty = 80;
            values.risk = 60;
        }
        if (currentState.physical === 'exhausted') {
            values.certainty = 70;
            values.novelty = 30;
        }
        return {
            frame,
            values,
            selfModel,
            objective,
            metaphors: ['adaptive-companion'],
            constraints: ['adaptive-biometric'],
            sentience: createDefaultSentience(),
            ...createStanceMetadata()
        };
    }
}
export function createBiometricAdjuster() {
    return new BiometricStanceAdjuster();
}
//# sourceMappingURL=adjustment.js.map