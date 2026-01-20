/**
 * METAMORPH Platform Capabilities
 *
 * Implementations of platform capabilities that plugins can use:
 * - Webcam: Camera access and frame capture
 * - TTS: Text-to-speech synthesis
 * - STT: Speech-to-text recognition
 * - Vision: AI image analysis
 * - Storage: Plugin-specific localStorage
 */

import type {
  WebcamCapability,
  TTSCapability,
  STTCapability,
  VisionCapability,
  StorageCapability,
  MemoryCapability,
  Memory,
  MemorySearchOptions,
  PlatformCapabilities,
  TTSOptions,
  STTOptions,
} from './types';
import type { EmotionContext } from '@/lib/types';
import { analyzeVisionEmotion, getMemories as getMemoriesFromAPI } from '@/lib/api';
import {
  getMemoriesFromStorage,
  addMemoryToStorage,
  deleteMemoryFromStorage,
  searchMemoriesInStorage,
  type StoredMemory,
} from '@/lib/storage';

// =============================================================================
// Webcam Capability
// =============================================================================

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
// TTS Capability (Browser Speech Synthesis)
// =============================================================================

export function createTTSCapability(): TTSCapability {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

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
          currentUtterance = null;
          resolve();
        };

        utterance.onerror = (event) => {
          capability.isSpeaking = false;
          currentUtterance = null;
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        currentUtterance = utterance;
        synth.speak(utterance);
      });
    },

    stop(): void {
      if (synth) {
        synth.cancel();
        capability.isSpeaking = false;
        currentUtterance = null;
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
// STT Capability (Browser Speech Recognition)
// =============================================================================

export function createSTTCapability(): STTCapability {
  // Use vendor-prefixed SpeechRecognition (browser API)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognition: any =
    typeof window !== 'undefined'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null;

  const capability: STTCapability = {
    isListening: false,
    onResult: null,
    onError: null,

    start(options?: STTOptions): void {
      if (!SpeechRecognition) {
        console.warn('Speech recognition not available');
        capability.onError?.(new Error('Speech recognition not supported'));
        return;
      }

      if (recognition) {
        recognition.stop();
      }

      recognition = new SpeechRecognition();
      recognition.continuous = options?.continuous ?? false;
      recognition.interimResults = options?.interimResults ?? true;
      recognition.lang = options?.lang ?? 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        capability.onResult?.(transcript, isFinal);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
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
// Vision Capability (Claude Vision API)
// =============================================================================

export function createVisionCapability(sessionId?: string): VisionCapability {
  let lastAnalysisTime = 0;
  const COOLDOWN_MS = 60000; // 60 second cooldown

  const capability: VisionCapability = {
    canAnalyze: true,
    cooldownRemaining: 0,

    async analyzeEmotion(imageDataUrl: string): Promise<EmotionContext> {
      const now = Date.now();
      const elapsed = now - lastAnalysisTime;

      if (elapsed < COOLDOWN_MS) {
        throw new Error(`Rate limited. Wait ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)} seconds.`);
      }

      if (!sessionId) {
        throw new Error('Session ID required for vision analysis');
      }

      lastAnalysisTime = now;
      capability.canAnalyze = false;

      // Start cooldown timer
      const updateCooldown = () => {
        const remaining = COOLDOWN_MS - (Date.now() - lastAnalysisTime);
        capability.cooldownRemaining = Math.max(0, Math.ceil(remaining / 1000));
        capability.canAnalyze = remaining <= 0;
        if (remaining > 0) {
          setTimeout(updateCooldown, 1000);
        }
      };
      updateCooldown();

      const result = await analyzeVisionEmotion(sessionId, imageDataUrl);
      return result.emotionContext;
    },

    async analyzeImage(imageDataUrl: string, prompt: string): Promise<string> {
      // This would call a general-purpose vision endpoint
      // For now, we'll use the emotion endpoint as a fallback
      const emotion = await capability.analyzeEmotion(imageDataUrl);
      return emotion.promptContext || `Detected emotion: ${emotion.currentEmotion}`;
    },
  };

  return capability;
}

// =============================================================================
// Storage Capability (Plugin-scoped localStorage)
// =============================================================================

export function createStorageCapability(pluginId: string): StorageCapability {
  const prefix = `metamorph:plugin:${pluginId}:`;

  const capability: StorageCapability = {
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

    set<T>(key: string, value: T): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
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

  return capability;
}

// =============================================================================
// Memory Capability (METAMORPH Memory System)
// =============================================================================

export function createMemoryCapability(sessionId?: string): MemoryCapability {
  const capability: MemoryCapability = {
    async getMemories(options?: MemorySearchOptions): Promise<Memory[]> {
      if (!sessionId) {
        console.warn('[MemoryCapability] No session ID, returning empty');
        return [];
      }

      try {
        // Try server API first (has semantic search)
        const result = await getMemoriesFromAPI(sessionId, options?.type, options?.limit);
        return result.memories.map(m => ({
          id: m.id,
          type: m.type,
          content: m.content,
          importance: m.importance,
          timestamp: new Date(m.timestamp).getTime(),
        }));
      } catch {
        // Fall back to local storage
        console.log('[MemoryCapability] Falling back to local storage');
        const localMemories = searchMemoriesInStorage(sessionId, {
          type: options?.type,
          minImportance: options?.minImportance,
          limit: options?.limit,
        });
        return localMemories;
      }
    },

    async addMemory(memory: Omit<Memory, 'id' | 'timestamp'>): Promise<Memory> {
      if (!sessionId) {
        throw new Error('Session ID required to add memory');
      }

      const newMemory: StoredMemory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        timestamp: Date.now(),
        metadata: memory.metadata,
      };

      // Add to local storage (syncs to server via PWA sync)
      addMemoryToStorage(sessionId, newMemory);

      return newMemory;
    },

    async deleteMemory(id: string): Promise<boolean> {
      if (!sessionId) {
        throw new Error('Session ID required to delete memory');
      }

      return deleteMemoryFromStorage(sessionId, id);
    },

    async searchMemories(query: string, options?: Omit<MemorySearchOptions, 'query'>): Promise<Memory[]> {
      if (!sessionId) {
        return [];
      }

      // For now, do simple client-side content matching
      // TODO: Add server-side semantic search endpoint
      const allMemories = await capability.getMemories(options);
      const queryLower = query.toLowerCase();

      return allMemories.filter(m =>
        m.content.toLowerCase().includes(queryLower)
      );
    },
  };

  return capability;
}

// =============================================================================
// Create All Capabilities
// =============================================================================

export function createPlatformCapabilities(
  pluginId: string,
  sessionId?: string
): PlatformCapabilities {
  return {
    webcam: createWebcamCapability(),
    tts: createTTSCapability(),
    stt: createSTTCapability(),
    vision: createVisionCapability(sessionId),
    storage: createStorageCapability(pluginId),
    memory: createMemoryCapability(sessionId),
  };
}
