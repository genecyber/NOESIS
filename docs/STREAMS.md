# Pipable Streams System

This document provides comprehensive documentation for the METAMORPH Pipable Streams system, which enables real-time data streaming from external processes, scripts, and applications into the web UI for live monitoring and visualization.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [WebSocket Protocol](#websocket-protocol)
4. [CLI Tool Reference](#cli-tool-reference)
5. [REST API](#rest-api)
6. [Configuration](#configuration)
7. [Integration Examples](#integration-examples)
8. [Event Bus Integration](#event-bus-integration)
9. [Web UI](#web-ui)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Pipable Streams system allows you to pipe data from any source (logs, build outputs, metrics, sensor data) into METAMORPH's web interface for real-time visualization. It provides a complete pipeline from external processes to the browser.

### Key Features

- **Real-time WebSocket Streaming**: Live data updates in the browser
- **CLI Integration**: `metamorph-stream` tool for piping any output
- **Schema Validation**: Optional JSON Schema validation for typed data
- **Event History**: Configurable event buffering and replay
- **Multi-Session Support**: Isolated streams per session
- **Auto-Discovery**: Streams appear automatically in the web UI
- **Channel-Based**: Flexible channel naming for organization

### Use Cases

- **Development Monitoring**: Watch build output, test results, or server logs in real-time
- **Data Visualization**: Stream metrics, sensor data, or analytics for live dashboards
- **Process Tracking**: Monitor long-running tasks or background jobs
- **Log Aggregation**: Collect logs from multiple sources in one view
- **Integration Testing**: Stream test output with structured data
- **CI/CD Pipelines**: Monitor build and deployment progress

---

## Architecture

The streams system consists of 6 layers working together:

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Processes                           │
│  (bash scripts, Python, Node.js, build tools, logs, etc.)       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ stdout/stderr
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Tool (metamorph-stream)                   │
│  Location: src/cli/stream.ts                                     │
│  - Reads stdin line-by-line                                      │
│  - Parses JSON (optional)                                        │
│  - Validates against schema (optional)                           │
│  - Connects to WebSocket                                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ WebSocket Messages (ClientMessage)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               WebSocket Server (/ws/streams)                     │
│  Location: src/server/websocket.ts                               │
│  - Connection management                                         │
│  - Session-based access control                                  │
│  - Message routing                                               │
│  - Protocol enforcement                                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ StreamManager API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  StreamManager Service                           │
│  Location: src/plugins/streams/stream-manager.ts                 │
│  - Stream lifecycle (create, publish, close)                     │
│  - Event storage and history                                     │
│  - Schema validation (ajv)                                       │
│  - Subscriber management                                         │
│  - Event broadcasting                                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│     REST API Endpoints   │    │    Backend Plugin Events     │
│  Location: src/server/   │    │  EventBus: stream:created    │
│  index.ts                │    │           stream:event       │
│  - GET /api/streams      │    │           stream:closed      │
│  - POST /api/streams     │    │           stream:validation_ │
│  - GET /api/streams/     │    │                error         │
│       :channel/history   │    └──────────────────────────────┘
└──────────────────────────┘
                │
                │ HTTP/Fetch
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web Plugin (Browser)                        │
│  Location: web/plugins/streams/                                  │
│  - StreamsPanel.tsx (sidebar panel)                              │
│  - StreamViewer.tsx (event viewer)                               │
│  - WebSocket client hooks                                        │
│  - Real-time event display                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| **CLI Tool** | `src/cli/stream.ts` | Pipe stdin to WebSocket, handle line parsing and JSON |
| **WebSocket Server** | `src/server/websocket.ts` | Handle connections, enforce protocol, route messages |
| **StreamManager** | `src/plugins/streams/stream-manager.ts` | Core service for stream lifecycle and event management |
| **REST API** | `src/server/index.ts` | HTTP endpoints for stream queries and operations |
| **Backend Events** | `src/plugins/streams/types.ts` | Event bus integration for plugins |
| **Web UI** | `web/plugins/streams/` | Browser visualization and interaction |

---

## WebSocket Protocol

The WebSocket protocol uses JSON messages for bidirectional communication between clients and the server.

### Connection

**Endpoint**: `ws://localhost:3001/ws/streams`

**Query Parameters**:
- `sessionId` (optional): Session identifier. Defaults to `'default'` if not provided.

**Example Connection**:
```javascript
const ws = new WebSocket('ws://localhost:3001/ws/streams?sessionId=user-123');
```

### Channel Naming Convention

Channels follow the pattern: `{sessionId}:{identifier}:{type}`

**Examples**:
- `user-123:proc-456:stdout` - Process stdout stream
- `user-123:monitor:cpu` - CPU monitoring stream
- `user-123:build-1:logs` - Build log stream
- `user-123:pid-67890:stream` - Generic stream from process 67890

**Rules**:
- Session ID is extracted from the first part (before first `:`)
- Must be unique within a session
- Case-sensitive
- URL-safe characters recommended

### Client Messages

Messages sent from client to server.

#### subscribe

Subscribe to a stream channel to receive events.

```typescript
{
  type: 'subscribe',
  channel: string
}
```

**Example**:
```json
{
  "type": "subscribe",
  "channel": "user-123:build:logs"
}
```

**Response**: `subscribed` message + `history` with recent events

---

#### unsubscribe

Unsubscribe from a stream channel.

```typescript
{
  type: 'unsubscribe',
  channel: string
}
```

**Example**:
```json
{
  "type": "unsubscribe",
  "channel": "user-123:build:logs"
}
```

**Response**: `unsubscribed` message

---

#### publish

Publish an event to a stream.

```typescript
{
  type: 'publish',
  channel: string,
  event: {
    data: unknown,
    source?: string
  }
}
```

**Example**:
```json
{
  "type": "publish",
  "channel": "user-123:metrics:cpu",
  "event": {
    "data": {
      "cpu": 45.2,
      "memory": 62.1,
      "timestamp": 1705847392
    },
    "source": "monitor-script"
  }
}
```

**Response**: None (silent success), or `error` if validation fails

---

#### create_stream

Create a new stream with optional schema and metadata.

```typescript
{
  type: 'create_stream',
  channel: string,
  schema?: JSONSchema7,
  metadata?: Record<string, unknown>
}
```

**Example**:
```json
{
  "type": "create_stream",
  "channel": "user-123:metrics:cpu",
  "schema": {
    "type": "object",
    "properties": {
      "cpu": { "type": "number" },
      "memory": { "type": "number" },
      "timestamp": { "type": "number" }
    },
    "required": ["cpu", "memory", "timestamp"]
  },
  "metadata": {
    "source": "monitor-v1",
    "interval": 1000
  }
}
```

**Response**: `stream_created` message

---

#### close_stream

Close a stream and clean up resources.

```typescript
{
  type: 'close_stream',
  channel: string
}
```

**Example**:
```json
{
  "type": "close_stream",
  "channel": "user-123:build:logs"
}
```

**Response**: `stream_closed` message to all subscribers

---

#### list_streams

List all streams for a session.

```typescript
{
  type: 'list_streams',
  sessionId?: string
}
```

**Example**:
```json
{
  "type": "list_streams"
}
```

**Response**: `stream_list` message

---

#### get_history

Retrieve event history for a channel.

```typescript
{
  type: 'get_history',
  channel: string,
  limit?: number
}
```

**Example**:
```json
{
  "type": "get_history",
  "channel": "user-123:build:logs",
  "limit": 50
}
```

**Response**: `history` message

---

### Server Messages

Messages sent from server to client.

#### event

A new event was published to a subscribed channel.

```typescript
{
  type: 'event',
  channel: string,
  event: {
    id: string,
    timestamp: string,  // ISO 8601
    data: unknown,
    source?: string
  }
}
```

**Example**:
```json
{
  "type": "event",
  "channel": "user-123:build:logs",
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-21T10:23:12.456Z",
    "data": "Building project...",
    "source": "webpack"
  }
}
```

---

#### stream_created

A stream was created.

```typescript
{
  type: 'stream_created',
  channel: string,
  info: {
    channel: string,
    sessionId: string,
    createdAt: string,
    eventCount: number,
    schema?: JSONSchema7,
    metadata?: Record<string, unknown>
  }
}
```

---

#### stream_closed

A stream was closed.

```typescript
{
  type: 'stream_closed',
  channel: string
}
```

---

#### stream_list

List of streams for a session.

```typescript
{
  type: 'stream_list',
  streams: StreamInfo[]
}
```

---

#### history

Historical events for a channel.

```typescript
{
  type: 'history',
  channel: string,
  events: StreamEvent[]
}
```

---

#### subscribed

Confirmation of subscription.

```typescript
{
  type: 'subscribed',
  channel: string
}
```

---

#### unsubscribed

Confirmation of unsubscription.

```typescript
{
  type: 'unsubscribed',
  channel: string
}
```

---

#### error

An error occurred.

```typescript
{
  type: 'error',
  code: string,
  message: string
}
```

**Error Codes**:
- `INVALID_MESSAGE` - Malformed WebSocket message
- `STREAM_NOT_FOUND` - Attempted to subscribe to non-existent stream
- `ACCESS_DENIED` - Attempted to access another session's stream
- `PUBLISH_FAILED` - Event validation failed
- `CREATE_FAILED` - Stream creation failed (e.g., session limit reached)

---

## CLI Tool Reference

The `metamorph-stream` command-line tool pipes stdin to a WebSocket stream for real-time viewing in the web UI.

### Installation

The CLI tool is installed as part of the METAMORPH package:

```bash
npm install -g @metamorph/cli
```

Or use directly from the project:

```bash
node src/cli/stream.ts [options]
```

### Usage

```bash
metamorph-stream -s <session-id> [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--session <id>` | `-s` | Session ID to stream to (required) | - |
| `--channel <name>` | `-c` | Channel name | `{session}:pid-{PID}:stream` |
| `--json` | - | Parse each line as JSON | `false` |
| `--schema <file>` | - | JSON Schema file for validation | - |
| `--host <host>` | - | Server host | `localhost` |
| `--port <port>` | - | Server port | `3001` |
| `--source <name>` | - | Source identifier | `pid-{PID}` |
| `--version` | `-V` | Show version | - |
| `--help` | `-h` | Show help | - |

### Examples

#### Pipe Command Output

Stream the output of a command:

```bash
echo "Hello, World!" | metamorph-stream -s user-123
```

#### Monitor Log File

Tail a log file and stream updates:

```bash
tail -f /var/log/app.log | metamorph-stream -s user-123 -c logs
```

#### Stream Build Output

Monitor a build process:

```bash
npm run build | metamorph-stream -s dev-session -c build:output
```

#### Stream JSON Metrics

Stream structured JSON data:

```bash
my-metrics-script | metamorph-stream -s monitoring -c metrics --json
```

#### With Schema Validation

Create a schema file (`cpu-schema.json`):

```json
{
  "type": "object",
  "properties": {
    "cpu": { "type": "number", "minimum": 0, "maximum": 100 },
    "memory": { "type": "number", "minimum": 0, "maximum": 100 },
    "timestamp": { "type": "number" }
  },
  "required": ["cpu", "memory", "timestamp"]
}
```

Stream with validation:

```bash
./monitor.sh | metamorph-stream -s sys -c cpu --json --schema cpu-schema.json
```

#### Custom Channel and Source

```bash
./deploy.sh | metamorph-stream \
  -s production \
  -c deployment:api-v2 \
  --source "jenkins-build-456"
```

### Bash Integration

```bash
#!/bin/bash
# build-and-stream.sh

SESSION="dev-session"
CHANNEL="build:frontend"

# Start streaming
npm run build 2>&1 | metamorph-stream -s $SESSION -c $CHANNEL &
STREAM_PID=$!

# Wait for build
wait $STREAM_PID

echo "Build completed and streamed to METAMORPH"
```

### Python Integration

```python
#!/usr/bin/env python3
# stream_metrics.py

import json
import time
import subprocess
import psutil

SESSION = "monitoring"
CHANNEL = "metrics:system"

# Start metamorph-stream process
proc = subprocess.Popen(
    ['metamorph-stream', '-s', SESSION, '-c', CHANNEL, '--json'],
    stdin=subprocess.PIPE,
    text=True,
    bufsize=1
)

try:
    while True:
        # Collect metrics
        metrics = {
            'cpu': psutil.cpu_percent(interval=1),
            'memory': psutil.virtual_memory().percent,
            'disk': psutil.disk_usage('/').percent,
            'timestamp': int(time.time())
        }

        # Send to stream
        proc.stdin.write(json.dumps(metrics) + '\n')
        proc.stdin.flush()

        time.sleep(1)

except KeyboardInterrupt:
    proc.terminate()
    proc.wait()
```

### Node.js Integration

```javascript
#!/usr/bin/env node
// stream-logs.js

const { spawn } = require('child_process');

const SESSION = 'dev-session';
const CHANNEL = 'app:logs';

// Start metamorph-stream
const streamer = spawn('metamorph-stream', [
  '-s', SESSION,
  '-c', CHANNEL,
  '--json'
]);

// Simulate log generation
const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
let counter = 0;

const logInterval = setInterval(() => {
  const log = {
    level: logLevels[Math.floor(Math.random() * logLevels.length)],
    message: `Log entry ${++counter}`,
    timestamp: Date.now()
  };

  streamer.stdin.write(JSON.stringify(log) + '\n');
}, 1000);

// Cleanup
process.on('SIGINT', () => {
  clearInterval(logInterval);
  streamer.stdin.end();
  streamer.kill();
  process.exit();
});
```

### Output and Status

The CLI tool writes status messages to stderr and forwards stdin to the stream:

```
[metamorph-stream] Connected to ws://localhost:3001/ws/streams?sessionId=user-123
[metamorph-stream] Channel: user-123:pid-12345:stream
[metamorph-stream] Stream created successfully
[metamorph-stream] stdin closed. Closing stream...
[metamorph-stream] Connection closed. Sent 142 events, 0 errors.
```

### Error Handling

The CLI tool handles common errors gracefully:

- **Connection Failed**: Exits with code 1 and error message
- **Invalid JSON** (with `--json` flag): Logs error, sends line as string
- **Schema Validation Failed**: Logs error, skips event
- **Stream Creation Failed**: Exits with code 1
- **SIGINT/SIGTERM**: Gracefully closes stream and connection

---

## REST API

The REST API provides HTTP endpoints for stream operations, useful for non-WebSocket clients.

### Base URL

```
http://localhost:3001/api/streams
```

### Authentication

All endpoints require the `x-api-key` header if `METAMORPH_API_KEY` is set.

```
x-api-key: your-api-key-here
```

### Endpoints

#### GET /api/streams

List all streams for a session.

**Query Parameters**:
- `sessionId` (optional): Filter by session ID

**Response**:
```json
{
  "streams": [
    {
      "channel": "user-123:build:logs",
      "sessionId": "user-123",
      "createdAt": "2024-01-21T10:00:00.000Z",
      "lastEventAt": "2024-01-21T10:23:12.456Z",
      "eventCount": 142
    }
  ]
}
```

---

#### GET /api/streams/:channel

Get information about a specific stream.

**Response**:
```json
{
  "stream": {
    "channel": "user-123:build:logs",
    "sessionId": "user-123",
    "createdAt": "2024-01-21T10:00:00.000Z",
    "lastEventAt": "2024-01-21T10:23:12.456Z",
    "eventCount": 142,
    "schema": { ... },
    "metadata": {
      "source": "webpack",
      "version": "5.0.0"
    }
  }
}
```

---

#### POST /api/streams

Create a new stream.

**Request Body**:
```json
{
  "channel": "user-123:metrics:cpu",
  "sessionId": "user-123",
  "schema": {
    "type": "object",
    "properties": {
      "cpu": { "type": "number" }
    }
  },
  "metadata": {
    "interval": 1000
  }
}
```

**Response**:
```json
{
  "stream": {
    "channel": "user-123:metrics:cpu",
    "sessionId": "user-123",
    "createdAt": "2024-01-21T10:25:00.000Z",
    "eventCount": 0
  }
}
```

---

#### POST /api/streams/:channel/event

Publish an event to a stream via HTTP.

**Request Body**:
```json
{
  "data": {
    "cpu": 45.2,
    "memory": 62.1
  },
  "source": "monitor-script"
}
```

**Response**:
```json
{
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-21T10:26:00.000Z",
    "data": {
      "cpu": 45.2,
      "memory": 62.1
    },
    "source": "monitor-script"
  }
}
```

---

#### GET /api/streams/:channel/history

Get event history for a stream.

**Query Parameters**:
- `limit` (optional): Number of events to retrieve (default: 100)

**Response**:
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-21T10:26:00.000Z",
      "data": { "cpu": 45.2 },
      "source": "monitor"
    }
  ]
}
```

---

#### GET /api/streams/:channel/schema

Get the JSON schema for a stream.

**Response**:
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "cpu": { "type": "number" }
    }
  }
}
```

---

#### POST /api/streams/:channel/schema

Set or update the JSON schema for a stream.

**Request Body**:
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "cpu": { "type": "number" },
      "memory": { "type": "number" }
    }
  }
}
```

**Response**:
```json
{
  "success": true
}
```

---

#### DELETE /api/streams/:channel

Close and delete a stream.

**Response**:
```json
{
  "success": true
}
```

---

## Configuration

The StreamManager can be configured when initialized.

### StreamManagerConfig

```typescript
interface StreamManagerConfig {
  maxHistoryPerStream?: number;  // Default: 1000
  maxStreamsPerSession?: number; // Default: 50
  eventTTLMs?: number;           // Default: 3600000 (1 hour)
}
```

### Default Configuration

```typescript
{
  maxHistoryPerStream: 1000,      // Keep last 1000 events per stream
  maxStreamsPerSession: 50,       // Max 50 streams per session
  eventTTLMs: 60 * 60 * 1000     // Events expire after 1 hour
}
```

### Custom Configuration

```typescript
import { StreamManager } from './plugins/streams/stream-manager.js';

const streamManager = new StreamManager({
  maxHistoryPerStream: 500,       // Reduce memory usage
  maxStreamsPerSession: 100,      // Allow more streams
  eventTTLMs: 30 * 60 * 1000     // Events expire after 30 minutes
});
```

### Configuration Guidelines

**maxHistoryPerStream**:
- Higher values = more memory but better history
- Recommended: 500-2000 for most use cases
- Set lower (100-500) for high-frequency streams

**maxStreamsPerSession**:
- Prevents resource exhaustion
- Recommended: 50-100 for typical usage
- Increase for multi-stream monitoring scenarios

**eventTTLMs**:
- Automatic cleanup of old events
- Recommended: 1-4 hours for development
- Set lower for production (15-30 minutes)

---

## Integration Examples

### Example 1: Piping Log Files

Monitor application logs in real-time:

```bash
#!/bin/bash
# monitor-logs.sh

SESSION="production"

# Stream application logs
tail -f /var/log/app/application.log | \
  metamorph-stream -s $SESSION -c app:logs &

# Stream error logs
tail -f /var/log/app/error.log | \
  metamorph-stream -s $SESSION -c app:errors &

# Wait for interrupt
wait
```

View in browser: Navigate to streams panel, select session `production`, watch `app:logs` and `app:errors` channels.

---

### Example 2: Piping Build Output

Stream build progress with JSON metadata:

```bash
#!/bin/bash
# build-with-stream.sh

SESSION="dev-$(whoami)"
CHANNEL="build:frontend"

# Wrapper to add JSON structure
npm run build 2>&1 | while IFS= read -r line; do
  echo "{\"message\":\"$line\",\"timestamp\":$(date +%s)}"
done | metamorph-stream -s $SESSION -c $CHANNEL --json
```

---

### Example 3: Streaming JSON Metrics

Python script that streams system metrics:

```python
#!/usr/bin/env python3
# system-metrics.py

import json
import time
import subprocess
import psutil
import sys

def main():
    SESSION = sys.argv[1] if len(sys.argv) > 1 else 'monitoring'
    CHANNEL = 'metrics:system'

    # Schema for validation
    schema = {
        'type': 'object',
        'properties': {
            'cpu_percent': {'type': 'number'},
            'memory_percent': {'type': 'number'},
            'disk_percent': {'type': 'number'},
            'network_sent_mb': {'type': 'number'},
            'network_recv_mb': {'type': 'number'},
            'timestamp': {'type': 'number'}
        },
        'required': ['cpu_percent', 'memory_percent', 'timestamp']
    }

    # Save schema to temp file
    with open('/tmp/metrics-schema.json', 'w') as f:
        json.dump(schema, f)

    # Start streaming
    proc = subprocess.Popen(
        ['metamorph-stream', '-s', SESSION, '-c', CHANNEL,
         '--json', '--schema', '/tmp/metrics-schema.json'],
        stdin=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    net_io_start = psutil.net_io_counters()

    try:
        while True:
            net_io = psutil.net_io_counters()

            metrics = {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'network_sent_mb': (net_io.bytes_sent - net_io_start.bytes_sent) / 1024 / 1024,
                'network_recv_mb': (net_io.bytes_recv - net_io_start.bytes_recv) / 1024 / 1024,
                'timestamp': int(time.time() * 1000)
            }

            proc.stdin.write(json.dumps(metrics) + '\n')
            proc.stdin.flush()

            time.sleep(1)

    except KeyboardInterrupt:
        proc.stdin.close()
        proc.wait()

if __name__ == '__main__':
    main()
```

Usage:
```bash
./system-metrics.py my-session
```

---

### Example 4: Node.js Script Integration

Stream test results as they complete:

```javascript
#!/usr/bin/env node
// test-runner.js

const { spawn } = require('child_process');

const SESSION = process.env.SESSION_ID || 'testing';
const CHANNEL = 'tests:results';

// Start metamorph-stream
const streamer = spawn('metamorph-stream', [
  '-s', SESSION,
  '-c', CHANNEL,
  '--json'
]);

streamer.on('error', (err) => {
  console.error('Failed to start streamer:', err);
  process.exit(1);
});

// Run tests and capture output
const tests = [
  { name: 'Unit Tests', command: ['npm', 'run', 'test:unit'] },
  { name: 'Integration Tests', command: ['npm', 'run', 'test:integration'] },
  { name: 'E2E Tests', command: ['npm', 'run', 'test:e2e'] }
];

async function runTests() {
  for (const test of tests) {
    const startTime = Date.now();

    // Use spawn instead of exec for safer execution
    const testProcess = spawn(test.command[0], test.command.slice(1));
    let output = '';
    let error = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    await new Promise((resolve) => {
      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;

        const result = {
          test: test.name,
          status: code === 0 ? 'passed' : 'failed',
          duration,
          timestamp: Date.now()
        };

        if (code !== 0) {
          result.error = error;
        }

        streamer.stdin.write(JSON.stringify(result) + '\n');
        resolve();
      });
    });
  }

  // Close stream
  streamer.stdin.end();
  streamer.kill();
}

