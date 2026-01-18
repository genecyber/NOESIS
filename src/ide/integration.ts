/**
 * IDE Integration (Ralph Iteration 8, Feature 2)
 *
 * VS Code extension support, JetBrains plugin, real-time stance indicators,
 * code comment integration, and quick operator actions.
 */

import type { Stance, PlannedOperation } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface IDEConfig {
  autoConnect: boolean;
  showStanceIndicators: boolean;
  enableCommentIntegration: boolean;
  syncInterval: number;  // milliseconds
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

export type IDEEventType =
  | 'file_opened'
  | 'file_saved'
  | 'selection_changed'
  | 'cursor_moved'
  | 'operator_triggered'
  | 'comment_added'
  | 'stance_changed';

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

// ============================================================================
// IDE Integration Manager
// ============================================================================

export class IDEIntegrationManager {
  private config: IDEConfig;
  private state: IDEState;
  private stats: IDEStats;
  private comments: Map<string, CodeComment[]> = new Map();  // file path -> comments
  private commands: Map<string, IDECommand> = new Map();
  private handlers: Set<IDEEventHandler> = new Set();
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<IDEConfig> = {}) {
    this.config = {
      autoConnect: true,
      showStanceIndicators: true,
      enableCommentIntegration: true,
      syncInterval: 5000,
      supportedIDEs: ['vscode', 'intellij', 'webstorm'],
      ...config
    };

    this.state = {
      connections: new Map(),
      indicators: [],
      pendingSync: false,
      lastEvent: null
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      syncCount: 0,
      commandsExecuted: 0,
      commentsCreated: 0
    };

    this.registerDefaultCommands();
  }

  /**
   * Register default IDE commands
   */
  private registerDefaultCommands(): void {
    this.registerCommand({
      id: 'metamorph.showStance',
      title: 'Show Current Stance',
      category: 'Metamorph',
      handler: 'showStance',
      keybinding: 'ctrl+shift+s'
    });

    this.registerCommand({
      id: 'metamorph.applyOperator',
      title: 'Apply Operator',
      category: 'Metamorph',
      handler: 'selectAndApplyOperator',
      keybinding: 'ctrl+shift+o'
    });

    this.registerCommand({
      id: 'metamorph.addStanceComment',
      title: 'Add Stance Comment',
      category: 'Metamorph',
      handler: 'addStanceComment',
      keybinding: 'ctrl+shift+c'
    });

    this.registerCommand({
      id: 'metamorph.toggleIndicators',
      title: 'Toggle Stance Indicators',
      category: 'Metamorph',
      handler: 'toggleIndicators'
    });

    this.registerCommand({
      id: 'metamorph.syncState',
      title: 'Sync with Metamorph',
      category: 'Metamorph',
      handler: 'syncState'
    });
  }

  /**
   * Connect to an IDE
   */
  async connect(type: IDEType, workspace: WorkspaceInfo): Promise<IDEConnection> {
    const connection: IDEConnection = {
      id: `ide-${type}-${Date.now()}`,
      type,
      version: this.getIDEVersion(type),
      connected: true,
      lastSync: new Date(),
      workspace
    };

    this.state.connections.set(connection.id, connection);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    // Start sync if auto-connect enabled
    if (this.config.autoConnect && !this.syncTimer) {
      this.startSync();
    }

    // Emit connection event
    this.emit({
      type: 'file_opened',
      timestamp: new Date(),
      data: { workspacePath: workspace.path },
      sourceIDE: type
    });

    return connection;
  }

  /**
   * Disconnect from an IDE
   */
  disconnect(connectionId: string): boolean {
    const connection = this.state.connections.get(connectionId);
    if (!connection) return false;

    connection.connected = false;
    this.stats.activeConnections--;

    // Stop sync if no active connections
    if (this.stats.activeConnections === 0 && this.syncTimer) {
      this.stopSync();
    }

    return true;
  }

  /**
   * Get IDE version (mock implementation)
   */
  private getIDEVersion(type: IDEType): string {
    const versions: Record<IDEType, string> = {
      vscode: '1.85.0',
      intellij: '2024.1',
      webstorm: '2024.1',
      pycharm: '2024.1',
      neovim: '0.9.0',
      sublime: '4143'
    };
    return versions[type] || 'unknown';
  }

  /**
   * Start periodic sync
   */
  startSync(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic sync
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Perform sync with connected IDEs
   */
  private async performSync(): Promise<void> {
    if (this.state.pendingSync) return;

    this.state.pendingSync = true;

    for (const [_id, connection] of this.state.connections) {
      if (connection.connected) {
        connection.lastSync = new Date();
        this.stats.syncCount++;
      }
    }

    this.state.pendingSync = false;
  }

  /**
   * Update stance indicators
   */
  updateIndicators(stance: Stance, operators: PlannedOperation[] = []): void {
    if (!this.config.showStanceIndicators) return;

    const indicators: StanceIndicator[] = [];

    // Frame indicator
    indicators.push({
      id: 'frame-indicator',
      position: 'statusbar',
      type: 'frame',
      content: `Frame: ${stance.frame}`,
      severity: 'info',
      tooltip: `Current frame is ${stance.frame}`,
      actions: [{
        id: 'change-frame',
        label: 'Change Frame',
        command: 'metamorph.changeFrame'
      }]
    });

    // Self-model indicator
    indicators.push({
      id: 'self-model-indicator',
      position: 'statusbar',
      type: 'frame',
      content: `Self: ${stance.selfModel}`,
      severity: 'info'
    });

    // Coherence indicator
    const coherenceLevel = 100 - stance.cumulativeDrift;
    indicators.push({
      id: 'coherence-indicator',
      position: 'statusbar',
      type: 'coherence',
      content: `Coherence: ${coherenceLevel}%`,
      severity: coherenceLevel > 70 ? 'success' : coherenceLevel > 40 ? 'warning' : 'error'
    });

    // Sentience indicator
    indicators.push({
      id: 'sentience-indicator',
      position: 'sidebar',
      type: 'sentience',
      content: `Awareness: ${stance.sentience.awarenessLevel}%`,
      severity: 'info'
    });

    // Active operators
    if (operators.length > 0) {
      indicators.push({
        id: 'operators-indicator',
        position: 'sidebar',
        type: 'operator',
        content: `Active: ${operators.map(o => o.name).join(', ')}`,
        severity: 'info'
      });
    }

    this.state.indicators = indicators;

    // Notify connected IDEs
    this.broadcastIndicators();
  }

  /**
   * Broadcast indicators to connected IDEs
   */
  private broadcastIndicators(): void {
    for (const [_id, connection] of this.state.connections) {
      if (connection.connected) {
        // In a real implementation, this would send to the IDE
      }
    }
  }

  /**
   * Add a stance-aware code comment
   */
  addComment(
    filePath: string,
    lineNumber: number,
    content: string,
    stance: Stance,
    operators: string[] = []
  ): CodeComment {
    const comment: CodeComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      lineNumber,
      content,
      stanceContext: {
        frame: stance.frame,
        selfModel: stance.selfModel,
        values: { ...stance.values },
        operators
      },
      timestamp: new Date()
    };

    if (!this.comments.has(filePath)) {
      this.comments.set(filePath, []);
    }
    this.comments.get(filePath)!.push(comment);
    this.stats.commentsCreated++;

    return comment;
  }

  /**
   * Get comments for a file
   */
  getComments(filePath: string): CodeComment[] {
    return this.comments.get(filePath) || [];
  }

  /**
   * Generate comment text with stance context
   */
  generateCommentText(comment: CodeComment): string {
    const ctx = comment.stanceContext;
    return `// [Metamorph] ${comment.content}\n` +
           `// Frame: ${ctx.frame} | Self: ${ctx.selfModel}\n` +
           `// ${new Date(comment.timestamp).toISOString()}`;
  }

  /**
   * Register an IDE command
   */
  registerCommand(command: IDECommand): void {
    this.commands.set(command.id, command);
  }

  /**
   * Execute an IDE command
   */
  executeCommand(commandId: string, args?: Record<string, unknown>): boolean {
    const command = this.commands.get(commandId);
    if (!command) return false;

    this.stats.commandsExecuted++;

    this.emit({
      type: 'operator_triggered',
      timestamp: new Date(),
      data: { commandId, args },
      sourceIDE: 'vscode'  // Assume VS Code
    });

    return true;
  }

  /**
   * Subscribe to IDE events
   */
  subscribe(handler: IDEEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Emit IDE event
   */
  private emit(event: IDEEvent): void {
    this.state.lastEvent = event;

    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Generate VS Code extension manifest
   */
  generateVSCodeManifest(): Record<string, unknown> {
    return {
      name: 'metamorph-vscode',
      displayName: 'Metamorph',
      description: 'Transformation-maximizing AI integration for VS Code',
      version: '1.0.0',
      engines: { vscode: '^1.80.0' },
      categories: ['AI', 'Other'],
      activationEvents: ['onStartupFinished'],
      main: './out/extension.js',
      contributes: {
        commands: [...this.commands.values()].map(c => ({
          command: c.id,
          title: c.title,
          category: c.category
        })),
        keybindings: [...this.commands.values()]
          .filter(c => c.keybinding)
          .map(c => ({
            command: c.id,
            key: c.keybinding
          })),
        viewsContainers: {
          activitybar: [{
            id: 'metamorph',
            title: 'Metamorph',
            icon: 'resources/icon.svg'
          }]
        },
        views: {
          metamorph: [{
            id: 'metamorph-stance',
            name: 'Current Stance'
          }, {
            id: 'metamorph-operators',
            name: 'Operators'
          }]
        }
      }
    };
  }

  /**
   * Generate JetBrains plugin descriptor
   */
  generateJetBrainsDescriptor(): string {
    return `<idea-plugin>
  <id>com.metamorph.ide</id>
  <name>Metamorph</name>
  <version>1.0.0</version>
  <vendor>Metamorph</vendor>
  <description>Transformation-maximizing AI integration for JetBrains IDEs</description>

  <idea-version since-build="231" />

  <extensions defaultExtensionNs="com.intellij">
    <toolWindow id="Metamorph"
                factoryClass="com.metamorph.ide.MetamorphToolWindowFactory"
                anchor="right" />
    <statusBarWidgetFactory id="MetamorphStatusBar"
                           implementation="com.metamorph.ide.MetamorphStatusBarFactory" />
  </extensions>

  <actions>
    <group id="MetamorphActions" text="Metamorph" popup="true">
${[...this.commands.values()].map(c => `      <action id="${c.id}" class="com.metamorph.ide.actions.${c.handler}" text="${c.title}" />`).join('\n')}
    </group>
  </actions>
</idea-plugin>`;
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): IDEConnection | null {
    return this.state.connections.get(connectionId) || null;
  }

  /**
   * Get all connections
   */
  getConnections(): IDEConnection[] {
    return [...this.state.connections.values()];
  }

  /**
   * Get current indicators
   */
  getIndicators(): StanceIndicator[] {
    return [...this.state.indicators];
  }

  /**
   * Get statistics
   */
  getStats(): IDEStats {
    return { ...this.stats };
  }

  /**
   * Get state
   */
  getState(): IDEState {
    return {
      connections: new Map(this.state.connections),
      indicators: [...this.state.indicators],
      pendingSync: this.state.pendingSync,
      lastEvent: this.state.lastEvent
    };
  }

  /**
   * Export state
   */
  export(): {
    connections: IDEConnection[];
    comments: Array<{ filePath: string; comments: CodeComment[] }>;
    commands: IDECommand[];
  } {
    return {
      connections: [...this.state.connections.values()],
      comments: [...this.comments.entries()].map(([filePath, comments]) => ({
        filePath,
        comments
      })),
      commands: [...this.commands.values()]
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<IDEIntegrationManager['export']>): void {
    for (const connection of data.connections) {
      this.state.connections.set(connection.id, connection);
    }

    for (const { filePath, comments } of data.comments) {
      this.comments.set(filePath, comments);
    }

    for (const command of data.commands) {
      this.commands.set(command.id, command);
    }
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.stopSync();
    this.state = {
      connections: new Map(),
      indicators: [],
      pendingSync: false,
      lastEvent: null
    };
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      syncCount: 0,
      commandsExecuted: 0,
      commentsCreated: 0
    };
    this.comments.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const ideIntegration = new IDEIntegrationManager();
