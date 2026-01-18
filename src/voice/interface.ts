/**
 * Voice/Audio Interface (Ralph Iteration 8, Feature 1)
 *
 * Speech-to-text input, text-to-speech output with voice modulation,
 * emotion detection, voice commands, and audio memory entries.
 */

import type { Stance, Frame, Values } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface VoiceConfig {
  inputEnabled: boolean;
  outputEnabled: boolean;
  speechToText: SpeechToTextProvider;
  textToSpeech: TextToSpeechProvider;
  emotionDetection: boolean;
  voiceCommandsEnabled: boolean;
  sampleRate: number;
  language: string;
}

export type SpeechToTextProvider = 'whisper' | 'google' | 'azure' | 'local';
export type TextToSpeechProvider = 'elevenlabs' | 'google' | 'azure' | 'local';

export interface VoiceInput {
  id: string;
  audio: AudioData;
  transcript?: string;
  emotion?: EmotionAnalysis;
  confidence: number;
  duration: number;
  timestamp: Date;
}

export interface AudioData {
  format: 'wav' | 'mp3' | 'ogg' | 'webm';
  sampleRate: number;
  channels: number;
  data: Uint8Array | null;  // null for mock/placeholder
  duration: number;
}

export interface EmotionAnalysis {
  primary: EmotionType;
  confidence: number;
  valence: number;  // -1 to 1 (negative to positive)
  arousal: number;  // 0 to 1 (calm to excited)
  dominance: number;  // 0 to 1 (submissive to dominant)
  secondary?: EmotionType;
}

export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fearful'
  | 'surprised'
  | 'disgusted'
  | 'curious';

export interface VoiceOutput {
  id: string;
  text: string;
  audio?: AudioData;
  voiceProfile: VoiceProfile;
  timestamp: Date;
}

export interface VoiceProfile {
  id: string;
  name: string;
  baseVoice: string;
  pitch: number;      // 0.5 to 2.0
  speed: number;      // 0.5 to 2.0
  volume: number;     // 0 to 1
  emotionModulation: boolean;
}

export interface VoiceCommand {
  pattern: string;
  action: string;
  parameters?: Record<string, string>;
}

export interface AudioMemoryEntry {
  id: string;
  originalAudio: AudioData;
  transcript: string;
  emotion?: EmotionAnalysis;
  stanceAtCapture: Stance;
  importance: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  currentSession: string | null;
  inputQueue: VoiceInput[];
  outputQueue: VoiceOutput[];
  activeVoiceProfile: VoiceProfile;
}

export interface VoiceStats {
  totalInputs: number;
  totalOutputs: number;
  avgInputConfidence: number;
  emotionDistribution: Record<EmotionType, number>;
  commandsProcessed: number;
  audioMemoriesCreated: number;
}

// ============================================================================
// Emotion to Value Mapping
// ============================================================================

const EMOTION_VALUE_MAP: Record<EmotionType, Partial<Values>> = {
  neutral: {},
  happy: { empathy: 10, provocation: -5, novelty: 5 },
  sad: { empathy: 15, risk: -10, provocation: -10 },
  angry: { provocation: 20, risk: 10, empathy: -10 },
  fearful: { risk: -20, certainty: 15, curiosity: -5 },
  surprised: { curiosity: 15, novelty: 10, certainty: -5 },
  disgusted: { provocation: 10, empathy: -5 },
  curious: { curiosity: 20, novelty: 15, risk: 5 }
};

// ============================================================================
// Frame to Voice Modulation Mapping
// ============================================================================

const FRAME_VOICE_MODULATION: Record<Frame, Partial<VoiceProfile>> = {
  existential: { pitch: 0.9, speed: 0.85, volume: 0.7 },
  pragmatic: { pitch: 1.0, speed: 1.0, volume: 0.8 },
  poetic: { pitch: 1.1, speed: 0.8, volume: 0.75 },
  adversarial: { pitch: 0.95, speed: 1.1, volume: 0.9 },
  playful: { pitch: 1.15, speed: 1.1, volume: 0.85 },
  mythic: { pitch: 0.85, speed: 0.75, volume: 0.8 },
  systems: { pitch: 1.0, speed: 1.05, volume: 0.75 },
  psychoanalytic: { pitch: 0.95, speed: 0.9, volume: 0.7 },
  stoic: { pitch: 0.9, speed: 0.95, volume: 0.65 },
  absurdist: { pitch: 1.2, speed: 1.15, volume: 0.85 }
};

// ============================================================================
// Voice Interface
// ============================================================================

export class VoiceInterface {
  private config: VoiceConfig;
  private state: VoiceState;
  private stats: VoiceStats;
  private voiceCommands: Map<string, VoiceCommand> = new Map();
  private audioMemories: Map<string, AudioMemoryEntry> = new Map();
  private voiceProfiles: Map<string, VoiceProfile> = new Map();

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = {
      inputEnabled: true,
      outputEnabled: true,
      speechToText: 'whisper',
      textToSpeech: 'elevenlabs',
      emotionDetection: true,
      voiceCommandsEnabled: true,
      sampleRate: 16000,
      language: 'en-US',
      ...config
    };