runTests();
```

---

### Example 5: Docker Container Logs

Stream logs from a Docker container:

```bash
#!/bin/bash
# docker-stream.sh

CONTAINER_NAME=$1
SESSION=${2:-docker-monitoring}
CHANNEL="container:$CONTAINER_NAME"

if [ -z "$CONTAINER_NAME" ]; then
  echo "Usage: $0 <container-name> [session-id]"
  exit 1
fi

docker logs -f "$CONTAINER_NAME" 2>&1 | \
  metamorph-stream -s "$SESSION" -c "$CHANNEL" --source "docker:$CONTAINER_NAME"
```

Usage:
```bash
./docker-stream.sh my-app-container dev-session
```

---

### Example 6: Git Hook Integration

Stream deployment progress from a git post-receive hook:

```bash
#!/bin/bash
# .git/hooks/post-receive

SESSION="deployments"
CHANNEL="deploy:production"

# Read the pushed ref
while read oldrev newrev refname; do
  # Only deploy on master
  if [[ $refname = refs/heads/master ]]; then
    {
      echo "Deployment started: $newrev"

      # Deploy steps
      echo "Pulling latest changes..."
      git --work-tree=/var/www/app pull

      echo "Installing dependencies..."
      cd /var/www/app && npm install

      echo "Building application..."
      npm run build

      echo "Restarting service..."
      systemctl restart app.service

      echo "Deployment complete: $newrev"

    } 2>&1 | metamorph-stream -s $SESSION -c $CHANNEL --source "git-hook"
  fi
