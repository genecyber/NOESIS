/**
 * Custom Training Data Export (Ralph Iteration 10, Feature 1)
 *
 * Fine-tuning dataset generation from stance patterns, JSONL export,
 * privacy-aware sanitization, and quality scoring.
 */
// ============================================================================
// Training Data Export Manager
// ============================================================================
export class TrainingDataExporter {
    config;
    privacyConfig;
    examples = [];
    versions = new Map();
    stats;
    constructor(config = {}, privacyConfig = {}) {
        this.config = {
            format: 'jsonl',
            includeMetadata: true,
            sanitizePrivacy: true,
            minQualityScore: 0.5,
            maxExamples: 10000,
            splitRatio: { train: 0.8, validation: 0.1, test: 0.1 },
            ...config
        };
        this.privacyConfig = {
            anonymizeUserIds: true,
            removePersonalInfo: true,
            hashSensitiveData: true,
            excludePatterns: ['email', 'phone', 'address', 'ssn', 'credit'],
            ...privacyConfig
        };
        this.stats = {
            totalVersions: 0,
            totalExamples: 0,
            averageQuality: 0,
            frameDistribution: {},
            operatorDistribution: {}
        };
    }
    /**
     * Add a training example
     */
    addExample(input, output, stanceBefore, stanceAfter, operator, metadata = {}) {
        const qualityScore = this.calculateQualityScore(input, output, stanceBefore, stanceAfter);
        const example = {
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            input,
            output,
            stanceBefore,
            stanceAfter,
            operator,
            qualityScore,
            annotations: [],
            metadata: {
                sessionId: metadata.sessionId || 'unknown',
                timestamp: metadata.timestamp || new Date(),
                turnNumber: metadata.turnNumber || 0,
                driftCost: metadata.driftCost || 0,
                userSatisfaction: metadata.userSatisfaction
            }
        };
        this.examples.push(example);
        this.updateStats(example);
        return example;
    }
    /**
     * Calculate quality score for an example
     */
    calculateQualityScore(input, output, stanceBefore, stanceAfter) {
        let score = 0.5; // Base score
        // Length factor (not too short, not too long)
        const inputLen = input.length;
        const outputLen = output.length;
        if (inputLen >= 10 && inputLen <= 1000)
            score += 0.1;
        if (outputLen >= 20 && outputLen <= 2000)
            score += 0.1;
        // Transformation depth
        const valueChanges = Object.keys(stanceBefore.values).reduce((sum, key) => {
            const beforeValues = stanceBefore.values;
            const afterValues = stanceAfter.values;
            return sum + Math.abs(afterValues[key] - beforeValues[key]);
        }, 0);
        const avgChange = valueChanges / Object.keys(stanceBefore.values).length;
        if (avgChange > 5)
            score += 0.1;
        if (avgChange > 10)
            score += 0.1;
        // Coherence maintenance
        const coherenceChange = stanceAfter.cumulativeDrift - stanceBefore.cumulativeDrift;
        if (coherenceChange < 5)
            score += 0.1;
        return Math.min(score, 1.0);
    }
    /**
     * Update statistics
     */
    updateStats(example) {
        const n = this.examples.length;
        this.stats.totalExamples = n;
        this.stats.averageQuality = (this.stats.averageQuality * (n - 1) + example.qualityScore) / n;
        // Update frame distribution
        const frame = example.stanceAfter.frame;
        this.stats.frameDistribution[frame] = (this.stats.frameDistribution[frame] || 0) + 1;
        // Update operator distribution
        this.stats.operatorDistribution[example.operator] =
            (this.stats.operatorDistribution[example.operator] || 0) + 1;
    }
    /**
     * Add annotation to an example
     */
    addAnnotation(exampleId, type, label, confidence = 1.0, annotator = 'system') {
        const example = this.examples.find(e => e.id === exampleId);
        if (!example)
            return null;
        const annotation = {
            id: `ann-${Date.now()}`,
            type,
            label,
            confidence,
            annotator,
            timestamp: new Date()
        };
        example.annotations.push(annotation);
        return annotation;
    }
    /**
     * Sanitize example for privacy
     */
    sanitizeExample(example) {
        if (!this.config.sanitizePrivacy)
            return example;
        const sanitized = JSON.parse(JSON.stringify(example));
        // Anonymize user ID
        if (this.privacyConfig.anonymizeUserIds) {
            sanitized.metadata.sessionId = this.hashString(sanitized.metadata.sessionId);
        }
        // Remove personal info patterns
        if (this.privacyConfig.removePersonalInfo) {
            sanitized.input = this.removeSensitivePatterns(sanitized.input);
            sanitized.output = this.removeSensitivePatterns(sanitized.output);
        }
        return sanitized;
    }
    /**
     * Hash a string (simple hash for demo)
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `anon-${Math.abs(hash).toString(36)}`;
    }
    /**
     * Remove sensitive patterns from text
     */
    removeSensitivePatterns(text) {
        let result = text;
        // Email pattern
        result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
        // Phone pattern
        result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
        // Custom patterns
        for (const pattern of this.privacyConfig.excludePatterns) {
            const regex = new RegExp(pattern, 'gi');
            result = result.replace(regex, `[${pattern.toUpperCase()}]`);
        }
        return result;
    }
    /**
     * Split examples into train/validation/test
     */
    splitExamples(examples) {
        const shuffled = [...examples].sort(() => Math.random() - 0.5);
        const total = shuffled.length;
        const trainEnd = Math.floor(total * this.config.splitRatio.train);
        const validEnd = trainEnd + Math.floor(total * this.config.splitRatio.validation);
        return {
            train: shuffled.slice(0, trainEnd),
            validation: shuffled.slice(trainEnd, validEnd),
            test: shuffled.slice(validEnd)
        };
    }
    /**
     * Export dataset to JSONL format
     */
    exportToJSONL(examples) {
        return examples
            .map(ex => JSON.stringify({
            prompt: ex.input,
            completion: ex.output,
            frame: ex.stanceAfter.frame,
            operator: ex.operator,
            quality: ex.qualityScore,
            ...(this.config.includeMetadata ? { metadata: ex.metadata } : {})
        }))
            .join('\n');
    }
    /**
     * Export dataset to JSON format
     */
    exportToJSON(examples) {
        return JSON.stringify({
            version: '1.0',
            format: 'claude-fine-tune',
            examples: examples.map(ex => ({
                prompt: ex.input,
                completion: ex.output,
                frame: ex.stanceAfter.frame,
                operator: ex.operator,
                quality: ex.qualityScore,
                annotations: ex.annotations,
                ...(this.config.includeMetadata ? { metadata: ex.metadata } : {})
            }))
        }, null, 2);
    }
    /**
     * Export dataset to CSV format
     */
    exportToCSV(examples) {
        const headers = ['id', 'input', 'output', 'frame', 'operator', 'quality'];
        const rows = examples.map(ex => [
            ex.id,
            `"${ex.input.replace(/"/g, '""')}"`,
            `"${ex.output.replace(/"/g, '""')}"`,
            ex.stanceAfter.frame,
            ex.operator,
            ex.qualityScore.toFixed(3)
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    /**
     * Create a versioned dataset export
     */
    createVersion(name, description = '') {
        const startTime = Date.now();
        const warnings = [];
        // Filter by quality
        let filtered = this.examples.filter(ex => ex.qualityScore >= this.config.minQualityScore);
        const filteredByQuality = this.examples.length - filtered.length;
        // Sanitize for privacy
        const sanitized = filtered.map(ex => this.sanitizeExample(ex));
        const filteredByPrivacy = filtered.length - sanitized.length;
        // Limit examples
        if (sanitized.length > this.config.maxExamples) {
            sanitized.length = this.config.maxExamples;
            warnings.push(`Limited to ${this.config.maxExamples} examples`);
        }
        // Split data
        const splits = this.splitExamples(sanitized);
        // Calculate quality stats
        const scores = sanitized.map(ex => ex.qualityScore);
        const qualityStats = {
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            minScore: Math.min(...scores),
            maxScore: Math.max(...scores),
            distribution: this.calculateScoreDistribution(scores)
        };
        // Create version
        const version = {
            id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name,
            description,
            createdAt: new Date(),
            exampleCount: sanitized.length,
            qualityStats,
            splits
        };
        this.versions.set(version.id, version);
        this.stats.totalVersions++;
        // Export based on format (methods called for side effects)
        switch (this.config.format) {
            case 'jsonl':
                void this.exportToJSONL(sanitized);
                break;
            case 'json':
                void this.exportToJSON(sanitized);
                break;
            case 'csv':
                void this.exportToCSV(sanitized);
                break;
            default:
                void this.exportToJSONL(sanitized);
        }
        const exportTime = Date.now() - startTime;
        return {
            success: true,
            version,
            filePath: `metamorph-training-${version.id}.${this.config.format}`,
            stats: {
                totalExamples: this.examples.length,
                includedExamples: sanitized.length,
                filteredByQuality,
                filteredByPrivacy,
                exportTime
            },
            warnings
        };
    }
    /**
     * Calculate score distribution
     */
    calculateScoreDistribution(scores) {
        const buckets = {
            'low (0-0.3)': 0,
            'medium (0.3-0.6)': 0,
            'high (0.6-0.8)': 0,
            'excellent (0.8-1.0)': 0
        };
        for (const score of scores) {
            if (score < 0.3)
                buckets['low (0-0.3)']++;
            else if (score < 0.6)
                buckets['medium (0.3-0.6)']++;
            else if (score < 0.8)
                buckets['high (0.6-0.8)']++;
            else
                buckets['excellent (0.8-1.0)']++;
        }
        return buckets;
    }
    /**
     * Get example by ID
     */
    getExample(exampleId) {
        return this.examples.find(e => e.id === exampleId) || null;
    }
    /**
     * Get all examples
     */
    getExamples(minQuality) {
        if (minQuality !== undefined) {
            return this.examples.filter(e => e.qualityScore >= minQuality);
        }
        return [...this.examples];
    }
    /**
     * Get version by ID
     */
    getVersion(versionId) {
        return this.versions.get(versionId) || null;
    }
    /**
     * List all versions
     */
    listVersions() {
        return [...this.versions.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Delete an example
     */
    deleteExample(exampleId) {
        const index = this.examples.findIndex(e => e.id === exampleId);
        if (index === -1)
            return false;
        this.examples.splice(index, 1);
        return true;
    }
    /**
     * Clear all examples
     */
    clearExamples() {
        this.examples = [];
        this.stats = {
            totalVersions: this.stats.totalVersions,
            totalExamples: 0,
            averageQuality: 0,
            frameDistribution: {},
            operatorDistribution: {}
        };
    }
    /**
     * Reset manager
     */
    reset() {
        this.examples = [];
        this.versions.clear();
        this.stats = {
            totalVersions: 0,
            totalExamples: 0,
            averageQuality: 0,
            frameDistribution: {},
            operatorDistribution: {}
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
export const trainingDataExporter = new TrainingDataExporter();
//# sourceMappingURL=data-export.js.map