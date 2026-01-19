/**
 * METAMORPH Plugin SDK - Web Capabilities
 *
 * Browser-specific platform capabilities for plugins.
 */

import type { PluginStorage } from '../core/types.js';

// =============================================================================
// Browser Speech Recognition Types (Vendor-prefixed support)
// =============================================================================

// Define speech recognition types for browsers with vendor prefixes
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionLike;
}

// Extended window interface for vendor-prefixed speech recognition
interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

// =============================================================================
// Webcam Capability
// =============================================================================

export interface WebcamCapability {
  /** Current media stream (null if not started) */
  stream: MediaStream | null;
  /** Whether the webcam is currently active */
  isActive: boolean;
  /** Start the webcam with optional constraints */
  start(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  /** Stop the webcam */
  stop(): void;
  /** Capture a frame as a data URL */
  captureFrame(format?: 'jpeg' | 'png', quality?: number): Promise<string | null>;
  /** Get available video input devices */
  getDevices(): Promise<MediaDeviceInfo[]>;
}

export function createWebcamCapability(): WebcamCapability {
  let stream: MediaStream | null = null;
  let videoElement: HTMLVideoElement | null = null;

  const capability: WebcamCapability = {
    stream: null,
    isActive: false,

    async start(constraints?: MediaStreamConstraints): Promise<MediaStream> {
      if (stream) {
        return stream;
      }

      const defaultConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      };

      stream = await navigator.mediaDevices.getUserMedia(
        constraints || defaultConstraints
      );

      // Create hidden video element for frame capture
      videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      await videoElement.play();

      capability.stream = stream;
      capability.isActive = true;

      return stream;
    },

    stop(): void {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        capability.stream = null;
        capability.isActive = false;
      }
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement = null;
      }
    },

    async captureFrame(
      format: 'jpeg' | 'png' = 'jpeg',
      quality: number = 0.8
    ): Promise<string | null> {
      if (!videoElement || !stream) {
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(videoElement, 0, 0);

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      return canvas.toDataURL(mimeType, quality);
    },

    async getDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    },
  };

  return capability;
}

// =============================================================================
// TTS Capability (Text-to-Speech)
// =============================================================================

export interface TTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export interface TTSCapability {
  /** Whether speech is currently in progress */
  isSpeaking: boolean;
  /** Speak text with optional options */
  speak(text: string, options?: TTSOptions): Promise<void>;
  /** Stop current speech */
  stop(): void;
  /** Pause current speech */
  pause(): void;
  /** Resume paused speech */
  resume(): void;
  /** Get available voices */
  getVoices(): SpeechSynthesisVoice[];
}

export function createTTSCapability(): TTSCapability {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  const capability: TTSCapability = {
    isSpeaking: false,

    async speak(text: string, options?: TTSOptions): Promise<void> {
      if (!synth) {
        console.warn('Speech synthesis not available');
        return;
      }

      // Cancel any ongoing speech
      synth.cancel();

      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);

        if (options?.voice) utterance.voice = options.voice;
        if (options?.rate !== undefined) utterance.rate = options.rate;
        if (options?.pitch !== undefined) utterance.pitch = options.pitch;
        if (options?.volume !== undefined) utterance.volume = options.volume;
        if (options?.lang) utterance.lang = options.lang;

        utterance.onstart = () => {
          capability.isSpeaking = true;
        };

        utterance.onend = () => {
          capability.isSpeaking = false;
          resolve();
        };

        utterance.onerror = (event) => {
          capability.isSpeaking = false;
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        synth.speak(utterance);
      });
    },

    stop(): void {
      if (synth) {
        synth.cancel();
        capability.isSpeaking = false;
      }
    },

    pause(): void {
      if (synth) {
        synth.pause();
      }
    },

    resume(): void {
      if (synth) {
        synth.resume();
      }
    },

    getVoices(): SpeechSynthesisVoice[] {
      if (!synth) return [];
      return synth.getVoices();
    },
  };

  return capability;
}

// =============================================================================
// STT Capability (Speech-to-Text)
// =============================================================================

export interface STTOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

export interface STTCapability {
  /** Whether recognition is currently active */
  isListening: boolean;
  /** Callback for recognition results */
  onResult: ((transcript: string, isFinal: boolean) => void) | null;
  /** Callback for recognition errors */
  onError: ((error: Error) => void) | null;
  /** Start recognition */
  start(options?: STTOptions): void;
  /** Stop recognition */
  stop(): void;
}