done
```

---

## Event Bus Integration

Backend plugins can listen to stream events via the event bus.

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stream:created` | `{ channel, sessionId, info }` | A new stream was created |
| `stream:event` | `{ channel, event }` | An event was published to a stream |
| `stream:closed` | `{ channel, reason? }` | A stream was closed |
| `stream:validation_error` | `{ channel, errors }` | Event failed schema validation |

### Event Types

```typescript
// Stream created
interface StreamCreatedEvent {
  channel: string;
  sessionId: string;
  info: StreamInfo;
}

// Stream event published
interface StreamEventPublished {
  channel: string;
  event: StreamEvent;
}

// Stream closed
interface StreamClosedEvent {
  channel: string;
  reason?: string;
}

// Validation error
interface ValidationErrorEvent {
  channel: string;
  errors: string[];
}
```

### Subscribing to Events

```typescript
import { streamManager } from './plugins/streams/stream-manager.js';

// Listen for new streams
streamManager.on('stream:created', ({ channel, sessionId, info }) => {
  console.log(`New stream created: ${channel} for session ${sessionId}`);
  console.log(`Schema:`, info.schema);
  console.log(`Metadata:`, info.metadata);
});

// Listen for events on all streams
streamManager.on('stream:event', ({ channel, event }) => {
  console.log(`Event on ${channel}:`, event.data);

  // Example: Log high CPU usage
  if (channel.includes('cpu') && typeof event.data === 'object') {
    const data = event.data as { cpu?: number };
    if (data.cpu && data.cpu > 80) {
      console.warn(`High CPU detected: ${data.cpu}%`);
    }
  }
});

// Listen for stream closures
streamManager.on('stream:closed', ({ channel, reason }) => {
  console.log(`Stream closed: ${channel}`, reason);
});

// Listen for validation errors
streamManager.on('stream:validation_error', ({ channel, errors }) => {
  console.error(`Validation failed on ${channel}:`, errors);
});
```

