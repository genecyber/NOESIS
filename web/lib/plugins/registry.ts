/**
 * METAMORPH Plugin Registry
 *
 * Central registry for web plugins. Handles:
 * - Plugin registration and lifecycle
 * - Capability provisioning
 * - Panel collection for UI
 * - Event distribution
 */

import type {
  WebPlugin,
  PluginRegistration,
  PluginRegistry,
  PanelDefinition,
  PlatformCapabilities,
  PluginCapability,
  PluginCommand,
  PluginCommandContext,
} from './types';
import { createPlatformCapabilities } from './capabilities';
import type { EmotionContext, Stance, ModeConfig } from '@/lib/types';
import {
  registerPluginCommands,
  unregisterPluginCommands,
  type Command,
  type CommandCategory,
} from '@/lib/commands';

// =============================================================================
// Plugin Command Conversion
// =============================================================================

/**
 * Convert a PluginCommand to the web Command format
 * Creates a wrapper that executes the plugin command with proper context
 */
function convertPluginCommand(
  pluginId: string,
  pluginCommand: PluginCommand,
  getContext: () => PluginCommandContext
): Command {
  return {
    name: pluginCommand.name,
    aliases: pluginCommand.aliases || [],
    description: pluginCommand.description,
    category: 'identity' as CommandCategory, // Plugin commands go in identity category
    inlineOutput: true,
    // Store execution context for command handler
    args: pluginCommand.usage ? [{
      name: 'args',
      required: false,
      description: pluginCommand.usage,
    }] : undefined,
    // Add plugin metadata for execution
    _pluginId: pluginId,
    _pluginCommand: pluginCommand,
    _getContext: getContext,
  } as Command & {
    _pluginId: string;
    _pluginCommand: PluginCommand;
    _getContext: () => PluginCommandContext;
  };
}

/**
 * Execute a plugin command
 * This is called by the command handler in the UI
 */
