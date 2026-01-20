/**
 * Memory 3D Scene Component
 *
 * A React Three Fiber powered 3D visualization of memory nodes.
 * Renders memories as spheres with colors based on type and sizes based on importance.
 */

'use client';

import { useRef, useState, useMemo, useCallback, useEffect, MutableRefObject } from 'react';
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
  timestamp?: number; // Unix timestamp for time-based proximity calculations
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
  isJump?: boolean; // true if this is a cross-space jump (not along an edge)
}

interface PulseState {
  sourceNodeId: string;
  startTime: number;
  visitedNodes: Set<string>;
  activePulses: ActivePulse[];
  flashingNodes: Map<string, number>; // nodeId -> flash start time
  lastDeadEndNodeId?: string; // Track the last node that hit a dead end (for jump origin)
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
// Flashed Memory Card Types
// =============================================================================

interface FlashedMemory {
  node: MemoryNodeData;
  flashedAt: number; // timestamp when the node was flashed
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
  // Jump pulse color (distinct from normal pulses)
  jumpPulse: '#00ffff',   // Bright cyan for cross-space jumps
  // Background
  background: '#050608',  // hsl(228 33% 3%) - emblem-bg
};

// =============================================================================
// Pulse Animation Constants
// =============================================================================

const PULSE_CONSTANTS = {
  maxTotalDuration: 30, // Maximum seconds for the entire animation
  maxVisitedNodes: 500, // Safety limit on nodes to visit
  jumpSpeed: 12, // Units per second for jump pulses (slightly slower to be visible)
  jumpBrightness: 0.9, // Brightness for jump pulses
};

// Maximum number of memory cards to display in the side panel
const MAX_VISIBLE_CARDS = 12;

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
  isJump?: boolean; // Different visual for jump pulses
}

