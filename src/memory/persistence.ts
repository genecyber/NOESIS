/**
 * Persistent Memory with External Storage - Ralph Iteration 6 Feature 1
 *
 * Enhanced memory persistence with export, backup, deduplication,
 * and external vector database integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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
  healthScore: number;  // 0-100
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
  autoBackupOnDriftThreshold: number;  // Drift level to trigger auto-backup
  autoBackupInterval: number;  // Hours between scheduled backups (0 = disabled)
  deduplicationThreshold: number;  // Similarity threshold (0-1)
  exportFormat: ExportFormat;
}

const DEFAULT_CONFIG: MemoryPersistenceConfig = {
  enabled: true,
  backupDir: './data/backups',
  maxBackups: 10,
  autoBackupOnDriftThreshold: 50,
  autoBackupInterval: 24,
  deduplicationThreshold: 0.95,
  exportFormat: 'json'
};

/**
 * Memory Persistence Manager
 */
class MemoryPersistenceManager {
  private config: MemoryPersistenceConfig = DEFAULT_CONFIG;
  private backups: BackupMetadata[] = [];
  private lastBackupDrift: number = 0;
  private lastBackupTime: Date = new Date(0);
  private memoryHashes: Map<string, string> = new Map();  // id -> content hash

  /**
   * Set configuration
   */
  setConfig(config: Partial<MemoryPersistenceConfig>): void {
    this.config = { ...this.config, ...config };
    this.ensureBackupDir();
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryPersistenceConfig {
    return { ...this.config };
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  /**
   * Calculate content hash for deduplication
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content.toLowerCase().trim()).digest('hex');
  }

  /**
   * Export memories to file
   */
  async exportMemories(
    memories: MemoryEntry[],
    filepath: string,
    format?: ExportFormat
  ): Promise<{ success: boolean; filepath: string; size: number }> {
    const exportFormat = format || this.config.exportFormat;
    let content: string;
    let finalPath = filepath;

    switch (exportFormat) {
      case 'json':
        content = JSON.stringify(memories, null, 2);
        if (!finalPath.endsWith('.json')) finalPath += '.json';
        break;

      case 'jsonl':
        content = memories.map(m => JSON.stringify(m)).join('\n');
        if (!finalPath.endsWith('.jsonl')) finalPath += '.jsonl';
        break;

      case 'csv':
        const headers = ['id', 'type', 'content', 'importance', 'decay', 'timestamp'];
        const rows = memories.map(m => [
          m.id,
          m.type,
          `"${m.content.replace(/"/g, '""')}"`,
          m.importance.toString(),
          m.decay.toString(),
          m.timestamp.toISOString()
        ].join(','));
        content = [headers.join(','), ...rows].join('\n');
        if (!finalPath.endsWith('.csv')) finalPath += '.csv';
        break;

      default:
        throw new Error(`Unsupported export format: ${exportFormat}`);
    }

    fs.writeFileSync(finalPath, content, 'utf-8');
    const size = fs.statSync(finalPath).size;

    return { success: true, filepath: finalPath, size };
  }

  /**
   * Import memories from file
   */
  async importMemories(filepath: string): Promise<MemoryEntry[]> {
    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const ext = path.extname(filepath).toLowerCase();

    let memories: MemoryEntry[];

    switch (ext) {
      case '.json':
        memories = JSON.parse(content);
        break;

      case '.jsonl':
        memories = content.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        break;

      case '.csv':
        const lines = content.split('\n');
        // Skip header line - relying on fixed column order
        memories = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = this.parseCSVLine(line);
            return {
              id: values[0],
              type: values[1] as 'episodic' | 'semantic' | 'identity',
              content: values[2],
              importance: parseFloat(values[3]),
              decay: parseFloat(values[4]),
              timestamp: new Date(values[5]),
              metadata: {}
            };
          });
        break;

      default:
        throw new Error(`Unsupported import format: ${ext}`);
    }

    // Convert timestamps
    memories = memories.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));

    return memories;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  /**
   * Create a backup of memories
   */
  async createBackup(
    memories: MemoryEntry[],
    stance: Stance,
    trigger: BackupMetadata['trigger']
  ): Promise<BackupMetadata> {
    this.ensureBackupDir();

    const id = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.json`;
    const filepath = path.join(this.config.backupDir, filename);

    const backupData = {
      metadata: {
        id,
        timestamp: new Date(),
        trigger,
        stanceSnapshot: stance
      },
      memories
    };

    const content = JSON.stringify(backupData, null, 2);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    fs.writeFileSync(filepath, content, 'utf-8');
    const size = fs.statSync(filepath).size;

    const metadata: BackupMetadata = {
      id,
      timestamp: new Date(),
      trigger,
      memoryCount: memories.length,
      totalSize: size,
      driftAtBackup: stance.cumulativeDrift,
      checksum,
      filepath
    };

    this.backups.push(metadata);
    this.lastBackupDrift = stance.cumulativeDrift;
    this.lastBackupTime = new Date();

    // Prune old backups
    this.pruneBackups();

    return metadata;
  }

  /**
   * Restore memories from backup
   */
  async restoreBackup(backupId: string): Promise<{
    memories: MemoryEntry[];
    stanceSnapshot: Stance;
  } | null> {
    const metadata = this.backups.find(b => b.id === backupId);
    if (!metadata || !fs.existsSync(metadata.filepath)) {
      return null;
    }

    const content = fs.readFileSync(metadata.filepath, 'utf-8');
    const data = JSON.parse(content);

    return {
      memories: data.memories.map((m: MemoryEntry) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })),
      stanceSnapshot: data.metadata.stanceSnapshot
    };
  }

  /**
   * List available backups
   */
  listBackups(): BackupMetadata[] {
    return [...this.backups].sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Prune old backups to stay within limit
   */
  private pruneBackups(): void {
    if (this.backups.length <= this.config.maxBackups) return;

    // Sort by timestamp, oldest first
    const sorted = [...this.backups].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Delete excess backups
    const toDelete = sorted.slice(0, this.backups.length - this.config.maxBackups);

    for (const backup of toDelete) {
      if (fs.existsSync(backup.filepath)) {
        fs.unlinkSync(backup.filepath);
      }
      const index = this.backups.findIndex(b => b.id === backup.id);
      if (index > -1) {
        this.backups.splice(index, 1);
      }
    }
  }

  /**
   * Check if auto-backup should be triggered
   */
  shouldAutoBackup(currentDrift: number): boolean {
    if (!this.config.enabled) return false;

    // Check drift threshold
    if (this.config.autoBackupOnDriftThreshold > 0) {
      const driftSinceBackup = currentDrift - this.lastBackupDrift;
      if (driftSinceBackup >= this.config.autoBackupOnDriftThreshold) {
        return true;
      }
    }

    // Check time interval
    if (this.config.autoBackupInterval > 0) {
      const hoursSinceBackup =
        (Date.now() - this.lastBackupTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceBackup >= this.config.autoBackupInterval) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find duplicate memories
   */
  findDuplicates(memories: MemoryEntry[]): Map<string, string[]> {
    const hashToIds = new Map<string, string[]>();

    for (const memory of memories) {
      const hash = this.hashContent(memory.content);
      this.memoryHashes.set(memory.id, hash);

      if (!hashToIds.has(hash)) {
        hashToIds.set(hash, []);
      }
      hashToIds.get(hash)!.push(memory.id);
    }

    // Return only hashes with duplicates
    const duplicates = new Map<string, string[]>();
    for (const [hash, ids] of hashToIds) {
      if (ids.length > 1) {
        duplicates.set(hash, ids);
      }
    }

    return duplicates;
  }

  /**
   * Deduplicate memories
   */
  deduplicateMemories(memories: MemoryEntry[]): DeduplicationResult {
    const duplicates = this.findDuplicates(memories);
    let duplicatesRemoved = 0;
    let bytesRecovered = 0;

    const idsToRemove = new Set<string>();

    for (const [_hash, ids] of duplicates) {
      // Keep the one with highest importance, remove others
      const sorted = ids
        .map(id => memories.find(m => m.id === id)!)
        .sort((a, b) => {
          // Prefer higher importance
          if (b.importance !== a.importance) {
            return b.importance - a.importance;
          }
          // Then prefer newer
          return b.timestamp.getTime() - a.timestamp.getTime();
        });

      // Mark all but the first for removal
      for (let i = 1; i < sorted.length; i++) {
        idsToRemove.add(sorted[i].id);
        bytesRecovered += sorted[i].content.length;
        duplicatesRemoved++;
      }
    }

    return {
      originalCount: memories.length,
      duplicatesFound: duplicates.size,
      duplicatesRemoved,
      bytesRecovered
    };
  }

  /**
   * Get memory IDs to remove after deduplication
   */
  getDeduplicationRemovals(memories: MemoryEntry[]): string[] {
    const duplicates = this.findDuplicates(memories);
    const idsToRemove: string[] = [];

    for (const [_hash, ids] of duplicates) {
      const sorted = ids
        .map(id => memories.find(m => m.id === id)!)
        .sort((a, b) => b.importance - a.importance);

      for (let i = 1; i < sorted.length; i++) {
        idsToRemove.push(sorted[i].id);
      }
    }

    return idsToRemove;
  }

  /**
   * Consolidate similar memories
   */
  consolidateMemories(memories: MemoryEntry[]): ConsolidationResult {
    // Group memories by type
    const byType = new Map<string, MemoryEntry[]>();
    for (const m of memories) {
      if (!byType.has(m.type)) {
        byType.set(m.type, []);
      }
      byType.get(m.type)!.push(m);
    }

    let memoriesConsolidated = 0;
    let importanceBoosts = 0;

    // Find memories with similar content within each type
    for (const [_type, typeMemories] of byType) {
      for (let i = 0; i < typeMemories.length; i++) {
        for (let j = i + 1; j < typeMemories.length; j++) {
          const similarity = this.calculateSimilarity(
            typeMemories[i].content,
            typeMemories[j].content
          );

          if (similarity >= this.config.deduplicationThreshold) {
            // Boost importance of the kept memory
            if (typeMemories[i].importance < 1.0) {
              typeMemories[i].importance = Math.min(1.0,
                typeMemories[i].importance + 0.1
              );
              importanceBoosts++;
            }
            memoriesConsolidated++;
          }
        }
      }
    }

    return {
      memoriesAnalyzed: memories.length,
      memoriesConsolidated,
      newMemoriesCreated: 0,
      importanceBoosts
    };
  }

  /**
   * Calculate text similarity (Jaccard index on words)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate memory statistics
   */
  calculateStats(memories: MemoryEntry[]): MemoryStats {
    if (memories.length === 0) {
      return {
        totalMemories: 0,
        byType: { episodic: 0, semantic: 0, identity: 0 },
        avgImportance: 0,
        avgDecay: 0,
        oldestMemory: null,
        newestMemory: null,
        totalSize: 0,
        duplicateCount: 0,
        healthScore: 100
      };
    }

    const byType = { episodic: 0, semantic: 0, identity: 0 };
    let totalImportance = 0;
    let totalDecay = 0;
    let totalSize = 0;
    let oldest = memories[0].timestamp;
    let newest = memories[0].timestamp;

    for (const m of memories) {
      byType[m.type]++;
      totalImportance += m.importance;
      totalDecay += m.decay;
      totalSize += m.content.length;

      if (m.timestamp < oldest) oldest = m.timestamp;
      if (m.timestamp > newest) newest = m.timestamp;
    }

    const duplicates = this.findDuplicates(memories);
    let duplicateCount = 0;
    for (const ids of duplicates.values()) {
      duplicateCount += ids.length - 1;
    }

    // Calculate health score
    const avgImportance = totalImportance / memories.length;
    const duplicateRatio = duplicateCount / memories.length;
    const typeBalance = Math.min(byType.episodic, byType.semantic, byType.identity) /
                        Math.max(byType.episodic, byType.semantic, byType.identity, 1);

    const healthScore = Math.round(
      (avgImportance * 40) +
      ((1 - duplicateRatio) * 30) +
      (typeBalance * 30)
    );

    return {
      totalMemories: memories.length,
      byType,
      avgImportance: totalImportance / memories.length,
      avgDecay: totalDecay / memories.length,
      oldestMemory: oldest,
      newestMemory: newest,
      totalSize,
      duplicateCount,
      healthScore: Math.max(0, Math.min(100, healthScore))
    };
  }

  /**
   * Get persistence status
   */
  getStatus(): {
    enabled: boolean;
    backupCount: number;
    lastBackupTime: Date | null;
    lastBackupDrift: number;
    backupDir: string;
  } {
    return {
      enabled: this.config.enabled,
      backupCount: this.backups.length,
      lastBackupTime: this.lastBackupTime.getTime() > 0 ? this.lastBackupTime : null,
      lastBackupDrift: this.lastBackupDrift,
      backupDir: this.config.backupDir
    };
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): boolean {
    const index = this.backups.findIndex(b => b.id === backupId);
    if (index === -1) return false;

    const backup = this.backups[index];
    if (fs.existsSync(backup.filepath)) {
      fs.unlinkSync(backup.filepath);
    }
    this.backups.splice(index, 1);
    return true;
  }

  /**
   * Clear all backups
   */
  clearBackups(): number {
    let deleted = 0;
    for (const backup of this.backups) {
      if (fs.existsSync(backup.filepath)) {
        fs.unlinkSync(backup.filepath);
        deleted++;
      }
    }
    this.backups = [];
    return deleted;
  }
}

// Singleton instance
export const memoryPersistence = new MemoryPersistenceManager();
