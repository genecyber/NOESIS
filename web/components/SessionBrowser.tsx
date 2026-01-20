/**
 * SessionBrowser - Browse and manage sessions
 * INCEPTION Phase 7 - Session history browser
 */

'use client';

import { useState, useEffect } from 'react';
import { getSessions, deleteSession } from '@/lib/api';
import type { Stance } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { RefreshCw, Trash2 } from 'lucide-react';

interface Session {
  id: string;
  stance: Stance;
  messageCount: number;
}

interface SessionBrowserProps {
  currentSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionBrowser({
  currentSessionId,
  onSelectSession,
  onNewSession
}: SessionBrowserProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;

    try {
      await deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const getFrameColor = (frame: string): string => {
    const colors: Record<string, string> = {
      pragmatic: '#6366f1',
      existential: '#8b5cf6',
      poetic: '#ec4899',
      adversarial: '#f97316',
      playful: '#22c55e',
      mythic: '#eab308',
      systems: '#14b8a6',
      psychoanalytic: '#a855f7',
      stoic: '#64748b',
      absurdist: '#ef4444'
    };
    return colors[frame] || '#00d9ff';
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full text-emblem-text">
        <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
          <h3 className="text-base font-display gradient-text">Sessions</h3>
        </div>
        <div className="text-center py-5 text-emblem-muted text-sm">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full text-emblem-text">
        <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
          <h3 className="text-base font-display gradient-text">Sessions</h3>
        </div>
        <div className="text-center py-5 text-emblem-danger text-sm">{error}</div>
        <Button variant="outline" size="sm" onClick={loadSessions} className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-emblem-text">
      <div className="flex justify-between items-center pb-3 border-b border-white/5 mb-3">
        <h3 className="text-base font-display gradient-text">Sessions</h3>
        <Button size="sm" onClick={onNewSession}>
          + New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-styled">
        {sessions.length === 0 ? (
          <div className="text-center py-5 text-emblem-muted text-sm">No sessions yet</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                'flex justify-between items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                'bg-emblem-surface-2 border border-transparent',
                'hover:bg-emblem-surface hover:border-white/10',
                session.id === currentSessionId && 'border-emblem-secondary bg-emblem-secondary/10'
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex flex-col gap-1">
                <div className="font-mono text-xs text-emblem-muted">
                  {session.id.slice(0, 8)}...
                </div>
                <div className="flex gap-3 text-[11px]">
                  <span
                    className="font-medium"
                    style={{ color: getFrameColor(session.stance?.frame || 'pragmatic') }}
                  >
                    {session.stance?.frame || 'pragmatic'}
                  </span>
                  <span className="text-emblem-muted">
                    {session.messageCount} msgs
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                {session.id !== currentSessionId && (
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded bg-transparent border border-white/10 text-emblem-muted text-xs cursor-pointer transition-all hover:bg-emblem-danger hover:border-emblem-danger hover:text-white"
                    onClick={(e) => handleDelete(session.id, e)}
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Button variant="outline" size="sm" onClick={loadSessions} className="mt-3">
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh
      </Button>
    </div>
  );
}

export default SessionBrowser;
