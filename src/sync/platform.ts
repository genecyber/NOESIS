/**
 * Cross-Platform Synchronization (Ralph Iteration 8, Feature 6)
 *
 * Real-time sync across devices, conflict resolution, selective sync,
 * offline mode with queue, and platform-specific adaptations.
 */

import type { Stance, ModeConfig, ConversationMessage } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface SyncConfig {
  enabled: boolean;
  syncInterval: number;  // milliseconds
  conflictStrategy: ConflictStrategy;
  selectiveSync: SelectiveSyncConfig;
  offlineEnabled: boolean;
  maxQueueSize: number;
  compressionEnabled: boolean;
}

export type ConflictStrategy = 'latest_wins' | 'merge' | 'manual' | 'server_wins';

export interface SelectiveSyncConfig {
  syncStance: boolean;
  syncMemory: boolean;
  syncConversation: boolean;
  syncConfig: boolean;
  syncIdentity: boolean;
}

export interface SyncDevice {
  id: string;
  name: string;
  platform: Platform;
  lastSeen: Date;
  lastSync: Date | null;
  isOnline: boolean;
  syncEnabled: boolean;
}

export type Platform = 'desktop' | 'web' | 'mobile' | 'cli';

export interface SyncState {
  localVersion: number;
  remoteVersion: number;
  lastSync: Date | null;
  pendingChanges: SyncChange[];
  conflicts: SyncConflict[];
  isOnline: boolean;
  syncInProgress: boolean;
}

export interface SyncChange {
  id: string;
  type: ChangeType;
  resource: SyncResource;
  timestamp: Date;
  data: unknown;
  deviceId: string;
  version: number;
}

export type ChangeType = 'create' | 'update' | 'delete';
export type SyncResource = 'stance' | 'memory' | 'conversation' | 'config' | 'identity';

export interface SyncConflict {
  id: string;
  resource: SyncResource;
  localChange: SyncChange;
  remoteChange: SyncChange;
  detectedAt: Date;
  resolved: boolean;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  resolvedAt: Date;
  winner: 'local' | 'remote' | 'merged';
  mergedData?: unknown;
}

export interface SyncPackage {
  id: string;
  deviceId: string;
  timestamp: Date;
  version: number;
  changes: SyncChange[];
  checksum: string;
}

export interface SyncResult {
  success: boolean;
  changesApplied: number;
  conflictsDetected: number;
  newVersion: number;
  error?: string;
}

export interface OfflineQueue {
  changes: SyncChange[];
  maxSize: number;
  oldestChange: Date | null;
  newestChange: Date | null;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsResolved: number;
  conflictsPending: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  avgSyncTime: number;
}

export type SyncEventHandler = (event: SyncEvent) => void;

export interface SyncEvent {
  type: SyncEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export type SyncEventType =
  | 'sync_start'
  | 'sync_complete'
  | 'sync_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'offline'
  | 'online'
  | 'change_queued';

// ============================================================================
// Platform Sync Manager
// ============================================================================

export class PlatformSyncManager {
  private config: SyncConfig;
  private state: SyncState;
  private devices: Map<string, SyncDevice> = new Map();
  private offlineQueue: OfflineQueue;
  private handlers: Set<SyncEventHandler> = new Set();
  private stats: SyncStats;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private currentDeviceId: string;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      enabled: true,
      syncInterval: 30000,  // 30 seconds
      conflictStrategy: 'latest_wins',
      selectiveSync: {
        syncStance: true,
        syncMemory: true,
        syncConversation: true,
        syncConfig: true,
        syncIdentity: true
      },
      offlineEnabled: true,
      maxQueueSize: 1000,
      compressionEnabled: true,
      ...config
    };

    this.currentDeviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.state = {
      localVersion: 0,
      remoteVersion: 0,
      lastSync: null,
      pendingChanges: [],
      conflicts: [],
      isOnline: true,
      syncInProgress: false
    };

