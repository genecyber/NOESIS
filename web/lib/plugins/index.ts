/**
 * METAMORPH Web Plugin SDK
 *
 * Main entry point for plugin development.
 *
 * @example
 * ```tsx
 * import { definePlugin, registerPlugin } from '@/lib/plugins';
 *
 * const myPlugin = definePlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'A custom plugin',
 *     capabilities: ['webcam'],
 *     permissions: ['emotion:read'],
 *   },
 *   panel: {
 *     id: 'my-panel',
 *     label: 'My Panel',
 *     icon: MyIcon,
 *     component: MyPanelComponent,
 *     order: 10,
 *   },
 *   onActivate: async (capabilities) => {
 *     await capabilities.webcam.start();
 *   },
 *   onDeactivate: () => {
 *     // Cleanup
 *   },
 * });
 *
 * registerPlugin(myPlugin);
 * ```
 */

// Types
export type {
  WebPluginManifest,
  WebPlugin,
  PluginCapability,
  PluginPermission,
  PanelDefinition,
  PanelProps,
  PlatformCapabilities,
  WebcamCapability,
  TTSCapability,
  STTCapability,
  VisionCapability,
  StorageCapability,
  TTSOptions,
  STTOptions,
  PluginRegistration,
  PluginRegistry,
} from './types';

// Registry
export {
  pluginRegistry,
  registerPlugin,
  definePlugin,
  getPluginPanels,
} from './registry';

// Capabilities (for advanced use)
export {
  createPlatformCapabilities,
  createWebcamCapability,
  createTTSCapability,
  createSTTCapability,
  createVisionCapability,
  createStorageCapability,
} from './capabilities';

// React Hooks
export {
  usePluginRegistry,
  usePluginCapabilities,
  usePluginSession,
  usePluginPanels,
  useAutoPlugin,
} from './hooks';
