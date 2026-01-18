/**
 * Persistent Memory with External Storage - Ralph Iteration 6 Feature 1
 *
 * Enhanced memory persistence with export, backup, deduplication,
 * and external vector database integration.
 */
import { MemoryEntry, Stance } from '../types/index.js';
/**
 * Memory export format
 */
export type ExportFormat = 'json' | 'jsonl' | 'csv';
/**
 * Memory backup metadata
 */
export interface BackupMetadata {
    id: string;
    timestamp: Date;
    trigger: 'manual' | 'drift_threshold' | 'scheduled' | 'session_end';
    memoryCount: number;
    totalSize: number;
    driftAtBackup: number;
    checksum: string;
    filepath: string;
}
/**
 * Memory statistics
 */
export interface MemoryStats {
    totalMemories: number;
    byType: {
        episodic: number;
        semantic: number;
        identity: number;
    };
    avgImportance: number;
    avgDecay: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
    totalSize: number;
    duplicateCount: number;
    healthScore: number;
}
/**
 * Deduplication result
 */
export interface DeduplicationResult {
    originalCount: number;
    duplicatesFound: number;
    duplicatesRemoved: number;
    bytesRecovered: number;
}
/**
 * Consolidation result
 */
export interface ConsolidationResult {
    memoriesAnalyzed: number;
    memoriesConsolidated: number;
    newMemoriesCreated: number;
    importanceBoosts: number;
}
/**
 * Memory persistence configuration
 */
export interface MemoryPersistenceConfig {
    enabled: boolean;
    backupDir: string;
    maxBackups: number;
    autoBackupOnDriftThreshold: number;
    autoBackupInterval: number;
    deduplicationThreshold: number;
    exportFormat: ExportFormat;
}
/**
 * Memory Persistence Manager
 */
declare class MemoryPersistenceManager {
    private config;
    private backups;
    private lastBackupDrift;
    private lastBackupTime;
    private memoryHashes;
    /**
     * Set configuration
     */
    setConfig(config: Partial<MemoryPersistenceConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): MemoryPersistenceConfig;
    /**
     * Ensure backup directory exists
     */
    private ensureBackupDir;
    /**
     * Calculate content hash for deduplication
     */
    private hashContent;
    /**
     * Export memories to file
     */
    exportMemories(memories: MemoryEntry[], filepath: string, format?: ExportFormat): Promise<{
        success: boolean;
        filepath: string;
        size: number;
    }>;
    /**
     * Import memories from file
     */
    importMemories(filepath: string): Promise<MemoryEntry[]>;
    /**
     * Parse CSV line handling quoted values
     */
    private parseCSVLine;
    /**
     * Create a backup of memories
     */
    createBackup(memories: MemoryEntry[], stance: Stance, trigger: BackupMetadata['trigger']): Promise<BackupMetadata>;
    /**
     * Restore memories from backup
     */
    restoreBackup(backupId: string): Promise<{
        memories: MemoryEntry[];
        stanceSnapshot: Stance;
    } | null>;
    /**
     * List available backups
     */
    listBackups(): BackupMetadata[];
    /**
     * Prune old backups to stay within limit
     */
    private pruneBackups;
    /**
     * Check if auto-backup should be triggered
     */
    shouldAutoBackup(currentDrift: number): boolean;
    /**
     * Find duplicate memories
     */
    findDuplicates(memories: MemoryEntry[]): Map<string, string[]>;
    /**
     * Deduplicate memories
     */
    deduplicateMemories(memories: MemoryEntry[]): DeduplicationResult;
    /**
     * Get memory IDs to remove after deduplication
     */
    getDeduplicationRemovals(memories: MemoryEntry[]): string[];
    /**
     * Consolidate similar memories
     */
    consolidateMemories(memories: MemoryEntry[]): ConsolidationResult;
    /**
     * Calculate text similarity (Jaccard index on words)
     */
    private calculateSimilarity;
    /**
     * Calculate memory statistics
     */
    calculateStats(memories: MemoryEntry[]): MemoryStats;
    /**
     * Get persistence status
     */
    getStatus(): {
        enabled: boolean;
        backupCount: number;
        lastBackupTime: Date | null;
        lastBackupDrift: number;
        backupDir: string;
    };
    /**
     * Delete a backup
     */
    deleteBackup(backupId: string): boolean;
    /**
     * Clear all backups
     */
    clearBackups(): number;
}
export declare const memoryPersistence: MemoryPersistenceManager;
export {};
//# sourceMappingURL=persistence.d.ts.map