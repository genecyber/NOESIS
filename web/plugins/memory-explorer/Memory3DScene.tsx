/**
 * Memory 3D Scene Component
 *
 * A React Three Fiber powered 3D visualization of memory nodes.
 * Renders memories as spheres with colors based on type and sizes based on importance.
 */

'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

interface MemoryNodeData {
  id: string;
  type: 'episodic' | 'semantic' | 'identity';
  content: string;
  importance: number;
  position: { x: number; y: number; z: number };
  embedding?: number[];
}

interface ConnectionData {
  from: string;
  to: string;
  strength: number;
}

// =============================================================================
// Pulse Effect Types
// =============================================================================

interface ActivePulse {
  edgeKey: string;
  fromId: string;
  toId: string;
  progress: number; // 0 to 1
  brightness: number; // based on connection strength
  speed: number; // units per second
  color: string;
  startTime: number;
}

interface PulseState {
  sourceNodeId: string;
  startTime: number;
  visitedNodes: Set<string>;
  activePulses: ActivePulse[];
  flashingNodes: Map<string, number>; // nodeId -> flash start time
}

interface Memory3DSceneProps {
  nodes: MemoryNodeData[];
  connections?: ConnectionData[];
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  showConnections?: boolean;
  autoRotate?: boolean;
}

// =============================================================================
// Color Constants (Emblem Theme)
// =============================================================================

const COLORS = {
  // Memory type colors
  episodic: '#1aff99',    // hsl(155 100% 55%) - emblem-accent (green/cyan)
  semantic: '#00c8ff',    // hsl(190 100% 50%) - emblem-secondary (cyan)
  identity: '#7c5cff',    // hsl(246 100% 68%) - emblem-primary (purple)
  // UI colors
  selected: '#ffffff',
  connection: '#4a5568',
  connectionActive: '#7c5cff',
  // Background
  background: '#050608',  // hsl(228 33% 3%) - emblem-bg
};

// =============================================================================
// Memory Node Component
// =============================================================================

interface MemoryNodeProps {
  node: MemoryNodeData;
  isSelected: boolean;
  isHovered: boolean;
  flashIntensity: number; // 0 to 1 for pulse flash effect
  onClick: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
}

