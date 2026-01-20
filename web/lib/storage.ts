/**
 * Browser localStorage persistence utilities
 *
 * Provides hooks and utilities for persisting state in the browser.
 */

// Storage keys
export const STORAGE_KEYS = {
  LAST_SESSION_ID: 'metamorph:lastSessionId',
  MESSAGES_PREFIX: 'metamorph:messages:',
  MEMORIES_PREFIX: 'metamorph:memories:',
  EMOTIONS_PREFIX: 'metamorph:emotions:',
  INPUT_HISTORY: 'metamorph:inputHistory',
  PREFERENCES: 'metamorph:preferences',
  ACTIVE_PANEL: 'metamorph:activePanel',
} as const;

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get item from localStorage with JSON parsing
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (!isStorageAvailable()) return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON serialization
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all keys matching a prefix
 */
export function getStorageKeys(prefix: string): string[] {
  if (!isStorageAvailable()) return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
}

// ============================================================================
// Session-specific storage
// ============================================================================

/**
 * Save the last active session ID
 */
export function saveLastSessionId(sessionId: string): void {
  setStorageItem(STORAGE_KEYS.LAST_SESSION_ID, sessionId);
}

/**
 * Get the last active session ID
 */
export function getLastSessionId(): string | null {
  return getStorageItem<string | null>(STORAGE_KEYS.LAST_SESSION_ID, null);
}

/**
 * Clear the last session ID (for new sessions)
 */
export function clearLastSessionId(): void {
  removeStorageItem(STORAGE_KEYS.LAST_SESSION_ID);
}

// ============================================================================
// Message storage
// ============================================================================

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'message' | 'command';
  commandData?: {
    command: string;
    data: unknown;
    error?: string;
  };
}

/**
 * Save messages for a session
 */
export function saveMessages(sessionId: string, messages: StoredMessage[]): void {
  const key = `${STORAGE_KEYS.MESSAGES_PREFIX}${sessionId}`;
  setStorageItem(key, messages);
}

/**
 * Get messages for a session
 */
export function getMessages(sessionId: string): StoredMessage[] {
  const key = `${STORAGE_KEYS.MESSAGES_PREFIX}${sessionId}`;
  return getStorageItem<StoredMessage[]>(key, []);
}

/**
 * Clear messages for a session
 */
export function clearMessages(sessionId: string): void {
  const key = `${STORAGE_KEYS.MESSAGES_PREFIX}${sessionId}`;
  removeStorageItem(key);
}

/**
 * Get all session IDs that have stored messages
 */
export function getStoredSessionIds(): string[] {
  const keys = getStorageKeys(STORAGE_KEYS.MESSAGES_PREFIX);
  return keys.map(key => key.replace(STORAGE_KEYS.MESSAGES_PREFIX, ''));
}

// ============================================================================
// Memory storage
// ============================================================================

