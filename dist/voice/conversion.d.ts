/**
 * Voice-to-Stance Conversion
 *
 * Convert speech input to stance configurations through
 * voice analysis, prosody detection, and emotion inference.
 */
import type { Stance, Frame, Values } from '../types/index.js';
export interface VoiceInput {
    id: string;
    audioData?: ArrayBuffer;
    transcript: string;
    duration: number;
    sampleRate: number;
    channels: number;
    timestamp: Date;
}
export interface VoiceAnalysis {
    input: VoiceInput;
    transcription: TranscriptionResult;
    prosody: ProsodyAnalysis;
    emotion: EmotionDetection;
    speakerInfo: SpeakerInfo;
    confidence: number;
}
export interface TranscriptionResult {
    text: string;
    words: TranscribedWord[];
    language: string;
    confidence: number;
    alternatives?: string[];
}
export interface TranscribedWord {
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
    speaker?: string;
}
export interface ProsodyAnalysis {
    pitch: PitchProfile;
    tempo: TempoProfile;
    energy: EnergyProfile;
    pauses: PausePattern[];
    intonation: IntonationPattern;
}
export interface PitchProfile {
    mean: number;
    min: number;
    max: number;
    variance: number;
    contour: number[];
}
export interface TempoProfile {
    wordsPerMinute: number;
    syllablesPerSecond: number;
    variability: number;
    rushes: TimeRange[];
    slowdowns: TimeRange[];
}
export interface TimeRange {
    start: number;
    end: number;
    intensity: number;
}
export interface EnergyProfile {
    mean: number;
    peaks: number[];
    valleys: number[];
    dynamicRange: number;
}
export interface PausePattern {
    position: number;
    duration: number;
    type: 'breath' | 'hesitation' | 'emphasis' | 'natural';
}
export interface IntonationPattern {
    type: 'declarative' | 'interrogative' | 'exclamatory' | 'imperative';
    contour: 'rising' | 'falling' | 'flat' | 'complex';
    emotionalValence: number;
}
export interface EmotionDetection {
    primary: EmotionState;
    secondary?: EmotionState;
    arousal: number;
    valence: number;
    confidence: number;
}
export interface EmotionState {
    emotion: DetectedEmotion;
    intensity: number;
    indicators: string[];
}
export type DetectedEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted' | 'contemplative' | 'excited' | 'calm';
export interface SpeakerInfo {
    id: string;
    isKnown: boolean;
    profile?: SpeakerProfile;
    characteristics: VoiceCharacteristics;
}
export interface SpeakerProfile {
    name?: string;
    baselineEmotions: Record<DetectedEmotion, number>;
    preferredFrames: Frame[];
    communicationStyle: CommunicationStyle;
}
export interface VoiceCharacteristics {
    pitchRange: 'low' | 'medium' | 'high';
    speakingRate: 'slow' | 'medium' | 'fast';
    clarity: number;
    accent?: string;
}
export type CommunicationStyle = 'analytical' | 'expressive' | 'driver' | 'amiable';
export interface StanceInference {
    suggestedFrame: Frame;
    suggestedValues: Partial<Values>;
    suggestedSentience: Partial<Stance['sentience']>;
    confidence: number;
    reasoning: InferenceReasoning[];
}
export interface InferenceReasoning {
    source: 'prosody' | 'emotion' | 'content' | 'speaker';
    observation: string;
    inference: string;
    weight: number;
}
export interface ConversionResult {
    analysis: VoiceAnalysis;
    stanceInference: StanceInference;
    appliedStance?: Partial<Stance>;
    processingTime: number;
}
export declare class VoiceStanceConverter {
    private speakerProfiles;
    private analysisHistory;
    analyzeVoice(input: VoiceInput): VoiceAnalysis;
    private transcribe;
    private analyzeProsody;
    private detectPauses;
    private analyzeIntonation;
    private detectEmotion;
    private getValenceFromEmotion;
    private identifySpeaker;
    inferStance(analysis: VoiceAnalysis): StanceInference;
    private createDefaultValues;
    convert(input: VoiceInput): ConversionResult;
    registerSpeaker(speakerId: string, profile: SpeakerProfile): void;
    getSpeakerProfile(speakerId: string): SpeakerProfile | undefined;
    getAnalysisHistory(): VoiceAnalysis[];
    clearHistory(): void;
    differentiateSpeakers(analyses: VoiceAnalysis[]): Map<string, VoiceAnalysis[]>;
    getAggregatedStanceForSpeaker(speakerId: string): StanceInference | null;
}
export declare function createVoiceConverter(): VoiceStanceConverter;
//# sourceMappingURL=conversion.d.ts.map