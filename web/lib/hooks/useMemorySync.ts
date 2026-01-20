/**
 * useMemorySync - Browser-Server Bidirectional Memory Sync Hook
 *
 * Syncs memories between browser localStorage and server:
 * 1. Pulls memories from server and merges with local
 * 2. Pushes local-only memories to server
 *
 * Features:
 * - Syncs memories on mount and periodically (every 60 seconds)
 * - Deduplicates by content+type to prevent duplicates
 * - Persists memories to localStorage for offline support
 * - Returns sync status, error state, and memory stats
 * - Gracefully handles sync failures without breaking the app
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMemories, syncMemoriesToServer } from '../api';
import {
  getMemoriesFromStorage,
  saveMemories,
  type StoredMemory,
} from '../storage';

// Default sync interval: 60 seconds
const DEFAULT_SYNC_INTERVAL_MS = 60000;

/**
 * Sync status returned by the hook
 */
export interface MemorySyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  syncCount: number;
  memoriesPulled: number;
  memoriesPushed: number;
}

/**
 * Return type for useMemorySync hook
 */
export interface UseMemorySyncResult {
  // Current sync status
  status: MemorySyncStatus;
  // Manual sync trigger
  syncNow: () => Promise<void>;
  // Memory stats
  localCount: number;
  serverCount: number;
}

/**
 * Create content key for deduplication
 */
function getContentKey(memory: { type: string; content: string }): string {
  return `${memory.type}:${memory.content}`;
}

/**
 * useMemorySync Hook
 *
 * @param sessionId - The session ID to sync memories for
 * @param syncIntervalMs - Optional sync interval in ms (default: 60000)
 * @returns Memory sync status and control functions
 */
export function useMemorySync(
  sessionId: string | undefined,
  syncIntervalMs: number = DEFAULT_SYNC_INTERVAL_MS
): UseMemorySyncResult {
  // Sync status
  const [status, setStatus] = useState<MemorySyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    lastSyncError: null,
    syncCount: 0,
    memoriesPulled: 0,
    memoriesPushed: 0,
  });

  // Memory counts
  const [localCount, setLocalCount] = useState(0);
  const [serverCount, setServerCount] = useState(0);

  // Sync interval ref
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track if initial sync has been done
  const initialSyncDone = useRef(false);

  /**
   * Perform bidirectional sync
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // 1. Get local memories
      const localMemories = getMemoriesFromStorage(sessionId);
      const localContentSet = new Set(localMemories.map(getContentKey));
      setLocalCount(localMemories.length);

      // 2. Fetch server memories
      let serverMemories: Array<{
        id: string;
        type: 'episodic' | 'semantic' | 'identity';
        content: string;
        importance: number;
        timestamp: Date;
      }> = [];

      try {
        const serverData = await getMemories(sessionId, undefined, 1000);
        serverMemories = serverData.memories;
        setServerCount(serverMemories.length);
      } catch (fetchError) {
        console.error('[MemorySync] Failed to fetch server memories:', fetchError);
        // Continue with push-only sync
      }

      // 3. Merge: find memories only on server (to pull) and only local (to push)
      const serverContentSet = new Set(serverMemories.map(getContentKey));

      // Memories to pull from server (not in local)
      const toPull = serverMemories.filter(m => !localContentSet.has(getContentKey(m)));

      // Memories to push to server (not on server)
      const toPush = localMemories.filter(m => !serverContentSet.has(getContentKey(m)));

      // 4. Pull: Add server-only memories to local storage
      if (toPull.length > 0) {
        const newLocalMemories = [
          ...localMemories,
          ...toPull.map(m => ({
            id: m.id,
            type: m.type,
            content: m.content,
            importance: m.importance,
            timestamp: typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime(),
          })),
        ];
        saveMemories(sessionId, newLocalMemories);
        setLocalCount(newLocalMemories.length);
        console.log(`[MemorySync] Pulled ${toPull.length} memories from server`);
      }

      // 5. Push: Send local-only memories to server
      let pushed = 0;
      if (toPush.length > 0) {
        try {
          const result = await syncMemoriesToServer(sessionId, toPush);
          pushed = result.synced;
          console.log(`[MemorySync] Pushed ${pushed} memories to server`);
        } catch (pushError) {
          console.error('[MemorySync] Failed to push memories:', pushError);
          // Don't fail the whole sync if push fails
        }
      }

      // Update status
      setStatus(prev => ({
        isSyncing: false,
        lastSyncTime: Date.now(),
        lastSyncError: null,
        syncCount: prev.syncCount + 1,
        memoriesPulled: prev.memoriesPulled + toPull.length,
        memoriesPushed: prev.memoriesPushed + pushed,
      }));

    } catch (error) {
      console.error('[MemorySync] Sync error:', error);
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [sessionId]);

  /**
   * Manual sync trigger
   */
  const syncNow = useCallback(async (): Promise<void> => {
    await performSync();
  }, [performSync]);

  // Perform initial sync on mount and when session changes
  useEffect(() => {
    if (sessionId) {
      // Reset initial sync flag when session changes
      initialSyncDone.current = false;

      // Perform initial sync
      performSync().then(() => {
        initialSyncDone.current = true;
      });
    }
  }, [sessionId, performSync]);

  // Set up periodic sync interval
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

  return {
    status,
    syncNow,
    localCount,
    serverCount,
  };
}

export default useMemorySync;
