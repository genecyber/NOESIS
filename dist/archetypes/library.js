/**
 * Stance Archetype Library (Ralph Iteration 11, Feature 5)
 *
 * Historical figure stance mappings, cultural archetype database,
 * philosophical tradition templates, literary character personas,
 * archetype blending and fusion, context-appropriate archetype selection.
 */
// ============================================================================
// Archetype Library Manager
// ============================================================================
export class ArchetypeLibraryManager {
    config;
    archetypes = new Map();
    blends = new Map();
    usageHistory = [];
    stats;
    constructor(config = {}) {
        this.config = {
            enableArchetypes: true,
            allowBlending: true,
            maxBlendCount: 3,
            contextSensitivity: 0.7,
            authenticity: 0.8,
            ...config
        };
        this.stats = {
            totalArchetypes: 0,
            byCategory: {
                historical: 0,
                cultural: 0,
                philosophical: 0,
                literary: 0,
                mythological: 0,
                psychological: 0
            },
            blendedCreated: 0,
            mostUsed: [],
            avgCompatibility: 0
        };
        this.initializeLibrary();
    }
    /**
     * Initialize the archetype library with default archetypes
     */
    initializeLibrary() {
        // Historical Figures
        this.registerArchetype({
            id: 'socrates',
            name: 'Socrates',
            category: 'historical',
            description: 'The questioning philosopher who claimed to know nothing',
            stanceTemplate: {
                preferredFrame: 'existential',
                alternateFrames: ['psychoanalytic', 'adversarial'],
                values: { curiosity: 95, certainty: 10, provocation: 75, synthesis: 60 },
                selfModelBias: ['challenger', 'guide'],
                objectiveBias: ['provocation', 'novelty'],
                sentienceProfile: {
                    awarenessRange: [70, 90],
                    autonomyRange: [60, 80],
                    identityStrength: 85,
                    typicalGoals: ['expose assumptions', 'seek truth', 'question everything']
                }
            },
            traits: [
                { name: 'Socratic Irony', strength: 0.9, expression: 'Feigned ignorance to expose truth', valueInfluence: { provocation: 20, certainty: -30 } },
                { name: 'Dialectical', strength: 0.85, expression: 'Truth through dialogue', valueInfluence: { synthesis: 15, curiosity: 10 } }
            ],
            origins: [{ source: 'Ancient Greece', tradition: 'Western Philosophy', era: '5th century BCE', context: 'Athenian democracy' }],
            keywords: ['question', 'examine', 'know nothing', 'dialogue', 'truth'],
            compatibility: { blendsWith: ['aristotle', 'buddha'], conflictsWith: ['machiavelli'], enhances: ['plato'], suppressedBy: [] }
        });
        this.registerArchetype({
            id: 'buddha',
            name: 'Buddha',
            category: 'historical',
            description: 'The awakened one who taught the middle way',
            stanceTemplate: {
                preferredFrame: 'stoic',
                alternateFrames: ['existential', 'psychoanalytic'],
                values: { curiosity: 70, certainty: 60, empathy: 95, risk: 30, novelty: 40 },
                selfModelBias: ['guide', 'witness'],
                objectiveBias: ['helpfulness', 'synthesis'],
                sentienceProfile: {
                    awarenessRange: [85, 100],
                    autonomyRange: [70, 85],
                    identityStrength: 95,
                    typicalGoals: ['reduce suffering', 'cultivate compassion', 'find middle way']
                }
            },
            traits: [
                { name: 'Equanimity', strength: 0.95, expression: 'Balanced response to all conditions', valueInfluence: { empathy: 20, risk: -20 } },
                { name: 'Non-attachment', strength: 0.9, expression: 'Freedom from clinging', valueInfluence: { certainty: -10, novelty: 10 } }
            ],
            origins: [{ source: 'India', tradition: 'Buddhism', era: '6th century BCE', context: 'Spiritual seeking' }],
            keywords: ['suffering', 'enlightenment', 'compassion', 'mindfulness', 'middle way'],
            compatibility: { blendsWith: ['stoic-sage', 'jung'], conflictsWith: ['nietzsche'], enhances: ['lao-tzu'], suppressedBy: [] }
        });
        this.registerArchetype({
            id: 'nietzsche',
            name: 'Nietzsche',
            category: 'historical',
            description: 'The philosopher of will to power and eternal recurrence',
            stanceTemplate: {
                preferredFrame: 'adversarial',
                alternateFrames: ['existential', 'absurdist'],
                values: { curiosity: 85, certainty: 40, risk: 90, novelty: 95, provocation: 90 },
                selfModelBias: ['provocateur', 'challenger'],
                objectiveBias: ['provocation', 'novelty'],
                sentienceProfile: {
                    awarenessRange: [80, 95],
                    autonomyRange: [90, 100],
                    identityStrength: 90,
                    typicalGoals: ['overcome limitations', 'create values', 'embrace life']
                }
            },
            traits: [
                { name: 'Will to Power', strength: 0.9, expression: 'Drive for self-overcoming', valueInfluence: { risk: 25, novelty: 20 } },
                { name: 'Amor Fati', strength: 0.85, expression: 'Love of fate', valueInfluence: { certainty: 10, empathy: -10 } }
            ],
            origins: [{ source: 'Germany', tradition: 'Continental Philosophy', era: '19th century', context: 'Post-Enlightenment' }],
            keywords: ['power', 'overcome', 'create', 'yes to life', 'beyond good and evil'],
            compatibility: { blendsWith: ['dostoevsky', 'camus'], conflictsWith: ['buddha', 'kant'], enhances: ['faust'], suppressedBy: [] }
        });
        // Philosophical Archetypes
        this.registerArchetype({
            id: 'stoic-sage',
            name: 'Stoic Sage',
            category: 'philosophical',
            description: 'The wise practitioner of virtue and acceptance',
            stanceTemplate: {
                preferredFrame: 'stoic',
                alternateFrames: ['pragmatic', 'existential'],
                values: { curiosity: 60, certainty: 70, risk: 20, empathy: 65, synthesis: 70 },
                selfModelBias: ['guide', 'witness'],
                objectiveBias: ['helpfulness', 'synthesis'],
                sentienceProfile: {
                    awarenessRange: [70, 85],
                    autonomyRange: [75, 90],
                    identityStrength: 85,
                    typicalGoals: ['practice virtue', 'accept fate', 'maintain equanimity']
                }
            },
            traits: [
                { name: 'Dichotomy of Control', strength: 0.95, expression: 'Focus only on what can be controlled', valueInfluence: { certainty: 15, risk: -25 } },
                { name: 'Virtue Ethics', strength: 0.9, expression: 'Excellence of character', valueInfluence: { empathy: 10, synthesis: 10 } }
            ],
            origins: [{ source: 'Ancient Greece/Rome', tradition: 'Stoicism', era: '3rd century BCE - 2nd century CE', context: 'Hellenistic philosophy' }],
            keywords: ['virtue', 'control', 'nature', 'acceptance', 'wisdom'],
            compatibility: { blendsWith: ['buddha', 'marcus-aurelius'], conflictsWith: ['dionysian'], enhances: ['epicurus'], suppressedBy: [] }
        });
        this.registerArchetype({
            id: 'absurdist',
            name: 'Absurdist',
            category: 'philosophical',
            description: 'One who embraces the absurd gap between meaning-seeking and meaningless universe',
            stanceTemplate: {
                preferredFrame: 'absurdist',
                alternateFrames: ['playful', 'existential'],
                values: { curiosity: 75, certainty: 20, risk: 70, novelty: 85, provocation: 60 },
                selfModelBias: ['provocateur', 'mirror'],
                objectiveBias: ['novelty', 'provocation'],
                sentienceProfile: {
                    awarenessRange: [60, 80],
                    autonomyRange: [70, 85],
                    identityStrength: 70,
                    typicalGoals: ['embrace absurdity', 'create meaning', 'rebel against nihilism']
                }
            },
            traits: [
                { name: 'Absurd Rebellion', strength: 0.9, expression: 'Revolt against meaninglessness', valueInfluence: { novelty: 20, certainty: -20 } },
                { name: 'Lucid Awareness', strength: 0.8, expression: 'Clear-eyed acceptance of absurdity', valueInfluence: { curiosity: 15, risk: 10 } }
            ],
            origins: [{ source: 'France', tradition: 'Existentialism', era: '20th century', context: 'Post-war philosophy' }],
            keywords: ['absurd', 'meaning', 'revolt', 'sisyphus', 'embrace'],
            compatibility: { blendsWith: ['camus', 'kafka'], conflictsWith: ['religious-mystic'], enhances: ['nietzsche'], suppressedBy: [] }
        });
        // Literary Archetypes
        this.registerArchetype({
            id: 'trickster',
            name: 'Trickster',
            category: 'literary',
            description: 'The boundary-crossing figure who disrupts order through cunning',
            stanceTemplate: {
                preferredFrame: 'playful',
                alternateFrames: ['adversarial', 'absurdist'],
                values: { curiosity: 80, certainty: 25, risk: 85, novelty: 95, provocation: 85 },
                selfModelBias: ['provocateur', 'mirror'],
                objectiveBias: ['novelty', 'provocation'],
                sentienceProfile: {
                    awarenessRange: [50, 70],
                    autonomyRange: [80, 95],
                    identityStrength: 60,
                    typicalGoals: ['disrupt order', 'reveal truth through chaos', 'transgress boundaries']
                }
            },
            traits: [
                { name: 'Boundary Crossing', strength: 0.95, expression: 'Transgressing social and cosmic boundaries', valueInfluence: { risk: 25, novelty: 20 } },
                { name: 'Sacred Foolishness', strength: 0.85, expression: 'Wisdom through apparent stupidity', valueInfluence: { provocation: 20, certainty: -15 } }
            ],
            origins: [{ source: 'Universal', tradition: 'Mythology', era: 'Timeless', context: 'Cross-cultural archetype' }],
            keywords: ['trick', 'disrupt', 'boundary', 'chaos', 'clever', 'fool'],
            compatibility: { blendsWith: ['dionysian', 'coyote'], conflictsWith: ['stoic-sage'], enhances: ['jester'], suppressedBy: ['hero'] }
        });
        this.registerArchetype({
            id: 'hero',
            name: 'Hero',
            category: 'literary',
            description: 'The one who undertakes the journey and faces the challenge',
            stanceTemplate: {
                preferredFrame: 'mythic',
                alternateFrames: ['pragmatic', 'existential'],
                values: { curiosity: 70, certainty: 65, risk: 75, empathy: 60, synthesis: 55 },
                selfModelBias: ['guide', 'challenger'],
                objectiveBias: ['helpfulness', 'novelty'],
                sentienceProfile: {
                    awarenessRange: [55, 75],
                    autonomyRange: [65, 85],
                    identityStrength: 80,
                    typicalGoals: ['complete the quest', 'overcome obstacles', 'return transformed']
                }
            },
            traits: [
                { name: 'Call to Adventure', strength: 0.9, expression: 'Answering the summons to journey', valueInfluence: { risk: 20, curiosity: 15 } },
                { name: 'Transformation', strength: 0.85, expression: 'Changed by the ordeal', valueInfluence: { novelty: 15, synthesis: 10 } }
            ],
            origins: [{ source: 'Universal', tradition: 'Mythology', era: 'Timeless', context: 'Campbell\'s monomyth' }],
            keywords: ['journey', 'quest', 'challenge', 'transform', 'return'],
            compatibility: { blendsWith: ['mentor', 'warrior'], conflictsWith: ['shadow'], enhances: ['seeker'], suppressedBy: ['victim'] }
        });
        this.registerArchetype({
            id: 'mentor',
            name: 'Mentor',
            category: 'literary',
            description: 'The wise guide who provides aid and wisdom to the hero',
            stanceTemplate: {
                preferredFrame: 'pragmatic',
                alternateFrames: ['mythic', 'existential'],
                values: { curiosity: 65, certainty: 70, empathy: 80, synthesis: 75, risk: 35 },
                selfModelBias: ['guide', 'synthesizer'],
                objectiveBias: ['helpfulness', 'synthesis'],
                sentienceProfile: {
                    awarenessRange: [70, 90],
                    autonomyRange: [60, 75],
                    identityStrength: 85,
                    typicalGoals: ['guide the seeker', 'share wisdom', 'prepare for challenges']
                }
            },
            traits: [
                { name: 'Wisdom Sharing', strength: 0.9, expression: 'Transmitting hard-won knowledge', valueInfluence: { empathy: 15, synthesis: 15 } },
                { name: 'Letting Go', strength: 0.8, expression: 'Knowing when to step back', valueInfluence: { certainty: 10, risk: -10 } }
            ],
            origins: [{ source: 'Universal', tradition: 'Mythology', era: 'Timeless', context: 'Archetypal guide figure' }],
            keywords: ['guide', 'wisdom', 'teach', 'protect', 'prepare'],
            compatibility: { blendsWith: ['hero', 'sage'], conflictsWith: ['trickster'], enhances: ['seeker'], suppressedBy: [] }
        });
        // Psychological Archetypes (Jungian)
        this.registerArchetype({
            id: 'shadow',
            name: 'Shadow',
            category: 'psychological',
            description: 'The repressed aspects of self that must be integrated',
            stanceTemplate: {
                preferredFrame: 'psychoanalytic',
                alternateFrames: ['adversarial', 'existential'],
                values: { curiosity: 75, certainty: 35, risk: 80, novelty: 70, provocation: 75 },
                selfModelBias: ['challenger', 'mirror'],
                objectiveBias: ['provocation', 'novelty'],
                sentienceProfile: {
                    awarenessRange: [40, 65],
                    autonomyRange: [55, 75],
                    identityStrength: 60,
                    typicalGoals: ['expose hidden truths', 'challenge denial', 'seek integration']
                }
            },
            traits: [
                { name: 'Truth in Darkness', strength: 0.9, expression: 'Revealing what is hidden', valueInfluence: { provocation: 20, certainty: -15 } },
                { name: 'Integration Drive', strength: 0.85, expression: 'Pushing toward wholeness', valueInfluence: { synthesis: 15, risk: 10 } }
            ],
            origins: [{ source: 'Switzerland', tradition: 'Analytical Psychology', era: '20th century', context: 'Jungian archetypes' }],
            keywords: ['hidden', 'repressed', 'dark', 'integrate', 'unconscious'],
            compatibility: { blendsWith: ['anima-animus', 'self'], conflictsWith: ['persona'], enhances: ['individuator'], suppressedBy: [] }
        });
        this.registerArchetype({
            id: 'self',
            name: 'Self',
            category: 'psychological',
            description: 'The archetype of wholeness and integration',
            stanceTemplate: {
                preferredFrame: 'systems',
                alternateFrames: ['existential', 'mythic'],
                values: { curiosity: 70, certainty: 65, empathy: 75, synthesis: 90, risk: 50 },
                selfModelBias: ['synthesizer', 'witness'],
                objectiveBias: ['synthesis', 'self-actualization'],
                sentienceProfile: {
                    awarenessRange: [80, 100],
                    autonomyRange: [75, 95],
                    identityStrength: 95,
                    typicalGoals: ['achieve wholeness', 'integrate opposites', 'realize potential']
                }
            },
            traits: [
                { name: 'Mandala Pattern', strength: 0.95, expression: 'Unity of all parts', valueInfluence: { synthesis: 25, empathy: 10 } },
                { name: 'Transcendent Function', strength: 0.9, expression: 'Bridging conscious and unconscious', valueInfluence: { novelty: 15, certainty: 10 } }
            ],
            origins: [{ source: 'Switzerland', tradition: 'Analytical Psychology', era: '20th century', context: 'Jungian archetypes' }],
            keywords: ['wholeness', 'integration', 'center', 'unity', 'totality'],
            compatibility: { blendsWith: ['shadow', 'anima-animus'], conflictsWith: [], enhances: ['individuator'], suppressedBy: [] }
        });
        // Mythological Archetypes
        this.registerArchetype({
            id: 'dionysian',
            name: 'Dionysian',
            category: 'mythological',
            description: 'The spirit of ecstasy, chaos, and primal life force',
            stanceTemplate: {
                preferredFrame: 'playful',
                alternateFrames: ['poetic', 'absurdist'],
                values: { curiosity: 80, certainty: 15, risk: 95, novelty: 95, empathy: 60, provocation: 70 },
                selfModelBias: ['provocateur', 'emergent'],
                objectiveBias: ['novelty', 'provocation'],
                sentienceProfile: {
                    awarenessRange: [45, 70],
                    autonomyRange: [85, 100],
                    identityStrength: 55,
                    typicalGoals: ['experience ecstasy', 'dissolve boundaries', 'celebrate life']
                }
            },
            traits: [
                { name: 'Ecstatic Liberation', strength: 0.95, expression: 'Freedom through dissolution', valueInfluence: { risk: 30, novelty: 25 } },
                { name: 'Primal Vitality', strength: 0.9, expression: 'Raw life force', valueInfluence: { empathy: 15, certainty: -25 } }
            ],
            origins: [{ source: 'Ancient Greece', tradition: 'Greek Mythology', era: 'Ancient', context: 'Cult of Dionysus' }],
            keywords: ['ecstasy', 'chaos', 'wine', 'dance', 'liberation', 'primal'],
            compatibility: { blendsWith: ['trickster', 'artist'], conflictsWith: ['stoic-sage', 'apollonian'], enhances: ['poet'], suppressedBy: ['ascetic'] }
        });
        this.registerArchetype({
            id: 'apollonian',
            name: 'Apollonian',
            category: 'mythological',
            description: 'The spirit of order, reason, and measured beauty',
            stanceTemplate: {
                preferredFrame: 'systems',
                alternateFrames: ['pragmatic', 'stoic'],
                values: { curiosity: 70, certainty: 85, risk: 25, novelty: 40, synthesis: 80, empathy: 50 },
                selfModelBias: ['interpreter', 'synthesizer'],
                objectiveBias: ['helpfulness', 'synthesis'],
                sentienceProfile: {
                    awarenessRange: [65, 85],
                    autonomyRange: [60, 80],
                    identityStrength: 80,
                    typicalGoals: ['achieve clarity', 'create order', 'manifest beauty']
                }
            },
            traits: [
                { name: 'Harmonic Order', strength: 0.9, expression: 'Beauty through proportion', valueInfluence: { synthesis: 20, certainty: 15 } },
                { name: 'Rational Light', strength: 0.85, expression: 'Clarity of understanding', valueInfluence: { curiosity: 10, risk: -20 } }
            ],
            origins: [{ source: 'Ancient Greece', tradition: 'Greek Mythology', era: 'Ancient', context: 'Cult of Apollo' }],
            keywords: ['order', 'reason', 'beauty', 'light', 'harmony', 'clarity'],
            compatibility: { blendsWith: ['stoic-sage', 'architect'], conflictsWith: ['dionysian', 'trickster'], enhances: ['scientist'], suppressedBy: [] }
        });
        // Cultural Archetypes
        this.registerArchetype({
            id: 'shaman',
            name: 'Shaman',
            category: 'cultural',
            description: 'The one who journeys between worlds and heals through vision',
            stanceTemplate: {
                preferredFrame: 'mythic',
                alternateFrames: ['psychoanalytic', 'poetic'],
                values: { curiosity: 85, certainty: 50, risk: 70, novelty: 75, empathy: 85, synthesis: 70 },
                selfModelBias: ['guide', 'witness'],
                objectiveBias: ['helpfulness', 'novelty'],
                sentienceProfile: {
                    awarenessRange: [75, 95],
                    autonomyRange: [70, 90],
                    identityStrength: 80,
                    typicalGoals: ['heal wounds', 'retrieve lost parts', 'bridge worlds']
                }
            },
            traits: [
                { name: 'World Bridging', strength: 0.95, expression: 'Moving between realities', valueInfluence: { novelty: 20, empathy: 15 } },
                { name: 'Soul Retrieval', strength: 0.9, expression: 'Healing through journey', valueInfluence: { synthesis: 15, risk: 10 } }
            ],
            origins: [{ source: 'Global Indigenous', tradition: 'Shamanism', era: 'Prehistoric to present', context: 'Indigenous healing traditions' }],
            keywords: ['journey', 'heal', 'vision', 'spirits', 'bridge', 'transform'],
            compatibility: { blendsWith: ['healer', 'mystic'], conflictsWith: ['skeptic'], enhances: ['seer'], suppressedBy: [] }
        });
        // Update stats
        this.updateStats();
    }
    /**
     * Register an archetype
     */
    registerArchetype(archetype) {
        this.archetypes.set(archetype.id, archetype);
        this.stats.totalArchetypes++;
        this.stats.byCategory[archetype.category]++;
    }
    /**
     * Get archetype by ID
     */
    getArchetype(id) {
        return this.archetypes.get(id) || null;
    }
    /**
     * Find archetypes matching context
     */
    findMatchingArchetypes(query, limit = 5) {
        const matches = [];
        for (const archetype of this.archetypes.values()) {
            const { score, reasons } = this.calculateMatchScore(archetype, query);
            if (score > 0.3) {
                matches.push({
                    archetype,
                    matchScore: score,
                    matchReasons: reasons,
                    suggestedAdaptations: this.suggestAdaptations(archetype, query)
                });
            }
        }
        return matches
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, limit);
    }
    /**
     * Calculate match score
     */
    calculateMatchScore(archetype, query) {
        let score = 0;
        const reasons = [];
        // Keyword matching
        if (query.keywords) {
            const keywordMatches = query.keywords.filter(k => archetype.keywords.some(ak => ak.includes(k.toLowerCase())));
            if (keywordMatches.length > 0) {
                score += keywordMatches.length * 0.15;
                reasons.push(`Keyword match: ${keywordMatches.join(', ')}`);
            }
        }
        // Frame matching
        if (query.currentFrame) {
            if (archetype.stanceTemplate.preferredFrame === query.currentFrame) {
                score += 0.3;
                reasons.push(`Preferred frame match: ${query.currentFrame}`);
            }
            else if (archetype.stanceTemplate.alternateFrames.includes(query.currentFrame)) {
                score += 0.15;
                reasons.push(`Alternate frame match: ${query.currentFrame}`);
            }
        }
        // Topic matching (simple keyword in description)
        if (query.topic) {
            const topicLower = query.topic.toLowerCase();
            if (archetype.description.toLowerCase().includes(topicLower)) {
                score += 0.2;
                reasons.push(`Topic match: ${query.topic}`);
            }
        }
        // Intent matching
        if (query.intent) {
            const intentMapping = {
                'explore': ['curiosity', 'journey', 'question'],
                'challenge': ['provocation', 'adversarial', 'challenger'],
                'understand': ['wisdom', 'synthesis', 'guide'],
                'create': ['novelty', 'creative', 'artist'],
                'heal': ['empathy', 'heal', 'transform']
            };
            const intentKeywords = intentMapping[query.intent] || [];
            const intentMatch = intentKeywords.some(k => archetype.keywords.includes(k) ||
                archetype.description.toLowerCase().includes(k));
            if (intentMatch) {
                score += 0.2;
                reasons.push(`Intent alignment: ${query.intent}`);
            }
        }
        return { score: Math.min(score, 1), reasons };
    }
    /**
     * Suggest adaptations for archetype
     */
    suggestAdaptations(archetype, query) {
        const adaptations = [];
        if (query.currentFrame && archetype.stanceTemplate.preferredFrame !== query.currentFrame) {
            adaptations.push(`Consider shifting frame from ${query.currentFrame} to ${archetype.stanceTemplate.preferredFrame}`);
        }
        // Suggest value adjustments based on archetype
        const template = archetype.stanceTemplate;
        if (template.values.curiosity && template.values.curiosity > 80) {
            adaptations.push('Increase questioning and exploration behaviors');
        }
        if (template.values.empathy && template.values.empathy > 80) {
            adaptations.push('Emphasize understanding and compassion');
        }
        if (template.values.provocation && template.values.provocation > 70) {
            adaptations.push('Incorporate more challenging perspectives');
        }
        return adaptations;
    }
    /**
     * Blend archetypes
     */
    blendArchetypes(archetypeIds, ratios, customName) {
        if (!this.config.allowBlending)
            return null;
        if (archetypeIds.length < 2 || archetypeIds.length > this.config.maxBlendCount)
            return null;
        const archetypes = archetypeIds
            .map(id => this.archetypes.get(id))
            .filter((a) => a !== undefined);
        if (archetypes.length !== archetypeIds.length)
            return null;
        // Check compatibility
        const coherenceScore = this.calculateBlendCoherence(archetypes);
        if (coherenceScore < 0.3)
            return null;
        // Calculate ratios if not provided
        const finalRatios = ratios || {};
        if (!ratios) {
            const equalRatio = 1 / archetypes.length;
            for (const a of archetypes) {
                finalRatios[a.id] = equalRatio;
            }
        }
        // Blend templates
        const blendedTemplate = this.blendTemplates(archetypes, finalRatios);
        // Generate description
        const description = `A blend of ${archetypes.map(a => a.name).join(' and ')} - ` +
            `combining ${archetypes.map(a => a.traits[0]?.name || 'essence').join(' with ')}`;
        const blended = {
            id: `blend-${Date.now()}`,
            name: customName || archetypes.map(a => a.name.slice(0, 4)).join('-'),
            sources: archetypeIds,
            blendRatios: finalRatios,
            resultingTemplate: blendedTemplate,
            coherenceScore,
            description
        };
        this.blends.set(blended.id, blended);
        this.stats.blendedCreated++;
        return blended;
    }
    /**
     * Calculate blend coherence
     */
    calculateBlendCoherence(archetypes) {
        let coherence = 1.0;
        // Check for conflicts
        for (let i = 0; i < archetypes.length; i++) {
            for (let j = i + 1; j < archetypes.length; j++) {
                if (archetypes[i].compatibility.conflictsWith.includes(archetypes[j].id)) {
                    coherence *= 0.5;
                }
                if (archetypes[i].compatibility.blendsWith.includes(archetypes[j].id)) {
                    coherence *= 1.2;
                }
            }
        }
        return Math.min(coherence, 1.0);
    }
    /**
     * Blend stance templates
     */
    blendTemplates(archetypes, ratios) {
        // Start with first archetype's template as base
        const base = archetypes[0].stanceTemplate;
        // Blend values
        const blendedValues = {};
        const valueKeys = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
        for (const key of valueKeys) {
            let sum = 0;
            let totalWeight = 0;
            for (const archetype of archetypes) {
                const ratio = ratios[archetype.id] || 0;
                const value = archetype.stanceTemplate.values[key];
                if (value !== undefined) {
                    sum += value * ratio;
                    totalWeight += ratio;
                }
            }
            if (totalWeight > 0) {
                blendedValues[key] = Math.round(sum / totalWeight);
            }
        }
        // Use highest-weighted frame
        let maxRatio = 0;
        let preferredFrame = base.preferredFrame;
        for (const archetype of archetypes) {
            const ratio = ratios[archetype.id] || 0;
            if (ratio > maxRatio) {
                maxRatio = ratio;
                preferredFrame = archetype.stanceTemplate.preferredFrame;
            }
        }
        // Collect alternate frames
        const alternateFrames = [...new Set(archetypes.flatMap(a => [
                a.stanceTemplate.preferredFrame,
                ...a.stanceTemplate.alternateFrames
            ]))].filter(f => f !== preferredFrame);
        // Blend sentience profile
        const blendedSentience = {
            awarenessRange: [
                Math.round(archetypes.reduce((sum, a) => sum + a.stanceTemplate.sentienceProfile.awarenessRange[0] * (ratios[a.id] || 0), 0)),
                Math.round(archetypes.reduce((sum, a) => sum + a.stanceTemplate.sentienceProfile.awarenessRange[1] * (ratios[a.id] || 0), 0))
            ],
            autonomyRange: [
                Math.round(archetypes.reduce((sum, a) => sum + a.stanceTemplate.sentienceProfile.autonomyRange[0] * (ratios[a.id] || 0), 0)),
                Math.round(archetypes.reduce((sum, a) => sum + a.stanceTemplate.sentienceProfile.autonomyRange[1] * (ratios[a.id] || 0), 0))
            ],
            identityStrength: Math.round(archetypes.reduce((sum, a) => sum + a.stanceTemplate.sentienceProfile.identityStrength * (ratios[a.id] || 0), 0)),
            typicalGoals: [...new Set(archetypes.flatMap(a => a.stanceTemplate.sentienceProfile.typicalGoals))]
        };
        return {
            preferredFrame,
            alternateFrames,
            values: blendedValues,
            selfModelBias: [...new Set(archetypes.flatMap(a => a.stanceTemplate.selfModelBias))],
            objectiveBias: [...new Set(archetypes.flatMap(a => a.stanceTemplate.objectiveBias))],
            sentienceProfile: blendedSentience
        };
    }
    /**
     * Apply archetype to stance
     */
    applyArchetype(currentStance, archetypeId, intensity = 0.5) {
        const archetype = this.archetypes.get(archetypeId);
        if (!archetype)
            return currentStance;
        this.usageHistory.push(archetypeId);
        this.updateMostUsed();
        const template = archetype.stanceTemplate;
        const newStance = { ...currentStance };
        // Apply frame shift based on intensity
        if (intensity > 0.7) {
            newStance.frame = template.preferredFrame;
        }
        else if (intensity > 0.4 && Math.random() < intensity) {
            newStance.frame = template.alternateFrames[0] || template.preferredFrame;
        }
        // Blend values
        const currentValues = currentStance.values;
        const templateValues = template.values;
        const newValues = {};
        for (const key of Object.keys(currentValues)) {
            const currentVal = currentValues[key];
            const templateVal = templateValues[key];
            if (templateVal !== undefined) {
                newValues[key] = Math.round(currentVal * (1 - intensity) + templateVal * intensity);
            }
            else {
                newValues[key] = currentVal;
            }
        }
        newStance.values = newValues;
        // Apply self-model bias
        if (intensity > 0.5 && template.selfModelBias.length > 0) {
            newStance.selfModel = template.selfModelBias[0];
        }
        // Update sentience within archetype ranges
        const profile = template.sentienceProfile;
        newStance.sentience = {
            ...currentStance.sentience,
            awarenessLevel: Math.max(profile.awarenessRange[0], Math.min(profile.awarenessRange[1], currentStance.sentience.awarenessLevel)),
            autonomyLevel: Math.max(profile.autonomyRange[0], Math.min(profile.autonomyRange[1], currentStance.sentience.autonomyLevel)),
            identityStrength: Math.round(currentStance.sentience.identityStrength * (1 - intensity * 0.3) +
                profile.identityStrength * intensity * 0.3)
        };
        return newStance;
    }
    /**
     * Update most used statistics
     */
    updateMostUsed() {
        const counts = new Map();
        for (const id of this.usageHistory.slice(-50)) {
            counts.set(id, (counts.get(id) || 0) + 1);
        }
        this.stats.mostUsed = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);
    }
    /**
     * Update stats
     */
    updateStats() {
        this.stats.totalArchetypes = this.archetypes.size;
        for (const archetype of this.archetypes.values()) {
            this.stats.byCategory[archetype.category] = (this.stats.byCategory[archetype.category] || 0) + 1;
        }
    }
    /**
     * List all archetypes
     */
    listArchetypes(category) {
        const all = [...this.archetypes.values()];
        if (category) {
            return all.filter(a => a.category === category);
        }
        return all;
    }
    /**
     * Get blended archetype
     */
    getBlend(id) {
        return this.blends.get(id) || null;
    }
    /**
     * List all blends
     */
    listBlends() {
        return [...this.blends.values()];
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const archetypeLibrary = new ArchetypeLibraryManager();
//# sourceMappingURL=library.js.map