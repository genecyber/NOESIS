/**
 * Context-Aware Prompt Rewriting (Ralph Iteration 9, Feature 4)
 *
 * Stance-influenced prompt enhancement, frame-specific language adaptation,
 * value-aligned phrasing, and coherence-optimized rewrites.
 */
// ============================================================================
// Prompt Rewriter
// ============================================================================
export class PromptRewriter {
    config;
    frameStyles = new Map();
    phraseMappings = [];
    stats;
    constructor(config = {}) {
        this.config = {
            enableRewriting: true,
            preserveIntent: true,
            maxRewriteIterations: 3,
            coherenceThreshold: 0.7,
            styleStrength: 'moderate',
            trackChanges: true,
            ...config
        };
        this.stats = {
            promptsRewritten: 0,
            averageCoherenceImprovement: 0,
            averageStanceAlignment: 0,
            mostCommonChanges: []
        };
        this.initializeFrameStyles();
        this.initializePhraseMappings();
    }
    /**
     * Initialize frame-specific styles
     */
    initializeFrameStyles() {
        this.frameStyles.set('existential', {
            frame: 'existential',
            vocabulary: ['meaning', 'purpose', 'existence', 'authentic', 'choice', 'freedom', 'responsibility'],
            patterns: ['What does it mean to...', 'In the face of...', 'The essence of...'],
            tone: 'contemplative',
            emphasis: ['depth', 'authenticity', 'meaning']
        });
        this.frameStyles.set('pragmatic', {
            frame: 'pragmatic',
            vocabulary: ['practical', 'effective', 'solution', 'implement', 'result', 'outcome', 'action'],
            patterns: ['How can we...', 'What works is...', 'The practical approach...'],
            tone: 'direct',
            emphasis: ['efficiency', 'results', 'actionability']
        });
        this.frameStyles.set('poetic', {
            frame: 'poetic',
            vocabulary: ['beauty', 'rhythm', 'harmony', 'metaphor', 'imagery', 'resonance', 'echo'],
            patterns: ['Like the...', 'In the dance of...', 'The poetry of...'],
            tone: 'lyrical',
            emphasis: ['beauty', 'expression', 'metaphor']
        });
        this.frameStyles.set('adversarial', {
            frame: 'adversarial',
            vocabulary: ['challenge', 'counter', 'critique', 'flaw', 'weakness', 'assumption', 'bias'],
            patterns: ['But what if...', 'The flaw in this is...', 'Consider the opposite...'],
            tone: 'challenging',
            emphasis: ['critique', 'rigor', 'skepticism']
        });
        this.frameStyles.set('playful', {
            frame: 'playful',
            vocabulary: ['fun', 'explore', 'imagine', 'wild', 'twist', 'surprise', 'game'],
            patterns: ['What if we played with...', 'Imagine a world where...', 'Let\'s twist this...'],
            tone: 'lighthearted',
            emphasis: ['creativity', 'experimentation', 'joy']
        });
        this.frameStyles.set('mythic', {
            frame: 'mythic',
            vocabulary: ['journey', 'hero', 'archetype', 'transformation', 'quest', 'threshold', 'wisdom'],
            patterns: ['On the hero\'s journey...', 'The archetype of...', 'Through the threshold of...'],
            tone: 'narrative',
            emphasis: ['story', 'transformation', 'meaning']
        });
        this.frameStyles.set('systems', {
            frame: 'systems',
            vocabulary: ['system', 'feedback', 'emergence', 'interconnection', 'pattern', 'dynamic', 'network'],
            patterns: ['In the system of...', 'The feedback loop of...', 'Emergent properties suggest...'],
            tone: 'analytical',
            emphasis: ['patterns', 'connections', 'emergence']
        });
        this.frameStyles.set('psychoanalytic', {
            frame: 'psychoanalytic',
            vocabulary: ['unconscious', 'desire', 'projection', 'defense', 'symbol', 'repression', 'id'],
            patterns: ['Beneath the surface...', 'The unconscious suggests...', 'A projection of...'],
            tone: 'interpretive',
            emphasis: ['depth', 'hidden meaning', 'motivation']
        });
        this.frameStyles.set('stoic', {
            frame: 'stoic',
            vocabulary: ['accept', 'control', 'virtue', 'reason', 'equanimity', 'nature', 'duty'],
            patterns: ['What is within our control...', 'Accept what is...', 'Through virtue...'],
            tone: 'measured',
            emphasis: ['acceptance', 'wisdom', 'virtue']
        });
        this.frameStyles.set('absurdist', {
            frame: 'absurdist',
            vocabulary: ['absurd', 'meaningless', 'revolt', 'embrace', 'paradox', 'chaos', 'liberation'],
            patterns: ['In the face of absurdity...', 'The paradox reveals...', 'Embrace the chaos...'],
            tone: 'ironic',
            emphasis: ['paradox', 'freedom', 'rebellion']
        });
    }
    /**
     * Initialize phrase mappings
     */
    initializePhraseMappings() {
        this.phraseMappings = [
            {
                generic: 'explain',
                framed: {
                    existential: 'illuminate the meaning of',
                    pragmatic: 'break down',
                    poetic: 'unfold the layers of',
                    adversarial: 'critically examine',
                    playful: 'explore and play with',
                    mythic: 'reveal the deeper truth of',
                    systems: 'map the dynamics of',
                    psychoanalytic: 'uncover what lies beneath',
                    stoic: 'reason through',
                    absurdist: 'dance with the paradox of'
                }
            },
            {
                generic: 'think about',
                framed: {
                    existential: 'contemplate',
                    pragmatic: 'analyze',
                    poetic: 'muse upon',
                    adversarial: 'interrogate',
                    playful: 'wonder about',
                    mythic: 'journey through',
                    systems: 'model',
                    psychoanalytic: 'probe',
                    stoic: 'reflect upon',
                    absurdist: 'wrestle with'
                }
            },
            {
                generic: 'help me',
                framed: {
                    existential: 'guide me through',
                    pragmatic: 'assist me in',
                    poetic: 'accompany me as I',
                    adversarial: 'challenge me to',
                    playful: 'join me in exploring',
                    mythic: 'be my companion as I quest to',
                    systems: 'help me model',
                    psychoanalytic: 'help me understand',
                    stoic: 'support me in accepting',
                    absurdist: 'embrace with me'
                }
            }
        ];
    }
    /**
     * Rewrite a prompt based on stance
     */
    rewrite(request) {
        if (!this.config.enableRewriting) {
            return {
                originalPrompt: request.originalPrompt,
                rewrittenPrompt: request.originalPrompt,
                changes: [],
                coherenceScore: 1.0,
                stanceAlignment: 0.5,
                suggestions: []
            };
        }
        const changes = [];
        let rewritten = request.originalPrompt;
        // Apply frame-specific vocabulary
        rewritten = this.applyFrameVocabulary(rewritten, request.stance.frame, changes);
        // Apply phrase mappings
        rewritten = this.applyPhraseMappings(rewritten, request.stance.frame, changes);
        // Apply value-aligned phrasing
        rewritten = this.applyValueAlignment(rewritten, request.stance.values, changes);
        // Apply context integration
        rewritten = this.integrateContext(rewritten, request.context, changes);
        // Apply constraints
        if (request.constraints) {
            rewritten = this.applyConstraints(rewritten, request.constraints, changes);
        }
        // Calculate scores
        const coherenceScore = this.calculateCoherenceScore(rewritten, request.stance);
        const stanceAlignment = this.calculateStanceAlignment(rewritten, request.stance);
        // Generate suggestions
        const suggestions = this.generateSuggestions(rewritten, request.stance, coherenceScore);
        // Update stats
        this.updateStats(coherenceScore, stanceAlignment, changes);
        return {
            originalPrompt: request.originalPrompt,
            rewrittenPrompt: rewritten,
            changes,
            coherenceScore,
            stanceAlignment,
            suggestions
        };
    }
    /**
     * Apply frame-specific vocabulary
     */
    applyFrameVocabulary(prompt, frame, changes) {
        const style = this.frameStyles.get(frame);
        if (!style)
            return prompt;
        let result = prompt;
        // Add frame-appropriate opening if prompt is direct
        if (this.config.styleStrength !== 'subtle' && !this.hasFrameIndicator(prompt, frame)) {
            const pattern = style.patterns[Math.floor(Math.random() * style.patterns.length)];
            if (pattern && !prompt.toLowerCase().startsWith(pattern.toLowerCase().split('...')[0])) {
                // Only add if it makes sense contextually
                if (prompt.length < 200) {
                    changes.push({
                        type: 'addition',
                        original: '',
                        modified: `[Frame context: ${frame}] `,
                        reason: `Added ${frame} frame context`
                    });
                }
            }
        }
        return result;
    }
    /**
     * Check if prompt already has frame indicators
     */
    hasFrameIndicator(prompt, frame) {
        const style = this.frameStyles.get(frame);
        if (!style)
            return false;
        const promptLower = prompt.toLowerCase();
        return style.vocabulary.some(word => promptLower.includes(word.toLowerCase()));
    }
    /**
     * Apply phrase mappings
     */
    applyPhraseMappings(prompt, frame, changes) {
        let result = prompt;
        for (const mapping of this.phraseMappings) {
            const regex = new RegExp(`\\b${mapping.generic}\\b`, 'gi');
            const replacement = mapping.framed[frame];
            if (replacement && result.toLowerCase().includes(mapping.generic.toLowerCase())) {
                const before = result;
                result = result.replace(regex, replacement);
                if (before !== result) {
                    changes.push({
                        type: 'replacement',
                        original: mapping.generic,
                        modified: replacement,
                        reason: `Adapted phrase to ${frame} frame`
                    });
                }
            }
        }
        return result;
    }
    /**
     * Apply value-aligned phrasing
     */
    applyValueAlignment(prompt, values, changes) {
        let result = prompt;
        // High curiosity: add exploratory language
        if (values.curiosity > 70) {
            if (!result.toLowerCase().includes('explore') && !result.toLowerCase().includes('discover')) {
                // Could add exploratory framing
            }
        }
        // High empathy: soften language
        if (values.empathy > 70) {
            result = result.replace(/you must/gi, 'consider');
            result = result.replace(/you should/gi, 'you might');
        }
        // High provocation: add challenging elements
        if (values.provocation > 70) {
            if (!result.includes('?') && result.length < 100) {
                result = result + ' What assumptions might be hiding here?';
                changes.push({
                    type: 'addition',
                    original: '',
                    modified: ' What assumptions might be hiding here?',
                    reason: 'Added provocative element based on high provocation value'
                });
            }
        }
        return result;
    }
    /**
     * Integrate conversation context
     */
    integrateContext(prompt, context, _changes) {
        let result = prompt;
        // Reference recent context if relevant
        if (context.history.length > 0 && this.config.styleStrength === 'strong') {
            const recentTopics = this.extractTopics(context.history.slice(-3));
            if (recentTopics.length > 0 && !prompt.toLowerCase().includes(recentTopics[0])) {
                // Could add contextual reference
            }
        }
        return result;
    }
    /**
     * Extract topics from messages
     */
    extractTopics(messages) {
        // Simple keyword extraction
        const allText = messages.map(m => m.content).join(' ');
        const words = allText.toLowerCase().split(/\s+/);
        const wordCounts = new Map();
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with',
            'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
            'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
            'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'i', 'me', 'my', 'we',
            'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those']);
        for (const word of words) {
            if (word.length > 3 && !stopWords.has(word)) {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        }
        return [...wordCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }
    /**
     * Apply constraints
     */
    applyConstraints(prompt, constraints, changes) {
        let result = prompt;
        // Max length constraint
        if (constraints.maxLength && result.length > constraints.maxLength) {
            result = result.substring(0, constraints.maxLength - 3) + '...';
            changes.push({
                type: 'removal',
                original: prompt.substring(constraints.maxLength - 3),
                modified: '...',
                reason: 'Truncated to meet length constraint'
            });
        }
        // Forbidden keywords
        if (constraints.forbiddenKeywords) {
            for (const keyword of constraints.forbiddenKeywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                if (regex.test(result)) {
                    result = result.replace(regex, '[filtered]');
                    changes.push({
                        type: 'replacement',
                        original: keyword,
                        modified: '[filtered]',
                        reason: 'Removed forbidden keyword'
                    });
                }
            }
        }
        return result;
    }
    /**
     * Calculate coherence score
     */
    calculateCoherenceScore(prompt, stance) {
        const style = this.frameStyles.get(stance.frame);
        if (!style)
            return 0.5;
        const promptLower = prompt.toLowerCase();
        let matches = 0;
        for (const word of style.vocabulary) {
            if (promptLower.includes(word.toLowerCase())) {
                matches++;
            }
        }
        const vocabularyScore = Math.min(matches / 3, 1);
        const coherenceFromDrift = Math.max(0, 1 - stance.cumulativeDrift / 100);
        return vocabularyScore * 0.4 + coherenceFromDrift * 0.6;
    }
    /**
     * Calculate stance alignment
     */
    calculateStanceAlignment(prompt, stance) {
        let alignment = 0.5;
        // Check for frame indicators
        const style = this.frameStyles.get(stance.frame);
        if (style) {
            const promptLower = prompt.toLowerCase();
            const vocabMatches = style.vocabulary.filter(v => promptLower.includes(v.toLowerCase())).length;
            alignment += Math.min(vocabMatches * 0.1, 0.3);
        }
        // Adjust based on values
        const avgValue = Object.values(stance.values).reduce((a, b) => a + b, 0) /
            Object.values(stance.values).length;
        alignment += (avgValue / 100) * 0.2;
        return Math.min(alignment, 1);
    }
    /**
     * Generate suggestions for improvement
     */
    generateSuggestions(prompt, stance, coherenceScore) {
        const suggestions = [];
        if (coherenceScore < 0.5) {
            suggestions.push(`Consider using more ${stance.frame} vocabulary`);
        }
        const style = this.frameStyles.get(stance.frame);
        if (style && !this.hasFrameIndicator(prompt, stance.frame)) {
            suggestions.push(`Try incorporating: ${style.vocabulary.slice(0, 3).join(', ')}`);
        }
        if (prompt.length > 500) {
            suggestions.push('Consider breaking this into smaller, focused prompts');
        }
        if (stance.values.curiosity > 70 && !prompt.includes('?')) {
            suggestions.push('Add exploratory questions to match high curiosity');
        }
        return suggestions;
    }
    /**
     * Update statistics
     */
    updateStats(coherenceScore, stanceAlignment, changes) {
        const prevCount = this.stats.promptsRewritten;
        this.stats.promptsRewritten++;
        this.stats.averageCoherenceImprovement = (this.stats.averageCoherenceImprovement * prevCount + coherenceScore) / this.stats.promptsRewritten;
        this.stats.averageStanceAlignment = (this.stats.averageStanceAlignment * prevCount + stanceAlignment) / this.stats.promptsRewritten;
        // Track common changes (simplified - could be expanded)
        void changes; // Acknowledge parameter for future use
    }
    /**
     * Batch rewrite multiple prompts
     */
    batchRewrite(requests) {
        return requests.map(req => this.rewrite(req));
    }
    /**
     * Preview rewrite without tracking
     */
    preview(request) {
        const originalTracking = this.config.trackChanges;
        this.config.trackChanges = false;
        const result = this.rewrite(request);
        this.config.trackChanges = originalTracking;
        return result;
    }
    /**
     * Get frame style
     */
    getFrameStyle(frame) {
        return this.frameStyles.get(frame) || null;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    reset() {
        this.stats = {
            promptsRewritten: 0,
            averageCoherenceImprovement: 0,
            averageStanceAlignment: 0,
            mostCommonChanges: []
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const promptRewriter = new PromptRewriter();
//# sourceMappingURL=rewriter.js.map