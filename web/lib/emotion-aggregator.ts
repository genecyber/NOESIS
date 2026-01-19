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

import {
  isStorageAvailable,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  getStorageKeys,
} from './storage';

// Storage key prefix for emotion readings
const EMOTION_STORAGE_PREFIX = 'metamorph:emotions:';

// Max age for persisted data (24 hours in ms)
const MAX_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

// Debounce interval for persistence (5 seconds)
const PERSIST_DEBOUNCE_MS = 5000;

/**
 * Structure for persisted emotion data
 */
export interface PersistedEmotionData {
  sessionId: string;
  readings: EmotionReading[];
  lastAggregate: EmotionAggregate | null;
  savedAt: string;
}

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
  private _sessionId: string | null = null;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPersistTime: number = 0;
  private lastAggregateTime: number = 0;

  constructor(options?: AggregatorOptions) {
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxSamples = options?.maxSamples ?? DEFAULT_MAX_SAMPLES;
  }

  /**
   * Get the current session ID
   */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /**
   * Set the session ID for persistence
   */
  set sessionId(id: string | null) {
    this._sessionId = id;
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

    // Schedule debounced persistence
    this.schedulePersistence();
  }

  /**
   * Schedule persistence with debouncing (max every 5 seconds)
   */
  private schedulePersistence(): void {
    // Skip if no session ID
    if (!this._sessionId) return;

    const now = Date.now();
    const timeSinceLastPersist = now - this.lastPersistTime;

    // If we already have a pending timeout, let it run
    if (this.persistTimeout) return;

    // If enough time has passed, persist immediately
    if (timeSinceLastPersist >= PERSIST_DEBOUNCE_MS) {
      this.persistToStorage();
    } else {
      // Schedule persistence for when debounce interval elapses
      const delay = PERSIST_DEBOUNCE_MS - timeSinceLastPersist;
      this.persistTimeout = setTimeout(() => {
        this.persistTimeout = null;
        this.persistToStorage();
      }, delay);
    }
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

  // ============================================================================
  // Persistence methods
  // ============================================================================

  /**
   * Persist current readings to localStorage
   * Called automatically (debounced) after addReading if sessionId is set
   */
  persistToStorage(): boolean {
    if (!this._sessionId) return false;
    if (!isStorageAvailable()) return false;

    try {
      const key = `${EMOTION_STORAGE_PREFIX}${this._sessionId}`;
      const data: PersistedEmotionData = {
        sessionId: this._sessionId,
        readings: this.readings,
        lastAggregate: this.getAggregate(),
        savedAt: new Date().toISOString(),
      };

      const success = setStorageItem(key, data);
      if (success) {
        this.lastPersistTime = Date.now();
      }
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Load readings from localStorage for a given session
   * Cleans up entries older than 24 hours
   */
  loadFromStorage(sessionId: string): boolean {
    if (!isStorageAvailable()) return false;

    // Clean up old entries first
    this.cleanupOldEntries();

    try {
      const key = `${EMOTION_STORAGE_PREFIX}${sessionId}`;
      const data = getStorageItem<PersistedEmotionData | null>(key, null);

      if (!data) return false;

      // Check if data is too old (24 hours)
      const savedTime = new Date(data.savedAt).getTime();
      if (Date.now() - savedTime > MAX_PERSISTED_AGE_MS) {
        removeStorageItem(key);
        return false;
      }

      // Restore state
      this._sessionId = sessionId;
      this.readings = data.readings || [];

      // Prune any readings that are now outside the window
      this.pruneOldReadings();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up emotion entries older than 24 hours
   */
  private cleanupOldEntries(): void {
    if (!isStorageAvailable()) return;

    try {
      const keys = getStorageKeys(EMOTION_STORAGE_PREFIX);
      const now = Date.now();

      for (const key of keys) {
        const data = getStorageItem<PersistedEmotionData | null>(key, null);
        if (data) {
          const savedTime = new Date(data.savedAt).getTime();
          if (now - savedTime > MAX_PERSISTED_AGE_MS) {
            removeStorageItem(key);
          }
        }
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }

  /**
   * Clear persisted data for the current session
   */
  clearPersistedData(): boolean {
    if (!this._sessionId) return false;
    if (!isStorageAvailable()) return false;

    try {
      const key = `${EMOTION_STORAGE_PREFIX}${this._sessionId}`;
      return removeStorageItem(key);
    } catch {
      return false;
    }
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
