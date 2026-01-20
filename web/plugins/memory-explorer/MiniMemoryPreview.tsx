/**
 * Mini Memory Preview Component
 *
 * A lightweight, embedded 3D preview of the memory graph for the sidebar panel.
 * Shows a simplified version of the full Memory3DScene with auto-rotation.
 * Supports zoom via mouse wheel and optional drag-to-rotate.
 * Can display pulse animations when injected memories are triggered.
 */

'use client';

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { MemoryNodeData, ConnectionData } from './Memory3DScene';

// =============================================================================
// Event System for Injected Memories
// =============================================================================

// Custom event type for injected memories
export interface InjectedMemoryEvent {
  memoryIds: string[];
  memoryContents: string[];
}

// Event name constant
export const INJECTED_MEMORIES_EVENT = 'noesis:injected-memories';

// Helper function to dispatch injected memories event
export function dispatchInjectedMemoriesEvent(memories: Array<{ type: string; content: string }>) {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent<InjectedMemoryEvent>(INJECTED_MEMORIES_EVENT, {
    detail: {
      memoryIds: memories.map((m, i) => `injected-${i}-${Date.now()}`),
      memoryContents: memories.map(m => m.content),
    },
  });
  window.dispatchEvent(event);
}

// =============================================================================
// Color Constants (Emblem Theme)
// =============================================================================

const COLORS = {
  episodic: '#1aff99',    // emblem-accent (green/cyan)
  semantic: '#00c8ff',    // emblem-secondary (cyan)
  identity: '#7c5cff',    // emblem-primary (purple)
  connection: '#4a5568',
  background: '#050608',  // emblem-bg
};

// =============================================================================
// Pulse Animation Types for Mini Preview
// =============================================================================

interface MiniPulseState {
  sourceNodeIds: string[];
  startTime: number;
  visitedNodes: Set<string>;
  flashingNodes: Map<string, number>; // nodeId -> flash start time
  nodeWaveNumbers: Map<string, number>; // nodeId -> wave number (0 = source, 1 = direct connections, etc.)
}

// Decay constants for pulse intensity
const PULSE_DECAY = {
  BASE_INTENSITY: 1.0,
  DECAY_FACTOR: 0.7, // Each wave is 70% of the previous
  MIN_INTENSITY: 0.15, // Minimum visible intensity
  BASE_FLASH_DURATION: 800, // ms for source nodes
  MIN_FLASH_DURATION: 400, // ms for distant nodes
};

// Calculate intensity based on wave number
function calculateWaveIntensity(waveNumber: number): number {
  // intensity = max(0.15, 1.0 * 0.7^waveNumber)
  const intensity = PULSE_DECAY.BASE_INTENSITY * Math.pow(PULSE_DECAY.DECAY_FACTOR, waveNumber);
  return Math.max(PULSE_DECAY.MIN_INTENSITY, intensity);
}

// Calculate flash duration based on wave number (shorter for distant nodes)
function calculateFlashDuration(waveNumber: number): number {
  // Linearly interpolate between base and min duration
  const decayRatio = Math.min(waveNumber / 5, 1); // Cap at wave 5
  return PULSE_DECAY.BASE_FLASH_DURATION - decayRatio * (PULSE_DECAY.BASE_FLASH_DURATION - PULSE_DECAY.MIN_FLASH_DURATION);
}

// =============================================================================
// Mini Memory Node Component - Simplified version without tooltips/interactions
// =============================================================================

interface MiniNodeProps {
  node: MemoryNodeData;
  flashIntensity?: number; // 0 to 1 for pulse flash effect
}

