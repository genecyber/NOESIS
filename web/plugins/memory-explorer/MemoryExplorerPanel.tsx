/**
 * Memory Explorer Panel
 *
 * A plugin panel for 3D memory visualization and exploration.
 * Provides settings, search, and a launch point for the fullscreen viewer.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Settings,
  Maximize2,
  Box,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Database,
  Sparkles,
  GitBranch,
  X,
  Loader2,
} from 'lucide-react';
import type { PanelProps, Memory } from '@/lib/plugins/types';
import { cn } from '@/lib/utils';
import { Button, Slider } from '@/components/ui';
import type { VisualizationMode, ExplorerSettings, ExplorerState } from './types';
import { defaultExplorerSettings } from './types';
import { embedBatch, projectTo3D } from '@/lib/embeddings';
import type { MemoryNodeData, ConnectionData } from './Memory3DScene';

// Dynamic import for Memory3DScene (Three.js requires window)
const Memory3DScene = dynamic(
  () => import('./Memory3DScene').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-emblem-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emblem-primary animate-spin" />
          <span className="text-emblem-muted text-sm">Loading 3D...</span>
        </div>
      </div>
    )
  }
);

/**
 * Memory Explorer Panel Component
 */
export default function MemoryExplorerPanel({
  sessionId,
  config,
  capabilities,
}: PanelProps) {
  // Panel state
  const [settings, setSettings] = useState<ExplorerSettings>(defaultExplorerSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Memory[]>([]);

  // Memory data state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryNodes, setMemoryNodes] = useState<MemoryNodeData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Memory stats
  const [memoryStats, setMemoryStats] = useState({
    total: 0,
    episodic: 0,
    semantic: 0,
    identity: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isComputingEmbeddings, setIsComputingEmbeddings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fullscreen viewer state
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Load memories on mount
  useEffect(() => {
    loadMemories();
  }, [sessionId]);

  // Load memories and compute stats
  const loadMemories = useCallback(async () => {
    if (!capabilities.memory) return;

    setIsLoading(true);
    setError(null);

    try {
      const allMemories = await capabilities.memory.getMemories({});
      setMemories(allMemories);

      const stats = {
        total: allMemories.length,
        episodic: allMemories.filter(m => m.type === 'episodic').length,
        semantic: allMemories.filter(m => m.type === 'semantic').length,
        identity: allMemories.filter(m => m.type === 'identity').length,
      };

      setMemoryStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [capabilities.memory]);

  // Compute embeddings and project to 3D
  const computeEmbeddingsAndProject = useCallback(async () => {
    if (memories.length === 0) return;

    setIsComputingEmbeddings(true);
    setError(null);

    try {
      // Extract content from memories for embedding
      const contents = memories.map(m => m.content);

      // Get embeddings in batch
      const embeddings = await embedBatch(contents);

      // Project to 3D positions
      const positions = projectTo3D(embeddings);

      // Scale positions for better visualization (spread them out more)
      const scale = 15;

      // Create memory nodes with positions
      const nodes: MemoryNodeData[] = memories.map((memory, index) => ({
        id: memory.id,
        type: memory.type as 'episodic' | 'semantic' | 'identity',
        content: memory.content,
        importance: memory.importance ?? 0.5,
        position: {
          x: positions[index].x * scale,
          y: positions[index].y * scale,
          z: positions[index].z * scale,
        },
        embedding: embeddings[index],
      }));

      setMemoryNodes(nodes);

      // Compute connections based on embedding similarity (if enabled)
      if (settings.showConnections && embeddings.length > 1) {
        const newConnections: ConnectionData[] = [];

        for (let i = 0; i < embeddings.length; i++) {
          for (let j = i + 1; j < embeddings.length; j++) {
            // Calculate cosine similarity
            const similarity = cosineSimilarity(embeddings[i], embeddings[j]);

            // Only add connection if above threshold
            if (similarity >= settings.connectionThreshold) {
              newConnections.push({
                from: memories[i].id,
                to: memories[j].id,
                strength: similarity,
              });
            }
          }
        }

        setConnections(newConnections);
      }
    } catch (err) {
      console.error('[MemoryExplorer] Embedding computation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute embeddings');
    } finally {
      setIsComputingEmbeddings(false);
    }
  }, [memories, settings.showConnections, settings.connectionThreshold]);

  // Simple cosine similarity calculation
  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!capabilities.memory || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await capabilities.memory.searchMemories(searchQuery, {
        limit: 10,
      });
      setSearchResults(results);
    } catch (err) {
      console.error('[MemoryExplorer] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [capabilities.memory, searchQuery]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  // Update visualization mode
  const setVisualizationMode = (mode: VisualizationMode) => {
    setSettings(s => ({ ...s, mode }));
  };

  // Launch fullscreen viewer
  const launchViewer = async () => {
    // Compute embeddings if not already done
    if (memoryNodes.length === 0 && memories.length > 0) {
      await computeEmbeddingsAndProject();
    }
    setIsViewerOpen(true);
  };

  // Handle node click in 3D scene
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    const memory = memories.find(m => m.id === nodeId);
    setSelectedMemory(memory || null);
  }, [memories]);

  // Handle node hover in 3D scene
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  // Close viewer
  const closeViewer = () => {
    setIsViewerOpen(false);
    setSelectedNodeId(null);
    setSelectedMemory(null);
  };

  // Get the hovered memory for tooltip preview
  const hoveredMemory = useMemo(() => {
    if (!hoveredNodeId) return null;
    return memories.find(m => m.id === hoveredNodeId) || null;
  }, [hoveredNodeId, memories]);

  // Mode icons
  const modeIcons: Record<VisualizationMode, typeof Box> = {
    spatial: Box,
    temporal: Clock,
    hybrid: Layers,
  };

  // Filter nodes based on settings
  const filteredNodes = useMemo(() => {
    return memoryNodes.filter(node => {
      // Filter by importance
      if (node.importance < settings.filters.minImportance) return false;

      // Filter by type
      if (node.type === 'episodic' && !settings.filters.showEpisodic) return false;
      if (node.type === 'semantic' && !settings.filters.showSemantic) return false;
      if (node.type === 'identity' && !settings.filters.showIdentity) return false;

      return true;
    });
  }, [memoryNodes, settings.filters]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold gradient-text">Memory Explorer</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'p-1.5 rounded transition-colors',
            showSettings
              ? 'bg-emblem-primary/20 text-emblem-primary'
              : 'text-emblem-muted hover:text-emblem-text hover:bg-white/5'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs">
        {memoryStats.total > 0 ? (
          <CheckCircle className="w-3.5 h-3.5 text-emblem-accent" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-emblem-muted" />
        )}
        <span className="text-emblem-muted">
          {memoryStats.total > 0
            ? `${memoryStats.total} memories loaded`
            : 'No memories found'}
        </span>
        <button
          onClick={loadMemories}
          disabled={isLoading}
          className="ml-auto p-1 text-emblem-muted hover:text-emblem-text transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-emblem-danger/10 border border-emblem-danger/20 rounded-lg text-xs text-emblem-danger">
          {error}
        </div>
      )}

      {/* Visualization mode selector */}
      <div className="space-y-2">
        <span className="text-xs text-emblem-muted">Visualization Mode</span>
        <div className="flex gap-2">
          {(['spatial', 'temporal', 'hybrid'] as VisualizationMode[]).map(mode => {
            const Icon = modeIcons[mode];
            return (
              <button
                key={mode}
                onClick={() => setVisualizationMode(mode)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize',
                  settings.mode === mode
                    ? 'bg-emblem-primary/20 text-emblem-primary border border-emblem-primary/30'
                    : 'bg-emblem-surface-2 text-emblem-muted border border-white/5 hover:text-emblem-text'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory stats */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emblem-text">
          <Database className="w-4 h-4" />
          <span>Memory Statistics</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-emblem-surface rounded-lg">
            <div className="text-lg font-bold text-emblem-accent">{memoryStats.episodic}</div>
            <div className="text-xs text-emblem-muted">Episodic</div>
          </div>
          <div className="text-center p-2 bg-emblem-surface rounded-lg">
            <div className="text-lg font-bold text-emblem-secondary">{memoryStats.semantic}</div>
            <div className="text-xs text-emblem-muted">Semantic</div>
          </div>
          <div className="text-center p-2 bg-emblem-surface rounded-lg">
            <div className="text-lg font-bold text-emblem-primary">{memoryStats.identity}</div>
            <div className="text-xs text-emblem-muted">Identity</div>
          </div>
        </div>
      </div>

      {/* Search input */}
      <form onSubmit={handleSearchSubmit} className="space-y-2">
        <span className="text-xs text-emblem-muted">Semantic Search</span>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search memories by meaning..."
            className="w-full px-3 py-2 pl-9 bg-emblem-surface-2 border border-white/5 rounded-lg text-sm text-emblem-text placeholder:text-emblem-muted focus:outline-none focus:border-emblem-primary/30"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emblem-muted" />
          {isSearching && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emblem-muted animate-spin" />
          )}
        </div>
      </form>

      {/* Search results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <span className="text-xs text-emblem-muted">{searchResults.length} results</span>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {searchResults.slice(0, 5).map(memory => (
                <div
                  key={memory.id}
                  className="px-3 py-2 bg-emblem-surface-2 rounded-lg text-xs text-emblem-text truncate"
                >
                  <span className={cn(
                    'inline-block w-2 h-2 rounded-full mr-2',
                    memory.type === 'episodic' && 'bg-emblem-accent',
                    memory.type === 'semantic' && 'bg-emblem-secondary',
                    memory.type === 'identity' && 'bg-emblem-primary'
                  )} />
                  {memory.content}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch viewer button */}
      <Button
        onClick={launchViewer}
        disabled={memoryStats.total === 0 || isComputingEmbeddings}
        className="w-full flex items-center justify-center gap-2"
      >
        {isComputingEmbeddings ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Computing Embeddings...</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4" />
            <span>Launch Explorer</span>
          </>
        )}
      </Button>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-4">
              <h4 className="text-sm font-medium text-emblem-text">Settings</h4>

              {/* Auto-clustering toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-emblem-muted">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Auto-Clustering</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, autoClustering: !s.autoClustering }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    settings.autoClustering ? 'bg-emblem-primary' : 'bg-emblem-surface'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                      settings.autoClustering ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Cluster count */}
              {settings.autoClustering && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-emblem-muted">
                    <span>Cluster Count</span>
                    <span>{settings.clusterCount}</span>
                  </div>
                  <Slider
                    value={[settings.clusterCount]}
                    min={2}
                    max={10}
                    step={1}
                    onValueChange={([value]) =>
                      setSettings(s => ({ ...s, clusterCount: value }))
                    }
                  />
                </div>
              )}

              {/* Show connections toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-emblem-muted">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Show Connections</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, showConnections: !s.showConnections }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    settings.showConnections ? 'bg-emblem-primary' : 'bg-emblem-surface'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                      settings.showConnections ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Connection threshold */}
              {settings.showConnections && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-emblem-muted">
                    <span>Connection Threshold</span>
                    <span>{Math.round(settings.connectionThreshold * 100)}%</span>
                  </div>
                  <Slider
                    value={[settings.connectionThreshold]}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onValueChange={([value]) =>
                      setSettings(s => ({ ...s, connectionThreshold: value }))
                    }
                  />
                </div>
              )}

              {/* Min importance filter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-emblem-muted">
                  <span>Min Importance</span>
                  <span>{Math.round(settings.filters.minImportance * 100)}%</span>
                </div>
                <Slider
                  value={[settings.filters.minImportance]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([value]) =>
                    setSettings(s => ({
                      ...s,
                      filters: { ...s.filters, minImportance: value }
                    }))
                  }
                />
              </div>

              {/* Memory type filters */}
              <div className="space-y-2">
                <span className="text-xs text-emblem-muted">Show Memory Types</span>
                <div className="flex gap-2">
                  {(['episodic', 'semantic', 'identity'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() =>
                        setSettings(s => ({
                          ...s,
                          filters: {
                            ...s.filters,
                            [`show${type.charAt(0).toUpperCase() + type.slice(1)}`]:
                              !s.filters[`show${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof s.filters],
                          },
                        }))
                      }
                      className={cn(
                        'flex-1 px-2 py-1 rounded text-xs capitalize transition-colors',
                        settings.filters[`show${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof settings.filters]
                          ? type === 'episodic'
                            ? 'bg-emblem-accent/20 text-emblem-accent'
                            : type === 'semantic'
                            ? 'bg-emblem-secondary/20 text-emblem-secondary'
                            : 'bg-emblem-primary/20 text-emblem-primary'
                          : 'bg-emblem-surface text-emblem-muted'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen 3D Viewer Portal */}
      {isViewerOpen && typeof document !== 'undefined' && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-emblem-bg"
        >
          {/* Close button */}
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-emblem-surface/80 backdrop-blur-sm text-emblem-text hover:text-emblem-primary hover:bg-emblem-surface transition-colors"
            aria-label="Close viewer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
            <Brain className="w-6 h-6 text-emblem-primary" />
            <h2 className="font-display font-bold text-lg text-emblem-text">
              Memory Explorer
            </h2>
            <span className="text-xs text-emblem-muted px-2 py-1 bg-emblem-surface/80 rounded-full">
              {filteredNodes.length} nodes
            </span>
          </div>

          {/* 3D Scene */}
          <div className="w-full h-full">
            <Memory3DScene
              nodes={filteredNodes}
              connections={connections}
              selectedNodeId={selectedNodeId}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              showConnections={settings.showConnections}
              autoRotate={memoryNodes.length > 0 && !selectedNodeId}
            />
          </div>

          {/* Selected Memory Detail Sidebar */}
          <AnimatePresence>
            {selectedMemory && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute top-0 right-0 h-full w-80 bg-emblem-bg/95 backdrop-blur-md border-l border-white/10 p-6 pt-16 overflow-y-auto"
              >
                <div className="space-y-4">
                  {/* Memory type badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium capitalize',
                      selectedMemory.type === 'episodic' && 'bg-emblem-accent/20 text-emblem-accent',
                      selectedMemory.type === 'semantic' && 'bg-emblem-secondary/20 text-emblem-secondary',
                      selectedMemory.type === 'identity' && 'bg-emblem-primary/20 text-emblem-primary'
                    )}>
                      {selectedMemory.type}
                    </span>
                    {selectedMemory.importance && (
                      <span className="text-xs text-emblem-muted">
                        Importance: {Math.round(selectedMemory.importance * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Memory content */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-emblem-text">Content</h3>
                    <p className="text-sm text-emblem-muted leading-relaxed">
                      {selectedMemory.content}
                    </p>
                  </div>

                  {/* Memory metadata */}
                  {selectedMemory.metadata && Object.keys(selectedMemory.metadata).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-emblem-text">Metadata</h3>
                      <div className="bg-emblem-surface/50 rounded-lg p-3 space-y-1">
                        {Object.entries(selectedMemory.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-emblem-muted">{key}</span>
                            <span className="text-emblem-text">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-emblem-text">Created</h3>
                    <p className="text-xs text-emblem-muted">
                      {new Date(selectedMemory.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {/* Close selection button */}
                  <Button
                    onClick={() => {
                      setSelectedNodeId(null);
                      setSelectedMemory(null);
                    }}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    Clear Selection
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading overlay */}
          {isComputingEmbeddings && (
            <div className="absolute inset-0 bg-emblem-bg/80 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-emblem-primary animate-spin" />
                <p className="text-emblem-text">Computing memory embeddings...</p>
              </div>
            </div>
          )}
        </motion.div>,
        document.body
      )}
    </div>
  );
}
