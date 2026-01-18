/**
 * Emotional Intelligence Calibration
 *
 * Calibrates AI responses based on user emotional states with
 * sentiment analysis, tone matching, and adaptive communication styles.
 */
const EMOTION_VALENCE = {
    joy: 80,
    sadness: -60,
    anger: -70,
    fear: -50,
    surprise: 10,
    disgust: -60,
    trust: 60,
    anticipation: 40,
    neutral: 0,
    curiosity: 50,
    frustration: -40,
    excitement: 70,
    confusion: -20,
    satisfaction: 60
};
const EMOTION_AROUSAL = {
    joy: 70,
    sadness: 30,
    anger: 90,
    fear: 80,
    surprise: 85,
    disgust: 50,
    trust: 40,
    anticipation: 60,
    neutral: 30,
    curiosity: 55,
    frustration: 65,
    excitement: 90,
    confusion: 45,
    satisfaction: 35
};
const FRAME_EMOTIONAL_AFFINITY = {
    existential: ['sadness', 'curiosity', 'fear', 'anticipation'],
    pragmatic: ['neutral', 'satisfaction', 'frustration', 'trust'],
    poetic: ['joy', 'sadness', 'anticipation', 'surprise'],
    adversarial: ['anger', 'frustration', 'excitement', 'anticipation'],
    playful: ['joy', 'excitement', 'surprise', 'curiosity'],
    mythic: ['anticipation', 'fear', 'trust', 'surprise'],
    systems: ['curiosity', 'neutral', 'satisfaction', 'confusion'],
    psychoanalytic: ['curiosity', 'fear', 'sadness', 'surprise'],
    stoic: ['neutral', 'trust', 'satisfaction', 'anticipation'],
    absurdist: ['surprise', 'joy', 'confusion', 'curiosity']
};
export class EmotionalCalibrationEngine {
    config;
    emotionalHistory = [];
    currentStyle;
    sentimentLexicon;
    constructor(config) {
        this.config = {
            sensitivityLevel: 'medium',
            responseAdaptation: true,
            toneMatching: true,
            emotionalMirroring: 0.3,
            deescalationEnabled: true,
            empathyLevel: 70,
            ...config
        };
        this.currentStyle = this.createDefaultStyle();
        this.sentimentLexicon = this.initializeLexicon();
    }
    createDefaultStyle() {
        return {
            formality: 50,
            warmth: 60,
            directness: 50,
            pace: 'moderate',
            complexity: 'moderate',
            encouragement: 50
        };
    }
    initializeLexicon() {
        const lexicon = new Map();
        // Positive words
        const positiveWords = ['good', 'great', 'excellent', 'wonderful', 'amazing', 'love', 'happy', 'joy', 'excited', 'fantastic', 'perfect', 'beautiful', 'brilliant', 'awesome', 'delightful', 'pleased', 'grateful', 'thankful', 'appreciate', 'helpful'];
        positiveWords.forEach(w => lexicon.set(w, 0.7));
        // Negative words
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'frustrated', 'annoying', 'disappointing', 'wrong', 'fail', 'poor', 'worst', 'useless', 'stupid', 'broken', 'confusing', 'difficult', 'problem'];
        negativeWords.forEach(w => lexicon.set(w, -0.7));
        // Intensifiers
        const intensifiers = ['very', 'really', 'extremely', 'incredibly', 'absolutely', 'totally'];
        intensifiers.forEach(w => lexicon.set(w, 0.3));
        // Negators
        const negators = ['not', "don't", "doesn't", "won't", "can't", 'never', 'no'];
        negators.forEach(w => lexicon.set(w, -0.5));
        return lexicon;
    }
    analyzeSentiment(text) {
        const words = text.toLowerCase().split(/\s+/);
        const keywords = [];
        let totalScore = 0;
        let wordCount = 0;
        let negationActive = false;
        for (const word of words) {
            const cleanWord = word.replace(/[^a-z]/g, '');
            const sentiment = this.sentimentLexicon.get(cleanWord);
            if (sentiment !== undefined) {
                const adjustedSentiment = negationActive ? -sentiment : sentiment;
                keywords.push({
                    word: cleanWord,
                    sentiment: adjustedSentiment,
                    weight: Math.abs(sentiment)
                });
                totalScore += adjustedSentiment;
                wordCount++;
            }
            // Check for negation
            if (['not', "don't", "doesn't", "won't", "can't", 'never', 'no'].includes(cleanWord)) {
                negationActive = true;
            }
            else if (['.', '!', '?', ','].some(p => word.includes(p))) {
                negationActive = false;
            }
        }
        const averageScore = wordCount > 0 ? totalScore / wordCount : 0;
        const normalizedScore = Math.max(-1, Math.min(1, averageScore));
        const emotions = this.inferEmotionsFromText(text, normalizedScore);
        return {
            text,
            sentiment: normalizedScore > 0.2 ? 'positive' : normalizedScore < -0.2 ? 'negative' : 'neutral',
            score: normalizedScore,
            emotions,
            keywords
        };
    }
    inferEmotionsFromText(text, sentimentScore) {
        const emotions = [];
        const lowerText = text.toLowerCase();
        // Pattern matching for specific emotions
        const emotionPatterns = [
            { emotion: 'joy', patterns: ['happy', 'glad', 'pleased', 'delighted', 'wonderful'], weight: 0.8 },
            { emotion: 'sadness', patterns: ['sad', 'unhappy', 'disappointed', 'depressed', 'down'], weight: 0.8 },
            { emotion: 'anger', patterns: ['angry', 'furious', 'annoyed', 'irritated', 'mad'], weight: 0.8 },
            { emotion: 'fear', patterns: ['afraid', 'scared', 'worried', 'anxious', 'nervous'], weight: 0.8 },
            { emotion: 'surprise', patterns: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected'], weight: 0.7 },
            { emotion: 'frustration', patterns: ['frustrated', 'stuck', "can't", 'difficult', 'struggling'], weight: 0.7 },
            { emotion: 'confusion', patterns: ['confused', "don't understand", 'unclear', 'lost', 'puzzled'], weight: 0.7 },
            { emotion: 'excitement', patterns: ['excited', 'thrilled', "can't wait", 'eager', 'enthusiastic'], weight: 0.8 },
            { emotion: 'curiosity', patterns: ['curious', 'wondering', 'interested', 'want to know', 'how does'], weight: 0.7 }
        ];
        for (const { emotion, patterns, weight } of emotionPatterns) {
            const matchCount = patterns.filter(p => lowerText.includes(p)).length;
            if (matchCount > 0) {
                emotions.push({
                    emotion,
                    score: Math.min(1, matchCount * weight * 0.4),
                    confidence: Math.min(100, matchCount * 30)
                });
            }
        }
        // Add default emotion based on sentiment if no specific emotions detected
        if (emotions.length === 0) {
            if (sentimentScore > 0.2) {
                emotions.push({ emotion: 'satisfaction', score: sentimentScore, confidence: 50 });
            }
            else if (sentimentScore < -0.2) {
                emotions.push({ emotion: 'frustration', score: Math.abs(sentimentScore), confidence: 50 });
            }
            else {
                emotions.push({ emotion: 'neutral', score: 0.5, confidence: 60 });
            }
        }
        return emotions.sort((a, b) => b.score - a.score);
    }
    detectEmotionalState(text, stance) {
        const sentiment = this.analyzeSentiment(text);
        const topEmotion = sentiment.emotions[0];
        const secondaryEmotion = sentiment.emotions[1];
        const primary = topEmotion?.emotion || 'neutral';
        const intensity = topEmotion ? topEmotion.score * 100 : 50;
        const state = {
            primary,
            secondary: secondaryEmotion?.emotion,
            intensity,
            valence: EMOTION_VALENCE[primary] * (intensity / 100),
            arousal: EMOTION_AROUSAL[primary] * (intensity / 100),
            confidence: topEmotion?.confidence || 50,
            timestamp: new Date()
        };
        // Adjust based on stance if provided
        if (stance) {
            const empathyFactor = stance.values.empathy / 100;
            state.intensity = state.intensity * (0.5 + empathyFactor * 0.5);
        }
        this.emotionalHistory.push(state);
        if (this.emotionalHistory.length > 100) {
            this.emotionalHistory = this.emotionalHistory.slice(-50);
        }
        return state;
    }
    calibrateResponse(emotionalState, _stance) {
        const adaptations = [];
        const empathyStatements = [];
        let deescalationNeeded = false;
        // Check for deescalation
        if (this.config.deescalationEnabled && emotionalState.valence < -30 && emotionalState.arousal > 60) {
            deescalationNeeded = true;
            adaptations.push({
                type: 'pace',
                direction: 'decrease',
                reason: 'User shows high negative arousal',
                magnitude: 40
            });
            adaptations.push({
                type: 'warmth',
                direction: 'increase',
                reason: 'Deescalation requires increased warmth',
                magnitude: 30
            });
        }
        // Adapt formality based on emotional state
        if (emotionalState.arousal > 70) {
            adaptations.push({
                type: 'formality',
                direction: 'decrease',
                reason: 'High arousal suggests informal engagement',
                magnitude: 20
            });
        }
        // Adapt complexity based on confusion
        if (emotionalState.primary === 'confusion' || emotionalState.secondary === 'confusion') {
            adaptations.push({
                type: 'complexity',
                direction: 'decrease',
                reason: 'User confusion detected',
                magnitude: 40
            });
        }
        // Add encouragement for frustration
        if (emotionalState.primary === 'frustration' || emotionalState.secondary === 'frustration') {
            adaptations.push({
                type: 'encouragement',
                direction: 'increase',
                reason: 'User frustration detected',
                magnitude: 50
            });
            empathyStatements.push("I understand this can be challenging.");
            empathyStatements.push("Let's work through this together.");
        }
        // Generate empathy statements based on emotion
        empathyStatements.push(...this.generateEmpathyStatements(emotionalState));
        // Calculate recommended style
        const recommendedStyle = this.calculateRecommendedStyle(emotionalState, adaptations);
        // Suggest frame based on emotional state
        const frameSuggestion = this.suggestFrame(emotionalState);
        return {
            recommendedStyle,
            suggestedTone: this.determineTone(emotionalState, recommendedStyle),
            adaptations,
            frameSuggestion,
            deescalationNeeded,
            empathyStatements
        };
    }
    calculateRecommendedStyle(emotionalState, adaptations) {
        const style = { ...this.currentStyle };
        // Apply base emotional adjustments
        if (emotionalState.valence < 0) {
            style.warmth = Math.min(100, style.warmth + Math.abs(emotionalState.valence) * 0.3);
        }
        if (this.config.toneMatching) {
            style.formality = Math.max(20, Math.min(80, 50 - emotionalState.arousal * 0.3));
        }
        // Apply adaptations
        for (const adaptation of adaptations) {
            const delta = adaptation.direction === 'increase' ? adaptation.magnitude : -adaptation.magnitude;
            switch (adaptation.type) {
                case 'formality':
                    style.formality = Math.max(0, Math.min(100, style.formality + delta));
                    break;
                case 'warmth':
                    style.warmth = Math.max(0, Math.min(100, style.warmth + delta));
                    break;
                case 'encouragement':
                    style.encouragement = Math.max(0, Math.min(100, style.encouragement + delta));
                    break;
                case 'pace':
                    if (delta < 0)
                        style.pace = 'slow';
                    else if (delta > 0)
                        style.pace = 'fast';
                    break;
                case 'complexity':
                    if (delta < 0)
                        style.complexity = 'simple';
                    else if (delta > 0)
                        style.complexity = 'complex';
                    break;
            }
        }
        return style;
    }
    generateEmpathyStatements(emotionalState) {
        const statements = [];
        const empathyLevel = this.config.empathyLevel / 100;
        if (empathyLevel < 0.3)
            return statements;
        switch (emotionalState.primary) {
            case 'joy':
            case 'excitement':
                if (empathyLevel > 0.5) {
                    statements.push("That's great to hear!");
                }
                break;
            case 'sadness':
                statements.push("I'm sorry to hear that.");
                if (empathyLevel > 0.7) {
                    statements.push("Your feelings are valid.");
                }
                break;
            case 'anger':
                statements.push("I understand your frustration.");
                break;
            case 'fear':
                statements.push("It's okay to feel uncertain.");
                if (empathyLevel > 0.6) {
                    statements.push("We can take this step by step.");
                }
                break;
            case 'confusion':
                statements.push("Let me help clarify things.");
                break;
            case 'frustration':
                statements.push("I can see this is challenging.");
                break;
        }
        return statements;
    }
    determineTone(emotionalState, style) {
        const tones = [];
        if (style.warmth > 70)
            tones.push('warm');
        if (style.formality < 30)
            tones.push('casual');
        if (style.formality > 70)
            tones.push('professional');
        if (style.directness > 70)
            tones.push('direct');
        if (style.encouragement > 70)
            tones.push('encouraging');
        if (emotionalState.valence < -30) {
            tones.push('supportive');
        }
        if (emotionalState.arousal > 70) {
            tones.push('energetic');
        }
        else if (emotionalState.arousal < 30) {
            tones.push('calm');
        }
        return tones.length > 0 ? tones.join(', ') : 'balanced';
    }
    suggestFrame(emotionalState) {
        // Find frames with affinity for the current emotion
        for (const [frame, emotions] of Object.entries(FRAME_EMOTIONAL_AFFINITY)) {
            if (emotions.includes(emotionalState.primary)) {
                return frame;
            }
        }
        // Default suggestions based on valence/arousal
        if (emotionalState.valence < -30 && emotionalState.arousal < 40) {
            return 'stoic';
        }
        if (emotionalState.valence > 30 && emotionalState.arousal > 60) {
            return 'playful';
        }
        if (emotionalState.arousal < 30) {
            return 'pragmatic';
        }
        return undefined;
    }
    analyzeEmotionalHistory() {
        if (this.emotionalHistory.length === 0) {
            return {
                states: [],
                patterns: [],
                averageValence: 0,
                volatility: 0,
                dominantEmotions: ['neutral']
            };
        }
        const states = [...this.emotionalHistory];
        const valences = states.map(s => s.valence);
        const averageValence = valences.reduce((a, b) => a + b, 0) / valences.length;
        // Calculate volatility (standard deviation of valence)
        const variance = valences.reduce((sum, v) => sum + Math.pow(v - averageValence, 2), 0) / valences.length;
        const volatility = Math.sqrt(variance);
        // Find dominant emotions
        const emotionCounts = new Map();
        for (const state of states) {
            emotionCounts.set(state.primary, (emotionCounts.get(state.primary) || 0) + 1);
            if (state.secondary) {
                emotionCounts.set(state.secondary, (emotionCounts.get(state.secondary) || 0) + 0.5);
            }
        }
        const sortedEmotions = [...emotionCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emotion]) => emotion);
        return {
            states,
            patterns: this.detectPatterns(states),
            averageValence,
            volatility,
            dominantEmotions: sortedEmotions
        };
    }
    detectPatterns(states) {
        // Simplified pattern detection
        const patterns = [];
        const emotionSequences = new Map();
        for (let i = 1; i < states.length; i++) {
            const sequence = `${states[i - 1].primary}->${states[i].primary}`;
            emotionSequences.set(sequence, (emotionSequences.get(sequence) || 0) + 1);
        }
        for (const [sequence, frequency] of emotionSequences) {
            if (frequency >= 2) {
                const [trigger, response] = sequence.split('->');
                patterns.push({
                    trigger,
                    response,
                    frequency,
                    consistency: frequency / (states.length - 1)
                });
            }
        }
        return patterns.sort((a, b) => b.frequency - a.frequency);
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    getCurrentStyle() {
        return { ...this.currentStyle };
    }
    setCurrentStyle(style) {
        this.currentStyle = { ...this.currentStyle, ...style };
    }
    clearHistory() {
        this.emotionalHistory = [];
    }
}
export function createEmotionalCalibrationEngine(config) {
    return new EmotionalCalibrationEngine(config);
}
//# sourceMappingURL=calibration.js.map