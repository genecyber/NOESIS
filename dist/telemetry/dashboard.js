/**
 * Real-Time Telemetry Dashboard (Ralph Iteration 7, Feature 2)
 *
 * Stance evolution visualization, operator metrics, memory patterns,
 * coherence tracking, and session analytics with WebSocket support.
 */
// ============================================================================
// Telemetry Dashboard
// ============================================================================
export class TelemetryDashboard {
    config;
    events = [];
    stanceHistory = [];
    operatorMetrics = new Map();
    memoryPatterns = new Map();
    coherenceAlerts = [];
    sessionAnalytics = new Map();
    listeners = new Set();
    state;
    turnCounter = 0;
    constructor(config = {}) {
        this.config = {
            maxEventsRetained: 10000,
            snapshotInterval: 1,
            coherenceAlertThreshold: 30,
            enableRealTimeUpdates: true,
            metricsWindowSize: 24,
            ...config
        };
        this.state = {
            isRunning: false,
            activeSessionId: null,
            eventsProcessed: 0,
            lastUpdate: null
        };
    }
    /**
     * Start the telemetry dashboard
     */
    start(sessionId) {
        this.state.isRunning = true;
        this.state.activeSessionId = sessionId;
        this.recordEvent('session_start', { sessionId });
        this.sessionAnalytics.set(sessionId, {
            sessionId,
            startTime: new Date(),
            endTime: null,
            turnCount: 0,
            avgTransformationScore: 0,
            avgCoherenceScore: 0,
            avgSentienceScore: 0,
            operatorsUsed: new Map(),
            stanceChanges: 0,
            memoryAccesses: 0
        });
    }
    /**
     * Stop the telemetry dashboard
     */
    stop() {
        if (this.state.activeSessionId) {
            const analytics = this.sessionAnalytics.get(this.state.activeSessionId);
            if (analytics) {
                analytics.endTime = new Date();
            }
            this.recordEvent('session_end', { sessionId: this.state.activeSessionId });
        }
        this.state.isRunning = false;
        this.state.activeSessionId = null;
    }
    /**
     * Record a telemetry event
     */
    recordEvent(type, data) {
        const event = {
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            data,
            sessionId: this.state.activeSessionId || 'unknown'
        };
        this.events.push(event);
        this.state.eventsProcessed++;
        this.state.lastUpdate = new Date();
        // Trim old events
        if (this.events.length > this.config.maxEventsRetained) {
            this.events = this.events.slice(-this.config.maxEventsRetained);
        }
        // Notify listeners
        if (this.config.enableRealTimeUpdates) {
            for (const listener of this.listeners) {
                try {
                    listener(event);
                }
                catch {
                    // Ignore listener errors
                }
            }
        }
    }
    /**
     * Record a stance change
     */
    recordStanceChange(before, after) {
        this.turnCounter++;
        // Take snapshot at intervals
        if (this.turnCounter % this.config.snapshotInterval === 0) {
            this.stanceHistory.push({
                timestamp: new Date(),
                stance: { ...after },
                turnNumber: this.turnCounter
            });
        }
        // Detect significant changes
        const changes = [];
        if (before.frame !== after.frame)
            changes.push(`frame: ${before.frame} → ${after.frame}`);
        if (before.selfModel !== after.selfModel)
            changes.push(`selfModel: ${before.selfModel} → ${after.selfModel}`);
        if (before.objective !== after.objective)
            changes.push(`objective: ${before.objective} → ${after.objective}`);
        this.recordEvent('stance_change', {
            before: this.summarizeStance(before),
            after: this.summarizeStance(after),
            changes,
            turnNumber: this.turnCounter
        });
        // Update session analytics
        if (this.state.activeSessionId) {
            const analytics = this.sessionAnalytics.get(this.state.activeSessionId);
            if (analytics && changes.length > 0) {
                analytics.stanceChanges++;
            }
        }
    }
    /**
     * Record operator application
     */
    recordOperatorApplication(operator, scores) {
        const metric = this.operatorMetrics.get(operator.name) || {
            name: operator.name,
            totalApplications: 0,
            successRate: 0,
            avgTransformationScore: 0,
            avgCoherenceImpact: 0,
            lastUsed: null,
            usageBySession: new Map()
        };
        // Update metrics
        const oldTotal = metric.totalApplications;
        metric.totalApplications++;
        metric.lastUsed = new Date();
        // Rolling average for scores
        metric.avgTransformationScore =
            (metric.avgTransformationScore * oldTotal + scores.transformation) / metric.totalApplications;
        metric.avgCoherenceImpact =
            (metric.avgCoherenceImpact * oldTotal + scores.coherence) / metric.totalApplications;
        // Success is transformation > 50
        const successCount = (metric.successRate * oldTotal) + (scores.transformation > 50 ? 1 : 0);
        metric.successRate = successCount / metric.totalApplications;
        // Track by session
        if (this.state.activeSessionId) {
            const sessionCount = metric.usageBySession.get(this.state.activeSessionId) || 0;
            metric.usageBySession.set(this.state.activeSessionId, sessionCount + 1);
        }
        this.operatorMetrics.set(operator.name, metric);
        this.recordEvent('operator_applied', {
            operator: operator.name,
            transformationScore: scores.transformation,
            coherenceScore: scores.coherence,
            cumulativeUsage: metric.totalApplications
        });
        // Update session analytics
        if (this.state.activeSessionId) {
            const analytics = this.sessionAnalytics.get(this.state.activeSessionId);
            if (analytics) {
                const count = analytics.operatorsUsed.get(operator.name) || 0;
                analytics.operatorsUsed.set(operator.name, count + 1);
            }
        }
    }
    /**
     * Record memory access
     */
    recordMemoryAccess(memoryId, context) {
        const pattern = this.memoryPatterns.get(memoryId) || {
            memoryId,
            accessCount: 0,
            lastAccess: new Date(),
            retrievalContexts: []
        };
        pattern.accessCount++;
        pattern.lastAccess = new Date();
        pattern.retrievalContexts.push(context);
        // Keep only recent contexts
        if (pattern.retrievalContexts.length > 100) {
            pattern.retrievalContexts = pattern.retrievalContexts.slice(-100);
        }
        this.memoryPatterns.set(memoryId, pattern);
        this.recordEvent('memory_access', {
            memoryId,
            accessCount: pattern.accessCount,
            context
        });
        // Update session analytics
        if (this.state.activeSessionId) {
            const analytics = this.sessionAnalytics.get(this.state.activeSessionId);
            if (analytics) {
                analytics.memoryAccesses++;
            }
        }
    }
    /**
     * Record turn completion
     */
    recordTurnComplete(scores, _config) {
        this.recordEvent('turn_complete', {
            scores,
            turnNumber: this.turnCounter
        });
        // Check for coherence warning
        if (scores.coherence < this.config.coherenceAlertThreshold) {
            this.raiseCoherenceAlert(scores.coherence);
        }
        // Update session analytics
        if (this.state.activeSessionId) {
            const analytics = this.sessionAnalytics.get(this.state.activeSessionId);
            if (analytics) {
                const oldCount = analytics.turnCount;
                analytics.turnCount++;
                analytics.avgTransformationScore =
                    (analytics.avgTransformationScore * oldCount + scores.transformation) / analytics.turnCount;
                analytics.avgCoherenceScore =
                    (analytics.avgCoherenceScore * oldCount + scores.coherence) / analytics.turnCount;
                analytics.avgSentienceScore =
                    (analytics.avgSentienceScore * oldCount + scores.sentience) / analytics.turnCount;
            }
        }
    }
    /**
     * Raise a coherence alert
     */
    raiseCoherenceAlert(coherenceScore) {
        const alert = {
            id: `alert-${Date.now()}`,
            timestamp: new Date(),
            coherenceScore,
            threshold: this.config.coherenceAlertThreshold,
            stanceAtAlert: this.stanceHistory.length > 0
                ? this.stanceHistory[this.stanceHistory.length - 1].stance
                : {},
            operatorsAtAlert: [...this.operatorMetrics.keys()],
            resolved: false
        };
        this.coherenceAlerts.push(alert);
        this.recordEvent('coherence_warning', {
            alertId: alert.id,
            coherenceScore,
            threshold: this.config.coherenceAlertThreshold
        });
    }
    /**
     * Resolve a coherence alert
     */
    resolveCoherenceAlert(alertId) {
        const alert = this.coherenceAlerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
        }
    }
    /**
     * Subscribe to telemetry events
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Get stance evolution over time
     */
    getStanceEvolution(limit) {
        const snapshots = [...this.stanceHistory];
        return limit ? snapshots.slice(-limit) : snapshots;
    }
    /**
     * Get operator effectiveness heatmap data
     */
    getOperatorHeatmap() {
        const data = [];
        for (const [name, metric] of this.operatorMetrics) {
            data.push({ operator: name, metric: 'usage', value: metric.totalApplications });
            data.push({ operator: name, metric: 'success_rate', value: metric.successRate * 100 });
            data.push({ operator: name, metric: 'transformation', value: metric.avgTransformationScore });
            data.push({ operator: name, metric: 'coherence_impact', value: metric.avgCoherenceImpact });
        }
        return data;
    }
    /**
     * Get memory access hotspots
     */
    getMemoryHotspots(limit = 20) {
        return [...this.memoryPatterns.values()]
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);
    }
    /**
     * Get coherence drift tracking data
     */
    getCoherenceDrift() {
        const driftData = [];
        // Extract from turn_complete events
        for (const event of this.events) {
            if (event.type === 'turn_complete') {
                const scores = event.data.scores;
                const hasAlert = this.coherenceAlerts.some(a => Math.abs(a.timestamp.getTime() - event.timestamp.getTime()) < 1000);
                driftData.push({
                    timestamp: event.timestamp,
                    coherence: scores.coherence,
                    hasAlert
                });
            }
        }
        return driftData;
    }
    /**
     * Get session analytics
     */
    getSessionAnalytics(sessionId) {
        if (sessionId) {
            return this.sessionAnalytics.get(sessionId) || null;
        }
        return [...this.sessionAnalytics.values()];
    }
    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return this.coherenceAlerts.filter(a => !a.resolved);
    }
    /**
     * Get dashboard state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get recent events
     */
    getRecentEvents(limit = 100, type) {
        let events = [...this.events];
        if (type) {
            events = events.filter(e => e.type === type);
        }
        return events.slice(-limit);
    }
    /**
     * Summarize stance for telemetry
     */
    summarizeStance(stance) {
        return {
            frame: stance.frame,
            selfModel: stance.selfModel,
            objective: stance.objective,
            awarenessLevel: stance.sentience.awarenessLevel,
            cumulativeDrift: stance.cumulativeDrift
        };
    }
    /**
     * Get comprehensive dashboard data
     */
    getDashboardData() {
        return {
            state: this.getState(),
            stanceEvolution: this.getStanceEvolution(50),
            operatorMetrics: [...this.operatorMetrics.entries()].map(([name, m]) => ({ ...m, name })),
            memoryHotspots: this.getMemoryHotspots(10),
            coherenceDrift: this.getCoherenceDrift(),
            activeAlerts: this.getActiveAlerts(),
            recentEvents: this.getRecentEvents(20),
            sessionSummary: this.state.activeSessionId
                ? this.sessionAnalytics.get(this.state.activeSessionId) || null
                : null
        };
    }
    /**
     * Export telemetry data
     */
    export() {
        return {
            events: this.events,
            stanceHistory: this.stanceHistory,
            operatorMetrics: [...this.operatorMetrics.entries()].map(([_, m]) => ({
                name: m.name,
                totalApplications: m.totalApplications,
                successRate: m.successRate,
                avgTransformationScore: m.avgTransformationScore,
                avgCoherenceImpact: m.avgCoherenceImpact,
                lastUsed: m.lastUsed,
                usageBySession: [...m.usageBySession.entries()]
            })),
            memoryPatterns: [...this.memoryPatterns.values()],
            coherenceAlerts: this.coherenceAlerts,
            sessionAnalytics: [...this.sessionAnalytics.values()].map(s => ({
                sessionId: s.sessionId,
                startTime: s.startTime,
                endTime: s.endTime,
                turnCount: s.turnCount,
                avgTransformationScore: s.avgTransformationScore,
                avgCoherenceScore: s.avgCoherenceScore,
                avgSentienceScore: s.avgSentienceScore,
                stanceChanges: s.stanceChanges,
                memoryAccesses: s.memoryAccesses,
                operatorsUsed: [...s.operatorsUsed.entries()]
            }))
        };
    }
    /**
     * Import telemetry data
     */
    import(data) {
        this.events = data.events;
        this.stanceHistory = data.stanceHistory;
        this.operatorMetrics.clear();
        for (const metric of data.operatorMetrics) {
            this.operatorMetrics.set(metric.name, {
                ...metric,
                usageBySession: new Map(metric.usageBySession)
            });
        }
        this.memoryPatterns.clear();
        for (const pattern of data.memoryPatterns) {
            this.memoryPatterns.set(pattern.memoryId, pattern);
        }
        this.coherenceAlerts = data.coherenceAlerts;
        this.sessionAnalytics.clear();
        for (const analytics of data.sessionAnalytics) {
            this.sessionAnalytics.set(analytics.sessionId, {
                ...analytics,
                operatorsUsed: new Map(analytics.operatorsUsed)
            });
        }
    }
    /**
     * Reset dashboard
     */
    reset() {
        this.events = [];
        this.stanceHistory = [];
        this.operatorMetrics.clear();
        this.memoryPatterns.clear();
        this.coherenceAlerts = [];
        this.sessionAnalytics.clear();
        this.turnCounter = 0;
        this.state = {
            isRunning: false,
            activeSessionId: null,
            eventsProcessed: 0,
            lastUpdate: null
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const telemetryDashboard = new TelemetryDashboard();
//# sourceMappingURL=dashboard.js.map