### Plugin Example

Create a plugin that monitors streams and sends alerts:

```typescript
// plugins/stream-monitor/index.ts

import { streamManager } from '../streams/stream-manager.js';
import { pluginEventBus } from '../event-bus.js';

interface AlertConfig {
  channel: string;
  condition: (data: unknown) => boolean;
  message: string;
}

class StreamMonitorPlugin {
  private alerts: AlertConfig[] = [];

  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    // Monitor all stream events
    streamManager.on('stream:event', ({ channel, event }) => {
      this.checkAlerts(channel, event.data);
    });
  }

  addAlert(config: AlertConfig) {
    this.alerts.push(config);
  }

  private checkAlerts(channel: string, data: unknown) {
    for (const alert of this.alerts) {
      if (channel.match(alert.channel) && alert.condition(data)) {
        this.triggerAlert(channel, alert.message, data);
      }
    }
  }

  private triggerAlert(channel: string, message: string, data: unknown) {
    console.warn(`ALERT [${channel}]: ${message}`, data);

    // Emit to event bus for other plugins
    pluginEventBus.emit('alert:triggered', {
      channel,
      message,
      data,
      timestamp: Date.now()
    });
  }
}

// Create and export plugin instance
export const streamMonitor = new StreamMonitorPlugin();

// Example usage: Monitor CPU
streamMonitor.addAlert({
  channel: '.*:cpu',
  condition: (data: any) => data.cpu > 90,
  message: 'CPU usage critical'
});

// Example usage: Monitor errors
streamMonitor.addAlert({
  channel: '.*:logs',
  condition: (data: any) =>
    typeof data === 'string' && data.toLowerCase().includes('error'),
  message: 'Error detected in logs'
});
```