export interface StoredMemory {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Save memories for a session
 */
export function saveMemories(sessionId: string, memories: StoredMemory[]): void {
  const key = `${STORAGE_KEYS.MEMORIES_PREFIX}${sessionId}`;
  setStorageItem(key, memories);
}

/**
 * Get memories for a session
 */
export function getMemoriesFromStorage(sessionId: string): StoredMemory[] {
  const key = `${STORAGE_KEYS.MEMORIES_PREFIX}${sessionId}`;
  return getStorageItem<StoredMemory[]>(key, []);
}

/**
 * Add a memory to storage
 */
export function addMemoryToStorage(sessionId: string, memory: StoredMemory): StoredMemory[] {
  const memories = getMemoriesFromStorage(sessionId);
  // Check if memory with same ID already exists
  const existingIndex = memories.findIndex(m => m.id === memory.id);
  if (existingIndex >= 0) {
    memories[existingIndex] = memory;
  } else {
    memories.push(memory);
  }
  saveMemories(sessionId, memories);
  return memories;
}

/**
 * Delete a memory from storage
 */
export function deleteMemoryFromStorage(sessionId: string, memoryId: string): boolean {
  const memories = getMemoriesFromStorage(sessionId);
  const index = memories.findIndex(m => m.id === memoryId);
  if (index >= 0) {
    memories.splice(index, 1);
    saveMemories(sessionId, memories);
    return true;
  }
  return false;
}

/**
 * Search memories by type
 */
export function searchMemoriesInStorage(
  sessionId: string,
  options: {
    type?: 'episodic' | 'semantic' | 'identity';
    minImportance?: number;
    limit?: number;
  } = {}
): StoredMemory[] {
  let memories = getMemoriesFromStorage(sessionId);

  if (options.type) {
    memories = memories.filter(m => m.type === options.type);
  }

  if (options.minImportance !== undefined) {
    memories = memories.filter(m => m.importance >= options.minImportance!);
  }

  // Sort by timestamp descending (newest first)
  memories.sort((a, b) => b.timestamp - a.timestamp);

  if (options.limit) {
    memories = memories.slice(0, options.limit);
  }

  return memories;
}

/**
 * Clear memories for a session
 */
export function clearMemoriesFromStorage(sessionId: string): void {
  const key = `${STORAGE_KEYS.MEMORIES_PREFIX}${sessionId}`;
  removeStorageItem(key);
}

/**
 * Merge server memories with local storage (server takes precedence for same ID)
 */
export function mergeMemories(
  sessionId: string,
  serverMemories: StoredMemory[]
): StoredMemory[] {
  const localMemories = getMemoriesFromStorage(sessionId);

  // If server has no memories, don't overwrite local
  if (!serverMemories || serverMemories.length === 0) {
    return localMemories;
  }

  const merged = new Map<string, StoredMemory>();

  // Add local memories first
  for (const memory of localMemories) {
    merged.set(memory.id, memory);
  }

  // Server memories overwrite local
  for (const memory of serverMemories) {
    merged.set(memory.id, memory);
  }

  const result = Array.from(merged.values());
  saveMemories(sessionId, result);
  return result;
}

// ============================================================================
// Emotion reading storage
// ============================================================================

export interface StoredEmotionReading {
  currentEmotion: string;
  valence: number;      // -1 to 1
  arousal: number;      // 0 to 1
  confidence: number;   // 0 to 1
  timestamp: number;    // Date.now()
}

export interface StoredEmotionData {
  readings: StoredEmotionReading[];
  lastSyncTime: number;
  lastAggregate: {
    avgValence: number;
    avgArousal: number;
    avgConfidence: number;
    dominantEmotion: string;
    stability: number;
    trend: 'improving' | 'stable' | 'declining';
    suggestedEmpathyBoost: number;
  } | null;
}

const MAX_EMOTION_READINGS = 100;

/**
 * Save emotion readings for a session
 */
export function saveEmotionReadings(sessionId: string, data: StoredEmotionData): void {
  const key = `${STORAGE_KEYS.EMOTIONS_PREFIX}${sessionId}`;
  // Keep only the last MAX_EMOTION_READINGS
  const trimmedData = {
    ...data,
    readings: data.readings.slice(-MAX_EMOTION_READINGS),
  };
  setStorageItem(key, trimmedData);
}

/**
 * Get emotion readings for a session
 */
export function getEmotionReadings(sessionId: string): StoredEmotionData {
  const key = `${STORAGE_KEYS.EMOTIONS_PREFIX}${sessionId}`;
  return getStorageItem<StoredEmotionData>(key, {
    readings: [],
    lastSyncTime: 0,
    lastAggregate: null,
  });
}

/**
 * Add emotion readings to storage
 */
export function addEmotionReadings(
  sessionId: string,
  readings: StoredEmotionReading[]
): StoredEmotionData {
  const data = getEmotionReadings(sessionId);
  data.readings.push(...readings);
  // Keep only the last MAX_EMOTION_READINGS
  if (data.readings.length > MAX_EMOTION_READINGS) {
    data.readings = data.readings.slice(-MAX_EMOTION_READINGS);
  }
  saveEmotionReadings(sessionId, data);
  return data;
}

/**
 * Update the last sync time for emotion data
 */
export function updateEmotionSyncTime(sessionId: string, syncTime: number): void {
  const data = getEmotionReadings(sessionId);
  data.lastSyncTime = syncTime;
  saveEmotionReadings(sessionId, data);
}

/**
 * Clear emotion readings for a session
 */
export function clearEmotionReadings(sessionId: string): void {
  const key = `${STORAGE_KEYS.EMOTIONS_PREFIX}${sessionId}`;
  removeStorageItem(key);
}

/**
 * Get emotion readings that haven't been synced
 * (readings with timestamp > lastSyncTime)
 */
export function getUnsyncedEmotionReadings(sessionId: string): StoredEmotionReading[] {
  const data = getEmotionReadings(sessionId);
  return data.readings.filter(r => r.timestamp > data.lastSyncTime);
}

// ============================================================================
// Input history storage
// ============================================================================

const MAX_INPUT_HISTORY = 100;

/**
 * Save input history
 */
export function saveInputHistory(history: string[]): void {
  // Keep only the last MAX_INPUT_HISTORY entries
  const trimmed = history.slice(-MAX_INPUT_HISTORY);
  setStorageItem(STORAGE_KEYS.INPUT_HISTORY, trimmed);
}

/**
 * Get input history
 */
export function getInputHistory(): string[] {
  return getStorageItem<string[]>(STORAGE_KEYS.INPUT_HISTORY, []);
}

/**
 * Add to input history
 */
export function addToInputHistory(input: string): string[] {
  const history = getInputHistory();
  // Avoid duplicates of the last entry
  if (history.length === 0 || history[history.length - 1] !== input) {
    history.push(input);
  }
  saveInputHistory(history);
  return history;
}

// ============================================================================
// Preferences storage
// ============================================================================

export interface UserPreferences {
  activePanel: string; // Dynamic - supports plugin panels
  theme?: 'dark' | 'light';
  fontSize?: number;
  enableLocalStorage?: boolean;
  sidebarOpen?: boolean;
  sidebarWidth?: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  activePanel: 'stance',
  enableLocalStorage: true,
};

/**
 * Save user preferences
 */
export function savePreferences(prefs: Partial<UserPreferences>): void {
  const current = getPreferences();
  setStorageItem(STORAGE_KEYS.PREFERENCES, { ...current, ...prefs });
}

/**
 * Get user preferences
 */
export function getPreferences(): UserPreferences {
  return getStorageItem<UserPreferences>(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
}

// ============================================================================
// Storage management
// ============================================================================

/**
 * Get total storage usage in bytes (approximate)
 */
export function getStorageUsage(): number {
  if (!isStorageAvailable()) return 0;
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith('metamorph:')) {
      const value = window.localStorage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    }
  }
  return total * 2; // UTF-16 encoding = 2 bytes per char
}

