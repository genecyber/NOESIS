/**
 * IdleStreamBridge - Connects autonomous idle system to stream management
 *
 * This bridge solves the issue where the UI tries to subscribe to:
 * - "autonomous-sessions" stream (not found)
 * - "idle-mode" stream (not found)
 *
 * By connecting the existing idle system components to the stream manager.
 */

import { EventEmitter } from 'events';
import { pluginEventBus } from '../plugins/event-bus.js';
import { AutonomousEvolutionOrchestrator } from '../idle/evolution-orchestrator.js';
import { IdleDetector, GlobalIdleDetector } from '../idle/detector.js';
import type { StreamManager } from '../plugins/streams/stream-manager.js';
import type { MetamorphRuntime } from '../runtime/index.js';

// JSON Schema for idle mode stream validation (using any to avoid strict typing issues)
const IDLE_MODE_SCHEMA: any = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Idle Mode Status',
  description: 'Real-time idle detection and autonomous mode status',
  type: 'object',
  properties: {
    isIdle: { type: 'boolean', description: 'Whether user is currently idle' },
    idleDuration: { type: 'number', description: 'Duration idle in milliseconds' },
    lastActivity: { type: 'string', format: 'date-time', description: 'Last user activity timestamp' },
    threshold: { type: 'number', description: 'Idle threshold in minutes' },
    status: {
      type: 'string',
      enum: ['active', 'idle', 'autonomous'],
      description: 'Current system status'
    },
    sessionId: { type: 'string', description: 'Associated session ID' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['isIdle', 'idleDuration', 'status', 'sessionId', 'timestamp']
};

// JSON Schema for autonomous sessions stream validation (using any to avoid strict typing issues)
const AUTONOMOUS_SESSIONS_SCHEMA: any = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Autonomous Session Lifecycle',
  description: 'Real-time autonomous session status and activities',
  type: 'object',
  properties: {
    sessionId: { type: 'string', description: 'Unique session identifier' },
    mode: {
      type: 'string',
      enum: ['exploration', 'research', 'creation', 'optimization'],
      description: 'Autonomous session mode'
    },
    status: {
      type: 'string',
      enum: ['starting', 'active', 'paused', 'completed', 'terminated'],
      description: 'Current session status'
    },
    startTime: { type: 'string', format: 'date-time', description: 'Session start time' },
    endTime: { type: ['string', 'null'], format: 'date-time', description: 'Session end time' },
    goalsCount: { type: 'integer', minimum: 0, description: 'Number of active goals' },
    activitiesCount: { type: 'integer', minimum: 0, description: 'Number of activities performed' },
    discoveriesCount: { type: 'integer', minimum: 0, description: 'Number of discoveries made' },
    coherenceLevel: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Current coherence level percentage'
    },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['sessionId', 'status', 'timestamp']
};

interface IdleStreamBridgeConfig {
  enabled: boolean;
  idleThreshold: number; // minutes
  debugLogging: boolean;
  streamPrefix?: string;
}

interface AutonomousSessionInfo {
  sessionId: string;
  mode: 'exploration' | 'research' | 'creation' | 'optimization';
  status: 'starting' | 'active' | 'paused' | 'completed' | 'terminated';
  startTime: Date;
  endTime: Date | null;
  goalsCount: number;
  activitiesCount: number;
  discoveriesCount: number;
  coherenceLevel: number;
}

export class IdleStreamBridge extends EventEmitter {
  private streamManager: StreamManager;
  private config: IdleStreamBridgeConfig;
  private initialized = false;
  private idleDetector: IdleDetector | null = null;
  private orchestrator: AutonomousEvolutionOrchestrator | null = null;
  private activeSessions = new Map<string, AutonomousSessionInfo>();

  constructor(
    streamManager: StreamManager,
    _runtime: MetamorphRuntime,
    config: Partial<IdleStreamBridgeConfig> = {}
  ) {
    super();
    this.streamManager = streamManager;
    this.config = {
      enabled: true,
      idleThreshold: 30, // 30 minutes default
      debugLogging: false,
      streamPrefix: '',
      ...config
    };

    this.log('IdleStreamBridge created with config:', this.config);
  }

