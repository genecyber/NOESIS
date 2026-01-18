/**
 * External Knowledge Graph Integration (Ralph Iteration 7, Feature 3)
 *
 * Connect to external knowledge graphs (Wikidata, DBpedia, custom),
 * automatic entity linking, graph-based reasoning, and caching.
 */

import type { ConversationMessage } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeGraphConfig {
  primarySource: KnowledgeSource;
  fallbackSources: KnowledgeSource[];
  cacheTTL: number;  // milliseconds
  maxCacheSize: number;
  entityLinkingThreshold: number;  // 0-1 confidence
  maxHops: number;  // for graph traversal
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

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

// ============================================================================
// Knowledge Graph Client
// ============================================================================

export class KnowledgeGraphClient {
  private config: KnowledgeGraphConfig;
  private entityCache: Map<string, CacheEntry<Entity>> = new Map();
  private queryCache: Map<string, CacheEntry<GraphQueryResult>> = new Map();
  private stats: {
    cacheHits: number;
    cacheMisses: number;
    queriesExecuted: number;
    totalQueryTime: number;
    entitiesLinked: number;
  };
  private lastSync: Date | null = null;
  private customEntities: Map<string, Entity> = new Map();
  private customRelations: Relation[] = [];

  constructor(config: Partial<KnowledgeGraphConfig> = {}) {
    this.config = {
      primarySource: 'wikidata',
      fallbackSources: ['dbpedia'],
      cacheTTL: 24 * 60 * 60 * 1000,  // 24 hours
      maxCacheSize: 10000,
      entityLinkingThreshold: 0.7,
      maxHops: 3,
      enableAutoLinking: true,
      ...config
    };

    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      queriesExecuted: 0,
      totalQueryTime: 0,
      entitiesLinked: 0
    };
  }

  /**
   * Connect to knowledge graph source
   */
  async connect(source: KnowledgeSource): Promise<boolean> {
    // Simulate connection validation
    // In a real implementation, this would verify API access
    const endpoints: Record<KnowledgeSource, string> = {
      wikidata: 'https://query.wikidata.org/sparql',
      dbpedia: 'https://dbpedia.org/sparql',
      custom: 'local'
    };

    const endpoint = endpoints[source];
    if (!endpoint) return false;

    // For custom source, always succeed
    if (source === 'custom') return true;

    // For external sources, we'd normally test the connection
    // Here we just return true for demonstration
    return true;
  }

  /**
   * Query entity by ID or label
   */
  async queryEntity(identifier: string, source?: KnowledgeSource): Promise<Entity | null> {
    const startTime = Date.now();
    const cacheKey = `entity:${identifier}:${source || this.config.primarySource}`;

    // Check cache
    const cached = this.getFromCache<Entity>(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }
    this.stats.cacheMisses++;

    // Query source
    const entity = await this.fetchEntity(identifier, source || this.config.primarySource);

    if (entity) {
      this.setCache(cacheKey, entity);
    }

    this.stats.queriesExecuted++;
    this.stats.totalQueryTime += Date.now() - startTime;

    return entity;
  }

  /**
   * Fetch entity from source (mock implementation)
   */
  private async fetchEntity(identifier: string, source: KnowledgeSource): Promise<Entity | null> {
    // Check custom entities first
    if (source === 'custom' || this.customEntities.has(identifier)) {
      return this.customEntities.get(identifier) || null;
    }

    // Mock implementation - in reality, this would call external APIs
    // Simulating a basic entity structure
    const mockEntity: Entity = {
      id: identifier,
      label: identifier.replace(/_/g, ' '),
      description: `Entity from ${source}`,
      aliases: [],
      types: ['Thing'],
      source,
      properties: new Map(),
      lastUpdated: new Date()
    };

    return mockEntity;
  }

  /**
   * Execute a graph query
   */
  async query(graphQuery: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();
    const cacheKey = `query:${JSON.stringify(graphQuery)}`;

    // Check cache
    const cached = this.getFromCache<GraphQueryResult>(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return { ...cached, cached: true };
    }
    this.stats.cacheMisses++;

    let results: Entity[] | Relation[] | Path[] = [];

    switch (graphQuery.type) {
      case 'entity':
        if (graphQuery.subject) {
          const entity = await this.queryEntity(graphQuery.subject);
          results = entity ? [entity] : [];
        }
        break;

      case 'relation':
        results = await this.findRelations(
          graphQuery.subject,
          graphQuery.predicate,
          graphQuery.object
        );
        break;

      case 'neighbors':
        if (graphQuery.subject) {
          results = await this.getNeighbors(
            graphQuery.subject,
            graphQuery.maxDepth || 1
          );
        }
        break;

      case 'path':
        if (graphQuery.subject && graphQuery.object) {
          results = await this.findPaths(
            graphQuery.subject,
            graphQuery.object,
            graphQuery.maxDepth || this.config.maxHops
          );
        }
        break;
    }

    const queryResult: GraphQueryResult = {
      query: graphQuery,
      results,
      source: this.config.primarySource,
      cached: false,
      executionTime: Date.now() - startTime
    };

    this.setCache(cacheKey, queryResult);
    this.stats.queriesExecuted++;
    this.stats.totalQueryTime += queryResult.executionTime;

    return queryResult;
  }

  /**
   * Find relations matching criteria
   */
  private async findRelations(
    subject?: string,
    predicate?: string,
    object?: string
  ): Promise<Relation[]> {
    // Filter custom relations
    return this.customRelations.filter(r => {
      if (subject && r.subject.id !== subject) return false;
      if (predicate && r.predicate !== predicate) return false;
      if (object && r.object.id !== object) return false;
      return true;
    });
  }

  /**
   * Get neighboring entities
   */
  private async getNeighbors(entityId: string, depth: number): Promise<Entity[]> {
    const visited = new Set<string>();
    const neighbors: Entity[] = [];
    let frontier = [entityId];

    for (let d = 0; d < depth; d++) {
      const newFrontier: string[] = [];

      for (const id of frontier) {
        if (visited.has(id)) continue;
        visited.add(id);

        // Find connected entities
        for (const relation of this.customRelations) {
          if (relation.subject.id === id && !visited.has(relation.object.id)) {
            neighbors.push(relation.object);
            newFrontier.push(relation.object.id);
          }
          if (relation.object.id === id && !visited.has(relation.subject.id)) {
            neighbors.push(relation.subject);
            newFrontier.push(relation.subject.id);
          }
        }
      }

      frontier = newFrontier;
    }

    return neighbors;
  }

  /**
   * Find paths between entities
   */
  private async findPaths(
    startId: string,
    endId: string,
    maxDepth: number
  ): Promise<Path[]> {
    const paths: Path[] = [];

    const dfs = (
      currentId: string,
      targetId: string,
      visited: Set<string>,
      currentPath: { nodes: Entity[]; edges: Relation[] }
    ) => {
      if (currentPath.nodes.length > maxDepth) return;

      if (currentId === targetId) {
        paths.push({
          nodes: [...currentPath.nodes],
          edges: [...currentPath.edges],
          length: currentPath.edges.length
        });
        return;
      }

      for (const relation of this.customRelations) {
        if (relation.subject.id === currentId && !visited.has(relation.object.id)) {
          visited.add(relation.object.id);
          currentPath.nodes.push(relation.object);
          currentPath.edges.push(relation);

          dfs(relation.object.id, targetId, visited, currentPath);

          currentPath.nodes.pop();
          currentPath.edges.pop();
          visited.delete(relation.object.id);
        }
      }
    };

    const startEntity = await this.queryEntity(startId);
    if (startEntity) {
      dfs(startId, endId, new Set([startId]), { nodes: [startEntity], edges: [] });
    }

    return paths;
  }

  /**
   * Link entities in conversation messages
   */
  async linkEntities(messages: ConversationMessage[]): Promise<EntityLink[]> {
    if (!this.config.enableAutoLinking) return [];

    const links: EntityLink[] = [];

    for (const message of messages) {
      const text = message.content;

      // Simple entity detection: look for capitalized words and known entities
      const potentialEntities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

      for (const potential of potentialEntities) {
        const entity = await this.queryEntity(potential.replace(/\s+/g, '_'));

        if (entity) {
          const startIndex = text.indexOf(potential);
          links.push({
            text: potential,
            startIndex,
            endIndex: startIndex + potential.length,
            entity,
            confidence: this.calculateLinkConfidence(potential, entity)
          });
          this.stats.entitiesLinked++;
        }
      }
    }

    // Filter by threshold
    return links.filter(l => l.confidence >= this.config.entityLinkingThreshold);
  }

  /**
   * Calculate confidence for entity linking
   */
  private calculateLinkConfidence(text: string, entity: Entity): number {
    let confidence = 0.5;  // Base confidence

    // Exact label match
    if (entity.label.toLowerCase() === text.toLowerCase()) {
      confidence += 0.3;
    }

    // Alias match
    if (entity.aliases.some(a => a.toLowerCase() === text.toLowerCase())) {
      confidence += 0.2;
    }

    // Has description
    if (entity.description) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * Graph-based reasoning
   */
  async reason(query: string): Promise<ReasoningResult> {
    const reasoning: string[] = [];
    const supportingFacts: Relation[] = [];

    // Extract entities from query
    const entities = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    reasoning.push(`Identified entities: ${entities.join(', ')}`);

    // Find relevant relations
    for (const entityName of entities) {
      const entityId = entityName.replace(/\s+/g, '_');
      const relations = await this.findRelations(entityId);
      supportingFacts.push(...relations);
      reasoning.push(`Found ${relations.length} relations for ${entityName}`);
    }

    // Find paths between entities
    if (entities && entities.length >= 2) {
      const paths = await this.findPaths(
        entities[0]!.replace(/\s+/g, '_'),
        entities[1]!.replace(/\s+/g, '_'),
        this.config.maxHops
      );
      reasoning.push(`Found ${paths.length} paths between entities`);
    }

    // Generate inference
    const inference = supportingFacts.length > 0
      ? `Based on ${supportingFacts.length} facts: ${supportingFacts.slice(0, 3).map(f => `${f.subject.label} ${f.predicate} ${f.object.label}`).join('; ')}`
      : 'No supporting facts found in knowledge graph';

    return {
      query,
      inference,
      supportingFacts,
      confidence: Math.min(1, supportingFacts.length * 0.2),
      reasoning
    };
  }

  /**
   * Add custom entity
   */
  addEntity(entity: Omit<Entity, 'source' | 'lastUpdated'>): Entity {
    const fullEntity: Entity = {
      ...entity,
      source: 'custom',
      lastUpdated: new Date()
    };
    this.customEntities.set(entity.id, fullEntity);
    return fullEntity;
  }

  /**
   * Add custom relation
   */
  addRelation(subjectId: string, predicate: string, objectId: string, confidence: number = 1): Relation | null {
    const subject = this.customEntities.get(subjectId);
    const object = this.customEntities.get(objectId);

    if (!subject || !object) return null;

    const relation: Relation = {
      subject,
      predicate,
      object,
      confidence
    };

    this.customRelations.push(relation);
    return relation;
  }

  /**
   * Sync with external source
   */
  async sync(): Promise<{ added: number; updated: number; errors: number }> {
    // In a real implementation, this would sync with external APIs
    this.lastSync = new Date();
    return { added: 0, updated: 0, errors: 0 };
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = key.startsWith('entity:')
      ? this.entityCache.get(key) as CacheEntry<T> | undefined
      : this.queryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.cacheTTL) {
      if (key.startsWith('entity:')) {
        this.entityCache.delete(key);
      } else {
        this.queryCache.delete(key);
      }
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /**
   * Set cache entry
   */
  private setCache<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hits: 0
    };

    if (key.startsWith('entity:')) {
      // Evict if needed
      if (this.entityCache.size >= this.config.maxCacheSize) {
        this.evictCache(this.entityCache as Map<string, CacheEntry<unknown>>);
      }
      (this.entityCache as Map<string, CacheEntry<T>>).set(key, entry);
    } else {
      if (this.queryCache.size >= this.config.maxCacheSize) {
        this.evictCache(this.queryCache as Map<string, CacheEntry<unknown>>);
      }
      (this.queryCache as Map<string, CacheEntry<T>>).set(key, entry);
    }
  }

  /**
   * Evict least-used cache entries
   */
  private evictCache(cache: Map<string, CacheEntry<unknown>>): void {
    // Sort by hits and evict bottom 10%
    const entries = [...cache.entries()]
      .sort((a, b) => a[1].hits - b[1].hits);

    const toEvict = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      cache.delete(entries[i][0]);
    }
  }

  /**
   * Get statistics
   */
  getStats(): KnowledgeGraphStats {
    const totalQueries = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      cachedEntities: this.entityCache.size,
      cacheHitRate: totalQueries > 0 ? this.stats.cacheHits / totalQueries : 0,
      queriesExecuted: this.stats.queriesExecuted,
      avgQueryTime: this.stats.queriesExecuted > 0
        ? this.stats.totalQueryTime / this.stats.queriesExecuted
        : 0,
      entitiesLinked: this.stats.entitiesLinked,
      lastSync: this.lastSync
    };
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.entityCache.clear();
    this.queryCache.clear();
  }

  /**
   * Export state
   */
  export(): {
    customEntities: Array<Entity>;
    customRelations: Array<{ subjectId: string; predicate: string; objectId: string; confidence: number }>;
  } {
    return {
      customEntities: [...this.customEntities.values()],
      customRelations: this.customRelations.map(r => ({
        subjectId: r.subject.id,
        predicate: r.predicate,
        objectId: r.object.id,
        confidence: r.confidence
      }))
    };
  }

  /**
   * Import state
   */
  import(data: ReturnType<KnowledgeGraphClient['export']>): void {
    this.customEntities.clear();
    for (const entity of data.customEntities) {
      this.customEntities.set(entity.id, entity);
    }

    this.customRelations = [];
    for (const rel of data.customRelations) {
      this.addRelation(rel.subjectId, rel.predicate, rel.objectId, rel.confidence);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const knowledgeGraph = new KnowledgeGraphClient();
