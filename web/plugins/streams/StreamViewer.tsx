/**
 * Stream Viewer Component
 *
 * A component for viewing live stream events in real-time.
 * Displays events with timestamps, sources, and formatted JSON data.
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Trash2,
  Radio,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStreamSubscription } from './hooks';
import type { StreamEvent } from './types';

interface StreamViewerProps {
  /** Currently selected channel to subscribe to */
  channel: string | null;
  /** Session ID for the WebSocket connection */
  sessionId: string;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Token types for JSON highlighting
 */
type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize a JSON string for syntax highlighting
 */
function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < json.length) {
    const char = json[i];

    // Skip whitespace but preserve it
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < json.length && /\s/.test(json[i])) {
        whitespace += json[i];
        i++;
      }
      tokens.push({ type: 'punctuation', value: whitespace });
      continue;
    }

    // Punctuation: { } [ ] , :
    if (/[{}\[\],:]/.test(char)) {
      tokens.push({ type: 'punctuation', value: char });
      i++;
      continue;
    }

    // String (key or value)
    if (char === '"') {
      let str = '"';
      i++;
      while (i < json.length && json[i] !== '"') {
        if (json[i] === '\\' && i + 1 < json.length) {
          str += json[i] + json[i + 1];
          i += 2;
        } else {
          str += json[i];
          i++;
        }
      }
      str += '"';
      i++;

      // Check if this is a key (followed by :)
      let j = i;
      while (j < json.length && /\s/.test(json[j])) j++;
      const isKey = json[j] === ':';

      tokens.push({ type: isKey ? 'key' : 'string', value: str });
      continue;
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = '';
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        num += json[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Boolean or null
    if (json.slice(i, i + 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (json.slice(i, i + 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (json.slice(i, i + 4) === 'null') {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // Unknown character, treat as punctuation
    tokens.push({ type: 'punctuation', value: char });
    i++;
  }

  return tokens;
}

/**
 * Get color class for token type
 */
function getTokenColor(type: TokenType): string {
  switch (type) {
    case 'key':
      return 'text-purple-400';
    case 'string':
      return 'text-green-400';
    case 'number':
      return 'text-amber-400';
    case 'boolean':
      return 'text-blue-400';
    case 'null':
      return 'text-gray-500';
    case 'punctuation':
    default:
      return 'text-gray-400';
  }
}

/**
 * JSON Syntax Highlighter Component - Safe implementation using React elements
 */
function JsonHighlight({ data }: { data: unknown }) {
  const tokens = useMemo(() => {
    const jsonString = JSON.stringify(data, null, 2);
    return tokenizeJson(jsonString);
  }, [data]);

  return (
    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
      {tokens.map((token, index) => (
        <span key={index} className={getTokenColor(token.type)}>
          {token.value}
        </span>
      ))}
    </pre>
  );
}

/**
 * Individual Event Card Component
 */
function EventCard({ event, isExpanded, onToggle }: {
  event: StreamEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isSimpleData = typeof event.data !== 'object' || event.data === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden"
    >
      {/* Event Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-700/30 transition-colors',
          isExpanded && 'border-b border-gray-700/50'
        )}
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        {!isSimpleData && (
          <span className="text-gray-500">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}

        {/* Timestamp */}
        <span className="flex items-center gap-1 text-xs text-gray-500 font-mono">
          <Clock className="w-3 h-3" />
          {formatTimestamp(event.timestamp)}
        </span>

        {/* Source Badge */}
        {event.source && (
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
            {event.source}
          </span>
        )}

        {/* Simple data preview */}
        {isSimpleData && (
          <span className="text-sm text-gray-300 truncate flex-1">
            {String(event.data)}
          </span>
        )}

        {/* Complex data type indicator */}
        {!isSimpleData && (
          <span className="text-xs text-gray-500">
            {Array.isArray(event.data)
              ? `Array[${(event.data as unknown[]).length}]`
              : 'Object'}
          </span>
        )}
      </div>

      {/* Expanded Data View */}
      <AnimatePresence>
        {isExpanded && !isSimpleData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 bg-gray-900/50">
              <JsonHighlight data={event.data} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Stream Viewer Component
 *
 * Displays real-time stream events with formatting and controls.
 */
export default function StreamViewer({ channel, sessionId }: StreamViewerProps) {
  // Subscribe to stream events
  const { events, connected, error, clear, subscribe, unsubscribe } = useStreamSubscription({
    sessionId,
  });

  // Auto-scroll state
  const [autoScroll, setAutoScroll] = useState(true);

  // Expanded event IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track previous channel for subscription management
  const prevChannelRef = useRef<string | null>(null);

  // Subscribe/unsubscribe when channel changes
  useEffect(() => {
    const prevChannel = prevChannelRef.current;

    // Unsubscribe from previous channel
    if (prevChannel && prevChannel !== channel) {
      unsubscribe(prevChannel);
    }

    // Subscribe to new channel
    if (channel && channel !== prevChannel) {
      subscribe(channel);
    }

    prevChannelRef.current = channel;
  }, [channel, subscribe, unsubscribe]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Toggle event expansion
  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Handle clear with expanded state reset
  const handleClear = useCallback(() => {
    clear();
    setExpandedIds(new Set());
  }, [clear]);

  // Empty state - no channel selected
  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Radio className="w-12 h-12 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-400 mb-2">
          No Stream Selected
        </h3>
        <p className="text-sm text-gray-500">
          Select a stream from the list to view live events
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            )}
          />
          <span className="text-sm font-medium text-gray-300 truncate max-w-[200px]">
            {channel}
          </span>
          <span className="text-xs text-gray-500">
            ({events.length} events)
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'p-1.5 rounded transition-colors',
              autoScroll
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
            )}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            {autoScroll ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>

          {/* Clear button */}
          <button
            onClick={handleClear}
            disabled={events.length === 0}
            className={cn(
              'p-1.5 rounded transition-colors',
              events.length > 0
                ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                : 'text-gray-600 cursor-not-allowed'
            )}
            title="Clear events"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Events list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Radio className="w-8 h-8 text-gray-600 mb-3 animate-pulse" />
            <p className="text-sm text-gray-500">
              Waiting for events...
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map(event => (
              <EventCard
                key={event.id}
                event={event}
                isExpanded={expandedIds.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
