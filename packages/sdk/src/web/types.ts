/**
 * METAMORPH Plugin SDK - Web Types
 *
 * Browser-specific plugin types for web UI integration.
 */

import type { ComponentType } from 'react';
import type {
  PluginManifest,
  EmotionContext,
  Stance,
  ModeConfig,
} from '../core/types.js';
import type { BasePlugin, PluginContext } from '../core/plugin.js';
import type { WebPlatformCapabilities } from './capabilities.js';

// =============================================================================
// Panel Definition
// =============================================================================

/**
 * Panel component props provided by the platform.
 */
export interface PanelProps {
  /** Current session ID */
  sessionId?: string;
  /** Current mode configuration */
  config?: ModeConfig;
  /** Current emotion context */
  emotionContext?: EmotionContext;
  /** Current stance */
  stance?: Stance;
  /** Platform capabilities */
  capabilities: WebPlatformCapabilities;
  /** Callback when emotion is detected */
  onEmotionUpdate?(context: EmotionContext): void;
  /** Callback when stance changes */
  onStanceUpdate?(stance: Partial<Stance>): void;
  /** Callback when config changes */
  onConfigUpdate?(config: Partial<ModeConfig>): void;
}

/**
 * Panel definition for sidebar integration.
 */
export interface PanelDefinition {
  /** Panel identifier (used in tab navigation) */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Icon component for the tab */
  icon: ComponentType<{ className?: string }>;
  /** Panel content component */
  component: ComponentType<PanelProps>;
  /** Tab order (lower = earlier in list) */
  order?: number;
  /** Whether to enable by default */
  defaultEnabled?: boolean;
}

// =============================================================================
// Web Plugin Definition
// =============================================================================

/**
 * Web plugin context with browser capabilities.
 */
export interface WebPluginContext extends PluginContext {
  /** Browser platform capabilities */
  capabilities: WebPlatformCapabilities;
  /** Current session ID */
  sessionId?: string;
}

/**
 * Web plugin definition with optional panel.
 */
export interface WebPlugin extends BasePlugin<WebPluginContext> {
  /** Plugin manifest */
  manifest: PluginManifest;

  /** Optional sidebar panel */
  panel?: PanelDefinition;

  /**
   * Called when emotion is detected.
   * Only called if plugin has emotion:read permission.
   */
  onEmotionDetected?(emotion: EmotionContext): void;

  /**
   * Called when stance changes.
   * Only called if plugin has stance:read permission.
   */
  onStanceChange?(stance: Stance): void;

  /**
   * Called when configuration changes.
   * Only called if plugin has config:read permission.
   */
  onConfigChange?(config: ModeConfig): void;

  /**
   * Called when a message is sent or received.
   * Only called if plugin has conversation:read permission.
   */
  onMessage?(message: string, role: 'user' | 'assistant'): void;
}

// =============================================================================
// Plugin Definition Helper
// =============================================================================

/**
 * Type-safe plugin definition helper.
 *
 * @example
 * ```ts
 * const myPlugin = defineWebPlugin({
 *   manifest: {
 *     id: 'my-plugin',
 *     name: 'My Plugin',
 *     version: '1.0.0',
 *     description: 'Does something cool',
 *     capabilities: ['webcam'],
 *     permissions: ['emotion:read'],
 *   },
 *   panel: {
 *     id: 'my-panel',
 *     label: 'My Panel',
 *     icon: MyIcon,
 *     component: MyPanelComponent,
 *   },
 *   onActivate: (ctx) => {
 *     ctx.capabilities.webcam.start();
 *   },
 * });
 * ```
 */
export function defineWebPlugin(plugin: WebPlugin): WebPlugin {
  return plugin;
}
