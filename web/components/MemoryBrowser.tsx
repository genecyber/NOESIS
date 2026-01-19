/**
 * MemoryBrowser - Browse and search memories
 * INCEPTION Phase 7 - Memory browser
 * Updated: Now persists to localStorage for offline access
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMemories } from '@/lib/api';
import { useMemories } from '@/lib/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import { RefreshCw, Check } from 'lucide-react';

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
  ).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

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

  const getImportanceColor = (importance: number): string => {
    if (importance >= 80) return 'text-emblem-accent';
    if (importance >= 50) return 'text-emblem-warning';
    return 'text-emblem-muted';
  };

  if (!sessionId) {
    return (
      <div className="flex flex-col h-full text-emblem-text">
        <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
          <h3 className="text-base font-display gradient-text">Memories</h3>
        </div>
        <div className="text-center py-5 text-emblem-muted text-sm">No session selected</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full text-emblem-text">
        <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
          <h3 className="text-base font-display gradient-text">Memories</h3>
        </div>
        <div className="text-center py-5 text-emblem-muted text-sm">Loading memories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full text-emblem-text">
        <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
          <h3 className="text-base font-display gradient-text">Memories</h3>
        </div>
        <div className="text-center py-5 text-emblem-danger text-sm">{error}</div>
        <Button variant="outline" size="sm" onClick={() => sessionId && loadMemories(sessionId)} className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-emblem-text">
      <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
        <h3 className="text-base font-display gradient-text">Memories</h3>
        <span className="text-xs text-emblem-muted flex items-center gap-2">
          {memories.length} total
          {lastSynced && (
            <span className="flex items-center gap-1 opacity-60 text-[10px]">
              <Check className="w-3 h-3" />
              synced
            </span>
          )}
        </span>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all', 'episodic', 'semantic', 'identity'] as const).map((type) => (
          <button
            key={type}
            className={cn(
              'px-2.5 py-1 text-[11px] rounded border cursor-pointer transition-all',
              'bg-emblem-surface-2 text-emblem-muted',
              selectedType === type
                ? 'border-emblem-secondary text-emblem-text bg-emblem-surface'
                : 'border-white/10 hover:bg-emblem-surface hover:text-emblem-text'
            )}
            onClick={() => setSelectedType(type)}
            style={type !== 'all' && selectedType === type ? { borderColor: TYPE_COLORS[type] } : undefined}
          >
            {type === 'all' ? 'All' : TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-styled">
        {memories.length === 0 ? (
          <div className="text-center py-5 text-emblem-muted text-sm">No memories stored yet</div>
        ) : (
          memories.map((memory) => (
            <div
              key={memory.id}
              className={cn(
                'px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                'bg-emblem-surface-2 border border-transparent',
                'hover:bg-emblem-surface hover:border-white/10',
                expandedId === memory.id && 'border-emblem-secondary'
              )}
              onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
            >
              <div className="flex justify-between items-center mb-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium uppercase text-white"
                  style={{ backgroundColor: TYPE_COLORS[memory.type] }}
                >
                  {TYPE_LABELS[memory.type]}
                </span>
                <span className={cn('text-[11px] font-medium', getImportanceColor(memory.importance))}>
                  {memory.importance}%
                </span>
              </div>
              <div className="text-[13px] leading-relaxed text-emblem-muted">
                {expandedId === memory.id
                  ? memory.content
                  : memory.content.slice(0, 100) + (memory.content.length > 100 ? '...' : '')}
              </div>
              {expandedId === memory.id && (
                <div className="flex justify-between mt-2 pt-2 border-t border-white/5 text-[11px] text-emblem-muted">
                  <span>ID: {memory.id.slice(0, 8)}...</span>
                  <span>{new Date(memory.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Button variant="outline" size="sm" onClick={() => sessionId && loadMemories(sessionId)} className="mt-3">
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh
      </Button>
    </div>
  );
}

export default MemoryBrowser;
