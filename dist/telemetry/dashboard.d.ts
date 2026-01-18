/**
 * Real-Time Telemetry Dashboard (Ralph Iteration 7, Feature 2)
 *
 * Stance evolution visualization, operator metrics, memory patterns,
 * coherence tracking, and session analytics with WebSocket support.
 */
import type { Stance, ModeConfig, PlannedOperation, TurnScores } from '../types/index.js';
export interface TelemetryEvent {
    id: string;
    timestamp: Date;
    type: TelemetryEventType;
    data: Record<string, unknown>;
    sessionId: string;
}
export type TelemetryEventType = 'stance_change' | 'operator_applied' | 'memory_access' | 'coherence_warning' | 'turn_complete' | 'session_start' | 'session_end' | 'error';
export interface StanceSnapshot {
    timestamp: Date;
    stance: Stance;
    turnNumber: number;
}
export interface OperatorMetric {
    name: string;
    totalApplications: number;
    successRate: number;
    avgTransformationScore: number;
    avgCoherenceImpact: number;
    lastUsed: Date | null;
    usageBySession: Map<string, number>;
}
export interface MemoryAccessPattern {
    memoryId: string;
    accessCount: number;
    lastAccess: Date;
    retrievalContexts: string[];
}
export interface CoherenceAlert {
    id: string;
    timestamp: Date;
    coherenceScore: number;
    threshold: number;
    stanceAtAlert: Stance;
    operatorsAtAlert: string[];
    resolved: boolean;
}
export interface SessionAnalytics {
    sessionId: string;
    startTime: Date;
    endTime: Date | null;
    turnCount: number;
    avgTransformationScore: number;
    avgCoherenceScore: number;
    avgSentienceScore: number;
    operatorsUsed: Map<string, number>;
    stanceChanges: number;
    memoryAccesses: number;
}
export interface DashboardConfig {
    maxEventsRetained: number;
    snapshotInterval: number;
    coherenceAlertThreshold: number;
    enableRealTimeUpdates: boolean;
    metricsWindowSize: number;
}
export interface DashboardState {
    isRunning: boolean;
    activeSessionId: string | null;
    eventsProcessed: number;
    lastUpdate: Date | null;
}
export type TelemetryListener = (event: TelemetryEvent) => void;
export declare class TelemetryDashboard {
    private config;
    private events;
    private stanceHistory;
    private operatorMetrics;
    private memoryPatterns;
    private coherenceAlerts;
    private sessionAnalytics;
    private listeners;
    private state;
    private turnCounter;
    constructor(config?: Partial<DashboardConfig>);
    /**
     * Start the telemetry dashboard
     */
    start(sessionId: string): void;
    /**
     * Stop the telemetry dashboard
     */
    stop(): void;
    /**
     * Record a telemetry event
     */
    recordEvent(type: TelemetryEventType, data: Record<string, unknown>): void;
    /**
     * Record a stance change
     */
    recordStanceChange(before: Stance, after: Stance): void;
    /**
     * Record operator application
     */
    recordOperatorApplication(operator: PlannedOperation, scores: TurnScores): void;
    /**
     * Record memory access
     */
    recordMemoryAccess(memoryId: string, context: string): void;
    /**
     * Record turn completion
     */
    recordTurnComplete(scores: TurnScores, _config: ModeConfig): void;
    /**
     * Raise a coherence alert
     */
    private raiseCoherenceAlert;
    /**
     * Resolve a coherence alert
     */
    resolveCoherenceAlert(alertId: string): void;
    /**
     * Subscribe to telemetry events
     */
    subscribe(listener: TelemetryListener): () => void;
    /**
     * Get stance evolution over time
     */
    getStanceEvolution(limit?: number): StanceSnapshot[];
    /**
     * Get operator effectiveness heatmap data
     */
    getOperatorHeatmap(): Array<{
        operator: string;
        metric: string;
        value: number;
    }>;
    /**
     * Get memory access hotspots
     */
    getMemoryHotspots(limit?: number): MemoryAccessPattern[];
    /**
     * Get coherence drift tracking data
     */
    getCoherenceDrift(): Array<{
        timestamp: Date;
        coherence: number;
        hasAlert: boolean;
    }>;
    /**
     * Get session analytics
     */
    getSessionAnalytics(sessionId?: string): SessionAnalytics | SessionAnalytics[] | null;
    /**
     * Get active alerts
     */
    getActiveAlerts(): CoherenceAlert[];
    /**
     * Get dashboard state
     */
    getState(): DashboardState;
    /**
     * Get recent events
     */
    getRecentEvents(limit?: number, type?: TelemetryEventType): TelemetryEvent[];
    /**
     * Summarize stance for telemetry
     */
    private summarizeStance;
    /**
     * Get comprehensive dashboard data
     */
    getDashboardData(): {
        state: DashboardState;
        stanceEvolution: StanceSnapshot[];
        operatorMetrics: Array<OperatorMetric & {
            name: string;
        }>;
        memoryHotspots: MemoryAccessPattern[];
        coherenceDrift: Array<{
            timestamp: Date;
            coherence: number;
            hasAlert: boolean;
        }>;
        activeAlerts: CoherenceAlert[];
        recentEvents: TelemetryEvent[];
        sessionSummary: SessionAnalytics | null;
    };
    /**
     * Export telemetry data
     */
    export(): {
        events: TelemetryEvent[];
        stanceHistory: StanceSnapshot[];
        operatorMetrics: Array<Omit<OperatorMetric, 'usageBySession'> & {
            usageBySession: Array<[string, number]>;
        }>;
        memoryPatterns: MemoryAccessPattern[];
        coherenceAlerts: CoherenceAlert[];
        sessionAnalytics: Array<Omit<SessionAnalytics, 'operatorsUsed'> & {
            operatorsUsed: Array<[string, number]>;
        }>;
    };
    /**
     * Import telemetry data
     */
    import(data: ReturnType<TelemetryDashboard['export']>): void;
    /**
     * Reset dashboard
     */
    reset(): void;
}
export declare const telemetryDashboard: TelemetryDashboard;
//# sourceMappingURL=dashboard.d.ts.map