function MemoryNode({ node, isSelected, isHovered, flashIntensity, onClick, onHover }: MemoryNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const flashGlowRef = useRef<THREE.Mesh>(null);

  // Get color based on memory type
  const color = COLORS[node.type];

  // Normalize importance (could be 0-100 or 0-1)
  const normalizedImportance = node.importance > 1 ? node.importance / 100 : node.importance;

  // Scale based on importance (0.1 to 0.4) - small nodes with some size variation
  const baseScale = 0.1 + normalizedImportance * 0.3;
  const scale = isHovered ? baseScale * 1.3 : baseScale;

  // Show flash glow when pulse arrives
  const showFlash = flashIntensity > 0;

  // Animate glow pulse
  useFrame((state) => {
    if (glowRef.current && (isSelected || isHovered)) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
      glowRef.current.scale.setScalar(scale * 1.5 * pulse);
    }
    // Animate flash glow
    if (flashGlowRef.current && showFlash) {
      flashGlowRef.current.scale.setScalar(scale * (2 + flashIntensity));
    }
  });

  // Handle click
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick(node.id);
    },
    [onClick, node.id]
  );

  // Handle pointer events
  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(node.id);
      document.body.style.cursor = 'pointer';
    },
    [onHover, node.id]
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Flash glow effect when pulse arrives */}
      {showFlash && (
        <mesh ref={flashGlowRef} scale={scale * (2 + flashIntensity)}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4 * flashIntensity}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Glow effect for selected/hovered nodes */}
      {(isSelected || isHovered) && (
        <mesh ref={glowRef} scale={scale * 1.5}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        scale={scale}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={showFlash ? 0.8 * flashIntensity : isSelected ? 0.5 : isHovered ? 0.3 : 0.1}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={scale * 1.3}>
          <ringGeometry args={[0.9, 1, 32]} />
          <meshBasicMaterial color={COLORS.selected} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Tooltip on hover */}
      {isHovered && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <Html
            center
            distanceFactor={15}
            style={{
              transform: 'translate3d(0, -40px, 0)',
              pointerEvents: 'none',
            }}
          >
            <div
              className="px-3 py-2 rounded-lg text-xs text-white max-w-48 text-center"
              style={{
                backgroundColor: 'rgba(5, 6, 8, 0.9)',
                border: `1px solid ${color}`,
                boxShadow: `0 0 10px ${color}40`,
              }}
            >
              <div
                className="font-medium mb-1 capitalize"
                style={{ color }}
              >
                {node.type}
              </div>
              <div className="text-gray-300 line-clamp-2">
                {node.content.length > 80
                  ? `${node.content.substring(0, 80)}...`
                  : node.content}
              </div>
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}

// =============================================================================
// Connection Lines Component
// =============================================================================

interface ConnectionLinesProps {
  connections: ConnectionData[];
  nodes: MemoryNodeData[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  glowingEdges: Map<string, number>; // edgeKey -> glow intensity (0-1)
}

function ConnectionLines({ connections, nodes, selectedNodeId, hoveredNodeId, glowingEdges }: ConnectionLinesProps) {
  // Create a map of node positions for quick lookup
  const nodePositions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    nodes.forEach((node) => {
      map.set(node.id, [node.position.x, node.position.y, node.position.z]);
    });
    return map;
  }, [nodes]);

  // Filter and prepare connection lines
  const lines = useMemo(() => {
    return connections
      .map((conn) => {
        const fromPos = nodePositions.get(conn.from);
        const toPos = nodePositions.get(conn.to);

        if (!fromPos || !toPos) return null;

        // Determine if this connection involves a selected or hovered node
        const isActive =
          selectedNodeId === conn.from ||
          selectedNodeId === conn.to ||
          hoveredNodeId === conn.from ||
          hoveredNodeId === conn.to;

        // Check for pulse glow
        const edgeKey = `${conn.from}-${conn.to}`;
        const reverseKey = `${conn.to}-${conn.from}`;
        const glowIntensity = glowingEdges.get(edgeKey) || glowingEdges.get(reverseKey) || 0;

        return {
          points: [fromPos, toPos] as [[number, number, number], [number, number, number]],
          strength: conn.strength,
          isActive,
          glowIntensity,
          edgeKey,
        };
      })
      .filter(Boolean) as Array<{
        points: [[number, number, number], [number, number, number]];
        strength: number;
        isActive: boolean;
        glowIntensity: number;
        edgeKey: string;
      }>;
  }, [connections, nodePositions, selectedNodeId, hoveredNodeId, glowingEdges]);

  return (
    <group>
      {lines.map((line, index) => {
        const isGlowing = line.glowIntensity > 0;
        return (
          <Line
            key={line.edgeKey}
            points={line.points}
            color={isGlowing ? '#ffffff' : line.isActive ? COLORS.connectionActive : COLORS.connection}
            lineWidth={isGlowing ? 2 + line.glowIntensity * 2 : line.isActive ? 2 : 1}
            transparent
            opacity={isGlowing ? 0.3 + line.glowIntensity * 0.7 : line.isActive ? 0.8 : 0.2 + line.strength * 0.3}
            dashed={!line.isActive && !isGlowing}
            dashScale={10}
            dashSize={0.5}
            gapSize={0.3}
          />
        );
      })}
    </group>
  );
}

// =============================================================================
// Grid Background Component
// =============================================================================

