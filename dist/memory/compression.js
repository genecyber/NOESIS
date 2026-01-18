/**
 * Semantic Memory Compression (Ralph Iteration 7, Feature 1)
 *
 * Intelligent memory summarization with hierarchical structures,
 * concept extraction, and context-aware retrieval.
 */
// ============================================================================
// Semantic Memory Compressor
// ============================================================================
export class SemanticMemoryCompressor {
    config;
    hierarchy;
    conceptGraph;
    clusters;
    memoryImportance;
    constructor(config = {}) {
        this.config = {
            episodeWindowSize: 5,
            patternMinFrequency: 3,
            principleMinSupport: 2,
            importanceDecayRate: 0.01,
            reinforcementBoost: 0.1,
            maxClusters: 100,
            similarityThreshold: 0.7,
            ...config
        };
        this.hierarchy = {
            episodes: [],
            patterns: [],
            principles: []
        };
        this.conceptGraph = new Map();
        this.clusters = new Map();
        this.memoryImportance = new Map();
    }
    /**
     * Compress a batch of memories into episodes
     */
    compressToEpisodes(memories) {
        const episodes = [];
        const windowSize = this.config.episodeWindowSize;
        // Sort by timestamp
        const sorted = [...memories].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        // Create episodes from windows
        for (let i = 0; i < sorted.length; i += windowSize) {
            const window = sorted.slice(i, i + windowSize);
            if (window.length < 2)
                continue;
            const episode = this.createEpisode(window);
            episodes.push(episode);
        }
        this.hierarchy.episodes.push(...episodes);
        return episodes;
    }
    /**
     * Create a single episode from a group of memories
     */
    createEpisode(memories) {
        const summary = this.summarizeMemories(memories);
        const entities = this.extractEntities(memories);
        const valence = this.calculateEmotionalValence(memories);
        const importance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
        return {
            id: `episode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            summary,
            originalIds: memories.map(m => m.id),
            timeRange: {
                start: memories[0].timestamp,
                end: memories[memories.length - 1].timestamp
            },
            keyEntities: entities,
            emotionalValence: valence,
            importance
        };
    }
    /**
     * Summarize a group of memories into a concise description
     */
    summarizeMemories(memories) {
        const contents = memories.map(m => m.content);
        // Extract key phrases (simple implementation)
        const words = contents.join(' ').toLowerCase().split(/\s+/);
        const wordFreq = new Map();
        for (const word of words) {
            if (word.length > 3) {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
        }
        // Get top words
        const topWords = [...wordFreq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
        return `Episode covering: ${topWords.join(', ')} (${memories.length} memories)`;
    }
    /**
     * Extract named entities from memories
     */
    extractEntities(memories) {
        const entities = new Set();
        for (const memory of memories) {
            // Simple entity extraction: capitalized words
            const matches = memory.content.match(/\b[A-Z][a-z]+\b/g) || [];
            matches.forEach(m => entities.add(m));
        }
        return [...entities].slice(0, 10);
    }
    /**
     * Calculate emotional valence of memories
     */
    calculateEmotionalValence(memories) {
        const positiveWords = ['good', 'great', 'happy', 'success', 'love', 'excellent'];
        const negativeWords = ['bad', 'sad', 'fail', 'hate', 'terrible', 'wrong'];
        let score = 0;
        for (const memory of memories) {
            const lower = memory.content.toLowerCase();
            for (const word of positiveWords) {
                if (lower.includes(word))
                    score += 0.1;
            }
            for (const word of negativeWords) {
                if (lower.includes(word))
                    score -= 0.1;
            }
        }
        return Math.max(-1, Math.min(1, score));
    }
    /**
     * Extract patterns from episodes
     */
    extractPatterns() {
        const patterns = [];
        const entityCooccurrence = new Map();
        // Build co-occurrence matrix
        for (const episode of this.hierarchy.episodes) {
            for (let i = 0; i < episode.keyEntities.length; i++) {
                for (let j = i + 1; j < episode.keyEntities.length; j++) {
                    const e1 = episode.keyEntities[i];
                    const e2 = episode.keyEntities[j];
                    if (!entityCooccurrence.has(e1)) {
                        entityCooccurrence.set(e1, new Map());
                    }
                    const coMap = entityCooccurrence.get(e1);
                    coMap.set(e2, (coMap.get(e2) || 0) + 1);
                }
            }
        }
        // Find frequent patterns
        for (const [e1, coMap] of entityCooccurrence) {
            for (const [e2, freq] of coMap) {
                if (freq >= this.config.patternMinFrequency) {
                    const relatedEpisodes = this.hierarchy.episodes
                        .filter(ep => ep.keyEntities.includes(e1) && ep.keyEntities.includes(e2))
                        .map(ep => ep.id);
                    patterns.push({
                        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        description: `Co-occurrence of ${e1} and ${e2}`,
                        episodeIds: relatedEpisodes,
                        frequency: freq,
                        confidence: Math.min(1, freq / 10),
                        context: [e1, e2]
                    });
                }
            }
        }
        this.hierarchy.patterns.push(...patterns);
        return patterns;
    }
    /**
     * Derive core principles from patterns
     */
    derivePrinciples() {
        const principles = [];
        const patternGroups = new Map();
        // Group patterns by shared context
        for (const pattern of this.hierarchy.patterns) {
            const key = pattern.context.sort().join('|');
            if (!patternGroups.has(key)) {
                patternGroups.set(key, []);
            }
            patternGroups.get(key).push(pattern);
        }
        // Create principles from groups
        for (const [_key, group] of patternGroups) {
            if (group.length >= this.config.principleMinSupport) {
                const avgConfidence = group.reduce((s, p) => s + p.confidence, 0) / group.length;
                principles.push({
                    id: `principle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    statement: `Principle derived from ${group.length} patterns involving: ${group[0].context.join(', ')}`,
                    supportingPatterns: group.map(p => p.id),
                    strength: avgConfidence,
                    lastReinforced: new Date()
                });
            }
        }
        this.hierarchy.principles.push(...principles);
        return principles;
    }
    /**
     * Cluster memories by semantic similarity
     */
    clusterMemories(memories) {
        const newClusters = [];
        // Group memories with embeddings
        const withEmbeddings = memories.filter(m => m.embedding && m.embedding.length > 0);
        const unassigned = new Set(withEmbeddings.map(m => m.id));
        while (unassigned.size > 0 && newClusters.length < this.config.maxClusters) {
            // Pick a random seed
            const seedId = [...unassigned][0];
            const seed = withEmbeddings.find(m => m.id === seedId);
            unassigned.delete(seedId);
            const clusterMembers = [seedId];
            const centroid = [...seed.embedding];
            // Find similar memories
            for (const id of [...unassigned]) {
                const memory = withEmbeddings.find(m => m.id === id);
                const similarity = this.cosineSimilarity(centroid, memory.embedding);
                if (similarity >= this.config.similarityThreshold) {
                    clusterMembers.push(id);
                    unassigned.delete(id);
                    // Update centroid
                    for (let i = 0; i < centroid.length; i++) {
                        centroid[i] = (centroid[i] * (clusterMembers.length - 1) + memory.embedding[i]) / clusterMembers.length;
                    }
                }
            }
            const cluster = {
                id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                centroid,
                memories: clusterMembers,
                concept: this.labelCluster(clusterMembers, withEmbeddings),
                importance: this.calculateClusterImportance(clusterMembers, withEmbeddings),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            newClusters.push(cluster);
            this.clusters.set(cluster.id, cluster);
        }
        return newClusters;
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0)
            return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    /**
     * Generate a label for a cluster
     */
    labelCluster(memberIds, memories) {
        const members = memories.filter(m => memberIds.includes(m.id));
        const words = members
            .flatMap(m => m.content.toLowerCase().split(/\s+/))
            .filter(w => w.length > 4);
        const freq = new Map();
        for (const word of words) {
            freq.set(word, (freq.get(word) || 0) + 1);
        }
        const topWord = [...freq.entries()]
            .sort((a, b) => b[1] - a[1])[0];
        return topWord ? `Cluster: ${topWord[0]}` : 'Unlabeled cluster';
    }
    /**
     * Calculate average importance of cluster members
     */
    calculateClusterImportance(memberIds, memories) {
        const members = memories.filter(m => memberIds.includes(m.id));
        if (members.length === 0)
            return 0;
        return members.reduce((s, m) => s + m.importance, 0) / members.length;
    }
    /**
     * Update memory importance with decay
     */
    applyImportanceDecay() {
        const now = Date.now();
        for (const [id, data] of this.memoryImportance) {
            const hoursSinceAccess = (now - data.lastAccess.getTime()) / (1000 * 60 * 60);
            const decayFactor = Math.exp(-this.config.importanceDecayRate * hoursSinceAccess);
            data.value *= decayFactor;
            // Remove if below threshold
            if (data.value < 0.01) {
                this.memoryImportance.delete(id);
            }
        }
    }
    /**
     * Reinforce memory importance on access
     */
    reinforceMemory(memoryId, baseImportance = 0.5) {
        const existing = this.memoryImportance.get(memoryId);
        const newValue = existing
            ? Math.min(1, existing.value + this.config.reinforcementBoost)
            : baseImportance;
        this.memoryImportance.set(memoryId, {
            value: newValue,
            lastAccess: new Date()
        });
    }
    /**
     * Get current importance of a memory
     */
    getMemoryImportance(memoryId) {
        return this.memoryImportance.get(memoryId)?.value ?? 0;
    }
    /**
     * Context-aware memory retrieval
     */
    retrieveRelevant(queryEmbedding, memories, stance, limit = 10) {
        // Score each memory
        const scored = memories
            .filter(m => m.embedding && m.embedding.length > 0)
            .map(m => {
            // Semantic similarity
            const similarity = this.cosineSimilarity(queryEmbedding, m.embedding);
            // Importance score
            const importance = this.getMemoryImportance(m.id) || m.importance;
            // Recency bonus
            const hoursSince = (Date.now() - m.timestamp.getTime()) / (1000 * 60 * 60);
            const recency = Math.exp(-hoursSince / 168); // Week decay
            // Stance alignment bonus
            const stanceBonus = this.calculateStanceAlignment(m, stance);
            // Combined score
            const score = similarity * 0.4 + importance * 0.3 + recency * 0.2 + stanceBonus * 0.1;
            return { memory: m, score };
        });
        // Sort and return top results
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.memory);
    }
    /**
     * Calculate how well a memory aligns with current stance
     */
    calculateStanceAlignment(memory, stance) {
        // Check if memory metadata contains stance info
        const memoryFrame = memory.metadata?.frame;
        if (memoryFrame && memoryFrame === stance.frame) {
            return 1;
        }
        // Check for value alignment in content
        const stanceValues = Object.entries(stance.values)
            .filter(([_, v]) => v > 70)
            .map(([k]) => k);
        let alignment = 0;
        for (const value of stanceValues) {
            if (memory.content.toLowerCase().includes(value)) {
                alignment += 0.2;
            }
        }
        return Math.min(1, alignment);
    }
    /**
     * Add concept to the knowledge graph
     */
    addConcept(label, type, connections = []) {
        const existing = this.conceptGraph.get(label);
        if (existing) {
            existing.frequency++;
            existing.lastSeen = new Date();
            for (const conn of connections) {
                const existingConn = existing.connections.find(c => c.targetId === conn.targetId);
                if (existingConn) {
                    existingConn.weight = Math.min(1, existingConn.weight + 0.1);
                }
                else {
                    existing.connections.push(conn);
                }
            }
            return existing;
        }
        const node = {
            id: `concept-${label}-${Date.now()}`,
            label,
            type,
            connections,
            frequency: 1,
            lastSeen: new Date()
        };
        this.conceptGraph.set(label, node);
        return node;
    }
    /**
     * Get related concepts
     */
    getRelatedConcepts(label, depth = 2) {
        const node = this.conceptGraph.get(label);
        if (!node)
            return [];
        const visited = new Set([label]);
        const related = [];
        let frontier = [node];
        for (let d = 0; d < depth && frontier.length > 0; d++) {
            const newFrontier = [];
            for (const current of frontier) {
                for (const conn of current.connections) {
                    if (!visited.has(conn.targetId)) {
                        const target = this.conceptGraph.get(conn.targetId);
                        if (target) {
                            visited.add(conn.targetId);
                            related.push(target);
                            newFrontier.push(target);
                        }
                    }
                }
            }
            frontier = newFrontier;
        }
        return related;
    }
    /**
     * Get compression statistics
     */
    getStats() {
        return {
            totalMemories: this.memoryImportance.size,
            compressedEpisodes: this.hierarchy.episodes.length,
            extractedPatterns: this.hierarchy.patterns.length,
            corePrinciples: this.hierarchy.principles.length,
            conceptNodes: this.conceptGraph.size,
            compressionRatio: this.hierarchy.episodes.length > 0
                ? this.hierarchy.episodes.reduce((s, e) => s + e.originalIds.length, 0) / this.hierarchy.episodes.length
                : 0,
            lastCompression: this.hierarchy.episodes.length > 0
                ? new Date(Math.max(...this.hierarchy.episodes.map(e => e.timeRange.end.getTime())))
                : null
        };
    }
    /**
     * Get the full hierarchy
     */
    getHierarchy() {
        return { ...this.hierarchy };
    }
    /**
     * Export state for persistence
     */
    export() {
        return {
            config: this.config,
            hierarchy: this.hierarchy,
            concepts: [...this.conceptGraph.values()],
            clusters: [...this.clusters.values()],
            importance: [...this.memoryImportance.entries()].map(([id, data]) => ({
                id,
                value: data.value,
                lastAccess: data.lastAccess.toISOString()
            }))
        };
    }
    /**
     * Import state from persistence
     */
    import(data) {
        this.config = { ...this.config, ...data.config };
        this.hierarchy = data.hierarchy;
        this.conceptGraph.clear();
        for (const concept of data.concepts) {
            this.conceptGraph.set(concept.label, concept);
        }
        this.clusters.clear();
        for (const cluster of data.clusters) {
            this.clusters.set(cluster.id, cluster);
        }
        this.memoryImportance.clear();
        for (const item of data.importance) {
            this.memoryImportance.set(item.id, {
                value: item.value,
                lastAccess: new Date(item.lastAccess)
            });
        }
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const memoryCompressor = new SemanticMemoryCompressor();
//# sourceMappingURL=compression.js.map