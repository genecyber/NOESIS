# @metamorph/plugin-sdk

Create plugins for METAMORPH web UI and CLI.

## Installation

```bash
npm install @metamorph/plugin-sdk
# or
yarn add @metamorph/plugin-sdk
# or
pnpm add @metamorph/plugin-sdk
```

## Quick Start

### Web Plugin (React)

```tsx
import { defineWebPlugin, useAutoPlugin, registerWebPlugin } from '@metamorph/plugin-sdk/web';
import { Heart } from 'lucide-react';

// Define your plugin
const myPlugin = defineWebPlugin({
  manifest: {
    id: 'my-emotion-plugin',
    name: 'My Emotion Plugin',
    version: '1.0.0',
    description: 'Detects and responds to emotions',
    capabilities: ['webcam', 'vision'],
    permissions: ['emotion:read', 'emotion:write'],
  },
  panel: {
    id: 'my-panel',
    label: 'Emotions',
    icon: Heart,
    component: MyEmotionPanel,
    order: 5,
  },
  onActivate: async (ctx) => {
    ctx.logger.info('Plugin activated!');
    await ctx.capabilities.webcam.start();
  },
  onDeactivate: () => {
    // Cleanup
  },
});

// Register in your app
function App() {
  useAutoPlugin(myPlugin);
  return <MyApp />;
}
```

### CLI Plugin (Node.js)

```ts
import { defineCliPlugin, registerCliPlugin } from '@metamorph/plugin-sdk/cli';

const myPlugin = defineCliPlugin({
  manifest: {
    id: 'poetry-mode',
    name: 'Poetry Mode',
    version: '1.0.0',
    description: 'Enables poetic responses',
    capabilities: ['storage'],
    permissions: ['stance:read', 'stance:write'],
  },
  operators: [
    {
      name: 'poeticize',
      description: 'Transform response into poetic form',
      category: 'meta',
      triggers: ['creative_request'],
      intensity: { min: 30, max: 100, default: 60 },
      execute: (stance, context) => ({
        stanceModifications: {
          frame: 'poetic',
          values: {
            ...stance.values,
            novelty: Math.min(100, stance.values.novelty + 20),
          },
        },
        systemPromptAddition: 'Respond with heightened poetic sensibility.',
      }),
    },
  ],
});

registerCliPlugin(myPlugin);
```

### CDN Usage

```html
<script src="https://unpkg.com/@metamorph/plugin-sdk/dist/umd/metamorph-sdk.min.js"></script>
<script>
  const { defineWebPlugin, webPluginRegistry } = MetamorphSDK;

  const plugin = MetamorphSDK.defineWebPlugin({
    manifest: {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'A simple plugin',
      capabilities: [],
      permissions: [],
    },
  });

  webPluginRegistry.register(plugin);
</script>
```

## Platform Capabilities

### Web Capabilities

| Capability | Description |
|------------|-------------|
| `webcam` | Camera access via MediaDevices API |
| `displayCapture` | Screen/window/tab capture via getDisplayMedia |
| `speaker` | Text-to-speech via Web Speech API |
| `microphone` | Speech-to-text via Web Speech API |
| `vision` | AI image analysis (prompt-driven) |
| `storage` | Plugin-scoped localStorage |
| `memory` | Access to METAMORPH memory system |

### Vision API

The vision capability provides general image inference:

```typescript
// Analyze any image with a custom prompt
const analysis = await capabilities.vision.analyzeImage(
  imageDataUrl,
  "Describe what you see in this image"
);

// The prompt determines what to analyze:
// - Emotions: "What emotion is this person showing?"
// - Objects: "List all objects visible in this image"
// - Text: "Extract any text from this image"
// - Custom: "Is there a cat in this image?"
```

### Display Capture

Capture screen, window, or browser tab content:

```typescript
// Start capture (browser shows picker)
const stream = await capabilities.displayCapture.start();

// Capture frames for analysis
const frame = await capabilities.displayCapture.captureFrame();
const analysis = await capabilities.vision.analyzeImage(
  frame,
  "What's happening on screen?"
);

// Stop when done
capabilities.displayCapture.stop();
```

Note: `displayCapture` may be `null` if browser doesn't support getDisplayMedia.

### Memory Capability

Access and manage METAMORPH's persistent memory system:

```typescript
// Get memories with optional filtering
const memories = await capabilities.memory.getMemories({
  type: 'episodic',        // Filter by type: 'episodic' | 'semantic' | 'identity'
  minImportance: 0.5,      // Minimum importance score (0-1)
  limit: 10                // Maximum number of results
});

// Add a new memory
const memory = await capabilities.memory.addMemory({
  type: 'semantic',
  content: 'User prefers dark mode interfaces',
  importance: 0.8,
  metadata: {
    source: 'preferences',
    tags: ['ui', 'theme']
  }
});

// Search memories by content similarity
const related = await capabilities.memory.searchMemories(
  'user interface preferences',
  { type: 'semantic', limit: 5 }
);

// Delete a memory
const deleted = await capabilities.memory.deleteMemory(memory.id);
```

#### Memory Types

- **`episodic`**: Specific experiences and events (e.g., "User asked about Python on 2026-01-15")
- **`semantic`**: General knowledge and facts (e.g., "User is a Python developer")
- **`identity`**: Core identity and persistent traits (e.g., "I value clarity in communication")

#### Memory Interface

```typescript
interface Memory {
  id: string;                           // Unique memory identifier
  type: 'episodic' | 'semantic' | 'identity';
  content: string;                      // The memory content
  importance: number;                   // Importance score (0-1)
  timestamp: number;                    // Creation timestamp
  metadata?: Record<string, unknown>;   // Optional metadata
}

interface MemorySearchOptions {
  type?: 'episodic' | 'semantic' | 'identity';
  minImportance?: number;
  limit?: number;
  query?: string;
}
```

### CLI Capabilities

| Capability | Description |
|------------|-------------|
| `storage` | File-based plugin storage |
| `memory` | Access to METAMORPH memory system |

## Permissions

| Permission | Description |
|------------|-------------|
| `stance:read` | Read current stance |
| `stance:write` | Modify stance values |
| `emotion:read` | Read emotion context |
| `emotion:write` | Update emotion context |
| `config:read` | Read configuration |
| `config:write` | Modify configuration |
| `memory:read` | Search memories |
| `memory:write` | Add memories |
| `conversation:read` | Read messages |
| `filesystem:read` | Read files (CLI only) |
| `filesystem:write` | Write files (CLI only) |
| `network:fetch` | Make HTTP requests |

## Exports

```ts
// Core (platform-agnostic)
import { PluginManifest, PluginEventBus } from '@metamorph/plugin-sdk/core';

// Web (browser)
import { defineWebPlugin, useAutoPlugin, webPluginRegistry } from '@metamorph/plugin-sdk/web';

// CLI (Node.js)
import { defineCliPlugin, cliPluginRegistry } from '@metamorph/plugin-sdk/cli';

// React hooks
import { usePluginRegistry, usePluginCapabilities } from '@metamorph/plugin-sdk/react';
```

## Documentation

For comprehensive documentation including:
- Complete API reference
- Web panel plugin tutorials
- CLI operator and hooks guide
- Platform capabilities deep dive
- Best practices and troubleshooting

See **[PLUGINS.md](../../PLUGINS.md)** - the full plugin system documentation.

## License

MIT
