/**
 * VR/AR Stance Visualization (Ralph Iteration 9, Feature 1)
 *
 * Immersive 3D stance exploration with WebXR support, spatial mapping
 * of value dimensions, and multi-user shared stance spaces.
 */

import type { Stance, Frame, PlannedOperation } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface VRConfig {
  enableVR: boolean;
  enableAR: boolean;
  renderQuality: RenderQuality;
  spatialScale: number;
  handTracking: boolean;
  voiceCommands: boolean;
  multiUser: boolean;
  maxParticipants: number;
}

export type RenderQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface StanceNode {
  id: string;
  stance: Stance;
  transform: Transform;
  color: string;
  size: number;
  connections: string[];
  metadata: Record<string, unknown>;
}

export interface ValueAxis {
  name: string;
  direction: Vector3;
  color: string;
  minValue: number;
  maxValue: number;
  currentValue: number;
}

export interface StanceSpace {
  id: string;
  name: string;
  nodes: Map<string, StanceNode>;
  axes: ValueAxis[];
  origin: Vector3;
  bounds: { min: Vector3; max: Vector3 };
  participants: Participant[];
}

export interface Participant {
  id: string;
  name: string;
  avatar: AvatarConfig;
  headPosition: Vector3;
  handPositions: { left: Vector3; right: Vector3 };
  isHost: boolean;
  permissions: ParticipantPermissions;
}

export interface AvatarConfig {
  model: string;
  color: string;
  scale: number;
}

export interface ParticipantPermissions {
  canEdit: boolean;
  canInvokeOperators: boolean;
  canInvite: boolean;
}

export interface GestureCommand {
  name: string;
  gesture: GestureType;
  action: () => void;
}

export type GestureType =
  | 'pinch'
  | 'point'
  | 'grab'
  | 'swipe_left'
  | 'swipe_right'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'wave'
  | 'fist';

export interface XRSession {
  id: string;
  mode: 'vr' | 'ar' | 'inline';
  startTime: Date;
  frameRate: number;
  isActive: boolean;
  space: StanceSpace;
}

export interface VRStats {
  totalSessions: number;
  activeSessions: number;
  totalNodes: number;
  averageFrameRate: number;
  multiUserSessions: number;
}

// ============================================================================
// VR Stance Visualization Manager
// ============================================================================

export class VRVisualizationManager {
  private config: VRConfig;
  private currentSession: XRSession | null = null;
  private spaces: Map<string, StanceSpace> = new Map();
  private gestureCommands: Map<GestureType, GestureCommand> = new Map();
  private stats: VRStats;

  constructor(config: Partial<VRConfig> = {}) {
    this.config = {
      enableVR: true,
      enableAR: true,
      renderQuality: 'high',
      spatialScale: 1.0,
      handTracking: true,
      voiceCommands: true,
      multiUser: true,
      maxParticipants: 8,
      ...config
    };

    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalNodes: 0,
      averageFrameRate: 0,
      multiUserSessions: 0
    };

