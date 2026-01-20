/**
 * Memory 3D Scene Component
 *
 * A React Three Fiber powered 3D visualization of memory nodes.
 * Renders memories as spheres with colors based on type and sizes based on importance.
 */

'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
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
  onClick: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
}

function MemoryNode({ node, isSelected, isHovered, onClick, onHover }: MemoryNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Get color based on memory type
  const color = COLORS[node.type];

  // Normalize importance (could be 0-100 or 0-1)
  const normalizedImportance = node.importance > 1 ? node.importance / 100 : node.importance;

  // Scale based on importance (0.1 to 0.4) - small nodes with some size variation
  const baseScale = 0.1 + normalizedImportance * 0.3;
  const scale = isHovered ? baseScale * 1.3 : baseScale;

  // Animate glow pulse
  useFrame((state) => {
    if (glowRef.current && (isSelected || isHovered)) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 1;
      glowRef.current.scale.setScalar(scale * 1.5 * pulse);
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
          emissiveIntensity={isSelected ? 0.5 : isHovered ? 0.3 : 0.1}
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
}

function ConnectionLines({ connections, nodes, selectedNodeId, hoveredNodeId }: ConnectionLinesProps) {
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

        return {
          points: [fromPos, toPos] as [[number, number, number], [number, number, number]],
          strength: conn.strength,
          isActive,
        };
      })
      .filter(Boolean) as Array<{
        points: [[number, number, number], [number, number, number]];
        strength: number;
        isActive: boolean;
      }>;
  }, [connections, nodePositions, selectedNodeId, hoveredNodeId]);

  return (
    <group>
      {lines.map((line, index) => (
        <Line
          key={index}
          points={line.points}
          color={line.isActive ? COLORS.connectionActive : COLORS.connection}
          lineWidth={line.isActive ? 2 : 1}
          transparent
          opacity={line.isActive ? 0.8 : 0.2 + line.strength * 0.3}
          dashed={!line.isActive}
          dashScale={10}
          dashSize={0.5}
          gapSize={0.3}
        />
      ))}
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Handle hover state
  const handleHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
      onNodeHover(nodeId);
    },
    [onNodeHover]
  );

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
        />
      )}

      {/* Memory nodes */}
      {nodes.map((node) => (
        <MemoryNode
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          isHovered={hoveredNodeId === node.id}
          onClick={onNodeClick}
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
