/**
 * Stance Fingerprinting
 *
 * Unique identifier generation, similarity hashing, duplicate
 * detection, and provenance tracking for stances.
 */
import type { Stance } from '../types/index.js';
export interface StanceFingerprint {
    id: string;
    hash: string;
    shortHash: string;
    components: FingerprintComponents;
    uniquenessScore: number;
    createdAt: Date;
    metadata: FingerprintMetadata;
}
export interface FingerprintComponents {
    frameHash: string;
    valuesHash: string;
    selfModelHash: string;
    objectiveHash: string;
    sentienceHash: string;
    combined: string;
}
export interface FingerprintMetadata {
    version: number;
    algorithm: string;
    source?: string;
    tags: string[];
}
export interface SimilarityResult {
    fingerprint1: string;
    fingerprint2: string;
    similarity: number;
    componentSimilarities: ComponentSimilarity[];
    isMatch: boolean;
    matchThreshold: number;
}
export interface ComponentSimilarity {
    component: string;
    similarity: number;
    weight: number;
}
export interface DuplicateMatch {
    original: StanceFingerprint;
    duplicate: StanceFingerprint;
    similarity: number;
    matchedComponents: string[];
}
export interface ProvenanceRecord {
    fingerprintId: string;
    action: ProvenanceAction;
    timestamp: Date;
    actor: string;
    previousFingerprint?: string;
    metadata?: Record<string, unknown>;
}
export type ProvenanceAction = 'created' | 'modified' | 'cloned' | 'merged' | 'imported' | 'exported';
export interface CollisionResolution {
    strategy: 'append-salt' | 'increment' | 'rehash' | 'manual';
    originalHash: string;
    resolvedHash: string;
    attempts: number;
}
export interface FingerprintConfig {
    algorithm: 'simple' | 'detailed' | 'secure';
    includeMetadata: boolean;
    duplicateThreshold: number;
    saltLength: number;
}
export declare class StanceFingerprinter {
    private fingerprints;
    private provenanceLog;
    private config;
    constructor(config?: Partial<FingerprintConfig>);
    generateFingerprint(stance: Stance, source?: string): StanceFingerprint;
    private computeComponents;
    private hashFrame;
    private hashValues;
    private hashSelfModel;
    private hashObjective;
    private hashSentience;
    private combineHashes;
    private simpleHash;
    private additionalHash;
    private calculateUniqueness;
    private calculateComponentSimilarity;
    private resolveCollision;
    compareFingerprints(fp1: string, fp2: string): SimilarityResult;
    findDuplicates(stance: Stance): DuplicateMatch[];
    private recordProvenance;
    getProvenance(fingerprintId: string): ProvenanceRecord[];
    getFingerprint(id: string): StanceFingerprint | undefined;
    findByHash(hash: string): StanceFingerprint | undefined;
    findSimilar(fingerprintId: string, threshold?: number): StanceFingerprint[];
    tagFingerprint(fingerprintId: string, tags: string[]): boolean;
    findByTag(tag: string): StanceFingerprint[];
    getAllFingerprints(): StanceFingerprint[];
    getUniquenessDistribution(): {
        bucket: string;
        count: number;
    }[];
    updateConfig(config: Partial<FingerprintConfig>): void;
    getConfig(): FingerprintConfig;
    exportFingerprints(): string;
    importFingerprints(data: string): number;
}
export declare function createFingerprinter(config?: Partial<FingerprintConfig>): StanceFingerprinter;
//# sourceMappingURL=stance.d.ts.map