function MiniNode({ node, flashIntensity = 0 }: MiniNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = COLORS[node.type];

  // Normalize importance and calculate scale (smaller for mini view)
  const normalizedImportance = node.importance > 1 ? node.importance / 100 : node.importance;
  const scale = 0.08 + normalizedImportance * 0.2;

  const showFlash = flashIntensity > 0;

  // Subtle pulsing animation + flash effect
  useFrame((state) => {
    if (meshRef.current) {
      const basePulse = Math.sin(state.clock.elapsedTime * 2 + node.position.x) * 0.05 + 1;
      const flashBoost = showFlash ? 1 + flashIntensity * 0.5 : 1;
      meshRef.current.scale.setScalar(scale * basePulse * flashBoost);
    }
    if (glowRef.current && showFlash) {
      glowRef.current.scale.setScalar(scale * (2 + flashIntensity * 2));
    }
  });

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Flash glow effect when pulse arrives */}
      {showFlash && (
        <mesh ref={glowRef} scale={scale * (2 + flashIntensity * 2)}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5 * flashIntensity}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh
        ref={meshRef}
        scale={scale}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={showFlash ? 0.6 * flashIntensity : 0.15}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// Mini Connection Lines - Simplified version
// =============================================================================

interface MiniConnectionsProps {
  connections: ConnectionData[];
  nodes: MemoryNodeData[];
}

function MiniConnections({ connections, nodes }: MiniConnectionsProps) {
  const nodePositions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    nodes.forEach((node) => {
      map.set(node.id, [node.position.x, node.position.y, node.position.z]);
    });
    return map;
  }, [nodes]);

  const lines = useMemo(() => {
    return connections
      .map((conn) => {
        const fromPos = nodePositions.get(conn.from);
        const toPos = nodePositions.get(conn.to);
        if (!fromPos || !toPos) return null;
        return {
          points: [fromPos, toPos] as [[number, number, number], [number, number, number]],
          strength: conn.strength,
        };
      })
      .filter(Boolean) as Array<{
        points: [[number, number, number], [number, number, number]];
        strength: number;
      }>;
  }, [connections, nodePositions]);

  return (
    <group>
      {lines.map((line, index) => (
        <Line
          key={index}
          points={line.points}
          color={COLORS.connection}
          lineWidth={0.5}
          transparent
          opacity={0.15 + line.strength * 0.2}
        />
      ))}
    </group>
  );
}

// =============================================================================
// Mini Scene Content
// =============================================================================

interface MiniSceneContentProps {
  nodes: MemoryNodeData[];
  connections: ConnectionData[];
  showConnections: boolean;
  flashingNodes: Map<string, number>; // nodeId -> flash intensity
  cameraDistance: number;
}

function MiniSceneContent({ nodes, connections, showConnections, flashingNodes, cameraDistance }: MiniSceneContentProps) {
  return (
    <>
      {/* Simplified lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color={COLORS.identity} />

      {/* Camera Controls - zoom enabled, rotate on drag, auto-rotate when idle */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.8}
        minDistance={cameraDistance * 0.3}
        maxDistance={cameraDistance * 2}
        dampingFactor={0.1}
        enableDamping={true}
        zoomSpeed={0.8}
        rotateSpeed={0.5}
      />

      {/* Minimal starfield */}
      <Stars
        radius={80}
        depth={30}
        count={500}
        factor={3}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* Connection lines */}
      {showConnections && connections.length > 0 && (
        <MiniConnections connections={connections} nodes={nodes} />
      )}

      {/* Memory nodes */}
      {nodes.map((node) => (
        <MiniNode
          key={node.id}
          node={node}
          flashIntensity={flashingNodes.get(node.id) || 0}
        />
      ))}
    </>
  );
}

// =============================================================================
// Pulse Animation Hook for Mini Preview
// =============================================================================

