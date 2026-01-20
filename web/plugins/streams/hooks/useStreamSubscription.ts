'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StreamEvent, ServerMessage, ClientMessage, UseStreamSubscriptionReturn } from '../types';

const MAX_EVENTS_DEFAULT = 500;

interface UseStreamSubscriptionOptions {
  sessionId: string;
  maxEvents?: number;
  autoConnect?: boolean;
}

export function useStreamSubscription(
  options: UseStreamSubscriptionOptions
): UseStreamSubscriptionReturn {
  const { sessionId, maxEvents = MAX_EVENTS_DEFAULT, autoConnect = true } = options;

  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_API_PORT || '3001';
    const url = `${protocol}//${host}:${port}/ws/streams?sessionId=${encodeURIComponent(sessionId)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);

        // Resubscribe to previously subscribed channels
        for (const channel of subscribedChannelsRef.current) {
          send({ type: 'subscribe', channel });
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[useStreamSubscription] Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Auto-reconnect after 3 seconds
        if (autoConnect) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    }
  }, [sessionId, autoConnect]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'event':
        setEvents(prev => {
          const next = [...prev, msg.event];
          // Trim to max events
          return next.slice(-maxEvents);
        });
        break;

      case 'history':
        setEvents(prev => {
          // Merge history with existing events, avoiding duplicates
          const existingIds = new Set(prev.map(e => e.id));
          const newEvents = msg.events.filter(e => !existingIds.has(e.id));
          return [...newEvents, ...prev].slice(-maxEvents);
        });
        break;

      case 'error':
        setError(`${msg.code}: ${msg.message}`);
        break;
    }
  }, [maxEvents]);

  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);
    send({ type: 'subscribe', channel });
  }, [send]);

  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);
    send({ type: 'unsubscribe', channel });
  }, [send]);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  // Connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, autoConnect]);

  return {
    events,
    connected,
    error,
    clear,
    subscribe,
    unsubscribe,
  };
}
