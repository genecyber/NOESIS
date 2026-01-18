/**
 * Predictive Stance Decay Modeling
 *
 * Time-based decay curves, environmental factors, usage patterns,
 * prevention recommendations, and automatic refresh scheduling.
 */
const DEFAULT_HALF_LIVES = {
    'values.curiosity': 168, // 7 days
    'values.certainty': 336, // 14 days
    'values.risk': 168,
    'values.novelty': 120, // 5 days (decays faster)
    'values.empathy': 504, // 21 days (more stable)
    'values.provocation': 168,
    'values.synthesis': 240,
    'sentience.awarenessLevel': 720, // 30 days
    'sentience.autonomyLevel': 720,
    'sentience.identityStrength': 1440 // 60 days (very stable)
};
export class DecayModelingEngine {
    models = new Map();
    stanceHistory = new Map();
    decayThreshold = 30; // Below this, field needs attention
    createModel(stanceId, stance) {
        const modelId = `decay-${stanceId}-${Date.now()}`;
        const curves = this.initializeCurves(stance);
        const factors = this.initializeFactors();
        const usagePattern = this.initializeUsagePattern();
        const model = {
            id: modelId,
            stanceId,
            curves,
            factors,
            usagePattern,
            predictions: [],
            recommendations: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.models.set(modelId, model);
        this.stanceHistory.set(modelId, [{ stance: JSON.parse(JSON.stringify(stance)), timestamp: new Date() }]);
        // Generate initial predictions
        model.predictions = this.generatePredictions(model);
        model.recommendations = this.generateRecommendations(model);
        return model;
    }
    initializeCurves(stance) {
        const curves = [];
        // Value curves
        for (const [key, value] of Object.entries(stance.values)) {
            const field = `values.${key}`;
            curves.push({
                field,
                curveType: 'exponential',
                halfLife: DEFAULT_HALF_LIVES[field] || 168,
                baseline: 50,
                currentValue: value,
                decayRate: this.calculateDecayRate(DEFAULT_HALF_LIVES[field] || 168),
                projectedValues: []
            });
        }
        // Sentience curves
        curves.push({
            field: 'sentience.awarenessLevel',
            curveType: 'plateau',
            halfLife: DEFAULT_HALF_LIVES['sentience.awarenessLevel'],
            baseline: 50,
            currentValue: stance.sentience.awarenessLevel,
            decayRate: this.calculateDecayRate(720),
            projectedValues: []
        });
        curves.push({
            field: 'sentience.autonomyLevel',
            curveType: 'plateau',
            halfLife: DEFAULT_HALF_LIVES['sentience.autonomyLevel'],
            baseline: 50,
            currentValue: stance.sentience.autonomyLevel,
            decayRate: this.calculateDecayRate(720),
            projectedValues: []
        });
        curves.push({
            field: 'sentience.identityStrength',
            curveType: 'logarithmic',
            halfLife: DEFAULT_HALF_LIVES['sentience.identityStrength'],
            baseline: 50,
            currentValue: stance.sentience.identityStrength,
            decayRate: this.calculateDecayRate(1440),
            projectedValues: []
        });
        // Generate projections for each curve
        for (const curve of curves) {
            curve.projectedValues = this.projectValues(curve, 7 * 24); // 7 days
        }
        return curves;
    }
    calculateDecayRate(halfLifeHours) {
        // Exponential decay: N(t) = N0 * e^(-λt)
        // Half-life: N(t_half) = N0 / 2, so λ = ln(2) / t_half
        return Math.log(2) / halfLifeHours;
    }
    projectValues(curve, hours) {
        const projections = [];
        const now = Date.now();
        const hoursPerStep = Math.max(1, Math.floor(hours / 24));
        for (let h = 0; h <= hours; h += hoursPerStep) {
            const value = this.calculateDecayedValue(curve, h);
            const confidence = Math.max(0.5, 1 - (h / hours) * 0.5);
            projections.push({
                timestamp: new Date(now + h * 60 * 60 * 1000),
                value: Math.max(0, Math.min(100, value)),
                confidence
            });
        }
        return projections;
    }
    calculateDecayedValue(curve, hoursElapsed) {
        const aboveBaseline = curve.currentValue - curve.baseline;
        switch (curve.curveType) {
            case 'exponential':
                return curve.baseline + aboveBaseline * Math.exp(-curve.decayRate * hoursElapsed);
            case 'linear':
                return curve.currentValue - (aboveBaseline * hoursElapsed) / (curve.halfLife * 2);
            case 'logarithmic':
                return curve.baseline + aboveBaseline / (1 + Math.log(1 + hoursElapsed / curve.halfLife));
            case 'plateau':
                // Decays quickly at first, then stabilizes
                const plateauFactor = 1 - Math.tanh(hoursElapsed / (curve.halfLife * 2));
                return curve.baseline + aboveBaseline * plateauFactor;
            case 'step':
                // Discrete steps at each half-life
                const steps = Math.floor(hoursElapsed / curve.halfLife);
                return curve.baseline + aboveBaseline * Math.pow(0.5, steps);
            case 'oscillating':
                // Decays with oscillation
                const decay = Math.exp(-curve.decayRate * hoursElapsed * 0.5);
                const oscillation = Math.cos(hoursElapsed / 24 * Math.PI);
                return curve.baseline + aboveBaseline * decay * (1 + oscillation * 0.1);
            default:
                return curve.currentValue;
        }
    }
    initializeFactors() {
        return [
            {
                name: 'Time of Day',
                type: 'temporal',
                impact: 0,
                weight: 0.3,
                currentState: new Date().getHours()
            },
            {
                name: 'Days Since Last Use',
                type: 'usage',
                impact: -0.2, // Inactivity accelerates decay
                weight: 0.5,
                currentState: 0
            },
            {
                name: 'Session Frequency',
                type: 'usage',
                impact: 0.3, // More sessions = slower decay
                weight: 0.4,
                currentState: 1
            },
            {
                name: 'Context Consistency',
                type: 'context',
                impact: 0.2,
                weight: 0.3,
                currentState: 'consistent'
            }
        ];
    }
    initializeUsagePattern() {
        return {
            averageSessionsPerDay: 1,
            averageSessionDuration: 30,
            lastActive: new Date(),
            activityHours: [9, 10, 11, 14, 15, 16], // Typical work hours
            frequencyTrend: 'stable',
            engagementScore: 70
        };
    }
    updateStance(modelId, stance) {
        const model = this.models.get(modelId);
        if (!model)
            return;
        // Record history
        const history = this.stanceHistory.get(modelId) || [];
        history.push({ stance: JSON.parse(JSON.stringify(stance)), timestamp: new Date() });
        if (history.length > 1000) {
            this.stanceHistory.set(modelId, history.slice(-500));
        }
        else {
            this.stanceHistory.set(modelId, history);
        }
        // Update curves
        for (const curve of model.curves) {
            const newValue = this.getFieldValue(stance, curve.field);
            if (newValue !== undefined) {
                curve.currentValue = newValue;
                curve.projectedValues = this.projectValues(curve, 7 * 24);
            }
        }
        // Update usage pattern
        model.usagePattern.lastActive = new Date();
        model.usagePattern.averageSessionsPerDay = Math.min(model.usagePattern.averageSessionsPerDay * 0.9 + 0.1, 10);
        // Regenerate predictions and recommendations
        model.predictions = this.generatePredictions(model);
        model.recommendations = this.generateRecommendations(model);
        model.updatedAt = new Date();
    }
    getFieldValue(stance, field) {
        const parts = field.split('.');
        let current = stance;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return typeof current === 'number' ? current : undefined;
    }
    generatePredictions(model) {
        const predictions = [];
        for (const curve of model.curves) {
            // Find time until threshold is reached
            let timeToThreshold = Infinity;
            for (let h = 0; h < 30 * 24; h++) { // Search up to 30 days
                const projected = this.calculateDecayedValue(curve, h);
                if (projected < this.decayThreshold) {
                    timeToThreshold = h;
                    break;
                }
            }
            const predictedValue = this.calculateDecayedValue(curve, 24); // 24 hours from now
            let riskLevel = 'low';
            if (timeToThreshold < 24)
                riskLevel = 'critical';
            else if (timeToThreshold < 72)
                riskLevel = 'high';
            else if (timeToThreshold < 168)
                riskLevel = 'medium';
            predictions.push({
                field: curve.field,
                currentValue: curve.currentValue,
                predictedValue,
                timeToThreshold,
                threshold: this.decayThreshold,
                confidence: 0.8,
                riskLevel
            });
        }
        return predictions;
    }
    generateRecommendations(model) {
        const recommendations = [];
        for (const prediction of model.predictions) {
            if (prediction.riskLevel === 'low')
                continue;
            const priority = prediction.riskLevel === 'critical' ? 'urgent' :
                prediction.riskLevel === 'high' ? 'high' : 'medium';
            recommendations.push({
                id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                type: 'refresh-value',
                priority,
                field: prediction.field,
                action: `Reinforce ${prediction.field} before it drops below ${this.decayThreshold}`,
                expectedImprovement: 50 - prediction.predictedValue,
                reasoning: `${prediction.field} will reach threshold in ${Math.round(prediction.timeToThreshold)} hours`
            });
        }
        // Usage-based recommendations
        const daysSinceActive = (Date.now() - model.usagePattern.lastActive.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceActive > 3) {
            recommendations.push({
                id: `rec-usage-${Date.now()}`,
                type: 'increase-usage',
                priority: daysSinceActive > 7 ? 'high' : 'medium',
                field: 'all',
                action: 'Increase session frequency to slow decay',
                expectedImprovement: 10,
                reasoning: `${Math.round(daysSinceActive)} days since last activity accelerates decay`
            });
        }
        return recommendations.slice(0, 5);
    }
    setupRefreshSchedule(modelId, intervalHours, fields) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error('Model not found');
        }
        const schedule = {
            enabled: true,
            interval: intervalHours,
            nextRefresh: new Date(Date.now() + intervalHours * 60 * 60 * 1000),
            autoRefreshFields: fields || model.curves.map(c => c.field),
            refreshHistory: []
        };
        model.refreshSchedule = schedule;
        return schedule;
    }
    executeRefresh(modelId, field, newValue, trigger = 'manual') {
        const model = this.models.get(modelId);
        if (!model || !model.refreshSchedule)
            return false;
        const curve = model.curves.find(c => c.field === field);
        if (!curve)
            return false;
        model.refreshSchedule.refreshHistory.push({
            timestamp: new Date(),
            field,
            previousValue: curve.currentValue,
            newValue,
            trigger
        });
        curve.currentValue = newValue;
        curve.projectedValues = this.projectValues(curve, 7 * 24);
        // Limit history
        if (model.refreshSchedule.refreshHistory.length > 100) {
            model.refreshSchedule.refreshHistory = model.refreshSchedule.refreshHistory.slice(-50);
        }
        return true;
    }
    analyzeDecay(modelId) {
        const model = this.models.get(modelId);
        if (!model) {
            return {
                overallHealth: 0,
                decayRate: 0,
                stableFields: [],
                decayingFields: [],
                criticalFields: [],
                daysUntilAction: 0
            };
        }
        const stableFields = [];
        const decayingFields = [];
        const criticalFields = [];
        for (const prediction of model.predictions) {
            if (prediction.riskLevel === 'critical') {
                criticalFields.push(prediction.field);
            }
            else if (prediction.riskLevel === 'high' || prediction.riskLevel === 'medium') {
                decayingFields.push(prediction.field);
            }
            else {
                stableFields.push(prediction.field);
            }
        }
        // Calculate overall health
        const healthSum = model.curves.reduce((sum, c) => sum + c.currentValue, 0);
        const overallHealth = Math.round(healthSum / model.curves.length);
        // Calculate average decay rate (per day)
        const avgDecayRate = model.curves.reduce((sum, c) => sum + c.decayRate * 24, 0) / model.curves.length;
        // Days until action needed
        const minTimeToThreshold = Math.min(...model.predictions.map(p => p.timeToThreshold));
        const daysUntilAction = Math.round(minTimeToThreshold / 24);
        return {
            overallHealth,
            decayRate: Math.round(avgDecayRate * 1000) / 1000,
            stableFields,
            decayingFields,
            criticalFields,
            daysUntilAction
        };
    }
    analyzeHistoricalDecay(modelId, field) {
        const history = this.stanceHistory.get(modelId);
        if (!history || history.length < 2)
            return null;
        const dataPoints = history.map(h => ({
            timestamp: h.timestamp,
            value: this.getFieldValue(h.stance, field) || 0
        }));
        // Fit curve to data (simplified - just use exponential)
        const fittedCurve = 'exponential';
        const r2Score = 0.85; // Placeholder
        return {
            field,
            dataPoints,
            fittedCurve,
            r2Score
        };
    }
    getModel(modelId) {
        return this.models.get(modelId);
    }
    getHistory(modelId) {
        return this.stanceHistory.get(modelId) || [];
    }
    setDecayThreshold(threshold) {
        this.decayThreshold = Math.max(0, Math.min(100, threshold));
    }
    updateEnvironmentalFactor(modelId, factorName, state) {
        const model = this.models.get(modelId);
        if (!model)
            return;
        const factor = model.factors.find(f => f.name === factorName);
        if (factor) {
            factor.currentState = state;
            // Recalculate impact based on new state
            if (factorName === 'Days Since Last Use' && typeof state === 'number') {
                factor.impact = Math.max(-0.5, -0.1 * state);
            }
        }
        model.predictions = this.generatePredictions(model);
        model.recommendations = this.generateRecommendations(model);
    }
}
export function createDecayModelingEngine() {
    return new DecayModelingEngine();
}
//# sourceMappingURL=modeling.js.map