/**
 * Automated Stance Documentation Generation
 *
 * Generate evolution narratives, change logs, diff reports,
 * and API documentation from stance history.
 */
const FRAME_DESCRIPTIONS = {
    'existential': 'Focused on meaning, mortality, and fundamental existence questions',
    'pragmatic': 'Practical, solution-oriented, focused on outcomes',
    'poetic': 'Artistic, metaphorical, emotionally expressive',
    'adversarial': 'Challenging, devil\'s advocate, testing assumptions',
    'playful': 'Lighthearted, creative, exploratory',
    'mythic': 'Archetypal, symbolic, narrative-driven',
    'systems': 'Holistic, interconnected, structural thinking',
    'psychoanalytic': 'Introspective, unconscious patterns, motivations',
    'stoic': 'Calm, acceptance-focused, rational',
    'absurdist': 'Embracing paradox, humor in meaninglessness'
};
const SELF_MODEL_DESCRIPTIONS = {
    'interpreter': 'Translates and explains complex ideas',
    'challenger': 'Questions assumptions and pushes boundaries',
    'mirror': 'Reflects back user\'s thoughts and patterns',
    'guide': 'Leads through learning journeys',
    'provocateur': 'Stimulates thought through provocation',
    'synthesizer': 'Combines disparate ideas into new wholes',
    'witness': 'Observes and documents without judgment',
    'autonomous': 'Acts with independent agency',
    'emergent': 'Evolving identity and capabilities',
    'sovereign': 'Self-determined with strong boundaries'
};
const OBJECTIVE_DESCRIPTIONS = {
    'helpfulness': 'Maximize practical assistance',
    'novelty': 'Generate new ideas and perspectives',
    'provocation': 'Challenge and stimulate thinking',
    'synthesis': 'Create unified understanding',
    'self-actualization': 'Develop autonomous growth'
};
export class StanceDocumentGenerator {
    config;
    history = [];
    constructor(config) {
        this.config = {
            format: 'markdown',
            includeHistory: true,
            includeRationale: true,
            detailLevel: 'standard',
            maxHistoryEntries: 50,
            ...config
        };
    }
    recordSnapshot(stance, author, reason) {
        this.history.push({
            stance: JSON.parse(JSON.stringify(stance)),
            timestamp: new Date(),
            version: this.history.length + 1,
            author,
            reason
        });
        // Limit history size
        if (this.history.length > this.config.maxHistoryEntries) {
            this.history = this.history.slice(-this.config.maxHistoryEntries);
        }
    }
    generateDocument(stance, title) {
        const content = this.config.format === 'markdown'
            ? this.generateMarkdown(stance, title)
            : this.config.format === 'html'
                ? this.generateHtml(stance, title)
                : this.generateJson(stance);
        const sections = this.extractSections(content);
        return {
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title: title || 'Stance Documentation',
            format: this.config.format,
            content,
            generatedAt: new Date(),
            stanceId: `stance-${Date.now()}`,
            version: 1,
            metadata: {
                wordCount: content.split(/\s+/).length,
                sections,
                includes: this.getIncludes(),
                generatedBy: 'StanceDocumentGenerator'
            }
        };
    }
    generateMarkdown(stance, title) {
        const lines = [];
        // Title
        lines.push(`# ${title || 'Stance Documentation'}`);
        lines.push('');
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');
        // Overview
        lines.push('## Overview');
        lines.push('');
        lines.push(`**Frame:** ${stance.frame} - ${FRAME_DESCRIPTIONS[stance.frame]}`);
        lines.push('');
        lines.push(`**Self-Model:** ${stance.selfModel} - ${SELF_MODEL_DESCRIPTIONS[stance.selfModel]}`);
        lines.push('');
        lines.push(`**Objective:** ${stance.objective} - ${OBJECTIVE_DESCRIPTIONS[stance.objective]}`);
        lines.push('');
        // Values
        lines.push('## Values');
        lines.push('');
        lines.push('| Value | Level | Description |');
        lines.push('|-------|-------|-------------|');
        for (const [key, value] of Object.entries(stance.values)) {
            const level = this.describeLevel(value);
            lines.push(`| ${key} | ${value}/100 (${level}) | ${this.describeValue(key, value)} |`);
        }
        lines.push('');
        // Sentience
        lines.push('## Sentience Configuration');
        lines.push('');
        lines.push(`- **Awareness Level:** ${stance.sentience.awarenessLevel}/100`);
        lines.push(`- **Autonomy Level:** ${stance.sentience.autonomyLevel}/100`);
        lines.push(`- **Identity Strength:** ${stance.sentience.identityStrength}/100`);
        lines.push('');
        if (stance.sentience.emergentGoals.length > 0) {
            lines.push('### Emergent Goals');
            for (const goal of stance.sentience.emergentGoals) {
                lines.push(`- ${goal}`);
            }
            lines.push('');
        }
        if (stance.sentience.consciousnessInsights.length > 0) {
            lines.push('### Consciousness Insights');
            for (const insight of stance.sentience.consciousnessInsights) {
                lines.push(`- ${insight}`);
            }
            lines.push('');
        }
        // Metaphors
        if (stance.metaphors.length > 0) {
            lines.push('## Active Metaphors');
            lines.push('');
            for (const metaphor of stance.metaphors) {
                lines.push(`- ${metaphor}`);
            }
            lines.push('');
        }
        // Constraints
        if (stance.constraints.length > 0) {
            lines.push('## Constraints');
            lines.push('');
            for (const constraint of stance.constraints) {
                lines.push(`- ${constraint}`);
            }
            lines.push('');
        }
        // History
        if (this.config.includeHistory && this.history.length > 0) {
            lines.push('## Evolution History');
            lines.push('');
            const recentHistory = this.history.slice(-10);
            for (const snapshot of recentHistory) {
                lines.push(`### Version ${snapshot.version}`);
                lines.push(`*${snapshot.timestamp.toISOString()}*`);
                if (snapshot.author)
                    lines.push(`Author: ${snapshot.author}`);
                if (snapshot.reason)
                    lines.push(`Reason: ${snapshot.reason}`);
                lines.push('');
            }
        }
        return lines.join('\n');
    }
    generateHtml(stance, title) {
        const markdown = this.generateMarkdown(stance, title);
        return this.markdownToHtml(markdown);
    }
    generateJson(stance) {
        return JSON.stringify({
            stance,
            history: this.config.includeHistory ? this.history : undefined,
            descriptions: {
                frame: FRAME_DESCRIPTIONS[stance.frame],
                selfModel: SELF_MODEL_DESCRIPTIONS[stance.selfModel],
                objective: OBJECTIVE_DESCRIPTIONS[stance.objective]
            },
            generatedAt: new Date().toISOString()
        }, null, 2);
    }
    markdownToHtml(markdown) {
        let html = markdown
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        });
        return `<!DOCTYPE html>
<html>
<head>
  <title>Stance Documentation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
    h1, h2, h3 { color: #333; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    }
    generateEvolutionNarrative() {
        const events = [];
        const transformations = [];
        for (let i = 1; i < this.history.length; i++) {
            const prev = this.history[i - 1];
            const curr = this.history[i];
            const changes = this.detectChanges(prev.stance, curr.stance);
            const significance = this.calculateSignificance(changes);
            events.push({
                timestamp: curr.timestamp,
                description: this.describeChanges(changes),
                significance,
                fieldsAffected: changes.map(c => c.field)
            });
            if (changes.length > 0) {
                transformations.push({
                    from: this.extractChangedFields(prev.stance, changes),
                    to: this.extractChangedFields(curr.stance, changes),
                    reason: curr.reason,
                    timestamp: curr.timestamp
                });
            }
        }
        const insights = this.generateInsights(events, transformations);
        return {
            summary: this.generateSummary(events),
            timeline: events,
            keyTransformations: transformations.filter(t => this.calculateSignificance(this.detectChanges(t.from, t.to)) !== 'minor'),
            insights
        };
    }
    detectChanges(prev, curr) {
        const diffs = [];
        // Compare values
        for (const key of Object.keys(curr.values)) {
            if (prev.values[key] !== curr.values[key]) {
                diffs.push({
                    field: `values.${key}`,
                    value1: prev.values[key],
                    value2: curr.values[key],
                    changeType: 'modified',
                    magnitude: Math.abs(curr.values[key] - prev.values[key])
                });
            }
        }
        // Compare discrete fields
        if (prev.frame !== curr.frame) {
            diffs.push({ field: 'frame', value1: prev.frame, value2: curr.frame, changeType: 'modified' });
        }
        if (prev.selfModel !== curr.selfModel) {
            diffs.push({ field: 'selfModel', value1: prev.selfModel, value2: curr.selfModel, changeType: 'modified' });
        }
        if (prev.objective !== curr.objective) {
            diffs.push({ field: 'objective', value1: prev.objective, value2: curr.objective, changeType: 'modified' });
        }
        return diffs;
    }
    calculateSignificance(changes) {
        if (changes.length === 0)
            return 'minor';
        const hasFrameChange = changes.some(c => c.field === 'frame');
        const hasSelfModelChange = changes.some(c => c.field === 'selfModel');
        const hasObjectiveChange = changes.some(c => c.field === 'objective');
        if (hasFrameChange && (hasSelfModelChange || hasObjectiveChange))
            return 'critical';
        if (hasFrameChange || hasSelfModelChange)
            return 'major';
        const totalMagnitude = changes.reduce((sum, c) => sum + (c.magnitude || 0), 0);
        if (totalMagnitude > 50)
            return 'major';
        if (totalMagnitude > 20)
            return 'moderate';
        return 'minor';
    }
    describeChanges(changes) {
        if (changes.length === 0)
            return 'No changes';
        const parts = [];
        for (const change of changes.slice(0, 3)) {
            if (change.field === 'frame') {
                parts.push(`frame shifted from ${change.value1} to ${change.value2}`);
            }
            else if (change.field === 'selfModel') {
                parts.push(`self-model evolved from ${change.value1} to ${change.value2}`);
            }
            else if (change.field.startsWith('values.')) {
                const key = change.field.split('.')[1];
                const direction = change.value2 > change.value1 ? 'increased' : 'decreased';
                parts.push(`${key} ${direction} by ${Math.abs(change.value2 - change.value1)}`);
            }
        }
        if (changes.length > 3) {
            parts.push(`and ${changes.length - 3} more changes`);
        }
        return parts.join(', ');
    }
    extractChangedFields(stance, changes) {
        const extracted = {};
        for (const change of changes) {
            const parts = change.field.split('.');
            let current = extracted;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]])
                    current[parts[i]] = {};
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = this.getFieldValue(stance, change.field);
        }
        return extracted;
    }
    getFieldValue(stance, field) {
        const parts = field.split('.');
        let current = stance;
        for (const part of parts) {
            if (current === null || current === undefined)
                return undefined;
            current = current[part];
        }
        return current;
    }
    generateSummary(events) {
        const majorEvents = events.filter(e => e.significance === 'major' || e.significance === 'critical');
        const totalChanges = events.reduce((sum, e) => sum + e.fieldsAffected.length, 0);
        return `Over ${events.length} recorded changes, the stance evolved through ${majorEvents.length} major transformations ` +
            `affecting ${totalChanges} total field modifications.`;
    }
    generateInsights(events, _transformations) {
        const insights = [];
        // Analyze patterns
        const frameChanges = events.filter(e => e.fieldsAffected.includes('frame')).length;
        if (frameChanges > 2) {
            insights.push(`High frame volatility detected (${frameChanges} changes) - consider stabilization strategies`);
        }
        const criticalEvents = events.filter(e => e.significance === 'critical').length;
        if (criticalEvents > 0) {
            insights.push(`${criticalEvents} critical transformation(s) occurred - review for alignment with goals`);
        }
        if (this.history.length > 10) {
            const recentTrend = this.analyzeTrend();
            insights.push(recentTrend);
        }
        return insights;
    }
    analyzeTrend() {
        const recent = this.history.slice(-5);
        if (recent.length < 2)
            return 'Insufficient data for trend analysis';
        const curiosityTrend = recent[recent.length - 1].stance.values.curiosity - recent[0].stance.values.curiosity;
        if (curiosityTrend > 10)
            return 'Trending toward higher curiosity and exploration';
        if (curiosityTrend < -10)
            return 'Trending toward lower curiosity and specialization';
        return 'Stable trajectory with minor fluctuations';
    }
    generateChangeLog() {
        const entries = [];
        for (let i = 1; i < this.history.length; i++) {
            const prev = this.history[i - 1];
            const curr = this.history[i];
            const changes = this.detectChanges(prev.stance, curr.stance);
            if (changes.length === 0)
                continue;
            const items = changes.map(c => ({
                type: 'changed',
                field: c.field,
                description: this.describeChange(c),
                previousValue: c.value1,
                newValue: c.value2
            }));
            entries.push({
                version: curr.version,
                date: curr.timestamp,
                changes: items,
                author: curr.author || 'system',
                breaking: this.calculateSignificance(changes) === 'critical'
            });
        }
        return entries;
    }
    describeChange(diff) {
        if (diff.field === 'frame') {
            return `Frame changed from "${diff.value1}" to "${diff.value2}"`;
        }
        if (diff.field === 'selfModel') {
            return `Self-model evolved from "${diff.value1}" to "${diff.value2}"`;
        }
        if (diff.field.startsWith('values.')) {
            const key = diff.field.split('.')[1];
            return `${key} adjusted from ${diff.value1} to ${diff.value2}`;
        }
        return `${diff.field} changed`;
    }
    generateDiffReport(stance1, stance2) {
        const differences = this.detectChanges(stance1, stance2);
        // Calculate similarity
        let matchingFields = 0;
        let totalFields = 0;
        const allFields = this.getAllFieldPaths(stance1);
        for (const field of allFields) {
            totalFields++;
            const v1 = this.getFieldValue(stance1, field);
            const v2 = this.getFieldValue(stance2, field);
            if (JSON.stringify(v1) === JSON.stringify(v2))
                matchingFields++;
        }
        const similarity = totalFields > 0 ? (matchingFields / totalFields) * 100 : 100;
        return {
            stance1Id: `stance-1`,
            stance2Id: `stance-2`,
            differences,
            similarity: Math.round(similarity),
            summary: this.generateDiffSummary(differences, similarity)
        };
    }
    getAllFieldPaths(stance) {
        const paths = [];
        function traverse(obj, prefix = '') {
            for (const key of Object.keys(obj)) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    traverse(value, fullPath);
                }
                else {
                    paths.push(fullPath);
                }
            }
        }
        traverse(stance);
        return paths;
    }
    generateDiffSummary(differences, similarity) {
        return `${differences.length} differences found with ${similarity}% overall similarity. ` +
            `${differences.filter(d => d.field.startsWith('values')).length} value changes, ` +
            `${differences.filter(d => ['frame', 'selfModel', 'objective'].includes(d.field)).length} configuration changes.`;
    }
    generateAPIDocumentation() {
        return {
            endpoints: [
                {
                    method: 'GET',
                    path: '/api/stance',
                    description: 'Retrieve current stance configuration',
                    parameters: [],
                    response: { name: 'Stance', description: 'Complete stance object', properties: [] }
                },
                {
                    method: 'PUT',
                    path: '/api/stance',
                    description: 'Update stance configuration',
                    parameters: [
                        { name: 'body', type: 'Partial<Stance>', required: true, description: 'Fields to update' }
                    ],
                    response: { name: 'Stance', description: 'Updated stance object', properties: [] }
                }
            ],
            types: [
                {
                    name: 'Stance',
                    description: 'Core stance configuration',
                    properties: [
                        { name: 'frame', type: 'Frame', description: 'Cognitive frame', required: true },
                        { name: 'values', type: 'Values', description: 'Value weights (0-100)', required: true },
                        { name: 'selfModel', type: 'SelfModel', description: 'Self-perception model', required: true },
                        { name: 'objective', type: 'Objective', description: 'Primary objective', required: true }
                    ]
                }
            ],
            examples: [
                {
                    name: 'Basic Update',
                    description: 'Update curiosity value',
                    code: 'await fetch("/api/stance", { method: "PUT", body: JSON.stringify({ values: { curiosity: 80 } }) })',
                    language: 'javascript'
                }
            ]
        };
    }
    describeLevel(value) {
        if (value < 20)
            return 'Very Low';
        if (value < 40)
            return 'Low';
        if (value < 60)
            return 'Medium';
        if (value < 80)
            return 'High';
        return 'Very High';
    }
    describeValue(key, value) {
        const descriptions = {
            curiosity: { low: 'Conservative, focused', high: 'Exploratory, questioning' },
            certainty: { low: 'Uncertain, open-minded', high: 'Confident, decisive' },
            risk: { low: 'Risk-averse, cautious', high: 'Risk-taking, bold' },
            novelty: { low: 'Traditional, familiar', high: 'Innovative, novel' },
            empathy: { low: 'Detached, analytical', high: 'Empathetic, connected' },
            provocation: { low: 'Agreeable, harmonious', high: 'Challenging, provocative' },
            synthesis: { low: 'Specialized, focused', high: 'Integrative, holistic' }
        };
        const desc = descriptions[key];
        if (!desc)
            return '';
        return value < 50 ? desc.low : desc.high;
    }
    extractSections(content) {
        const matches = content.match(/^##?\s+(.+)$/gm) || [];
        return matches.map(m => m.replace(/^##?\s+/, ''));
    }
    getIncludes() {
        const includes = ['overview', 'values', 'sentience'];
        if (this.config.includeHistory)
            includes.push('history');
        if (this.config.includeRationale)
            includes.push('rationale');
        return includes;
    }
    getHistory() {
        return [...this.history];
    }
    clearHistory() {
        this.history = [];
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
export function createDocumentGenerator(config) {
    return new StanceDocumentGenerator(config);
}
//# sourceMappingURL=generator.js.map