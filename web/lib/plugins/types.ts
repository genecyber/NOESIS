/**
 * METAMORPH Web Plugin SDK - Type Definitions
 *
 * Core types for building web plugins that integrate with the METAMORPH platform.
 */

import type { ReactElement, ComponentType } from 'react';
import type { Stance, ModeConfig, EmotionContext } from '@/lib/types';

// =============================================================================
// Plugin Manifest
// =============================================================================

export interface WebPluginManifest {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Short description */
  description: string;
  /** Author name or organization */
  author?: string;
  /** License type */
  license?: string;
  /** Repository URL */
  repository?: string;
  /** Minimum METAMORPH version required */
  metamorphVersion?: string;
  /** Required platform capabilities */
  capabilities: PluginCapability[];
  /** Required permissions */
  permissions: PluginPermission[];
}

// =============================================================================
// Plugin Capabilities
// =============================================================================

/** Platform capabilities a plugin can request */
export type PluginCapability =
  | 'webcam'        // Access to camera stream
  | 'microphone'    // Access to audio input (STT)
  | 'speaker'       // Access to audio output (TTS)
  | 'vision'        // Backend AI image analysis
  | 'storage'       // Plugin-specific localStorage
  | 'notifications' // Browser notifications
  | 'fullscreen';   // Fullscreen API

/** Permissions for data access */
export type PluginPermission =
  | 'stance:read'
  | 'stance:write'
  | 'config:read'
  | 'config:write'
  | 'session:read'
  | 'memory:read'
  | 'memory:write'
  | 'emotion:read'
  | 'emotion:write';

// =============================================================================
// Platform Capabilities Interfaces
// =============================================================================

/** Webcam capability interface */
export interface WebcamCapability {
  /** Start webcam stream */
  start(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  /** Stop webcam stream */
  stop(): void;
  /** Capture current frame as data URL */
  captureFrame(format?: 'jpeg' | 'png', quality?: number): Promise<string | null>;
  /** Get available devices */
  getDevices(): Promise<MediaDeviceInfo[]>;
  /** Current stream (if active) */
  stream: MediaStream | null;
  /** Whether webcam is active */
  isActive: boolean;
}

/** Text-to-Speech capability interface */
export interface TTSCapability {
  /** Speak text */
  speak(text: string, options?: TTSOptions): Promise<void>;
  /** Stop current speech */
  stop(): void;
  /** Pause speech */
  pause(): void;
  /** Resume speech */
  resume(): void;
  /** Get available voices */
  getVoices(): SpeechSynthesisVoice[];
  /** Whether currently speaking */
  isSpeaking: boolean;
}

export interface TTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;      // 0.1 to 10, default 1
  pitch?: number;     // 0 to 2, default 1
  volume?: number;    // 0 to 1, default 1
  lang?: string;
}

/** Speech-to-Text capability interface */
export interface STTCapability {
  /** Start listening */
  start(options?: STTOptions): void;
  /** Stop listening */
  stop(): void;
  /** Whether currently listening */
  isListening: boolean;
  /** Event callbacks */
  onResult: ((transcript: string, isFinal: boolean) => void) | null;
  onError: ((error: Error) => void) | null;
}

export interface STTOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

/** Vision API capability interface */
export interface VisionCapability {
  /** Analyze image for emotions using Claude Vision */
  analyzeEmotion(imageDataUrl: string): Promise<EmotionContext>;
  /** General image analysis with custom prompt */
  analyzeImage(imageDataUrl: string, prompt: string): Promise<string>;
  /** Rate limit status */
  canAnalyze: boolean;
  /** Seconds until next analysis allowed */
  cooldownRemaining: number;
}

/** Plugin storage capability interface */
export interface StorageCapability {
  /** Get value */
  get<T>(key: string): T | null;
  /** Set value */
  set<T>(key: string, value: T): void;
  /** Remove value */
  remove(key: string): void;
  /** Get all keys */
  keys(): string[];
  /** Clear all plugin data */
  clear(): void;
}

