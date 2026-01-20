import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import { StreamManager } from '../plugins/streams/stream-manager.js';
import type { ClientMessage, ServerMessage, StreamConnection } from '../plugins/streams/types.js';
import { v4 as uuidv4 } from 'uuid';

// Parse sessionId from URL query params
function parseSessionFromUrl(url: string | undefined): string {
  if (!url) return 'default';
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get('sessionId') || 'default';
}

// Send a message to a WebSocket client
function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function createWebSocketServer(server: HTTPServer, streamManager: StreamManager) {
  const wss = new WebSocketServer({ server, path: '/ws/streams' });
  const connections = new Map<WebSocket, StreamConnection>();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const sessionId = parseSessionFromUrl(req.url);
    const connection: StreamConnection = {
      id: uuidv4(),
      sessionId,
      subscribedChannels: new Set(),
      role: 'subscriber',
    };
    connections.set(ws, connection);

    console.log(`[WebSocket] New connection: ${connection.id} for session ${sessionId}`);

    // Send initial stream list for this session
    const streams = streamManager.listStreams(sessionId);
    send(ws, { type: 'stream_list', streams });

    ws.on('message', (rawData: RawData) => {
      try {
        const data = JSON.parse(rawData.toString()) as ClientMessage;
        handleMessage(ws, connection, data, streamManager);
      } catch (err) {
        send(ws, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: err instanceof Error ? err.message : 'Invalid message format',
        });
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Connection closed: ${connection.id}`);
      handleDisconnect(ws, connection, streamManager);
      connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Error for ${connection.id}:`, err);
    });
  });

  // Forward stream manager events to relevant subscribers
  streamManager.on('stream:created', ({ channel, info }) => {
    const sessionId = info.sessionId;
    for (const [ws, conn] of connections) {
      if (conn.sessionId === sessionId) {
        send(ws, { type: 'stream_created', channel, info });
      }
    }
  });

  streamManager.on('stream:closed', ({ channel }) => {
    for (const [_ws, conn] of connections) {
      if (conn.subscribedChannels.has(channel)) {
        conn.subscribedChannels.delete(channel);
      }
    }
  });

  return wss;
}

function handleMessage(
  ws: WebSocket,
  connection: StreamConnection,
  message: ClientMessage,
  streamManager: StreamManager
): void {
  switch (message.type) {
    case 'subscribe': {
      const stream = streamManager.getStream(message.channel);
      if (!stream) {
        send(ws, { type: 'error', code: 'STREAM_NOT_FOUND', message: `Stream not found: ${message.channel}` });
        return;
      }

      // Check session access (can only subscribe to own session's streams)
      if (stream.sessionId !== connection.sessionId) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot subscribe to another session\'s stream' });
        return;
      }

      const success = streamManager.subscribe(message.channel, ws);
      if (success) {
        connection.subscribedChannels.add(message.channel);
        send(ws, { type: 'subscribed', channel: message.channel });

        // Send recent history
        const history = streamManager.getHistory(message.channel, 50);
        if (history.length > 0) {
          send(ws, { type: 'history', channel: message.channel, events: history });
        }
      }
      break;
    }

    case 'unsubscribe': {
      streamManager.unsubscribe(message.channel, ws);
      connection.subscribedChannels.delete(message.channel);
      send(ws, { type: 'unsubscribed', channel: message.channel });
      break;
    }

    case 'publish': {
      connection.role = 'both'; // Mark as publisher too
      const event = streamManager.publishEvent(
        message.channel,
        message.event.data,
        message.event.source
      );

      if (!event) {
        send(ws, { type: 'error', code: 'PUBLISH_FAILED', message: 'Event validation failed or publish error' });
      }
      break;
    }

    case 'create_stream': {
      try {
        const info = streamManager.createStream(
          message.channel,
          connection.sessionId,
          message.schema,
          message.metadata
        );
        send(ws, { type: 'stream_created', channel: message.channel, info });
      } catch (err) {
        send(ws, {
          type: 'error',
          code: 'CREATE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to create stream',
        });
      }
      break;
    }

    case 'close_stream': {
      const stream = streamManager.getStream(message.channel);
      if (stream && stream.sessionId === connection.sessionId) {
        streamManager.closeStream(message.channel);
      } else {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot close stream from another session' });
      }
      break;
    }

    case 'list_streams': {
      const sessionToList = message.sessionId || connection.sessionId;
      // Only allow listing own session's streams
      if (sessionToList !== connection.sessionId) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot list another session\'s streams' });
        return;
      }
      const streams = streamManager.listStreams(sessionToList);
      send(ws, { type: 'stream_list', streams });
      break;
    }

    case 'get_history': {
      const stream = streamManager.getStream(message.channel);
      if (!stream || stream.sessionId !== connection.sessionId) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot access stream history' });
        return;
      }
      const events = streamManager.getHistory(message.channel, message.limit);
      send(ws, { type: 'history', channel: message.channel, events });
      break;
    }
  }
}

function handleDisconnect(
  ws: WebSocket,
  connection: StreamConnection,
  streamManager: StreamManager
): void {
  // Unsubscribe from all channels
  for (const channel of connection.subscribedChannels) {
    streamManager.unsubscribe(channel, ws);
  }
  streamManager.unsubscribeAll(ws);
}
