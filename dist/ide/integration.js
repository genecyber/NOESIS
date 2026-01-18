/**
 * IDE Integration (Ralph Iteration 8, Feature 2)
 *
 * VS Code extension support, JetBrains plugin, real-time stance indicators,
 * code comment integration, and quick operator actions.
 */
// ============================================================================
// IDE Integration Manager
// ============================================================================
export class IDEIntegrationManager {
    config;
    state;
    stats;
    comments = new Map(); // file path -> comments
    commands = new Map();
    handlers = new Set();
    syncTimer = null;
    constructor(config = {}) {
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
    registerDefaultCommands() {
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
    async connect(type, workspace) {
        const connection = {
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
    disconnect(connectionId) {
        const connection = this.state.connections.get(connectionId);
        if (!connection)
            return false;
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
    getIDEVersion(type) {
        const versions = {
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
    startSync() {
        if (this.syncTimer)
            return;
        this.syncTimer = setInterval(() => {
            this.performSync();
        }, this.config.syncInterval);
    }
    /**
     * Stop periodic sync
     */
    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }
    /**
     * Perform sync with connected IDEs
     */
    async performSync() {
        if (this.state.pendingSync)
            return;
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
    updateIndicators(stance, operators = []) {
        if (!this.config.showStanceIndicators)
            return;
        const indicators = [];
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
    broadcastIndicators() {
        for (const [_id, connection] of this.state.connections) {
            if (connection.connected) {
                // In a real implementation, this would send to the IDE
            }
        }
    }
    /**
     * Add a stance-aware code comment
     */
    addComment(filePath, lineNumber, content, stance, operators = []) {
        const comment = {
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
        this.comments.get(filePath).push(comment);
        this.stats.commentsCreated++;
        return comment;
    }
    /**
     * Get comments for a file
     */
    getComments(filePath) {
        return this.comments.get(filePath) || [];
    }
    /**
     * Generate comment text with stance context
     */
    generateCommentText(comment) {
        const ctx = comment.stanceContext;
        return `// [Metamorph] ${comment.content}\n` +
            `// Frame: ${ctx.frame} | Self: ${ctx.selfModel}\n` +
            `// ${new Date(comment.timestamp).toISOString()}`;
    }
    /**
     * Register an IDE command
     */
    registerCommand(command) {
        this.commands.set(command.id, command);
    }
    /**
     * Execute an IDE command
     */
    executeCommand(commandId, args) {
        const command = this.commands.get(commandId);
        if (!command)
            return false;
        this.stats.commandsExecuted++;
        this.emit({
            type: 'operator_triggered',
            timestamp: new Date(),
            data: { commandId, args },
            sourceIDE: 'vscode' // Assume VS Code
        });
        return true;
    }
    /**
     * Subscribe to IDE events
     */
    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    /**
     * Emit IDE event
     */
    emit(event) {
        this.state.lastEvent = event;
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch {
                // Ignore handler errors
            }
        }
    }
    /**
     * Generate VS Code extension manifest
     */
    generateVSCodeManifest() {
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
    generateJetBrainsDescriptor() {
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
    getConnection(connectionId) {
        return this.state.connections.get(connectionId) || null;
    }
    /**
     * Get all connections
     */
    getConnections() {
        return [...this.state.connections.values()];
    }
    /**
     * Get current indicators
     */
    getIndicators() {
        return [...this.state.indicators];
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get state
     */
    getState() {
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
    export() {
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
    import(data) {
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
    reset() {
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
//# sourceMappingURL=integration.js.map