export function createSTTCapability(): STTCapability {
  // Use vendor-prefixed SpeechRecognition
  const windowWithSpeech = typeof window !== 'undefined' ? window as WindowWithSpeechRecognition : null;
  const SpeechRecognitionCtor = windowWithSpeech?.SpeechRecognition || windowWithSpeech?.webkitSpeechRecognition || null;

  let recognition: SpeechRecognitionLike | null = null;

  const capability: STTCapability = {
    isListening: false,
    onResult: null,
    onError: null,

    start(options?: STTOptions): void {
      if (!SpeechRecognitionCtor) {
        console.warn('Speech recognition not available');
        capability.onError?.(new Error('Speech recognition not supported'));
        return;
      }

      if (recognition) {
        recognition.stop();
      }

      recognition = new SpeechRecognitionCtor();
      recognition.continuous = options?.continuous ?? false;
      recognition.interimResults = options?.interimResults ?? true;
      recognition.lang = options?.lang ?? 'en-US';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        capability.onResult?.(transcript, isFinal);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        capability.onError?.(new Error(`Speech recognition error: ${event.error}`));
        capability.isListening = false;
      };

      recognition.onend = () => {
        capability.isListening = false;
      };

      recognition.start();
      capability.isListening = true;
    },

    stop(): void {
      if (recognition) {
        recognition.stop();
        recognition = null;
        capability.isListening = false;
      }
    },
  };

  return capability;
}

// =============================================================================
// Vision Capability (AI Image Analysis)
// =============================================================================

export interface VisionCapability {
  /** Whether analysis is available (not rate limited) */
  canAnalyze: boolean;
  /** Seconds until analysis is available again */
  cooldownRemaining: number;
  /** Analyze an image for emotions */
  analyzeEmotion(imageDataUrl: string): Promise<import('../core/types.js').EmotionContext>;
  /** Analyze an image with a custom prompt */
  analyzeImage(imageDataUrl: string, prompt: string): Promise<string>;
}

export interface VisionCapabilityOptions {
  /** Session ID for API calls */
  sessionId?: string;
  /** API endpoint for vision analysis */
  apiEndpoint?: string;
  /** Cooldown between requests in milliseconds */
  cooldownMs?: number;
}

export function createVisionCapability(options?: VisionCapabilityOptions): VisionCapability {
  const sessionId = options?.sessionId;
  const apiEndpoint = options?.apiEndpoint ?? '/api/chat/vision';
  const cooldownMs = options?.cooldownMs ?? 60000;

  let lastAnalysisTime = 0;

  const capability: VisionCapability = {
    canAnalyze: true,
    cooldownRemaining: 0,

    async analyzeEmotion(imageDataUrl: string) {
      const now = Date.now();
      const elapsed = now - lastAnalysisTime;

      if (elapsed < cooldownMs) {
        throw new Error(`Rate limited. Wait ${Math.ceil((cooldownMs - elapsed) / 1000)} seconds.`);
      }

      if (!sessionId) {
        throw new Error('Session ID required for vision analysis');
      }

      lastAnalysisTime = now;
      capability.canAnalyze = false;

      // Start cooldown timer
      const updateCooldown = () => {
        const remaining = cooldownMs - (Date.now() - lastAnalysisTime);
        capability.cooldownRemaining = Math.max(0, Math.ceil(remaining / 1000));
        capability.canAnalyze = remaining <= 0;
        if (remaining > 0) {
          setTimeout(updateCooldown, 1000);
        }
      };
      updateCooldown();

      // Call the API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, imageDataUrl }),
      });

      if (!response.ok) {
        throw new Error(`Vision API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.emotionContext;
    },

    async analyzeImage(imageDataUrl: string, _prompt: string) {
      // Use the emotion endpoint with custom prompt context
      // Note: _prompt parameter reserved for future custom prompt support
      const emotion = await capability.analyzeEmotion(imageDataUrl);
      return emotion.promptContext || `Detected emotion: ${emotion.currentEmotion}`;
    },
  };

  return capability;
}

// =============================================================================
// Storage Capability (Browser localStorage)
// =============================================================================

export function createBrowserStorage(pluginId: string): PluginStorage {
  const prefix = `metamorph:plugin:${pluginId}:`;

  return {
    get<T>(key: string): T | null {
      if (typeof window === 'undefined') return null;
      const value = localStorage.getItem(`${prefix}${key}`);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    },

    async getAsync<T>(key: string): Promise<T | null> {
      return this.get(key);
    },

    set<T>(key: string, value: T): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    },

    async setAsync<T>(key: string, value: T): Promise<void> {
      this.set(key, value);
    },

    remove(key: string): void {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(`${prefix}${key}`);
    },

    keys(): string[] {
      if (typeof window === 'undefined') return [];
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keys.push(key.slice(prefix.length));
        }
      }
      return keys;
    },

    clear(): void {
      if (typeof window === 'undefined') return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    },
  };
}

// =============================================================================
// Platform Capabilities Bundle
// =============================================================================

export interface WebPlatformCapabilities {
  webcam: WebcamCapability;
  tts: TTSCapability;
  stt: STTCapability;
  vision: VisionCapability;
  storage: PluginStorage;
}

export function createWebPlatformCapabilities(
  pluginId: string,
  options?: VisionCapabilityOptions
): WebPlatformCapabilities {
  return {
    webcam: createWebcamCapability(),
    tts: createTTSCapability(),
    stt: createSTTCapability(),
    vision: createVisionCapability(options),
    storage: createBrowserStorage(pluginId),
  };
}
