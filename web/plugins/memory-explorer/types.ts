/**
 * METAMORPH Memory Explorer Plugin - Type Definitions
 *
 * Types for 3D memory visualization and exploration.
 */

import type { Memory } from '@/lib/plugins/types';

// =============================================================================
// Visualization Modes
// =============================================================================

/** Visualization mode for the memory explorer */
export type VisualizationMode = 'spatial' | 'temporal' | 'hybrid';

// =============================================================================
// Memory Node (3D Representation)
// =============================================================================

/** 3D position in the visualization space */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/** A memory node in the 3D visualization */
export interface MemoryNode {
  /** The underlying memory data */
  memory: Memory;
  /** 3D position in visualization space */
  position: Position3D;
  /** Embedding vector for similarity calculations (optional, may be computed) */
  embedding?: number[];
  /** Cluster ID if grouped */
  clusterId?: string;
  /** Visual properties */
  visual: {
    /** Node color (hex) */
    color: string;
    /** Node size (scaled by importance) */
    size: number;
    /** Opacity (0-1) */
    opacity: number;
    /** Whether node is highlighted */
    highlighted: boolean;
    /** Whether node is selected */
    selected: boolean;
  };
}

// =============================================================================
// Clusters
// =============================================================================

/** A cluster of related memories */
export interface MemoryCluster {
  /** Unique cluster ID */
  id: string;
  /** Cluster label (auto-generated or user-defined) */
  label: string;
  /** Centroid position */
  centroid: Position3D;
  /** Memory IDs in this cluster */
  memberIds: string[];
  /** Cluster color */
  color: string;
}

// =============================================================================
// Explorer Settings
// =============================================================================

/** Settings for the memory explorer */
export interface ExplorerSettings {
  /** Current visualization mode */
  mode: VisualizationMode;
  /** Auto-cluster memories */
  autoClustering: boolean;
  /** Number of clusters for auto-clustering */
  clusterCount: number;
  /** Show connections between related memories */
  showConnections: boolean;
  /** Connection threshold (similarity score 0-1) */
  connectionThreshold: number;
  /** Animation speed (0-1) */
  animationSpeed: number;
  /** Camera settings */
  camera: {
    /** Initial distance from origin */
    distance: number;
    /** Auto-rotate */
    autoRotate: boolean;
    /** Rotation speed */
    rotationSpeed: number;
  };
  /** Filter settings */
  filters: {
    /** Show episodic memories */
    showEpisodic: boolean;
    /** Show semantic memories */
    showSemantic: boolean;
    /** Show identity memories */
    showIdentity: boolean;
    /** Minimum importance threshold */
    minImportance: number;
  };
}

// =============================================================================
// Search & Navigation
// =============================================================================

/** Search result with similarity score */
export interface MemorySearchResult {
  node: MemoryNode;
  similarity: number;
}

/** Timeline entry for temporal view */
export interface TimelineEntry {
  timestamp: number;
  memories: MemoryNode[];
  label: string;
}

// =============================================================================
// Explorer State
// =============================================================================

/** Full state of the memory explorer */
export interface ExplorerState {
  /** All memory nodes */
  nodes: MemoryNode[];
  /** Clusters (if clustering is enabled) */
  clusters: MemoryCluster[];
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Current search query */
  searchQuery: string;
  /** Search results */
  searchResults: MemorySearchResult[];
  /** Explorer settings */
  settings: ExplorerSettings;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

// =============================================================================
// Default Settings
// =============================================================================

/** Default explorer settings */
export const defaultExplorerSettings: ExplorerSettings = {
  mode: 'spatial',
  autoClustering: true,
  clusterCount: 5,
  showConnections: true,
  connectionThreshold: 0.7,
  animationSpeed: 0.5,
  camera: {
    distance: 50,
    autoRotate: false,
    rotationSpeed: 0.5,
  },
  filters: {
    showEpisodic: true,
    showSemantic: true,
    showIdentity: true,
    minImportance: 0,
  },
};
