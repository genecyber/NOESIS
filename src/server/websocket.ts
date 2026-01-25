import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import { StreamManager } from '../plugins/streams/stream-manager.js';
import type { ClientMessage, ServerMessage, StreamConnection } from '../plugins/streams/types.js';
import { v4 as uuidv4 } from 'uuid';
import { validateEmblemToken } from './middleware/emblem-auth.js';

// Environment configuration
const EMBLEM_DEV_MODE = process.env.EMBLEM_DEV_MODE === 'true';
const DEV_VAULT_ID = 'dev-vault';

// Extended connection interface with vault context
interface VaultStreamConnection extends StreamConnection {
  vaultId: string;
}

// Parse sessionId and token from URL query params
function parseUrlParams(url: string | undefined): { sessionId: string; token: string | null; vaultId: string | null } {
  if (!url) return { sessionId: 'default', token: null, vaultId: null };
  const parsed = new URL(url, 'http://localhost');
  return {
    sessionId: parsed.searchParams.get('sessionId') || 'default',
    token: parsed.searchParams.get('token'),
    vaultId: parsed.searchParams.get('vaultId') // For dev mode
  };
}

// Send a message to a WebSocket client
function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function createWebSocketServer(server: HTTPServer, streamManager: StreamManager) {
  const wss = new WebSocketServer({ server, path: '/ws/streams' });
  const connections = new Map<WebSocket, VaultStreamConnection>();

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const { sessionId, token, vaultId: devVaultId } = parseUrlParams(req.url);

    // Authenticate the WebSocket connection
    let vaultId: string;

    if (EMBLEM_DEV_MODE) {
      // Dev mode - use provided vaultId or default
      vaultId = devVaultId || DEV_VAULT_ID;
      console.log(`[WebSocket] Dev mode: authenticated as vault ${vaultId}`);
    } else {
      // Production mode - validate token
      if (!token) {
        console.warn('[WebSocket] Connection rejected: no auth token provided');
        send(ws, { type: 'error', code: 'AUTH_REQUIRED', message: 'Authentication required' });
        ws.close(4001, 'Authentication required');
        return;
      }

      const user = await validateEmblemToken(token);
      if (!user) {
        console.warn('[WebSocket] Connection rejected: invalid auth token');
        send(ws, { type: 'error', code: 'AUTH_FAILED', message: 'Authentication failed' });
        ws.close(4001, 'Authentication failed');
        return;
      }

      vaultId = user.vaultId;
      console.log(`[WebSocket] Authenticated vault: ${vaultId}`);
    }

    // Create vault-scoped session ID
    const effectiveSessionId = sessionId.includes(':') ? sessionId : `${vaultId}:${sessionId}`;

    const connection: VaultStreamConnection = {
      id: uuidv4(),
      sessionId: effectiveSessionId,
      subscribedChannels: new Set(),
      role: 'subscriber',
      vaultId,
    };
    connections.set(ws, connection);

    console.log(`[WebSocket] New connection: ${connection.id} for vault ${vaultId}, session ${effectiveSessionId}`);

    // Send initial stream list (filtered to vault's streams)
    const allStreams = streamManager.listStreams();
    const streams = allStreams.filter(s => s.sessionId.startsWith(`${vaultId}:`));
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

  // Forward stream manager events to ALL connections (global discovery)
  streamManager.on('stream:created', ({ channel, info }) => {
    for (const [ws] of connections) {
      send(ws, { type: 'stream_created', channel, info });
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
  connection: VaultStreamConnection,
  message: ClientMessage,
  streamManager: StreamManager
): void {
  const { vaultId } = connection;

  switch (message.type) {
    case 'subscribe': {
      const stream = streamManager.getStream(message.channel);
      if (!stream) {
        send(ws, { type: 'error', code: 'STREAM_NOT_FOUND', message: 'Stream not found' });
        return;
      }

      // Verify stream belongs to this vault
      if (!stream.sessionId.startsWith(`${vaultId}:`)) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot subscribe to stream from another vault' });
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
      // Verify stream belongs to this vault before publishing
      const stream = streamManager.getStream(message.channel);
      if (!stream || !stream.sessionId.startsWith(`${vaultId}:`)) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot publish to stream from another vault' });
        return;
      }

      connection.role = 'both'; // Mark as publisher too
      const event = streamManager.publishEvent(
        message.channel,
        message.event.data,
        message.event.source
      );

      if (!event) {
        send(ws, { type: 'error', code: 'PUBLISH_FAILED', message: 'Failed to publish event' });
      }
      break;
    }

    case 'create_stream': {
      try {
        const info = streamManager.createStream(
          message.channel,
          connection.sessionId, // Already vault-scoped
          message.schema,
          message.metadata
        );
        send(ws, { type: 'stream_created', channel: message.channel, info });
      } catch (err) {
        send(ws, {
          type: 'error',
          code: 'CREATE_FAILED',
          message: 'Failed to create stream',
        });
      }
      break;
    }

    case 'close_stream': {
      const stream = streamManager.getStream(message.channel);
      // Verify stream belongs to this vault
      if (stream && stream.sessionId.startsWith(`${vaultId}:`)) {
        streamManager.closeStream(message.channel);
      } else {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot close stream from another vault' });
      }
      break;
    }

    case 'list_streams': {
      // Return only streams belonging to this vault
      const allStreams = streamManager.listStreams();
      const streams = allStreams.filter(s => s.sessionId.startsWith(`${vaultId}:`));
      send(ws, { type: 'stream_list', streams });
      break;
    }

    case 'get_history': {
      const stream = streamManager.getStream(message.channel);
      if (!stream) {
        send(ws, { type: 'error', code: 'STREAM_NOT_FOUND', message: 'Stream not found' });
        return;
      }
      // Verify stream belongs to this vault
      if (!stream.sessionId.startsWith(`${vaultId}:`)) {
        send(ws, { type: 'error', code: 'ACCESS_DENIED', message: 'Cannot access stream from another vault' });
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
