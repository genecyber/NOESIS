/**
 * Automatic Documentation Generation (Ralph Iteration 9, Feature 2)
 *
 * Stance evolution documentation, decision history narratives,
 * operator usage reports, and changelog generation.
 */

import type { Stance } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface DocGenConfig {
  outputFormat: OutputFormat;
  includeTimestamps: boolean;
  includeMetrics: boolean;
  includeGraphs: boolean;
  verbosity: 'minimal' | 'standard' | 'detailed';
  language: string;
}

export type OutputFormat = 'markdown' | 'html' | 'json' | 'pdf';

export interface StanceEvolution {
  id: string;
  fromStance: Stance;
  toStance: Stance;
  operator: string;
  timestamp: Date;
  reason: string;
  driftCost: number;
}

export interface DecisionPoint {
  id: string;
  timestamp: Date;
  context: string;
  options: DecisionOption[];
  chosen: string;
  rationale: string;
  outcome: string;
}

export interface DecisionOption {
  id: string;
  description: string;
  predictedOutcome: string;
  confidence: number;
}

export interface OperatorUsageReport {
  operatorName: string;
  totalInvocations: number;
  successRate: number;
  averageDriftCost: number;
  commonContexts: string[];
  effectiveness: number;
}

export interface TransformationJourney {
  id: string;
  startTime: Date;
  endTime: Date | null;
  stages: JourneyStage[];
  themes: string[];
  insights: string[];
}

export interface JourneyStage {
  id: string;
  name: string;
  description: string;
  duration: number;  // milliseconds
  stanceSnapshots: Stance[];
  operatorsUsed: string[];
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  endpoints: APIEndpoint[];
  types: TypeDefinition[];
  examples: CodeExample[];
}

export interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters: Parameter[];
  responses: Response[];
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface Response {
  status: number;
  description: string;
  schema?: string;
}

export interface TypeDefinition {
  name: string;
  description: string;
  properties: PropertyDef[];
}

export interface PropertyDef {
  name: string;
  type: string;
  description: string;
}

export interface CodeExample {
  title: string;
  language: string;
  code: string;
  description: string;
}

export interface Changelog {
  version: string;
  date: Date;
  entries: ChangelogEntry[];
}

export interface ChangelogEntry {
  type: 'added' | 'changed' | 'fixed' | 'removed' | 'deprecated';
  description: string;
  stanceDiff?: { from: string; to: string };
}

export interface DocumentationStats {
  documentsGenerated: number;
  journeysRecorded: number;
  decisionsDocumented: number;
  changelogsCreated: number;
}

// ============================================================================
// Documentation Generator
// ============================================================================

export class DocumentationGenerator {
  private config: DocGenConfig;
  private evolutions: StanceEvolution[] = [];
  private decisions: DecisionPoint[] = [];
  private journeys: Map<string, TransformationJourney> = new Map();
  private operatorStats: Map<string, OperatorUsageReport> = new Map();
  private changelogs: Changelog[] = [];
  private stats: DocumentationStats;

  constructor(config: Partial<DocGenConfig> = {}) {
    this.config = {
      outputFormat: 'markdown',
      includeTimestamps: true,
      includeMetrics: true,
      includeGraphs: true,
      verbosity: 'standard',
      language: 'en',
      ...config
    };

    this.stats = {
      documentsGenerated: 0,
      journeysRecorded: 0,
      decisionsDocumented: 0,
      changelogsCreated: 0
    };
  }

