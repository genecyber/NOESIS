/**
 * Performance Benchmarking Suite (Ralph Iteration 10, Feature 4)
 *
 * Automated regression testing, response latency measurement,
 * memory profiling, and comparative benchmark reports.
 */
// ============================================================================
// Performance Benchmark Manager
// ============================================================================
export class PerformanceBenchmarkManager {
    config;
    suites = new Map();
    regressionTests = new Map();
    history = [];
    stats;
    constructor(config = {}) {
        this.config = {
            warmupIterations: 3,
            measurementIterations: 10,
            timeoutMs: 30000,
            collectMemory: true,
            collectGC: false,
            parallel: false,
            ...config
        };
        this.stats = {
            totalSuites: 0,
            totalBenchmarks: 0,
            totalRuns: 0,
            averageLatency: 0,
            regressionTests: 0
        };
    }
    /**
     * Create a benchmark suite
     */
    createSuite(name, description = '') {
        const suite = {
            id: `suite-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name,
            description,
            benchmarks: [],
            createdAt: new Date(),
            lastRun: null,
            results: null
        };
        this.suites.set(suite.id, suite);
        this.stats.totalSuites++;
        return suite;
    }
    /**
     * Add a benchmark to a suite
     */
    addBenchmark(suiteId, name, fn, type = 'latency', options = {}) {
        const suite = this.suites.get(suiteId);
        if (!suite)
            return null;
        const benchmark = {
            id: `bench-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name,
            description: options.description || '',
            type,
            fn,
            setup: options.setup,
            teardown: options.teardown
        };
        suite.benchmarks.push(benchmark);
        this.stats.totalBenchmarks++;
        return benchmark;
    }
    /**
     * Run a benchmark suite
     */
    async runSuite(suiteId) {
        const suite = this.suites.get(suiteId);
        if (!suite)
            return null;
        const startTime = new Date();
        const benchmarkResults = [];
        for (const benchmark of suite.benchmarks) {
            const result = await this.runBenchmark(benchmark);
            benchmarkResults.push(result);
        }
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const results = {
            suiteId,
            startTime,
            endTime,
            duration,
            benchmarkResults,
            summary: this.calculateSummary(benchmarkResults, duration)
        };
        suite.results = results;
        suite.lastRun = new Date();
        this.history.push(results);
        this.stats.totalRuns++;
        this.updateAverageLatency(results);
        return results;
    }
    /**
     * Run a single benchmark
     */
    async runBenchmark(benchmark) {
        const latencies = [];
        let memoryBefore = null;
        let memoryAfter = null;
        // Setup
        if (benchmark.setup) {
            await benchmark.setup();
        }
        // Warmup
        for (let i = 0; i < this.config.warmupIterations; i++) {
            await benchmark.fn();
        }
        // Collect initial memory
        if (this.config.collectMemory) {
            memoryBefore = this.collectMemoryMetrics();
        }
        // Measurement iterations
        for (let i = 0; i < this.config.measurementIterations; i++) {
            const start = performance.now();
            await benchmark.fn();
            const end = performance.now();
            latencies.push(end - start);
        }
        // Collect final memory
        if (this.config.collectMemory) {
            memoryAfter = this.collectMemoryMetrics();
        }
        // Teardown
        if (benchmark.teardown) {
            await benchmark.teardown();
        }
        // Calculate metrics
        const latencyMetrics = this.calculateLatencyMetrics(latencies);
        const memoryMetrics = this.calculateMemoryDelta(memoryBefore, memoryAfter);
        const throughputMetrics = this.calculateThroughputMetrics(latencies);
        return {
            benchmarkId: benchmark.id,
            name: benchmark.name,
            type: benchmark.type,
            metrics: {
                latency: latencyMetrics,
                memory: memoryMetrics,
                throughput: throughputMetrics,
                custom: {}
            },
            passed: true,
            timestamp: new Date()
        };
    }
    /**
     * Collect memory metrics
     */
    collectMemoryMetrics() {
        // In a real implementation, this would use process.memoryUsage()
        return {
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            rss: 0,
            deltaHeap: 0
        };
    }
    /**
     * Calculate latency metrics
     */
    calculateLatencyMetrics(latencies) {
        const sorted = [...latencies].sort((a, b) => a - b);
        const n = sorted.length;
        const mean = latencies.reduce((a, b) => a + b, 0) / n;
        const median = n % 2 === 0
            ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
            : sorted[Math.floor(n / 2)];
        const variance = latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const standardDeviation = Math.sqrt(variance);
        return {
            mean,
            median,
            p95: sorted[Math.floor(n * 0.95)] || sorted[n - 1],
            p99: sorted[Math.floor(n * 0.99)] || sorted[n - 1],
            min: sorted[0],
            max: sorted[n - 1],
            standardDeviation
        };
    }
    /**
     * Calculate memory delta
     */
    calculateMemoryDelta(before, after) {
        if (!before || !after) {
            return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, deltaHeap: 0 };
        }
        return {
            heapUsed: after.heapUsed,
            heapTotal: after.heapTotal,
            external: after.external,
            rss: after.rss,
            deltaHeap: after.heapUsed - before.heapUsed
        };
    }
    /**
     * Calculate throughput metrics
     */
    calculateThroughputMetrics(latencies) {
        const totalTime = latencies.reduce((a, b) => a + b, 0);
        const operationsPerSecond = totalTime > 0
            ? (latencies.length / totalTime) * 1000
            : 0;
        return {
            operationsPerSecond,
            bytesPerSecond: 0 // Would need actual byte measurements
        };
    }
    /**
     * Calculate summary
     */
    calculateSummary(results, duration) {
        const passed = results.filter(r => r.passed).length;
        const failed = results.length - passed;
        const avgLatency = results.reduce((sum, r) => sum + r.metrics.latency.mean, 0) / results.length;
        const peakMemory = Math.max(...results.map(r => r.metrics.memory.heapUsed));
        return {
            totalBenchmarks: results.length,
            passed,
            failed,
            averageLatency: avgLatency,
            peakMemory,
            totalDuration: duration
        };
    }
    /**
     * Update average latency
     */
    updateAverageLatency(results) {
        const n = this.stats.totalRuns;
        this.stats.averageLatency = (this.stats.averageLatency * (n - 1) + results.summary.averageLatency) / n;
    }
    /**
     * Create a regression test
     */
    createRegressionTest(name, baseline, threshold = 10) {
        const test = {
            id: `regtest-${Date.now()}`,
            name,
            baseline,
            threshold,
            enabled: true
        };
        this.regressionTests.set(test.id, test);
        this.stats.regressionTests++;
        return test;
    }
    /**
     * Run regression tests
     */
    runRegressionTests(currentResults) {
        const results = [];
        for (const test of this.regressionTests.values()) {
            if (!test.enabled)
                continue;
            const currentBenchmark = currentResults.benchmarkResults.find(r => r.name === test.baseline.name);
            if (!currentBenchmark)
                continue;
            const baselineValue = test.baseline.metrics.latency.mean;
            const currentValue = currentBenchmark.metrics.latency.mean;
            const deviation = currentValue - baselineValue;
            const deviationPercent = (deviation / baselineValue) * 100;
            results.push({
                testId: test.id,
                passed: Math.abs(deviationPercent) <= test.threshold,
                baselineValue,
                currentValue,
                deviation,
                deviationPercent
            });
        }
        return results;
    }
    /**
     * Generate benchmark report
     */
    generateReport(title, suiteIds) {
        const suites = suiteIds
            .map(id => this.suites.get(id)?.results)
            .filter((r) => r !== null && r !== undefined);
        const latestSuite = suites[suites.length - 1];
        const regressions = latestSuite
            ? this.runRegressionTests(latestSuite)
            : [];
        return {
            id: `report-${Date.now()}`,
            title,
            generatedAt: new Date(),
            suites,
            regressions
        };
    }
    /**
     * Compare two benchmark runs
     */
    compare(baselineId, currentId) {
        const baselineSuite = this.history.find(h => h.suiteId === baselineId);
        const currentSuite = this.history.find(h => h.suiteId === currentId);
        if (!baselineSuite || !currentSuite)
            return null;
        const improvements = [];
        const regressions = [];
        const unchanged = [];
        for (const current of currentSuite.benchmarkResults) {
            const baseline = baselineSuite.benchmarkResults.find(b => b.name === current.name);
            if (!baseline)
                continue;
            const diff = ((current.metrics.latency.mean - baseline.metrics.latency.mean) /
                baseline.metrics.latency.mean) * 100;
            if (diff < -5) {
                improvements.push(`${current.name}: ${diff.toFixed(1)}% faster`);
            }
            else if (diff > 5) {
                regressions.push(`${current.name}: ${diff.toFixed(1)}% slower`);
            }
            else {
                unchanged.push(current.name);
            }
        }
        return {
            baselineId,
            currentId,
            improvements,
            regressions,
            unchanged
        };
    }
    /**
     * Get suite by ID
     */
    getSuite(suiteId) {
        return this.suites.get(suiteId) || null;
    }
    /**
     * List all suites
     */
    listSuites() {
        return [...this.suites.values()];
    }
    /**
     * Get history
     */
    getHistory(limit) {
        const history = [...this.history];
        return limit ? history.slice(-limit) : history;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset manager
     */
    reset() {
        this.suites.clear();
        this.regressionTests.clear();
        this.history = [];
        this.stats = {
            totalSuites: 0,
            totalBenchmarks: 0,
            totalRuns: 0,
            averageLatency: 0,
            regressionTests: 0
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const performanceBenchmark = new PerformanceBenchmarkManager();
//# sourceMappingURL=performance.js.map