function PulseOrb({ position, color, brightness, size = 0.15, isJump = false }: PulseOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulsing effect - faster for jumps
      const pulseSpeed = isJump ? 15 : 10;
      const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.15 + 1;
      meshRef.current.scale.setScalar(size * pulse);
    }
    // Animate ring rotation for jump pulses
    if (ringRef.current && isJump) {
      ringRef.current.rotation.z += 0.1;
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  // Jump pulses are slightly larger and have additional visual elements
  const effectiveSize = isJump ? size * 1.3 : size;

  return (
    <group position={position}>
      {/* Outer glow - larger and more vibrant for jumps */}
      <mesh scale={effectiveSize * (isJump ? 4 : 3)}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={(isJump ? 0.3 : 0.2) * brightness}
          depthWrite={false}
        />
      </mesh>
      {/* Inner glow */}
      <mesh scale={effectiveSize * 1.5}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={(isJump ? 0.5 : 0.4) * brightness}
          depthWrite={false}
        />
      </mesh>
      {/* Spinning ring for jump pulses - makes them visually distinct */}
      {isJump && (
        <mesh ref={ringRef} scale={effectiveSize * 2.5}>
          <ringGeometry args={[0.8, 1, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6 * brightness}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* Core */}
      <mesh ref={meshRef} scale={effectiveSize}>
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

/**
 * Calculate combined proximity score for finding the nearest unvisited node.
 * Combines spatial proximity (3D distance) and temporal proximity (timestamp difference).
 * Lower score = closer/more similar.
 */
function calculateProximityScore(
  fromNode: MemoryNodeData,
  toNode: MemoryNodeData,
  fromPos: THREE.Vector3,
  toPos: THREE.Vector3,
  maxSpatialDistance: number,
  maxTimeDelta: number
): number {
  // Spatial proximity (normalized 0-1, where 0 is closest)
  const spatialDistance = fromPos.distanceTo(toPos);
  const normalizedSpatial = maxSpatialDistance > 0 ? spatialDistance / maxSpatialDistance : 0;

  // Temporal proximity (normalized 0-1, where 0 is closest in time)
  let normalizedTemporal = 0.5; // Default if no timestamps
  if (fromNode.timestamp !== undefined && toNode.timestamp !== undefined) {
    const timeDelta = Math.abs(fromNode.timestamp - toNode.timestamp);
    normalizedTemporal = maxTimeDelta > 0 ? timeDelta / maxTimeDelta : 0;
  }

  // Combined score: 50% spatial, 50% temporal
  return normalizedSpatial * 0.5 + normalizedTemporal * 0.5;
}

/**
 * Find the nearest unvisited node from a given position.
 * Uses a combination of spatial distance and temporal proximity.
 */
function findNearestUnvisitedNode(
  fromNodeId: string,
  nodes: MemoryNodeData[],
  nodePositions: Map<string, THREE.Vector3>,
  visitedNodes: Set<string>
): MemoryNodeData | null {
  const fromNode = nodes.find(n => n.id === fromNodeId);
  const fromPos = nodePositions.get(fromNodeId);
  if (!fromNode || !fromPos) return null;

  // Get all unvisited nodes
  const unvisitedNodes = nodes.filter(n => !visitedNodes.has(n.id));
  if (unvisitedNodes.length === 0) return null;

  // Calculate max values for normalization
  let maxSpatialDistance = 0;
  let maxTimeDelta = 0;

  unvisitedNodes.forEach(node => {
    const pos = nodePositions.get(node.id);
    if (pos) {
      const dist = fromPos.distanceTo(pos);
      if (dist > maxSpatialDistance) maxSpatialDistance = dist;
    }
    if (fromNode.timestamp !== undefined && node.timestamp !== undefined) {
      const timeDelta = Math.abs(fromNode.timestamp - node.timestamp);
      if (timeDelta > maxTimeDelta) maxTimeDelta = timeDelta;
    }
  });

  // Find the node with the lowest proximity score
  let bestNode: MemoryNodeData | null = null;
  let bestScore = Infinity;

  unvisitedNodes.forEach(node => {
    const pos = nodePositions.get(node.id);
    if (!pos) return;

    const score = calculateProximityScore(
      fromNode,
      node,
      fromPos,
      pos,
      maxSpatialDistance,
      maxTimeDelta
    );

    if (score < bestScore) {
      bestScore = score;
      bestNode = node;
    }
  });

  return bestNode;
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
    if (!pulseState) return;

    const currentTime = clock.elapsedTime;
    const animationDuration = currentTime - pulseState.startTime;

    // Safety check: stop if animation has been running too long
    if (animationDuration > PULSE_CONSTANTS.maxTotalDuration) {
      onPulseUpdate(null);
      return;
    }

    // Safety check: stop if we've visited too many nodes
    if (pulseState.visitedNodes.size >= PULSE_CONSTANTS.maxVisitedNodes) {
      onPulseUpdate(null);
      return;
    }

    // Handle case where there are no active pulses but we're still flashing
    if (pulseState.activePulses.length === 0) {
      // Check if there are unvisited nodes - if so, we need to create a jump pulse
      const unvisitedCount = nodes.length - pulseState.visitedNodes.size;

      if (unvisitedCount > 0 && pulseState.lastDeadEndNodeId) {
        // Find the nearest unvisited node to create a jump
        const nearestUnvisited = findNearestUnvisitedNode(
          pulseState.lastDeadEndNodeId,
          nodes,
          nodePositions,
          pulseState.visitedNodes
        );

        if (nearestUnvisited) {
          // Create a jump pulse
          const edgeKey = `jump-${pulseState.lastDeadEndNodeId}-${nearestUnvisited.id}-${currentTime}`;
          const jumpPulse: ActivePulse = {
            edgeKey,
            fromId: pulseState.lastDeadEndNodeId,
            toId: nearestUnvisited.id,
            progress: 0,
            brightness: PULSE_CONSTANTS.jumpBrightness,
            speed: PULSE_CONSTANTS.jumpSpeed,
            color: COLORS.jumpPulse,
            startTime: currentTime,
            isJump: true,
          };

          onPulseUpdate({
            ...pulseState,
            activePulses: [jumpPulse],
            lastDeadEndNodeId: undefined,
          });
          return;
        }
      }

      // No jump needed or possible - continue processing flashing nodes
      const newFlashingNodes = new Map(pulseState.flashingNodes);
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

      if (newFlashingNodes.size === 0) {
        // Animation complete - all nodes visited or no more reachable
        onPulseUpdate(null);
      } else {
        onPulseUpdate({
          ...pulseState,
          flashingNodes: newFlashingNodes,
        });
      }
      return;
    }

    const newPulses: ActivePulse[] = [];
    const completedPulses: ActivePulse[] = [];
    const newVisitedNodes = new Set(pulseState.visitedNodes);
    const newFlashingNodes = new Map(pulseState.flashingNodes);
    let lastDeadEndNodeId = pulseState.lastDeadEndNodeId;

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

      // Update edge glow based on pulse position (only for non-jump pulses)
      if (!pulse.isJump) {
        const glowIntensity = Math.max(0, 1 - Math.abs(progress - 0.5) * 2) * pulse.brightness;
        onEdgeGlow(pulse.edgeKey, glowIntensity);
      }

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
          let hasUnvisitedNeighbor = false;

          neighborConnections.forEach((conn) => {
            const neighborId = conn.from === targetId ? conn.to : conn.from;

            if (!newVisitedNodes.has(neighborId)) {
              hasUnvisitedNeighbor = true;
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
                isJump: false,
              });
            }
          });

          // If no unvisited neighbors, this is a dead end - mark for potential jump
          if (!hasUnvisitedNeighbor) {
            lastDeadEndNodeId = targetId;
          }
        }
      } else {
        // Keep the pulse active with updated progress
        newPulses.push({ ...pulse, progress });
      }
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

    // Check if we need to create a jump pulse
    const unvisitedCount = nodes.length - newVisitedNodes.size;
    const noPulsesRemaining = newPulses.length === 0;
    const hasUnvisitedNodes = unvisitedCount > 0;

    if (noPulsesRemaining && hasUnvisitedNodes && lastDeadEndNodeId) {
      // Find the nearest unvisited node
      const nearestUnvisited = findNearestUnvisitedNode(
        lastDeadEndNodeId,
        nodes,
        nodePositions,
        newVisitedNodes
      );

      if (nearestUnvisited) {
        // Create a jump pulse to the nearest unvisited cluster
        const edgeKey = `jump-${lastDeadEndNodeId}-${nearestUnvisited.id}-${currentTime}`;
        const jumpPulse: ActivePulse = {
          edgeKey,
          fromId: lastDeadEndNodeId,
          toId: nearestUnvisited.id,
          progress: 0,
          brightness: PULSE_CONSTANTS.jumpBrightness,
          speed: PULSE_CONSTANTS.jumpSpeed,
          color: COLORS.jumpPulse,
          startTime: currentTime,
          isJump: true,
        };

        newPulses.push(jumpPulse);
        lastDeadEndNodeId = undefined; // Clear dead end since we're jumping
      }
    }

    // Update state
    if (newPulses.length === 0 && newFlashingNodes.size === 0) {
      // Animation complete - either all nodes visited or no more reachable
      onPulseUpdate(null);
    } else {
      onPulseUpdate({
        ...pulseState,
        visitedNodes: newVisitedNodes,
        activePulses: newPulses,
        flashingNodes: newFlashingNodes,
        lastDeadEndNodeId,
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
          <group key={pulse.edgeKey}>
            {/* Render a dashed trail line for jump pulses */}
            {pulse.isJump && (
              <Line
                points={[
                  [fromPos.x, fromPos.y, fromPos.z],
                  position,
                ]}
                color={pulse.color}
                lineWidth={2}
                transparent
                opacity={0.5 * pulse.brightness * (1 - pulse.progress * 0.5)}
                dashed
                dashScale={8}
                dashSize={0.8}
                gapSize={0.4}
              />
            )}
            <PulseOrb
              position={position}
              color={pulse.color}
              brightness={pulse.brightness}
              isJump={pulse.isJump}
            />
          </group>
        );
      })}
    </group>
  );
}

