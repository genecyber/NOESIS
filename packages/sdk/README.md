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
| `speaker` | Text-to-speech via Web Speech API |
| `microphone` | Speech-to-text via Web Speech API |
| `vision` | AI image analysis via METAMORPH API |
| `storage` | Plugin-scoped localStorage |

### CLI Capabilities

| Capability | Description |
|------------|-------------|
| `storage` | File-based plugin storage |

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

## License

MIT
