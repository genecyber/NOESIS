'use client';

import { useState, useEffect, useCallback } from 'react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import OperatorTimeline from '@/components/OperatorTimeline';
import EvolutionTimeline from '@/components/EvolutionTimeline';
import SessionBrowser from '@/components/SessionBrowser';
import MemoryBrowser from '@/components/MemoryBrowser';
import EmpathyPanel from '@/components/EmpathyPanel';
import { createSession, updateConfig, getState, getTimeline, getEvolution, resumeSession, syncMemoriesToServer } from '@/lib/api';
import { getLastSessionId, saveLastSessionId, getPreferences, savePreferences, getMemoriesFromStorage, getPendingSyncItems, removeSyncQueueItem, isOnline } from '@/lib/storage';
import type { Stance, ModeConfig, ChatResponse, TimelineEntry, EvolutionSnapshot, EmotionContext } from '@/lib/types';
import styles from './page.module.css';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [stance, setStance] = useState<Stance | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [evolutionSnapshots, setEvolutionSnapshots] = useState<EvolutionSnapshot[]>([]);

  // Load active panel preference from localStorage
  const [activePanel, setActivePanel] = useState<'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories' | 'empathy'>('stance');
  const [emotionContext, setEmotionContext] = useState<EmotionContext | null>(null);

  // Initialize active panel from localStorage on mount
  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.activePanel) {
      setActivePanel(prefs.activePanel);
    }
  }, []);

  // Save active panel preference when it changes
  const handlePanelChange = useCallback((panel: 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories' | 'empathy') => {
    setActivePanel(panel);
    savePreferences({ activePanel: panel });
  }, []);

  // Sync pending items on load (standard PWA pattern)
  useEffect(() => {
    const syncOnLoad = async () => {
      if (!isOnline()) return;

      try {
        // Process any pending sync queue items
        const pendingItems = await getPendingSyncItems();
        for (const item of pendingItems) {
          try {
            if (item.type === 'memories' && item.id !== undefined) {
              await syncMemoriesToServer(item.sessionId, item.data as Parameters<typeof syncMemoriesToServer>[1]);
              await removeSyncQueueItem(item.id);
              console.log('[Sync] Synced pending memories for session:', item.sessionId);
            }
          } catch (err) {
            console.error('[Sync] Failed to sync item:', err);
          }
        }
      } catch (err) {
        console.error('[Sync] Failed to process sync queue:', err);
      }
    };

    syncOnLoad();

    // Also sync when coming back online
    const handleOnline = () => syncOnLoad();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Initialize session on mount - try to resume last session first
  useEffect(() => {
    const initSession = async () => {
      try {
        // Try to resume last session from localStorage
        const lastSessionId = getLastSessionId();
        if (lastSessionId) {
          try {
            const resumed = await resumeSession(lastSessionId);
            if (resumed) {
              setSessionId(resumed.sessionId);
              setStance(resumed.stance);
              setConfig(resumed.config);
              setError(null);

              // Sync local memories to server on session resume
              if (isOnline()) {
                const localMemories = getMemoriesFromStorage(lastSessionId);
                if (localMemories.length > 0) {
                  syncMemoriesToServer(lastSessionId, localMemories).catch(err =>
                    console.error('[Sync] Failed to sync memories on resume:', err)
                  );
                }
              }
              return;
            }
          } catch {
            // Session no longer exists on server, create new one
            console.log('Last session not found on server, creating new session');
          }
        }

        // Create new session
        const session = await createSession();
        setSessionId(session.sessionId);
        setStance(session.stance);
        setConfig(session.config);
        saveLastSessionId(session.sessionId);
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
      // Save new session ID and clear emotion context
      saveLastSessionId(session.sessionId);
      setEmotionContext(null);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSelectSession = async (newSessionId: string) => {
    await handleSessionChange(newSessionId);
    setActivePanel('stance');
  };

  // Handle Claude Vision emotion analysis request from EmpathyPanel (legacy callback)
  // Note: EmpathyPanel now calls the API directly, this is for backward compatibility
  const handleVisionRequest = useCallback(async (frame: string, _prompt: string) => {
    if (!sessionId) return;

    try {
      console.log('[Vision] Legacy callback - frame already sent by EmpathyPanel');
      // The EmpathyPanel now calls analyzeVisionEmotion directly and updates emotionContext
      // This callback is kept for compatibility but doesn't need to do anything
      // The emotion context will be updated by EmpathyPanel's onEmotionDetected callback
    } catch (err) {
      console.error('[Vision] Failed to analyze frame:', err);
    }
  }, [sessionId]);

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
        <div className={styles.headerLeft}>
          <h1>METAMORPH</h1>
          <span className={styles.subtitle}>Transformation-Maximizing AI</span>
        </div>
        <button className={styles.newSessionBtn} onClick={handleNewSession}>
          + New Chat
        </button>
      </header>

      <div className={styles.container}>
        <div className={styles.chatArea}>
          <Chat
            sessionId={sessionId}
            onSessionChange={handleSessionChange}
            onResponse={handleResponse}
            onPanelChange={handlePanelChange}
            onNewSession={handleNewSession}
            stance={stance}
            config={config}
            emotionContext={emotionContext}
          />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activePanel === 'stance' ? styles.active : ''}`}
              onClick={() => handlePanelChange('stance')}
            >
              Stance
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'config' ? styles.active : ''}`}
              onClick={() => handlePanelChange('config')}
            >
              Config
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'empathy' ? styles.active : ''}`}
              onClick={() => handlePanelChange('empathy')}
            >
              Empathy
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'timeline' ? styles.active : ''}`}
              onClick={() => handlePanelChange('timeline')}
            >
              Timeline
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'evolution' ? styles.active : ''}`}
              onClick={() => handlePanelChange('evolution')}
            >
              Evolution
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'sessions' ? styles.active : ''}`}
              onClick={() => handlePanelChange('sessions')}
            >
              Sessions
            </button>
            <button
              className={`${styles.tab} ${activePanel === 'memories' ? styles.active : ''}`}
              onClick={() => handlePanelChange('memories')}
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
            {activePanel === 'empathy' && (
              <EmpathyPanel
                enabled={config?.enableEmpathyMode ?? false}
                emotionContext={emotionContext}
                onToggle={(enabled) => handleConfigUpdate({ enableEmpathyMode: enabled })}
                onEmotionDetected={(context) => setEmotionContext(context)}
                onVisionRequest={handleVisionRequest}
                sessionId={sessionId}
                detectionInterval={config?.empathyCameraInterval ?? 1000}
                config={{
                  empathyCameraInterval: config?.empathyCameraInterval,
                  empathyMinConfidence: config?.empathyMinConfidence,
                  empathyAutoAdjust: config?.empathyAutoAdjust,
                  empathyBoostMax: config?.empathyBoostMax,
                }}
                onConfigUpdate={handleConfigUpdate}
              />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
