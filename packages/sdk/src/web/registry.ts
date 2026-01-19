/**
 * METAMORPH Plugin SDK - Web Registry
 *
 * Browser plugin registry with lifecycle management.
 */

import type {
  PluginRegistry,
  PluginRegistration,
} from '../core/plugin.js';
import { createPluginLogger } from '../core/plugin.js';
import { pluginEventBus } from '../core/events.js';
import type { EmotionContext, Stance, ModeConfig } from '../core/types.js';
import type { WebPlugin, WebPluginContext, PanelDefinition } from './types.js';
import { createWebPlatformCapabilities } from './capabilities.js';

// =============================================================================
// Web Plugin Registration
// =============================================================================

export interface WebPluginRegistration extends PluginRegistration<WebPlugin> {
  /** Plugin context */
  context?: WebPluginContext;
}

// =============================================================================
// Web Plugin Registry
// =============================================================================

class WebPluginRegistry implements PluginRegistry<WebPlugin> {
  private plugins: Map<string, WebPluginRegistration> = new Map();
  private sessionId?: string;
  private listeners: Set<() => void> = new Set();

  /**
   * Set the current session ID.
   * Updates capabilities for all plugins.
   */
  setSessionId(sessionId: string | undefined): void {
    this.sessionId = sessionId;
    // Update capabilities for all plugins
    for (const reg of this.plugins.values()) {
      if (reg.context) {
        reg.context.sessionId = sessionId;
      }
    }
  }

  /**
   * Register a plugin.
   */
  register(plugin: WebPlugin): void {
    if (this.plugins.has(plugin.manifest.id)) {
      console.warn(`Plugin ${plugin.manifest.id} is already registered`);
      return;
    }

    // Check browser capability support
    if (typeof window !== 'undefined') {
      this.checkCapabilitySupport(plugin);
    }

    const registration: WebPluginRegistration = {
      plugin,
      enabled: false,
      loadedAt: new Date(),
    };

    this.plugins.set(plugin.manifest.id, registration);
    this.notifyListeners();
  }

  /**
   * Unregister a plugin.
   */
  unregister(pluginId: string): void {
    const reg = this.plugins.get(pluginId);
    if (!reg) return;

    if (reg.enabled) {
      this.disable(pluginId);
    }

    this.plugins.delete(pluginId);
    this.notifyListeners();
  }

  /**
   * Enable a plugin.
   */
  async enable(pluginId: string): Promise<void> {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.enabled) return;

    const { plugin } = reg;

