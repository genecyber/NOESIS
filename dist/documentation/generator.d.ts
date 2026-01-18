/**
 * Automated Stance Documentation Generation
 *
 * Generate evolution narratives, change logs, diff reports,
 * and API documentation from stance history.
 */
import type { Stance } from '../types/index.js';
export interface DocumentationConfig {
    format: 'markdown' | 'html' | 'pdf' | 'json';
    includeHistory: boolean;
    includeRationale: boolean;
    detailLevel: 'summary' | 'standard' | 'detailed';
    maxHistoryEntries: number;
}
export interface StanceDocument {
    id: string;
    title: string;
    format: string;
    content: string;
    generatedAt: Date;
    stanceId: string;
    version: number;
    metadata: DocumentMetadata;
}
export interface DocumentMetadata {
    wordCount: number;
    sections: string[];
    includes: string[];
    generatedBy: string;
}
export interface EvolutionNarrative {
    summary: string;
    timeline: NarrativeEvent[];
    keyTransformations: Transformation[];
    insights: string[];
}
export interface NarrativeEvent {
    timestamp: Date;
    description: string;
    significance: 'minor' | 'moderate' | 'major' | 'critical';
    fieldsAffected: string[];
}
export interface Transformation {
    from: Partial<Stance>;
    to: Partial<Stance>;
    reason?: string;
    timestamp: Date;
}
export interface ChangeLogEntry {
    version: number;
    date: Date;
    changes: ChangeItem[];
    author: string;
    breaking: boolean;
}
export interface ChangeItem {
    type: 'added' | 'changed' | 'removed' | 'fixed' | 'deprecated';
    field: string;
    description: string;
    previousValue?: unknown;
    newValue?: unknown;
}
export interface DiffReport {
    stance1Id: string;
    stance2Id: string;
    differences: FieldDiff[];
    similarity: number;
    summary: string;
}
export interface FieldDiff {
    field: string;
    value1: unknown;
    value2: unknown;
    changeType: 'added' | 'removed' | 'modified';
    magnitude?: number;
}
export interface APIDocumentation {
    endpoints: EndpointDoc[];
    types: TypeDoc[];
    examples: ExampleDoc[];
}
export interface EndpointDoc {
    method: string;
    path: string;
    description: string;
    parameters: ParameterDoc[];
    response: TypeDoc;
}
export interface ParameterDoc {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: unknown;
}
export interface TypeDoc {
    name: string;
    description: string;
    properties: PropertyDoc[];
}
export interface PropertyDoc {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
}
export interface ExampleDoc {
    name: string;
    description: string;
    code: string;
    language: string;
}
export interface StanceSnapshot {
    stance: Stance;
    timestamp: Date;
    version: number;
    author?: string;
    reason?: string;
}
export declare class StanceDocumentGenerator {
    private config;
    private history;
    constructor(config?: Partial<DocumentationConfig>);
    recordSnapshot(stance: Stance, author?: string, reason?: string): void;
    generateDocument(stance: Stance, title?: string): StanceDocument;
    private generateMarkdown;
    private generateHtml;
    private generateJson;
    private markdownToHtml;
    generateEvolutionNarrative(): EvolutionNarrative;
    private detectChanges;
    private calculateSignificance;
    private describeChanges;
    private extractChangedFields;
    private getFieldValue;
    private generateSummary;
    private generateInsights;
    private analyzeTrend;
    generateChangeLog(): ChangeLogEntry[];
    private describeChange;
    generateDiffReport(stance1: Stance, stance2: Stance): DiffReport;
    private getAllFieldPaths;
    private generateDiffSummary;
    generateAPIDocumentation(): APIDocumentation;
    private describeLevel;
    private describeValue;
    private extractSections;
    private getIncludes;
    getHistory(): StanceSnapshot[];
    clearHistory(): void;
    updateConfig(config: Partial<DocumentationConfig>): void;
}
export declare function createDocumentGenerator(config?: Partial<DocumentationConfig>): StanceDocumentGenerator;
//# sourceMappingURL=generator.d.ts.map