/** Memory entry structure */
export interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Memory search options */
export interface MemorySearchOptions {
  type?: 'episodic' | 'semantic' | 'identity';
  minImportance?: number;
  limit?: number;
  query?: string;
}

/** Memory capability interface - access to METAMORPH memory system */
export interface MemoryCapability {
  /** Get all memories (optionally filtered by type) */
  getMemories(options?: MemorySearchOptions): Promise<Memory[]>;
  /** Add a new memory */
  addMemory(memory: Omit<Memory, 'id' | 'timestamp'>): Promise<Memory>;
  /** Delete a memory by ID */
  deleteMemory(id: string): Promise<boolean>;
  /** Search memories by content similarity */
  searchMemories(query: string, options?: Omit<MemorySearchOptions, 'query'>): Promise<Memory[]>;
}

// =============================================================================
// Plugin Commands
// =============================================================================

/** Result of a plugin command execution */
export interface PluginCommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/** Command context passed to plugin command handlers */
export interface PluginCommandContext {
  sessionId?: string;
  capabilities: PlatformCapabilities;
}

/** Plugin command definition */
export interface PluginCommand {
  /** Command name (without slash) */
  name: string;
  /** Alternative names */
  aliases?: string[];
  /** Human-readable description */
  description: string;
  /** Usage examples */
  usage?: string;
  /** Whether agents can invoke this command */
  agentInvocable: boolean;
  /** Execute the command */
  execute: (args: string[], context: PluginCommandContext) => Promise<PluginCommandResult> | PluginCommandResult;
}

// =============================================================================
// Panel Plugin
// =============================================================================

/** Props passed to panel components */
export interface PanelProps {
  /** Current session ID */
  sessionId?: string;
  /** Current stance */
  stance: Stance | null;
  /** Current config */
  config: ModeConfig | null;
  /** Current emotion context */
  emotionContext: EmotionContext | null;
  /** Platform capabilities */
  capabilities: PlatformCapabilities;
  /** Update callbacks */
  onStanceUpdate?: (stance: Stance) => void;
  onConfigUpdate?: (config: Partial<ModeConfig>) => void;
  onEmotionUpdate?: (emotion: EmotionContext) => void;
}

/** Panel definition for registration */
export interface PanelDefinition {
  /** Unique panel ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: ComponentType<{ className?: string }>;
  /** Panel component */
  component: ComponentType<PanelProps>;
  /** Optional: order in tab list (lower = first) */
  order?: number;
  /** Optional: whether panel is enabled by default */
  defaultEnabled?: boolean;
}

// =============================================================================
// Plugin Definition
// =============================================================================

/** Full plugin definition */
export interface WebPlugin {
  /** Plugin manifest */
  manifest: WebPluginManifest;
  /** Panel definition (if plugin provides a panel) */
  panel?: PanelDefinition;
  /** Commands provided by this plugin */
  commands?: PluginCommand[];
  /** Lifecycle hooks */
  onActivate?: (capabilities: PlatformCapabilities) => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
  /** Event handlers */
  onEmotionDetected?: (emotion: EmotionContext) => void;
  onStanceChange?: (stance: Stance) => void;
  onConfigChange?: (config: ModeConfig) => void;
  onMessage?: (message: string, role: 'user' | 'assistant') => void;
}

/** All platform capabilities bundled */
export interface PlatformCapabilities {
  webcam: WebcamCapability;
  tts: TTSCapability;
  stt: STTCapability;
  vision: VisionCapability;
  storage: StorageCapability;
  memory: MemoryCapability;
}

// =============================================================================
// Registry Types
// =============================================================================

export interface PluginRegistration {
  plugin: WebPlugin;
  enabled: boolean;
  capabilities: PlatformCapabilities;
}

export interface PluginRegistry {
  register(plugin: WebPlugin): void;
  unregister(pluginId: string): void;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  getPlugin(pluginId: string): PluginRegistration | undefined;
  getAllPlugins(): PluginRegistration[];
  getPanels(): PanelDefinition[];
}
