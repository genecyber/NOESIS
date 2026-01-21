/**
 * Web Integration for Autonomous Idle System
 * Connects the idle system to web UI and WebSocket communications
 */

import { AdaptiveAutonomousIdleSystem } from './adaptive-system.js';
import { GlobalIdleDetector } from './detector.js';
import { IdleModeConfig } from './types.js';
// import { AutonomousSession } from './types.js';

export interface WebSocketManager {
  broadcast(channel: string, event: any): void;
  getConnectedSessions(): string[];
  isConnected(sessionId: string): boolean;
}

/**
 * Web integration layer for the autonomous idle system
 */
export class IdleModeWebIntegration {
  private idleSystems = new Map<string, AdaptiveAutonomousIdleSystem>();
  private webSocketManager: WebSocketManager | null = null;

  constructor(webSocketManager?: WebSocketManager) {
    this.webSocketManager = webSocketManager || null;
  }

  /**
   * Initialize idle mode for a session with real MCP tools
   */
  async initializeSession(sessionId: string, mcpTools: any, config?: Partial<IdleModeConfig>): Promise<void> {
    if (this.idleSystems.has(sessionId)) {
      console.log(`Idle mode already initialized for session ${sessionId}`);
      return;
    }

    try {
      // Create adaptive idle system with real MCP tools
      const system = new AdaptiveAutonomousIdleSystem(config, mcpTools);

      // Set up event listeners for WebSocket broadcasting
      this.setupEventListeners(sessionId, system);

      // Start the system
      await system.start();

      this.idleSystems.set(sessionId, system);
      console.log(`Idle mode initialized for session ${sessionId}`);

      // Broadcast initialization
      this.broadcastEvent(sessionId, 'idle-mode', {
        type: 'initialized',
        sessionId,
        status: system.getEnhancedStatus()
      });

    } catch (error) {
      console.error(`Failed to initialize idle mode for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get idle mode status for a session
   */
  getStatus(sessionId: string): any {
    const system = this.idleSystems.get(sessionId);
    if (!system) {
      return {
        isIdle: false,
        idleDuration: 0,
        lastActivity: new Date().toISOString(),
        currentSession: null,
        sessionHistory: [],
        config: this.getDefaultConfig(),
        learningHistory: [],
        emergentCategories: []
      };
    }

    const status = system.getEnhancedStatus();
    const learningState = system.getLearningState();

    return {
      isIdle: status.isIdle,
      idleDuration: GlobalIdleDetector.getIdleState().idleDuration,
      lastActivity: GlobalIdleDetector.getIdleState().lastActivity.toISOString(),
      currentSession: status.currentSession,
      sessionHistory: status.sessionHistory || [],
      config: this.extractConfigFromStatus(status),
      learningHistory: learningState.recentPerformance || [],
      emergentCategories: learningState.emergentCategories || []
    };
  }

  /**
   * Toggle idle mode on/off
   */
  async toggleIdleMode(sessionId: string, enabled: boolean): Promise<any> {
    const system = this.idleSystems.get(sessionId);
    if (!system) {
      throw new Error(`No idle system found for session ${sessionId}`);
    }

    if (enabled) {
      await system.start();
    } else {
      system.stop();
    }

    const status = this.getStatus(sessionId);

    // Broadcast status change
    this.broadcastEvent(sessionId, 'idle-mode', {
      type: 'toggled',
      sessionId,
      enabled,
      status
    });

    return status;
  }

  /**
   * Update idle mode configuration
   */
  async updateConfig(sessionId: string, config: Partial<IdleModeConfig>): Promise<any> {
    const system = this.idleSystems.get(sessionId);
    if (!system) {
      throw new Error(`No idle system found for session ${sessionId}`);
    }

    // Update configuration through the adaptive system
    // This would require extending the AdaptiveAutonomousIdleSystem with config updates
    console.log(`Updating config for session ${sessionId}:`, config);

    const status = this.getStatus(sessionId);

    // Broadcast config change
    this.broadcastEvent(sessionId, 'idle-mode', {
      type: 'config_updated',
      sessionId,
      config: status.config,
      status
    });

    return status;
  }

  /**
   * Start manual autonomous session
   */
  async startManualSession(sessionId: string, mode: 'exploration' | 'research' | 'creation' | 'optimization'): Promise<any> {
    const system = this.idleSystems.get(sessionId);
    if (!system) {
      throw new Error(`No idle system found for session ${sessionId}`);
    }

    try {
      const session = await system.startSession(mode);
      const status = this.getStatus(sessionId);

      // Broadcast session start
      this.broadcastEvent(sessionId, 'autonomous-sessions', {
        type: 'session_started',
        sessionId,
        autonomousSession: session,
        status
      });

      return status;

    } catch (error) {
      console.error(`Failed to start manual session for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Control autonomous session (pause/resume/terminate)
   */
  async controlSession(
    sessionId: string,
    autonomousSessionId: string,
    action: 'pause' | 'resume' | 'terminate'
  ): Promise<any> {
    const system = this.idleSystems.get(sessionId);
    if (!system) {
      throw new Error(`No idle system found for session ${sessionId}`);
    }

    // This would require extending the system with session control methods
    console.log(`${action} autonomous session ${autonomousSessionId} for ${sessionId}`);

    const status = this.getStatus(sessionId);

    // Broadcast session control
    this.broadcastEvent(sessionId, 'autonomous-sessions', {
      type: `session_${action}`,
      sessionId,
      autonomousSessionId,
      action,
      status
    });

    return status;
  }

  /**
   * Record user activity to prevent idle mode activation
   */
  recordUserActivity(sessionId: string, activityType: string, source: string = 'web'): void {
    // Use global idle detector to record activity
    GlobalIdleDetector.recordActivity(
      activityType as any,
      `${source}:${sessionId}`,
      { sessionId, timestamp: Date.now() }
    );

    // Broadcast activity
    this.broadcastEvent(sessionId, 'idle-mode', {
      type: 'activity_recorded',
      sessionId,
      activityType,
      source,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up session resources
   */
  async destroySession(sessionId: string): Promise<void> {
    const system = this.idleSystems.get(sessionId);
    if (system) {
      system.stop();
      this.idleSystems.delete(sessionId);
      console.log(`Idle mode destroyed for session ${sessionId}`);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.idleSystems.keys());
  }

  /**
   * Set up event listeners for a system
   */
  private setupEventListeners(sessionId: string, system: AdaptiveAutonomousIdleSystem): void {
    // These would be actual event listeners on the system
    // For now, we'll set up periodic status broadcasting

    // Broadcast status updates every 30 seconds when active
    setInterval(() => {
      if (this.idleSystems.has(sessionId)) {
        const status = system.getEnhancedStatus();

        if (status.currentSession) {
          this.broadcastEvent(sessionId, 'autonomous-sessions', {
            type: 'status_update',
            sessionId,
            status: {
              currentSession: status.currentSession,
              isIdle: status.isIdle
            }
          });
        }
      }
    }, 30000);

    // Listen for learning adaptations
    setInterval(async () => {
      if (this.idleSystems.has(sessionId)) {
        const learningState = system.getLearningState();

        if (learningState.adaptationCycle > 0) {
          this.broadcastEvent(sessionId, 'idle-mode', {
            type: 'adaptation_cycle',
            sessionId,
            adaptationCycle: learningState.adaptationCycle,
            emergentCategories: learningState.emergentCategories
          });
        }
      }
    }, 120000); // Every 2 minutes
  }

  /**
   * Broadcast event via WebSocket
   */
  private broadcastEvent(sessionId: string, channel: string, event: any): void {
    if (this.webSocketManager) {
      this.webSocketManager.broadcast(channel, {
        ...event,
        sessionId, // Include sessionId in broadcast
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): IdleModeConfig {
    return {
      enabled: false,
      idleThreshold: 30,
      maxSessionDuration: 120,
      evolutionIntensity: 'moderate',
      safetyLevel: 'high',
      coherenceFloor: 30,
      allowedGoalTypes: [],
      researchDomains: [],
      externalPublishing: false,
      subagentCoordination: true
    };
  }

  /**
   * Extract configuration from system status
   */
  private extractConfigFromStatus(status: any): IdleModeConfig {
    // Extract config from the enhanced status
    return status.configuration || this.getDefaultConfig();
  }
}

/**
 * Global instance for managing idle mode across sessions
 */
export const globalIdleModeManager = new IdleModeWebIntegration();

export default IdleModeWebIntegration;