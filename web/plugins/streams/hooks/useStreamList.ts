'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StreamInfo, UseStreamListReturn, ServerMessage } from '../types';

interface UseStreamListOptions {
  sessionId: string;
  wsConnection?: WebSocket | null;
}

export function useStreamList(options: UseStreamListOptions): UseStreamListReturn {
  const { wsConnection } = options;

  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    try {
      setLoading(true);
      const port = process.env.NEXT_PUBLIC_API_PORT || '3001';
      // Fetch ALL streams (don't filter by session) so we discover everything
      const response = await fetch(
        `http://${window.location.hostname}:${port}/api/streams`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStreams(data.streams || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch streams');
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for WebSocket updates to refresh list
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        if (msg.type === 'stream_list') {
          setStreams(msg.streams);
          setLoading(false);
        } else if (msg.type === 'stream_created') {
          setStreams(prev => [...prev, msg.info]);
        } else if (msg.type === 'stream_closed') {
          setStreams(prev => prev.filter(s => s.channel !== msg.channel));
        }
      } catch {
        // Ignore parse errors
      }
    };

    wsConnection.addEventListener('message', handleMessage);
    return () => wsConnection.removeEventListener('message', handleMessage);
  }, [wsConnection]);

  // Initial fetch
  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  return {
    streams,
    loading,
    error,
    refresh: fetchStreams,
  };
}
