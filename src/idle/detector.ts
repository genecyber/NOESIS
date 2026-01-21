/**
 * IdleDetector - Monitors user activity and triggers autonomous evolution sessions
 */

import { EventEmitter } from 'events';
import {
  IdleState,
  ActivityEvent,
  ActivityType,
  IdleDetectorConfig,
  IdleSystemError
} from './types.js';

export class IdleDetector extends EventEmitter {
  private idleState: IdleState;
  private config: IdleDetectorConfig;
  private activityTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date = new Date();
  private isRunning: boolean = false;

  constructor(config: Partial<IdleDetectorConfig> = {}) {
    super();

    this.config = {
      webSocketMonitoring: true,
      activityTimeout: 30, // 30 minutes default
      activityTypes: ['websocket', 'api_call', 'user_input', 'tool_invocation'],
      debugLogging: false,
      ...config
    };

    this.idleState = {
      isIdle: false,
      idleDuration: 0,
      lastActivity: new Date(),
      idleThreshold: this.config.activityTimeout,
      activityTypes: this.config.activityTypes
    };

    this.setupActivityMonitoring();
  }

  /**
   * Start idle detection monitoring
   */
  public start(): void {
    if (this.isRunning) {
      this.log('IdleDetector is already running');
      return;
    }

    this.isRunning = true;
    this.resetIdleTimer();
    this.log('IdleDetector started');
    this.emit('detector_started');
  }

  /**
   * Stop idle detection monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }

    this.log('IdleDetector stopped');
    this.emit('detector_stopped');
  }

  /**
   * Record user activity and reset idle timer
   */
  public recordActivity(event: ActivityEvent): void {
    if (!this.isRunning) {
      return;
    }

    // Validate activity type
    if (!this.config.activityTypes.includes(event.type)) {
      this.log(`Ignoring activity type: ${event.type}`);
      return;
    }

    // Track if we were previously idle for potential future use
    // const previouslyIdle = this.idleState.isIdle;

    this.idleState.lastActivity = event.timestamp;
    this.idleState.idleDuration = 0;
    this.lastHeartbeat = event.timestamp;

    if (this.idleState.isIdle) {
      this.idleState.isIdle = false;
      this.log(`User activity detected, exiting idle state. Activity: ${event.type}`);
      this.emit('idle_end', {
        ...this.idleState,
        lastActivity: event
      });
    }

    this.resetIdleTimer();

    // Emit activity event for other components
    this.emit('activity', event);

    this.log(`Activity recorded: ${event.type} from ${event.source}`);
  }

  /**
   * Get current idle state
   */
  public getIdleState(): IdleState {
    // Update idle duration if currently idle
    if (this.idleState.isIdle) {
      this.idleState.idleDuration = Date.now() - this.idleState.lastActivity.getTime();
    }

    return { ...this.idleState };
  }

  /**
   * Check if currently in idle state
   */
  public isIdle(): boolean {
    return this.idleState.isIdle;
  }

  /**
   * Get duration of current idle period in milliseconds
   */
  public getIdleDuration(): number {
    if (!this.idleState.isIdle) {
      return 0;
    }
    return Date.now() - this.idleState.lastActivity.getTime();
  }

  /**
   * Configure idle threshold
   */
  public setIdleThreshold(minutes: number): void {
    if (minutes <= 0) {
      throw new IdleSystemError(
        'Idle threshold must be positive',
        'IdleDetector',
        'INVALID_THRESHOLD'
      );
    }

    this.config.activityTimeout = minutes;
    this.idleState.idleThreshold = minutes;

    // Reset timer with new threshold
    if (this.isRunning) {
      this.resetIdleTimer();
    }

    this.log(`Idle threshold updated to ${minutes} minutes`);
    this.emit('threshold_changed', minutes);
  }

  /**
   * Get current configuration
   */
  public getConfig(): IdleDetectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<IdleDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update idle state if threshold changed
    if (newConfig.activityTimeout !== undefined) {
      this.setIdleThreshold(newConfig.activityTimeout);
    }

    // Update activity types if changed
    if (newConfig.activityTypes !== undefined) {
      this.idleState.activityTypes = newConfig.activityTypes;
    }

