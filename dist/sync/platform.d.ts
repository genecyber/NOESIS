/**
 * Cross-Platform Synchronization (Ralph Iteration 8, Feature 6)
 *
 * Real-time sync across devices, conflict resolution, selective sync,
 * offline mode with queue, and platform-specific adaptations.
 */
import type { Stance, ModeConfig, ConversationMessage } from '../types/index.js';
export interface SyncConfig {
    enabled: boolean;
    syncInterval: number;
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
export type SyncEventType = 'sync_start' | 'sync_complete' | 'sync_failed' | 'conflict_detected' | 'conflict_resolved' | 'offline' | 'online' | 'change_queued';
export declare class PlatformSyncManager {
    private config;
    private state;
    private devices;
    private offlineQueue;
    private handlers;
    private stats;
    private syncTimer;
    private currentDeviceId;
    constructor(config?: Partial<SyncConfig>);
    /**
     * Detect current platform
     */
    private detectPlatform;
    /**
     * Start sync service
     */
    start(): void;
    /**
     * Stop sync service
     */
    stop(): void;
    /**
     * Register a device
     */
    registerDevice(device: SyncDevice): void;
    /**
     * Record a local change
     */
    recordChange(resource: SyncResource, type: ChangeType, data: unknown): SyncChange;
    /**
     * Check if resource should be synced
     */
    private shouldSyncResource;
    /**
     * Queue change for offline processing
     */
    private queueForOffline;
    /**
     * Perform sync
     */
    sync(): Promise<SyncResult>;
    /**
     * Create sync package
     */
    private createSyncPackage;
    /**
     * Calculate checksum
     */
    private calculateChecksum;
    /**
     * Send package and receive remote changes (mock)
     */
    private sendAndReceive;
    /**
     * Detect conflicts between local and remote changes
     */
    private detectConflicts;
    /**
     * Resolve a conflict
     */
    resolveConflict(conflict: SyncConflict, manualResolution?: ConflictResolution): Promise<void>;
    /**
     * Auto-resolve conflict based on configured strategy
     */
    private autoResolveConflict;
    /**
     * Merge two changes (simplified)
     */
    private mergeChanges;
    /**
     * Apply remote changes
     */
    private applyRemoteChanges;
    /**
     * Set online status
     */
    setOnlineStatus(isOnline: boolean): void;
    /**
     * Get pending conflicts
     */
    getPendingConflicts(): SyncConflict[];
    /**
     * Subscribe to sync events
     */
    subscribe(handler: SyncEventHandler): () => void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Get current state
     */
    getState(): SyncState;
    /**
     * Get statistics
     */
    getStats(): SyncStats;
    /**
     * Get registered devices
     */
    getDevices(): SyncDevice[];
    /**
     * Get offline queue status
     */
    getOfflineQueue(): OfflineQueue;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<SyncConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): SyncConfig;
    /**
     * Force sync stance
     */
    syncStance(stance: Stance): void;
    /**
     * Force sync config
     */
    syncConfig(config: ModeConfig): void;
    /**
     * Force sync conversation
     */
    syncConversation(messages: ConversationMessage[]): void;
    /**
     * Export state
     */
    export(): {
        state: SyncState;
        devices: SyncDevice[];
        offlineQueue: OfflineQueue;
    };
    /**
     * Import state
     */
    import(data: ReturnType<PlatformSyncManager['export']>): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const platformSync: PlatformSyncManager;
//# sourceMappingURL=platform.d.ts.map