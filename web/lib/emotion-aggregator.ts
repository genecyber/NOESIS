/**
 * Emotion Aggregator
 *
 * Accumulates face-api emotion readings over time and computes aggregates.
 * All computation is local - no API calls.
 *
 * Usage:
 *   const aggregator = new EmotionAggregator({ windowMs: 30000 });
 *   aggregator.addReading({ currentEmotion: 'sad', valence: -0.5, ... });
 *   const aggregate = aggregator.getAggregate();
 */

export interface EmotionReading {
  currentEmotion: string;
  valence: number;      // -1 to 1
  arousal: number;      // 0 to 1
  confidence: number;   // 0 to 1
  timestamp: number;    // Date.now()
}

export interface EmotionAggregate {
  // Core metrics
  avgValence: number;           // -1 to 1
  avgArousal: number;           // 0 to 1
  avgConfidence: number;        // 0 to 1

  // Derived insights
  dominantEmotion: string;      // Most frequent emotion
  stability: number;            // 0 to 1 (low = volatile, high = stable)
  trend: 'improving' | 'stable' | 'declining';

  // Metadata
  sampleCount: number;
  windowMs: number;
  oldestSampleAge: number;      // ms since oldest sample

  // For prompt context
  promptContext: string;
  suggestedEmpathyBoost: number;
}

export interface AggregatorOptions {
  windowMs?: number;      // Time window for aggregation (default: 30s)
  maxSamples?: number;    // Max samples to keep (default: 60)
}

const DEFAULT_WINDOW_MS = 30000;  // 30 seconds
const DEFAULT_MAX_SAMPLES = 60;

export class EmotionAggregator {
  private readings: EmotionReading[] = [];
  private windowMs: number;
  private maxSamples: number;

  constructor(options?: AggregatorOptions) {
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxSamples = options?.maxSamples ?? DEFAULT_MAX_SAMPLES;
  }

  /**
   * Add a new emotion reading
   */
  addReading(reading: Omit<EmotionReading, 'timestamp'>): void {
    const timestampedReading: EmotionReading = {
      ...reading,
      timestamp: Date.now()
    };

    this.readings.push(timestampedReading);

    // Prune old readings
    this.pruneOldReadings();
  }

  /**
   * Remove readings outside the time window or exceeding max samples
   */
  private pruneOldReadings(): void {
    const cutoff = Date.now() - this.windowMs;

    // Remove readings older than window
    this.readings = this.readings.filter(r => r.timestamp > cutoff);

    // Keep only most recent maxSamples
    if (this.readings.length > this.maxSamples) {
      this.readings = this.readings.slice(-this.maxSamples);
    }
  }

  /**
   * Get the current aggregate of all readings in the window
   */
  getAggregate(): EmotionAggregate | null {
    this.pruneOldReadings();

    if (this.readings.length === 0) {
      return null;
    }

    const now = Date.now();

    // Calculate averages
    const avgValence = this.average(this.readings.map(r => r.valence));
    const avgArousal = this.average(this.readings.map(r => r.arousal));
    const avgConfidence = this.average(this.readings.map(r => r.confidence));

    // Find dominant emotion (most frequent)
    const dominantEmotion = this.findDominantEmotion();

    // Calculate stability (inverse of variance in valence)
    const stability = this.calculateStability();

    // Calculate trend (compare first half to second half)
    const trend = this.calculateTrend();

    // Calculate suggested empathy boost based on aggregate
    const suggestedEmpathyBoost = this.calculateEmpathyBoost(avgValence, stability);

    // Generate prompt context
    const promptContext = this.generatePromptContext(
      dominantEmotion,
      avgValence,
      avgArousal,
      stability,
      trend
    );

    const oldestSampleAge = now - this.readings[0].timestamp;

    return {
      avgValence,
      avgArousal,
      avgConfidence,
      dominantEmotion,
      stability,
      trend,
      sampleCount: this.readings.length,
      windowMs: this.windowMs,
      oldestSampleAge,
      promptContext,
      suggestedEmpathyBoost
    };
  }