    this.offlineQueue = {
      changes: [],
      maxSize: this.config.maxQueueSize,
      oldestChange: null,
      newestChange: null
    };

    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      conflictsPending: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0,
      avgSyncTime: 0
    };

    // Register current device
    this.registerDevice({
      id: this.currentDeviceId,
      name: 'Current Device',
      platform: this.detectPlatform(),
      lastSeen: new Date(),
      lastSync: null,
      isOnline: true,
      syncEnabled: true
    });
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): Platform {
    // In a real implementation, this would detect the actual platform
    return 'desktop';
  }

  /**
   * Start sync service
   */
  start(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.config.enabled && this.state.isOnline) {
        this.sync();
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop sync service
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Register a device
   */
  registerDevice(device: SyncDevice): void {
    this.devices.set(device.id, device);
  }

  /**
   * Record a local change
   */
  recordChange(resource: SyncResource, type: ChangeType, data: unknown): SyncChange {
    const change: SyncChange = {
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      resource,
      timestamp: new Date(),
      data,
      deviceId: this.currentDeviceId,
      version: this.state.localVersion + 1
    };

    // Check if this resource is being synced
    if (!this.shouldSyncResource(resource)) {
      return change;
    }

    if (this.state.isOnline) {
      this.state.pendingChanges.push(change);
    } else if (this.config.offlineEnabled) {
      this.queueForOffline(change);
    }

    this.state.localVersion++;

    return change;
  }

  /**
   * Check if resource should be synced
   */
  private shouldSyncResource(resource: SyncResource): boolean {
    const selectiveSync = this.config.selectiveSync;
    switch (resource) {
      case 'stance': return selectiveSync.syncStance;
      case 'memory': return selectiveSync.syncMemory;
      case 'conversation': return selectiveSync.syncConversation;
      case 'config': return selectiveSync.syncConfig;
      case 'identity': return selectiveSync.syncIdentity;
      default: return false;
    }
  }

  /**
   * Queue change for offline processing
   */
  private queueForOffline(change: SyncChange): void {
    // Enforce queue size limit
    if (this.offlineQueue.changes.length >= this.offlineQueue.maxSize) {
      this.offlineQueue.changes.shift();
    }

    this.offlineQueue.changes.push(change);
    this.offlineQueue.newestChange = change.timestamp;

    if (!this.offlineQueue.oldestChange) {
      this.offlineQueue.oldestChange = change.timestamp;
    }

    this.emit({ type: 'change_queued', timestamp: new Date(), data: { changeId: change.id } });
  }

  /**
   * Perform sync
   */
  async sync(): Promise<SyncResult> {
    if (this.state.syncInProgress) {
      return { success: false, changesApplied: 0, conflictsDetected: 0, newVersion: this.state.localVersion, error: 'Sync already in progress' };
    }

    this.state.syncInProgress = true;
    this.emit({ type: 'sync_start', timestamp: new Date() });

    const startTime = Date.now();

    try {
      // Get all pending changes
      const changes = [
        ...this.state.pendingChanges,
        ...this.offlineQueue.changes
      ];

      // Create sync package
      const syncPackage = this.createSyncPackage(changes);

      // Send to server (mock)
      const remoteChanges = await this.sendAndReceive(syncPackage);

      // Detect conflicts
      const conflicts = this.detectConflicts(changes, remoteChanges);
      this.state.conflicts.push(...conflicts);
      this.stats.conflictsPending += conflicts.length;

      // Resolve conflicts
      for (const conflict of conflicts) {
        await this.resolveConflict(conflict);
      }

      // Apply remote changes
      const appliedCount = await this.applyRemoteChanges(remoteChanges);

      // Clear pending changes
      this.state.pendingChanges = [];
      this.offlineQueue.changes = [];
      this.offlineQueue.oldestChange = null;
      this.offlineQueue.newestChange = null;

      // Update versions
      this.state.remoteVersion = Math.max(
        this.state.localVersion,
        ...remoteChanges.map(c => c.version)
      );
      this.state.lastSync = new Date();

      // Update device
      const device = this.devices.get(this.currentDeviceId);
      if (device) {
        device.lastSync = new Date();
      }

      // Update stats
      const syncTime = Date.now() - startTime;
      this.stats.totalSyncs++;
      this.stats.successfulSyncs++;
      this.stats.avgSyncTime = (this.stats.avgSyncTime * (this.stats.totalSyncs - 1) + syncTime) / this.stats.totalSyncs;

      this.emit({
        type: 'sync_complete',
        timestamp: new Date(),
        data: { changesApplied: appliedCount, conflicts: conflicts.length }
      });

      return {
        success: true,
        changesApplied: appliedCount,
        conflictsDetected: conflicts.length,
        newVersion: this.state.localVersion
      };
    } catch (error) {
      this.stats.totalSyncs++;
      this.stats.failedSyncs++;

      this.emit({
        type: 'sync_failed',
        timestamp: new Date(),
        data: { error: String(error) }
      });

      return {
        success: false,
        changesApplied: 0,
        conflictsDetected: 0,
        newVersion: this.state.localVersion,
        error: String(error)
      };
    } finally {
      this.state.syncInProgress = false;
    }
  }

  /**
   * Create sync package
   */
  private createSyncPackage(changes: SyncChange[]): SyncPackage {
    const data = JSON.stringify(changes);
    const checksum = this.calculateChecksum(data);

    return {
      id: `pkg-${Date.now()}`,
      deviceId: this.currentDeviceId,
      timestamp: new Date(),
      version: this.state.localVersion,
      changes,
      checksum
    };
  }

  /**
   * Calculate checksum
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Send package and receive remote changes (mock)
   */
  private async sendAndReceive(_syncPackage: SyncPackage): Promise<SyncChange[]> {
    // In a real implementation, this would communicate with a sync server
    // For now, return empty (no remote changes)
    this.stats.bytesUploaded += JSON.stringify(_syncPackage).length;
    return [];
  }

  /**
   * Detect conflicts between local and remote changes
   */
  private detectConflicts(localChanges: SyncChange[], remoteChanges: SyncChange[]): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    for (const localChange of localChanges) {
      for (const remoteChange of remoteChanges) {
        // Same resource modified by different devices
        if (
          localChange.resource === remoteChange.resource &&
          localChange.deviceId !== remoteChange.deviceId &&
          Math.abs(localChange.timestamp.getTime() - remoteChange.timestamp.getTime()) < 60000  // Within 1 minute
        ) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            resource: localChange.resource,
            localChange,
            remoteChange,
            detectedAt: new Date(),
            resolved: false
          });

          this.emit({
            type: 'conflict_detected',
            timestamp: new Date(),
            data: { resource: localChange.resource }
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(conflict: SyncConflict, manualResolution?: ConflictResolution): Promise<void> {
    if (conflict.resolved) return;

    let resolution: ConflictResolution;

    if (manualResolution) {
      resolution = manualResolution;
    } else {
      // Auto-resolve based on strategy
      resolution = this.autoResolveConflict(conflict);
    }

    conflict.resolution = resolution;
    conflict.resolved = true;

    this.stats.conflictsResolved++;
    this.stats.conflictsPending--;

    this.emit({
      type: 'conflict_resolved',
      timestamp: new Date(),
      data: { conflictId: conflict.id, strategy: resolution.strategy }
    });
  }

  /**
   * Auto-resolve conflict based on configured strategy
   */
  private autoResolveConflict(conflict: SyncConflict): ConflictResolution {
    const strategy = this.config.conflictStrategy;

    switch (strategy) {
      case 'latest_wins':
        return {
          strategy,
          resolvedAt: new Date(),
          winner: conflict.localChange.timestamp > conflict.remoteChange.timestamp ? 'local' : 'remote'
        };

      case 'server_wins':
        return {
          strategy,
          resolvedAt: new Date(),
          winner: 'remote'
        };

      case 'merge':
        // Attempt to merge data
        const mergedData = this.mergeChanges(conflict.localChange, conflict.remoteChange);
        return {
          strategy,
          resolvedAt: new Date(),
          winner: 'merged',
          mergedData
        };

      case 'manual':
      default:
        // Default to local for manual (user should review)
        return {
          strategy,
          resolvedAt: new Date(),
          winner: 'local'
        };
    }
  }

  /**
   * Merge two changes (simplified)
   */
  private mergeChanges(local: SyncChange, remote: SyncChange): unknown {
    // Simple merge: prefer remote for primitive values, merge objects
    if (typeof local.data === 'object' && typeof remote.data === 'object') {
      return { ...(local.data as object), ...(remote.data as object) };
    }
    return remote.data;  // Fallback to remote
  }

  /**
   * Apply remote changes
   */
  private async applyRemoteChanges(changes: SyncChange[]): Promise<number> {
    let appliedCount = 0;

    for (const change of changes) {
      // In a real implementation, this would apply changes to local state
      appliedCount++;
      this.stats.bytesDownloaded += JSON.stringify(change).length;
    }

    return appliedCount;
  }

  /**
   * Set online status
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.state.isOnline;
    this.state.isOnline = isOnline;

    if (isOnline) {
      this.emit({ type: 'online', timestamp: new Date() });

      // Sync queued changes if coming back online
      if (wasOffline && this.offlineQueue.changes.length > 0) {
        this.sync();
      }
    } else {
      this.emit({ type: 'offline', timestamp: new Date() });
    }
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return this.state.conflicts.filter(c => !c.resolved);
  }

  /**
   * Subscribe to sync events
   */
  subscribe(handler: SyncEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Emit event
   */
  private emit(event: SyncEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Get current state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Get statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get registered devices
   */
  getDevices(): SyncDevice[] {
    return [...this.devices.values()];
  }

  /**
   * Get offline queue status
   */
  getOfflineQueue(): OfflineQueue {
    return { ...this.offlineQueue };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.selectiveSync) {
      this.config.selectiveSync = { ...this.config.selectiveSync, ...config.selectiveSync };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Force sync stance
   */
  syncStance(stance: Stance): void {
    this.recordChange('stance', 'update', stance);
  }

  /**
   * Force sync config
   */
  syncConfig(config: ModeConfig): void {
    this.recordChange('config', 'update', config);
  }

  /**
   * Force sync conversation
   */
  syncConversation(messages: ConversationMessage[]): void {
    this.recordChange('conversation', 'update', messages);
  }

  /**
   * Export state
   */
  export(): {
    state: SyncState;
    devices: SyncDevice[];
    offlineQueue: OfflineQueue;
  } {
    return {
      state: this.state,
      devices: [...this.devices.values()],
      offlineQueue: this.offlineQueue
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<PlatformSyncManager['export']>): void {
    this.state = data.state;
    this.offlineQueue = data.offlineQueue;

    this.devices.clear();
    for (const device of data.devices) {
      this.devices.set(device.id, device);
    }
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.stop();

    this.state = {
      localVersion: 0,
      remoteVersion: 0,
      lastSync: null,
      pendingChanges: [],
      conflicts: [],
      isOnline: true,
      syncInProgress: false
    };

    this.offlineQueue = {
      changes: [],
      maxSize: this.config.maxQueueSize,
      oldestChange: null,
      newestChange: null
    };

    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      conflictsPending: 0,
      bytesUploaded: 0,
      bytesDownloaded: 0,
      avgSyncTime: 0
    };

    this.devices.clear();
    this.registerDevice({
      id: this.currentDeviceId,
      name: 'Current Device',
      platform: this.detectPlatform(),
      lastSeen: new Date(),
      lastSync: null,
      isOnline: true,
      syncEnabled: true
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const platformSync = new PlatformSyncManager();
