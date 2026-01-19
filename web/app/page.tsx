'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Settings, Heart, Clock, Brain, FolderOpen, MessageSquare, Menu, X, GripVertical, ChevronDown, Plus } from 'lucide-react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import OperatorTimeline from '@/components/OperatorTimeline';
import EvolutionTimeline from '@/components/EvolutionTimeline';
import SessionBrowser from '@/components/SessionBrowser';
import MemoryBrowser from '@/components/MemoryBrowser';
import EmpathyPanel from '@/components/EmpathyPanel';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
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

// Mobile breakpoint hook
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

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

  // Sidebar state (desktop)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);
  const minSidebarWidth = 280;
  const maxSidebarWidth = 500;

  // Mobile state
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

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

  // Handle sidebar resize (desktop only)
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

  // Toggle sidebar (desktop)
  const toggleSidebar = useCallback(() => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    savePreferences({ sidebarOpen: newState });
  }, [sidebarOpen]);

  // Save active panel preference when it changes
  const handlePanelChange = useCallback((panel: PanelType) => {
    setActivePanel(panel);
    savePreferences({ activePanel: panel });
    if (isMobile) {
      setMobileDrawerOpen(false);
      setMobilePanelOpen(true);
    }
  }, [isMobile]);

  // Close mobile panel
  const closeMobilePanel = useCallback(() => {
    setMobilePanelOpen(false);
  }, []);

  // Sync pending items on load (standard PWA pattern)
  useEffect(() => {
    const syncOnLoad = async () => {
      if (!isOnline()) return;

      try {
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

    const handleOnline = () => syncOnLoad();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const lastSessionId = getLastSessionId();
        if (lastSessionId) {
          try {
            const resumed = await resumeSession(lastSessionId);
            if (resumed) {
              setSessionId(resumed.sessionId);
              setStance(resumed.stance);
              setConfig(resumed.config);
              setError(null);

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
            console.log('Last session not found on server, creating new session');
          }
        }

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
      saveLastSessionId(session.sessionId);
      setEmotionContext(null);
      if (isMobile) {
        setMobilePanelOpen(false);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSelectSession = async (newSessionId: string) => {
    await handleSessionChange(newSessionId);
    setActivePanel('stance');
    if (isMobile) {
      setMobilePanelOpen(false);
    }
  };

  const handleVisionRequest = useCallback(async (frame: string, _prompt: string) => {
    if (!sessionId) return;
    try {
      console.log('[Vision] Legacy callback - frame already sent by EmpathyPanel');
    } catch (err) {
      console.error('[Vision] Failed to analyze frame:', err);
    }
  }, [sessionId]);

  // Render panel content
  const renderPanelContent = () => (
    <>
      {activePanel === 'stance' && <StanceViz stance={stance} />}
      {activePanel === 'config' && <Config config={config} onUpdate={handleConfigUpdate} />}
      {activePanel === 'timeline' && <OperatorTimeline entries={timelineEntries} />}
      {activePanel === 'evolution' && <EvolutionTimeline snapshots={evolutionSnapshots} currentStance={stance || undefined} />}
      {activePanel === 'sessions' && (
        <SessionBrowser
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
      )}
      {activePanel === 'memories' && <MemoryBrowser sessionId={sessionId} />}
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
    </>
  );

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

  // Mobile layout
  if (isMobile) {
    return (
      <main className="h-screen max-h-screen flex flex-col overflow-hidden relative">
        {/* Mobile pull-down drawer handle */}
        <div className="absolute top-0 left-0 right-0 z-40 flex justify-center">
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="flex items-center gap-1 px-4 py-1.5 bg-emblem-surface-2/90 backdrop-blur-lg rounded-b-xl border border-t-0 border-white/10 transition-colors"
          >
            <ChevronDown className={cn(
              "w-4 h-4 text-emblem-muted transition-transform",
              mobileDrawerOpen && "rotate-180"
            )} />
            <span className="text-xs text-emblem-muted">Menu</span>
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-0 left-0 right-0 z-30 bg-emblem-surface/95 backdrop-blur-lg border-b border-white/10 pt-10 pb-4 px-4"
            >
              {/* Tab buttons */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handlePanelChange(id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-lg transition-all',
                      activePanel === id
                        ? 'bg-emblem-secondary/20 text-emblem-secondary'
                        : 'text-emblem-muted hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px]">{label}</span>
                  </button>
                ))}
                {/* New Chat button */}
                <button
                  onClick={handleNewSession}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg transition-all text-emblem-primary hover:bg-emblem-primary/10"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px]">New</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile full-screen panel overlay */}
        <AnimatePresence>
          {mobilePanelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-0 z-50 bg-emblem-bg flex flex-col"
            >
              {/* Panel header with close button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h2 className="text-lg font-display font-semibold text-emblem-secondary capitalize">
                  {activePanel}
                </h2>
                <button
                  onClick={closeMobilePanel}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-emblem-muted" />
                </button>
              </div>
              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-styled">
                {renderPanelContent()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile chat - edge to edge */}
        <div className="flex-1 min-h-0 max-h-full flex flex-col pt-8">
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
      </main>
    );
  }

  // Desktop layout
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
            <span className="text-sm text-emblem-muted">Transformation-Maximizing AI</span>
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
          <TooltipProvider delayDuration={200}>
            <div className="flex border-b border-white/10">
              {TABS.map(({ id, label, icon: Icon }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        'flex-1 py-2.5 flex items-center justify-center transition-all relative',
                        'cursor-pointer',
                        activePanel === id
                          ? 'text-emblem-secondary'
                          : 'text-emblem-muted hover:text-emblem-text hover:bg-white/5'
                      )}
                      onClick={() => handlePanelChange(id)}
                    >
                      <Icon className="w-4 h-4" />
                      {activePanel === id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emblem-secondary" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <div className="flex-1 overflow-y-auto scrollbar-styled">
            {renderPanelContent()}
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
