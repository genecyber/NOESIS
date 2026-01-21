'use client';

import { useState, useEffect, useCallback, useRef, useMemo, ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Settings, Clock, Brain, FolderOpen, MessageSquare, Menu, X, GripVertical, ChevronDown, Plus, Zap } from 'lucide-react';
import Chat from '@/components/Chat';
import StanceViz from '@/components/StanceViz';
import Config from '@/components/Config';
import OperatorTimeline from '@/components/OperatorTimeline';
import EvolutionTimeline from '@/components/EvolutionTimeline';
import SessionBrowser from '@/components/SessionBrowser';
import MemoryBrowser from '@/components/MemoryBrowser';
import IdleModePanel from '@/components/IdleModePanel';
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui';
import { createSession, updateConfig, getState, getTimeline, getEvolution, resumeSession } from '@/lib/api';
import { getLastSessionId, saveLastSessionId, getPreferences, savePreferences } from '@/lib/storage';
import type { Stance, ModeConfig, ChatResponse, TimelineEntry, EvolutionSnapshot, EmotionContext } from '@/lib/types';
import { cn } from '@/lib/utils';
// Sync hooks
import { useEmotionSync } from '@/lib/hooks/useEmotionSync';
import { useMemorySync } from '@/lib/hooks/useMemorySync';
// Plugin system
import { pluginRegistry } from '@/lib/plugins/registry';
import { usePluginSession } from '@/lib/plugins/hooks';
import { plugins } from '@/plugins';
import type { PanelDefinition, PanelProps } from '@/lib/plugins/types';

// Core tabs (non-plugin panels)
const CORE_TABS: { id: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'stance', label: 'Stance', icon: Layers },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'idle', label: 'Idle Mode', icon: Zap },
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
  const [activePanel, setActivePanel] = useState<string>('stance');
  const [emotionContext, setEmotionContext] = useState<EmotionContext | null>(null);

  // Emotion sync - syncs browser emotion readings to server every 30 seconds
  const { emotionContext: serverEmotionContext, status: emotionSyncStatus } = useEmotionSync(sessionId);

  // Memory sync - bidirectional sync between browser localStorage and server every 60 seconds
  const { status: memorySyncStatus } = useMemorySync(sessionId);

  // Plugin system state
  const [pluginPanels, setPluginPanels] = useState<PanelDefinition[]>([]);
  const [pluginsReady, setPluginsReady] = useState(false);

  // Keep plugin registry in sync with session ID
  usePluginSession(sessionId);

  // Initialize plugins on mount - auto-discovers from plugins/index.ts
  useEffect(() => {
    const initPlugins = async () => {
      try {
        // Register and enable all plugins from the plugins folder
        for (const plugin of plugins) {
          const existing = pluginRegistry.getPlugin(plugin.manifest.id);
          if (!existing) {
            pluginRegistry.register(plugin);
          }
          await pluginRegistry.enable(plugin.manifest.id);
          console.log(`[Plugins] Initialized: ${plugin.manifest.name}`);
        }
        // Get panels from registry
        setPluginPanels(pluginRegistry.getPanels());
        setPluginsReady(true);
      } catch (err) {
        console.error('[Plugins] Failed to initialize:', err);
        setPluginsReady(true); // Continue without plugins
      }
    };
    initPlugins();

    return () => {
      // Cleanup all plugins on unmount
      for (const plugin of plugins) {
        pluginRegistry.disable(plugin.manifest.id).catch(console.error);
      }
    };
  }, []);

  // Update local emotion context when server context changes
  useEffect(() => {
    if (serverEmotionContext) {
      // Convert server emotion context to local EmotionContext format
      setEmotionContext({
        currentEmotion: serverEmotionContext.dominantEmotion,
        valence: serverEmotionContext.avgValence,
        arousal: serverEmotionContext.avgArousal,
        confidence: serverEmotionContext.avgConfidence,
        stability: serverEmotionContext.stability,
        promptContext: serverEmotionContext.promptContext,
        suggestedEmpathyBoost: serverEmotionContext.suggestedEmpathyBoost,
        timestamp: new Date(serverEmotionContext.lastSyncTime).toISOString(),
      });
    }
  }, [serverEmotionContext]);

  // Build combined tabs (core + plugin panels)
  const TABS = useMemo(() => {
    const coreTabs = CORE_TABS.map(tab => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      isPlugin: false as const,
    }));

    const pluginTabs = pluginPanels.map(panel => ({
      id: panel.id,
      label: panel.label,
      icon: panel.icon,
      isPlugin: true as const,
      panel,
    }));

    // Insert plugin panels after config (index 1) to maintain order
    return [...coreTabs.slice(0, 2), ...pluginTabs, ...coreTabs.slice(2)];
  }, [pluginPanels]);

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
  const handlePanelChange = useCallback((panel: string) => {
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

  // Memory sync is now handled by useMemorySync hook above with proper deduplication
  // Log sync status for debugging (only on change)
  useEffect(() => {
    if (memorySyncStatus.lastSyncTime) {
      console.log(`[MemorySync] Sync completed: ${memorySyncStatus.memoriesPulled} pulled, ${memorySyncStatus.memoriesPushed} pushed`);
    }
  }, [memorySyncStatus.lastSyncTime, memorySyncStatus.memoriesPulled, memorySyncStatus.memoriesPushed]);

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

              // Memory sync is handled by useMemorySync hook automatically
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

  // Get plugin capabilities for rendering plugin panels
  const getPluginCapabilities = useCallback((pluginId: string) => {
    const registration = pluginRegistry.getPlugin(pluginId);
    return registration?.capabilities ?? null;
  }, []);

  // Render panel content
  const renderPanelContent = () => {
    // Check if active panel is a plugin panel
    const pluginPanel = pluginPanels.find(p => p.id === activePanel);

    if (pluginPanel) {
      // Render plugin panel with PanelProps
      const PanelComponent = pluginPanel.component;
      const registration = pluginRegistry.getPlugin(
        pluginRegistry.getAllPlugins().find(p => p.plugin.panel?.id === pluginPanel.id)?.plugin.manifest.id ?? ''
      );

      if (!registration?.capabilities) {
        return <div className="text-emblem-muted p-4">Plugin not ready</div>;
      }

      const panelProps: PanelProps = {
        sessionId,
        stance,
        config,
        emotionContext,
        capabilities: registration.capabilities,
        onStanceUpdate: (newStance) => setStance(newStance),
        onConfigUpdate: handleConfigUpdate,
        onEmotionUpdate: (emotion) => {
          setEmotionContext(emotion);
          pluginRegistry.emitEmotionDetected(emotion);
        },
      };

      return <PanelComponent {...panelProps} />;
    }

    // Render core panels
    return (
      <>
        {activePanel === 'stance' && <StanceViz stance={stance} />}
        {activePanel === 'config' && <Config config={config} onUpdate={handleConfigUpdate} />}
        {activePanel === 'idle' && <IdleModePanel sessionId={sessionId} />}
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
      </>
    );
  };

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
