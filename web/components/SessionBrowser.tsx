/**
 * SessionBrowser - Browse and manage sessions
 * INCEPTION Phase 7 - Session history browser
 */

'use client';

import { useState, useEffect } from 'react';
import { getSessions, deleteSession } from '@/lib/api';
import type { Stance } from '@/lib/types';
import styles from './SessionBrowser.module.css';

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
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Sessions</h3>
        </div>
        <div className={styles.loading}>Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Sessions</h3>
        </div>
        <div className={styles.error}>{error}</div>
        <button className={styles.retryBtn} onClick={loadSessions}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Sessions</h3>
        <button className={styles.newBtn} onClick={onNewSession}>+ New</button>
      </div>

      <div className={styles.sessionList}>
        {sessions.length === 0 ? (
          <div className={styles.empty}>No sessions yet</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`${styles.session} ${session.id === currentSessionId ? styles.current : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className={styles.sessionInfo}>
                <div className={styles.sessionId}>
                  {session.id.slice(0, 8)}...
                </div>
                <div className={styles.sessionMeta}>
                  <span
                    className={styles.frame}
                    style={{ color: getFrameColor(session.stance.frame) }}
                  >
                    {session.stance.frame}
                  </span>
                  <span className={styles.msgCount}>
                    {session.messageCount} msgs
                  </span>
                </div>
              </div>
              <div className={styles.sessionActions}>
                {session.id !== currentSessionId && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(session.id, e)}
                    title="Delete session"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button className={styles.refreshBtn} onClick={loadSessions}>
        Refresh
      </button>
    </div>
  );
}

export default SessionBrowser;