    const defaultProfile: VoiceProfile = {
      id: 'default',
      name: 'Default Voice',
      baseVoice: 'neutral',
      pitch: 1.0,
      speed: 1.0,
      volume: 0.8,
      emotionModulation: true
    };

    this.voiceProfiles.set('default', defaultProfile);

    this.state = {
      isListening: false,
      isSpeaking: false,
      currentSession: null,
      inputQueue: [],
      outputQueue: [],
      activeVoiceProfile: defaultProfile
    };

    this.stats = {
      totalInputs: 0,
      totalOutputs: 0,
      avgInputConfidence: 0,
      emotionDistribution: {
        neutral: 0, happy: 0, sad: 0, angry: 0,
        fearful: 0, surprised: 0, disgusted: 0, curious: 0
      },
      commandsProcessed: 0,
      audioMemoriesCreated: 0
    };

    this.registerDefaultCommands();
  }

  /**
   * Register default voice commands
   */
  private registerDefaultCommands(): void {
    this.registerCommand({
      pattern: 'change frame to *',
      action: 'setFrame',
      parameters: { frame: '$1' }
    });

    this.registerCommand({
      pattern: 'apply operator *',
      action: 'applyOperator',
      parameters: { operator: '$1' }
    });

    this.registerCommand({
      pattern: 'save this as memory',
      action: 'saveMemory'
    });

    this.registerCommand({
      pattern: 'what is my current stance',
      action: 'reportStance'
    });

    this.registerCommand({
      pattern: 'stop listening',
      action: 'stopListening'
    });
  }

  /**
   * Start listening for voice input
   */
  startListening(sessionId: string): boolean {
    if (this.state.isListening) {
      return false;
    }

    this.state.isListening = true;
    this.state.currentSession = sessionId;

    // In a real implementation, this would start audio capture
    return true;
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.state.isListening = false;
    this.state.currentSession = null;
  }

  /**
   * Process voice input
   */
  async processInput(audio: AudioData): Promise<VoiceInput> {
    const input: VoiceInput = {
      id: `voice-in-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      audio,
      confidence: 0,
      duration: audio.duration,
      timestamp: new Date()
    };

    // Transcribe audio
    input.transcript = await this.transcribe(audio);
    input.confidence = 0.85;  // Mock confidence

    // Detect emotion if enabled
    if (this.config.emotionDetection) {
      input.emotion = await this.detectEmotion(audio);
    }

    // Update stats
    this.stats.totalInputs++;
    this.updateAvgConfidence(input.confidence);
    if (input.emotion) {
      this.stats.emotionDistribution[input.emotion.primary]++;
    }

    // Add to queue
    this.state.inputQueue.push(input);

    // Check for voice commands
    if (this.config.voiceCommandsEnabled && input.transcript) {
      await this.checkForCommand(input.transcript);
    }

    return input;
  }

  /**
   * Transcribe audio to text (mock implementation)
   */
  private async transcribe(_audio: AudioData): Promise<string> {
    // In a real implementation, this would call the STT provider
    // For now, return placeholder
    return '[Transcribed audio]';
  }

  /**
   * Detect emotion from audio (mock implementation)
   */
  private async detectEmotion(_audio: AudioData): Promise<EmotionAnalysis> {
    // In a real implementation, this would analyze audio features
    // For now, return neutral emotion
    return {
      primary: 'neutral',
      confidence: 0.75,
      valence: 0,
      arousal: 0.5,
      dominance: 0.5
    };
  }

  /**
   * Check input for voice commands
   */
  private async checkForCommand(transcript: string): Promise<boolean> {
    const lowerTranscript = transcript.toLowerCase().trim();

    for (const [_pattern, command] of this.voiceCommands) {
      const regex = new RegExp(
        '^' + command.pattern.replace(/\*/g, '(.+)') + '$',
        'i'
      );
      const match = lowerTranscript.match(regex);

      if (match) {
        this.stats.commandsProcessed++;
        // In a real implementation, execute the command
        return true;
      }
    }

    return false;
  }

  /**
   * Generate voice output
   */
  async generateOutput(text: string, stance: Stance): Promise<VoiceOutput> {
    // Get voice modulation based on frame
    const frameModulation = FRAME_VOICE_MODULATION[stance.frame];

    // Create modulated voice profile
    const modulatedProfile: VoiceProfile = {
      ...this.state.activeVoiceProfile,
      pitch: (this.state.activeVoiceProfile.pitch + (frameModulation.pitch || 1)) / 2,
      speed: (this.state.activeVoiceProfile.speed + (frameModulation.speed || 1)) / 2,
      volume: (this.state.activeVoiceProfile.volume + (frameModulation.volume || 0.8)) / 2
    };

    const output: VoiceOutput = {
      id: `voice-out-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      voiceProfile: modulatedProfile,
      timestamp: new Date()
    };

    // Generate audio
    if (this.config.outputEnabled) {
      output.audio = await this.synthesize(text, modulatedProfile);
    }

    // Update stats
    this.stats.totalOutputs++;

    // Add to queue
    this.state.outputQueue.push(output);

    return output;
  }

  /**
   * Synthesize text to speech (mock implementation)
   */
  private async synthesize(_text: string, _profile: VoiceProfile): Promise<AudioData> {
    // In a real implementation, this would call the TTS provider
    return {
      format: 'wav',
      sampleRate: this.config.sampleRate,
      channels: 1,
      data: null,
      duration: 0
    };
  }

  /**
   * Map detected emotion to value adjustments
   */
  mapEmotionToValues(emotion: EmotionAnalysis): Partial<Values> {
    const baseAdjustments = EMOTION_VALUE_MAP[emotion.primary] || {};
    const scaledAdjustments: Partial<Values> = {};

    // Scale adjustments by confidence
    for (const [key, value] of Object.entries(baseAdjustments)) {
      scaledAdjustments[key as keyof Values] = Math.round(value * emotion.confidence);
    }

    // Add secondary emotion influence if present
    if (emotion.secondary) {
      const secondaryAdjustments = EMOTION_VALUE_MAP[emotion.secondary] || {};
      for (const [key, value] of Object.entries(secondaryAdjustments)) {
        const k = key as keyof Values;
        scaledAdjustments[k] = (scaledAdjustments[k] || 0) + Math.round(value * 0.3);
      }
    }

    return scaledAdjustments;
  }

  /**
   * Register a voice command
   */
  registerCommand(command: VoiceCommand): void {
    this.voiceCommands.set(command.pattern, command);
  }

  /**
   * Unregister a voice command
   */
  unregisterCommand(pattern: string): boolean {
    return this.voiceCommands.delete(pattern);
  }

  /**
   * Create audio memory entry
   */
  createAudioMemory(
    input: VoiceInput,
    stance: Stance,
    importance: number = 0.5
  ): AudioMemoryEntry {
    const entry: AudioMemoryEntry = {
      id: `audio-mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalAudio: input.audio,
      transcript: input.transcript || '',
      emotion: input.emotion,
      stanceAtCapture: { ...stance },
      importance,
      timestamp: new Date(),
      metadata: {}
    };

    this.audioMemories.set(entry.id, entry);
    this.stats.audioMemoriesCreated++;

    return entry;
  }

  /**
   * Search audio memories
   */
  searchAudioMemories(query: string, limit: number = 10): AudioMemoryEntry[] {
    const results: AudioMemoryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.audioMemories.values()) {
      if (entry.transcript.toLowerCase().includes(lowerQuery)) {
        results.push(entry);
      }
    }

    return results
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Create a new voice profile
   */
  createVoiceProfile(profile: Omit<VoiceProfile, 'id'>): VoiceProfile {
    const fullProfile: VoiceProfile = {
      ...profile,
      id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.voiceProfiles.set(fullProfile.id, fullProfile);
    return fullProfile;
  }

  /**
   * Set active voice profile
   */
  setActiveProfile(profileId: string): boolean {
    const profile = this.voiceProfiles.get(profileId);
    if (!profile) return false;

    this.state.activeVoiceProfile = profile;
    return true;
  }

  /**
   * Update average confidence
   */
  private updateAvgConfidence(newConfidence: number): void {
    const oldTotal = this.stats.avgInputConfidence * (this.stats.totalInputs - 1);
    this.stats.avgInputConfidence = (oldTotal + newConfidence) / this.stats.totalInputs;
  }

  /**
   * Get current state
   */
  getState(): VoiceState {
    return { ...this.state };
  }

  /**
   * Get statistics
   */
  getStats(): VoiceStats {
    return { ...this.stats };
  }

  /**
   * Get voice profiles
   */
  getVoiceProfiles(): VoiceProfile[] {
    return [...this.voiceProfiles.values()];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * Export state
   */
  export(): {
    voiceProfiles: VoiceProfile[];
    audioMemories: AudioMemoryEntry[];
    commands: VoiceCommand[];
  } {
    return {
      voiceProfiles: [...this.voiceProfiles.values()],
      audioMemories: [...this.audioMemories.values()].map(m => ({
        ...m,
        originalAudio: { ...m.originalAudio, data: null }  // Don't export audio data
      })),
      commands: [...this.voiceCommands.values()]
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<VoiceInterface['export']>): void {
    for (const profile of data.voiceProfiles) {
      this.voiceProfiles.set(profile.id, profile);
    }

    for (const memory of data.audioMemories) {
      this.audioMemories.set(memory.id, memory);
    }

    for (const command of data.commands) {
      this.voiceCommands.set(command.pattern, command);
    }
  }

  /**
   * Reset interface
   */
  reset(): void {
    this.state = {
      isListening: false,
      isSpeaking: false,
      currentSession: null,
      inputQueue: [],
      outputQueue: [],
      activeVoiceProfile: this.voiceProfiles.get('default')!
    };

    this.stats = {
      totalInputs: 0,
      totalOutputs: 0,
      avgInputConfidence: 0,
      emotionDistribution: {
        neutral: 0, happy: 0, sad: 0, angry: 0,
        fearful: 0, surprised: 0, disgusted: 0, curious: 0
      },
      commandsProcessed: 0,
      audioMemoriesCreated: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const voiceInterface = new VoiceInterface();