---

## Web UI

The web interface provides a sidebar panel for viewing and interacting with streams.

### StreamsPanel Component

**Location**: `web/plugins/streams/StreamsPanel.tsx`

**Features**:
- Lists all active streams for the current session
- Shows connection status (connected/disconnected)
- Displays event counts and last event timestamps
- Click to select a stream for detailed viewing
- Auto-refreshes stream list every 30 seconds
- Settings panel for customization

**Panel State**:
```typescript
interface StreamsPanelState {
  selectedStream: string | null;    // Currently selected stream
  viewMode: 'list' | 'viewer';      // View mode
  autoScroll: boolean;              // Auto-scroll to new events
  showTimestamps: boolean;          // Show event timestamps
  maxEvents: number;                // Max events in memory (100-2000)
  filterText: string;               // Filter events by content
}
```

### StreamViewer Component

**Location**: `web/plugins/streams/StreamViewer.tsx`

Displays events from a selected stream in real-time.

**Features**:
- Real-time event display
- Auto-scroll to latest events
- Syntax highlighting for JSON
- Timestamp display (toggle)
- Event filtering
- Clear history button
- Export events

### Hooks

#### useStreamSubscription

Subscribe to stream events via WebSocket.

```typescript
const {
  events,        // Array of received events
  connected,     // WebSocket connection status
  error,         // Error message if any
  clear,         // Clear events from memory
  subscribe,     // Subscribe to a channel
  unsubscribe    // Unsubscribe from a channel
} = useStreamSubscription({
  sessionId: 'user-123',
  autoConnect: true
});
```