  /**
   * Get the latest reading (for display purposes)
   */
  getLatest(): EmotionReading | null {
    if (this.readings.length === 0) return null;
    return this.readings[this.readings.length - 1];
  }

  /**
   * Clear all readings
   */
  clear(): void {
    this.readings = [];
  }

  /**
   * Get reading count
   */
  get count(): number {
    this.pruneOldReadings();
    return this.readings.length;
  }

  // ============================================================================
  // Private calculation methods
  // ============================================================================

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private findDominantEmotion(): string {
    const counts: Record<string, number> = {};

    for (const reading of this.readings) {
      counts[reading.currentEmotion] = (counts[reading.currentEmotion] || 0) + 1;
    }

    let dominant = 'neutral';
    let maxCount = 0;

    for (const [emotion, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = emotion;
      }
    }

    return dominant;
  }

  private calculateStability(): number {
    if (this.readings.length < 2) return 1; // Single reading = stable

    const valences = this.readings.map(r => r.valence);
    const mean = this.average(valences);

    // Calculate variance
    const variance = valences.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valences.length;

    // Convert variance to stability (0-1 scale)
    // Max variance for valence (-1 to 1) is 1, so sqrt(variance) max is 1
    const stdDev = Math.sqrt(variance);

    // Stability = 1 - normalized std dev
    // stdDev of 0 = stability 1, stdDev of 1 = stability 0
    return Math.max(0, Math.min(1, 1 - stdDev));
  }

  private calculateTrend(): 'improving' | 'stable' | 'declining' {
    if (this.readings.length < 4) return 'stable';

    const midpoint = Math.floor(this.readings.length / 2);
    const firstHalf = this.readings.slice(0, midpoint);
    const secondHalf = this.readings.slice(midpoint);

    const firstAvg = this.average(firstHalf.map(r => r.valence));
    const secondAvg = this.average(secondHalf.map(r => r.valence));

    const delta = secondAvg - firstAvg;
    const threshold = 0.15; // 15% change threshold

    if (delta > threshold) return 'improving';
    if (delta < -threshold) return 'declining';
    return 'stable';
  }

  private calculateEmpathyBoost(avgValence: number, stability: number): number {
    // Negative emotions with low stability need more empathy
    if (avgValence >= 0) return 0;

    // Base boost from negative valence (0-15)
    const valenceBoost = Math.abs(avgValence) * 15;

    // Instability multiplier (1.0-1.5)
    const instabilityMultiplier = 1 + (1 - stability) * 0.5;

    return Math.round(Math.min(20, valenceBoost * instabilityMultiplier));
  }

  private generatePromptContext(
    dominantEmotion: string,
    avgValence: number,
    avgArousal: number,
    stability: number,
    trend: 'improving' | 'stable' | 'declining'
  ): string {
    const parts: string[] = [];

    // Emotion description
    const valenceDesc = avgValence > 0.3 ? 'positive' : avgValence < -0.3 ? 'negative' : 'neutral';
    const arousalDesc = avgArousal > 0.7 ? 'highly activated' : avgArousal < 0.3 ? 'calm' : 'moderately engaged';

    parts.push(`The user appears ${dominantEmotion} with a ${valenceDesc} emotional state.`);
    parts.push(`They seem ${arousalDesc}.`);

    // Stability insight
    if (stability < 0.4) {
      parts.push('Their emotional state has been fluctuating.');
    } else if (stability > 0.8) {
      parts.push('Their emotional state has been consistent.');
    }

    // Trend insight
    if (trend === 'improving') {
      parts.push('Their mood appears to be improving.');
    } else if (trend === 'declining') {
      parts.push('Their mood appears to be declining - consider responding with extra care.');
    }

    return parts.join(' ');
  }

  /**
   * Update configuration
   */
  setWindowMs(ms: number): void {
    this.windowMs = ms;
    this.pruneOldReadings();
  }

  setMaxSamples(max: number): void {
    this.maxSamples = max;
    this.pruneOldReadings();
  }
}

// Singleton instance for app-wide use
export const emotionAggregator = new EmotionAggregator();