function GridBackground() {
  return (
    <group>
      {/* Horizontal grid plane */}
      <gridHelper
        args={[100, 50, COLORS.connection, COLORS.connection]}
        position={[0, -20, 0]}
      />
      {/* Vertical grid planes for depth perception */}
      <gridHelper
        args={[100, 50, COLORS.connection, COLORS.connection]}
        position={[0, 0, -50]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

// =============================================================================
// Pulse Orb Component - A glowing sphere that travels along edges
// =============================================================================

interface PulseOrbProps {
  position: [number, number, number];
  color: string;
  brightness: number;
  size?: number;
}

function PulseOrb({ position, color, brightness, size = 0.15 }: PulseOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulsing effect
      const pulse = Math.sin(state.clock.elapsedTime * 10) * 0.1 + 1;
      meshRef.current.scale.setScalar(size * pulse);
    }
  });

  return (
    <group position={position}>
      {/* Outer glow */}
      <mesh scale={size * 3}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2 * brightness}
          depthWrite={false}
        />
      </mesh>
      {/* Inner glow */}
      <mesh scale={size * 1.5}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4 * brightness}
          depthWrite={false}
        />
      </mesh>
      {/* Core */}
      <mesh ref={meshRef} scale={size}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={'#ffffff'}
          transparent
          opacity={0.9 * brightness}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// Pulse Effect Component - Manages and renders traveling pulses
// =============================================================================

interface PulseEffectProps {
  connections: ConnectionData[];
  nodes: MemoryNodeData[];
  pulseState: PulseState | null;
  onPulseUpdate: (newState: PulseState | null) => void;
  onEdgeGlow: (edgeKey: string, intensity: number) => void;
  onNodeFlash: (nodeId: string, intensity: number) => void;
}

function PulseEffect({
  connections,
  nodes,
  pulseState,
  onPulseUpdate,
  onEdgeGlow,
  onNodeFlash,
}: PulseEffectProps) {
  const { clock } = useThree();

  // Create position lookup maps
  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    nodes.forEach((node) => {
      map.set(node.id, new THREE.Vector3(node.position.x, node.position.y, node.position.z));
    });
    return map;
  }, [nodes]);

  // Create connection lookup for finding neighbors
  const connectionMap = useMemo(() => {
    const map = new Map<string, ConnectionData[]>();
    connections.forEach((conn) => {
      // Add to 'from' node's connections
      const fromConns = map.get(conn.from) || [];
      fromConns.push(conn);
      map.set(conn.from, fromConns);
      // Add to 'to' node's connections (bidirectional)
      const toConns = map.get(conn.to) || [];
      toConns.push(conn);
      map.set(conn.to, toConns);
    });
    return map;
  }, [connections]);

  // Get node color for pulse
  const nodeColors = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((node) => {
      map.set(node.id, COLORS[node.type]);
    });
    return map;
  }, [nodes]);

  // Animation loop
  useFrame(() => {
    if (!pulseState || pulseState.activePulses.length === 0) return;

    const currentTime = clock.elapsedTime;
    const newPulses: ActivePulse[] = [];
    const completedPulses: ActivePulse[] = [];
    const newVisitedNodes = new Set(pulseState.visitedNodes);
    const newFlashingNodes = new Map(pulseState.flashingNodes);

    // Process each active pulse
    pulseState.activePulses.forEach((pulse) => {
      const fromPos = nodePositions.get(pulse.fromId);
      const toPos = nodePositions.get(pulse.toId);

      if (!fromPos || !toPos) return;

      // Calculate distance and travel time
      const distance = fromPos.distanceTo(toPos);
      const travelTime = distance / pulse.speed;
      const elapsed = currentTime - pulse.startTime;
      const progress = Math.min(elapsed / travelTime, 1);

      // Update edge glow based on pulse position
      const glowIntensity = Math.max(0, 1 - Math.abs(progress - 0.5) * 2) * pulse.brightness;
      onEdgeGlow(pulse.edgeKey, glowIntensity);

      if (progress >= 1) {
        // Pulse reached destination
        completedPulses.push(pulse);

        // Flash the destination node
        const targetId = pulse.toId;
        newFlashingNodes.set(targetId, currentTime);
        onNodeFlash(targetId, pulse.brightness);

        // If not visited, spawn new pulses to neighbors
        if (!newVisitedNodes.has(targetId)) {
          newVisitedNodes.add(targetId);

          const neighborConnections = connectionMap.get(targetId) || [];
          neighborConnections.forEach((conn) => {
            const neighborId = conn.from === targetId ? conn.to : conn.from;

            if (!newVisitedNodes.has(neighborId)) {
              // Create new pulse to this neighbor
              const edgeKey = `${targetId}-${neighborId}`;
              const baseSpeed = 8; // base speed in units per second
              const strengthBonus = conn.strength * 6; // faster for stronger connections
              const speed = baseSpeed + strengthBonus;

              newPulses.push({
                edgeKey,
                fromId: targetId,
                toId: neighborId,
                progress: 0,
                brightness: conn.strength * 0.8, // Brightness based on connection strength
                speed,
                color: nodeColors.get(targetId) || '#ffffff',
                startTime: currentTime,
              });
            }
          });
        }
      } else {
        // Keep the pulse active with updated progress
        newPulses.push({ ...pulse, progress });
      }
    });

    // Fade out edge glows for completed pulses
    completedPulses.forEach((pulse) => {
      // Schedule glow fadeout (handled by the glow map cleanup)
    });

    // Fade out node flashes (0.5 second duration)
    const flashDuration = 0.5;
    newFlashingNodes.forEach((startTime, nodeId) => {
      const flashElapsed = currentTime - startTime;
      if (flashElapsed >= flashDuration) {
        newFlashingNodes.delete(nodeId);
        onNodeFlash(nodeId, 0);
      } else {
        const flashIntensity = 1 - flashElapsed / flashDuration;
        onNodeFlash(nodeId, flashIntensity);
      }
    });

    // Update state
    if (newPulses.length === 0 && newFlashingNodes.size === 0) {
      // Animation complete
      onPulseUpdate(null);
    } else {
      onPulseUpdate({
        ...pulseState,
        visitedNodes: newVisitedNodes,
        activePulses: newPulses,
        flashingNodes: newFlashingNodes,
      });
    }
  });

  // Render pulse orbs
  if (!pulseState) return null;

  return (
    <group>
      {pulseState.activePulses.map((pulse) => {
        const fromPos = nodePositions.get(pulse.fromId);
        const toPos = nodePositions.get(pulse.toId);

        if (!fromPos || !toPos) return null;

        // Interpolate position
        const position: [number, number, number] = [
          fromPos.x + (toPos.x - fromPos.x) * pulse.progress,
          fromPos.y + (toPos.y - fromPos.y) * pulse.progress,
          fromPos.z + (toPos.z - fromPos.z) * pulse.progress,
        ];

        return (
          <PulseOrb
            key={pulse.edgeKey}
            position={position}
            color={pulse.color}
            brightness={pulse.brightness}
          />
        );
      })}
    </group>
  );
}

