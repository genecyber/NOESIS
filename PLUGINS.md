# METAMORPH Plugin System

This document describes the METAMORPH plugin architecture, SDK, and how to build custom plugins that extend the platform's capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Import Patterns](#import-patterns)
4. [SDK Subpaths](#sdk-subpaths)
5. [Architecture](#architecture)
6. [Quick Start](#quick-start)
7. [Plugin Manifest](#plugin-manifest)
8. [Platform Capabilities](#platform-capabilities)
9. [Creating a Web Panel Plugin](#creating-a-web-panel-plugin)
10. [Creating a CLI Plugin](#creating-a-cli-plugin)
11. [Lifecycle Hooks](#lifecycle-hooks)
12. [Event Handlers](#event-handlers)
13. [Built-in Plugins](#built-in-plugins)
14. [API Reference](#api-reference)

---

## Overview

METAMORPH's plugin system allows developers to extend the platform with custom functionality across both web and CLI environments:

- **Web Panel Plugins**: Add new panels to the sidebar (like the Emotion Detection panel)
- **CLI Plugins**: Add operators for stance transformation and conversational enhancements
- **Platform Capabilities**: Access webcam, TTS, STT, AI vision, and storage
- **Event Integration**: React to emotions, stance changes, messages, and more
- **Isolated Storage**: Each plugin gets its own storage namespace
- **Cross-Platform SDK**: Publish plugins as npm packages with `@metamorph/plugin-sdk`

### Key Principles

1. **Capability-Based Access**: Plugins declare required capabilities upfront
2. **Permission Model**: Plugins request specific permissions for data access
3. **Lifecycle Management**: Clean activation/deactivation with automatic cleanup
4. **Type Safety**: Full TypeScript support with comprehensive types
5. **Platform Abstraction**: Write once, run on web or CLI with platform-specific capabilities

---

## Installation

Install the SDK as an npm package:

```bash
npm install @metamorph/plugin-sdk
```

```bash
yarn add @metamorph/plugin-sdk
```

```bash
pnpm add @metamorph/plugin-sdk
```

The SDK is published as a standalone package that can be used in any JavaScript/TypeScript project.

---

## Import Patterns

### ESM (ES Modules)

```typescript
// Web plugins
import { defineWebPlugin } from '@metamorph/plugin-sdk/web';

// CLI plugins
import { defineCliPlugin } from '@metamorph/plugin-sdk/cli';

// React hooks
import { useAutoPlugin, usePluginRegistry } from '@metamorph/plugin-sdk/react';

// Core types (platform-agnostic)
import { PluginManifest, PluginEventBus } from '@metamorph/plugin-sdk/core';
```

### CommonJS

```javascript
// CLI plugins with CommonJS
const { defineCliPlugin, registerCliPlugin } = require('@metamorph/plugin-sdk/cli');

// Core types
const { PluginManifest } = require('@metamorph/plugin-sdk/core');
```

### CDN (UMD)

```html
<script src="https://unpkg.com/@metamorph/plugin-sdk/dist/umd/metamorph-sdk.min.js"></script>
<script>
  const { defineWebPlugin, webPluginRegistry } = MetamorphSDK;

  const myPlugin = defineWebPlugin({
    manifest: {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'A browser plugin loaded from CDN',
      capabilities: ['storage'],
      permissions: ['stance:read'],
    },
  });

  webPluginRegistry.register(myPlugin);
</script>
```

---

## SDK Subpaths

The SDK provides organized exports through subpath imports:

| Subpath | Description | Use Case |
|---------|-------------|----------|
| `@metamorph/plugin-sdk` | Core types and utilities (platform-agnostic) | Shared types, base interfaces |
| `@metamorph/plugin-sdk/web` | Web/React plugin utilities | Browser-based plugins with panels |
| `@metamorph/plugin-sdk/cli` | CLI/Node.js plugin utilities | Command-line plugins with operators |
| `@metamorph/plugin-sdk/react` | React hooks | `usePluginRegistry`, `useAutoPlugin`, `usePluginCapabilities` |
| `@metamorph/plugin-sdk/core` | Core event bus and base types | Advanced plugin development |

**Example:**

```typescript
// Import web utilities
import { defineWebPlugin, webPluginRegistry } from '@metamorph/plugin-sdk/web';

// Import CLI utilities
import { defineCliPlugin, cliPluginRegistry } from '@metamorph/plugin-sdk/cli';

// Import React hooks
import { useAutoPlugin, usePluginRegistry } from '@metamorph/plugin-sdk/react';

// Import core types
import type { PluginManifest, PluginCapability } from '@metamorph/plugin-sdk/core';
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        METAMORPH Platform                            │
│                     (Web UI + CLI + SDK)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Plugin Registry                              ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           ││
│  │  │   Web    │ │   CLI    │ │  Web     │ │   CLI    │           ││
│  │  │ Plugin A │ │ Plugin B │ │ Plugin C │ │ Plugin D │           ││
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           ││
│  └───────┼────────────┼────────────┼────────────┼─────────────────┘│
│          │            │            │            │                   │
│  ┌───────┴────────────┴────────────┴────────────┴─────────────────┐│
│  │              Platform Capabilities (Abstracted)                  ││
│  │                                                                   ││
│  │  WEB:     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          ││
│  │           │ Webcam │ │  TTS   │ │  STT   │ │ Vision │          ││
│  │           │ Stream │ │ Speak  │ │ Listen │ │  API   │          ││
│  │           └────────┘ └────────┘ └────────┘ └────────┘          ││
│  │                                                                   ││
│  │  CLI:     ┌────────────┐ ┌────────────┐ ┌────────────┐         ││
│  │           │ Operators  │ │   Hooks    │ │  Storage   │         ││
│  │           │ (Stance)   │ │ (Events)   │ │   (File)   │         ││
│  │           └────────────┘ └────────────┘ └────────────┘         ││
│  │                                                                   ││
│  │  SHARED:  ┌────────┐                                             ││
│  │           │Storage │                                             ││
│  │           │  KV    │                                             ││
│  │           └────────┘                                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                        Event Bus                                 ││
│  │  emotion:detected │ stance:changed │ message:sent │              ││
│  │  operator:executed │ hook:triggered                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| SDK Package | `@metamorph/plugin-sdk` | Published npm package with all SDK features |
| Web Plugin SDK | `@metamorph/plugin-sdk/web` | Browser-specific plugins with panels |
| CLI Plugin SDK | `@metamorph/plugin-sdk/cli` | Node.js plugins with operators and hooks |
| React Hooks | `@metamorph/plugin-sdk/react` | React integration utilities |
| Core Types | `@metamorph/plugin-sdk/core` | Platform-agnostic base types |
| Web Registry | `web/lib/plugins/registry.ts` | Web plugin registration and lifecycle |
| CLI Registry | `cli/lib/plugins/registry.ts` | CLI plugin registration and lifecycle |
| Web Capabilities | `web/lib/plugins/capabilities.ts` | Browser API implementations |
| CLI Capabilities | `cli/lib/plugins/capabilities.ts` | Node.js capability implementations |

---

## Quick Start

### Web Plugin Quick Start

**1. Install the SDK**

```bash
npm install @metamorph/plugin-sdk
```

**2. Create a Web Plugin**

```tsx
// my-web-plugin.tsx
import { defineWebPlugin } from '@metamorph/plugin-sdk/web';
import { Sparkles } from 'lucide-react';
import type { PanelProps } from '@metamorph/plugin-sdk/web';

// Define the panel component
function MyPanel({ sessionId, stance, capabilities }: PanelProps) {
  const lastActivated = capabilities.storage.get<number>('lastActivated');

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display font-bold gradient-text">My Panel</h3>
      <p className="text-sm">
        Current frame: {stance?.frame || 'unknown'}
      </p>
      {lastActivated && (
        <p className="text-xs">
          Last activated: {new Date(lastActivated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// Define the plugin
export const myWebPlugin = defineWebPlugin({
  manifest: {
    id: 'my-web-plugin',
    name: 'My Awesome Web Plugin',
    version: '1.0.0',
    description: 'Adds a custom panel to the sidebar',
    capabilities: ['storage'],
    permissions: ['stance:read'],
  },

  panel: {
    id: 'my-panel',
    label: 'My Panel',
    icon: Sparkles,
    component: MyPanel,
    order: 10,
  },

  onActivate: async (ctx) => {
    ctx.logger.info('Plugin activated!');
    ctx.capabilities.storage.set('lastActivated', Date.now());
  },

  onDeactivate: () => {
    console.log('Plugin deactivated');
  },
});
```

**3. Register in Your App**

```tsx
// app/page.tsx
import { useAutoPlugin } from '@metamorph/plugin-sdk/react';
import { myWebPlugin } from './my-web-plugin';

export default function App() {
  // Auto-register and enable the plugin
  useAutoPlugin(myWebPlugin);

  return <YourApp />;
}
```

### CLI Plugin Quick Start

**1. Install the SDK**

```bash
npm install @metamorph/plugin-sdk
```

**2. Create a CLI Plugin**

```typescript
// my-cli-plugin.ts
import { defineCliPlugin, registerCliPlugin } from '@metamorph/plugin-sdk/cli';

const poetryPlugin = defineCliPlugin({
  manifest: {
    id: 'poetry-mode',
    name: 'Poetry Mode',
    version: '1.0.0',
    description: 'Enables poetic responses with heightened creativity',
    capabilities: ['storage'],
    permissions: ['stance:read', 'stance:write'],
  },

  // Define operators that transform the stance
  operators: [
    {
      name: 'poeticize',
      description: 'Transform response into poetic form',
      category: 'meta',
      triggers: ['creative_request', 'artistic_mode'],
      intensity: { min: 30, max: 100, default: 60 },
      execute: (stance, context) => {
        // Calculate intensity-based novelty boost
        const intensityFactor = context.intensity / 100;
        const noveltyBoost = Math.floor(20 * intensityFactor);

        return {
          stanceModifications: {
            frame: 'poetic',
            values: {
              ...stance.values,
              novelty: Math.min(100, stance.values.novelty + noveltyBoost),
              exploration: Math.min(100, stance.values.exploration + 15),
            },
          },
          systemPromptAddition: 'Respond with heightened poetic sensibility and metaphorical language.',
          reasoning: `Applied poetic transformation (intensity: ${context.intensity})`,
        };
      },
    },
  ],

  // Lifecycle hooks
  onActivate: async (ctx) => {
    ctx.logger.info('Poetry mode activated');
    ctx.capabilities.storage.set('activatedAt', Date.now());
  },

  onDeactivate: () => {
    console.log('Poetry mode deactivated');
  },

  // Event hooks
  hooks: {
    beforeResponse: async (context) => {
      // Optional: modify context before response generation
      console.log('Preparing poetic response...');
    },
    afterResponse: async (context) => {
      // Optional: process response after generation
      console.log('Poetic response generated');
    },
  },
});

// Register the plugin
registerCliPlugin(poetryPlugin);

export default poetryPlugin;
```

**3. Use in CLI**

```bash
# The plugin is automatically loaded when registered
# Operators are triggered based on their trigger conditions
metamorph chat --mode empathy
```

---

## Plugin Manifest

Every plugin requires a manifest that declares its metadata and requirements:

```typescript
interface WebPluginManifest {
  // Required
  id: string;              // Unique identifier (kebab-case)
  name: string;            // Human-readable name
  version: string;         // Semver version
  description: string;     // Short description
  capabilities: PluginCapability[];  // Required platform features
  permissions: PluginPermission[];   // Required data access

  // Optional
  author?: string;         // Author name/organization
  license?: string;        // License type
  repository?: string;     // Source repository URL
  metamorphVersion?: string; // Minimum METAMORPH version
}
```

### Capabilities

Capabilities are platform features your plugin needs. The available capabilities differ between web and CLI environments.

#### Web Capabilities

| Capability | Description | Implementation |
|------------|-------------|----------------|
| `webcam` | Camera access for video/image capture | `MediaDevices.getUserMedia()` |
| `microphone` | Audio input for speech recognition | `MediaDevices.getUserMedia()` |
| `speaker` | Audio output for text-to-speech | `SpeechSynthesis` API |
| `vision` | AI image analysis via Claude Vision | Backend API |
| `storage` | Plugin-scoped localStorage | `localStorage` |
| `notifications` | Browser notifications | `Notification` API |
| `fullscreen` | Fullscreen mode | `Fullscreen` API |

#### CLI Capabilities

| Capability | Description | Implementation |
|------------|-------------|----------------|
| `storage` | Plugin-scoped file storage | File system (`.metamorph/plugins/{id}/`) |
| `filesystem:read` | Read files from disk | Node.js `fs` module |
| `filesystem:write` | Write files to disk | Node.js `fs` module |
| `network:fetch` | Make HTTP requests | `fetch` API |

#### Shared Capabilities

Both web and CLI plugins have access to:
- `storage` - Platform-specific key-value storage (localStorage on web, file-based in CLI)

### Permissions

Permissions control data access across both platforms:

| Permission | Description | Platform |
|------------|-------------|----------|
| `stance:read` | Read current stance | Both |
| `stance:write` | Modify stance values | Both |
| `config:read` | Read mode configuration | Both |
| `config:write` | Modify configuration | Both |
| `session:read` | Access session data | Both |
| `memory:read` | Search memories | Both |
| `memory:write` | Create memories | Both |
| `emotion:read` | Access emotion context | Both |
| `emotion:write` | Update emotion context | Both |
| `conversation:read` | Read message history | Both |
| `filesystem:read` | Read files (requires capability) | CLI only |
| `filesystem:write` | Write files (requires capability) | CLI only |
| `network:fetch` | Make HTTP requests (requires capability) | CLI only |

---

## Platform Capabilities

This section details the capabilities available to plugins. Web plugins have access to browser APIs, while CLI plugins have access to Node.js capabilities.

### Web Capabilities

#### Webcam Capability

```typescript
interface WebcamCapability {
  // Start camera stream
  start(constraints?: MediaStreamConstraints): Promise<MediaStream>;

  // Stop camera
  stop(): void;

  // Capture current frame as data URL
  captureFrame(format?: 'jpeg' | 'png', quality?: number): Promise<string | null>;

  // List available cameras
  getDevices(): Promise<MediaDeviceInfo[]>;

  // Current state
  stream: MediaStream | null;
  isActive: boolean;
}
```

**Usage Example:**

```tsx
async function startCamera(capabilities: PlatformCapabilities) {
  await capabilities.webcam.start({
    video: { width: 640, height: 480, facingMode: 'user' }
  });

  // Capture a frame
  const frame = await capabilities.webcam.captureFrame('jpeg', 0.8);

  // Cleanup
  capabilities.webcam.stop();
}
```

#### TTS Capability (Text-to-Speech)

```typescript
interface TTSCapability {
  // Speak text (returns when complete)
  speak(text: string, options?: TTSOptions): Promise<void>;

  // Controls
  stop(): void;
  pause(): void;
  resume(): void;

  // Get available voices
  getVoices(): SpeechSynthesisVoice[];

  // State
  isSpeaking: boolean;
}

interface TTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;    // 0.1 to 10
  pitch?: number;   // 0 to 2
  volume?: number;  // 0 to 1
  lang?: string;    // e.g., 'en-US'
}
```

**Usage Example:**

```tsx
async function speakGreeting(capabilities: PlatformCapabilities) {
  const voices = capabilities.tts.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith('en'));

  await capabilities.tts.speak('Hello! How can I help you today?', {
    voice: englishVoice,
    rate: 1.0,
    pitch: 1.0,
  });
}
```

#### STT Capability (Speech-to-Text)

```typescript
interface STTCapability {
  // Start listening
  start(options?: STTOptions): void;

  // Stop listening
  stop(): void;

  // State
  isListening: boolean;

  // Event callbacks
  onResult: ((transcript: string, isFinal: boolean) => void) | null;
  onError: ((error: Error) => void) | null;
}

interface STTOptions {
  continuous?: boolean;      // Keep listening after pause
  interimResults?: boolean;  // Get partial transcripts
  lang?: string;             // Recognition language
}
```

**Usage Example:**

```tsx
function setupVoiceInput(capabilities: PlatformCapabilities) {
  capabilities.stt.onResult = (transcript, isFinal) => {
    if (isFinal) {
      console.log('Final transcript:', transcript);
      // Process the command
    }
  };

  capabilities.stt.onError = (error) => {
    console.error('Speech recognition error:', error);
  };

  capabilities.stt.start({
    continuous: true,
    interimResults: true
  });
}
```

#### Vision Capability (AI Image Analysis)

```typescript
interface VisionCapability {
  // Analyze image for emotions (Claude Vision)
  analyzeEmotion(imageDataUrl: string): Promise<EmotionContext>;

  // General image analysis with custom prompt
  analyzeImage(imageDataUrl: string, prompt: string): Promise<string>;

  // Rate limit status
  canAnalyze: boolean;           // Whether analysis is available
  cooldownRemaining: number;     // Seconds until next analysis
}
```

**Usage Example:**

```tsx
async function analyzeUserEmotion(capabilities: PlatformCapabilities) {
  if (!capabilities.vision.canAnalyze) {
    console.log(`Rate limited. Wait ${capabilities.vision.cooldownRemaining}s`);
    return;
  }

  const frame = await capabilities.webcam.captureFrame();
  if (!frame) return;

  const emotion = await capabilities.vision.analyzeEmotion(frame);
  console.log('Detected emotion:', emotion.currentEmotion);
  console.log('Valence:', emotion.valence);
  console.log('Arousal:', emotion.arousal);
}
```

**Rate Limiting:**
- Vision API has a 60-second cooldown between requests
- Check `canAnalyze` before calling
- Use browser-side detection (face-api.js) for real-time needs

#### Storage Capability (Web)

```typescript
interface StorageCapability {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  keys(): string[];
  clear(): void;
}
```

**Usage Example:**

```tsx
function saveSettings(capabilities: PlatformCapabilities) {
  capabilities.storage.set('settings', {
    detectionInterval: 1000,
    minConfidence: 0.5,
  });

  // Later...
  const settings = capabilities.storage.get<Settings>('settings');
}
```

Storage is namespaced per plugin: `metamorph:plugin:{pluginId}:{key}`

### CLI Capabilities

CLI plugins have access to Node.js-specific capabilities for file operations and network requests.

#### Storage Capability (CLI)

```typescript
interface StorageCapability {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
```

**Usage Example:**

```typescript
async function savePluginData(ctx: PluginContext) {
  // Storage is file-based in CLI
  await ctx.capabilities.storage.set('settings', {
    autoActivate: true,
    verbosity: 'standard',
  });

  // Later...
  const settings = await ctx.capabilities.storage.get<Settings>('settings');
}
```

Storage location: `.metamorph/plugins/{pluginId}/storage.json`

#### Filesystem Capability (CLI)

```typescript
interface FilesystemCapability {
  // Read file contents
  readFile(path: string, encoding?: string): Promise<string | Buffer>;

  // Write file contents
  writeFile(path: string, content: string | Buffer): Promise<void>;

  // Check if file exists
  exists(path: string): Promise<boolean>;

  // List directory contents
  readDir(path: string): Promise<string[]>;

  // Create directory
  mkdir(path: string, recursive?: boolean): Promise<void>;
}
```

**Usage Example:**

```typescript
async function processMarkdownFiles(ctx: PluginContext) {
  const files = await ctx.capabilities.filesystem.readDir('./docs');
  const mdFiles = files.filter(f => f.endsWith('.md'));

  for (const file of mdFiles) {
    const content = await ctx.capabilities.filesystem.readFile(`./docs/${file}`, 'utf-8');
    // Process content...
  }
}
```

**Note:** Requires `filesystem:read` and/or `filesystem:write` permissions.

#### Network Capability (CLI)

```typescript
interface NetworkCapability {
  // Make HTTP request
  fetch(url: string, options?: RequestInit): Promise<Response>;
}
```

**Usage Example:**

```typescript
async function fetchExternalData(ctx: PluginContext) {
  const response = await ctx.capabilities.network.fetch(
    'https://api.example.com/data',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    }
  );

  const data = await response.json();
  return data;
}
```

**Note:** Requires `network:fetch` permission.

---

## Creating a Web Panel Plugin

Web panel plugins add a new tab to the METAMORPH web UI sidebar. They provide a React component that renders in the sidebar and has access to platform capabilities.

### Panel Definition

```typescript
interface PanelDefinition {
  id: string;                              // Unique panel ID
  label: string;                           // Tab label
  icon: ComponentType<{ className?: string }>;  // Tab icon
  component: ComponentType<PanelProps>;    // Panel component
  order?: number;                          // Tab order (lower = first)
  defaultEnabled?: boolean;                // Auto-enable on registration
}
```

### Panel Props

Your panel component receives these props:

```typescript
interface PanelProps {
  sessionId?: string;                    // Current session
  stance: Stance | null;                 // Current stance
  config: ModeConfig | null;             // Current config
  emotionContext: EmotionContext | null; // Current emotion
  capabilities: PlatformCapabilities;    // Platform capabilities

  // Update callbacks
  onStanceUpdate?: (stance: Stance) => void;
  onConfigUpdate?: (config: Partial<ModeConfig>) => void;
  onEmotionUpdate?: (emotion: EmotionContext) => void;
}
```

### Complete Panel Example

```tsx
// plugins/timer/TimerPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { PanelProps } from '@/lib/plugins/types';
import { Button } from '@/components/ui';

export default function TimerPanel({ capabilities }: PanelProps) {
  const [seconds, setSeconds] = useState(
    capabilities.storage.get<number>('seconds') ?? 0
  );
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds(s => {
        const newValue = s + 1;
        capabilities.storage.set('seconds', newValue);
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, capabilities.storage]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display font-bold gradient-text">Timer</h3>

      <div className="text-4xl font-mono text-center text-emblem-secondary">
        {formatTime(seconds)}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setIsRunning(!isRunning)}>
          {isRunning ? 'Pause' : 'Start'}
        </Button>
        <Button variant="outline" onClick={() => {
          setSeconds(0);
          capabilities.storage.set('seconds', 0);
        }}>
          Reset
        </Button>
      </div>
    </div>
  );
}
```

---

## Creating a CLI Plugin

CLI plugins extend the command-line interface with operators, hooks, and custom settings. Operators transform the conversational stance based on context, while hooks allow you to intercept and modify the request/response flow.

### CLI Plugin Structure

```typescript
interface CliPlugin {
  manifest: PluginManifest;          // Plugin metadata
  operators?: Operator[];            // Stance transformation operators
  hooks?: CliPluginHooks;            // Lifecycle event hooks
  settings?: PluginSetting[];        // User-configurable settings
  onActivate?: (ctx: PluginContext) => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
}
```

### Operators

Operators are the core of CLI plugins. They analyze the current stance and context to apply transformations that affect how METAMORPH responds.

```typescript
interface Operator {
  name: string;                      // Unique operator name
  description: string;               // What this operator does
  category: OperatorCategory;        // 'stance' | 'meta' | 'tone'
  triggers: string[];                // When to activate (keywords/conditions)
  intensity: IntensityConfig;        // Min/max/default intensity levels
  execute: (stance: Stance, context: OperatorContext) => OperatorResult;
}

interface OperatorResult {
  stanceModifications?: Partial<Stance>;     // Changes to stance values
  systemPromptAddition?: string;             // Additional system instructions
  userPromptTransformation?: string;         // Modified user input
  metadata?: Record<string, unknown>;        // Extra data for hooks
  reasoning?: string;                        // Why this transformation was applied
}
```

### Complete CLI Plugin Example

```typescript
import { defineCliPlugin, registerCliPlugin } from '@metamorph/plugin-sdk/cli';

const debugModePlugin = defineCliPlugin({
  manifest: {
    id: 'debug-mode',
    name: 'Debug Mode',
    version: '1.0.0',
    description: 'Adds detailed reasoning and self-reflection to responses',
    capabilities: ['storage'],
    permissions: ['stance:read', 'stance:write', 'config:read'],
    author: 'METAMORPH Team',
  },

  operators: [
    {
      name: 'introspect',
      description: 'Add metacognitive commentary to responses',
      category: 'meta',
      triggers: ['debug', 'explain_reasoning', 'show_work'],
      intensity: { min: 10, max: 100, default: 50 },
      execute: (stance, context) => {
        const { intensity, trigger, sessionContext } = context;

        // Adjust reflection based on intensity
        const reflectionDepth = Math.floor(intensity / 25); // 0-4 levels

        return {
          stanceModifications: {
            values: {
              ...stance.values,
              reflection: Math.min(100, stance.values.reflection + 30),
              precision: Math.min(100, stance.values.precision + 20),
            },
          },
          systemPromptAddition: `
METACOGNITIVE MODE: Level ${reflectionDepth}

After your response, add a "Reasoning" section that explains:
${reflectionDepth >= 1 ? '- Your thought process and key considerations' : ''}
${reflectionDepth >= 2 ? '- Alternative approaches you considered' : ''}
${reflectionDepth >= 3 ? '- Assumptions you made and their implications' : ''}
${reflectionDepth >= 4 ? '- Metacognitive reflection on the reasoning process itself' : ''}

Be explicit about uncertainties and confidence levels.
          `.trim(),
          reasoning: `Activated introspection at level ${reflectionDepth} (trigger: ${trigger})`,
        };
      },
    },
  ],

  hooks: {
    beforeRequest: async (context) => {
      // Log request for debugging
      context.logger.debug('Debug mode: processing request', {
        messageLength: context.userMessage.length,
        stanceFrame: context.stance.frame,
      });
    },

    afterResponse: async (context) => {
      // Store response metadata
      const metadata = {
        responseLength: context.assistantMessage.length,
        operatorsApplied: context.appliedOperators,
        timestamp: Date.now(),
      };

      context.capabilities.storage.set(
        `response_${context.messageId}`,
        metadata
      );
    },
  },

  settings: [
    {
      key: 'autoActivate',
      name: 'Auto-activate Debug Mode',
      description: 'Automatically enable debug mode for all conversations',
      type: 'boolean',
      default: false,
    },
    {
      key: 'verbosity',
      name: 'Verbosity Level',
      description: 'How detailed should debug output be',
      type: 'select',
      options: [
        { label: 'Minimal', value: 'minimal' },
        { label: 'Standard', value: 'standard' },
        { label: 'Verbose', value: 'verbose' },
      ],
      default: 'standard',
    },
  ],

  onActivate: async (ctx) => {
    ctx.logger.info('Debug mode activated');

    const settings = await ctx.getSettings();
    if (settings.autoActivate) {
      ctx.logger.info('Auto-activation enabled');
    }
  },

  onDeactivate: () => {
    console.log('Debug mode deactivated');
  },
});

registerCliPlugin(debugModePlugin);
```

### Operator Categories

| Category | Purpose | Example Use Cases |
|----------|---------|-------------------|
| `stance` | Modify stance values directly | Increase empathy, boost creativity, enhance precision |
| `meta` | Add metacognitive elements | Show reasoning, explain process, self-critique |
| `tone` | Adjust response tone/style | Make more formal, add humor, simplify language |

### CLI Hooks

```typescript
interface CliPluginHooks {
  // Called before request is sent to AI
  beforeRequest?: (context: RequestContext) => Promise<void> | void;

  // Called after AI response is received
  afterResponse?: (context: ResponseContext) => Promise<void> | void;

  // Called when stance changes
  onStanceChange?: (oldStance: Stance, newStance: Stance) => void;

  // Called when session starts
  onSessionStart?: (sessionId: string) => void;

  // Called when session ends
  onSessionEnd?: (sessionId: string) => void;
}
```

### Plugin Settings

Settings allow users to configure plugin behavior:

```typescript
interface PluginSetting {
  key: string;                       // Setting identifier
  name: string;                      // Display name
  description: string;               // What this setting does
  type: 'boolean' | 'number' | 'string' | 'select';
  default: unknown;                  // Default value
  options?: Array<{                  // For 'select' type
    label: string;
    value: unknown;
  }>;
  validation?: {                     // For 'number' type
    min?: number;
    max?: number;
  };
}
```

### Operator Context

When an operator executes, it receives context about the current request:

```typescript
interface OperatorContext {
  intensity: number;                 // 0-100, how strongly to apply
  trigger: string;                   // What triggered this operator
  sessionContext: {
    sessionId: string;
    messageCount: number;
    emotionContext?: EmotionContext;
  };
  userMessage: string;               // The current user input
  conversationHistory: Message[];    // Previous messages
}
```

---

## Lifecycle Hooks

Plugins can implement lifecycle hooks for initialization and cleanup:

```typescript
interface WebPlugin {
  // Called when plugin is enabled
  onActivate?: (capabilities: PlatformCapabilities) => Promise<void> | void;

  // Called when plugin is disabled
  onDeactivate?: () => Promise<void> | void;
}
```

### Activation Hook

Use `onActivate` to:
- Initialize resources
- Start background processes
- Load saved state
- Request additional permissions

```typescript
onActivate: async (capabilities) => {
  // Load saved configuration
  const config = capabilities.storage.get<Config>('config');

  // Pre-warm capabilities
  if (config?.autoStartCamera) {
    await capabilities.webcam.start();
  }

  // Initialize any third-party libraries
  await initializeML();
}
```

### Deactivation Hook

Use `onDeactivate` to:
- Stop background processes
- Release resources
- Save state
- Clean up subscriptions

```typescript
onDeactivate: () => {
  // Stop any running processes
  capabilities.webcam.stop();
  capabilities.stt.stop();

  // Save final state
  capabilities.storage.set('lastDeactivated', Date.now());
}
```

---

## Event Handlers

Plugins can subscribe to platform events:

```typescript
interface WebPlugin {
  // Called when emotion is detected
  onEmotionDetected?: (emotion: EmotionContext) => void;

  // Called when stance changes
  onStanceChange?: (stance: Stance) => void;

  // Called when config changes
  onConfigChange?: (config: ModeConfig) => void;

  // Called when messages are sent/received
  onMessage?: (message: string, role: 'user' | 'assistant') => void;
}
```

### Event Handler Example

```typescript
export const analyticsPlugin = definePlugin({
  manifest: { /* ... */ },

  onEmotionDetected: (emotion) => {
    // Track emotion changes
    trackEvent('emotion_detected', {
      emotion: emotion.currentEmotion,
      valence: emotion.valence,
      confidence: emotion.confidence,
    });
  },

  onStanceChange: (stance) => {
    // Log stance transitions
    console.log('Stance changed:', stance.frame, stance.selfModel);
  },

  onMessage: (message, role) => {
    // Count message lengths
    trackEvent('message', {
      role,
      length: message.length,
    });
  },
});
```

---

## Built-in Plugins

### Emotion Detection Plugin

**Location:** `web/plugins/emotion/`

The emotion detection plugin demonstrates a full-featured plugin implementation:

- **Capabilities Used:** `webcam`, `vision`, `storage`
- **Features:**
  - Real-time face detection (face-api.js)
  - AI emotion analysis (Claude Vision)
  - Emotion aggregation and trends
  - Empathy boost suggestions

**Registration:**

```typescript
import { emotionPlugin } from '@/plugins/emotion';
import { registerPlugin, pluginRegistry } from '@/lib/plugins';

registerPlugin(emotionPlugin);
await pluginRegistry.enable('emotion-detection');
```

---

## API Reference

### SDK Exports

The `@metamorph/plugin-sdk` package provides platform-specific exports through subpaths.

#### Core Exports (`@metamorph/plugin-sdk/core`)

```typescript
// Base types (platform-agnostic)
export type {
  PluginManifest,
  PluginCapability,
  PluginPermission,
  PluginEventBus,
};
```

#### Web Exports (`@metamorph/plugin-sdk/web`)

```typescript
// Plugin definition
export function defineWebPlugin(config: WebPlugin): WebPlugin;
export function registerWebPlugin(plugin: WebPlugin): void;

// Plugin registry (singleton)
export const webPluginRegistry: WebPluginRegistry;

// Get all enabled panels
export function getPluginPanels(): PanelDefinition[];

// Types
export type {
  WebPlugin,
  WebPluginManifest,
  PanelDefinition,
  PanelProps,
  PlatformCapabilities,
};
```

#### CLI Exports (`@metamorph/plugin-sdk/cli`)

```typescript
// Plugin definition
export function defineCliPlugin(config: CliPlugin): CliPlugin;
export function registerCliPlugin(plugin: CliPlugin): void;

// Plugin registry (singleton)
export const cliPluginRegistry: CliPluginRegistry;

// Types
export type {
  CliPlugin,
  Operator,
  OperatorContext,
  OperatorResult,
  CliPluginHooks,
  PluginSetting,
};
```

#### React Exports (`@metamorph/plugin-sdk/react`)

```typescript
// Hooks
export function usePluginRegistry(): PluginRegistryHook;
export function usePluginCapabilities(pluginId: string): PlatformCapabilities | null;
export function usePluginSession(sessionId: string | undefined): void;
export function usePluginPanels(): PanelDefinition[];
export function useAutoPlugin(plugin: WebPlugin, enabled?: boolean): AutoPluginResult;

// Types
export type {
  PluginRegistryHook,
  AutoPluginResult,
};
```

### Web Plugin Registry

```typescript
interface WebPluginRegistry {
  // Registration
  register(plugin: WebPlugin): void;
  unregister(pluginId: string): void;

  // Enable/disable
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;

  // Query
  getPlugin(pluginId: string): PluginRegistration | undefined;
  getAllPlugins(): PluginRegistration[];
  getPanels(): PanelDefinition[];

  // Session management
  setSessionId(sessionId: string | undefined): void;

  // Event emission
  emitEmotionDetected(emotion: EmotionContext): void;
  emitStanceChange(stance: Stance): void;
  emitConfigChange(config: ModeConfig): void;
  emitMessage(message: string, role: 'user' | 'assistant'): void;
}
```

### CLI Plugin Registry

```typescript
interface CliPluginRegistry {
  // Registration
  register(plugin: CliPlugin): void;
  unregister(pluginId: string): void;

  // Enable/disable
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;

  // Query
  getPlugin(pluginId: string): CliPluginRegistration | undefined;
  getAllPlugins(): CliPluginRegistration[];
  getOperators(): Operator[];

  // Operator execution
  executeOperators(
    stance: Stance,
    context: OperatorContext
  ): Promise<OperatorResult[]>;

  // Hook execution
  executeHook(
    hookName: keyof CliPluginHooks,
    ...args: unknown[]
  ): Promise<void>;
}
```

### React Hooks

```typescript
// Access the plugin registry
usePluginRegistry(): {
  plugins: PluginRegistration[];
  panels: PanelDefinition[];
  enablePlugin: (id: string) => Promise<void>;
  disablePlugin: (id: string) => Promise<void>;
  registerPlugin: (plugin: WebPlugin) => void;
  refresh: () => void;
}

// Get a plugin's capabilities
usePluginCapabilities(pluginId: string): PlatformCapabilities | null

// Sync session ID with registry
usePluginSession(sessionId: string | undefined): void

// Get enabled panels
usePluginPanels(): PanelDefinition[]

// Auto-register and enable a plugin
useAutoPlugin(plugin: WebPlugin, enabled?: boolean): {
  isReady: boolean;
  error: Error | null;
}
```

---

## Best Practices

### General

1. **Declare All Capabilities**: List every capability your plugin needs in the manifest
2. **Handle Errors Gracefully**: Wrap capability calls in try/catch
3. **Use Storage for State**: Persist important state to survive restarts
4. **Use Type Safety**: Leverage TypeScript for all plugin code
5. **Version Your Plugins**: Use semantic versioning for your plugin releases
6. **Document Your Plugin**: Provide clear README with usage examples

### Web Plugins

1. **Clean Up Resources**: Always stop webcam/audio in `onDeactivate`
2. **Respect Rate Limits**: Check `canAnalyze` before vision API calls
3. **Keep Panels Lightweight**: Avoid heavy computations in render
4. **Use React Hooks**: Leverage `useAutoPlugin` for automatic registration
5. **Handle Permissions**: Request browser permissions gracefully

### CLI Plugins

1. **Make Operators Composable**: Design operators to work well together
2. **Use Intensity Wisely**: Implement intensity scaling for smooth control
3. **Provide Clear Triggers**: Use descriptive trigger keywords
4. **Log Reasoning**: Always include reasoning in operator results
5. **Test Operator Combinations**: Verify behavior when multiple operators fire
6. **Document Settings**: Explain what each setting does and its impact
7. **Handle Async Operations**: Use hooks for async processing (network, file I/O)

---

## Troubleshooting

### Web Plugin Issues

#### Webcam Not Starting

```typescript
try {
  await capabilities.webcam.start();
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // User denied permission
  } else if (error.name === 'NotFoundError') {
    // No camera available
  }
}
```

#### TTS Not Working

Some browsers require user interaction before TTS works:

```typescript
// Trigger from a button click
<button onClick={() => capabilities.tts.speak('Hello')}>
  Speak
</button>
```

#### Vision API Rate Limited

```typescript
if (!capabilities.vision.canAnalyze) {
  console.log(`Wait ${capabilities.vision.cooldownRemaining}s`);
  // Fall back to browser detection
  const result = await detectEmotions(videoElement);
}
```

#### Plugin Not Loading

```typescript
import { useAutoPlugin } from '@metamorph/plugin-sdk/react';

// Check for errors
const { isReady, error } = useAutoPlugin(myPlugin);

if (error) {
  console.error('Plugin failed to load:', error);
}
```

### CLI Plugin Issues

#### Operator Not Triggering

Check that:
1. Plugin is registered and enabled
2. Trigger keywords match user input
3. Required permissions are granted

```typescript
// Debug operator execution
const results = await cliPluginRegistry.executeOperators(stance, context);
console.log('Operators fired:', results.map(r => r.reasoning));
```

#### Storage Not Persisting

Ensure storage directory exists:

```bash
# Storage location
ls -la ~/.metamorph/plugins/your-plugin-id/
```

#### File Permission Errors

Check that filesystem permissions are declared:

```typescript
manifest: {
  capabilities: ['filesystem:read', 'filesystem:write'],
  permissions: ['filesystem:read', 'filesystem:write'],
}
```

#### Hook Not Executing

Verify hook is properly defined:

```typescript
hooks: {
  beforeRequest: async (context) => {
    console.log('Hook executing');
  },
}
```

---

## Future Capabilities (Planned)

- **Audio Analysis**: Real-time audio emotion detection
- **Gesture Recognition**: Hand/body pose tracking
- **Multi-Modal Fusion**: Combine audio + video + text signals
- **External Integrations**: Webhooks, IFTTT, Zapier
- **Plugin Marketplace**: Community plugin discovery

---

## Publishing Your Plugin

### As an npm Package

You can publish your plugin as a standalone npm package:

1. **Create a new package:**

```bash
mkdir my-metamorph-plugin
cd my-metamorph-plugin
npm init -y
npm install @metamorph/plugin-sdk
```

2. **Create your plugin:**

```typescript
// index.ts
import { defineCliPlugin } from '@metamorph/plugin-sdk/cli';

export default defineCliPlugin({
  manifest: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'A cool plugin',
    capabilities: [],
    permissions: [],
  },
  // ... plugin implementation
});
```

3. **Publish to npm:**

```bash
npm publish
```

4. **Users install and use:**

```bash
npm install my-metamorph-plugin
```

```typescript
import myPlugin from 'my-metamorph-plugin';
import { registerCliPlugin } from '@metamorph/plugin-sdk/cli';

registerCliPlugin(myPlugin);
```

### Contributing to METAMORPH

To contribute a built-in plugin:

1. **Web plugins:** Create in `web/plugins/your-plugin/`
2. **CLI plugins:** Create in `cli/plugins/your-plugin/`
3. Follow the SDK patterns shown in this documentation
4. Add comprehensive documentation and examples
5. Write tests for your plugin
6. Submit a PR to the METAMORPH repository

### Plugin Guidelines

- Use semantic versioning
- Provide clear documentation
- Include usage examples
- Test on both web and CLI (if applicable)
- Follow TypeScript best practices
- Respect user privacy and permissions

---

## SDK Package Benefits

The `@metamorph/plugin-sdk` package provides several key benefits:

### For Plugin Developers

1. **Type Safety**: Full TypeScript definitions for all APIs
2. **Platform Abstraction**: Write plugins that work on web or CLI
3. **Easy Distribution**: Publish plugins as npm packages
4. **Versioned API**: Stable API with semantic versioning
5. **Documentation**: Comprehensive docs and examples
6. **Auto-completion**: IDE support with IntelliSense

### For METAMORPH Users

1. **Plugin Discovery**: Find plugins on npm
2. **Easy Installation**: `npm install @scope/plugin-name`
3. **Version Control**: Lock plugin versions in package.json
4. **Security**: Review plugin code before installation
5. **Community Ecosystem**: Share and discover community plugins

### Package Structure

```
@metamorph/plugin-sdk/
├── core/          # Platform-agnostic types
├── web/           # Web plugin SDK
├── cli/           # CLI plugin SDK
├── react/         # React hooks
└── dist/
    ├── esm/       # ES modules
    ├── cjs/       # CommonJS
    └── umd/       # UMD for browsers
```

---

## Examples Repository

For more complete examples, see:

- **Web Plugin Examples**: `web/plugins/emotion/` - Emotion detection with webcam
- **CLI Plugin Examples**: `cli/plugins/` - Stance operators and hooks
- **SDK Examples**: `packages/sdk/examples/` - Standalone plugin examples

---

*METAMORPH Plugin System v2.0.0 - Powered by @metamorph/plugin-sdk*
