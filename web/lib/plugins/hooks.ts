/**
 * METAMORPH Plugin Hooks
 *
 * React hooks for integrating with the plugin system.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { pluginRegistry } from './registry';
import type {
  WebPlugin,
  PanelDefinition,
  PlatformCapabilities,
  PluginRegistration,
} from './types';

/**
 * Hook to access the plugin registry
 */
export function usePluginRegistry() {
  const [plugins, setPlugins] = useState<PluginRegistration[]>([]);
  const [panels, setPanels] = useState<PanelDefinition[]>([]);

  // Refresh state from registry
  const refresh = useCallback(() => {
    setPlugins(pluginRegistry.getAllPlugins());
    setPanels(pluginRegistry.getPanels());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enablePlugin = useCallback(async (pluginId: string) => {
    await pluginRegistry.enable(pluginId);
    refresh();
  }, [refresh]);

  const disablePlugin = useCallback(async (pluginId: string) => {
    await pluginRegistry.disable(pluginId);
    refresh();
  }, [refresh]);

  const registerPlugin = useCallback((plugin: WebPlugin) => {
    pluginRegistry.register(plugin);
    refresh();
  }, [refresh]);

  return {
    plugins,
    panels,
    enablePlugin,
    disablePlugin,
    registerPlugin,
    refresh,
  };
}

/**
 * Hook to access a specific plugin's capabilities
 */
export function usePluginCapabilities(pluginId: string): PlatformCapabilities | null {
  const registration = pluginRegistry.getPlugin(pluginId);

  if (!registration || !registration.enabled) {
    return null;
  }

  return registration.capabilities;
}

/**
 * Hook for managing session ID in the plugin registry
 */
export function usePluginSession(sessionId: string | undefined) {
  useEffect(() => {
    pluginRegistry.setSessionId(sessionId);
  }, [sessionId]);
}

/**
 * Hook to get all enabled panels (for use in page layout)
 */
export function usePluginPanels(): PanelDefinition[] {
  const [panels, setPanels] = useState<PanelDefinition[]>([]);

  useEffect(() => {
    setPanels(pluginRegistry.getPanels());
  }, []);

  return panels;
}

/**
 * Hook for auto-registering and enabling a plugin
 * Useful for built-in plugins that should always be active
 */
export function useAutoPlugin(
  plugin: WebPlugin,
  enabled: boolean = true
) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        // Register if not already registered
        const existing = pluginRegistry.getPlugin(plugin.manifest.id);
        if (!existing) {
          pluginRegistry.register(plugin);
        }

        // Enable/disable based on prop
        if (enabled) {
          await pluginRegistry.enable(plugin.manifest.id);
        } else {
          await pluginRegistry.disable(plugin.manifest.id);
        }

        setIsReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsReady(false);
      }
    };

    setup();

    return () => {
      // Disable on unmount
      pluginRegistry.disable(plugin.manifest.id).catch(console.error);
    };
  }, [plugin, enabled]);

  return { isReady, error };
}