/**
 * Clear all Metamorph storage
 */
export function clearAllStorage(): void {
  if (!isStorageAvailable()) return;
  const keys = getStorageKeys('metamorph:');
  keys.forEach(key => window.localStorage.removeItem(key));
}

/**
 * Export all storage data (for backup)
 */
export function exportStorage(): Record<string, unknown> {
  if (!isStorageAvailable()) return {};
  const data: Record<string, unknown> = {};
  const keys = getStorageKeys('metamorph:');
  keys.forEach(key => {
    const value = window.localStorage.getItem(key);
    if (value) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
    }
  });
  return data;
}

/**
 * Import storage data (from backup)
 */
export function importStorage(data: Record<string, unknown>): number {
  if (!isStorageAvailable()) return 0;
  let imported = 0;
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith('metamorph:')) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        imported++;
      } catch {
        // Skip on error
      }
    }
  });
  return imported;
}

// ============================================================================
// Offline sync queue (IndexedDB for service worker access)
// ============================================================================

const SYNC_DB_NAME = 'metamorph-sync';
const SYNC_STORE_NAME = 'pending';

interface SyncQueueItem {
  id?: number;
  type: 'memories' | 'messages' | 'full';
  sessionId: string;
  data: unknown;
  timestamp: number;
}

/**
 * Open the sync queue database
 */
function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(SYNC_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
        db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Add item to sync queue (for offline use)
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<number> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const request = store.add({
      ...item,
      timestamp: Date.now(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
}

/**
 * Get all pending sync items
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE_NAME, 'readonly');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Remove item from sync queue after successful sync
 */
export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear entire sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Request background sync if available, otherwise sync immediately
 */
export async function requestSync(tag: string = 'metamorph-sync'): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
        console.log('[Storage] Background sync registered:', tag);
        return true;
      }
    } catch (error) {
      console.error('[Storage] Background sync registration failed:', error);
    }
  }
  return false;
}

/**
 * Queue memories for sync (when offline or for background sync)
 */
export async function queueMemoriesForSync(
  sessionId: string,
  memories: StoredMemory[]
): Promise<void> {
  await addToSyncQueue({
    type: 'memories',
    sessionId,
    data: memories,
  });
  await requestSync();
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
