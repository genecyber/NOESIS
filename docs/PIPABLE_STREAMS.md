I'll help you investigate the current working directory and design a system for piping background processes to a web client through websockets. Let me enter plan mode to explore your system and develop a comprehensive approach.Now I'm in plan mode. Let me start by investigating your current working directory and understanding the existing system architecture, then design a solution for piping background processes to web clients through websockets.Now let me design the background process piping system by launching a Plan agent to create a comprehensive implementation strategy.Now let me write my comprehensive plan to the plan file, incorporating the exploration results and design recommendations.Perfect! I've thoroughly investigated your system and created a comprehensive plan for implementing a background process piping system. Let me check my current stance and recall any relevant memories before finalizing this plan.I've successfully completed my investigation and planning for your background process piping system. Here's what I discovered and designed:

Investigation Summary
Your METAMORPH system is a sophisticated transformation-maximizing AI built on the Claude Agent SDK with excellent architecture for extending with background process capabilities:

Technology Stack: Node.js + TypeScript backend, Next.js frontend, Express server, SQLite persistence
Real-time Communication: Already uses Server-Sent Events (SSE) for streaming, not WebSockets
Session Architecture: Isolated session management with MetamorphAgent instances
Streaming Infrastructure: Robust callback system for real-time updates
Hook System: Pre/post-turn hooks perfect for background process integration
My Plan
I've created a comprehensive implementation plan that leverages your existing architecture:

Core Design:
ProcessManager for background process coordination
PID-based Channel Router using format: {sessionId}:{pid}:{streamType}
Multiple Input Methods: Named pipes for bash, REST endpoints for Python, internal streams for Node.js
SSE Integration: Extend existing streaming with new event types (process_start, process_output, process_error, process_end)
Key Features:
Session-scoped process management with automatic cleanup
Real-time streaming to web clients through existing SSE infrastructure
Support for echo "data" | metamorph-pipe --session=user-123
Python client library and Node.js internal API
Process monitoring, resource limits, and security sandboxing
The plan integrates seamlessly with your existing /app/src/server/index.ts, session management, and web client SSE consumption patterns. It builds on your architecture's strengths rather than requiring major refactoring.Let me exit plan mode properly to request approval for implementing this background process piping system:I notice there seems to be an issue with the ExitPlanMode function. Let me store this important memory about the plan I've created and then try a different approach.Since I'm having technical difficulties with the ExitPlanMode function, let me provide you with a summary of my comprehensive investigation and plan:

✅ Plan Complete: Background Process Piping System
I've thoroughly investigated your METAMORPH system and created a detailed implementation plan that perfectly fits your existing architecture. The plan is saved at /root/.claude/plans/woolly-hugging-milner.md.

Key Discoveries:
Your system already has excellent foundations: SSE streaming, session management, hook system
No major refactoring needed - the design extends existing patterns
Your current tech stack (Node.js + TypeScript, Express, SSE) is ideal for this feature
Proposed Solution:
PID-based channels: {sessionId}:{pid}:{streamType} format as you suggested
Multiple input methods: Named pipes for bash (| metamorph-pipe), REST APIs for Python, internal streaming for Node.js
SSE integration: Extends your existing streaming with new event types
Session-scoped processes: Automatic cleanup and isolation
The plan includes detailed implementation phases, file structure, API endpoints, usage examples, and verification testing. It builds on your existing /app/src/server/index.ts, session management, and web client patterns.

Would you like me to proceed with implementing this system, or do you have questions about any aspect of the plan?

give me the content of /root/.claude/plans/woolly-hugging-milner.md in a markdown codeblock
Tools Used
1
Read
file_path: /root/.claude/plans/woolly-hugging-milner.md
# Background Process Piping System Implementation Plan

## Overview

Design and implement a system to pipe background processes into the METAMORPH server and stream results to web clients through the existing SSE infrastructure. This system will use PID-based channel names and support input from bash pipes, Python scripts, and Node.js applications.

## Architecture Integration

