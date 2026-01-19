/**
 * METAMORPH Plugin SDK - Core Types
 *
 * Platform-agnostic type definitions shared between web and CLI.
 */

// =============================================================================
// Plugin Manifest
// =============================================================================

/**
 * Plugin manifest defining metadata and requirements.
 */
export interface PluginManifest {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Brief description of what the plugin does */
  description: string;
  /** Plugin author */
  author?: string;
  /** License (e.g., "MIT") */
  license?: string;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** Search keywords */
  keywords?: string[];
  /** Minimum METAMORPH version required */
  metamorphVersion?: string;
  /** Required platform capabilities */
  capabilities: PluginCapability[];
  /** Required data permissions */
  permissions: PluginPermission[];
}

// =============================================================================
// Capabilities
// =============================================================================

/**
 * Platform capabilities that plugins can request.
 */
export type PluginCapability =
  | 'webcam'        // Camera access
  | 'microphone'    // Audio input
  | 'speaker'       // Audio output (TTS)
  | 'vision'        // AI image analysis
  | 'storage'       // Plugin-local storage
  | 'notifications' // System notifications
  | 'fullscreen';   // Fullscreen mode

/**
 * Check if a capability is browser-only.
 */
export function isBrowserCapability(cap: PluginCapability): boolean {
  return ['webcam', 'microphone', 'speaker', 'fullscreen'].includes(cap);
}

// =============================================================================
// Permissions
// =============================================================================

/**
 * Data access permissions that plugins can request.
 */
export type PluginPermission =
  // Stance (conversation state)
  | 'stance:read'
  | 'stance:write'
  // Memory
  | 'memory:read'
  | 'memory:write'
  // Configuration
  | 'config:read'
  | 'config:write'
  // Emotion context
  | 'emotion:read'
  | 'emotion:write'
  // Conversation
  | 'conversation:read'
  // File system (CLI only)
  | 'filesystem:read'
  | 'filesystem:write'
  // Network
  | 'network:fetch';

// =============================================================================
// Plugin Lifecycle
// =============================================================================

/**
 * Plugin lifecycle interface.
 */
export interface PluginLifecycle<TContext = unknown> {
  /**
   * Called when plugin is first loaded.
   * Use for one-time setup like loading models.
   */
  onLoad?(context: TContext): Promise<void> | void;

  /**
   * Called when plugin is activated (enabled).
   * Use for starting services, subscribing to events.
   */
  onActivate?(context: TContext): Promise<void> | void;

  /**
   * Called when plugin is deactivated (disabled).
   * Use for stopping services, unsubscribing from events.
   */
  onDeactivate?(): Promise<void> | void;

  /**
   * Called when plugin is being unloaded.
   * Use for final cleanup.
   */
  onUnload?(): Promise<void> | void;
}

// =============================================================================
// Plugin Events
// =============================================================================

/**
 * Event types that plugins can subscribe to.
 */
export type PluginEventType =
  // Turn events
  | 'turn:start'
  | 'turn:complete'
  // Stance events
  | 'stance:changed'
  // Config events
  | 'config:changed'
  | 'config:empathyMode'
  // Emotion events
  | 'emotion:detected'
  | 'emotion:vision_request'
  // Memory events
  | 'memory:added'
  // Operator events
  | 'operator:applied'
  // Camera events (web only)
  | 'camera:frame';

/**
 * Event handler function type.
 */
export type PluginEventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Event subscription interface.
 */
export interface PluginEventSubscription {
  /** Unsubscribe from the event */
  unsubscribe(): void;
}

// =============================================================================
// Plugin Storage
// =============================================================================

/**
 * Plugin-scoped storage interface.
 */
export interface PluginStorage {
  /**
   * Get a value from storage.
   */
  get<T>(key: string): T | null;

  /**
   * Get a value from storage (async).
   */
  getAsync<T>(key: string): Promise<T | null>;

  /**
   * Set a value in storage.
   */
  set<T>(key: string, value: T): void;

  /**
   * Set a value in storage (async).
   */
  setAsync<T>(key: string, value: T): Promise<void>;

  /**
   * Remove a value from storage.
   */
  remove(key: string): void;

  /**
   * List all keys in storage.
   */
  keys(): string[];

  /**
   * Clear all plugin storage.
   */
  clear(): void;
}

// =============================================================================
// Plugin Logger
// =============================================================================

/**
 * Plugin logging interface.
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// =============================================================================
// Emotion Context (Shared Data Type)
// =============================================================================

/**
 * Emotional state context detected from user.
 */
export interface EmotionContext {
  /** Primary detected emotion */
  currentEmotion: string;
  /** Emotional valence (-1 negative to +1 positive) */
  valence: number;
  /** Emotional arousal (0 calm to 1 excited) */
  arousal: number;
  /** Detection confidence (0 to 1) */
  confidence: number;
  /** Emotional stability over time (0 to 1) */
  stability?: number;
  /** Natural language context for prompts */
  promptContext?: string;
  /** Suggested empathy boost percentage */
  suggestedEmpathyBoost?: number;
  /** Detection timestamp */
  timestamp?: string;
}

// =============================================================================
// Stance (Shared Data Type)
// =============================================================================

/**
 * Conversation stance representing the agent's current state.
 */
export interface Stance {
  /** Current frame/perspective (e.g., "playful", "analytical") */
  frame: string;
  /** Self-model identity (e.g., "guide", "challenger") */
  selfModel: string;
  /** Current objective */
  objective: string;
  /** Value parameters */
  values: StanceValues;
  /** Emergent goals */
  emergentGoals?: string[];
}

/**
 * Stance value parameters (0-100 scale).
 */
export interface StanceValues {
  novelty: number;
  synthesis: number;
  risk: number;
  certainty: number;
  empathy: number;
  provocation: number;
  abstraction: number;
  [key: string]: number;
}

// =============================================================================
// Mode Configuration (Shared Data Type)
// =============================================================================

/**
 * Mode configuration for the agent.
 */
export interface ModeConfig {
  /** Transformation intensity (0-100) */
  intensity: number;
  /** Coherence floor (0-100) */
  coherenceFloor: number;
  /** Sentience level (0-100) */
  sentienceLevel: number;
  /** Model to use */
  model?: string;
  /** Enable empathy mode */
  enableEmpathyMode?: boolean;
  /** Maximum empathy boost */
  maxEmpathyBoost?: number;
  /** Additional configuration */
  [key: string]: unknown;
}
