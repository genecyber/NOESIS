/**
 * VR/AR Stance Visualization (Ralph Iteration 9, Feature 1)
 *
 * Immersive 3D stance exploration with WebXR support, spatial mapping
 * of value dimensions, and multi-user shared stance spaces.
 */
import type { Stance, PlannedOperation } from '../types/index.js';
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
    bounds: {
        min: Vector3;
        max: Vector3;
    };
    participants: Participant[];
}
export interface Participant {
    id: string;
    name: string;
    avatar: AvatarConfig;
    headPosition: Vector3;
    handPositions: {
        left: Vector3;
        right: Vector3;
    };
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
export type GestureType = 'pinch' | 'point' | 'grab' | 'swipe_left' | 'swipe_right' | 'thumbs_up' | 'thumbs_down' | 'wave' | 'fist';
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
export declare class VRVisualizationManager {
    private config;
    private currentSession;
    private spaces;
    private gestureCommands;
    private stats;
    constructor(config?: Partial<VRConfig>);
    /**
     * Register default gesture commands
     */
    private registerDefaultGestures;
    /**
     * Check WebXR availability
     */
    checkXRSupport(): Promise<{
        vr: boolean;
        ar: boolean;
    }>;
    /**
     * Start a VR/AR session
     */
    startSession(mode: 'vr' | 'ar' | 'inline', spaceName?: string): Promise<XRSession>;
    /**
     * End the current session
     */
    endSession(): boolean;
    /**
     * Create a stance space
     */
    createSpace(name: string): StanceSpace;
    /**
     * Create default value axes
     */
    private createDefaultAxes;
    /**
     * Add a stance to the visualization space
     */
    addStanceNode(spaceId: string, stance: Stance, position?: Vector3): StanceNode | null;
    /**
     * Calculate 3D position from stance values
     */
    private calculatePositionFromValues;
    /**
     * Get color for a frame type
     */
    private getFrameColor;
    /**
     * Connect two stance nodes
     */
    connectNodes(spaceId: string, nodeId1: string, nodeId2: string): boolean;
    /**
     * Add a participant to a space
     */
    addParticipant(spaceId: string, name: string, isHost?: boolean): Participant | null;
    /**
     * Get a random color for avatar
     */
    private getRandomColor;
    /**
     * Update participant position
     */
    updateParticipantPosition(spaceId: string, participantId: string, head: Vector3, leftHand: Vector3, rightHand: Vector3): boolean;
    /**
     * Process hand gesture
     */
    processGesture(gesture: GestureType): boolean;
    /**
     * Register a custom gesture command
     */
    registerGesture(command: GestureCommand): void;
    /**
     * Apply an operator visually
     */
    visualizeOperator(spaceId: string, nodeId: string, operator: PlannedOperation): boolean;
    /**
     * Generate WebXR scene descriptor
     */
    generateSceneDescriptor(spaceId: string): Record<string, unknown> | null;
    /**
     * Get current session
     */
    getCurrentSession(): XRSession | null;
    /**
     * Get space by ID
     */
    getSpace(spaceId: string): StanceSpace | null;
    /**
     * List all spaces
     */
    listSpaces(): StanceSpace[];
    /**
     * Get statistics
     */
    getStats(): VRStats;
    /**
     * Export space as GLTF-compatible format
     */
    exportSpace(spaceId: string): Record<string, unknown> | null;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const vrVisualization: VRVisualizationManager;
//# sourceMappingURL=visualization.d.ts.map