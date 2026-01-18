/**
 * Voice/Audio Interface (Ralph Iteration 8, Feature 1)
 *
 * Speech-to-text input, text-to-speech output with voice modulation,
 * emotion detection, voice commands, and audio memory entries.
 */
import type { Stance, Values } from '../types/index.js';
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
    data: Uint8Array | null;
    duration: number;
}
export interface EmotionAnalysis {
    primary: EmotionType;
    confidence: number;
    valence: number;
    arousal: number;
    dominance: number;
    secondary?: EmotionType;
}
export type EmotionType = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted' | 'curious';
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
    pitch: number;
    speed: number;
    volume: number;
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
export declare class VoiceInterface {
    private config;
    private state;
    private stats;
    private voiceCommands;
    private audioMemories;
    private voiceProfiles;
    constructor(config?: Partial<VoiceConfig>);
    /**
     * Register default voice commands
     */
    private registerDefaultCommands;
    /**
     * Start listening for voice input
     */
    startListening(sessionId: string): boolean;
    /**
     * Stop listening
     */
    stopListening(): void;
    /**
     * Process voice input
     */
    processInput(audio: AudioData): Promise<VoiceInput>;
    /**
     * Transcribe audio to text (mock implementation)
     */
    private transcribe;
    /**
     * Detect emotion from audio (mock implementation)
     */
    private detectEmotion;
    /**
     * Check input for voice commands
     */
    private checkForCommand;
    /**
     * Generate voice output
     */
    generateOutput(text: string, stance: Stance): Promise<VoiceOutput>;
    /**
     * Synthesize text to speech (mock implementation)
     */
    private synthesize;
    /**
     * Map detected emotion to value adjustments
     */
    mapEmotionToValues(emotion: EmotionAnalysis): Partial<Values>;
    /**
     * Register a voice command
     */
    registerCommand(command: VoiceCommand): void;
    /**
     * Unregister a voice command
     */
    unregisterCommand(pattern: string): boolean;
    /**
     * Create audio memory entry
     */
    createAudioMemory(input: VoiceInput, stance: Stance, importance?: number): AudioMemoryEntry;
    /**
     * Search audio memories
     */
    searchAudioMemories(query: string, limit?: number): AudioMemoryEntry[];
    /**
     * Create a new voice profile
     */
    createVoiceProfile(profile: Omit<VoiceProfile, 'id'>): VoiceProfile;
    /**
     * Set active voice profile
     */
    setActiveProfile(profileId: string): boolean;
    /**
     * Update average confidence
     */
    private updateAvgConfidence;
    /**
     * Get current state
     */
    getState(): VoiceState;
    /**
     * Get statistics
     */
    getStats(): VoiceStats;
    /**
     * Get voice profiles
     */
    getVoiceProfiles(): VoiceProfile[];
    /**
     * Update configuration
     */
    updateConfig(config: Partial<VoiceConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): VoiceConfig;
    /**
     * Export state
     */
    export(): {
        voiceProfiles: VoiceProfile[];
        audioMemories: AudioMemoryEntry[];
        commands: VoiceCommand[];
    };
    /**
     * Import state
     */
    import(data: ReturnType<VoiceInterface['export']>): void;
    /**
     * Reset interface
     */
    reset(): void;
}
export declare const voiceInterface: VoiceInterface;
//# sourceMappingURL=interface.d.ts.map