/**
 * Streams Panel
 *
 * A sidebar panel that displays available streams and their status.
 * Allows users to view stream connections, select streams for detailed viewing,
 * and monitor real-time event counts.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  Activity,
  Clock,
} from 'lucide-react';
import type { PanelProps } from '@/lib/plugins/types';
import { cn } from '@/lib/utils';
import { useStreamSubscription, useStreamList } from './hooks';
import type { StreamInfo, StreamsPanelState } from './types';
import { defaultStreamsPanelState } from './types';

interface StreamsPanelProps extends PanelProps {
  /** Callback when a stream is selected */
  onStreamSelect?: (streamChannel: string | null) => void;
}

/**
 * Streams Panel Component
 */
export default function StreamsPanel({
  sessionId,
  config,
  capabilities,
  onStreamSelect,
}: StreamsPanelProps) {
  // Panel state
  const [panelState, setPanelState] = useState<StreamsPanelState>(defaultStreamsPanelState);
  const [showSettings, setShowSettings] = useState(false);

  // Use stream hooks
  const { connected, error: subscriptionError } = useStreamSubscription({
    sessionId: sessionId || 'default',
    autoConnect: true,
  });

  const {
    streams,
    loading,
    error: listError,
    refresh,
  } = useStreamList({
    sessionId: sessionId || 'default',
  });

  // Combined error
  const error = subscriptionError || listError;

  // Handle stream selection
  const handleStreamSelect = useCallback((channel: string) => {
    const newSelection = panelState.selectedStream === channel ? null : channel;
    setPanelState(s => ({ ...s, selectedStream: newSelection }));
    onStreamSelect?.(newSelection);
  }, [panelState.selectedStream, onStreamSelect]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Auto-refresh stream list periodically
  useEffect(() => {
    const interval = setInterval(refresh, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold gradient-text">Streams</h3>
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

      {/* Connection status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <div className={cn(
          'w-2 h-2 rounded-full',
          connected ? 'bg-emblem-accent' : 'bg-emblem-danger'
        )} />
        <span className="text-emblem-muted">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto p-1 text-emblem-muted hover:text-emblem-text transition-colors"
          title="Refresh streams"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-emblem-danger/10 border border-emblem-danger/20 rounded-lg text-xs text-emblem-danger">
          {error}
        </div>
      )}

      {/* Stream stats */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-emblem-text">
          <Activity className="w-4 h-4" />
          <span>Active Streams</span>
        </div>
        <div className="flex items-center justify-between text-emblem-muted text-xs">
          <span>{streams.length} stream{streams.length !== 1 ? 's' : ''}</span>
          <span>
            {streams.reduce((sum, s) => sum + s.eventCount, 0)} total events
          </span>
        </div>
      </div>

      {/* Stream list */}
      <div className="space-y-2">
        <span className="text-xs text-emblem-muted">Available Streams</span>

        {loading && streams.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-emblem-muted">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-emblem-muted gap-2">
            <Radio className="w-6 h-6 opacity-50" />
            <span className="text-xs">No active streams</span>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {streams.map((stream) => (
                <motion.button
                  key={stream.channel}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={() => handleStreamSelect(stream.channel)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                    panelState.selectedStream === stream.channel
                      ? 'bg-emblem-primary/20 border border-emblem-primary/30'
                      : 'bg-emblem-surface-2 border border-white/5 hover:border-white/10 hover:bg-emblem-surface'
                  )}
                >
                  {/* Stream icon with status */}
                  <div className="relative flex-shrink-0">
                    <Radio className={cn(
                      'w-4 h-4 mt-0.5',
                      panelState.selectedStream === stream.channel
                        ? 'text-emblem-primary'
                        : 'text-emblem-muted'
                    )} />
                    <div className={cn(
                      'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
                      connected ? 'bg-emblem-accent' : 'bg-emblem-danger'
                    )} />
                  </div>

                  {/* Stream info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'text-sm font-medium truncate',
                        panelState.selectedStream === stream.channel
                          ? 'text-emblem-primary'
                          : 'text-emblem-text'
                      )}>
                        {stream.channel}
                      </span>
                      <span className="text-xs text-emblem-muted flex-shrink-0">
                        {stream.eventCount} events
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-emblem-muted">
                      <Clock className="w-3 h-3" />
                      <span>Last: {formatTimestamp(stream.lastEventAt)}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Selected stream details */}
      <AnimatePresence>
        {panelState.selectedStream && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <StreamDetails
              stream={streams.find(s => s.channel === panelState.selectedStream)}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

              {/* Auto-scroll toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-emblem-muted">Auto-scroll to new events</span>
                <button
                  onClick={() => setPanelState(s => ({ ...s, autoScroll: !s.autoScroll }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    panelState.autoScroll ? 'bg-emblem-primary' : 'bg-emblem-surface'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                      panelState.autoScroll ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Show timestamps toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-emblem-muted">Show timestamps</span>
                <button
                  onClick={() => setPanelState(s => ({ ...s, showTimestamps: !s.showTimestamps }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    panelState.showTimestamps ? 'bg-emblem-primary' : 'bg-emblem-surface'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                      panelState.showTimestamps ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Max events setting */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-emblem-muted">
                  <span>Max events in memory</span>
                  <span>{panelState.maxEvents}</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={2000}
                  step={100}
                  value={panelState.maxEvents}
                  onChange={(e) => setPanelState(s => ({ ...s, maxEvents: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-emblem-surface rounded-full appearance-none cursor-pointer accent-emblem-primary"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Stream Details Component
 */
function StreamDetails({ stream }: { stream: StreamInfo | undefined }) {
  if (!stream) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-emblem-primary" />
        <h4 className="text-sm font-medium text-emblem-text">{stream.channel}</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <span className="text-emblem-muted">Created</span>
          <p className="text-emblem-text">
            {new Date(stream.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-emblem-muted">Event Count</span>
          <p className="text-emblem-text">{stream.eventCount}</p>
        </div>

        {stream.lastEventAt && (
          <div className="space-y-1 col-span-2">
            <span className="text-emblem-muted">Last Event</span>
            <p className="text-emblem-text">
              {new Date(stream.lastEventAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {stream.metadata && Object.keys(stream.metadata).length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <span className="text-xs text-emblem-muted">Metadata</span>
          <div className="bg-emblem-surface/50 rounded-lg p-2 space-y-1">
            {Object.entries(stream.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-emblem-muted">{key}</span>
                <span className="text-emblem-text truncate max-w-32">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