// =============================================================================
// Scene Content Component (inside Canvas)
// =============================================================================

interface SceneContentProps {
  nodes: MemoryNodeData[];
  connections: ConnectionData[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  showConnections: boolean;
  autoRotate: boolean;
}

function SceneContent({
  nodes,
  connections,
  selectedNodeId,
  onNodeClick,
  onNodeHover,
  showConnections,
  autoRotate,
}: SceneContentProps) {
  const { clock } = useThree();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Pulse effect state
  const [pulseState, setPulseState] = useState<PulseState | null>(null);
  const [glowingEdges, setGlowingEdges] = useState<Map<string, number>>(new Map());
  const [flashingNodes, setFlashingNodes] = useState<Map<string, number>>(new Map());

  // Handle hover state
  const handleHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
      onNodeHover(nodeId);
    },
    [onNodeHover]
  );

  // Handle node click - triggers pulse effect
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // Call the parent's onNodeClick
      onNodeClick(nodeId);

      // Start pulse effect from this node
      const connectedEdges = connections.filter(
        (c) => c.from === nodeId || c.to === nodeId
      );

      if (connectedEdges.length === 0) return;

      // Get the node's color for the initial pulses
      const sourceNode = nodes.find((n) => n.id === nodeId);
      const sourceColor = sourceNode ? COLORS[sourceNode.type] : '#ffffff';

      // Create initial pulses to all connected nodes
      const initialPulses: ActivePulse[] = connectedEdges.map((conn) => {
        const isFromSource = conn.from === nodeId;
        const targetId = isFromSource ? conn.to : conn.from;
        const edgeKey = `${nodeId}-${targetId}`;
        const baseSpeed = 8;
        const strengthBonus = conn.strength * 6;
        const speed = baseSpeed + strengthBonus;

        return {
          edgeKey,
          fromId: nodeId,
          toId: targetId,
          progress: 0,
          brightness: conn.strength,
          speed,
          color: sourceColor,
          startTime: clock.elapsedTime,
        };
      });

      // Flash the source node
      setFlashingNodes(new Map([[nodeId, 1]]));

      setPulseState({
        sourceNodeId: nodeId,
        startTime: clock.elapsedTime,
        visitedNodes: new Set([nodeId]),
        activePulses: initialPulses,
        flashingNodes: new Map([[nodeId, clock.elapsedTime]]),
      });
    },
    [connections, nodes, onNodeClick, clock]
  );

  // Handle pulse state updates from PulseEffect
  const handlePulseUpdate = useCallback((newState: PulseState | null) => {
    setPulseState(newState);
    if (newState === null) {
      // Clear all glowing edges when pulse animation completes
      setGlowingEdges(new Map());
      setFlashingNodes(new Map());
    }
  }, []);

  // Handle edge glow updates
  const handleEdgeGlow = useCallback((edgeKey: string, intensity: number) => {
    setGlowingEdges((prev) => {
      const next = new Map(prev);
      if (intensity <= 0) {
        next.delete(edgeKey);
      } else {
        next.set(edgeKey, intensity);
      }
      return next;
    });
  }, []);

  // Handle node flash updates
  const handleNodeFlash = useCallback((nodeId: string, intensity: number) => {
    setFlashingNodes((prev) => {
      const next = new Map(prev);
      if (intensity <= 0) {
        next.delete(nodeId);
      } else {
        next.set(nodeId, intensity);
      }
      return next;
    });
  }, []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color={COLORS.identity} />
      <pointLight position={[10, -10, 10]} intensity={0.3} color={COLORS.episodic} />

      {/* Camera Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={5}
        maxDistance={100}
        dampingFactor={0.05}
        enableDamping={true}
      />

      {/* Starfield background */}
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Grid background for spatial reference */}
      <GridBackground />

      {/* Connection lines */}
      {showConnections && connections.length > 0 && (
        <ConnectionLines
          connections={connections}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          glowingEdges={glowingEdges}
        />
      )}

      {/* Pulse effect */}
      <PulseEffect
        connections={connections}
        nodes={nodes}
        pulseState={pulseState}
        onPulseUpdate={handlePulseUpdate}
        onEdgeGlow={handleEdgeGlow}
        onNodeFlash={handleNodeFlash}
      />

      {/* Memory nodes */}
      {nodes.map((node) => (
        <MemoryNode
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          isHovered={hoveredNodeId === node.id}
          flashIntensity={flashingNodes.get(node.id) || 0}
          onClick={handleNodeClick}
          onHover={handleHover}
        />
      ))}
    </>
  );
}

// =============================================================================
// Main Memory3DScene Component
// =============================================================================

export default function Memory3DScene({
  nodes,
  connections = [],
  selectedNodeId = null,
  onNodeClick = () => {},
  onNodeHover = () => {},
  showConnections = true,
  autoRotate = false,
}: Memory3DSceneProps) {
  // Handle empty state
  if (nodes.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: COLORS.background }}
      >
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-20">🧠</div>
          <p className="text-gray-500 text-sm">No memories to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ backgroundColor: COLORS.background }}>
      <Canvas
        camera={{
          position: [0, 20, 60],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[COLORS.background]} />
        <fog attach="fog" args={[COLORS.background, 50, 150]} />

        <SceneContent
          nodes={nodes}
          connections={connections}
          selectedNodeId={selectedNodeId}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          showConnections={showConnections}
          autoRotate={autoRotate}
        />
      </Canvas>
    </div>
  );
}

// =============================================================================
// Type Exports
// =============================================================================

export type { Memory3DSceneProps, MemoryNodeData, ConnectionData };
