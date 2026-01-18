/**
 * IDE Integration (Ralph Iteration 8, Feature 2)
 *
 * VS Code extension support, JetBrains plugin, real-time stance indicators,
 * code comment integration, and quick operator actions.
 */
import type { Stance, PlannedOperation } from '../types/index.js';
export interface IDEConfig {
    autoConnect: boolean;
    showStanceIndicators: boolean;
    enableCommentIntegration: boolean;
    syncInterval: number;
    supportedIDEs: IDEType[];
}
export type IDEType = 'vscode' | 'intellij' | 'webstorm' | 'pycharm' | 'neovim' | 'sublime';
export interface IDEConnection {
    id: string;
    type: IDEType;
    version: string;
    connected: boolean;
    lastSync: Date | null;
    workspace: WorkspaceInfo;
}
export interface WorkspaceInfo {
    name: string;
    path: string;
    language?: string;
    framework?: string;
    openFiles: string[];
}
export interface StanceIndicator {
    id: string;
    position: IndicatorPosition;
    type: IndicatorType;
    content: string;
    severity: IndicatorSeverity;
    tooltip?: string;
    actions?: QuickAction[];
}
export type IndicatorPosition = 'statusbar' | 'sidebar' | 'gutter' | 'inline';
export type IndicatorType = 'frame' | 'value' | 'operator' | 'coherence' | 'sentience';
export type IndicatorSeverity = 'info' | 'warning' | 'error' | 'success';
export interface QuickAction {
    id: string;
    label: string;
    command: string;
    args?: Record<string, unknown>;
    icon?: string;
}
export interface CodeComment {
    id: string;
    filePath: string;
    lineNumber: number;
    content: string;
    stanceContext: StanceContext;
    timestamp: Date;
    author?: string;
}
export interface StanceContext {
    frame: string;
    selfModel: string;
    values: Record<string, number>;
    operators: string[];
}
export interface IDECommand {
    id: string;
    title: string;
    category: string;
    handler: string;
    keybinding?: string;
}
export interface IDEEvent {
    type: IDEEventType;
    timestamp: Date;
    data: Record<string, unknown>;
    sourceIDE: IDEType;
}
export type IDEEventType = 'file_opened' | 'file_saved' | 'selection_changed' | 'cursor_moved' | 'operator_triggered' | 'comment_added' | 'stance_changed';
export interface IDEState {
    connections: Map<string, IDEConnection>;
    indicators: StanceIndicator[];
    pendingSync: boolean;
    lastEvent: IDEEvent | null;
}
export interface IDEStats {
    totalConnections: number;
    activeConnections: number;
    syncCount: number;
    commandsExecuted: number;
    commentsCreated: number;
}
export type IDEEventHandler = (event: IDEEvent) => void;
export declare class IDEIntegrationManager {
    private config;
    private state;
    private stats;
    private comments;
    private commands;
    private handlers;
    private syncTimer;
    constructor(config?: Partial<IDEConfig>);
    /**
     * Register default IDE commands
     */
    private registerDefaultCommands;
    /**
     * Connect to an IDE
     */
    connect(type: IDEType, workspace: WorkspaceInfo): Promise<IDEConnection>;
    /**
     * Disconnect from an IDE
     */
    disconnect(connectionId: string): boolean;
    /**
     * Get IDE version (mock implementation)
     */
    private getIDEVersion;
    /**
     * Start periodic sync
     */
    startSync(): void;
    /**
     * Stop periodic sync
     */
    stopSync(): void;
    /**
     * Perform sync with connected IDEs
     */
    private performSync;
    /**
     * Update stance indicators
     */
    updateIndicators(stance: Stance, operators?: PlannedOperation[]): void;
    /**
     * Broadcast indicators to connected IDEs
     */
    private broadcastIndicators;
    /**
     * Add a stance-aware code comment
     */
    addComment(filePath: string, lineNumber: number, content: string, stance: Stance, operators?: string[]): CodeComment;
    /**
     * Get comments for a file
     */
    getComments(filePath: string): CodeComment[];
    /**
     * Generate comment text with stance context
     */
    generateCommentText(comment: CodeComment): string;
    /**
     * Register an IDE command
     */
    registerCommand(command: IDECommand): void;
    /**
     * Execute an IDE command
     */
    executeCommand(commandId: string, args?: Record<string, unknown>): boolean;
    /**
     * Subscribe to IDE events
     */
    subscribe(handler: IDEEventHandler): () => void;
    /**
     * Emit IDE event
     */
    private emit;
    /**
     * Generate VS Code extension manifest
     */
    generateVSCodeManifest(): Record<string, unknown>;
    /**
     * Generate JetBrains plugin descriptor
     */
    generateJetBrainsDescriptor(): string;
    /**
     * Get connection by ID
     */
    getConnection(connectionId: string): IDEConnection | null;
    /**
     * Get all connections
     */
    getConnections(): IDEConnection[];
    /**
     * Get current indicators
     */
    getIndicators(): StanceIndicator[];
    /**
     * Get statistics
     */
    getStats(): IDEStats;
    /**
     * Get state
     */
    getState(): IDEState;
    /**
     * Export state
     */
    export(): {
        connections: IDEConnection[];
        comments: Array<{
            filePath: string;
            comments: CodeComment[];
        }>;
        commands: IDECommand[];
    };
    /**
     * Import state
     */
    import(data: ReturnType<IDEIntegrationManager['export']>): void;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const ideIntegration: IDEIntegrationManager;
//# sourceMappingURL=integration.d.ts.map