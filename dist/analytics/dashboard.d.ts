/**
 * Stance Analytics Dashboard
 *
 * Real-time metrics, trend analysis, anomaly detection,
 * and recommendation engine for stance optimization.
 */
import type { Stance, Frame, SelfModel, Objective } from '../types/index.js';
export interface AnalyticsDashboard {
    metrics: DashboardMetrics;
    trends: TrendAnalysis[];
    anomalies: Anomaly[];
    recommendations: Recommendation[];
    forecasts: Forecast[];
    lastUpdated: Date;
}
export interface DashboardMetrics {
    currentCoherence: number;
    averageCoherence: number;
    peakCoherence: number;
    totalDrift: number;
    driftRate: number;
    sessionCount: number;
    transformationCount: number;
    activeTime: number;
    framesUsed: Frame[];
    selfModelsUsed: SelfModel[];
    objectivesUsed: Objective[];
}
export interface TrendAnalysis {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    magnitude: number;
    period: string;
    dataPoints: DataPoint[];
    significance: number;
}
export interface DataPoint {
    timestamp: Date;
    value: number;
    label?: string;
}
export interface Anomaly {
    id: string;
    type: AnomalyType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    field: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
    detectedAt: Date;
    description: string;
}
export type AnomalyType = 'spike' | 'drop' | 'outlier' | 'pattern-break' | 'drift-acceleration' | 'coherence-collapse';
export interface Recommendation {
    id: string;
    type: RecommendationType;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    title: string;
    description: string;
    action: string;
    expectedImprovement: number;
    confidence: number;
}
export type RecommendationType = 'optimize-values' | 'change-frame' | 'reduce-drift' | 'increase-coherence' | 'balance-values' | 'address-anomaly';
export interface Forecast {
    metric: string;
    horizon: number;
    predictions: ForecastPoint[];
    confidenceInterval: {
        lower: number[];
        upper: number[];
    };
    accuracy: number;
}
export interface ForecastPoint {
    step: number;
    value: number;
    confidence: number;
}
export interface UsageStatistics {
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
    averageSessionLength: number;
    transformationsPerSession: number;
    mostUsedFrame: Frame;
    mostUsedSelfModel: SelfModel;
    peakUsageTime: string;
}
export interface StanceSnapshot {
    stance: Stance;
    timestamp: Date;
    coherence: number;
    sessionId: string;
}
export interface ExportFormat {
    type: 'json' | 'csv' | 'pdf' | 'html';
    data: string;
    filename: string;
    generatedAt: Date;
}
export declare class StanceAnalytics {
    private snapshots;
    private metrics;
    private anomalyHistory;
    constructor();
    recordSnapshot(stance: Stance, sessionId: string): void;
    private calculateCoherence;
    private updateMetrics;
    private detectAnomalies;
    private recordAnomaly;
    generateDashboard(): AnalyticsDashboard;
    private analyzeTrends;
    private calculateTrend;
    private generateRecommendations;
    private generateForecasts;
    private forecastSimple;
    getUsageStatistics(): UsageStatistics;
    exportDashboard(format: ExportFormat['type']): ExportFormat;
    private dashboardToCsv;
    private dashboardToHtml;
    getMetrics(): DashboardMetrics;
    getSnapshots(limit?: number): StanceSnapshot[];
    clearHistory(): void;
}
export declare function createAnalyticsDashboard(): StanceAnalytics;
//# sourceMappingURL=dashboard.d.ts.map