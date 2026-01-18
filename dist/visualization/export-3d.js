/**
 * 3D Stance Visualization Export
 *
 * Export stance configurations to 3D formats (GLTF, USD)
 * with animated transitions and WebXR compatibility.
 */
// Default visual mappings
const DEFAULT_FRAME_COLORS = {
    existential: { r: 0.4, g: 0.2, b: 0.6, a: 1 },
    pragmatic: { r: 0.2, g: 0.6, b: 0.3, a: 1 },
    poetic: { r: 0.8, g: 0.4, b: 0.7, a: 1 },
    adversarial: { r: 0.8, g: 0.2, b: 0.2, a: 1 },
    playful: { r: 1.0, g: 0.8, b: 0.2, a: 1 },
    mythic: { r: 0.6, g: 0.5, b: 0.1, a: 1 },
    systems: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
    psychoanalytic: { r: 0.5, g: 0.3, b: 0.5, a: 1 },
    stoic: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    absurdist: { r: 0.9, g: 0.5, b: 0.1, a: 1 }
};
const DEFAULT_OBJECTIVE_SHAPES = {
    helpfulness: 'sphere',
    novelty: 'torus',
    provocation: 'cube',
    synthesis: 'sphere',
    'self-actualization': 'torus'
};
export class Stance3DExporter {
    mapping;
    scenes = new Map();
    constructor(customMapping) {
        this.mapping = {
            frameToColor: customMapping?.frameToColor || DEFAULT_FRAME_COLORS,
            valueToSize: customMapping?.valueToSize || this.defaultValueToSize,
            sentienceToEmission: customMapping?.sentienceToEmission || this.defaultSentienceToEmission,
            objectiveToShape: customMapping?.objectiveToShape || DEFAULT_OBJECTIVE_SHAPES
        };
    }
    defaultValueToSize(values) {
        const sum = values.curiosity + values.certainty + values.risk +
            values.novelty + values.empathy + values.provocation + values.synthesis;
        return 0.5 + (sum / 700) * 1.5; // Scale between 0.5 and 2.0
    }
    defaultSentienceToEmission(sentience) {
        return (sentience.awarenessLevel + sentience.autonomyLevel) / 200;
    }
    createScene(name) {
        const scene = {
            id: `scene-${Date.now()}`,
            name,
            stances: [],
            transitions: [],
            camera: this.createDefaultCamera(),
            lighting: this.createDefaultLighting(),
            metadata: {
                version: '1.0.0',
                generator: 'METAMORPH Stance3DExporter',
                createdAt: new Date(),
                frameCount: 0,
                duration: 0
            }
        };
        this.scenes.set(scene.id, scene);
        return scene;
    }
    createDefaultCamera() {
        return {
            position: { x: 0, y: 5, z: 10 },
            target: { x: 0, y: 0, z: 0 },
            fov: 60,
            near: 0.1,
            far: 1000,
            type: 'perspective'
        };
    }
    createDefaultLighting() {
        return {
            ambient: {
                color: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
                intensity: 0.5
            },
            directional: [
                {
                    color: { r: 1, g: 1, b: 1, a: 1 },
                    intensity: 0.8,
                    direction: { x: -1, y: -1, z: -1 }
                }
            ],
            point: []
        };
    }
    addStanceToScene(sceneId, stance, position) {
        const scene = this.scenes.get(sceneId);
        if (!scene)
            return null;
        const node = this.stanceToNode(stance, position);
        scene.stances.push(node);
        scene.metadata.frameCount++;
        return node;
    }
    stanceToNode(stance, position) {
        const color = this.mapping.frameToColor[stance.frame] || DEFAULT_FRAME_COLORS.pragmatic;
        const size = this.mapping.valueToSize(stance.values);
        const emission = this.mapping.sentienceToEmission(stance.sentience);
        const shape = this.mapping.objectiveToShape[stance.objective] || 'sphere';
        return {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            stance,
            position: position || { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: size, y: size, z: size },
            mesh: {
                type: shape,
                geometry: shape === 'sphere' ? { radius: 1, segments: 32 } :
                    shape === 'torus' ? { radius: 1, segments: 32 } :
                        { width: 1, height: 1, depth: 1 },
                lod: [
                    { distance: 0, segments: 32 },
                    { distance: 10, segments: 16 },
                    { distance: 20, segments: 8 }
                ]
            },
            materials: [
                {
                    type: emission > 0.5 ? 'emissive' : 'standard',
                    color,
                    metalness: 0.3,
                    roughness: 0.7,
                    emissiveIntensity: emission
                }
            ],
            children: []
        };
    }
    addTransition(sceneId, fromNodeId, toNodeId, duration = 1.0) {
        const scene = this.scenes.get(sceneId);
        if (!scene)
            return null;
        const fromNode = scene.stances.find(n => n.id === fromNodeId);
        const toNode = scene.stances.find(n => n.id === toNodeId);
        if (!fromNode || !toNode)
            return null;
        const animation = {
            id: `anim-${Date.now()}`,
            fromNodeId,
            toNodeId,
            duration,
            easing: 'easeInOut',
            keyframes: [
                {
                    time: 0,
                    position: fromNode.position,
                    scale: fromNode.scale,
                    color: fromNode.materials[0]?.color
                },
                {
                    time: 1,
                    position: toNode.position,
                    scale: toNode.scale,
                    color: toNode.materials[0]?.color
                }
            ]
        };
        scene.transitions.push(animation);
        scene.metadata.duration += duration;
        return animation;
    }
    exportToGLTF(sceneId, options = {}) {
        const scene = this.scenes.get(sceneId);
        if (!scene)
            return null;
        const opts = {
            format: 'gltf',
            embedTextures: true,
            includeAnimations: true,
            optimizeMeshes: true,
            lodLevels: 3,
            webxrCompatible: true,
            ...options
        };
        return this.buildGLTFDocument(scene, opts);
    }
    buildGLTFDocument(scene, _options) {
        const nodes = scene.stances.map((stance, index) => ({
            name: `stance_${index}`,
            mesh: index,
            translation: [stance.position.x, stance.position.y, stance.position.z],
            rotation: [stance.rotation.x, stance.rotation.y, stance.rotation.z, stance.rotation.w],
            scale: [stance.scale.x, stance.scale.y, stance.scale.z]
        }));
        const meshes = scene.stances.map((_stance, index) => ({
            name: `mesh_${index}`,
            primitives: [{
                    attributes: {
                        POSITION: index * 3,
                        NORMAL: index * 3 + 1,
                        TEXCOORD_0: index * 3 + 2
                    },
                    material: index
                }]
        }));
        const materials = scene.stances.map((stance, index) => {
            const mat = stance.materials[0];
            return {
                name: `material_${index}`,
                pbrMetallicRoughness: {
                    baseColorFactor: [mat.color.r, mat.color.g, mat.color.b, mat.color.a],
                    metallicFactor: mat.metalness || 0,
                    roughnessFactor: mat.roughness || 1
                },
                emissiveFactor: mat.type === 'emissive' ?
                    [mat.color.r * (mat.emissiveIntensity || 1),
                        mat.color.g * (mat.emissiveIntensity || 1),
                        mat.color.b * (mat.emissiveIntensity || 1)] : [0, 0, 0]
            };
        });
        const animations = scene.transitions.map((trans, index) => ({
            name: `animation_${index}`,
            channels: [{
                    sampler: 0,
                    target: {
                        node: scene.stances.findIndex(s => s.id === trans.fromNodeId),
                        path: 'translation'
                    }
                }],
            samplers: [{
                    input: index,
                    output: index + 1,
                    interpolation: 'LINEAR'
                }]
        }));
        return {
            asset: {
                version: '2.0',
                generator: scene.metadata.generator
            },
            scene: 0,
            scenes: [{
                    name: scene.name,
                    nodes: nodes.map((_, i) => i)
                }],
            nodes,
            meshes,
            materials,
            animations: animations.length > 0 ? animations : undefined,
            extensionsUsed: ['KHR_materials_emissive_strength'],
            extras: {
                metamorph: {
                    version: scene.metadata.version,
                    stanceCount: scene.stances.length,
                    transitionCount: scene.transitions.length
                }
            }
        };
    }
    exportToUSD(sceneId) {
        const scene = this.scenes.get(sceneId);
        if (!scene)
            return null;
        let usd = `#usda 1.0
(
    defaultPrim = "Scene"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Scene"
{
`;
        for (let i = 0; i < scene.stances.length; i++) {
            const stance = scene.stances[i];
            const color = stance.materials[0]?.color || { r: 1, g: 1, b: 1 };
            usd += `    def Sphere "Stance_${i}"
    {
        double3 xformOp:translate = (${stance.position.x}, ${stance.position.y}, ${stance.position.z})
        double3 xformOp:scale = (${stance.scale.x}, ${stance.scale.y}, ${stance.scale.z})
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]

        color3f[] primvars:displayColor = [(${color.r}, ${color.g}, ${color.b})]
    }

`;
        }
        usd += `}`;
        return usd;
    }
    getScene(sceneId) {
        return this.scenes.get(sceneId);
    }
    getAllScenes() {
        return Array.from(this.scenes.values());
    }
    deleteScene(sceneId) {
        return this.scenes.delete(sceneId);
    }
    setMapping(mapping) {
        this.mapping = { ...this.mapping, ...mapping };
    }
}
export function createStance3DExporter(mapping) {
    return new Stance3DExporter(mapping);
}
//# sourceMappingURL=export-3d.js.map