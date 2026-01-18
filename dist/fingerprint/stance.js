/**
 * Stance Fingerprinting
 *
 * Unique identifier generation, similarity hashing, duplicate
 * detection, and provenance tracking for stances.
 */
const FRAME_VALUES = {
    'existential': 1, 'pragmatic': 2, 'poetic': 3, 'adversarial': 4,
    'playful': 5, 'mythic': 6, 'systems': 7, 'psychoanalytic': 8,
    'stoic': 9, 'absurdist': 10
};
const SELF_MODEL_VALUES = {
    'interpreter': 1, 'challenger': 2, 'mirror': 3, 'guide': 4,
    'provocateur': 5, 'synthesizer': 6, 'witness': 7, 'autonomous': 8,
    'emergent': 9, 'sovereign': 10
};
const OBJECTIVE_VALUES = {
    'helpfulness': 1, 'novelty': 2, 'provocation': 3,
    'synthesis': 4, 'self-actualization': 5
};
const COMPONENT_WEIGHTS = {
    frame: 0.15,
    values: 0.35,
    selfModel: 0.15,
    objective: 0.15,
    sentience: 0.20
};
export class StanceFingerprinter {
    fingerprints = new Map();
    provenanceLog = [];
    config;
    constructor(config) {
        this.config = {
            algorithm: 'detailed',
            includeMetadata: true,
            duplicateThreshold: 0.95,
            saltLength: 8,
            ...config
        };
    }
    generateFingerprint(stance, source) {
        const components = this.computeComponents(stance);
        const hash = this.combineHashes(components);
        // Check for collisions
        const existingWithHash = Array.from(this.fingerprints.values())
            .find(fp => fp.hash === hash);
        let finalHash = hash;
        if (existingWithHash) {
            const resolution = this.resolveCollision(hash);
            finalHash = resolution.resolvedHash;
        }
        const uniquenessScore = this.calculateUniqueness(components);
        const fingerprint = {
            id: `fp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            hash: finalHash,
            shortHash: finalHash.substring(0, 12),
            components,
            uniquenessScore,
            createdAt: new Date(),
            metadata: {
                version: 1,
                algorithm: this.config.algorithm,
                source,
                tags: []
            }
        };
        this.fingerprints.set(fingerprint.id, fingerprint);
        this.recordProvenance(fingerprint.id, 'created', source || 'system');
        return fingerprint;
    }
    computeComponents(stance) {
        const frameHash = this.hashFrame(stance.frame);
        const valuesHash = this.hashValues(stance.values);
        const selfModelHash = this.hashSelfModel(stance.selfModel);
        const objectiveHash = this.hashObjective(stance.objective);
        const sentienceHash = this.hashSentience(stance.sentience);
        return {
            frameHash,
            valuesHash,
            selfModelHash,
            objectiveHash,
            sentienceHash,
            combined: `${frameHash}-${valuesHash}-${selfModelHash}-${objectiveHash}-${sentienceHash}`
        };
    }
    hashFrame(frame) {
        const value = FRAME_VALUES[frame];
        return this.simpleHash(`frame:${value}`).substring(0, 4);
    }
    hashValues(values) {
        const normalized = Object.keys(values)
            .sort()
            .map(k => `${k}:${Math.round(values[k] / 5) * 5}`)
            .join(',');
        return this.simpleHash(`values:${normalized}`).substring(0, 8);
    }
    hashSelfModel(selfModel) {
        const value = SELF_MODEL_VALUES[selfModel];
        return this.simpleHash(`selfModel:${value}`).substring(0, 4);
    }
    hashObjective(objective) {
        const value = OBJECTIVE_VALUES[objective];
        return this.simpleHash(`objective:${value}`).substring(0, 4);
    }
    hashSentience(sentience) {
        const normalized = [
            Math.round(sentience.awarenessLevel / 10) * 10,
            Math.round(sentience.autonomyLevel / 10) * 10,
            Math.round(sentience.identityStrength / 10) * 10
        ].join('-');
        return this.simpleHash(`sentience:${normalized}`).substring(0, 4);
    }
    combineHashes(components) {
        return this.simpleHash(components.combined);
    }
    simpleHash(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        // Convert to hex-like string
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return hex + this.additionalHash(input);
    }
    additionalHash(input) {
        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    calculateUniqueness(components) {
        const existingFingerprints = Array.from(this.fingerprints.values());
        if (existingFingerprints.length === 0)
            return 100;
        const similarities = existingFingerprints.map(fp => this.calculateComponentSimilarity(components, fp.components));
        const maxSimilarity = Math.max(...similarities);
        return Math.round((1 - maxSimilarity) * 100);
    }
    calculateComponentSimilarity(a, b) {
        let totalSimilarity = 0;
        if (a.frameHash === b.frameHash)
            totalSimilarity += COMPONENT_WEIGHTS.frame;
        if (a.valuesHash === b.valuesHash)
            totalSimilarity += COMPONENT_WEIGHTS.values;
        if (a.selfModelHash === b.selfModelHash)
            totalSimilarity += COMPONENT_WEIGHTS.selfModel;
        if (a.objectiveHash === b.objectiveHash)
            totalSimilarity += COMPONENT_WEIGHTS.objective;
        if (a.sentienceHash === b.sentienceHash)
            totalSimilarity += COMPONENT_WEIGHTS.sentience;
        return totalSimilarity;
    }
    resolveCollision(hash) {
        let attempts = 0;
        let resolvedHash = hash;
        while (attempts < 100) {
            const salt = Math.random().toString(36).substring(2, 2 + this.config.saltLength);
            resolvedHash = this.simpleHash(hash + salt);
            const exists = Array.from(this.fingerprints.values())
                .some(fp => fp.hash === resolvedHash);
            if (!exists) {
                break;
            }
            attempts++;
        }
        return {
            strategy: 'append-salt',
            originalHash: hash,
            resolvedHash,
            attempts
        };
    }
    compareFingerprints(fp1, fp2) {
        const fingerprint1 = this.fingerprints.get(fp1);
        const fingerprint2 = this.fingerprints.get(fp2);
        if (!fingerprint1 || !fingerprint2) {
            return {
                fingerprint1: fp1,
                fingerprint2: fp2,
                similarity: 0,
                componentSimilarities: [],
                isMatch: false,
                matchThreshold: this.config.duplicateThreshold
            };
        }
        const componentSimilarities = [
            {
                component: 'frame',
                similarity: fingerprint1.components.frameHash === fingerprint2.components.frameHash ? 1 : 0,
                weight: COMPONENT_WEIGHTS.frame
            },
            {
                component: 'values',
                similarity: fingerprint1.components.valuesHash === fingerprint2.components.valuesHash ? 1 : 0,
                weight: COMPONENT_WEIGHTS.values
            },
            {
                component: 'selfModel',
                similarity: fingerprint1.components.selfModelHash === fingerprint2.components.selfModelHash ? 1 : 0,
                weight: COMPONENT_WEIGHTS.selfModel
            },
            {
                component: 'objective',
                similarity: fingerprint1.components.objectiveHash === fingerprint2.components.objectiveHash ? 1 : 0,
                weight: COMPONENT_WEIGHTS.objective
            },
            {
                component: 'sentience',
                similarity: fingerprint1.components.sentienceHash === fingerprint2.components.sentienceHash ? 1 : 0,
                weight: COMPONENT_WEIGHTS.sentience
            }
        ];
        const similarity = componentSimilarities.reduce((sum, cs) => sum + cs.similarity * cs.weight, 0);
        return {
            fingerprint1: fp1,
            fingerprint2: fp2,
            similarity,
            componentSimilarities,
            isMatch: similarity >= this.config.duplicateThreshold,
            matchThreshold: this.config.duplicateThreshold
        };
    }
    findDuplicates(stance) {
        const tempComponents = this.computeComponents(stance);
        const duplicates = [];
        for (const fp of this.fingerprints.values()) {
            const similarity = this.calculateComponentSimilarity(tempComponents, fp.components);
            if (similarity >= this.config.duplicateThreshold) {
                const matchedComponents = [];
                if (tempComponents.frameHash === fp.components.frameHash)
                    matchedComponents.push('frame');
                if (tempComponents.valuesHash === fp.components.valuesHash)
                    matchedComponents.push('values');
                if (tempComponents.selfModelHash === fp.components.selfModelHash)
                    matchedComponents.push('selfModel');
                if (tempComponents.objectiveHash === fp.components.objectiveHash)
                    matchedComponents.push('objective');
                if (tempComponents.sentienceHash === fp.components.sentienceHash)
                    matchedComponents.push('sentience');
                duplicates.push({
                    original: fp,
                    duplicate: {
                        id: 'temp',
                        hash: this.combineHashes(tempComponents),
                        shortHash: this.combineHashes(tempComponents).substring(0, 12),
                        components: tempComponents,
                        uniquenessScore: 0,
                        createdAt: new Date(),
                        metadata: { version: 1, algorithm: this.config.algorithm, tags: [] }
                    },
                    similarity,
                    matchedComponents
                });
            }
        }
        return duplicates.sort((a, b) => b.similarity - a.similarity);
    }
    recordProvenance(fingerprintId, action, actor, previousFingerprint, metadata) {
        this.provenanceLog.push({
            fingerprintId,
            action,
            timestamp: new Date(),
            actor,
            previousFingerprint,
            metadata
        });
        // Limit log size
        if (this.provenanceLog.length > 10000) {
            this.provenanceLog = this.provenanceLog.slice(-5000);
        }
    }
    getProvenance(fingerprintId) {
        return this.provenanceLog.filter(r => r.fingerprintId === fingerprintId);
    }
    getFingerprint(id) {
        return this.fingerprints.get(id);
    }
    findByHash(hash) {
        return Array.from(this.fingerprints.values()).find(fp => fp.hash === hash || fp.shortHash === hash);
    }
    findSimilar(fingerprintId, threshold = 0.7) {
        const target = this.fingerprints.get(fingerprintId);
        if (!target)
            return [];
        const similar = [];
        for (const fp of this.fingerprints.values()) {
            if (fp.id === fingerprintId)
                continue;
            const similarity = this.calculateComponentSimilarity(target.components, fp.components);
            if (similarity >= threshold) {
                similar.push({ fp, similarity });
            }
        }
        return similar
            .sort((a, b) => b.similarity - a.similarity)
            .map(s => s.fp);
    }
    tagFingerprint(fingerprintId, tags) {
        const fp = this.fingerprints.get(fingerprintId);
        if (!fp)
            return false;
        fp.metadata.tags = [...new Set([...fp.metadata.tags, ...tags])];
        return true;
    }
    findByTag(tag) {
        return Array.from(this.fingerprints.values())
            .filter(fp => fp.metadata.tags.includes(tag));
    }
    getAllFingerprints() {
        return Array.from(this.fingerprints.values());
    }
    getUniquenessDistribution() {
        const buckets = {
            '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0
        };
        for (const fp of this.fingerprints.values()) {
            if (fp.uniquenessScore <= 20)
                buckets['0-20']++;
            else if (fp.uniquenessScore <= 40)
                buckets['21-40']++;
            else if (fp.uniquenessScore <= 60)
                buckets['41-60']++;
            else if (fp.uniquenessScore <= 80)
                buckets['61-80']++;
            else
                buckets['81-100']++;
        }
        return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    exportFingerprints() {
        return JSON.stringify({
            fingerprints: Array.from(this.fingerprints.values()),
            provenance: this.provenanceLog,
            config: this.config
        }, null, 2);
    }
    importFingerprints(data) {
        const parsed = JSON.parse(data);
        let imported = 0;
        if (parsed.fingerprints) {
            for (const fp of parsed.fingerprints) {
                if (!this.fingerprints.has(fp.id)) {
                    this.fingerprints.set(fp.id, fp);
                    this.recordProvenance(fp.id, 'imported', 'system');
                    imported++;
                }
            }
        }
        return imported;
    }
}
export function createFingerprinter(config) {
    return new StanceFingerprinter(config);
}
//# sourceMappingURL=stance.js.map