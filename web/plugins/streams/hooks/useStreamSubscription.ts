'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { StreamEvent, ServerMessage, ClientMessage, UseStreamSubscriptionReturn } from '../types';

const MAX_EVENTS_DEFAULT = 500;

// ============================================================================
// Singleton Connection Manager
// ============================================================================

interface ConnectionState {
  ws: WebSocket | null;
  connected: boolean;
  error: string | null;
  refCount: number;
  reconnectTimeout: NodeJS.Timeout | null;
}

interface ConnectionStore {
  state: ConnectionState;
  listeners: Set<() => void>;
  subscribedChannels: Set<string>;
  messageHandlers: Set<(msg: ServerMessage) => void>;
}

// Module-level singleton map: one connection per sessionId
const connectionStores = new Map<string, ConnectionStore>();

function getOrCreateStore(sessionId: string): ConnectionStore {
  let store = connectionStores.get(sessionId);
  if (!store) {
    store = {
      state: {
        ws: null,
        connected: false,
        error: null,
        refCount: 0,
        reconnectTimeout: null,
      },
      listeners: new Set(),
      subscribedChannels: new Set(),
      messageHandlers: new Set(),
    };
    connectionStores.set(sessionId, store);
  }
  return store;
}

function notifyListeners(store: ConnectionStore) {
  for (const listener of store.listeners) {
    listener();
  }
}

function connectStore(sessionId: string, store: ConnectionStore) {
  if (store.state.ws?.readyState === WebSocket.OPEN) return;
  if (store.state.ws?.readyState === WebSocket.CONNECTING) return;

  const isSecure = window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  // In production (https), use default port. In dev, use configured port.
  const port = isSecure ? '' : `:${process.env.NEXT_PUBLIC_API_PORT || '3001'}`;
  const url = `${protocol}//${host}${port}/ws/streams?sessionId=${encodeURIComponent(sessionId)}`;

  try {
    const ws = new WebSocket(url);
    store.state.ws = ws;

    ws.onopen = () => {
      store.state.connected = true;
      store.state.error = null;
      notifyListeners(store);

      // Resubscribe to all channels
      for (const channel of store.subscribedChannels) {
        ws.send(JSON.stringify({ type: 'subscribe', channel }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        // Dispatch to all message handlers
        for (const handler of store.messageHandlers) {
          handler(msg);
        }
      } catch (e) {
        console.error('[StreamConnection] Failed to parse message:', e);
      }
    };

    ws.onerror = () => {
      store.state.error = 'WebSocket connection error';
      notifyListeners(store);
    };

    ws.onclose = () => {
      store.state.connected = false;
      store.state.ws = null;
      notifyListeners(store);

      // Auto-reconnect if there are still subscribers
      if (store.state.refCount > 0) {
        store.state.reconnectTimeout = setTimeout(() => {
          connectStore(sessionId, store);
        }, 3000);
      }
    };
  } catch (e) {
    store.state.error = e instanceof Error ? e.message : 'Failed to connect';
    notifyListeners(store);
  }
}

function disconnectStore(store: ConnectionStore) {
  if (store.state.reconnectTimeout) {
    clearTimeout(store.state.reconnectTimeout);
    store.state.reconnectTimeout = null;
  }
  if (store.state.ws) {
    store.state.ws.close();
    store.state.ws = null;
  }
  store.state.connected = false;
  notifyListeners(store);
}

// ============================================================================
// Hook Implementation
// ============================================================================

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
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const storeRef = useRef<ConnectionStore | null>(null);

  // Get or create the singleton store for this session
  if (!storeRef.current) {
    storeRef.current = getOrCreateStore(sessionId);
  }
  const store = storeRef.current;

  // Subscribe to connection state changes
  const connectionState = useSyncExternalStore(
    useCallback((onStoreChange) => {
      store.listeners.add(onStoreChange);
      return () => {
        store.listeners.delete(onStoreChange);
      };
    }, [store]),
    () => store.state,
    () => store.state
  );

  const connected = connectionState.connected;
  const error = connectionState.error;

  // Handle incoming messages
  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'event':
        setEvents(prev => {
          const next = [...prev, msg.event];
          return next.slice(-maxEvents);
        });
        break;

      case 'history':
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEvents = msg.events.filter(e => !existingIds.has(e.id));
          return [...newEvents, ...prev].slice(-maxEvents);
        });
        break;
    }
  }, [maxEvents]);

  // Register/unregister message handler
  useEffect(() => {
    store.messageHandlers.add(handleMessage);
    return () => {
      store.messageHandlers.delete(handleMessage);
    };
  }, [store, handleMessage]);

  // Connect on mount, disconnect on unmount (ref counting)
  useEffect(() => {
    if (!autoConnect) return;

    store.state.refCount++;

    // Connect if this is the first subscriber
    if (store.state.refCount === 1) {
      connectStore(sessionId, store);
    }

    return () => {
      store.state.refCount--;

      // Disconnect if no more subscribers
      if (store.state.refCount === 0) {
        disconnectStore(store);
      }
    };
  }, [sessionId, store, autoConnect]);

  // Send a message through the shared WebSocket
  const send = useCallback((message: ClientMessage) => {
    if (store.state.ws?.readyState === WebSocket.OPEN) {
      store.state.ws.send(JSON.stringify(message));
    }
  }, [store]);

  // Subscribe to a channel
  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);
    store.subscribedChannels.add(channel);
    send({ type: 'subscribe', channel });
  }, [store, send]);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);
    store.subscribedChannels.delete(channel);
    send({ type: 'unsubscribe', channel });
  }, [store, send]);

  // Clear local events
  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    connected,
    error,
    clear,
    subscribe,
    unsubscribe,
  };
}