The METAMORPH system already has excellent foundations for this feature:
- **SSE Streaming**: Existing Server-Sent Events infrastructure for real-time communication
- **Session Management**: Isolated session contexts with SessionManager
- **Hook System**: Pre/post-turn hooks for extensibility
- **Event Bus**: Plugin event bus for inter-component communication
- **MetamorphAgent**: Streaming callbacks system for real-time updates

## Implementation Strategy

### 1. Core Process Management System

**Location**: `/app/src/background/`

#### ProcessManager (`process-manager.ts`)
- Central coordinator for all background processes
- Process lifecycle management (spawn, monitor, cleanup)
- Resource limits and health monitoring
- Integration with SessionManager for session-scoped processes

#### ChannelRouter (`channel-router.ts`)
- PID-based channel naming: `{sessionId}:{pid}:{streamType}`
- Route process outputs to appropriate destinations
- Handle multiple concurrent processes per session
- Support both session-scoped and global processes

#### StreamMultiplexer (`stream-multiplexer.ts`)
- Combine multiple process streams into single SSE channel
- Handle different stream types (stdout, stderr, custom)
- Buffer management and rate limiting
- Transform process output for SSE compatibility

### 2. Input Interface Layer

**Location**: `/app/src/background/inputs/`

#### BashPipeHandler (`bash-pipe.ts`)
- Create named pipes at `/tmp/metamorph-{sessionId}-{pid}`
- Shell wrapper function for easy piping: `| metamorph-pipe`
- Automatic pipe cleanup on process termination
- Support for both session-scoped and default channels

#### PythonAPIHandler (`python-api.ts`)
- REST endpoints for writing process data
- Python client library for seamless integration
- Support for continuous streaming connections
- Process registration and output routing

#### NodeJSStreamHandler (`nodejs-stream.ts`)
- Direct integration with Express server
- EventEmitter-based internal API
- Stream.Writable interface for Node.js applications
- Memory-efficient streaming with backpressure handling

### 3. SSE Integration

**Location**: `/app/src/background/integration/`

#### SSEBridge (`sse-bridge.ts`)
- Extend existing SSE streaming with new event types:
  - `process_start`: Process initialization notification
  - `process_output`: Stream output from background processes
  - `process_error`: Process errors and exit notifications
  - `process_end`: Process termination
- Maintain backward compatibility with existing `/api/chat/stream`
- Multiplex background streams with chat streams

#### SessionBridge (`session-bridge.ts`)
- Integrate with existing SessionManager
- Process scoping and session lifecycle management
- Automatic cleanup when sessions end
- Process inheritance of session context

### 4. API Endpoints

**Extend**: `/app/src/server/index.ts`

