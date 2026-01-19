/**
 * React hooks for localStorage persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStorageItem,
  setStorageItem,
  isStorageAvailable,
  getMemoriesFromStorage,
  saveMemories,
  addMemoryToStorage,
  deleteMemoryFromStorage,
  mergeMemories,
  type StoredMemory
} from '../storage';

/**
 * Hook for syncing state with localStorage
 *
 * @param key - localStorage key
 * @param initialValue - initial value if not found in storage
 * @returns [value, setValue, isLoaded] - state tuple with loaded flag
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  // Store initialValue in ref to avoid dependency issues with objects/arrays
  const initialValueRef = useRef(initialValue);

  // Track if we've loaded from storage
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize state with a function to avoid SSR issues
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (!isStorageAvailable()) {
      setIsLoaded(true);
      return;
    }

    const value = getStorageItem<T>(key, initialValueRef.current);
    setStoredValue(value);
    setIsLoaded(true);
  }, [key]); // Only depend on key, not initialValue

  // Persist to localStorage whenever value changes
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      setStorageItem(key, newValue);
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue, isLoaded];
}

/**
 * Hook for debounced localStorage persistence
 * Useful for frequently-changing data like messages
 *
 * @param key - localStorage key
 * @param initialValue - initial value if not found in storage
 * @param delay - debounce delay in ms (default: 500)
 */
export function useDebouncedLocalStorage<T>(
  key: string,
  initialValue: T,
  delay: number = 500
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue, isLoaded] = useLocalStorage(key, initialValue);

  // Debounced setter
  const [pendingValue, setPendingValue] = useState<T | null>(null);

  useEffect(() => {
    if (pendingValue === null) return;

    const timer = setTimeout(() => {
      setStoredValue(pendingValue);
      setPendingValue(null);
    }, delay);

    return () => clearTimeout(timer);
  }, [pendingValue, delay, setStoredValue]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    if (value instanceof Function) {
      setStoredValue(prev => {
        const newValue = value(prev);
        setPendingValue(newValue);
        return newValue;
      });
    } else {
      setStoredValue(value);
      setPendingValue(value);
    }
  }, [setStoredValue]);

  return [storedValue, setValue, isLoaded];
}

/**
 * Hook specifically for chat messages with session-based storage
 */
export function useChatMessages(sessionId: string | undefined) {
  const key = sessionId ? `metamorph:messages:${sessionId}` : '';

  const [messages, setMessages, isLoaded] = useLocalStorage<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    type?: 'message' | 'command';
    commandData?: unknown;
    tools?: unknown[];
  }>>(key, []);

  // Clear messages when session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
    }
  }, [sessionId, setMessages]);

  return { messages, setMessages, isLoaded };
}

/**
 * Hook for input history persistence
 */
export function useInputHistory() {
  const [history, setHistory, isLoaded] = useLocalStorage<string[]>(
    'metamorph:inputHistory',
    []
  );

  const addToHistory = useCallback((input: string) => {
    setHistory(prev => {
      // Avoid duplicates of last entry
      if (prev.length > 0 && prev[prev.length - 1] === input) {
        return prev;
      }
      // Keep last 100 entries
      const newHistory = [...prev, input].slice(-100);
      return newHistory;
    });
  }, [setHistory]);

  return { history, addToHistory, isLoaded };
}

/**
 * Hook for last session ID persistence
 */
export function useLastSession() {
  const [lastSessionId, setLastSessionId, isLoaded] = useLocalStorage<string | null>(
    'metamorph:lastSessionId',
    null
  );

  return { lastSessionId, setLastSessionId, isLoaded };
}

/**
 * Hook for user preferences
 */
export function usePreferences() {
  const [preferences, setPreferences, isLoaded] = useLocalStorage<{
    activePanel: 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories';
    enableLocalStorage: boolean;
  }>('metamorph:preferences', {
    activePanel: 'stance',
    enableLocalStorage: true,
  });

  const updatePreference = useCallback(<K extends keyof typeof preferences>(
    key: K,
    value: typeof preferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  }, [setPreferences]);

  return { preferences, updatePreference, isLoaded };
}

/**
 * Hook for memory persistence with localStorage
 * Syncs with server memories and caches locally
 */
export function useMemories(sessionId: string | undefined) {
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load memories from localStorage when session changes
  useEffect(() => {
    if (sessionId) {
      const stored = getMemoriesFromStorage(sessionId);
      setMemories(stored);
      setIsLoaded(true);
    } else {
      setMemories([]);
      setIsLoaded(true);
    }
  }, [sessionId]);

  // Add a memory (to local storage)
  const addMemory = useCallback((memory: Omit<StoredMemory, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
    if (!sessionId) return null;

    const fullMemory: StoredMemory = {
      id: memory.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: memory.timestamp || Date.now(),
      type: memory.type,
      content: memory.content,
      importance: memory.importance,
      metadata: memory.metadata,
    };

    const updated = addMemoryToStorage(sessionId, fullMemory);
    setMemories(updated);
    return fullMemory;
  }, [sessionId]);

  // Delete a memory from local storage
  const deleteMemory = useCallback((memoryId: string) => {
    if (!sessionId) return false;

    const success = deleteMemoryFromStorage(sessionId, memoryId);
    if (success) {
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    }
    return success;
  }, [sessionId]);

  // Sync with server memories (merge local + server, server wins on conflict)
  const syncWithServer = useCallback((serverMemories: Array<{
    id: string;
    type: 'episodic' | 'semantic' | 'identity';
    content: string;
    importance: number;
    timestamp: Date | number;
  }>) => {
    if (!sessionId) return;

    // Convert server memories to StoredMemory format
    const converted: StoredMemory[] = serverMemories.map(m => ({
      id: m.id,
      type: m.type,
      content: m.content,
      importance: m.importance,
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime(),
    }));

    const merged = mergeMemories(sessionId, converted);
    setMemories(merged);
  }, [sessionId]);

  // Save all memories (useful for bulk operations)
  const saveAllMemories = useCallback((newMemories: StoredMemory[]) => {
    if (!sessionId) return;
    saveMemories(sessionId, newMemories);
    setMemories(newMemories);
  }, [sessionId]);

  // Search memories with filters
  const searchMemories = useCallback((options: {
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  } = {}) => {
    let result = [...memories];

    if (options.type) {
      result = result.filter(m => m.type === options.type);
    }

    if (options.minImportance !== undefined) {
      result = result.filter(m => m.importance >= options.minImportance!);
    }

    // Sort by timestamp descending
    result.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }, [memories]);

  return {
    memories,
    addMemory,
    deleteMemory,
    syncWithServer,
    saveAllMemories,
    searchMemories,
    isLoaded,
  };
}
