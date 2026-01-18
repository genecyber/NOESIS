/**
 * MemoryBrowser - Browse and search memories
 * INCEPTION Phase 7 - Memory browser
 */

'use client';

import { useState, useEffect } from 'react';
import { getMemories } from '@/lib/api';
import styles from './MemoryBrowser.module.css';

interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  timestamp: Date;
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
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'episodic' | 'semantic' | 'identity'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadMemories = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const type = selectedType === 'all' ? undefined : selectedType;
      const data = await getMemories(sessionId, type);
      setMemories(data.memories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [sessionId, selectedType]);

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
        <button className={styles.retryBtn} onClick={loadMemories}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Memories</h3>
        <span className={styles.count}>{memories.length} total</span>
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

      <button className={styles.refreshBtn} onClick={loadMemories}>
        Refresh
      </button>
    </div>
  );
}

export default MemoryBrowser;