#### useStreamList

Fetch and manage the list of streams.

```typescript
const {
  streams,    // Array of StreamInfo
  loading,    // Loading state
  error,      // Error message if any
  refresh     // Manually refresh the list
} = useStreamList({
  sessionId: 'user-123'
});
```

### Usage in UI

1. **Open Streams Panel**: Click the Streams icon in the sidebar
2. **View Active Streams**: See all streams for your session
3. **Select a Stream**: Click on a stream to view its events
4. **Monitor Events**: Watch events appear in real-time
5. **Configure**: Open settings to adjust auto-scroll, timestamps, etc.

---

## Best Practices

### Channel Naming

1. **Use Descriptive Names**: `build:frontend` instead of `stream1`
2. **Include Context**: `prod:api:access-logs` vs `logs`
3. **Consistent Format**: Stick to `{context}:{type}:{detail}`
4. **Avoid Special Characters**: Use alphanumeric, hyphens, colons only

### Schema Design

1. **Define Schemas**: Always use schemas for structured data
2. **Required Fields**: Mark essential fields as required
3. **Validation**: Use JSON Schema validation features (min, max, pattern)
4. **Versioning**: Include version in metadata when schemas evolve

Example:
```json
{
  "type": "object",
  "properties": {
    "level": {
      "type": "string",
      "enum": ["info", "warn", "error", "debug"]
    },
    "message": { "type": "string" },
    "timestamp": { "type": "number" },
    "metadata": { "type": "object" }
  },
  "required": ["level", "message", "timestamp"]
}
```

