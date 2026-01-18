/**
 * Stance Analytics Dashboard
 *
 * Real-time metrics, trend analysis, anomaly detection,
 * and recommendation engine for stance optimization.
 */
function createDefaultMetrics() {
    return {
        currentCoherence: 70,
        averageCoherence: 70,
        peakCoherence: 70,
        totalDrift: 0,
        driftRate: 0,
        sessionCount: 0,
        transformationCount: 0,
        activeTime: 0,
        framesUsed: [],
        selfModelsUsed: [],
        objectivesUsed: []
    };
}
export class StanceAnalytics {
    snapshots = [];
    metrics;
    anomalyHistory = [];
    constructor() {
        this.metrics = createDefaultMetrics();
    }
    recordSnapshot(stance, sessionId) {
        const coherence = this.calculateCoherence(stance);
        this.snapshots.push({
            stance: JSON.parse(JSON.stringify(stance)),
            timestamp: new Date(),
            coherence,
            sessionId
        });
        this.updateMetrics(stance, coherence);
        this.detectAnomalies();
        // Limit snapshot history
        if (this.snapshots.length > 10000) {
            this.snapshots = this.snapshots.slice(-5000);
        }
    }
    calculateCoherence(stance) {
        const values = Object.values(stance.values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.max(0, Math.min(100, 100 - Math.sqrt(variance) * 2));
    }
    updateMetrics(stance, coherence) {
        this.metrics.currentCoherence = coherence;
        const coherences = this.snapshots.map(s => s.coherence);
        this.metrics.averageCoherence = coherences.reduce((a, b) => a + b, 0) / coherences.length;
        this.metrics.peakCoherence = Math.max(...coherences);
        this.metrics.totalDrift = stance.cumulativeDrift;
        this.metrics.transformationCount = this.snapshots.length;
        // Calculate drift rate (drift per snapshot)
        if (this.snapshots.length > 1) {
            const recentSnapshots = this.snapshots.slice(-10);
            const driftChange = recentSnapshots[recentSnapshots.length - 1].stance.cumulativeDrift -
                recentSnapshots[0].stance.cumulativeDrift;
            this.metrics.driftRate = driftChange / recentSnapshots.length;
        }
        // Track unique values
        if (!this.metrics.framesUsed.includes(stance.frame)) {
            this.metrics.framesUsed.push(stance.frame);
        }
        if (!this.metrics.selfModelsUsed.includes(stance.selfModel)) {
            this.metrics.selfModelsUsed.push(stance.selfModel);
        }
        if (!this.metrics.objectivesUsed.includes(stance.objective)) {
            this.metrics.objectivesUsed.push(stance.objective);
        }
        // Update session count
        const uniqueSessions = new Set(this.snapshots.map(s => s.sessionId));
        this.metrics.sessionCount = uniqueSessions.size;
    }
    detectAnomalies() {
        if (this.snapshots.length < 10)
            return;
        const recentSnapshots = this.snapshots.slice(-20);
        const coherences = recentSnapshots.map(s => s.coherence);
        // Calculate statistics
        const mean = coherences.reduce((a, b) => a + b, 0) / coherences.length;
        const stdDev = Math.sqrt(coherences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / coherences.length);
        const latest = this.snapshots[this.snapshots.length - 1];
        // Detect coherence anomalies
        if (latest.coherence < mean - 2 * stdDev) {
            this.recordAnomaly({
                type: 'drop',
                severity: latest.coherence < mean - 3 * stdDev ? 'critical' : 'high',
                field: 'coherence',
                expectedValue: mean,
                actualValue: latest.coherence,
                deviation: (mean - latest.coherence) / stdDev,
                description: `Coherence dropped significantly below normal`
            });
        }
        // Detect drift acceleration
        if (this.metrics.driftRate > 10) {
            this.recordAnomaly({
                type: 'drift-acceleration',
                severity: this.metrics.driftRate > 20 ? 'high' : 'medium',
                field: 'driftRate',
                expectedValue: 5,
                actualValue: this.metrics.driftRate,
                deviation: this.metrics.driftRate / 5,
                description: `Stance drift is accelerating rapidly`
            });
        }
        // Detect value outliers
        const latestStance = latest.stance;
        for (const [key, value] of Object.entries(latestStance.values)) {
            if (value < 10 || value > 90) {
                this.recordAnomaly({
                    type: 'outlier',
                    severity: (value < 5 || value > 95) ? 'high' : 'medium',
                    field: `values.${key}`,
                    expectedValue: 50,
                    actualValue: value,
                    deviation: Math.abs(value - 50) / 25,
                    description: `Value ${key} is at extreme level`
                });
            }
        }
    }
    recordAnomaly(anomaly) {
        // Avoid duplicate anomalies
        const recentSimilar = this.anomalyHistory.find(a => a.type === anomaly.type &&
            a.field === anomaly.field &&
            Date.now() - a.detectedAt.getTime() < 60000);
        if (recentSimilar)
            return;
        this.anomalyHistory.push({
            ...anomaly,
            id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            detectedAt: new Date()
        });
        // Limit history
        if (this.anomalyHistory.length > 100) {
            this.anomalyHistory = this.anomalyHistory.slice(-50);
        }
    }
    generateDashboard() {
        return {
            metrics: { ...this.metrics },
            trends: this.analyzeTrends(),
            anomalies: this.anomalyHistory.slice(-10),
            recommendations: this.generateRecommendations(),
            forecasts: this.generateForecasts(),
            lastUpdated: new Date()
        };
    }
    analyzeTrends() {
        const trends = [];
        if (this.snapshots.length < 5)
            return trends;
        // Coherence trend
        const coherences = this.snapshots.map(s => ({ timestamp: s.timestamp, value: s.coherence }));
        trends.push(this.calculateTrend('coherence', coherences));
        // Drift trend
        const drifts = this.snapshots.map(s => ({
            timestamp: s.timestamp,
            value: s.stance.cumulativeDrift
        }));
        trends.push(this.calculateTrend('drift', drifts));
        // Value trends
        const valueKeys = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
        for (const key of valueKeys) {
            const values = this.snapshots.map(s => ({
                timestamp: s.timestamp,
                value: s.stance.values[key]
            }));
            trends.push(this.calculateTrend(`values.${key}`, values));
        }
        return trends;
    }
    calculateTrend(metric, data) {
        const n = data.length;
        const dataPoints = data.map(d => ({
            timestamp: d.timestamp,
            value: d.value
        }));
        // Simple linear regression
        const xSum = data.reduce((sum, _, i) => sum + i, 0);
        const ySum = data.reduce((sum, d) => sum + d.value, 0);
        const xySum = data.reduce((sum, d, i) => sum + i * d.value, 0);
        const x2Sum = data.reduce((sum, _, i) => sum + i * i, 0);
        const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
        const yMean = ySum / n;
        // Calculate R-squared
        const predictions = data.map((_, i) => yMean + slope * (i - (n - 1) / 2));
        const ssRes = data.reduce((sum, d, i) => sum + Math.pow(d.value - predictions[i], 2), 0);
        const ssTot = data.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0);
        const rSquared = 1 - ssRes / ssTot;
        // Calculate volatility
        const volatility = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0) / n) / yMean;
        let direction;
        if (volatility > 0.3) {
            direction = 'volatile';
        }
        else if (Math.abs(slope) < 0.1) {
            direction = 'stable';
        }
        else {
            direction = slope > 0 ? 'increasing' : 'decreasing';
        }
        return {
            metric,
            direction,
            magnitude: Math.abs(slope),
            period: 'recent',
            dataPoints,
            significance: Math.abs(rSquared)
        };
    }
    generateRecommendations() {
        const recommendations = [];
        // Low coherence recommendation
        if (this.metrics.currentCoherence < 50) {
            recommendations.push({
                id: `rec-${Date.now()}-1`,
                type: 'increase-coherence',
                priority: this.metrics.currentCoherence < 30 ? 'urgent' : 'high',
                title: 'Increase Coherence',
                description: 'Current coherence is below optimal levels',
                action: 'Balance value weights to reduce variance',
                expectedImprovement: 15,
                confidence: 0.8
            });
        }
        // High drift recommendation
        if (this.metrics.driftRate > 10) {
            recommendations.push({
                id: `rec-${Date.now()}-2`,
                type: 'reduce-drift',
                priority: this.metrics.driftRate > 20 ? 'high' : 'medium',
                title: 'Reduce Drift Rate',
                description: 'Stance is evolving too rapidly',
                action: 'Increase transformation stability constraints',
                expectedImprovement: 10,
                confidence: 0.7
            });
        }
        // Value balance recommendation
        const values = this.snapshots.length > 0
            ? Object.values(this.snapshots[this.snapshots.length - 1].stance.values)
            : [];
        const valueRange = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
        if (valueRange > 50) {
            recommendations.push({
                id: `rec-${Date.now()}-3`,
                type: 'balance-values',
                priority: 'medium',
                title: 'Balance Value Weights',
                description: 'Values are highly imbalanced',
                action: 'Adjust extreme values toward center',
                expectedImprovement: 12,
                confidence: 0.75
            });
        }
        // Anomaly recommendations
        const recentAnomalies = this.anomalyHistory.filter(a => Date.now() - a.detectedAt.getTime() < 300000);
        for (const anomaly of recentAnomalies) {
            recommendations.push({
                id: `rec-anomaly-${anomaly.id}`,
                type: 'address-anomaly',
                priority: anomaly.severity === 'critical' ? 'urgent' : 'high',
                title: `Address ${anomaly.type} Anomaly`,
                description: anomaly.description,
                action: `Investigate and correct ${anomaly.field}`,
                expectedImprovement: 8,
                confidence: 0.6
            });
        }
        return recommendations.slice(0, 5);
    }
    generateForecasts() {
        if (this.snapshots.length < 10)
            return [];
        const forecasts = [];
        const horizon = 10;
        // Coherence forecast
        const coherences = this.snapshots.slice(-20).map(s => s.coherence);
        const coherenceForecast = this.forecastSimple(coherences, horizon);
        forecasts.push({
            metric: 'coherence',
            horizon,
            predictions: coherenceForecast.predictions,
            confidenceInterval: coherenceForecast.interval,
            accuracy: 0.7
        });
        // Drift forecast
        const drifts = this.snapshots.slice(-20).map(s => s.stance.cumulativeDrift);
        const driftForecast = this.forecastSimple(drifts, horizon);
        forecasts.push({
            metric: 'drift',
            horizon,
            predictions: driftForecast.predictions,
            confidenceInterval: driftForecast.interval,
            accuracy: 0.65
        });
        return forecasts;
    }
    forecastSimple(data, horizon) {
        const n = data.length;
        const mean = data.reduce((a, b) => a + b, 0) / n;
        const stdDev = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / n);
        // Simple linear extrapolation
        const slope = (data[n - 1] - data[0]) / (n - 1);
        const lastValue = data[n - 1];
        const predictions = [];
        const lower = [];
        const upper = [];
        for (let i = 1; i <= horizon; i++) {
            const predicted = lastValue + slope * i;
            const uncertainty = stdDev * Math.sqrt(i);
            predictions.push({
                step: i,
                value: predicted,
                confidence: Math.max(0.5, 1 - i * 0.05)
            });
            lower.push(predicted - 1.96 * uncertainty);
            upper.push(predicted + 1.96 * uncertainty);
        }
        return { predictions, interval: { lower, upper } };
    }
    getUsageStatistics() {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const dailySessions = new Set(this.snapshots
            .filter(s => now - s.timestamp.getTime() < day)
            .map(s => s.sessionId));
        const weeklySessions = new Set(this.snapshots
            .filter(s => now - s.timestamp.getTime() < 7 * day)
            .map(s => s.sessionId));
        const monthlySessions = new Set(this.snapshots
            .filter(s => now - s.timestamp.getTime() < 30 * day)
            .map(s => s.sessionId));
        const frameCounts = new Map();
        const modelCounts = new Map();
        for (const snapshot of this.snapshots) {
            frameCounts.set(snapshot.stance.frame, (frameCounts.get(snapshot.stance.frame) || 0) + 1);
            modelCounts.set(snapshot.stance.selfModel, (modelCounts.get(snapshot.stance.selfModel) || 0) + 1);
        }
        let mostUsedFrame = 'pragmatic';
        let maxFrameCount = 0;
        for (const [frame, count] of frameCounts) {
            if (count > maxFrameCount) {
                mostUsedFrame = frame;
                maxFrameCount = count;
            }
        }
        let mostUsedSelfModel = 'guide';
        let maxModelCount = 0;
        for (const [model, count] of modelCounts) {
            if (count > maxModelCount) {
                mostUsedSelfModel = model;
                maxModelCount = count;
            }
        }
        return {
            dailyActive: dailySessions.size,
            weeklyActive: weeklySessions.size,
            monthlyActive: monthlySessions.size,
            averageSessionLength: this.snapshots.length / Math.max(1, this.metrics.sessionCount),
            transformationsPerSession: this.metrics.transformationCount / Math.max(1, this.metrics.sessionCount),
            mostUsedFrame,
            mostUsedSelfModel,
            peakUsageTime: '14:00'
        };
    }
    exportDashboard(format) {
        const dashboard = this.generateDashboard();
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        let data;
        switch (format) {
            case 'json':
                data = JSON.stringify(dashboard, null, 2);
                break;
            case 'csv':
                data = this.dashboardToCsv(dashboard);
                break;
            case 'html':
                data = this.dashboardToHtml(dashboard);
                break;
            default:
                data = JSON.stringify(dashboard, null, 2);
        }
        return {
            type: format,
            data,
            filename: `stance-analytics-${timestamp}.${format}`,
            generatedAt: new Date()
        };
    }
    dashboardToCsv(dashboard) {
        const lines = [];
        lines.push('Metric,Value');
        lines.push(`Current Coherence,${dashboard.metrics.currentCoherence}`);
        lines.push(`Average Coherence,${dashboard.metrics.averageCoherence}`);
        lines.push(`Peak Coherence,${dashboard.metrics.peakCoherence}`);
        lines.push(`Total Drift,${dashboard.metrics.totalDrift}`);
        lines.push(`Drift Rate,${dashboard.metrics.driftRate}`);
        lines.push(`Session Count,${dashboard.metrics.sessionCount}`);
        lines.push(`Transformation Count,${dashboard.metrics.transformationCount}`);
        return lines.join('\n');
    }
    dashboardToHtml(dashboard) {
        return `
<!DOCTYPE html>
<html>
<head><title>Stance Analytics Dashboard</title></head>
<body>
  <h1>Stance Analytics Dashboard</h1>
  <h2>Metrics</h2>
  <ul>
    <li>Current Coherence: ${dashboard.metrics.currentCoherence.toFixed(1)}</li>
    <li>Average Coherence: ${dashboard.metrics.averageCoherence.toFixed(1)}</li>
    <li>Total Drift: ${dashboard.metrics.totalDrift.toFixed(1)}</li>
    <li>Drift Rate: ${dashboard.metrics.driftRate.toFixed(2)}</li>
  </ul>
  <h2>Anomalies</h2>
  <ul>
    ${dashboard.anomalies.map(a => `<li>[${a.severity}] ${a.description}</li>`).join('\n')}
  </ul>
  <h2>Recommendations</h2>
  <ul>
    ${dashboard.recommendations.map(r => `<li>[${r.priority}] ${r.title}: ${r.action}</li>`).join('\n')}
  </ul>
</body>
</html>`;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getSnapshots(limit) {
        return limit ? this.snapshots.slice(-limit) : [...this.snapshots];
    }
    clearHistory() {
        this.snapshots = [];
        this.anomalyHistory = [];
        this.metrics = createDefaultMetrics();
    }
}
export function createAnalyticsDashboard() {
    return new StanceAnalytics();
}
//# sourceMappingURL=dashboard.js.map