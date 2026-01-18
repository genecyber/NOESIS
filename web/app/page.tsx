'use client';

import { useState, useEffect, useCallback } from 'react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import OperatorTimeline from '@/components/OperatorTimeline';
import EvolutionTimeline from '@/components/EvolutionTimeline';
import SessionBrowser from '@/components/SessionBrowser';
import MemoryBrowser from '@/components/MemoryBrowser';
import { createSession, updateConfig, getState, getTimeline, getEvolution } from '@/lib/api';
import type { Stance, ModeConfig, ChatResponse, TimelineEntry, EvolutionSnapshot } from '@/lib/types';
import styles from './page.module.css';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [stance, setStance] = useState<Stance | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories'>('stance');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [evolutionSnapshots, setEvolutionSnapshots] = useState<EvolutionSnapshot[]>([]);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await createSession();
        setSessionId(session.sessionId);
        setStance(session.stance);
        setConfig(session.config);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to server');
      }
    };

    initSession();
  }, []);

  // Refresh timeline and evolution data
  const refreshTimelineData = useCallback(async (sid: string) => {
    try {
      const [timelineData, evolutionData] = await Promise.all([
        getTimeline(sid),
        getEvolution(sid)
      ]);
      setTimelineEntries(timelineData.entries);
      setEvolutionSnapshots(evolutionData.snapshots);
    } catch (err) {
      console.error('Failed to refresh timeline data:', err);
    }
  }, []);

  const handleSessionChange = async (newSessionId: string) => {
    setSessionId(newSessionId);
    try {
      const state = await getState(newSessionId);
      setStance(state.stance);
      setConfig(state.config);
      await refreshTimelineData(newSessionId);
    } catch (err) {
      console.error('Failed to get state:', err);
    }
  };

  const handleResponse = (response: ChatResponse) => {
    setStance(response.stanceAfter);
    // Refresh timeline data after each response
    if (sessionId) {
      refreshTimelineData(sessionId);
    }
  };

  const handleConfigUpdate = async (newConfig: Partial<ModeConfig>) => {
    if (!sessionId) return;

    try {
      const result = await updateConfig(sessionId, newConfig);
      setConfig(result.config);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleNewSession = async () => {
    try {
      const session = await createSession();
      setSessionId(session.sessionId);
      setStance(session.stance);
      setConfig(session.config);
      setTimelineEntries([]);
      setEvolutionSnapshots([]);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSelectSession = async (newSessionId: string) => {
    await handleSessionChange(newSessionId);
    setActivePanel('stance');
  };

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <p className={styles.hint}>
            Make sure the METAMORPH server is running on port 3001
          </p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>METAMORPH</h1>
        <span className={styles.subtitle}>Transformation-Maximizing AI</span>
      </header>

      <div className={styles.container}>
        <div className={styles.chatArea}>
          <Chat
            sessionId={sessionId}
            onSessionChange={handleSessionChange}
            onResponse={handleResponse}
            onPanelChange={setActivePanel}
            stance={stance}
            config={config}
          />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activePanel === 'stance' ? styles.active : ''}`}
              onClick={() => setActivePanel('stance')}
            >
              Stance
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'config' ? styles.active : ''}`}
              onClick={() => setActivePanel('config')}
            >
              Config
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'timeline' ? styles.active : ''}`}
              onClick={() => setActivePanel('timeline')}
            >
              Timeline
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'evolution' ? styles.active : ''}`}
              onClick={() => setActivePanel('evolution')}
            >
              Evolution
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'sessions' ? styles.active : ''}`}
              onClick={() => setActivePanel('sessions')}
            >
              Sessions
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'memories' ? styles.active : ''}`}
              onClick={() => setActivePanel('memories')}
            >
              Memories
            </button>
          </div>

          <div className={styles.panelContent}>
            {activePanel === 'stance' && (
              <StanceViz stance={stance} />
            )}
            {activePanel === 'config' && (
              <Config config={config} onUpdate={handleConfigUpdate} />
            )}
            {activePanel === 'timeline' && (
              <OperatorTimeline entries={timelineEntries} />
            )}
            {activePanel === 'evolution' && (
              <EvolutionTimeline snapshots={evolutionSnapshots} currentStance={stance || undefined} />
            )}
            {activePanel === 'sessions' && (
              <SessionBrowser
                currentSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
              />
            )}
            {activePanel === 'memories' && (
              <MemoryBrowser sessionId={sessionId} />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
