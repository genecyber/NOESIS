/**
 * Automatic Documentation Generation (Ralph Iteration 9, Feature 2)
 *
 * Stance evolution documentation, decision history narratives,
 * operator usage reports, and changelog generation.
 */
import type { Stance } from '../types/index.js';
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
    duration: number;
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
    stanceDiff?: {
        from: string;
        to: string;
    };
}
export interface DocumentationStats {
    documentsGenerated: number;
    journeysRecorded: number;
    decisionsDocumented: number;
    changelogsCreated: number;
}
export declare class DocumentationGenerator {
    private config;
    private evolutions;
    private decisions;
    private journeys;
    private operatorStats;
    private changelogs;
    private stats;
    constructor(config?: Partial<DocGenConfig>);
    /**
     * Record a stance evolution
     */
    recordEvolution(fromStance: Stance, toStance: Stance, operator: string, reason: string, driftCost: number): StanceEvolution;
    /**
     * Record a decision point
     */
    recordDecision(context: string, options: DecisionOption[], chosen: string, rationale: string): DecisionPoint;
    /**
     * Update decision outcome
     */
    updateDecisionOutcome(decisionId: string, outcome: string): boolean;
    /**
     * Update operator statistics
     */
    private updateOperatorStats;
    /**
     * Start a transformation journey
     */
    startJourney(_name: string): TransformationJourney;
    /**
     * Add a stage to a journey
     */
    addJourneyStage(journeyId: string, name: string, description: string, stanceSnapshots: Stance[], operatorsUsed: string[]): JourneyStage | null;
    /**
     * End a journey
     */
    endJourney(journeyId: string, themes: string[], insights: string[]): boolean;
    /**
     * Generate stance evolution documentation
     */
    generateEvolutionDoc(): string;
    /**
     * Generate decision history narrative
     */
    generateDecisionNarrative(): string;
    /**
     * Generate operator usage report
     */
    generateOperatorReport(): string;
    /**
     * Generate transformation journey summary
     */
    generateJourneySummary(journeyId: string): string | null;
    /**
     * Generate API documentation from runtime behavior
     */
    generateAPIDoc(title: string, endpoints: APIEndpoint[]): APIDocumentation;
    /**
     * Render API documentation to markdown
     */
    renderAPIDocMarkdown(apiDoc: APIDocumentation): string;
    /**
     * Create a changelog entry
     */
    createChangelog(version: string, entries: ChangelogEntry[]): Changelog;
    /**
     * Generate changelog from stance diffs
     */
    generateChangelogFromDiffs(version: string, oldStance: Stance, newStance: Stance): Changelog;
    /**
     * Render changelog to markdown
     */
    renderChangelogMarkdown(): string;
    /**
     * Get statistics
     */
    getStats(): DocumentationStats;
    /**
     * Get all evolutions
     */
    getEvolutions(): StanceEvolution[];
    /**
     * Get all decisions
     */
    getDecisions(): DecisionPoint[];
    /**
     * Get operator reports
     */
    getOperatorReports(): OperatorUsageReport[];
    /**
     * Export all documentation
     */
    exportAll(): Record<string, string>;
    /**
     * Reset generator
     */
    reset(): void;
}
export declare const docGenerator: DocumentationGenerator;
//# sourceMappingURL=generator.d.ts.map