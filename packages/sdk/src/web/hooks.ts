/**
 * METAMORPH Plugin SDK - React Hooks
 *
 * React integration hooks for web plugins.
 */

import { useState, useEffect, useCallback } from 'react';
import type { WebPlugin, PanelDefinition, WebPluginContext } from './types.js';
import type { WebPlatformCapabilities } from './capabilities.js';
import { webPluginRegistry, type WebPluginRegistration } from './registry.js';
import { createWebPlatformCapabilities } from './capabilities.js';

// =============================================================================
// usePluginRegistry
// =============================================================================

export interface UsePluginRegistryResult {
  /** All registered plugins */
  plugins: WebPluginRegistration[];
  /** All enabled panels */
  panels: PanelDefinition[];
  /** Enable a plugin */
  enablePlugin: (pluginId: string) => Promise<void>;
  /** Disable a plugin */
  disablePlugin: (pluginId: string) => Promise<void>;
  /** Register a new plugin */
  registerPlugin: (plugin: WebPlugin) => void;
  /** Force refresh */
  refresh: () => void;
}

/**
 * Hook to access and manage the plugin registry.
 */
export function usePluginRegistry(): UsePluginRegistryResult {
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    return webPluginRegistry.subscribe(refresh);
  }, [refresh]);

  return {
    plugins: webPluginRegistry.getAll(),
    panels: webPluginRegistry.getPanels(),
    enablePlugin: (id) => webPluginRegistry.enable(id),
    disablePlugin: (id) => webPluginRegistry.disable(id),
    registerPlugin: (p) => webPluginRegistry.register(p),
    refresh,
  };
}

// =============================================================================
// usePluginCapabilities
// =============================================================================

/**
 * Hook to get platform capabilities for a plugin.
 * Creates capabilities instance once and memoizes it.
 */
export function usePluginCapabilities(
  pluginId: string,
  sessionId?: string
): WebPlatformCapabilities | null {
  const [capabilities, setCapabilities] = useState<WebPlatformCapabilities | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const caps = createWebPlatformCapabilities(pluginId, { sessionId });
    setCapabilities(caps);

    return () => {
      // Cleanup: stop any active streams
      if (caps.webcam.isActive) {
        caps.webcam.stop();
      }
      if (caps.stt.isListening) {
        caps.stt.stop();
      }
      if (caps.tts.isSpeaking) {
        caps.tts.stop();
      }
    };
  }, [pluginId, sessionId]);

  return capabilities;
}

// =============================================================================
// usePluginSession
// =============================================================================

/**
 * Hook to set the session ID in the registry.
 * Call this in your root component when session changes.
 */
export function usePluginSession(sessionId: string | undefined): void {
  useEffect(() => {
    webPluginRegistry.setSessionId(sessionId);
  }, [sessionId]);
}

// =============================================================================
// usePluginPanels
// =============================================================================

/**
 * Hook to get all enabled plugin panels.
 * Updates when panels change.
 */
export function usePluginPanels(): PanelDefinition[] {
  const [panels, setPanels] = useState<PanelDefinition[]>([]);

  useEffect(() => {
    const update = () => {
      setPanels(webPluginRegistry.getPanels());
    };

    update();
    return webPluginRegistry.subscribe(update);
  }, []);

  return panels;
}

// =============================================================================
// useAutoPlugin
// =============================================================================

export interface UseAutoPluginResult {
  /** Whether the plugin is ready (loaded and activated) */
  isReady: boolean;
  /** Error message if plugin failed to load */
  error: string | null;
  /** Plugin context (available when ready) */
  context: WebPluginContext | null;
}

/**
 * Hook to auto-register and manage a plugin's lifecycle.
 * Automatically registers on mount, enables if defaultEnabled, cleans up on unmount.
 */
export function useAutoPlugin(
  plugin: WebPlugin,
  enabled: boolean = plugin.panel?.defaultEnabled ?? true
): UseAutoPluginResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<WebPluginContext | null>(null);

  const pluginId = plugin.manifest.id;

  useEffect(() => {
    // Register if not already registered
    if (!webPluginRegistry.has(pluginId)) {
      webPluginRegistry.register(plugin);
    }

    // Enable/disable based on enabled prop
    const updateState = async () => {
      try {
        if (enabled) {
          await webPluginRegistry.enable(pluginId);
          const reg = webPluginRegistry.get(pluginId);
          setContext(reg?.context ?? null);
          setIsReady(true);
          setError(null);
        } else {
          await webPluginRegistry.disable(pluginId);
          setContext(null);
          setIsReady(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Plugin error');
        setIsReady(false);
      }
    };

    updateState();

    // Cleanup on unmount
    return () => {
      // Don't unregister, just disable if we enabled
      if (webPluginRegistry.isEnabled(pluginId)) {
        webPluginRegistry.disable(pluginId);
      }
    };
  }, [plugin, pluginId, enabled]);

  return { isReady, error, context };
}

// =============================================================================
// usePluginEvent
// =============================================================================

import type { PluginEventType, PluginEventHandler } from '../core/types.js';
import type { PluginEventData } from '../core/events.js';
import { pluginEventBus } from '../core/events.js';

/**
 * Hook to subscribe to plugin events.
 * Automatically unsubscribes on unmount.
 */
export function usePluginEvent<T extends PluginEventType>(
  event: T,
  handler: PluginEventHandler<PluginEventData[T]>,
  deps: unknown[] = []
): void {
  useEffect(() => {
    const sub = pluginEventBus.on(event, handler);
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