    this.registerDefaultGestures();
  }

  /**
   * Register default gesture commands
   */
  private registerDefaultGestures(): void {
    this.gestureCommands.set('pinch', {
      name: 'Select Node',
      gesture: 'pinch',
      action: () => { /* Select the targeted stance node */ }
    });

    this.gestureCommands.set('grab', {
      name: 'Move Node',
      gesture: 'grab',
      action: () => { /* Move the selected stance node */ }
    });

    this.gestureCommands.set('thumbs_up', {
      name: 'Increase Value',
      gesture: 'thumbs_up',
      action: () => { /* Increase the current value dimension */ }
    });

    this.gestureCommands.set('thumbs_down', {
      name: 'Decrease Value',
      gesture: 'thumbs_down',
      action: () => { /* Decrease the current value dimension */ }
    });

    this.gestureCommands.set('wave', {
      name: 'Apply Operator',
      gesture: 'wave',
      action: () => { /* Apply the selected operator */ }
    });
  }

  /**
   * Check WebXR availability
   */
  async checkXRSupport(): Promise<{ vr: boolean; ar: boolean }> {
    // In a real implementation, this would check navigator.xr
    return {
      vr: this.config.enableVR,
      ar: this.config.enableAR
    };
  }

  /**
   * Start a VR/AR session
   */
  async startSession(
    mode: 'vr' | 'ar' | 'inline',
    spaceName?: string
  ): Promise<XRSession> {
    const space = this.createSpace(spaceName || `space-${Date.now()}`);

    const session: XRSession = {
      id: `xr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mode,
      startTime: new Date(),
      frameRate: 90,
      isActive: true,
      space
    };

    this.currentSession = session;
    this.stats.totalSessions++;
    this.stats.activeSessions++;

    return session;
  }

  /**
   * End the current session
   */
  endSession(): boolean {
    if (!this.currentSession) return false;

    this.currentSession.isActive = false;
    this.stats.activeSessions--;
    this.currentSession = null;
    return true;
  }

  /**
   * Create a stance space
   */
  createSpace(name: string): StanceSpace {
    const space: StanceSpace = {
      id: `space-${Date.now()}`,
      name,
      nodes: new Map(),
      axes: this.createDefaultAxes(),
      origin: { x: 0, y: 0, z: 0 },
      bounds: {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 10, y: 10, z: 10 }
      },
      participants: []
    };

    this.spaces.set(space.id, space);
    return space;
  }

  /**
   * Create default value axes
   */
  private createDefaultAxes(): ValueAxis[] {
    return [
      {
        name: 'Curiosity',
        direction: { x: 1, y: 0, z: 0 },
        color: '#4ECDC4',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Certainty',
        direction: { x: 0, y: 1, z: 0 },
        color: '#FF6B6B',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Risk',
        direction: { x: 0, y: 0, z: 1 },
        color: '#FFE66D',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Novelty',
        direction: { x: 0.707, y: 0.707, z: 0 },
        color: '#96CEB4',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Empathy',
        direction: { x: 0.707, y: 0, z: 0.707 },
        color: '#DDA0DD',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Provocation',
        direction: { x: 0, y: 0.707, z: 0.707 },
        color: '#FF8C00',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      },
      {
        name: 'Synthesis',
        direction: { x: 0.577, y: 0.577, z: 0.577 },
        color: '#9370DB',
        minValue: 0,
        maxValue: 100,
        currentValue: 50
      }
    ];
  }

  /**
   * Add a stance to the visualization space
   */
  addStanceNode(
    spaceId: string,
    stance: Stance,
    position?: Vector3
  ): StanceNode | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    const calculatedPosition = position || this.calculatePositionFromValues(stance.values);

    const node: StanceNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      stance,
      transform: {
        position: calculatedPosition,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      },
      color: this.getFrameColor(stance.frame),
      size: 0.5 + (stance.sentience.awarenessLevel / 100) * 0.5,
      connections: [],
      metadata: {}
    };

    space.nodes.set(node.id, node);
    this.stats.totalNodes++;

    return node;
  }

  /**
   * Calculate 3D position from stance values
   */
  private calculatePositionFromValues(values: Record<string, number>): Vector3 {
    // Map values to 3D space using the first three value dimensions
    const scale = this.config.spatialScale * 5;
    return {
      x: ((values.curiosity || 50) - 50) / 50 * scale,
      y: ((values.certainty || 50) - 50) / 50 * scale,
      z: ((values.risk || 50) - 50) / 50 * scale
    };
  }

  /**
   * Get color for a frame type
   */
  private getFrameColor(frame: Frame): string {
    const colors: Record<Frame, string> = {
      existential: '#4169E1',
      pragmatic: '#32CD32',
      poetic: '#FF69B4',
      adversarial: '#DC143C',
      playful: '#FFD700',
      mythic: '#8B4513',
      systems: '#708090',
      psychoanalytic: '#9932CC',
      stoic: '#696969',
      absurdist: '#FF4500'
    };
    return colors[frame] || '#808080';
  }

  /**
   * Connect two stance nodes
   */
  connectNodes(spaceId: string, nodeId1: string, nodeId2: string): boolean {
    const space = this.spaces.get(spaceId);
    if (!space) return false;

    const node1 = space.nodes.get(nodeId1);
    const node2 = space.nodes.get(nodeId2);
    if (!node1 || !node2) return false;

    if (!node1.connections.includes(nodeId2)) {
      node1.connections.push(nodeId2);
    }
    if (!node2.connections.includes(nodeId1)) {
      node2.connections.push(nodeId1);
    }

    return true;
  }

  /**
   * Add a participant to a space
   */
  addParticipant(
    spaceId: string,
    name: string,
    isHost: boolean = false
  ): Participant | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    if (space.participants.length >= this.config.maxParticipants) {
      return null;
    }

    const participant: Participant = {
      id: `participant-${Date.now()}`,
      name,
      avatar: {
        model: 'default',
        color: this.getRandomColor(),
        scale: 1.0
      },
      headPosition: { x: 0, y: 1.6, z: 0 },
      handPositions: {
        left: { x: -0.3, y: 1.0, z: 0.3 },
        right: { x: 0.3, y: 1.0, z: 0.3 }
      },
      isHost,
      permissions: {
        canEdit: isHost,
        canInvokeOperators: true,
        canInvite: isHost
      }
    };

    space.participants.push(participant);

    if (space.participants.length > 1) {
      this.stats.multiUserSessions++;
    }

    return participant;
  }

  /**
   * Get a random color for avatar
   */
  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#96CEB4', '#DDA0DD', '#FF8C00'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Update participant position
   */
  updateParticipantPosition(
    spaceId: string,
    participantId: string,
    head: Vector3,
    leftHand: Vector3,
    rightHand: Vector3
  ): boolean {
    const space = this.spaces.get(spaceId);
    if (!space) return false;

    const participant = space.participants.find(p => p.id === participantId);
    if (!participant) return false;

    participant.headPosition = head;
    participant.handPositions = { left: leftHand, right: rightHand };
    return true;
  }

  /**
   * Process hand gesture
   */
  processGesture(gesture: GestureType): boolean {
    const command = this.gestureCommands.get(gesture);
    if (!command) return false;

    command.action();
    return true;
  }

  /**
   * Register a custom gesture command
   */
  registerGesture(command: GestureCommand): void {
    this.gestureCommands.set(command.gesture, command);
  }

  /**
   * Apply an operator visually
   */
  visualizeOperator(
    spaceId: string,
    nodeId: string,
    operator: PlannedOperation
  ): boolean {
    const space = this.spaces.get(spaceId);
    if (!space) return false;

    const node = space.nodes.get(nodeId);
    if (!node) return false;

    // In a real implementation, this would trigger visual effects
    // For now, we just update the metadata
    node.metadata.lastOperator = operator.name;
    node.metadata.operatorTime = new Date().toISOString();

    return true;
  }

  /**
   * Generate WebXR scene descriptor
   */
  generateSceneDescriptor(spaceId: string): Record<string, unknown> | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    return {
      type: 'webxr-scene',
      version: '1.0.0',
      space: {
        id: space.id,
        name: space.name,
        origin: space.origin,
        bounds: space.bounds
      },
      nodes: [...space.nodes.values()].map(node => ({
        id: node.id,
        position: node.transform.position,
        rotation: node.transform.rotation,
        scale: node.transform.scale,
        color: node.color,
        size: node.size,
        frame: node.stance.frame,
        selfModel: node.stance.selfModel,
        connections: node.connections
      })),
      axes: space.axes.map(axis => ({
        name: axis.name,
        direction: axis.direction,
        color: axis.color,
        range: [axis.minValue, axis.maxValue],
        current: axis.currentValue
      })),
      participants: space.participants.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost
      })),
      config: {
        renderQuality: this.config.renderQuality,
        spatialScale: this.config.spatialScale,
        handTracking: this.config.handTracking
      }
    };
  }

  /**
   * Get current session
   */
  getCurrentSession(): XRSession | null {
    return this.currentSession;
  }

  /**
   * Get space by ID
   */
  getSpace(spaceId: string): StanceSpace | null {
    return this.spaces.get(spaceId) || null;
  }

  /**
   * List all spaces
   */
  listSpaces(): StanceSpace[] {
    return [...this.spaces.values()];
  }

  /**
   * Get statistics
   */
  getStats(): VRStats {
    return { ...this.stats };
  }

  /**
   * Export space as GLTF-compatible format
   */
  exportSpace(spaceId: string): Record<string, unknown> | null {
    const space = this.spaces.get(spaceId);
    if (!space) return null;

    return {
      asset: { version: '2.0', generator: 'Metamorph VR' },
      scene: 0,
      scenes: [{
        name: space.name,
        nodes: [...space.nodes.keys()].map((_, i) => i)
      }],
      nodes: [...space.nodes.values()].map(node => ({
        name: node.id,
        translation: [
          node.transform.position.x,
          node.transform.position.y,
          node.transform.position.z
        ],
        scale: [
          node.transform.scale.x,
          node.transform.scale.y,
          node.transform.scale.z
        ],
        extras: {
          frame: node.stance.frame,
          selfModel: node.stance.selfModel,
          color: node.color
        }
      }))
    };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.endSession();
    this.spaces.clear();
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalNodes: 0,
      averageFrameRate: 0,
      multiUserSessions: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const vrVisualization = new VRVisualizationManager();
