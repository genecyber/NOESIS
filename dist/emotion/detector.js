/**
 * Emotional Tone Detection (Ralph Iteration 10, Feature 5)
 *
 * Real-time sentiment analysis, emotional trajectory mapping,
 * tone-aware response adaptation, and mood-based operator selection.
 */
// ============================================================================
// Emotion Detector
// ============================================================================
export class EmotionDetector {
    config;
    trajectory = [];
    moodProfile = null;
    emotionLexicon = new Map();
    stats;
    constructor(config = {}) {
        this.config = {
            enableDetection: true,
            trackTrajectory: true,
            adaptResponses: true,
            sensitivityLevel: 'medium',
            historyLength: 100,
            ...config
        };
        this.stats = {
            analysesPerformed: 0,
            averageConfidence: 0,
            emotionDistribution: {
                joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
                disgust: 0, trust: 0, anticipation: 0, neutral: 0
            },
            averageValence: 0,
            trajectoryLength: 0
        };
        this.initializeEmotionLexicon();
    }
    /**
     * Initialize emotion lexicon
     */
    initializeEmotionLexicon() {
        // Joy indicators
        const joyWords = ['happy', 'joy', 'excited', 'wonderful', 'amazing', 'great', 'love', 'fantastic', 'delighted', 'thrilled'];
        for (const word of joyWords) {
            this.emotionLexicon.set(word, { emotion: 'joy', weight: 0.8 });
        }
        // Sadness indicators
        const sadWords = ['sad', 'unhappy', 'depressed', 'disappointed', 'heartbroken', 'miserable', 'grief', 'sorrow', 'lonely', 'hopeless'];
        for (const word of sadWords) {
            this.emotionLexicon.set(word, { emotion: 'sadness', weight: 0.8 });
        }
        // Anger indicators
        const angerWords = ['angry', 'furious', 'annoyed', 'frustrated', 'irritated', 'mad', 'rage', 'outraged', 'hostile', 'bitter'];
        for (const word of angerWords) {
            this.emotionLexicon.set(word, { emotion: 'anger', weight: 0.8 });
        }
        // Fear indicators
        const fearWords = ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'dread', 'frightened', 'uneasy'];
        for (const word of fearWords) {
            this.emotionLexicon.set(word, { emotion: 'fear', weight: 0.8 });
        }
        // Surprise indicators
        const surpriseWords = ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'unexpected', 'wow', 'incredible', 'unbelievable'];
        for (const word of surpriseWords) {
            this.emotionLexicon.set(word, { emotion: 'surprise', weight: 0.7 });
        }
        // Trust indicators
        const trustWords = ['trust', 'believe', 'confident', 'reliable', 'honest', 'sincere', 'faith', 'loyal', 'dependable'];
        for (const word of trustWords) {
            this.emotionLexicon.set(word, { emotion: 'trust', weight: 0.7 });
        }
        // Anticipation indicators
        const anticipationWords = ['expect', 'anticipate', 'hope', 'eager', 'curious', 'looking forward', 'excited about', 'waiting'];
        for (const word of anticipationWords) {
            this.emotionLexicon.set(word, { emotion: 'anticipation', weight: 0.7 });
        }
    }
    /**
     * Analyze text for emotional content
     */
    analyze(text) {
        if (!this.config.enableDetection) {
            return this.createNeutralAnalysis(text);
        }
        const indicators = this.extractIndicators(text);
        const state = this.calculateEmotionalState(indicators, text);
        // Track trajectory
        if (this.config.trackTrajectory) {
            this.addToTrajectory(state);
        }
        // Update stats
        this.updateStats(state);
        return {
            text,
            state,
            indicators,
            trajectory: this.getRecentTrajectory(10)
        };
    }
    /**
     * Extract emotion indicators from text
     */
    extractIndicators(text) {
        const indicators = [];
        const words = text.toLowerCase().split(/\s+/);
        // Check lexicon matches
        for (let i = 0; i < words.length; i++) {
            const word = words[i].replace(/[^\w]/g, '');
            const lexiconEntry = this.emotionLexicon.get(word);
            if (lexiconEntry) {
                indicators.push({
                    type: 'word',
                    text: word,
                    emotion: lexiconEntry.emotion,
                    weight: lexiconEntry.weight,
                    position: i
                });
            }
        }
        // Check punctuation patterns
        const exclamations = (text.match(/!/g) || []).length;
        if (exclamations > 0) {
            indicators.push({
                type: 'punctuation',
                text: '!',
                emotion: exclamations > 2 ? 'anger' : 'surprise',
                weight: Math.min(exclamations * 0.2, 0.6),
                position: -1
            });
        }
        const questions = (text.match(/\?/g) || []).length;
        if (questions > 1) {
            indicators.push({
                type: 'punctuation',
                text: '?',
                emotion: 'fear', // Multiple questions may indicate anxiety
                weight: Math.min(questions * 0.15, 0.4),
                position: -1
            });
        }
        // Check for all caps (shouting)
        const capsWords = text.match(/\b[A-Z]{2,}\b/g) || [];
        if (capsWords.length > 0) {
            indicators.push({
                type: 'pattern',
                text: 'ALL CAPS',
                emotion: 'anger',
                weight: Math.min(capsWords.length * 0.2, 0.5),
                position: -1
            });
        }
        return indicators;
    }
    /**
     * Calculate emotional state from indicators
     */
    calculateEmotionalState(indicators, _text) {
        if (indicators.length === 0) {
            return this.createNeutralState();
        }
        // Aggregate emotions by weight
        const emotionScores = {
            joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
            disgust: 0, trust: 0, anticipation: 0, neutral: 0.1
        };
        for (const indicator of indicators) {
            emotionScores[indicator.emotion] += indicator.weight;
        }
        // Find primary and secondary emotions
        const sorted = Object.entries(emotionScores)
            .sort(([, a], [, b]) => b - a);
        const primary = sorted[0][0];
        const secondary = sorted[1][1] > 0.3 ? sorted[1][0] : null;
        // Calculate valence and arousal
        const valence = this.calculateValence(primary, sorted[0][1]);
        const arousal = this.calculateArousal(primary, sorted[0][1]);
        const intensity = Math.min(sorted[0][1], 1);
        // Confidence based on indicator count and consistency
        const confidence = Math.min(indicators.length * 0.2, 0.9);
        return {
            primary,
            secondary,
            intensity,
            valence,
            arousal,
            confidence,
            timestamp: new Date()
        };
    }
    /**
     * Calculate valence (-1 to 1)
     */
    calculateValence(emotion, intensity) {
        const valenceMap = {
            joy: 0.8,
            trust: 0.6,
            anticipation: 0.5,
            surprise: 0.2,
            neutral: 0,
            fear: -0.5,
            sadness: -0.6,
            disgust: -0.7,
            anger: -0.8
        };
        return valenceMap[emotion] * Math.min(intensity, 1);
    }
    /**
     * Calculate arousal (0 to 1)
     */
    calculateArousal(emotion, intensity) {
        const arousalMap = {
            anger: 0.9,
            fear: 0.8,
            surprise: 0.7,
            joy: 0.6,
            anticipation: 0.5,
            disgust: 0.4,
            trust: 0.3,
            sadness: 0.2,
            neutral: 0.1
        };
        return arousalMap[emotion] * Math.min(intensity, 1);
    }
    /**
     * Create neutral state
     */
    createNeutralState() {
        return {
            primary: 'neutral',
            secondary: null,
            intensity: 0.1,
            valence: 0,
            arousal: 0.1,
            confidence: 0.5,
            timestamp: new Date()
        };
    }
    /**
     * Create neutral analysis
     */
    createNeutralAnalysis(text) {
        return {
            text,
            state: this.createNeutralState(),
            indicators: [],
            trajectory: []
        };
    }
    /**
     * Add state to trajectory
     */
    addToTrajectory(state, trigger) {
        this.trajectory.push({ timestamp: new Date(), state, trigger });
        // Trim trajectory to max length
        if (this.trajectory.length > this.config.historyLength) {
            this.trajectory.shift();
        }
        this.stats.trajectoryLength = this.trajectory.length;
    }
    /**
     * Get recent trajectory
     */
    getRecentTrajectory(count) {
        return this.trajectory.slice(-count);
    }
    /**
     * Get emotional resonance suggestions
     */
    getResonance(state, currentStance) {
        const frameMapping = {
            joy: 'playful',
            sadness: 'existential',
            anger: 'adversarial',
            fear: 'stoic',
            surprise: 'playful',
            disgust: 'psychoanalytic',
            trust: 'pragmatic',
            anticipation: 'mythic',
            neutral: currentStance.frame
        };
        const suggestedFrame = frameMapping[state.primary];
        // Operator suggestions based on emotion
        const operatorSuggestions = this.suggestOperators(state);
        // Tone guidance
        const toneGuidance = this.calculateToneGuidance(state);
        return {
            userEmotion: state.primary,
            suggestedFrame,
            operatorSuggestions,
            toneGuidance
        };
    }
    /**
     * Suggest operators based on emotional state
     */
    suggestOperators(state) {
        const suggestions = [];
        if (state.valence < -0.3) {
            suggestions.push('REFRAME');
            suggestions.push('ZOOM_OUT');
        }
        if (state.arousal > 0.6) {
            suggestions.push('GROUND');
            suggestions.push('PAUSE');
        }
        if (state.primary === 'fear' || state.primary === 'anger') {
            suggestions.push('VALIDATE');
            suggestions.push('REFLECT');
        }
        if (state.primary === 'joy' || state.primary === 'anticipation') {
            suggestions.push('AMPLIFY');
            suggestions.push('EXPLORE');
        }
        return suggestions;
    }
    /**
     * Calculate tone guidance
     */
    calculateToneGuidance(state) {
        return {
            formality: state.arousal > 0.5 ? 'casual' : 'neutral',
            warmth: state.valence < 0 ? 0.8 : 0.5,
            directness: state.primary === 'anger' ? 0.4 : 0.6,
            energyLevel: state.arousal > 0.6 ? 'calm' : state.arousal > 0.3 ? 'moderate' : 'calm',
            empathyLevel: state.valence < 0 ? 0.9 : 0.5
        };
    }
    /**
     * Calculate sentiment score
     */
    calculateSentiment(text) {
        const analysis = this.analyze(text);
        const positiveEmotions = ['joy', 'trust', 'anticipation'];
        const negativeEmotions = ['sadness', 'anger', 'fear', 'disgust'];
        let positive = 0;
        let negative = 0;
        for (const indicator of analysis.indicators) {
            if (positiveEmotions.includes(indicator.emotion)) {
                positive += indicator.weight;
            }
            else if (negativeEmotions.includes(indicator.emotion)) {
                negative += indicator.weight;
            }
        }
        const total = positive + negative + 0.1; // Avoid division by zero
        const neutral = Math.max(0, 1 - (positive + negative) / total);
        return {
            positive: positive / total,
            negative: negative / total,
            neutral,
            compound: (positive - negative) / total
        };
    }
    /**
     * Update mood profile
     */
    updateMoodProfile() {
        if (this.trajectory.length < 5) {
            return {
                baseline: this.createNeutralState(),
                currentMood: 'neutral',
                stability: 1,
                triggers: []
            };
        }
        // Calculate baseline from history
        const recentStates = this.trajectory.slice(-20).map(t => t.state);
        const avgValence = recentStates.reduce((sum, s) => sum + s.valence, 0) / recentStates.length;
        const avgArousal = recentStates.reduce((sum, s) => sum + s.arousal, 0) / recentStates.length;
        // Find most common emotion
        const emotionCounts = {};
        for (const state of recentStates) {
            emotionCounts[state.primary] = (emotionCounts[state.primary] || 0) + 1;
        }
        const currentMood = Object.entries(emotionCounts)
            .sort(([, a], [, b]) => b - a)[0][0];
        // Calculate stability
        const valenceVariance = recentStates.reduce((sum, s) => sum + Math.pow(s.valence - avgValence, 2), 0) / recentStates.length;
        const stability = Math.max(0, 1 - valenceVariance * 2);
        this.moodProfile = {
            baseline: {
                primary: currentMood,
                secondary: null,
                intensity: 0.5,
                valence: avgValence,
                arousal: avgArousal,
                confidence: 0.7,
                timestamp: new Date()
            },
            currentMood,
            stability,
            triggers: []
        };
        return this.moodProfile;
    }
    /**
     * Update statistics
     */
    updateStats(state) {
        const n = this.stats.analysesPerformed + 1;
        this.stats.analysesPerformed = n;
        this.stats.averageConfidence = (this.stats.averageConfidence * (n - 1) + state.confidence) / n;
        this.stats.averageValence = (this.stats.averageValence * (n - 1) + state.valence) / n;
        this.stats.emotionDistribution[state.primary]++;
    }
    /**
     * Get trajectory
     */
    getTrajectory() {
        return [...this.trajectory];
    }
    /**
     * Get mood profile
     */
    getMoodProfile() {
        return this.moodProfile;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Clear trajectory
     */
    clearTrajectory() {
        this.trajectory = [];
        this.stats.trajectoryLength = 0;
    }
    /**
     * Reset detector
     */
    reset() {
        this.trajectory = [];
        this.moodProfile = null;
        this.stats = {
            analysesPerformed: 0,
            averageConfidence: 0,
            emotionDistribution: {
                joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0,
                disgust: 0, trust: 0, anticipation: 0, neutral: 0
            },
            averageValence: 0,
            trajectoryLength: 0
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const emotionDetector = new EmotionDetector();
//# sourceMappingURL=detector.js.map