    try {
      // Create capabilities
      const capabilities = createWebPlatformCapabilities(plugin.manifest.id, {
        sessionId: this.sessionId,
      });

      // Create context
      const context: WebPluginContext = {
        manifest: plugin.manifest,
        storage: capabilities.storage,
        logger: createPluginLogger(plugin.manifest.id),
        capabilities,
        sessionId: this.sessionId,
        // Cast handler to match event bus signature - the generic T allows plugins
        // to type their handlers, but the event bus uses its own type mapping
        on: (event, handler) => pluginEventBus.on(event, handler as Parameters<typeof pluginEventBus.on>[1]),
      };

      reg.context = context;

      // Call lifecycle hooks
      if (plugin.onLoad) {
        await plugin.onLoad(context);
      }

      if (plugin.onActivate) {
        await plugin.onActivate(context);
      }

      reg.enabled = true;
      reg.error = undefined;

      this.notifyListeners();
    } catch (err) {
      reg.error = err instanceof Error ? err.message : 'Failed to enable plugin';
      console.error(`[WebPluginRegistry] Failed to enable ${pluginId}:`, err);
      throw err;
    }
  }

  /**
   * Disable a plugin.
   */
  async disable(pluginId: string): Promise<void> {
    const reg = this.plugins.get(pluginId);
    if (!reg || !reg.enabled) return;

    const { plugin, context } = reg;

    try {
      // Stop webcam if active
      if (context?.capabilities.webcam.isActive) {
        context.capabilities.webcam.stop();
      }

      // Call lifecycle hooks
      if (plugin.onDeactivate) {
        await plugin.onDeactivate();
      }

      if (plugin.onUnload) {
        await plugin.onUnload();
      }

      reg.enabled = false;
      reg.context = undefined;

      this.notifyListeners();
    } catch (err) {
      console.error(`[WebPluginRegistry] Error disabling ${pluginId}:`, err);
    }
  }

  /**
   * Get a plugin by ID.
   */
  get(pluginId: string): WebPluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): WebPluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Check if a plugin is enabled.
   */
  isEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.enabled ?? false;
  }

  /**
   * Get all enabled panels.
   */
  getPanels(): PanelDefinition[] {
    const panels: PanelDefinition[] = [];

    for (const reg of this.plugins.values()) {
      if (reg.enabled && reg.plugin.panel) {
        panels.push(reg.plugin.panel);
      }
    }

    // Sort by order (lower first)
    return panels.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  /**
   * Emit emotion detected event to plugins.
   */
  emitEmotionDetected(emotion: EmotionContext): void {
    for (const reg of this.plugins.values()) {
      if (reg.enabled && reg.plugin.onEmotionDetected) {
        if (reg.plugin.manifest.permissions.includes('emotion:read')) {
          try {
            reg.plugin.onEmotionDetected(emotion);
          } catch (err) {
            console.error(`[WebPluginRegistry] Error in onEmotionDetected for ${reg.plugin.manifest.id}:`, err);
          }
        }
      }
    }

    pluginEventBus.emit('emotion:detected', emotion);
  }

  /**
   * Emit stance change event to plugins.
   */
  emitStanceChange(stance: Stance): void {
    for (const reg of this.plugins.values()) {
      if (reg.enabled && reg.plugin.onStanceChange) {
        if (reg.plugin.manifest.permissions.includes('stance:read')) {
          try {
            reg.plugin.onStanceChange(stance);
          } catch (err) {
            console.error(`[WebPluginRegistry] Error in onStanceChange for ${reg.plugin.manifest.id}:`, err);
          }
        }
      }
    }
  }

  /**
   * Emit config change event to plugins.
   */
  emitConfigChange(config: ModeConfig): void {
    for (const reg of this.plugins.values()) {
      if (reg.enabled && reg.plugin.onConfigChange) {
        if (reg.plugin.manifest.permissions.includes('config:read')) {
          try {
            reg.plugin.onConfigChange(config);
          } catch (err) {
            console.error(`[WebPluginRegistry] Error in onConfigChange for ${reg.plugin.manifest.id}:`, err);
          }
        }
      }
    }

    pluginEventBus.emit('config:changed', { config });
  }

  /**
   * Emit message event to plugins.
   */
  emitMessage(message: string, role: 'user' | 'assistant'): void {
    for (const reg of this.plugins.values()) {
      if (reg.enabled && reg.plugin.onMessage) {
        if (reg.plugin.manifest.permissions.includes('conversation:read')) {
          try {
            reg.plugin.onMessage(message, role);
          } catch (err) {
            console.error(`[WebPluginRegistry] Error in onMessage for ${reg.plugin.manifest.id}:`, err);
          }
        }
      }
    }
  }

  /**
   * Subscribe to registry changes.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private checkCapabilitySupport(plugin: WebPlugin): void {
    const caps = plugin.manifest.capabilities;

    if (caps.includes('webcam') && !navigator.mediaDevices?.getUserMedia) {
      console.warn(`Plugin ${plugin.manifest.id} requires webcam, but getUserMedia is not available`);
    }

    if (caps.includes('speaker') && !window.speechSynthesis) {
      console.warn(`Plugin ${plugin.manifest.id} requires TTS, but speechSynthesis is not available`);
    }

    if (caps.includes('microphone')) {
      const SR = (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition || (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      if (!SR) {
        console.warn(`Plugin ${plugin.manifest.id} requires STT, but SpeechRecognition is not available`);
      }
    }
  }
}

/**
 * Global web plugin registry instance.
 */
export const webPluginRegistry = new WebPluginRegistry();

/**
 * Register a web plugin.
 * Shorthand for webPluginRegistry.register().
 */
export function registerWebPlugin(plugin: WebPlugin): void {
  webPluginRegistry.register(plugin);
}
