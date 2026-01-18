/**
 * 3D Stance Visualization Export
 *
 * Export stance configurations to 3D formats (GLTF, USD)
 * with animated transitions and WebXR compatibility.
 */
import type { Stance, Frame, Values } from '../types/index.js';
export interface Scene3D {
    id: string;
    name: string;
    stances: StanceNode3D[];
    transitions: TransitionAnimation[];
    camera: CameraConfig;
    lighting: LightingConfig;
    metadata: SceneMetadata;
}
export interface StanceNode3D {
    id: string;
    stance: Stance;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    mesh: MeshConfig;
    materials: MaterialConfig[];
    children: string[];
}
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
export interface MeshConfig {
    type: 'sphere' | 'cube' | 'torus' | 'custom';
    geometry: GeometryParams;
    lod: LODConfig[];
}
export interface GeometryParams {
    radius?: number;
    width?: number;
    height?: number;
    depth?: number;
    segments?: number;
}
export interface LODConfig {
    distance: number;
    segments: number;
}
export interface MaterialConfig {
    type: 'standard' | 'emissive' | 'transparent';
    color: ColorRGBA;
    metalness?: number;
    roughness?: number;
    opacity?: number;
    emissiveIntensity?: number;
}
export interface ColorRGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface TransitionAnimation {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    duration: number;
    easing: EasingFunction;
    keyframes: Keyframe[];
}
export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic';
export interface Keyframe {
    time: number;
    position?: Vector3;
    rotation?: Quaternion;
    scale?: Vector3;
    color?: ColorRGBA;
}
export interface CameraConfig {
    position: Vector3;
    target: Vector3;
    fov: number;
    near: number;
    far: number;
    type: 'perspective' | 'orthographic';
}
export interface LightingConfig {
    ambient: LightSource;
    directional: LightSource[];
    point: LightSource[];
}
export interface LightSource {
    color: ColorRGBA;
    intensity: number;
    position?: Vector3;
    direction?: Vector3;
}
export interface SceneMetadata {
    version: string;
    generator: string;
    createdAt: Date;
    frameCount: number;
    duration: number;
}
export interface ExportOptions {
    format: 'gltf' | 'glb' | 'usd' | 'usda' | 'usdc';
    embedTextures: boolean;
    includeAnimations: boolean;
    optimizeMeshes: boolean;
    lodLevels: number;
    webxrCompatible: boolean;
}
export interface VisualMapping {
    frameToColor: Record<Frame, ColorRGBA>;
    valueToSize: (values: Values) => number;
    sentienceToEmission: (sentience: Stance['sentience']) => number;
    objectiveToShape: Record<string, MeshConfig['type']>;
}
export declare class Stance3DExporter {
    private mapping;
    private scenes;
    constructor(customMapping?: Partial<VisualMapping>);
    private defaultValueToSize;
    private defaultSentienceToEmission;
    createScene(name: string): Scene3D;
    private createDefaultCamera;
    private createDefaultLighting;
    addStanceToScene(sceneId: string, stance: Stance, position?: Vector3): StanceNode3D | null;
    private stanceToNode;
    addTransition(sceneId: string, fromNodeId: string, toNodeId: string, duration?: number): TransitionAnimation | null;
    exportToGLTF(sceneId: string, options?: Partial<ExportOptions>): GLTFDocument | null;
    private buildGLTFDocument;
    exportToUSD(sceneId: string): string | null;
    getScene(sceneId: string): Scene3D | undefined;
    getAllScenes(): Scene3D[];
    deleteScene(sceneId: string): boolean;
    setMapping(mapping: Partial<VisualMapping>): void;
}
interface GLTFDocument {
    asset: {
        version: string;
        generator: string;
    };
    scene: number;
    scenes: {
        name: string;
        nodes: number[];
    }[];
    nodes: GLTFNode[];
    meshes: GLTFMesh[];
    materials: GLTFMaterial[];
    animations?: GLTFAnimation[];
    extensionsUsed?: string[];
    extras?: Record<string, unknown>;
}
interface GLTFNode {
    name: string;
    mesh?: number;
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    children?: number[];
}
interface GLTFMesh {
    name: string;
    primitives: {
        attributes: Record<string, number>;
        material?: number;
    }[];
}
interface GLTFMaterial {
    name: string;
    pbrMetallicRoughness: {
        baseColorFactor: number[];
        metallicFactor: number;
        roughnessFactor: number;
    };
    emissiveFactor: number[];
}
interface GLTFAnimation {
    name: string;
    channels: {
        sampler: number;
        target: {
            node: number;
            path: string;
        };
    }[];
    samplers: {
        input: number;
        output: number;
        interpolation: string;
    }[];
}
export declare function createStance3DExporter(mapping?: Partial<VisualMapping>): Stance3DExporter;
export {};
//# sourceMappingURL=export-3d.d.ts.map