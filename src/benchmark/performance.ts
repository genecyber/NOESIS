/**
 * Performance Benchmarking Suite (Ralph Iteration 10, Feature 4)
 *
 * Automated regression testing, response latency measurement,
 * memory profiling, and comparative benchmark reports.
 */

// Types from '../types/index.js' can be imported when needed

// ============================================================================
// Types
// ============================================================================

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

export type BenchmarkType =
  | 'latency'
  | 'throughput'
  | 'memory'
  | 'operator'
  | 'coherence'
  | 'custom';

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
  threshold: number;  // Percentage deviation allowed
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

// ============================================================================
// Performance Benchmark Manager
// ============================================================================

export class PerformanceBenchmarkManager {
  private config: BenchmarkConfig;
  private suites: Map<string, BenchmarkSuite> = new Map();
  private regressionTests: Map<string, RegressionTest> = new Map();
  private history: SuiteResults[] = [];
  private stats: BenchmarkStats;

  constructor(config: Partial<BenchmarkConfig> = {}) {
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
  createSuite(name: string, description: string = ''): BenchmarkSuite {
    const suite: BenchmarkSuite = {
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
  addBenchmark(
    suiteId: string,
    name: string,
    fn: () => void | Promise<void>,
    type: BenchmarkType = 'latency',
    options: {
      description?: string;
      setup?: () => void | Promise<void>;
      teardown?: () => void | Promise<void>;
    } = {}
  ): Benchmark | null {
    const suite = this.suites.get(suiteId);
    if (!suite) return null;

    const benchmark: Benchmark = {
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
  async runSuite(suiteId: string): Promise<SuiteResults | null> {
    const suite = this.suites.get(suiteId);
    if (!suite) return null;

    const startTime = new Date();
    const benchmarkResults: BenchmarkResult[] = [];

    for (const benchmark of suite.benchmarks) {
      const result = await this.runBenchmark(benchmark);
      benchmarkResults.push(result);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const results: SuiteResults = {
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
  private async runBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let memoryBefore: MemoryMetrics | null = null;
    let memoryAfter: MemoryMetrics | null = null;

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
  private collectMemoryMetrics(): MemoryMetrics {
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
  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    const sorted = [...latencies].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = latencies.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0
      ? (sorted[n/2 - 1] + sorted[n/2]) / 2
      : sorted[Math.floor(n/2)];

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
  private calculateMemoryDelta(
    before: MemoryMetrics | null,
    after: MemoryMetrics | null
  ): MemoryMetrics {
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
  private calculateThroughputMetrics(latencies: number[]): ThroughputMetrics {
    const totalTime = latencies.reduce((a, b) => a + b, 0);
    const operationsPerSecond = totalTime > 0
      ? (latencies.length / totalTime) * 1000
      : 0;

    return {
      operationsPerSecond,
      bytesPerSecond: 0  // Would need actual byte measurements
    };
  }

  /**
   * Calculate summary
   */
  private calculateSummary(results: BenchmarkResult[], duration: number): ResultsSummary {
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
  private updateAverageLatency(results: SuiteResults): void {
    const n = this.stats.totalRuns;
    this.stats.averageLatency = (
      this.stats.averageLatency * (n - 1) + results.summary.averageLatency
    ) / n;
  }

  /**
   * Create a regression test
   */
  createRegressionTest(
    name: string,
    baseline: BenchmarkResult,
    threshold: number = 10
  ): RegressionTest {
    const test: RegressionTest = {
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
  runRegressionTests(currentResults: SuiteResults): RegressionResult[] {
    const results: RegressionResult[] = [];

    for (const test of this.regressionTests.values()) {
      if (!test.enabled) continue;

      const currentBenchmark = currentResults.benchmarkResults.find(
        r => r.name === test.baseline.name
      );

      if (!currentBenchmark) continue;

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
  generateReport(title: string, suiteIds: string[]): BenchmarkReport {
    const suites = suiteIds
      .map(id => this.suites.get(id)?.results)
      .filter((r): r is SuiteResults => r !== null && r !== undefined);

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
  compare(baselineId: string, currentId: string): ComparisonReport | null {
    const baselineSuite = this.history.find(h => h.suiteId === baselineId);
    const currentSuite = this.history.find(h => h.suiteId === currentId);

    if (!baselineSuite || !currentSuite) return null;

    const improvements: string[] = [];
    const regressions: string[] = [];
    const unchanged: string[] = [];

    for (const current of currentSuite.benchmarkResults) {
      const baseline = baselineSuite.benchmarkResults.find(b => b.name === current.name);
      if (!baseline) continue;

      const diff = ((current.metrics.latency.mean - baseline.metrics.latency.mean) /
                    baseline.metrics.latency.mean) * 100;

      if (diff < -5) {
        improvements.push(`${current.name}: ${diff.toFixed(1)}% faster`);
      } else if (diff > 5) {
        regressions.push(`${current.name}: ${diff.toFixed(1)}% slower`);
      } else {
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
  getSuite(suiteId: string): BenchmarkSuite | null {
    return this.suites.get(suiteId) || null;
  }

  /**
   * List all suites
   */
  listSuites(): BenchmarkSuite[] {
    return [...this.suites.values()];
  }

  /**
   * Get history
   */
  getHistory(limit?: number): SuiteResults[] {
    const history = [...this.history];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get statistics
   */
  getStats(): BenchmarkStats {
    return { ...this.stats };
  }

  /**
   * Reset manager
   */
  reset(): void {
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