function useMiniPulseAnimation(
  nodes: MemoryNodeData[],
  connections: ConnectionData[]
) {
  const [flashingNodes, setFlashingNodes] = useState<Map<string, number>>(new Map());
  const [pulseState, setPulseState] = useState<MiniPulseState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Store the last activation for replay functionality
  const [lastActivation, setLastActivation] = useState<string[] | null>(null);

  // Create connection lookup for finding neighbors
  const connectionMap = useMemo(() => {
    const map = new Map<string, ConnectionData[]>();
    connections.forEach((conn) => {
      const fromConns = map.get(conn.from) || [];
      fromConns.push(conn);
      map.set(conn.from, fromConns);
      const toConns = map.get(conn.to) || [];
      toConns.push(conn);
      map.set(conn.to, toConns);
    });
    return map;
  }, [connections]);

  // Find matching nodes by content similarity (for injected memories)
  const findMatchingNodes = useCallback((contents: string[]): string[] => {
    const matchedIds: string[] = [];

    contents.forEach(content => {
      const contentLower = content.toLowerCase();
      // Find nodes whose content overlaps significantly with the injected memory
      nodes.forEach(node => {
        const nodeLower = node.content.toLowerCase();
        // Check if there's significant overlap (at least 30% of words match)
        const contentWords = new Set(contentLower.split(/\s+/).filter(w => w.length > 3));
        const nodeWords = nodeLower.split(/\s+/).filter(w => w.length > 3);
        let matchCount = 0;
        nodeWords.forEach(word => {
          if (contentWords.has(word)) matchCount++;
        });
        const matchRatio = contentWords.size > 0 ? matchCount / contentWords.size : 0;

        if (matchRatio >= 0.3 || nodeLower.includes(contentLower.slice(0, 50)) || contentLower.includes(nodeLower.slice(0, 50))) {
          if (!matchedIds.includes(node.id)) {
            matchedIds.push(node.id);
          }
        }
      });
    });

    return matchedIds;
  }, [nodes]);

  // Start pulse animation from specific nodes
  const startPulseFromNodes = useCallback((sourceNodeIds: string[]) => {
    if (sourceNodeIds.length === 0 || nodes.length === 0) return;

    // Filter to only valid node IDs
    const validIds = sourceNodeIds.filter(id => nodes.some(n => n.id === id));
    if (validIds.length === 0) return;

    // Initialize flash for source nodes
    const initialFlashing = new Map<string, number>();
    const initialWaveNumbers = new Map<string, number>();
    validIds.forEach(id => {
      initialFlashing.set(id, Date.now());
      initialWaveNumbers.set(id, 0); // Source nodes are wave 0
    });

    setPulseState({
      sourceNodeIds: validIds,
      startTime: Date.now(),
      visitedNodes: new Set(validIds),
      flashingNodes: initialFlashing,
      nodeWaveNumbers: initialWaveNumbers,
    });

    // Start immediate flash for source nodes at full intensity (wave 0)
    const sourceIntensity = calculateWaveIntensity(0);
    setFlashingNodes(new Map(validIds.map(id => [id, sourceIntensity])));
  }, [nodes]);

  // Animation loop
  useEffect(() => {
    if (!pulseState) return;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - pulseState.startTime;

      // Safety: stop after 10 seconds
      if (elapsed > 10000) {
        setPulseState(null);
        setFlashingNodes(new Map());
        return;
      }

      // Update flashing intensities with wave-based decay
      const newFlashing = new Map<string, number>();

      pulseState.flashingNodes.forEach((startTime, nodeId) => {
        const flashElapsed = now - startTime;
        const waveNumber = pulseState.nodeWaveNumbers.get(nodeId) || 0;

        // Calculate duration based on wave number (shorter for distant nodes)
        const flashDuration = calculateFlashDuration(waveNumber);

        if (flashElapsed < flashDuration) {
          // Calculate max intensity based on wave number (decays with distance)
          const maxIntensity = calculateWaveIntensity(waveNumber);
          // Fade from max intensity to 0 over the flash duration
          const fadeProgress = flashElapsed / flashDuration;
          const intensity = maxIntensity * (1 - fadeProgress);
          newFlashing.set(nodeId, intensity);
        }
      });

      // Propagate to neighbors after initial flash (cascade effect)
      const waveDelay = 300; // ms between waves
      const currentWave = Math.floor(elapsed / waveDelay);

      if (currentWave > 0) {
        const newVisited = new Set(pulseState.visitedNodes);
        const newNodeFlashes = new Map(pulseState.flashingNodes);
        const newWaveNumbers = new Map(pulseState.nodeWaveNumbers);

        // Find nodes at current wave distance from sources
        pulseState.visitedNodes.forEach(visitedId => {
          const visitedWaveNumber = pulseState.nodeWaveNumbers.get(visitedId) || 0;
          const nodeConnections = connectionMap.get(visitedId) || [];

          nodeConnections.forEach(conn => {
            const neighborId = conn.from === visitedId ? conn.to : conn.from;
            if (!newVisited.has(neighborId)) {
              // Stagger the flash start based on connection strength
              const delay = (1 - conn.strength) * waveDelay * 0.5;
              if (!newNodeFlashes.has(neighborId)) {
                const neighborWaveNumber = visitedWaveNumber + 1;
                newNodeFlashes.set(neighborId, now + delay);
                newVisited.add(neighborId);
                newWaveNumbers.set(neighborId, neighborWaveNumber);

                // Set initial flash intensity based on wave number
                const neighborIntensity = calculateWaveIntensity(neighborWaveNumber);
                newFlashing.set(neighborId, neighborIntensity);
              }
            }
          });
        });

        setPulseState({
          ...pulseState,
          visitedNodes: newVisited,
          flashingNodes: newNodeFlashes,
          nodeWaveNumbers: newWaveNumbers,
        });
      }

      setFlashingNodes(newFlashing);

      // Continue animation if there are still flashing nodes or unvisited connected nodes
      if (newFlashing.size > 0 || pulseState.visitedNodes.size < nodes.length) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setPulseState(null);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pulseState, connectionMap, nodes.length]);

  // Listen for injected memory events
  useEffect(() => {
    const handleInjectedMemories = (event: Event) => {
      const customEvent = event as CustomEvent<InjectedMemoryEvent>;
      const { memoryContents } = customEvent.detail;

      // Find matching nodes and start pulse
      const matchedNodeIds = findMatchingNodes(memoryContents);
      if (matchedNodeIds.length > 0) {
        setLastActivation(matchedNodeIds);
        startPulseFromNodes(matchedNodeIds);
      } else if (nodes.length > 0) {
        // If no matches, pulse from random nodes based on memory types
        const randomIds = nodes
          .slice(0, Math.min(3, nodes.length))
          .map(n => n.id);
        setLastActivation(randomIds);
        startPulseFromNodes(randomIds);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(INJECTED_MEMORIES_EVENT, handleInjectedMemories);
      return () => {
        window.removeEventListener(INJECTED_MEMORIES_EVENT, handleInjectedMemories);
      };
    }
  }, [findMatchingNodes, startPulseFromNodes, nodes]);

  // Replay function to re-trigger the last activation
  const replayLastActivation = useCallback(() => {
    if (lastActivation && lastActivation.length > 0) {
      startPulseFromNodes(lastActivation);
    }
  }, [lastActivation, startPulseFromNodes]);

  return { flashingNodes, startPulseFromNodes, lastActivation, replayLastActivation };
}

// =============================================================================
// Main MiniMemoryPreview Component
// =============================================================================

interface MiniMemoryPreviewProps {
  nodes: MemoryNodeData[];
  connections: ConnectionData[];
  showConnections?: boolean;
  onClick?: () => void;
  height?: number;
}

export default function MiniMemoryPreview({
  nodes,
  connections,
  showConnections = true,
  onClick,
  height = 200,
}: MiniMemoryPreviewProps) {
  // Pulse animation hook
  const { flashingNodes, lastActivation, replayLastActivation } = useMiniPulseAnimation(nodes, connections);

  // Hover state for showing the replay button
  const [isHovered, setIsHovered] = useState(false);

  // Handle click on the canvas container
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  // Handle replay button click (stop propagation to prevent triggering onClick)
  const handleReplayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    replayLastActivation();
  }, [replayLastActivation]);

  // Calculate bounding box to adjust camera
  const cameraDistance = useMemo(() => {
    if (nodes.length === 0) return 50;

    let maxDist = 0;
    nodes.forEach((node) => {
      const dist = Math.sqrt(
        node.position.x ** 2 +
        node.position.y ** 2 +
        node.position.z ** 2
      );
      if (dist > maxDist) maxDist = dist;
    });

    // Add padding and ensure minimum distance
    return Math.max(maxDist * 2.5, 40);
  }, [nodes]);

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-lg border border-white/5 bg-emblem-surface-2"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <div className="text-2xl opacity-30 mb-1">&#129504;</div>
          <p className="text-emblem-muted text-xs">No memories yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-lg border border-white/10 overflow-hidden cursor-pointer transition-all hover:border-emblem-primary/30 hover:shadow-lg hover:shadow-emblem-primary/5 relative"
      style={{
        height: `${height}px`,
        backgroundColor: COLORS.background,
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Click to launch Memory Explorer (scroll to zoom, drag to rotate)"
    >
      {/* Replay button - only shows when there's a previous activation and on hover */}
      {lastActivation && lastActivation.length > 0 && (
        <button
          onClick={handleReplayClick}
          className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-md border transition-all duration-200 ${
            isHovered
              ? 'opacity-80 hover:opacity-100 hover:bg-white/10'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{
            backgroundColor: 'rgba(5, 6, 8, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
          }}
          title="Replay last activation"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/70"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}
      <Canvas
        camera={{
          position: [0, cameraDistance * 0.4, cameraDistance],
          fov: 45,
          near: 0.1,
          far: 500,
        }}
        gl={{
          antialias: false, // Disable for performance
          alpha: false,
          powerPreference: 'low-power', // Prefer battery life
        }}
        dpr={1} // Lower resolution for performance
        frameloop="always" // Keep animating for auto-rotate
      >
        <color attach="background" args={[COLORS.background]} />
        <fog attach="fog" args={[COLORS.background, cameraDistance * 0.8, cameraDistance * 2]} />

        <MiniSceneContent
          nodes={nodes}
          connections={connections}
          showConnections={showConnections}
          flashingNodes={flashingNodes}
          cameraDistance={cameraDistance}
        />
      </Canvas>
    </div>
  );
}

export type { MiniMemoryPreviewProps };