// =============================================================================
// Memory Cards Panel Component
// =============================================================================

interface MemoryCardsPanelProps {
  flashedMemories: FlashedMemory[];
  onCardClick?: (nodeId: string) => void;
}

function MemoryCardsPanel({ flashedMemories, onCardClick }: MemoryCardsPanelProps) {
  // Inject animation CSS on mount
  useEffect(() => {
    const styleId = 'memory-cards-panel-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes memoryCardSlideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Format timestamp to a readable date
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get color based on memory type
  const getTypeColor = (type: 'episodic' | 'semantic' | 'identity'): string => {
    return COLORS[type];
  };

  // Get type label with icon
  const getTypeLabel = (type: 'episodic' | 'semantic' | 'identity'): string => {
    switch (type) {
      case 'episodic':
        return 'Episodic';
      case 'semantic':
        return 'Semantic';
      case 'identity':
        return 'Identity';
      default:
        return type;
    }
  };

  if (flashedMemories.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute top-4 right-4 bottom-4 w-72 flex flex-col pointer-events-auto"
      style={{
        maxHeight: 'calc(100% - 32px)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 rounded-t-lg border-b"
        style={{
          backgroundColor: 'rgba(5, 6, 8, 0.85)',
          borderColor: 'rgba(124, 92, 255, 0.3)',
        }}
      >
        <h3 className="text-sm font-medium text-gray-200">
          Explored Memories
          <span className="ml-2 text-xs text-gray-500">
            ({flashedMemories.length})
          </span>
        </h3>
      </div>

      {/* Scrollable cards container */}
      <div
        className="flex-1 overflow-y-auto rounded-b-lg"
        style={{
          backgroundColor: 'rgba(5, 6, 8, 0.75)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="p-2 space-y-2">
          {flashedMemories.map((memory, index) => {
            const color = getTypeColor(memory.node.type);
            const isNew = index === 0;

            return (
              <div
                key={`${memory.node.id}-${memory.flashedAt}`}
                className="p-3 rounded-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{
                  backgroundColor: 'rgba(15, 17, 21, 0.9)',
                  border: `1px solid ${color}40`,
                  boxShadow: isNew ? `0 0 12px ${color}30` : 'none',
                  animation: isNew ? 'memoryCardSlideIn 0.3s ease-out' : undefined,
                }}
                onClick={() => onCardClick?.(memory.node.id)}
              >
                {/* Type badge */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {getTypeLabel(memory.node.type)}
                  </span>
                  {memory.node.importance > 0 && (
                    <span
                      className="text-xs text-gray-500"
                      title="Importance"
                    >
                      {Math.round(
                        memory.node.importance > 1
                          ? memory.node.importance
                          : memory.node.importance * 100
                      )}%
                    </span>
                  )}
                </div>

                {/* Content */}
                <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                  {memory.node.content}
                </p>

                {/* Timestamp */}
                {memory.node.timestamp && (
                  <p className="mt-2 text-xs text-gray-500">
                    {formatTimestamp(memory.node.timestamp)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
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
  onNodeFlashed?: (nodeId: string) => void; // Callback when a node is flashed by pulse
}

function SceneContent({
  nodes,
  connections,
  selectedNodeId,
  onNodeClick,
  onNodeHover,
  showConnections,
  autoRotate,
  onNodeFlashed,
}: SceneContentProps) {
  const { clock } = useThree();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Pulse effect state
  const [pulseState, setPulseState] = useState<PulseState | null>(null);
  const [glowingEdges, setGlowingEdges] = useState<Map<string, number>>(new Map());
  const [flashingNodes, setFlashingNodes] = useState<Map<string, number>>(new Map());

  // Track which nodes have been reported as flashed (to avoid duplicates)
  const reportedFlashes = useRef<Set<string>>(new Set());

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

      // Reset the reported flashes for this new pulse cycle
      reportedFlashes.current = new Set();

      // Get the node's color for the initial pulses
      const sourceNode = nodes.find((n) => n.id === nodeId);
      const sourceColor = sourceNode ? COLORS[sourceNode.type] : '#ffffff';

      // Start pulse effect from this node
      const connectedEdges = connections.filter(
        (c) => c.from === nodeId || c.to === nodeId
      );

      // Flash the source node
      setFlashingNodes(new Map([[nodeId, 1]]));

      // If node has no connections, still start animation but mark as dead end
      // This allows the jump logic to find and visit other disconnected clusters
      if (connectedEdges.length === 0) {
        // Only start if there are other nodes to visit
        if (nodes.length <= 1) return;

        setPulseState({
          sourceNodeId: nodeId,
          startTime: clock.elapsedTime,
          visitedNodes: new Set([nodeId]),
          activePulses: [], // No initial pulses since no connections
          flashingNodes: new Map([[nodeId, clock.elapsedTime]]),
          lastDeadEndNodeId: nodeId, // Mark as dead end so jump logic kicks in
        });
        return;
      }

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
          isJump: false,
        };
      });

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
        // Report node flash to parent (only once per pulse cycle)
        if (!reportedFlashes.current.has(nodeId) && onNodeFlashed) {
          reportedFlashes.current.add(nodeId);
          onNodeFlashed(nodeId);
        }
      }
      return next;
    });
  }, [onNodeFlashed]);

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
  // State for tracking flashed memories for the side panel
  const [flashedMemories, setFlashedMemories] = useState<FlashedMemory[]>([]);

  // Create a node lookup map for quick access
  const nodeMap = useMemo(() => {
    const map = new Map<string, MemoryNodeData>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Handle when a node is flashed by the pulse animation
  const handleNodeFlashed = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      setFlashedMemories((prev) => {
        // Check if this node is already in the list
        const existingIndex = prev.findIndex((m) => m.node.id === nodeId);
        if (existingIndex !== -1) {
          // Move to top if already exists
          const existing = prev[existingIndex];
          const newList = [
            { ...existing, flashedAt: Date.now() },
            ...prev.slice(0, existingIndex),
            ...prev.slice(existingIndex + 1),
          ];
          return newList.slice(0, MAX_VISIBLE_CARDS);
        }

        // Add new flashed memory at the top
        const newMemory: FlashedMemory = {
          node,
          flashedAt: Date.now(),
        };
        return [newMemory, ...prev].slice(0, MAX_VISIBLE_CARDS);
      });
    },
    [nodeMap]
  );

  // Handle card click - triggers onNodeClick for the selected memory
  const handleCardClick = useCallback(
    (nodeId: string) => {
      onNodeClick(nodeId);
    },
    [onNodeClick]
  );

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
    <div className="w-full h-full relative" style={{ backgroundColor: COLORS.background }}>
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
          onNodeFlashed={handleNodeFlashed}
        />
      </Canvas>

      {/* Memory cards panel overlay */}
      <MemoryCardsPanel
        flashedMemories={flashedMemories}
        onCardClick={handleCardClick}
      />
    </div>
  );
}

// =============================================================================
// Type Exports
// =============================================================================

export type { Memory3DSceneProps, MemoryNodeData, ConnectionData, FlashedMemory };
