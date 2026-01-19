# METAMORPH Plugin System

This document describes the METAMORPH plugin architecture, SDK, and how to build custom plugins that extend the platform's capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Plugin Manifest](#plugin-manifest)
5. [Platform Capabilities](#platform-capabilities)
6. [Creating a Panel Plugin](#creating-a-panel-plugin)
7. [Lifecycle Hooks](#lifecycle-hooks)
8. [Event Handlers](#event-handlers)
9. [Built-in Plugins](#built-in-plugins)
10. [API Reference](#api-reference)

---

## Overview

METAMORPH's plugin system allows developers to extend the platform with custom functionality:

- **Panel Plugins**: Add new panels to the sidebar (like the Emotion Detection panel)
- **Platform Capabilities**: Access webcam, TTS, STT, and AI vision
- **Event Integration**: React to emotions, stance changes, messages, and more
- **Isolated Storage**: Each plugin gets its own localStorage namespace

### Key Principles

1. **Capability-Based Access**: Plugins declare required capabilities upfront
2. **Permission Model**: Plugins request specific permissions for data access
3. **Lifecycle Management**: Clean activation/deactivation with automatic cleanup
4. **Type Safety**: Full TypeScript support with comprehensive types

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    METAMORPH Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Plugin Registry                        ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │ Plugin  │ │ Plugin  │ │ Plugin  │ │ Plugin  │       ││
│  │  │    A    │ │    B    │ │    C    │ │   ...   │       ││
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       ││
│  └───────┼──────────┼──────────┼──────────┼───────────────┘│
│          │          │          │          │                 │
│  ┌───────┴──────────┴──────────┴──────────┴───────────────┐│
│  │              Platform Capabilities                       ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐││
│  │  │ Webcam │ │  TTS   │ │  STT   │ │ Vision │ │Storage ││
│  │  │ Stream │ │ Speak  │ │ Listen │ │  API   │ │  KV    │││
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Event Bus                             ││
│  │  emotion:detected │ stance:changed │ message:sent        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Plugin SDK | `web/lib/plugins/` | Core SDK types and utilities |
| Registry | `web/lib/plugins/registry.ts` | Plugin registration and lifecycle |
| Capabilities | `web/lib/plugins/capabilities.ts` | Platform capability implementations |
| Hooks | `web/lib/plugins/hooks.ts` | React hooks for plugin integration |

---

## Quick Start

### 1. Create a Plugin

```tsx
// plugins/my-plugin/index.ts
import { definePlugin } from '@/lib/plugins';
import { Sparkles } from 'lucide-react';
import MyPanel from './MyPanel';

export const myPlugin = definePlugin({
  manifest: {
    id: 'my-plugin',
    name: 'My Awesome Plugin',
    version: '1.0.0',
    description: 'Does awesome things',
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

  onActivate: async (capabilities) => {
    console.log('Plugin activated!');
    capabilities.storage.set('lastActivated', Date.now());
  },

  onDeactivate: () => {
    console.log('Plugin deactivated');
  },
});

export default myPlugin;
```

### 2. Create the Panel Component

```tsx
// plugins/my-plugin/MyPanel.tsx
import type { PanelProps } from '@/lib/plugins/types';

export default function MyPanel({
  sessionId,
  stance,
  capabilities
}: PanelProps) {
  const lastActivated = capabilities.storage.get<number>('lastActivated');

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display font-bold gradient-text">My Panel</h3>
      <p className="text-emblem-muted text-sm">
        Current frame: {stance?.frame || 'unknown'}
      </p>
      {lastActivated && (
        <p className="text-xs text-emblem-muted">
          Last activated: {new Date(lastActivated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
```

### 3. Register the Plugin

```tsx
// app/page.tsx or a dedicated plugins initializer
import { registerPlugin } from '@/lib/plugins';
import { myPlugin } from '@/plugins/my-plugin';

// Register on app initialization
registerPlugin(myPlugin);
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

Capabilities are platform features your plugin needs:

| Capability | Description | Browser API Used |
|------------|-------------|------------------|
| `webcam` | Camera access for video/image capture | `MediaDevices.getUserMedia()` |
| `microphone` | Audio input for speech recognition | `MediaDevices.getUserMedia()` |
| `speaker` | Audio output for text-to-speech | `SpeechSynthesis` |
| `vision` | AI image analysis via Claude Vision | Backend API |
| `storage` | Plugin-scoped localStorage | `localStorage` |
| `notifications` | Browser notifications | `Notification` API |
| `fullscreen` | Fullscreen mode | `Fullscreen` API |

### Permissions

Permissions control data access:

| Permission | Description |
|------------|-------------|
| `stance:read` | Read current stance |
| `stance:write` | Modify stance values |
| `config:read` | Read mode configuration |
| `config:write` | Modify configuration |
| `session:read` | Access session data |
| `memory:read` | Search memories |
| `memory:write` | Create memories |
| `emotion:read` | Access emotion context |
| `emotion:write` | Update emotion context |

---

## Platform Capabilities

### Webcam Capability

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

### TTS Capability (Text-to-Speech)

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

### STT Capability (Speech-to-Text)

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

### Vision Capability (AI Image Analysis)

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

### Storage Capability

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

---

## Creating a Panel Plugin

Panel plugins add a new tab to the METAMORPH sidebar.

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

### Registry Functions

```typescript
// Register a plugin
registerPlugin(plugin: WebPlugin): void

// Create a plugin definition (type helper)
definePlugin(config: WebPlugin): WebPlugin

// Get all enabled panels
getPluginPanels(): PanelDefinition[]
```

### Plugin Registry

```typescript
interface PluginRegistry {
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

1. **Declare All Capabilities**: List every capability your plugin needs in the manifest
2. **Handle Errors Gracefully**: Wrap capability calls in try/catch
3. **Clean Up Resources**: Always stop webcam/audio in `onDeactivate`
4. **Use Storage for State**: Persist important state to survive page reloads
5. **Respect Rate Limits**: Check `canAnalyze` before vision API calls
6. **Keep Panels Lightweight**: Avoid heavy computations in render
7. **Use Type Safety**: Leverage TypeScript for all plugin code

---

## Troubleshooting

### Webcam Not Starting

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

### TTS Not Working

Some browsers require user interaction before TTS works:

```typescript
// Trigger from a button click
<button onClick={() => capabilities.tts.speak('Hello')}>
  Speak
</button>
```

### Vision API Rate Limited

```typescript
if (!capabilities.vision.canAnalyze) {
  console.log(`Wait ${capabilities.vision.cooldownRemaining}s`);
  // Fall back to browser detection
  const result = await detectEmotions(videoElement);
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

## Contributing

To contribute a plugin:

1. Create your plugin in `web/plugins/your-plugin/`
2. Follow the SDK patterns shown above
3. Add documentation for your plugin
4. Submit a PR with your plugin

---

*METAMORPH Plugin System v1.0.0*