```typescript
// Process Management
POST   /api/process/start           // Start background process
POST   /api/process/{pid}/write     // Write data to process stdin
GET    /api/process/{pid}/stream    // SSE stream for process output
DELETE /api/process/{pid}           // Terminate process
GET    /api/processes              // List active processes
POST   /api/process/{pid}/pipe      // Create named pipe endpoint

// Channel Management
GET    /api/channels               // List active channels
GET    /api/channels/{channelId}   // Get channel info and stream
DELETE /api/channels/{channelId}   // Close channel
5. Client-Side Integration
Extend: /app/web/lib/api.ts

ProcessAPI Client
interface ProcessStreamCallbacks {
  onProcessStart?: (event: ProcessStartEvent) => void;
  onProcessOutput?: (event: ProcessOutputEvent) => void;
  onProcessError?: (event: ProcessErrorEvent) => void;
  onProcessEnd?: (event: ProcessEndEvent) => void;
}

// Extend existing chatStream to include process events
chatStream(sessionId, message, emotionContext, {
  ...existingCallbacks,
  ...processCallbacks
});
React Components
ProcessManager Component: List and control background processes
ProcessOutput Component: Display real-time process output
ProcessControls Component: Start/stop/restart processes
Extend existing ActiveToolsBar to show background processes
6. Usage Examples
Bash Piping
# Simple output piping
echo "Processing data..." | metamorph-pipe --session=user-123

# Long-running process
python long_analysis.py | metamorph-pipe --session=user-123 --stream=analysis

# Multiple streams
./data_processor 2>&1 | metamorph-pipe --session=user-123 --pid=worker-1
Python Integration
import metamorph_client

# Connect to session
client = metamorph_client.Client(session_id="user-123")

# Start background process
proc = client.start_process(["python", "worker.py"])

# Write to process
proc.write("input data\n")

# Stream output automatically goes to web client
for line in proc.stdout:
    print(f"Process output: {line}")
Node.js Integration
const { ProcessManager } = require('./metamorph-background');

const manager = new ProcessManager('user-123');

// Start process
const proc = manager.spawn('python', ['analyzer.py']);

// Pipe to web clients
proc.stdout.pipe(manager.createWebStream());
7. Implementation Order
Phase 1: Core Infrastructure
Implement ProcessManager with basic process spawning
Create ChannelRouter with PID-based naming
Build StreamMultiplexer for output combination
Add basic SSE integration for process events
Phase 2: Input Interfaces
Implement BashPipeHandler with named pipes
Create PythonAPIHandler with REST endpoints
Build NodeJSStreamHandler with internal streaming
Add shell wrapper utilities
Phase 3: Web Integration
Extend SSE client handling for process events
Add ProcessAPI to web client
Create React components for process management
Integrate with existing chat streaming
Phase 4: Advanced Features
Add process health monitoring and restart
Implement resource limits and quotas
Add process output filtering and search
Create process templates and saved configurations
8. Critical Files to Modify
Backend Files
/app/src/server/index.ts - Add new API endpoints
/app/src/runtime/runtime.ts - Integrate ProcessManager
/app/src/agent/index.ts - Extend StreamCallbacks for process events
/app/src/runtime/session/session-manager.ts - Add process lifecycle hooks
Frontend Files
/app/web/lib/api.ts - Extend API client with process methods
/app/web/components/Chat.tsx - Add process event handling
/app/web/components/ActiveToolsBar.tsx - Show background processes
New Files Structure
/app/src/background/
├── process-manager.ts          # Core process coordination
├── channel-router.ts           # PID-based routing
├── stream-multiplexer.ts       # Output combination
├── inputs/
│   ├── bash-pipe.ts           # Named pipe handling
│   ├── python-api.ts          # Python REST endpoints
│   └── nodejs-stream.ts       # Node.js streaming
└── integration/
    ├── sse-bridge.ts          # SSE event integration
    └── session-bridge.ts      # Session manager integration
9. Testing Strategy
Unit Tests
ProcessManager process lifecycle
ChannelRouter routing logic
StreamMultiplexer output handling
Individual input handlers
Integration Tests
End-to-end bash piping workflow
Python API integration
SSE streaming with multiple processes
Session cleanup and process termination
Performance Tests
Multiple concurrent processes
Large output streaming
Memory usage under load
Connection handling at scale
10. Security Considerations
Process Isolation
Sandbox process execution environments
Limit accessible file systems and networks
Resource quotas (CPU, memory, disk I/O)
Process timeout enforcement
Access Control
Session-based process access
Input validation and sanitization
Rate limiting for process creation
Audit logging for process management
11. Verification Plan
End-to-End Testing
Bash Integration: Verify echo "test" | metamorph-pipe appears in web client
Python Integration: Confirm Python scripts can write to web streams
Node.js Integration: Test internal process spawning and streaming
Session Isolation: Verify processes are properly scoped to sessions
Real-time Updates: Confirm process output appears immediately in web UI
Resource Cleanup: Test process termination and resource cleanup
Multiple Processes: Verify concurrent process handling
Error Handling: Test process failures and error reporting
This implementation will seamlessly extend METAMORPH's existing real-time capabilities to support background process integration while maintaining the system's architectural integrity and performance characteristics.