### Performance

1. **Limit History**: Keep `maxHistoryPerStream` reasonable (500-1000)
2. **Filter Events**: Use event filtering in the UI to reduce render load
3. **Batch Updates**: For high-frequency streams, consider batching
4. **Clean Up**: Close streams when no longer needed
5. **Session Limits**: Don't exceed `maxStreamsPerSession`

### Error Handling

1. **Validate Early**: Use `--schema` flag in CLI for validation
2. **Handle Disconnects**: Implement reconnection logic in custom clients
3. **Monitor Errors**: Subscribe to `stream:validation_error` events
4. **Graceful Degradation**: Fall back to string data if JSON parsing fails

### Security

1. **Session Isolation**: Streams are isolated by session ID
2. **Authentication**: Use API key authentication for production
3. **Input Validation**: Always validate event data
4. **Sanitize Output**: Be careful when displaying user data in UI
5. **Avoid Command Injection**: Never pass unsanitized data to shell commands

---

## Troubleshooting

### WebSocket Connection Fails

**Symptom**: CLI tool reports connection error

**Causes**:
- Server not running
- Wrong host/port
- Firewall blocking WebSocket

**Solutions**:
```bash
# Check server is running
curl http://localhost:3001/health

# Test WebSocket endpoint
wscat -c ws://localhost:3001/ws/streams

# Verify port
lsof -i :3001

# Check firewall
sudo ufw status
```

---

### Events Not Appearing in UI

**Symptom**: CLI tool shows events sent, but UI doesn't update

**Causes**:
- Session ID mismatch
- Not subscribed to the channel
- WebSocket disconnected in browser

**Solutions**:
1. Check session IDs match between CLI and browser
2. Verify WebSocket connection status in browser console
3. Refresh the streams panel
4. Check browser console for errors

---

### Schema Validation Failing

**Symptom**: Events rejected with validation errors

**Causes**:
- Schema file malformed
- Data doesn't match schema
- Wrong data type

