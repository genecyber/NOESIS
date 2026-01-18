'use client';

import { useState, useEffect } from 'react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import { createSession, updateConfig, getState } from '@/lib/api';
import type { Stance, ModeConfig, ChatResponse } from '@/lib/types';
import styles from './page.module.css';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [stance, setStance] = useState<Stance | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'stance' | 'config'>('stance');

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

  const handleSessionChange = async (newSessionId: string) => {
    setSessionId(newSessionId);
    try {
      const state = await getState(newSessionId);
      setStance(state.stance);
      setConfig(state.config);
    } catch (err) {
      console.error('Failed to get state:', err);
    }
  };

  const handleResponse = (response: ChatResponse) => {
    setStance(response.stanceAfter);
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
          </div>

          <div className={styles.panelContent}>
            {activePanel === 'stance' ? (
              <StanceViz stance={stance} />
            ) : (
              <Config config={config} onUpdate={handleConfigUpdate} />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
