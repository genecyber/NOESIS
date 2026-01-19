/**
 * METAMORPH Plugin SDK - Web Module
 *
 * Browser-specific plugin SDK for web UI integration.
 */

// Re-export core types
export type {
  PluginManifest,
  PluginCapability,
  PluginPermission,
  PluginEventType,
  PluginEventHandler,
  PluginEventSubscription,
  PluginStorage,
  PluginLogger,
  EmotionContext,
  Stance,
  StanceValues,
  ModeConfig,
} from '../core/index.js';

export { pluginEventBus, PluginEventBus } from '../core/index.js';

// Web-specific types
export type {
  PanelDefinition,
  PanelProps,
  WebPlugin,
  WebPluginContext,
} from './types.js';

export { defineWebPlugin } from './types.js';

// Capabilities
export type {
  DisplayCaptureCapability,
  DisplaySource,
  WebcamCapability,
  TTSCapability,
  TTSOptions,
  STTCapability,
  STTOptions,
  VisionCapability,
  VisionCapabilityOptions,
  WebPlatformCapabilities,
} from './capabilities.js';

export {
  createDisplayCaptureCapability,
  createWebcamCapability,
  createTTSCapability,
  createSTTCapability,
  createVisionCapability,
  createBrowserStorage,
  createWebPlatformCapabilities,
} from './capabilities.js';

// Registry
export type { WebPluginRegistration } from './registry.js';
export { webPluginRegistry, registerWebPlugin } from './registry.js';

// React hooks
export {
  usePluginRegistry,
  usePluginCapabilities,
  usePluginSession,
  usePluginPanels,
  useAutoPlugin,
  usePluginEvent,
} from './hooks.js';

export type { UsePluginRegistryResult, UseAutoPluginResult } from './hooks.js';
