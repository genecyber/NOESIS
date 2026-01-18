/**
 * Performance Benchmarking Suite (Ralph Iteration 10, Feature 4)
 *
 * Automated regression testing, response latency measurement,
 * memory profiling, and comparative benchmark reports.
 */
export interface BenchmarkConfig {
    warmupIterations: number;
    measurementIterations: number;
    timeoutMs: number;
    collectMemory: boolean;
    collectGC: boolean;
    parallel: boolean;
}
export interface BenchmarkSuite {
    id: string;
    name: string;
    description: string;
    benchmarks: Benchmark[];
    createdAt: Date;
    lastRun: Date | null;
    results: SuiteResults | null;
}
export interface Benchmark {
    id: string;
    name: string;
    description: string;
    type: BenchmarkType;
    fn: () => void | Promise<void>;
    setup?: () => void | Promise<void>;
    teardown?: () => void | Promise<void>;
}
export type BenchmarkType = 'latency' | 'throughput' | 'memory' | 'operator' | 'coherence' | 'custom';
export interface BenchmarkResult {
    benchmarkId: string;
    name: string;
    type: BenchmarkType;
    metrics: MetricResults;
    passed: boolean;
    threshold?: ThresholdResult;
    timestamp: Date;
}
export interface MetricResults {
    latency: LatencyMetrics;
    memory: MemoryMetrics;
    throughput: ThroughputMetrics;
    custom: Record<string, number>;
}
export interface LatencyMetrics {
    mean: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    standardDeviation: number;
}
export interface MemoryMetrics {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    deltaHeap: number;
}
export interface ThroughputMetrics {
    operationsPerSecond: number;
    bytesPerSecond: number;
}
export interface ThresholdResult {
    metric: string;
    expected: number;
    actual: number;
    operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
    passed: boolean;
}
export interface SuiteResults {
    suiteId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    benchmarkResults: BenchmarkResult[];
    summary: ResultsSummary;
}
export interface ResultsSummary {
    totalBenchmarks: number;
    passed: number;
    failed: number;
    averageLatency: number;
    peakMemory: number;
    totalDuration: number;
}
export interface RegressionTest {
    id: string;
    name: string;
    baseline: BenchmarkResult;
    threshold: number;
    enabled: boolean;
}
export interface RegressionResult {
    testId: string;
    passed: boolean;
    baselineValue: number;
    currentValue: number;
    deviation: number;
    deviationPercent: number;
}
export interface BenchmarkReport {
    id: string;
    title: string;
    generatedAt: Date;
    suites: SuiteResults[];
    regressions: RegressionResult[];
    comparison?: ComparisonReport;
}
export interface ComparisonReport {
    baselineId: string;
    currentId: string;
    improvements: string[];
    regressions: string[];
    unchanged: string[];
}
export interface BenchmarkStats {
    totalSuites: number;
    totalBenchmarks: number;
    totalRuns: number;
    averageLatency: number;
    regressionTests: number;
}
export declare class PerformanceBenchmarkManager {
    private config;
    private suites;
    private regressionTests;
    private history;
    private stats;
    constructor(config?: Partial<BenchmarkConfig>);
    /**
     * Create a benchmark suite
     */
    createSuite(name: string, description?: string): BenchmarkSuite;
    /**
     * Add a benchmark to a suite
     */
    addBenchmark(suiteId: string, name: string, fn: () => void | Promise<void>, type?: BenchmarkType, options?: {
        description?: string;
        setup?: () => void | Promise<void>;
        teardown?: () => void | Promise<void>;
    }): Benchmark | null;
    /**
     * Run a benchmark suite
     */
    runSuite(suiteId: string): Promise<SuiteResults | null>;
    /**
     * Run a single benchmark
     */
    private runBenchmark;
    /**
     * Collect memory metrics
     */
    private collectMemoryMetrics;
    /**
     * Calculate latency metrics
     */
    private calculateLatencyMetrics;
    /**
     * Calculate memory delta
     */
    private calculateMemoryDelta;
    /**
     * Calculate throughput metrics
     */
    private calculateThroughputMetrics;
    /**
     * Calculate summary
     */
    private calculateSummary;
    /**
     * Update average latency
     */
    private updateAverageLatency;
    /**
     * Create a regression test
     */
    createRegressionTest(name: string, baseline: BenchmarkResult, threshold?: number): RegressionTest;
    /**
     * Run regression tests
     */
    runRegressionTests(currentResults: SuiteResults): RegressionResult[];
    /**
     * Generate benchmark report
     */
    generateReport(title: string, suiteIds: string[]): BenchmarkReport;
    /**
     * Compare two benchmark runs
     */
    compare(baselineId: string, currentId: string): ComparisonReport | null;
    /**
     * Get suite by ID
     */
    getSuite(suiteId: string): BenchmarkSuite | null;
    /**
     * List all suites
     */
    listSuites(): BenchmarkSuite[];
    /**
     * Get history
     */
    getHistory(limit?: number): SuiteResults[];
    /**
     * Get statistics
     */
    getStats(): BenchmarkStats;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const performanceBenchmark: PerformanceBenchmarkManager;
//# sourceMappingURL=performance.d.ts.map