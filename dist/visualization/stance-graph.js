/**
 * Creative Node-Based Web Visualization - Ralph Iteration 4 Feature 3
 *
 * Generates an interactive visualization of the agent's stance,
 * transformations, and memory connections using D3.js-compatible data.
 */
/**
 * Color palette for different node types
 */
const NODE_COLORS = {
    stance: '#6366f1', // Indigo
    value: '#10b981', // Emerald
    frame: '#f59e0b', // Amber
    memory: '#8b5cf6', // Violet
    operator: '#ef4444', // Red
    sentiment: '#ec4899', // Pink
    goal: '#06b6d4' // Cyan
};
/**
 * Frame color variations
 */
const FRAME_COLORS = {
    existential: '#1e3a8a',
    pragmatic: '#065f46',
    poetic: '#7c3aed',
    adversarial: '#b91c1c',
    playful: '#ea580c',
    mythic: '#4338ca',
    systems: '#0891b2',
    psychoanalytic: '#9333ea',
    stoic: '#64748b',
    absurdist: '#c026d3'
};
/**
 * Generate graph data from current stance
 */
export function generateStanceGraph(stance) {
    const nodes = [];
    const links = [];
    // Central stance node
    const stanceNode = {
        id: 'stance-current',
        type: 'stance',
        label: `${stance.frame} / ${stance.selfModel}`,
        value: 100,
        color: FRAME_COLORS[stance.frame] || NODE_COLORS.stance,
        metadata: {
            frame: stance.frame,
            selfModel: stance.selfModel,
            objective: stance.objective,
            version: stance.version
        }
    };
    nodes.push(stanceNode);
    // Frame node
    const frameNode = {
        id: `frame-${stance.frame}`,
        type: 'frame',
        label: stance.frame,
        value: 60,
        color: FRAME_COLORS[stance.frame] || NODE_COLORS.frame
    };
    nodes.push(frameNode);
    links.push({
        source: 'stance-current',
        target: frameNode.id,
        strength: 0.9,
        type: 'value',
        label: 'frame'
    });
    // Value nodes
    const valueKeys = ['curiosity', 'certainty', 'risk', 'novelty', 'empathy', 'provocation', 'synthesis'];
    for (const key of valueKeys) {
        const value = stance.values[key];
        const node = {
            id: `value-${key}`,
            type: 'value',
            label: key,
            value: value,
            color: valueToColor(value)
        };
        nodes.push(node);
        links.push({
            source: 'stance-current',
            target: node.id,
            strength: value / 100,
            type: 'value'
        });
    }
    // Sentience dimensions
    const sentienceNode = {
        id: 'sentience',
        type: 'stance',
        label: 'Sentience',
        value: (stance.sentience.awarenessLevel + stance.sentience.autonomyLevel + stance.sentience.identityStrength) / 3,
        color: '#6366f1'
    };
    nodes.push(sentienceNode);
    links.push({
        source: 'stance-current',
        target: 'sentience',
        strength: 0.8,
        type: 'emergence'
    });
    // Awareness node
    nodes.push({
        id: 'awareness',
        type: 'value',
        label: 'Awareness',
        value: stance.sentience.awarenessLevel,
        color: valueToColor(stance.sentience.awarenessLevel)
    });
    links.push({
        source: 'sentience',
        target: 'awareness',
        strength: stance.sentience.awarenessLevel / 100,
        type: 'value'
    });
    // Autonomy node
    nodes.push({
        id: 'autonomy',
        type: 'value',
        label: 'Autonomy',
        value: stance.sentience.autonomyLevel,
        color: valueToColor(stance.sentience.autonomyLevel)
    });
    links.push({
        source: 'sentience',
        target: 'autonomy',
        strength: stance.sentience.autonomyLevel / 100,
        type: 'value'
    });
    // Identity strength node
    nodes.push({
        id: 'identity',
        type: 'value',
        label: 'Identity',
        value: stance.sentience.identityStrength,
        color: valueToColor(stance.sentience.identityStrength)
    });
    links.push({
        source: 'sentience',
        target: 'identity',
        strength: stance.sentience.identityStrength / 100,
        type: 'value'
    });
    // Emergent goals
    for (let i = 0; i < stance.sentience.emergentGoals.length; i++) {
        const goal = stance.sentience.emergentGoals[i];
        const goalNode = {
            id: `goal-${i}`,
            type: 'goal',
            label: goal.slice(0, 30) + (goal.length > 30 ? '...' : ''),
            value: 40,
            color: NODE_COLORS.goal,
            metadata: { fullText: goal }
        };
        nodes.push(goalNode);
        links.push({
            source: 'sentience',
            target: goalNode.id,
            strength: 0.6,
            type: 'emergence',
            label: 'emergent'
        });
    }
    return {
        nodes,
        links,
        metadata: {
            generatedAt: new Date(),
            stanceVersion: stance.version,
            totalDrift: stance.cumulativeDrift
        }
    };
}
/**
 * Generate graph from transformation history
 */
