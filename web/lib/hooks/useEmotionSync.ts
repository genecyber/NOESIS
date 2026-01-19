/**
 * useEmotionSync - Browser-Server Emotion Data Sync Hook
 *
 * Syncs emotion readings from browser (EmotionAggregator) to server
 * and fetches latest emotion context with empathy boost suggestions.
 *
 * Features:
 * - Syncs aggregated emotion readings every 30 seconds
 * - Persists emotion readings to localStorage for offline support
 * - Fetches latest emotion context from server on mount
 * - Returns sync status, error state, and latest emotion context
 * - Gracefully handles sync failures without breaking the app
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { emotionAggregator, EmotionReading } from '../emotion-aggregator';
import {
  getEmotionReadings,
  saveEmotionReadings,
  getUnsyncedEmotionReadings,
  updateEmotionSyncTime,
  clearEmotionReadings,
  type StoredEmotionData,
} from '../storage';

// Default sync interval: 30 seconds
const DEFAULT_SYNC_INTERVAL_MS = 30000;

// API base URL
const API_BASE = '/api';

/**
 * Server-side emotion context with additional sync metadata
 */
export interface ServerEmotionContext {
  avgValence: number;
  avgArousal: number;
  avgConfidence: number;
  dominantEmotion: string;
  stability: number;
  trend: 'improving' | 'stable' | 'declining';
  suggestedEmpathyBoost: number;
  promptContext: string;
  readingCount: number;
  lastSyncTime: number;
}

/**
 * Sync status returned by the hook
 */
export interface EmotionSyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  syncCount: number;
  readingsSynced: number;
}

/**
 * Return type for useEmotionSync hook
 */
export interface UseEmotionSyncResult {
  // Current emotion context from server
  emotionContext: ServerEmotionContext | null;
  // Sync status
  status: EmotionSyncStatus;
  // Manual sync trigger
  syncNow: () => Promise<void>;
  // Fetch latest from server without pushing local data
  fetchContext: () => Promise<void>;
  // Reset/clear emotion data
  clearLocalReadings: () => void;
}

/**
 * Sync emotion readings to server
 */
async function syncEmotionsToServer(
  sessionId: string,
  readings: EmotionReading[]
): Promise<{
  success: boolean;
  synced?: number;
  emotionContext?: ServerEmotionContext;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'emotions',
        sessionId,
        data: readings,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    return {
      success: result.success,
      synced: result.synced,
      emotionContext: result.emotionContext,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Fetch emotion context from server
 */
async function fetchEmotionContext(
  sessionId: string
): Promise<{
  success: boolean;
  emotionContext?: ServerEmotionContext | null;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE}/sync/emotions?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    return {
      success: result.success,
      emotionContext: result.emotionContext,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * useEmotionSync Hook
 *
 * @param sessionId - The session ID to sync emotions for
 * @param syncIntervalMs - Optional sync interval in ms (default: 30000)
 * @returns Emotion sync status, context, and control functions
 */
export function useEmotionSync(
  sessionId: string | undefined,
  syncIntervalMs: number = DEFAULT_SYNC_INTERVAL_MS
): UseEmotionSyncResult {
  // Emotion context from server
  const [emotionContext, setEmotionContext] = useState<ServerEmotionContext | null>(null);

  // Sync status
  const [status, setStatus] = useState<EmotionSyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    lastSyncError: null,
    syncCount: 0,
    readingsSynced: 0,
  });

  // Sync interval ref
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Get readings that haven't been synced yet
   * Combines localStorage and aggregator to get all unsynced readings
   */
  const getUnsyncedReadings = useCallback((): EmotionReading[] => {
    if (!sessionId) return [];

    // Get unsynced readings from localStorage
    const storedUnsynced = getUnsyncedEmotionReadings(sessionId);

    // Also get the latest from aggregator in case it hasn't been persisted yet
    const latest = emotionAggregator.getLatest();
    const storedData = getEmotionReadings(sessionId);

    // If latest reading exists and is newer than last sync, include it
    if (latest && latest.timestamp > storedData.lastSyncTime) {
      // Check if it's already in storedUnsynced
      const alreadyIncluded = storedUnsynced.some(r => r.timestamp === latest.timestamp);
      if (!alreadyIncluded) {
        // Persist to storage first
        storedData.readings.push(latest);
        saveEmotionReadings(sessionId, storedData);
        return [...storedUnsynced, latest];
      }
    }

    return storedUnsynced;
  }, [sessionId]);

  /**
   * Perform sync operation
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    // Get unsynced readings
    const readings = getUnsyncedReadings();
    if (readings.length === 0) {
      // No new readings to sync, just fetch latest context
      const fetchResult = await fetchEmotionContext(sessionId);
      if (fetchResult.success && fetchResult.emotionContext) {
        setEmotionContext(fetchResult.emotionContext);
      }
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await syncEmotionsToServer(sessionId, readings);

      if (result.success) {
        // Update last synced timestamp in localStorage
        const latestTimestamp = Math.max(...readings.map(r => r.timestamp));
        updateEmotionSyncTime(sessionId, latestTimestamp);

        // Update context from server response
        if (result.emotionContext) {
          setEmotionContext(result.emotionContext);
        }

        setStatus(prev => ({
          isSyncing: false,
          lastSyncTime: Date.now(),
          lastSyncError: null,
          syncCount: prev.syncCount + 1,
          readingsSynced: prev.readingsSynced + (result.synced || 0),
        }));
      } else {
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncError: result.error || 'Sync failed',
        }));
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [sessionId, getUnsyncedReadings]);

  /**
   * Manual sync trigger
   */
  const syncNow = useCallback(async (): Promise<void> => {
    await performSync();
  }, [performSync]);

  /**
   * Fetch context without pushing local data
   */
  const fetchContext = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await fetchEmotionContext(sessionId);

      if (result.success) {
        if (result.emotionContext) {
          setEmotionContext(result.emotionContext);
        }
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncError: null,
        }));
      } else {
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncError: result.error || 'Fetch failed',
        }));
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [sessionId]);

  /**
   * Clear local readings
   */
  const clearLocalReadings = useCallback((): void => {
    // Clear in-memory aggregator
    emotionAggregator.clear();

    // Clear localStorage
    if (sessionId) {
      clearEmotionReadings(sessionId);
    }

    setEmotionContext(null);
    setStatus({
      isSyncing: false,
      lastSyncTime: null,
      lastSyncError: null,
      syncCount: 0,
      readingsSynced: 0,
    });
  }, [sessionId]);

  // Fetch initial context on mount
  useEffect(() => {
    if (sessionId) {
      fetchContext();
    }
  }, [sessionId, fetchContext]);

  // Set up sync interval
  useEffect(() => {
    if (!sessionId) {
      // Clear interval if no session
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Set up periodic sync
    syncIntervalRef.current = setInterval(() => {
      performSync();
    }, syncIntervalMs);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [sessionId, syncIntervalMs, performSync]);

  // Sync on unmount if there are unsynced readings
  useEffect(() => {
    return () => {
      if (sessionId) {
        const readings = getUnsyncedReadings();
        if (readings.length > 0) {
          // Fire and forget - don't block unmount
          syncEmotionsToServer(sessionId, readings).catch(() => {
            // Silently ignore errors on unmount
          });
        }
      }
    };
  }, [sessionId, getUnsyncedReadings]);

  return {
    emotionContext,
    status,
    syncNow,
    fetchContext,
    clearLocalReadings,
  };
}

export default useEmotionSync;
