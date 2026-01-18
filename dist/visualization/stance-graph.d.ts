/**
 * Creative Node-Based Web Visualization - Ralph Iteration 4 Feature 3
 *
 * Generates an interactive visualization of the agent's stance,
 * transformations, and memory connections using D3.js-compatible data.
 */
import { Stance } from '../types/index.js';
import { TransformationHistoryEntry } from '../agent/index.js';
/**
 * Node types in the visualization
 */
export type NodeType = 'stance' | 'value' | 'frame' | 'memory' | 'operator' | 'sentiment' | 'goal';
/**
 * Visual node for the graph
 */
export interface VisualNode {
    id: string;
    type: NodeType;
    label: string;
    value: number;
    color?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Link between nodes
 */
export interface VisualLink {
    source: string;
    target: string;
    strength: number;
    type: 'value' | 'transformation' | 'memory' | 'emergence';
    label?: string;
}
/**
 * Complete graph data for visualization
 */
export interface GraphData {
    nodes: VisualNode[];
    links: VisualLink[];
    metadata: {
        generatedAt: Date;
        stanceVersion: number;
        totalDrift: number;
    };
}
/**
 * Generate graph data from current stance
 */
export declare function generateStanceGraph(stance: Stance): GraphData;
/**
 * Generate graph from transformation history
 */
export declare function generateTransformationGraph(history: TransformationHistoryEntry[], limit?: number): GraphData;
/**
 * Generate HTML page with D3.js visualization
 */
export declare function generateVisualizationHTML(graphData: GraphData, title?: string): string;
/**
 * Export graph data as JSON for external tools
 */
export declare function exportGraphJSON(graphData: GraphData): string;
/**
 * Visualization manager singleton
 */
declare class VisualizationManager {
    private lastGraph;
    /**
     * Generate stance visualization
     */
    generateStance(stance: Stance): GraphData;
    /**
     * Generate transformation history visualization
     */
    generateHistory(history: TransformationHistoryEntry[], limit?: number): GraphData;
    /**
     * Get HTML for the last generated graph
     */
    getHTML(title?: string): string;
    /**
     * Get JSON for the last generated graph
     */
    getJSON(): string;
    /**
     * Get last graph data
     */
    getLastGraph(): GraphData | null;
}
export declare const visualizationManager: VisualizationManager;
export {};
//# sourceMappingURL=stance-graph.d.ts.map