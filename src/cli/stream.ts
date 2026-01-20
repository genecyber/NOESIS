#!/usr/bin/env node
/**
 * metamorph-stream CLI
 *
 * Pipes stdin to a WebSocket stream for real-time viewing in the web UI.
 *
 * Usage:
 *   echo "Hello" | metamorph-stream -s session-123
 *   tail -f /var/log/app.log | metamorph-stream -s session-123 -c logs
 *   my-script | metamorph-stream -s session-123 --json
 */

import { program } from 'commander';
import WebSocket from 'ws';
import { existsSync } from 'fs';
import { createInterface } from 'readline';
import Ajv from 'ajv';
import type { JSONSchema7 } from 'json-schema';

interface StreamOptions {
  session: string;
  channel?: string;
  json?: boolean;
  schema?: string;
  host?: string;
  port?: string;
  source?: string;
}

// Parse command line arguments
program
  .name('metamorph-stream')
  .description('Pipe stdin to a WebSocket stream')
  .version('0.1.0')
  .requiredOption('-s, --session <id>', 'Session ID to stream to')
  .option('-c, --channel <name>', 'Channel name (defaults to PID-based)')
  .option('--json', 'Parse each line as JSON')
  .option('--schema <file>', 'JSON Schema file for validation')
  .option('--host <host>', 'Server host', 'localhost')
  .option('--port <port>', 'Server port', '3001')
  .option('--source <name>', 'Source identifier (defaults to PID)')
  .parse();

const options = program.opts<StreamOptions>();

// Generate default channel name from session and PID
const channelName = options.channel || `${options.session}:pid-${process.pid}:stream`;
const sourceName = options.source || `pid-${process.pid}`;

// Load schema if provided
let schema: JSONSchema7 | undefined;
let ajv: Ajv | undefined;

if (options.schema) {
  if (!existsSync(options.schema)) {
    console.error(`Schema file not found: ${options.schema}`);
    process.exit(1);
  }
  try {
    const schemaContent = await import(options.schema, { assert: { type: 'json' } });
    schema = schemaContent.default as JSONSchema7;
    ajv = new Ajv();
  } catch (err) {
    console.error(`Failed to load schema: ${err}`);
    process.exit(1);
  }
}

// Connect to WebSocket server
const wsUrl = `ws://${options.host}:${options.port}/ws/streams?sessionId=${encodeURIComponent(options.session)}`;
const ws = new WebSocket(wsUrl);

let connected = false;
let lineCount = 0;
let errorCount = 0;

ws.on('open', () => {
  connected = true;
  console.error(`[metamorph-stream] Connected to ${wsUrl}`);
  console.error(`[metamorph-stream] Channel: ${channelName}`);

  // Create the stream
  ws.send(JSON.stringify({
    type: 'create_stream',
    channel: channelName,
    schema,
    metadata: {
      source: sourceName,
      json: options.json || false,
      createdAt: new Date().toISOString(),
    },
  }));

  // Start reading stdin
  startReading();
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'error') {
      console.error(`[metamorph-stream] Error: ${msg.message}`);
      if (msg.code === 'CREATE_FAILED') {
        process.exit(1);
      }
    } else if (msg.type === 'stream_created') {
      console.error(`[metamorph-stream] Stream created successfully`);
    }
  } catch {
    // Ignore parse errors
  }
});

ws.on('error', (err) => {
  console.error(`[metamorph-stream] WebSocket error: ${err.message}`);
  process.exit(1);
});

ws.on('close', () => {
  console.error(`[metamorph-stream] Connection closed. Sent ${lineCount} events, ${errorCount} errors.`);
  process.exit(0);
});

function startReading(): void {
  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!connected) return;

    let eventData: unknown = line;

    // Parse as JSON if requested
    if (options.json) {
      try {
        eventData = JSON.parse(line);
      } catch {
        console.error(`[metamorph-stream] Invalid JSON on line ${lineCount + 1}, sending as string`);
        errorCount++;
      }
    }

    // Validate against schema if provided
    if (schema && ajv) {
      const validate = ajv.compile(schema);
      if (!validate(eventData)) {
        console.error(`[metamorph-stream] Schema validation failed on line ${lineCount + 1}`);
        errorCount++;
        return; // Skip invalid events
      }
    }

    // Publish the event
    ws.send(JSON.stringify({
      type: 'publish',
      channel: channelName,
      event: {
        data: eventData,
        source: sourceName,
      },
    }));

    lineCount++;
  });

  rl.on('close', () => {
    console.error(`[metamorph-stream] stdin closed. Closing stream...`);

    // Close the stream
    ws.send(JSON.stringify({
      type: 'close_stream',
      channel: channelName,
    }));

    // Give time for message to send, then close
    setTimeout(() => {
      ws.close();
    }, 500);
  });
}

// Handle interrupts gracefully
process.on('SIGINT', () => {
  console.error(`\n[metamorph-stream] Interrupted. Closing...`);
  if (connected) {
    ws.send(JSON.stringify({
      type: 'close_stream',
      channel: channelName,
    }));
  }
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', () => {
  if (connected) {
    ws.send(JSON.stringify({
      type: 'close_stream',
      channel: channelName,
    }));
  }
  setTimeout(() => process.exit(0), 500);
});
