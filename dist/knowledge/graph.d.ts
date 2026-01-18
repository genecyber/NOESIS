/**
 * External Knowledge Graph Integration (Ralph Iteration 7, Feature 3)
 *
 * Connect to external knowledge graphs (Wikidata, DBpedia, custom),
 * automatic entity linking, graph-based reasoning, and caching.
 */
import type { ConversationMessage } from '../types/index.js';
export interface KnowledgeGraphConfig {
    primarySource: KnowledgeSource;
    fallbackSources: KnowledgeSource[];
    cacheTTL: number;
    maxCacheSize: number;
    entityLinkingThreshold: number;
    maxHops: number;
    enableAutoLinking: boolean;
}
export type KnowledgeSource = 'wikidata' | 'dbpedia' | 'custom';
export interface Entity {
    id: string;
    label: string;
    description?: string;
    aliases: string[];
    types: string[];
    source: KnowledgeSource;
    properties: Map<string, PropertyValue[]>;
    lastUpdated: Date;
}
export interface PropertyValue {
    value: string | number | boolean | EntityReference;
    qualifiers?: Map<string, string>;
    references?: string[];
}
export interface EntityReference {
    entityId: string;
    label: string;
}
export interface EntityLink {
    text: string;
    startIndex: number;
    endIndex: number;
    entity: Entity;
    confidence: number;
}
export interface GraphQuery {
    type: 'entity' | 'relation' | 'path' | 'neighbors';
    subject?: string;
    predicate?: string;
    object?: string;
    maxDepth?: number;
    limit?: number;
}
export interface GraphQueryResult {
    query: GraphQuery;
    results: Entity[] | Relation[] | Path[];
    source: KnowledgeSource;
    cached: boolean;
    executionTime: number;
}
export interface Relation {
    subject: Entity;
    predicate: string;
    object: Entity;
    confidence: number;
}
export interface Path {
    nodes: Entity[];
    edges: Relation[];
    length: number;
}
export interface ReasoningResult {
    query: string;
    inference: string;
    supportingFacts: Relation[];
    confidence: number;
    reasoning: string[];
}
export interface KnowledgeGraphStats {
    cachedEntities: number;
    cacheHitRate: number;
    queriesExecuted: number;
    avgQueryTime: number;
    entitiesLinked: number;
    lastSync: Date | null;
}
export declare class KnowledgeGraphClient {
    private config;
    private entityCache;
    private queryCache;
    private stats;
    private lastSync;
    private customEntities;
    private customRelations;
    constructor(config?: Partial<KnowledgeGraphConfig>);
    /**
     * Connect to knowledge graph source
     */
    connect(source: KnowledgeSource): Promise<boolean>;
    /**
     * Query entity by ID or label
     */
    queryEntity(identifier: string, source?: KnowledgeSource): Promise<Entity | null>;
    /**
     * Fetch entity from source (mock implementation)
     */
    private fetchEntity;
    /**
     * Execute a graph query
     */
    query(graphQuery: GraphQuery): Promise<GraphQueryResult>;
    /**
     * Find relations matching criteria
     */
    private findRelations;
    /**
     * Get neighboring entities
     */
    private getNeighbors;
    /**
     * Find paths between entities
     */
    private findPaths;
    /**
     * Link entities in conversation messages
     */
    linkEntities(messages: ConversationMessage[]): Promise<EntityLink[]>;
    /**
     * Calculate confidence for entity linking
     */
    private calculateLinkConfidence;
    /**
     * Graph-based reasoning
     */
    reason(query: string): Promise<ReasoningResult>;
    /**
     * Add custom entity
     */
    addEntity(entity: Omit<Entity, 'source' | 'lastUpdated'>): Entity;
    /**
     * Add custom relation
     */
    addRelation(subjectId: string, predicate: string, objectId: string, confidence?: number): Relation | null;
    /**
     * Sync with external source
     */
    sync(): Promise<{
        added: number;
        updated: number;
        errors: number;
    }>;
    /**
     * Get from cache
     */
    private getFromCache;
    /**
     * Set cache entry
     */
    private setCache;
    /**
     * Evict least-used cache entries
     */
    private evictCache;
    /**
     * Get statistics
     */
    getStats(): KnowledgeGraphStats;
    /**
     * Clear caches
     */
    clearCache(): void;
    /**
     * Export state
     */
    export(): {
        customEntities: Array<Entity>;
        customRelations: Array<{
            subjectId: string;
            predicate: string;
            objectId: string;
            confidence: number;
        }>;
    };
    /**
     * Import state
     */
    import(data: ReturnType<KnowledgeGraphClient['export']>): void;
}
export declare const knowledgeGraph: KnowledgeGraphClient;
//# sourceMappingURL=graph.d.ts.map