**Solutions**:
```bash
# Validate schema file
npx ajv validate -s schema.json -d data.json

# Test with simple data first
echo '{"test": true}' | metamorph-stream -s test -c test --json

# Check CLI output for validation errors
# Fix schema or data format
```

---

### High Memory Usage

**Symptom**: Server memory grows over time

**Causes**:
- Too many streams
- `maxHistoryPerStream` too high
- Events not expiring

**Solutions**:
1. Reduce `maxHistoryPerStream` in configuration
2. Lower `eventTTLMs` for faster cleanup
3. Close unused streams
4. Implement manual cleanup:

```typescript
// Manually trigger cleanup
streamManager.pruneExpired();

// Set up periodic cleanup
setInterval(() => {
  streamManager.pruneExpired();
}, 60000); // Every minute
```

---

### Stream Not Closing

**Symptom**: Stream remains active after CLI tool exits

**Causes**:
- CLI tool killed abruptly (SIGKILL)
- Close message not sent
- Network interruption

**Solutions**:
```bash
# Close via REST API
curl -X DELETE http://localhost:3001/api/streams/session:channel \
  -H "x-api-key: your-key"

# Or via WebSocket (in browser console)
ws.send(JSON.stringify({
  type: 'close_stream',
  channel: 'session:channel'
}));
```

---

### JSON Parsing Errors

**Symptom**: CLI logs "Invalid JSON" for some lines

**Causes**:
- Output contains non-JSON lines
- Malformed JSON
- Mixed JSON and plain text

**Solutions**:
1. Don't use `--json` flag for mixed output
2. Filter output before piping:
```bash
# Only pipe JSON lines
my-script | grep '^{' | metamorph-stream -s test -c test --json
```
3. Use a wrapper to structure the output:
```bash
my-script | jq -R -c '{message: .}' | metamorph-stream -s test -c test --json
```

---

### Rate Limiting / Too Many Streams

**Symptom**: "Session has reached max streams limit" error

**Causes**:
- Creating too many streams without closing them
- `maxStreamsPerSession` limit reached

**Solutions**:
1. Increase limit in configuration (if appropriate)
2. Close unused streams
3. Reuse channels for similar data
4. List and clean up:

```bash
# List streams
curl http://localhost:3001/api/streams?sessionId=your-session

# Close old streams
curl -X DELETE http://localhost:3001/api/streams/channel-name
```

---

## Advanced Topics

### Custom WebSocket Client

If you need more control than the CLI tool provides, create a custom client:

```typescript
import WebSocket from 'ws';

const SESSION_ID = 'custom-client';
const CHANNEL = 'custom:stream';

const ws = new WebSocket(`ws://localhost:3001/ws/streams?sessionId=${SESSION_ID}`);

ws.on('open', () => {
  console.log('Connected');

  // Create stream
  ws.send(JSON.stringify({
    type: 'create_stream',
    channel: CHANNEL,
    metadata: { client: 'custom-v1' }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'stream_created') {
    console.log('Stream created, starting to publish...');

    // Publish events
    setInterval(() => {
      ws.send(JSON.stringify({
        type: 'publish',
        channel: CHANNEL,
        event: {
          data: { value: Math.random(), timestamp: Date.now() },
          source: 'custom-client'
        }
      }));
    }, 1000);
  }
});

ws.on('close', () => {
  console.log('Disconnected');
});
```

### Multiple Stream Subscriptions

Subscribe to multiple streams and aggregate data:

```typescript
const channels = ['metrics:cpu', 'metrics:memory', 'metrics:disk'];

ws.on('open', () => {
  // Subscribe to all channels
  channels.forEach(channel => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `${SESSION_ID}:${channel}`
    }));
  });
});

// Aggregate events
const metrics: Record<string, any> = {};

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'event') {
    const metric = msg.channel.split(':').pop();
    metrics[metric] = msg.event.data;

    console.log('Current metrics:', metrics);
  }
});
```

---

## API Reference

See the following files for complete type definitions:

- **Protocol Types**: `src/plugins/streams/types.ts`
- **StreamManager API**: `src/plugins/streams/stream-manager.ts`
- **WebSocket Server**: `src/server/websocket.ts`
- **Client Types**: `web/plugins/streams/types.ts`

---

## Future Enhancements

Planned features for future releases:

- **Stream Replay**: Replay historical events from a timestamp
- **Compression**: Gzip compression for large event payloads
- **Binary Data**: Support for binary event data (images, files)
- **Stream Aggregation**: Server-side event aggregation and downsampling
- **Persistence**: Optional database persistence for long-term storage
- **Filtering**: Server-side event filtering by criteria
- **Transforms**: Server-side event transformation pipelines
- **Authentication**: Per-stream authentication and authorization
- **Metrics**: Built-in metrics and monitoring for streams

---

*METAMORPH Pipable Streams Documentation v1.0.0*