    this.log('Configuration updated');
    this.emit('config_updated', this.config);
  }

  /**
   * Manual heartbeat to indicate system activity
   */
  public heartbeat(): void {
    const heartbeatEvent: ActivityEvent = {
      type: 'api_call',
      timestamp: new Date(),
      source: 'heartbeat',
      metadata: { type: 'manual_heartbeat' }
    };

    this.recordActivity(heartbeatEvent);
  }

  /**
   * Set up activity monitoring for different sources
   */
  private setupActivityMonitoring(): void {
    // Monitor process events that indicate activity
    if (typeof process !== 'undefined') {
      // Monitor for any significant process activity
      const activitySources = ['uncaughtException', 'unhandledRejection'];

      activitySources.forEach(eventType => {
        process.on(eventType as any, () => {
          this.recordActivity({
            type: 'api_call',
            timestamp: new Date(),
            source: 'process',
            metadata: { eventType }
          });
        });
      });
    }

    // Set up periodic heartbeat check
    setInterval(() => {
      this.checkHeartbeat();
    }, 60000); // Check every minute
  }

  /**
   * Reset the idle timer
   */
  private resetIdleTimer(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    const timeoutMs = this.config.activityTimeout * 60 * 1000; // Convert to milliseconds

    this.activityTimer = setTimeout(() => {
      this.enterIdleState();
    }, timeoutMs);
  }

  /**
   * Enter idle state and emit idle event
   */
  private enterIdleState(): void {
    if (!this.isRunning) {
      return;
    }

    const wasIdle = this.idleState.isIdle;

    this.idleState.isIdle = true;
    this.idleState.idleDuration = Date.now() - this.idleState.lastActivity.getTime();

    if (!wasIdle) {
      this.log(`Entering idle state after ${this.config.activityTimeout} minutes of inactivity`);
      this.emit('idle_start', { ...this.idleState });
    }
  }

  /**
   * Check if heartbeat is recent enough
   */
  private checkHeartbeat(): void {
    if (!this.isRunning) {
      return;
    }

    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - this.lastHeartbeat.getTime();
    const heartbeatThreshold = this.config.activityTimeout * 60 * 1000 * 0.5; // Half of idle threshold

    // If no recent heartbeat and we're supposed to have activity, generate one
    if (timeSinceHeartbeat > heartbeatThreshold && !this.idleState.isIdle) {
      this.log('Heartbeat check: no recent activity detected');
    }
  }

  /**
   * Log debug messages if debugging is enabled
   */
  private log(message: string): void {
    if (this.config.debugLogging) {
      console.log(`[IdleDetector] ${new Date().toISOString()}: ${message}`);
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.log('IdleDetector destroyed');
  }
}

/**
 * Global idle detector instance with convenience methods
 */
export class GlobalIdleDetector {
  private static instance: IdleDetector | null = null;

  /**
   * Get or create global idle detector instance
   */
  public static getInstance(config?: Partial<IdleDetectorConfig>): IdleDetector {
    if (!GlobalIdleDetector.instance) {
      GlobalIdleDetector.instance = new IdleDetector(config);
    }
    return GlobalIdleDetector.instance;
  }

  /**
   * Record activity on global instance
   */
  public static recordActivity(type: ActivityType, source: string, metadata?: any): void {
    const detector = GlobalIdleDetector.getInstance();
    detector.recordActivity({
      type,
      timestamp: new Date(),
      source,
      metadata
    });
  }

  /**
   * Quick activity recording methods
   */
  public static recordWebSocketActivity(source: string = 'websocket'): void {
    GlobalIdleDetector.recordActivity('websocket', source);
  }

  public static recordApiCall(source: string = 'api'): void {
    GlobalIdleDetector.recordActivity('api_call', source);
  }

  public static recordUserInput(source: string = 'user'): void {
    GlobalIdleDetector.recordActivity('user_input', source);
  }

  public static recordToolInvocation(source: string = 'tool'): void {
    GlobalIdleDetector.recordActivity('tool_invocation', source);
  }

  /**
   * Check if globally idle
   */
  public static isIdle(): boolean {
    return GlobalIdleDetector.getInstance().isIdle();
  }

  /**
   * Get global idle state
   */
  public static getIdleState(): IdleState {
    return GlobalIdleDetector.getInstance().getIdleState();
  }

  /**
   * Destroy global instance
   */
  public static destroy(): void {
    if (GlobalIdleDetector.instance) {
      GlobalIdleDetector.instance.destroy();
      GlobalIdleDetector.instance = null;
    }
  }
}

export default IdleDetector;