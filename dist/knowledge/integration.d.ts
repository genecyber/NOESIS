/**
 * Knowledge Base Integration
 *
 * Connect to external ontologies and knowledge graphs
 * for frame enrichment and semantic relationship mapping.
 */
import type { Stance, Frame } from '../types/index.js';
export interface KnowledgeSource {
    id: string;
    name: string;
    type: SourceType;
    endpoint?: string;
    config: SourceConfig;
    status: 'active' | 'inactive' | 'error';
    lastSync?: Date;
}
export type SourceType = 'ontology' | 'knowledge-graph' | 'taxonomy' | 'thesaurus' | 'custom';
export interface SourceConfig {
    apiKey?: string;
    format: 'json-ld' | 'rdf' | 'owl' | 'custom';
    refreshInterval?: number;
    maxEntities?: number;
}
export interface Entity {
    id: string;
    uri?: string;
    label: string;
    type: EntityType;
    description?: string;
    properties: Record<string, unknown>;
    relationships: Relationship[];
    source: string;
}
export type EntityType = 'concept' | 'person' | 'organization' | 'event' | 'place' | 'thing' | 'abstract';
export interface Relationship {
    type: RelationType;
    targetId: string;
    targetLabel: string;
    weight: number;
    bidirectional: boolean;
}
export type RelationType = 'is-a' | 'part-of' | 'related-to' | 'opposite-of' | 'causes' | 'influenced-by' | 'similar-to' | 'derived-from';
export interface FrameEnrichment {
    frame: Frame;
    concepts: EnrichedConcept[];
    relatedFrames: FrameRelation[];
    semanticContext: SemanticContext;
}
export interface EnrichedConcept {
    entity: Entity;
    relevance: number;
    contribution: 'core' | 'supporting' | 'tangential';
}
export interface FrameRelation {
    frame: Frame;
    relationship: RelationType;
    strength: number;
    reasoning: string;
}
export interface SemanticContext {
    domains: string[];
    themes: string[];
    philosophicalTraditions: string[];
    culturalContexts: string[];
}
export interface EntityResolution {
    query: string;
    candidates: ResolvedEntity[];
    bestMatch?: ResolvedEntity;
    confidence: number;
}
export interface ResolvedEntity {
    entity: Entity;
    score: number;
    matchType: 'exact' | 'partial' | 'semantic';
    disambiguationHints: string[];
}
export interface ConceptExpansion {
    seed: Entity;
    expanded: Entity[];
    depth: number;
    relationshipsExplored: number;
}
export interface InferenceResult {
    query: string;
    inferences: Inference[];
    confidence: number;
    reasoning: string[];
}
export interface Inference {
    statement: string;
    type: 'factual' | 'probabilistic' | 'analogical';
    confidence: number;
    supportingEntities: string[];
}
export interface KnowledgeInjection {
    stanceField: keyof Stance | string;
    entities: Entity[];
    context: string;
    impact: InjectionImpact;
}
export interface InjectionImpact {
    enrichmentLevel: 'minimal' | 'moderate' | 'significant';
    affectedAreas: string[];
    newInsights: string[];
}
export declare class KnowledgeIntegrationManager {
    private sources;
    private entities;
    private frameEnrichments;
    constructor();
    private initializeBuiltInKnowledge;
    private computeFrameEnrichment;
    private computeRelatedFrames;
    private inferDomains;
    private inferCulturalContexts;
    addSource(source: Omit<KnowledgeSource, 'id' | 'status'>): KnowledgeSource;
    removeSource(sourceId: string): boolean;
    getSources(): KnowledgeSource[];
    resolveEntity(query: string): EntityResolution;
    linkEntity(entityId: string, targetId: string, relationType: RelationType): boolean;
    expandConcept(entityId: string, depth?: number): ConceptExpansion | null;
    inferFromContext(query: string, context: Entity[]): InferenceResult;
    enrichFrame(frame: Frame): FrameEnrichment;
    injectKnowledge(stance: Stance, concepts: string[]): KnowledgeInjection;
    addEntity(entity: Omit<Entity, 'id'>): Entity;
    getEntity(id: string): Entity | undefined;
    searchEntities(query: string, type?: EntityType): Entity[];
    getSemanticMap(frame: Frame): Record<string, Entity[]>;
}
export declare function createKnowledgeManager(): KnowledgeIntegrationManager;
//# sourceMappingURL=integration.d.ts.map