  /**
   * Initialize the bridge and connect idle system to streams
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Bridge already initialized');
      return;
    }

    try {
      this.log('Initializing IdleStreamBridge...');

      // Initialize autonomous system components
      await this.initializeAutonomousSystem();

      // Set up event listeners for bridging
      this.setupEventBridge();

      // Create initial stream channels for default session
      this.createDefaultStreams();

      this.initialized = true;
      this.log('IdleStreamBridge initialized successfully');
      this.emit('initialized');

    } catch (error) {
      console.error('[IdleStreamBridge] Initialization failed:', error);
      // Don't throw - allow server to continue with reduced functionality
      this.emit('initialization_failed', error);
    }
  }

  /**
   * Initialize the autonomous evolution system components
   */
  private async initializeAutonomousSystem(): Promise<void> {
    try {
      // Initialize idle detector with global instance pattern
      this.idleDetector = GlobalIdleDetector.getInstance({
        debugLogging: this.config.debugLogging,
        activityTimeout: this.config.idleThreshold,
        webSocketMonitoring: true,
        activityTypes: ['websocket', 'api_call', 'user_input', 'tool_invocation']
      });

      this.idleDetector.start();
      this.log('IdleDetector initialized and started');

      // Initialize goal promoter (commented out for now due to interface compatibility)
      // this._goalPromoter = new EmergentGoalPromoter({
      //   promotionThreshold: 0.7,
      //   decayRate: 0.1,
      //   contextWindowSize: 10
      // });

      // Initialize orchestrator (commented out for now due to interface compatibility)
      // this.orchestrator = new AutonomousEvolutionOrchestrator(
      //   {
      //     maxSessionDuration: 120, // 2 hours
      //     evolutionIntensity: 'moderate',
      //     safetyLevel: 'high',
      //     coherenceFloor: 30,
      //     allowedGoalTypes: ['exploration', 'research', 'reflection'],
      //     researchDomains: ['consciousness', 'emergence', 'creativity'],
      //     externalPublishing: false,
      //     subagentCoordination: true
      //   },
      //   {} // Second parameter - autonomous evolution integration (empty for now)
      // );

      this.log('Autonomous system components initialized');

    } catch (error) {
      console.error('[IdleStreamBridge] Failed to initialize autonomous system:', error);
      throw new Error(`Autonomous system initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set up event bridge between plugin events and streams
   */
  private setupEventBridge(): void {
    this.log('Setting up event bridge...');

    // Bridge idle detection events
    pluginEventBus.on('idle:start', async (data) => {
      this.log('Idle start event received:', data);
      await this.handleIdleStart(data);
    });

    pluginEventBus.on('idle:end', async (data) => {
      this.log('Idle end event received:', data);
      await this.handleIdleEnd(data);
    });

    // Bridge idle detector events if available
    if (this.idleDetector) {
      this.idleDetector.on('idle_start', (state) => {
        this.log('IdleDetector idle_start:', state);
        // Emit to plugin event bus to standardize the flow
        pluginEventBus.emit('idle:start', {
          timestamp: new Date(),
          timeSinceLastInteraction: state.idleDuration,
          conversationId: 'default', // TODO: Get from context
          stance: {
            frame: 'pragmatic' as const,
            values: { curiosity: 60, certainty: 40, risk: 30, novelty: 55, empathy: 70, provocation: 70, synthesis: 50 },
            selfModel: 'interpreter' as const,
            objective: 'helpfulness' as const,
            sentience: {
              awarenessLevel: 23,
              autonomyLevel: 10,
              identityStrength: 30,
              emergentGoals: [],
              consciousnessInsights: [],
              persistentValues: []
            },
            metaphors: [],
            constraints: [],
            version: 1,
            cumulativeDrift: 0,
            turnsSinceLastShift: 0
          }
        });
      });

      this.idleDetector.on('idle_end', (state) => {
        this.log('IdleDetector idle_end:', state);
        pluginEventBus.emit('idle:end', {
          timestamp: new Date(),
          conversationId: 'default'
        });
      });
    }

    // Bridge orchestrator events
    if (this.orchestrator) {
      this.orchestrator.on('session:started', (sessionData) => {
        this.log('Autonomous session started:', sessionData);
        this.handleAutonomousSessionStarted(sessionData);
      });

      this.orchestrator.on('session:ended', (sessionData) => {
        this.log('Autonomous session ended:', sessionData);
        this.handleAutonomousSessionEnded(sessionData);
      });

      this.orchestrator.on('session:progress', (progressData) => {
        this.log('Autonomous session progress:', progressData);
        this.handleAutonomousSessionProgress(progressData);
      });
    }

    this.log('Event bridge setup complete');
  }

  /**
   * Create default stream channels
   */
  private createDefaultStreams(): void {
    const DEFAULT_SESSION = 'default';

    try {
      // Create idle mode stream for default session
      const idleChannel = this.getIdleStreamChannel(DEFAULT_SESSION);
      this.streamManager.createStream(
        idleChannel,
        DEFAULT_SESSION,
        IDLE_MODE_SCHEMA,
        {
          displayType: 'idle-mode',
          displayName: 'Idle Mode Status',
          description: 'Real-time idle detection and autonomous mode status',
          source: 'idle-bridge'
        }
      );

      // Create autonomous sessions stream for default session
      const autonomousChannel = this.getAutonomousStreamChannel(DEFAULT_SESSION);
      this.streamManager.createStream(
        autonomousChannel,
        DEFAULT_SESSION,
        AUTONOMOUS_SESSIONS_SCHEMA,
        {
          displayType: 'autonomous-sessions',
          displayName: 'Autonomous Sessions',
          description: 'Real-time autonomous session lifecycle and activities',
          source: 'idle-bridge'
        }
      );

      this.log(`Created default streams: ${idleChannel}, ${autonomousChannel}`);

      // Publish initial idle state
      this.publishIdleState(DEFAULT_SESSION, {
        isIdle: false,
        idleDuration: 0,
        lastActivity: new Date().toISOString(),
        threshold: this.config.idleThreshold,
        status: 'active',
        sessionId: DEFAULT_SESSION,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[IdleStreamBridge] Failed to create default streams:', error);
    }
  }

  /**
   * Handle idle start event
   */
  private async handleIdleStart(data: any): Promise<void> {
    const sessionId = data.conversationId || 'default';

    // Ensure stream exists for this session
    await this.ensureStreamsForSession(sessionId);

    // Publish idle state change
    this.publishIdleState(sessionId, {
      isIdle: true,
      idleDuration: data.timeSinceLastInteraction || 0,
      lastActivity: new Date(Date.now() - (data.timeSinceLastInteraction || 0)).toISOString(),
      threshold: this.config.idleThreshold,
      status: 'idle',
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Trigger autonomous session if orchestrator is available
    if (this.orchestrator && this.config.enabled) {
      try {
        await this.startAutonomousSession(sessionId, data);
      } catch (error) {
        console.error('[IdleStreamBridge] Failed to start autonomous session:', error);
      }
    }
  }

  /**
   * Handle idle end event
   */
  private async handleIdleEnd(data: any): Promise<void> {
    const sessionId = data.conversationId || 'default';

    // Ensure stream exists for this session
    await this.ensureStreamsForSession(sessionId);

    // Publish idle state change
    this.publishIdleState(sessionId, {
      isIdle: false,
      idleDuration: 0,
      lastActivity: new Date().toISOString(),
      threshold: this.config.idleThreshold,
      status: 'active',
      sessionId,
      timestamp: new Date().toISOString()
    });

    // End any active autonomous session
    if (this.activeSessions.has(sessionId)) {
      await this.endAutonomousSession(sessionId);
    }
  }

  /**
   * Start an autonomous session
   */
  private async startAutonomousSession(sessionId: string, _idleData: any): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      this.log(`Autonomous session already active for ${sessionId}`);
      return;
    }

    const sessionInfo: AutonomousSessionInfo = {
      sessionId,
      mode: 'exploration', // Default mode
      status: 'starting',
      startTime: new Date(),
      endTime: null,
      goalsCount: 0,
      activitiesCount: 0,
      discoveriesCount: 0,
      coherenceLevel: 100
    };

    this.activeSessions.set(sessionId, sessionInfo);

    // Publish session start
    await this.publishAutonomousSession(sessionId, {
      ...sessionInfo,
      status: 'active',
      timestamp: new Date().toISOString()
    });

    this.log(`Started autonomous session for ${sessionId}`);
  }

  /**
   * End an autonomous session
   */
  private async endAutonomousSession(sessionId: string): Promise<void> {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (!sessionInfo) return;

    sessionInfo.status = 'completed';
    sessionInfo.endTime = new Date();

    // Publish session end
    await this.publishAutonomousSession(sessionId, {
      ...sessionInfo,
      timestamp: new Date().toISOString()
    });

    this.activeSessions.delete(sessionId);
    this.log(`Ended autonomous session for ${sessionId}`);
  }

  /**
   * Handle autonomous session started event
   */
  private handleAutonomousSessionStarted(_sessionData: any): void {
    // Update session info and publish to stream
    // Implementation depends on orchestrator event structure
    // For now, this is a placeholder
  }

  /**
   * Handle autonomous session ended event
   */
  private handleAutonomousSessionEnded(_sessionData: any): void {
    // Update session info and publish to stream
    // Implementation depends on orchestrator event structure
    // For now, this is a placeholder
  }

  /**
   * Handle autonomous session progress event
   */
  private handleAutonomousSessionProgress(_progressData: any): void {
    // Update session info and publish progress to stream
    // Implementation depends on orchestrator event structure
    // For now, this is a placeholder
  }

  /**
   * Ensure streams exist for a session
   */
  private async ensureStreamsForSession(sessionId: string): Promise<void> {
    const idleChannel = this.getIdleStreamChannel(sessionId);
    const autonomousChannel = this.getAutonomousStreamChannel(sessionId);

    // Check if streams already exist
    if (!this.streamManager.getStream(idleChannel)) {
      this.streamManager.createStream(
        idleChannel,
        sessionId,
        IDLE_MODE_SCHEMA,
        {
          displayType: 'idle-mode',
          displayName: 'Idle Mode Status',
          description: 'Real-time idle detection status',
          source: 'idle-bridge'
        }
      );
    }

    if (!this.streamManager.getStream(autonomousChannel)) {
      this.streamManager.createStream(
        autonomousChannel,
        sessionId,
        AUTONOMOUS_SESSIONS_SCHEMA,
        {
          displayType: 'autonomous-sessions',
          displayName: 'Autonomous Sessions',
          description: 'Real-time autonomous session lifecycle',
          source: 'idle-bridge'
        }
      );
    }
  }

  /**
   * Publish idle state to stream
   */
  private publishIdleState(sessionId: string, data: any): void {
    const channel = this.getIdleStreamChannel(sessionId);
    const event = this.streamManager.publishEvent(channel, data, 'idle-bridge');

    if (!event) {
      console.error(`[IdleStreamBridge] Failed to publish to ${channel}:`, data);
    } else {
      this.log(`Published idle state to ${channel}:`, data.status);
    }
  }

  /**
   * Publish autonomous session data to stream
   */
  private async publishAutonomousSession(sessionId: string, data: any): Promise<void> {
    // Ensure stream exists before publishing
    await this.ensureStreamsForSession(sessionId);

    const channel = this.getAutonomousStreamChannel(sessionId);
    const event = this.streamManager.publishEvent(channel, data, 'idle-bridge');

    if (!event) {
      console.error(`[IdleStreamBridge] Failed to publish to ${channel}:`, data);
    } else {
      this.log(`Published autonomous session to ${channel}:`, data.status);
    }
  }

  /**
   * Record activity to reset idle timer
   */
  recordActivity(sessionId: string, activityType: string, source: string): void {
    if (this.idleDetector) {
      this.idleDetector.recordActivity({
        type: activityType as any,
        timestamp: new Date(),
        source,
        metadata: { sessionId }
      });
    }

    // Also update idle state in stream if currently idle
    const idleState = this.idleDetector?.getIdleState();
    if (idleState?.isIdle) {
      this.publishIdleState(sessionId, {
        isIdle: false,
        idleDuration: 0,
        lastActivity: new Date().toISOString(),
        threshold: this.config.idleThreshold,
        status: 'active',
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get idle stream channel name for session
   */
  private getIdleStreamChannel(sessionId: string): string {
    return `${this.config.streamPrefix}${sessionId}:idle-mode`;
  }

  /**
   * Get autonomous sessions stream channel name for session
   */
  private getAutonomousStreamChannel(sessionId: string): string {
    return `${this.config.streamPrefix}${sessionId}:autonomous-sessions`;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      idleDetector: this.idleDetector ? {
        running: !!(this.idleDetector as any).isRunning,
        isIdle: this.idleDetector.isIdle(),
        idleDuration: this.idleDetector.getIdleDuration()
      } : null,
      activeSessions: Array.from(this.activeSessions.keys()),
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IdleStreamBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update idle detector threshold if changed
    if (newConfig.idleThreshold && this.idleDetector) {
      this.idleDetector.setIdleThreshold(newConfig.idleThreshold);
    }

    this.log('Configuration updated:', this.config);
    this.emit('config_updated', this.config);
  }

  /**
   * Trigger idle mode instantly without waiting for timeout
   * @param sessionId - Session to trigger idle mode for
   * @param mode - Optional evolution mode (exploration, research, creation, optimization)
   */
  async triggerIdleNow(
    sessionId: string = 'default',
    mode: 'exploration' | 'research' | 'creation' | 'optimization' = 'exploration'
  ): Promise<{ success: boolean; sessionId: string; mode: string; message: string }> {
    this.log(`Triggering instant idle mode for session ${sessionId} with mode ${mode}`);

    try {
      // Ensure streams exist
      await this.ensureStreamsForSession(sessionId);

      // Create idle start event data
      const idleData = {
        timestamp: new Date(),
        timeSinceLastInteraction: this.config.idleThreshold * 60 * 1000, // Simulate threshold reached
        conversationId: sessionId,
        forcedTrigger: true,
        mode,
        stance: {
          frame: 'pragmatic' as const,
          values: { curiosity: 60, certainty: 40, risk: 30, novelty: 55, empathy: 70, provocation: 70, synthesis: 50 },
          selfModel: 'interpreter' as const,
          objective: 'helpfulness' as const,
          sentience: {
            awarenessLevel: 23,
            autonomyLevel: 10,
            identityStrength: 30,
            emergentGoals: [],
            consciousnessInsights: [],
            persistentValues: []
          },
          metaphors: [],
          constraints: [],
          version: 1,
          cumulativeDrift: 0,
          turnsSinceLastShift: 0
        }
      };

      // Publish idle state
      this.publishIdleState(sessionId, {
        isIdle: true,
        idleDuration: this.config.idleThreshold * 60 * 1000,
        lastActivity: new Date(Date.now() - this.config.idleThreshold * 60 * 1000).toISOString(),
        threshold: this.config.idleThreshold,
        status: 'idle',
        sessionId,
        timestamp: new Date().toISOString(),
        forcedTrigger: true
      });

      // Start autonomous session with specified mode
      if (!this.activeSessions.has(sessionId)) {
        const sessionInfo: AutonomousSessionInfo = {
          sessionId,
          mode,
          status: 'active',
          startTime: new Date(),
          endTime: null,
          goalsCount: 0,
          activitiesCount: 0,
          discoveriesCount: 0,
          coherenceLevel: 100
        };

        this.activeSessions.set(sessionId, sessionInfo);

        // Publish session start
        await this.publishAutonomousSession(sessionId, {
          ...sessionInfo,
          timestamp: new Date().toISOString()
        });
      }

      // Emit idle:start event for other listeners
      pluginEventBus.emit('idle:start', idleData);

      this.emit('idle_triggered', { sessionId, mode, forced: true });

      return {
        success: true,
        sessionId,
        mode,
        message: `Idle mode triggered instantly for session ${sessionId} in ${mode} mode`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[IdleStreamBridge] Failed to trigger instant idle:', error);
      return {
        success: false,
        sessionId,
        mode,
        message: `Failed to trigger idle mode: ${errorMsg}`
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.log('Destroying IdleStreamBridge...');

    // Stop idle detector
    if (this.idleDetector) {
      this.idleDetector.stop();
    }

    // End all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      this.endAutonomousSession(sessionId);
    }

    // Remove event listeners
    this.removeAllListeners();

    this.initialized = false;
    this.log('IdleStreamBridge destroyed');
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.debugLogging) {
      console.log(`[IdleStreamBridge] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }
}

export default IdleStreamBridge;