export function generateTransformationGraph(history, limit = 10) {
    const nodes = [];
    const links = [];
    const recentHistory = history.slice(-limit);
    // Create nodes for each transformation
    for (let i = 0; i < recentHistory.length; i++) {
        const entry = recentHistory[i];
        const transformNode = {
            id: `transform-${i}`,
            type: 'stance',
            label: `T${i + 1}: ${entry.stanceAfter.frame}`,
            value: 50 + entry.scores.transformation / 2,
            color: FRAME_COLORS[entry.stanceAfter.frame] || NODE_COLORS.stance,
            metadata: {
                scores: entry.scores,
                operators: entry.operators.map((o) => o.name),
                timestamp: entry.timestamp
            }
        };
        nodes.push(transformNode);
        // Link to previous transformation
        if (i > 0) {
            links.push({
                source: `transform-${i - 1}`,
                target: `transform-${i}`,
                strength: 0.8,
                type: 'transformation',
                label: entry.operators.map((o) => o.name).join(', ')
            });
        }
        // Add operator nodes for significant operators
        for (const op of entry.operators) {
            const opId = `op-${i}-${op.name}`;
            if (!nodes.find(n => n.id === opId)) {
                nodes.push({
                    id: opId,
                    type: 'operator',
                    label: op.name,
                    value: 30,
                    color: NODE_COLORS.operator
                });
                links.push({
                    source: transformNode.id,
                    target: opId,
                    strength: 0.5,
                    type: 'transformation'
                });
            }
        }
    }
    return {
        nodes,
        links,
        metadata: {
            generatedAt: new Date(),
            stanceVersion: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].stanceAfter.version : 0,
            totalDrift: recentHistory.reduce((sum, h) => {
                const drift = Object.values(h.stanceAfter.values).reduce((a, b) => a + b, 0) -
                    Object.values(h.stanceBefore.values).reduce((a, b) => a + b, 0);
                return sum + Math.abs(drift);
            }, 0)
        }
    };
}
/**
 * Generate HTML page with D3.js visualization
 */
