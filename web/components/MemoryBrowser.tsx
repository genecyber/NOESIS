/**
 * MemoryBrowser - Browse and search memories
 * INCEPTION Phase 7 - Memory browser
 * Updated: Now persists to localStorage for offline access
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMemories } from '@/lib/api';
import { useMemories } from '@/lib/hooks/useLocalStorage';
import styles from './MemoryBrowser.module.css';

interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  timestamp: Date | number;
}

interface MemoryBrowserProps {
  sessionId?: string;
}

const TYPE_COLORS: Record<string, string> = {
  episodic: '#6366f1',
  semantic: '#22c55e',
  identity: '#f97316'
};

const TYPE_LABELS: Record<string, string> = {
  episodic: 'Episodic',
  semantic: 'Semantic',
  identity: 'Identity'
};

export function MemoryBrowser({ sessionId }: MemoryBrowserProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'episodic' | 'semantic' | 'identity'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Use localStorage for memory persistence
  const {
    memories: localMemories,
    syncWithServer,
    isLoaded: localLoaded
  } = useMemories(sessionId);

  // Filter memories based on selected type (computed during render, no state)
  const memories: Memory[] = (selectedType === 'all'
    ? localMemories
    : localMemories.filter(m => m.type === selectedType)
  ).sort((a, b) => b.timestamp - a.timestamp);

  // Fetch from server and sync with localStorage
  const loadMemories = useCallback(async (sid: string) => {
    try {
      setLoading(true);
      // Fetch all memories from server (filter locally for better caching)
      const data = await getMemories(sid);

      // Sync server memories to localStorage
      syncWithServer(data.memories);
      setLastSynced(new Date());
      setError(null);
    } catch (err) {
      // On error, we still have local memories to display
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [syncWithServer]);

  // Load memories on mount and when session changes
  useEffect(() => {
    if (localLoaded && sessionId) {
      loadMemories(sessionId);
    }
  }, [sessionId, localLoaded, loadMemories]);

  const getImportanceClass = (importance: number): string => {
    if (importance >= 80) return styles.highImportance;
    if (importance >= 50) return styles.mediumImportance;
    return styles.lowImportance;
  };

  if (!sessionId) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Memories</h3>
        </div>
        <div className={styles.empty}>No session selected</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Memories</h3>
        </div>
        <div className={styles.loading}>Loading memories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Memories</h3>
        </div>
        <div className={styles.error}>{error}</div>
        <button className={styles.retryBtn} onClick={() => sessionId && loadMemories(sessionId)}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Memories</h3>
        <span className={styles.count}>
          {memories.length} total
          {lastSynced && (
            <span title={`Last synced: ${lastSynced.toLocaleString()}`} style={{ marginLeft: 8, opacity: 0.6, fontSize: '0.8em' }}>
              ✓ synced
            </span>
          )}
        </span>
      </div>

      {/* Type filter */}
      <div className={styles.filters}>
        {['all', 'episodic', 'semantic', 'identity'].map((type) => (
          <button
            key={type}
            className={`${styles.filterBtn} ${selectedType === type ? styles.active : ''}`}
            onClick={() => setSelectedType(type as typeof selectedType)}
            style={type !== 'all' ? { borderColor: TYPE_COLORS[type] } : undefined}
          >
            {type === 'all' ? 'All' : TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div className={styles.memoryList}>
        {memories.length === 0 ? (
          <div className={styles.empty}>No memories stored yet</div>
        ) : (
          memories.map((memory) => (
            <div
              key={memory.id}
              className={`${styles.memory} ${expandedId === memory.id ? styles.expanded : ''}`}
              onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
            >
              <div className={styles.memoryHeader}>
                <span
                  className={styles.typeBadge}
                  style={{ backgroundColor: TYPE_COLORS[memory.type] }}
                >
                  {TYPE_LABELS[memory.type]}
                </span>
                <span className={`${styles.importance} ${getImportanceClass(memory.importance)}`}>
                  {memory.importance}%
                </span>
              </div>
              <div className={styles.memoryContent}>
                {expandedId === memory.id
                  ? memory.content
                  : memory.content.slice(0, 100) + (memory.content.length > 100 ? '...' : '')}
              </div>
              {expandedId === memory.id && (
                <div className={styles.memoryMeta}>
                  <span>ID: {memory.id.slice(0, 8)}...</span>
                  <span>{new Date(memory.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button className={styles.refreshBtn} onClick={() => sessionId && loadMemories(sessionId)}>
        Refresh
      </button>
    </div>
  );
}

export default MemoryBrowser;
