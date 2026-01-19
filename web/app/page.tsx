'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, Settings, Heart, Clock, Brain, FolderOpen, MessageSquare, Menu, X, GripVertical } from 'lucide-react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import OperatorTimeline from '@/components/OperatorTimeline';
import EvolutionTimeline from '@/components/EvolutionTimeline';
import SessionBrowser from '@/components/SessionBrowser';
import MemoryBrowser from '@/components/MemoryBrowser';
import EmpathyPanel from '@/components/EmpathyPanel';
import { Button } from '@/components/ui';
import { createSession, updateConfig, getState, getTimeline, getEvolution, resumeSession, syncMemoriesToServer } from '@/lib/api';
import { getLastSessionId, saveLastSessionId, getPreferences, savePreferences, getMemoriesFromStorage, getPendingSyncItems, removeSyncQueueItem, isOnline } from '@/lib/storage';
import type { Stance, ModeConfig, ChatResponse, TimelineEntry, EvolutionSnapshot, EmotionContext } from '@/lib/types';
import { cn } from '@/lib/utils';

type PanelType = 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories' | 'empathy';

const TABS: { id: PanelType; label: string; icon: React.ElementType }[] = [
  { id: 'stance', label: 'Stance', icon: Layers },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'empathy', label: 'Empathy', icon: Heart },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'evolution', label: 'Evolution', icon: Brain },
  { id: 'sessions', label: 'Sessions', icon: FolderOpen },
  { id: 'memories', label: 'Memories', icon: MessageSquare },
];

export default function Home() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [stance, setStance] = useState<Stance | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [evolutionSnapshots, setEvolutionSnapshots] = useState<EvolutionSnapshot[]>([]);

  // Load active panel preference from localStorage
  const [activePanel, setActivePanel] = useState<PanelType>('stance');
  const [emotionContext, setEmotionContext] = useState<EmotionContext | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);
  const minSidebarWidth = 280;
  const maxSidebarWidth = 500;

  // Initialize preferences from localStorage on mount
  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.activePanel) {
      setActivePanel(prefs.activePanel);
    }
    if (prefs.sidebarOpen !== undefined) {
      setSidebarOpen(prefs.sidebarOpen);
    }
    if (prefs.sidebarWidth) {
      setSidebarWidth(prefs.sidebarWidth);
    }
  }, []);

  // Handle sidebar resize
  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(maxSidebarWidth, Math.max(minSidebarWidth, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Save width to preferences
        savePreferences({ sidebarWidth });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    savePreferences({ sidebarOpen: newState });
  }, [sidebarOpen]);

  // Save active panel preference when it changes
  const handlePanelChange = useCallback((panel: PanelType) => {
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
      <main className="h-screen max-h-screen flex flex-col overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center min-h-screen">
          <h2 className="text-emblem-danger text-xl font-display font-semibold">Connection Error</h2>
          <p className="text-emblem-text">{error}</p>
          <p className="text-sm text-emblem-muted">
            Make sure the METAMORPH server is running on port 3001
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen max-h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg bg-emblem-surface-2 hover:bg-emblem-surface border border-white/10 transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-display font-bold gradient-text">METAMORPH</h1>
            <span className="text-sm text-emblem-muted max-md:hidden">Transformation-Maximizing AI</span>
          </div>
        </div>
        <Button variant="outline" onClick={handleNewSession}>
          + New Chat
        </Button>
      </header>

      <div className="flex-1 flex h-[calc(100vh-73px)] max-h-[calc(100vh-73px)] overflow-hidden">
        {/* Sidebar - Left side */}
        <aside
          className={cn(
            'flex flex-col gap-4 min-h-0 max-h-full bg-emblem-surface/50 border-r border-white/5 transition-all duration-300 ease-in-out overflow-hidden',
            sidebarOpen ? 'p-4' : 'w-0 p-0'
          )}
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        >
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                title={label}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  'border border-white/5 cursor-pointer',
                  activePanel === id
                    ? 'bg-gradient-to-r from-emblem-secondary to-emblem-primary text-white border-transparent'
                    : 'bg-emblem-surface-2 text-emblem-muted hover:text-emblem-text hover:border-emblem-secondary/50'
                )}
                onClick={() => handlePanelChange(id)}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-styled">
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

        {/* Resize handle */}
        {sidebarOpen && (
          <div
            className="w-3 bg-emblem-surface-2/50 hover:bg-emblem-primary/30 cursor-col-resize flex-shrink-0 transition-all group flex items-center justify-center border-x border-white/5"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="w-4 h-6 text-emblem-muted/50 group-hover:text-emblem-primary transition-colors" />
          </div>
        )}

        {/* Chat - Main content */}
        <div className="flex-1 min-h-0 max-h-full flex flex-col p-4">
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
      </div>
    </main>
  );
}