export async function executePluginCommand(
  command: Command & { _pluginCommand?: PluginCommand; _getContext?: () => PluginCommandContext },
  args: string[]
): Promise<{ success: boolean; message?: string; data?: unknown }> {
  if (!command._pluginCommand || !command._getContext) {
    return { success: false, message: 'Not a plugin command' };
  }

  try {
    const context = command._getContext();
    const result = await command._pluginCommand.execute(args, context);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PluginRegistry] Error executing plugin command:`, error);
    return { success: false, message: `Command failed: ${errorMessage}` };
  }
}

/**
 * Check if a command is a plugin command
 */
export function isPluginCommand(command: Command): command is Command & { _pluginId: string; _pluginCommand: PluginCommand } {
  return '_pluginCommand' in command && '_pluginId' in command;
}

// =============================================================================
// Plugin Registry Implementation
// =============================================================================

class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();
  private sessionId?: string;

  setSessionId(sessionId: string | undefined): void {
    this.sessionId = sessionId;
    // Update vision capabilities with new session ID
    this.plugins.forEach((registration, pluginId) => {
      if (registration.enabled) {
        registration.capabilities = createPlatformCapabilities(pluginId, sessionId);
      }
    });
  }

  register(plugin: WebPlugin): void {
    const { id } = plugin.manifest;

    if (this.plugins.has(id)) {
      console.warn(`Plugin "${id}" is already registered. Skipping.`);
      return;
    }

    // Check browser capability support
    const unsupported = this.checkCapabilities(plugin.manifest.capabilities);
    if (unsupported.length > 0) {
      console.warn(`Plugin "${id}" requires unsupported capabilities: ${unsupported.join(', ')}`);
    }

    const registration: PluginRegistration = {
      plugin,
      enabled: false,
      capabilities: createPlatformCapabilities(id, this.sessionId),
    };

    this.plugins.set(id, registration);
    console.log(`[PluginRegistry] Registered plugin: ${id}`);
  }

  unregister(pluginId: string): void {
    const registration = this.plugins.get(pluginId);
    if (registration) {
      if (registration.enabled) {
        this.disable(pluginId);
      }
      this.plugins.delete(pluginId);
      console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
    }
  }

  async enable(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (registration.enabled) {
      return;
    }

    // Create fresh capabilities
    registration.capabilities = createPlatformCapabilities(pluginId, this.sessionId);

    // Call activation hook
    if (registration.plugin.onActivate) {
      await registration.plugin.onActivate(registration.capabilities);
    }

    // Register plugin commands with the web command system
    if (registration.plugin.commands && registration.plugin.commands.length > 0) {
      const webCommands = registration.plugin.commands.map((cmd) =>
        convertPluginCommand(pluginId, cmd, () => ({
          sessionId: this.sessionId,
          capabilities: registration.capabilities,
        }))
      );
      registerPluginCommands(pluginId, webCommands);
    }

    registration.enabled = true;
    console.log(`[PluginRegistry] Enabled plugin: ${pluginId}`);
  }

  async disable(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration || !registration.enabled) {
      return;
    }

    // Unregister plugin commands from the web command system
    if (registration.plugin.commands && registration.plugin.commands.length > 0) {
      unregisterPluginCommands(pluginId);
    }

    // Call deactivation hook
    if (registration.plugin.onDeactivate) {
      await registration.plugin.onDeactivate();
    }

    // Cleanup capabilities
    registration.capabilities.webcam.stop();
    registration.capabilities.stt.stop();
    registration.capabilities.tts.stop();

    registration.enabled = false;
    console.log(`[PluginRegistry] Disabled plugin: ${pluginId}`);
  }

  getPlugin(pluginId: string): PluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  getPanels(): PanelDefinition[] {
    const panels: PanelDefinition[] = [];

    this.plugins.forEach((registration) => {
      if (registration.enabled && registration.plugin.panel) {
        panels.push(registration.plugin.panel);
      }
    });

    // Sort by order (lower first), then by id
    return panels.sort((a, b) => {
      const orderA = a.order ?? 100;
      const orderB = b.order ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
  }

  // =========================================================================
  // Event Distribution
  // =========================================================================

  emitEmotionDetected(emotion: EmotionContext): void {
    this.plugins.forEach((registration) => {
      if (registration.enabled && registration.plugin.onEmotionDetected) {
        try {
          registration.plugin.onEmotionDetected(emotion);
        } catch (error) {
          console.error(`[PluginRegistry] Error in onEmotionDetected for ${registration.plugin.manifest.id}:`, error);
        }
      }
    });
  }

  emitStanceChange(stance: Stance): void {
    this.plugins.forEach((registration) => {
      if (registration.enabled && registration.plugin.onStanceChange) {
        try {
          registration.plugin.onStanceChange(stance);
        } catch (error) {
          console.error(`[PluginRegistry] Error in onStanceChange for ${registration.plugin.manifest.id}:`, error);
        }
      }
    });
  }

  emitConfigChange(config: ModeConfig): void {
    this.plugins.forEach((registration) => {
      if (registration.enabled && registration.plugin.onConfigChange) {
        try {
          registration.plugin.onConfigChange(config);
        } catch (error) {
          console.error(`[PluginRegistry] Error in onConfigChange for ${registration.plugin.manifest.id}:`, error);
        }
      }
    });
  }

  emitMessage(message: string, role: 'user' | 'assistant'): void {
    this.plugins.forEach((registration) => {
      if (registration.enabled && registration.plugin.onMessage) {
        try {
          registration.plugin.onMessage(message, role);
        } catch (error) {
          console.error(`[PluginRegistry] Error in onMessage for ${registration.plugin.manifest.id}:`, error);
        }
      }
    });
  }

  // =========================================================================
  // Capability Checking
  // =========================================================================

  private checkCapabilities(required: PluginCapability[]): PluginCapability[] {
    if (typeof window === 'undefined') {
      return required; // SSR - can't check
    }

    const unsupported: PluginCapability[] = [];

    required.forEach((cap) => {
      switch (cap) {
        case 'webcam':
          if (!navigator.mediaDevices?.getUserMedia) {
            unsupported.push(cap);
          }
          break;
        case 'microphone':
          if (!navigator.mediaDevices?.getUserMedia) {
            unsupported.push(cap);
          }
          break;
        case 'speaker':
          if (!window.speechSynthesis) {
            unsupported.push(cap);
          }
          break;
        case 'storage':
          if (!window.localStorage) {
            unsupported.push(cap);
          }
          break;
        case 'notifications':
          if (!('Notification' in window)) {
            unsupported.push(cap);
          }
          break;
        case 'fullscreen':
          if (!document.documentElement.requestFullscreen) {
            unsupported.push(cap);
          }
          break;
        // vision capability is always available (backend)
      }
    });

    return unsupported;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const pluginRegistry = new PluginRegistryImpl();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Register a plugin with the global registry
 */
export function registerPlugin(plugin: WebPlugin): void {
  pluginRegistry.register(plugin);
}

/**
 * Create a plugin definition helper
 */
export function definePlugin(config: WebPlugin): WebPlugin {
  return config;
}

/**
 * Get all enabled panels from registered plugins
 */
export function getPluginPanels(): PanelDefinition[] {
  return pluginRegistry.getPanels();
}