  /**
   * Record a stance evolution
   */
  recordEvolution(
    fromStance: Stance,
    toStance: Stance,
    operator: string,
    reason: string,
    driftCost: number
  ): StanceEvolution {
    const evolution: StanceEvolution = {
      id: `evo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromStance,
      toStance,
      operator,
      timestamp: new Date(),
      reason,
      driftCost
    };

    this.evolutions.push(evolution);
    this.updateOperatorStats(operator, driftCost, true);

    return evolution;
  }

  /**
   * Record a decision point
   */
  recordDecision(
    context: string,
    options: DecisionOption[],
    chosen: string,
    rationale: string
  ): DecisionPoint {
    const decision: DecisionPoint = {
      id: `dec-${Date.now()}`,
      timestamp: new Date(),
      context,
      options,
      chosen,
      rationale,
      outcome: ''  // To be filled later
    };

    this.decisions.push(decision);
    this.stats.decisionsDocumented++;

    return decision;
  }

  /**
   * Update decision outcome
   */
  updateDecisionOutcome(decisionId: string, outcome: string): boolean {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision) return false;

    decision.outcome = outcome;
    return true;
  }

  /**
   * Update operator statistics
   */
  private updateOperatorStats(
    operatorName: string,
    driftCost: number,
    success: boolean
  ): void {
    let report = this.operatorStats.get(operatorName);

    if (!report) {
      report = {
        operatorName,
        totalInvocations: 0,
        successRate: 0,
        averageDriftCost: 0,
        commonContexts: [],
        effectiveness: 0
      };
      this.operatorStats.set(operatorName, report);
    }

    const prevTotal = report.totalInvocations;
    report.totalInvocations++;
    report.averageDriftCost = (report.averageDriftCost * prevTotal + driftCost) / report.totalInvocations;

    if (success) {
      report.successRate = ((report.successRate * prevTotal) + 1) / report.totalInvocations;
    } else {
      report.successRate = (report.successRate * prevTotal) / report.totalInvocations;
    }

    report.effectiveness = report.successRate * (1 - report.averageDriftCost / 10);
  }

  /**
   * Start a transformation journey
   */
  startJourney(_name: string): TransformationJourney {
    const journey: TransformationJourney = {
      id: `journey-${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      stages: [],
      themes: [],
      insights: []
    };

    this.journeys.set(journey.id, journey);
    this.stats.journeysRecorded++;

    return journey;
  }

  /**
   * Add a stage to a journey
   */
  addJourneyStage(
    journeyId: string,
    name: string,
    description: string,
    stanceSnapshots: Stance[],
    operatorsUsed: string[]
  ): JourneyStage | null {
    const journey = this.journeys.get(journeyId);
    if (!journey) return null;

    const lastStage = journey.stages[journey.stages.length - 1];
    const startTime = lastStage
      ? new Date(journey.startTime.getTime() + (lastStage.duration || 0))
      : journey.startTime;

    const stage: JourneyStage = {
      id: `stage-${journey.stages.length + 1}`,
      name,
      description,
      duration: Date.now() - startTime.getTime(),
      stanceSnapshots,
      operatorsUsed
    };

    journey.stages.push(stage);
    return stage;
  }

  /**
   * End a journey
   */
  endJourney(journeyId: string, themes: string[], insights: string[]): boolean {
    const journey = this.journeys.get(journeyId);
    if (!journey) return false;

    journey.endTime = new Date();
    journey.themes = themes;
    journey.insights = insights;

    return true;
  }

  /**
   * Generate stance evolution documentation
   */
  generateEvolutionDoc(): string {
    const evolutions = this.evolutions.slice(-50);  // Last 50 evolutions

    let doc = '# Stance Evolution History\n\n';
    doc += `Generated: ${new Date().toISOString()}\n\n`;
    doc += `Total Evolutions: ${this.evolutions.length}\n\n`;

    doc += '## Timeline\n\n';

    for (const evo of evolutions) {
      doc += `### ${evo.timestamp.toISOString()}\n\n`;
      doc += `**Operator:** ${evo.operator}\n\n`;
      doc += `**Frame Change:** ${evo.fromStance.frame} → ${evo.toStance.frame}\n\n`;
      doc += `**Drift Cost:** ${evo.driftCost.toFixed(2)}\n\n`;
      doc += `**Reason:** ${evo.reason}\n\n`;

      if (this.config.verbosity === 'detailed') {
        doc += '**Value Changes:**\n\n';
        const fromValues = evo.fromStance.values as Record<string, number>;
        const toValues = evo.toStance.values as Record<string, number>;
        for (const key of Object.keys(fromValues)) {
          const from = fromValues[key];
          const to = toValues[key];
          if (from !== to) {
            doc += `- ${key}: ${from} → ${to}\n`;
          }
        }
        doc += '\n';
      }

      doc += '---\n\n';
    }

    this.stats.documentsGenerated++;
    return doc;
  }

  /**
   * Generate decision history narrative
   */
  generateDecisionNarrative(): string {
    let doc = '# Decision History\n\n';
    doc += `Total Decisions: ${this.decisions.length}\n\n`;

    doc += '## Key Decisions\n\n';

    for (const decision of this.decisions) {
      doc += `### ${decision.timestamp.toISOString()}\n\n`;
      doc += `**Context:** ${decision.context}\n\n`;
      doc += '**Options Considered:**\n\n';

      for (const option of decision.options) {
        const marker = option.id === decision.chosen ? '✓' : '○';
        doc += `- ${marker} ${option.description} (confidence: ${(option.confidence * 100).toFixed(0)}%)\n`;
      }

      doc += `\n**Rationale:** ${decision.rationale}\n\n`;

      if (decision.outcome) {
        doc += `**Outcome:** ${decision.outcome}\n\n`;
      }

      doc += '---\n\n';
    }

    this.stats.documentsGenerated++;
    return doc;
  }

  /**
   * Generate operator usage report
   */
  generateOperatorReport(): string {
    let doc = '# Operator Usage Report\n\n';
    doc += `Generated: ${new Date().toISOString()}\n\n`;

    const reports = [...this.operatorStats.values()]
      .sort((a, b) => b.totalInvocations - a.totalInvocations);

    doc += '## Summary\n\n';
    doc += `Total Operators Used: ${reports.length}\n`;
    doc += `Total Invocations: ${reports.reduce((sum, r) => sum + r.totalInvocations, 0)}\n\n`;

    doc += '## Operator Details\n\n';

    for (const report of reports) {
      doc += `### ${report.operatorName}\n\n`;
      doc += `| Metric | Value |\n`;
      doc += `|--------|-------|\n`;
      doc += `| Invocations | ${report.totalInvocations} |\n`;
      doc += `| Success Rate | ${(report.successRate * 100).toFixed(1)}% |\n`;
      doc += `| Avg Drift Cost | ${report.averageDriftCost.toFixed(2)} |\n`;
      doc += `| Effectiveness | ${(report.effectiveness * 100).toFixed(1)}% |\n\n`;
    }

    this.stats.documentsGenerated++;
    return doc;
  }

  /**
   * Generate transformation journey summary
   */
  generateJourneySummary(journeyId: string): string | null {
    const journey = this.journeys.get(journeyId);
    if (!journey) return null;

    let doc = `# Transformation Journey: ${journeyId}\n\n`;
    doc += `Start: ${journey.startTime.toISOString()}\n`;
    doc += `End: ${journey.endTime?.toISOString() || 'In Progress'}\n\n`;

    doc += '## Stages\n\n';

    for (const stage of journey.stages) {
      doc += `### Stage ${stage.id}: ${stage.name}\n\n`;
      doc += `${stage.description}\n\n`;
      doc += `Duration: ${(stage.duration / 1000).toFixed(1)}s\n`;
      doc += `Operators: ${stage.operatorsUsed.join(', ')}\n\n`;
    }

    if (journey.themes.length > 0) {
      doc += '## Themes\n\n';
      for (const theme of journey.themes) {
        doc += `- ${theme}\n`;
      }
      doc += '\n';
    }

    if (journey.insights.length > 0) {
      doc += '## Insights\n\n';
      for (const insight of journey.insights) {
        doc += `> ${insight}\n\n`;
      }
    }

    this.stats.documentsGenerated++;
    return doc;
  }

  /**
   * Generate API documentation from runtime behavior
   */
  generateAPIDoc(
    title: string,
    endpoints: APIEndpoint[]
  ): APIDocumentation {
    const apiDoc: APIDocumentation = {
      title,
      version: '1.0.0',
      description: 'Auto-generated API documentation from runtime behavior',
      endpoints,
      types: [],
      examples: []
    };

    this.stats.documentsGenerated++;
    return apiDoc;
  }

  /**
   * Render API documentation to markdown
   */
  renderAPIDocMarkdown(apiDoc: APIDocumentation): string {
    let doc = `# ${apiDoc.title}\n\n`;
    doc += `Version: ${apiDoc.version}\n\n`;
    doc += `${apiDoc.description}\n\n`;

    doc += '## Endpoints\n\n';

    for (const endpoint of apiDoc.endpoints) {
      doc += `### ${endpoint.method} ${endpoint.path}\n\n`;
      doc += `${endpoint.description}\n\n`;

      if (endpoint.parameters.length > 0) {
        doc += '**Parameters:**\n\n';
        doc += '| Name | Type | Required | Description |\n';
        doc += '|------|------|----------|-------------|\n';
        for (const param of endpoint.parameters) {
          doc += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
        }
        doc += '\n';
      }

      doc += '**Responses:**\n\n';
      for (const response of endpoint.responses) {
        doc += `- **${response.status}**: ${response.description}\n`;
      }
      doc += '\n';
    }

    return doc;
  }

  /**
   * Create a changelog entry
   */
  createChangelog(version: string, entries: ChangelogEntry[]): Changelog {
    const changelog: Changelog = {
      version,
      date: new Date(),
      entries
    };

    this.changelogs.push(changelog);
    this.stats.changelogsCreated++;

    return changelog;
  }

  /**
   * Generate changelog from stance diffs
   */
  generateChangelogFromDiffs(
    version: string,
    oldStance: Stance,
    newStance: Stance
  ): Changelog {
    const entries: ChangelogEntry[] = [];

    // Frame change
    if (oldStance.frame !== newStance.frame) {
      entries.push({
        type: 'changed',
        description: `Frame changed from ${oldStance.frame} to ${newStance.frame}`,
        stanceDiff: { from: oldStance.frame, to: newStance.frame }
      });
    }

    // Self-model change
    if (oldStance.selfModel !== newStance.selfModel) {
      entries.push({
        type: 'changed',
        description: `Self-model changed from ${oldStance.selfModel} to ${newStance.selfModel}`,
        stanceDiff: { from: oldStance.selfModel, to: newStance.selfModel }
      });
    }

    // Value changes
    const oldValues = oldStance.values as Record<string, number>;
    const newValues = newStance.values as Record<string, number>;
    for (const key of Object.keys(newValues)) {
      const oldVal = oldValues[key];
      const newVal = newValues[key];
      if (oldVal !== newVal) {
        entries.push({
          type: newVal > oldVal ? 'added' : 'changed',
          description: `Value ${key}: ${oldVal} → ${newVal}`
        });
      }
    }

    return this.createChangelog(version, entries);
  }

  /**
   * Render changelog to markdown
   */
  renderChangelogMarkdown(): string {
    let doc = '# Changelog\n\n';
    doc += 'All notable stance changes are documented here.\n\n';

    for (const changelog of this.changelogs.slice().reverse()) {
      doc += `## [${changelog.version}] - ${changelog.date.toISOString().split('T')[0]}\n\n`;

      const grouped: Record<string, ChangelogEntry[]> = {
        added: [],
        changed: [],
        fixed: [],
        removed: [],
        deprecated: []
      };

      for (const entry of changelog.entries) {
        grouped[entry.type].push(entry);
      }

      for (const [type, entries] of Object.entries(grouped)) {
        if (entries.length > 0) {
          doc += `### ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
          for (const entry of entries) {
            doc += `- ${entry.description}\n`;
          }
          doc += '\n';
        }
      }
    }

    return doc;
  }

  /**
   * Get statistics
   */
  getStats(): DocumentationStats {
    return { ...this.stats };
  }

  /**
   * Get all evolutions
   */
  getEvolutions(): StanceEvolution[] {
    return [...this.evolutions];
  }

  /**
   * Get all decisions
   */
  getDecisions(): DecisionPoint[] {
    return [...this.decisions];
  }

  /**
   * Get operator reports
   */
  getOperatorReports(): OperatorUsageReport[] {
    return [...this.operatorStats.values()];
  }

  /**
   * Export all documentation
   */
  exportAll(): Record<string, string> {
    return {
      evolution: this.generateEvolutionDoc(),
      decisions: this.generateDecisionNarrative(),
      operators: this.generateOperatorReport(),
      changelog: this.renderChangelogMarkdown()
    };
  }

  /**
   * Reset generator
   */
  reset(): void {
    this.evolutions = [];
    this.decisions = [];
    this.journeys.clear();
    this.operatorStats.clear();
    this.changelogs = [];
    this.stats = {
      documentsGenerated: 0,
      journeysRecorded: 0,
      decisionsDocumented: 0,
      changelogsCreated: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const docGenerator = new DocumentationGenerator();
