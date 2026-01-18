/**
 * Voice-to-Stance Conversion
 *
 * Convert speech input to stance configurations through
 * voice analysis, prosody detection, and emotion inference.
 */
// Emotion to frame mapping
const EMOTION_FRAME_MAP = {
    neutral: ['pragmatic', 'systems', 'stoic'],
    happy: ['playful', 'poetic'],
    sad: ['existential', 'psychoanalytic'],
    angry: ['adversarial', 'stoic'],
    fearful: ['existential', 'psychoanalytic'],
    surprised: ['playful', 'absurdist'],
    disgusted: ['adversarial', 'stoic'],
    contemplative: ['existential', 'philosophical'],
    excited: ['playful', 'poetic'],
    calm: ['stoic', 'pragmatic']
};
// Prosody to value mapping
const PROSODY_VALUE_MAP = {
    highPitch: { curiosity: 70, novelty: 60 },
    lowPitch: { certainty: 70, empathy: 60 },
    fastTempo: { risk: 60, novelty: 70 },
    slowTempo: { certainty: 70, synthesis: 60 },
    highEnergy: { provocation: 60, risk: 70 },
    lowEnergy: { empathy: 70, synthesis: 60 }
};
export class VoiceStanceConverter {
    speakerProfiles = new Map();
    analysisHistory = [];
    analyzeVoice(input) {
        // Simulate transcription (in real implementation, use speech-to-text API)
        const transcription = this.transcribe(input);
        // Analyze prosody from transcript and timing
        const prosody = this.analyzeProsody(input, transcription);
        // Detect emotions
        const emotion = this.detectEmotion(prosody, transcription);
        // Identify speaker
        const speakerInfo = this.identifySpeaker(input);
        const analysis = {
            input,
            transcription,
            prosody,
            emotion,
            speakerInfo,
            confidence: (transcription.confidence + emotion.confidence) / 2
        };
        this.analysisHistory.push(analysis);
        return analysis;
    }
    transcribe(input) {
        // Simulate transcription - in real implementation, use Whisper API or similar
        const words = input.transcript.split(' ').map((word, index) => ({
            word,
            startTime: index * 0.3,
            endTime: (index + 1) * 0.3,
            confidence: 0.9
        }));
        return {
            text: input.transcript,
            words,
            language: 'en',
            confidence: 0.9
        };
    }
    analyzeProsody(input, transcription) {
        // Simulate prosody analysis
        const wordCount = transcription.words.length;
        const duration = input.duration;
        const wordsPerMinute = (wordCount / duration) * 60;
        return {
            pitch: {
                mean: 150 + Math.random() * 100,
                min: 100 + Math.random() * 50,
                max: 200 + Math.random() * 100,
                variance: 20 + Math.random() * 30,
                contour: Array(10).fill(0).map(() => 120 + Math.random() * 80)
            },
            tempo: {
                wordsPerMinute,
                syllablesPerSecond: wordsPerMinute / 60 * 1.5,
                variability: 0.2 + Math.random() * 0.3,
                rushes: [],
                slowdowns: []
            },
            energy: {
                mean: 50 + Math.random() * 30,
                peaks: [0.3, 0.6, 0.9].map(p => p * duration),
                valleys: [0.15, 0.45, 0.75].map(p => p * duration),
                dynamicRange: 20 + Math.random() * 20
            },
            pauses: this.detectPauses(transcription),
            intonation: this.analyzeIntonation(transcription.text)
        };
    }
    detectPauses(transcription) {
        const pauses = [];
        for (let i = 1; i < transcription.words.length; i++) {
            const gap = transcription.words[i].startTime - transcription.words[i - 1].endTime;
            if (gap > 0.3) {
                pauses.push({
                    position: transcription.words[i - 1].endTime,
                    duration: gap,
                    type: gap > 1.0 ? 'breath' : gap > 0.5 ? 'emphasis' : 'natural'
                });
            }
        }
        return pauses;
    }
    analyzeIntonation(text) {
        const hasQuestion = text.includes('?');
        const hasExclamation = text.includes('!');
        const isCommand = text.match(/^(please |could you |would you |let's )/i);
        let type = 'declarative';
        let contour = 'falling';
        if (hasQuestion) {
            type = 'interrogative';
            contour = 'rising';
        }
        else if (hasExclamation) {
            type = 'exclamatory';
            contour = 'complex';
        }
        else if (isCommand) {
            type = 'imperative';
            contour = 'falling';
        }
        return {
            type,
            contour,
            emotionalValence: hasExclamation ? 0.7 : hasQuestion ? 0.3 : 0.5
        };
    }
    detectEmotion(prosody, transcription) {
        // Analyze based on prosody features
        const pitch = prosody.pitch;
        const energy = prosody.energy;
        const tempo = prosody.tempo;
        // Simple heuristic-based emotion detection
        let emotion = 'neutral';
        let intensity = 50;
        const indicators = [];
        // High pitch + high energy = excited or happy
        if (pitch.mean > 200 && energy.mean > 70) {
            emotion = 'excited';
            intensity = 75;
            indicators.push('High pitch', 'High energy');
        }
        // Low pitch + low energy = sad or contemplative
        else if (pitch.mean < 130 && energy.mean < 40) {
            emotion = 'contemplative';
            intensity = 60;
            indicators.push('Low pitch', 'Low energy');
        }
        // High energy + fast tempo = angry or excited
        else if (energy.mean > 70 && tempo.wordsPerMinute > 150) {
            emotion = 'excited';
            intensity = 70;
            indicators.push('High energy', 'Fast speech');
        }
        // Slow tempo + pauses = contemplative
        else if (tempo.wordsPerMinute < 100 && prosody.pauses.length > 2) {
            emotion = 'contemplative';
            intensity = 55;
            indicators.push('Slow speech', 'Many pauses');
        }
        // Check transcript for emotional keywords
        const textLower = transcription.text.toLowerCase();
        if (textLower.match(/happy|joy|great|wonderful/)) {
            emotion = 'happy';
            indicators.push('Positive language');
        }
        else if (textLower.match(/sad|upset|disappointed/)) {
            emotion = 'sad';
            indicators.push('Negative language');
        }
        else if (textLower.match(/angry|frustrated|annoyed/)) {
            emotion = 'angry';
            indicators.push('Anger language');
        }
        // Calculate arousal and valence
        const arousal = Math.min(100, (energy.mean + tempo.wordsPerMinute / 2) / 2);
        const valence = this.getValenceFromEmotion(emotion);
        return {
            primary: { emotion, intensity, indicators },
            arousal,
            valence,
            confidence: 0.7
        };
    }
    getValenceFromEmotion(emotion) {
        const valenceMap = {
            happy: 80,
            excited: 70,
            surprised: 30,
            calm: 40,
            neutral: 0,
            contemplative: -10,
            sad: -60,
            fearful: -50,
            angry: -40,
            disgusted: -70
        };
        return valenceMap[emotion] || 0;
    }
    identifySpeaker(input) {
        // Simple speaker identification based on ID in input
        const speakerId = `speaker-${input.id.split('-')[0]}`;
        const isKnown = this.speakerProfiles.has(speakerId);
        return {
            id: speakerId,
            isKnown,
            profile: this.speakerProfiles.get(speakerId),
            characteristics: {
                pitchRange: 'medium',
                speakingRate: 'medium',
                clarity: 0.8
            }
        };
    }
    inferStance(analysis) {
        const reasoning = [];
        // Determine frame from emotion
        const emotionFrames = EMOTION_FRAME_MAP[analysis.emotion.primary.emotion] || ['pragmatic'];
        const suggestedFrame = emotionFrames[0];
        reasoning.push({
            source: 'emotion',
            observation: `Detected ${analysis.emotion.primary.emotion} emotion`,
            inference: `Suggested ${suggestedFrame} frame`,
            weight: 0.4
        });
        // Determine values from prosody
        const suggestedValues = { ...this.createDefaultValues() };
        if (analysis.prosody.pitch.mean > 180) {
            Object.assign(suggestedValues, PROSODY_VALUE_MAP.highPitch);
            reasoning.push({
                source: 'prosody',
                observation: 'High pitch detected',
                inference: 'Increased curiosity and novelty values',
                weight: 0.2
            });
        }
        else if (analysis.prosody.pitch.mean < 130) {
            Object.assign(suggestedValues, PROSODY_VALUE_MAP.lowPitch);
            reasoning.push({
                source: 'prosody',
                observation: 'Low pitch detected',
                inference: 'Increased certainty and empathy values',
                weight: 0.2
            });
        }
        if (analysis.prosody.tempo.wordsPerMinute > 150) {
            Object.assign(suggestedValues, PROSODY_VALUE_MAP.fastTempo);
            reasoning.push({
                source: 'prosody',
                observation: 'Fast speech detected',
                inference: 'Increased risk and novelty values',
                weight: 0.2
            });
        }
        // Determine sentience from overall analysis
        const suggestedSentience = {
            awarenessLevel: 50 + Math.round(analysis.emotion.arousal / 4),
            autonomyLevel: 50 + Math.round(analysis.emotion.valence / 4),
            identityStrength: 60
        };
        if (analysis.speakerInfo.isKnown && analysis.speakerInfo.profile) {
            reasoning.push({
                source: 'speaker',
                observation: 'Known speaker profile available',
                inference: 'Applied speaker preferences',
                weight: 0.2
            });
        }
        // Calculate overall confidence
        const confidence = reasoning.reduce((sum, r) => sum + r.weight * 0.8, 0);
        return {
            suggestedFrame,
            suggestedValues,
            suggestedSentience,
            confidence: Math.min(0.95, confidence),
            reasoning
        };
    }
    createDefaultValues() {
        return {
            curiosity: 50,
            certainty: 50,
            risk: 50,
            novelty: 50,
            empathy: 50,
            provocation: 50,
            synthesis: 50
        };
    }
    convert(input) {
        const startTime = Date.now();
        const analysis = this.analyzeVoice(input);
        const stanceInference = this.inferStance(analysis);
        const appliedStance = {
            frame: stanceInference.suggestedFrame,
            values: stanceInference.suggestedValues,
            sentience: {
                awarenessLevel: stanceInference.suggestedSentience.awarenessLevel || 50,
                autonomyLevel: stanceInference.suggestedSentience.autonomyLevel || 50,
                identityStrength: stanceInference.suggestedSentience.identityStrength || 50,
                emergentGoals: [],
                consciousnessInsights: [],
                persistentValues: []
            }
        };
        return {
            analysis,
            stanceInference,
            appliedStance: stanceInference.confidence > 0.5 ? appliedStance : undefined,
            processingTime: Date.now() - startTime
        };
    }
    registerSpeaker(speakerId, profile) {
        this.speakerProfiles.set(speakerId, profile);
    }
    getSpeakerProfile(speakerId) {
        return this.speakerProfiles.get(speakerId);
    }
    getAnalysisHistory() {
        return [...this.analysisHistory];
    }
    clearHistory() {
        this.analysisHistory = [];
    }
    // Multi-speaker differentiation
    differentiateSpeakers(analyses) {
        const bySpeaker = new Map();
        for (const analysis of analyses) {
            const speakerId = analysis.speakerInfo.id;
            const existing = bySpeaker.get(speakerId) || [];
            existing.push(analysis);
            bySpeaker.set(speakerId, existing);
        }
        return bySpeaker;
    }
    // Get aggregated stance for a speaker
    getAggregatedStanceForSpeaker(speakerId) {
        const speakerAnalyses = this.analysisHistory.filter(a => a.speakerInfo.id === speakerId);
        if (speakerAnalyses.length === 0)
            return null;
        // Aggregate emotions
        const emotionCounts = new Map();
        for (const analysis of speakerAnalyses) {
            const emotion = analysis.emotion.primary.emotion;
            emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
        }
        // Find dominant emotion
        let dominantEmotion = 'neutral';
        let maxCount = 0;
        for (const [emotion, count] of emotionCounts) {
            if (count > maxCount) {
                maxCount = count;
                dominantEmotion = emotion;
            }
        }
        // Create aggregated inference
        const lastAnalysis = speakerAnalyses[speakerAnalyses.length - 1];
        return this.inferStance({
            ...lastAnalysis,
            emotion: {
                ...lastAnalysis.emotion,
                primary: {
                    emotion: dominantEmotion,
                    intensity: 60,
                    indicators: ['Aggregated from multiple samples']
                }
            }
        });
    }
}
export function createVoiceConverter() {
    return new VoiceStanceConverter();
}
//# sourceMappingURL=conversion.js.map