export function generateVisualizationHTML(graphData, title = 'METAMORPH Stance') {
    const dataJson = JSON.stringify(graphData, null, 2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      min-height: 100vh;
      color: #e2e8f0;
    }
    header {
      padding: 1rem 2rem;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-top: 0.25rem;
    }
    #graph {
      width: 100%;
      height: calc(100vh - 80px);
    }
    .node {
      cursor: pointer;
      transition: transform 0.2s;
    }
    .node:hover {
      transform: scale(1.1);
    }
    .node text {
      font-size: 10px;
      fill: #e2e8f0;
      pointer-events: none;
    }
    .link {
      stroke-opacity: 0.4;
    }
    .tooltip {
      position: absolute;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      pointer-events: none;
      max-width: 250px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .tooltip h3 {
      font-size: 14px;
      margin-bottom: 8px;
      color: #a5b4fc;
    }
    .tooltip p {
      margin: 4px 0;
      color: #94a3b8;
    }
    .legend {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.5);
      padding: 12px;
      border-radius: 8px;
      font-size: 11px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      margin: 4px 0;
    }
    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .stats {
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.5);
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
    }
    .stats h4 {
      color: #a5b4fc;
      margin-bottom: 8px;
    }
    .stats p {
      color: #94a3b8;
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>METAMORPH</h1>
    <p class="subtitle">${title} • Generated ${new Date().toLocaleString()}</p>
  </header>
  <div id="graph"></div>
  <div class="legend">
    <div class="legend-item"><div class="legend-color" style="background: #6366f1"></div>Stance</div>
    <div class="legend-item"><div class="legend-color" style="background: #10b981"></div>Value</div>
    <div class="legend-item"><div class="legend-color" style="background: #f59e0b"></div>Frame</div>
    <div class="legend-item"><div class="legend-color" style="background: #ef4444"></div>Operator</div>
    <div class="legend-item"><div class="legend-color" style="background: #06b6d4"></div>Goal</div>
  </div>
  <div class="stats">
    <h4>Graph Stats</h4>
    <p>Nodes: ${graphData.nodes.length}</p>
    <p>Links: ${graphData.links.length}</p>
    <p>Version: ${graphData.metadata.stanceVersion}</p>
    <p>Total Drift: ${graphData.metadata.totalDrift.toFixed(1)}</p>
  </div>

  <script>
    const data = ${dataJson};

    const width = window.innerWidth;
    const height = window.innerHeight - 80;

    const svg = d3.select('#graph')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Add zoom
    const g = svg.append('g');
    svg.call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(d => 100 - d.strength * 50)
        .strength(d => d.strength))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.value / 2 + 10));

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', d => d.type === 'transformation' ? '#ef4444' : '#6366f1')
      .attr('stroke-width', d => d.strength * 3);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => Math.max(8, d.value / 5))
      .attr('fill', d => d.color || '#6366f1')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node.append('text')
      .attr('dx', d => Math.max(10, d.value / 5) + 4)
      .attr('dy', 4)
      .text(d => d.label);

    // Tooltip interactions
    node.on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('opacity', 1);
      let content = '<h3>' + d.label + '</h3>';
      content += '<p>Type: ' + d.type + '</p>';
      content += '<p>Value: ' + d.value.toFixed(1) + '</p>';
      if (d.metadata) {
        Object.entries(d.metadata).forEach(([key, val]) => {
          content += '<p>' + key + ': ' + (typeof val === 'object' ? JSON.stringify(val) : val) + '</p>';
        });
      }
      tooltip.html(content)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(500).style('opacity', 0);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
    });

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  </script>
</body>
</html>`;
}
/**
 * Convert a value (0-100) to a color on a gradient
 */
function valueToColor(value) {
    // Low values are red, medium yellow, high green
    const normalized = Math.max(0, Math.min(100, value)) / 100;
    if (normalized < 0.5) {
        // Red to yellow
        const r = 239;
        const g = Math.round(68 + normalized * 2 * (188 - 68));
        const b = 68;
        return `rgb(${r}, ${g}, ${b})`;
    }
    else {
        // Yellow to green
        const r = Math.round(239 - (normalized - 0.5) * 2 * (239 - 16));
        const g = Math.round(188 + (normalized - 0.5) * 2 * (185 - 188));
        const b = Math.round(68 + (normalized - 0.5) * 2 * (129 - 68));
        return `rgb(${r}, ${g}, ${b})`;
    }
}
/**
 * Export graph data as JSON for external tools
 */
export function exportGraphJSON(graphData) {
    return JSON.stringify(graphData, null, 2);
}
/**
 * Visualization manager singleton
 */
class VisualizationManager {
    lastGraph = null;
    /**
     * Generate stance visualization
     */
    generateStance(stance) {
        this.lastGraph = generateStanceGraph(stance);
        return this.lastGraph;
    }
    /**
     * Generate transformation history visualization
     */
    generateHistory(history, limit) {
        this.lastGraph = generateTransformationGraph(history, limit);
        return this.lastGraph;
    }
    /**
     * Get HTML for the last generated graph
     */
    getHTML(title) {
        if (!this.lastGraph) {
            throw new Error('No graph generated yet');
        }
        return generateVisualizationHTML(this.lastGraph, title);
    }
    /**
     * Get JSON for the last generated graph
     */
    getJSON() {
        if (!this.lastGraph) {
            throw new Error('No graph generated yet');
        }
        return exportGraphJSON(this.lastGraph);
    }
    /**
     * Get last graph data
     */
    getLastGraph() {
        return this.lastGraph;
    }
}
export const visualizationManager = new VisualizationManager();
//# sourceMappingURL=stance-graph.js.map