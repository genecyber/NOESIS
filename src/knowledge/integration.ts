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

export type SourceType =
  | 'ontology'
  | 'knowledge-graph'
  | 'taxonomy'
  | 'thesaurus'
  | 'custom';

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

export type EntityType =
  | 'concept'
  | 'person'
  | 'organization'
  | 'event'
  | 'place'
  | 'thing'
  | 'abstract';

export interface Relationship {
  type: RelationType;
  targetId: string;
  targetLabel: string;
  weight: number;
  bidirectional: boolean;
}

export type RelationType =
  | 'is-a'
  | 'part-of'
  | 'related-to'
  | 'opposite-of'
  | 'causes'
  | 'influenced-by'
  | 'similar-to'
  | 'derived-from';

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

// Frame-to-concept mappings for enrichment
const FRAME_CONCEPT_MAP: Record<Frame, string[]> = {
  existential: ['existence', 'being', 'authenticity', 'freedom', 'mortality', 'meaning'],
  pragmatic: ['utility', 'practicality', 'efficiency', 'action', 'consequence'],
  poetic: ['beauty', 'metaphor', 'imagination', 'emotion', 'aesthetics', 'creativity'],
  adversarial: ['conflict', 'debate', 'opposition', 'challenge', 'critique'],
  playful: ['play', 'humor', 'spontaneity', 'joy', 'experiment'],
  mythic: ['archetype', 'narrative', 'hero', 'transformation', 'sacred'],
  systems: ['structure', 'pattern', 'emergence', 'feedback', 'complexity'],
  psychoanalytic: ['unconscious', 'desire', 'trauma', 'projection', 'transference'],
  stoic: ['virtue', 'acceptance', 'reason', 'discipline', 'equanimity'],
  absurdist: ['absurdity', 'paradox', 'rebellion', 'meaning', 'revolt']
};

// Philosophical traditions by frame
const FRAME_TRADITIONS: Record<Frame, string[]> = {
  existential: ['Existentialism', 'Phenomenology', 'Humanism'],
  pragmatic: ['Pragmatism', 'Instrumentalism', 'Functionalism'],
  poetic: ['Romanticism', 'Transcendentalism', 'Aestheticism'],
  adversarial: ['Dialectics', 'Critical Theory', 'Socratic Method'],
  playful: ['Dadaism', 'Situationism', 'Positive Psychology'],
  mythic: ['Jungian Psychology', 'Comparative Mythology', 'Perennial Philosophy'],
  systems: ['Systems Theory', 'Cybernetics', 'Complexity Science'],
  psychoanalytic: ['Psychoanalysis', 'Depth Psychology', 'Object Relations'],
  stoic: ['Stoicism', 'Virtue Ethics', 'Classical Philosophy'],
  absurdist: ['Absurdism', 'Nihilism', 'Postmodernism']
};

export class KnowledgeIntegrationManager {
  private sources: Map<string, KnowledgeSource> = new Map();
  private entities: Map<string, Entity> = new Map();
  private frameEnrichments: Map<Frame, FrameEnrichment> = new Map();

  constructor() {
    this.initializeBuiltInKnowledge();
  }

  private initializeBuiltInKnowledge(): void {
    // Create built-in entities for each frame's core concepts
    for (const [frame, concepts] of Object.entries(FRAME_CONCEPT_MAP)) {
      for (const concept of concepts) {
        const entity: Entity = {
          id: `builtin-${frame}-${concept}`,
          label: concept,
          type: 'concept',
          description: `Core concept for ${frame} frame`,
          properties: { frame, builtIn: true },
          relationships: [],
          source: 'builtin'
        };
        this.entities.set(entity.id, entity);
      }
    }

    // Pre-compute frame enrichments
    for (const frame of Object.keys(FRAME_CONCEPT_MAP) as Frame[]) {
      this.frameEnrichments.set(frame, this.computeFrameEnrichment(frame));
    }
  }

  private computeFrameEnrichment(frame: Frame): FrameEnrichment {
    const concepts = FRAME_CONCEPT_MAP[frame] || [];
    const traditions = FRAME_TRADITIONS[frame] || [];

    const enrichedConcepts: EnrichedConcept[] = concepts.map((concept, index) => ({
      entity: this.entities.get(`builtin-${frame}-${concept}`) || {
        id: `temp-${concept}`,
        label: concept,
        type: 'concept' as EntityType,
        properties: {},
        relationships: [],
        source: 'computed'
      },
      relevance: 1 - (index * 0.1),
      contribution: index < 2 ? 'core' : index < 4 ? 'supporting' : 'tangential'
    }));

    const relatedFrames: FrameRelation[] = this.computeRelatedFrames(frame);

    return {
      frame,
      concepts: enrichedConcepts,
      relatedFrames,
      semanticContext: {
        domains: this.inferDomains(frame),
        themes: concepts.slice(0, 3),
        philosophicalTraditions: traditions,
        culturalContexts: this.inferCulturalContexts(frame)
      }
    };
  }

  private computeRelatedFrames(frame: Frame): FrameRelation[] {
    const relations: FrameRelation[] = [];

    const frameRelationships: Record<Frame, { related: Frame; type: RelationType; strength: number }[]> = {
      existential: [
        { related: 'psychoanalytic', type: 'related-to', strength: 0.7 },
        { related: 'absurdist', type: 'derived-from', strength: 0.8 }
      ],
      pragmatic: [
        { related: 'systems', type: 'related-to', strength: 0.6 },
        { related: 'stoic', type: 'similar-to', strength: 0.5 }
      ],
      poetic: [
        { related: 'mythic', type: 'related-to', strength: 0.7 },
        { related: 'playful', type: 'similar-to', strength: 0.5 }
      ],
      adversarial: [
        { related: 'existential', type: 'related-to', strength: 0.5 },
        { related: 'absurdist', type: 'similar-to', strength: 0.4 }
      ],
      playful: [
        { related: 'poetic', type: 'related-to', strength: 0.6 },
        { related: 'absurdist', type: 'similar-to', strength: 0.5 }
      ],
      mythic: [
        { related: 'poetic', type: 'related-to', strength: 0.7 },
        { related: 'psychoanalytic', type: 'derived-from', strength: 0.6 }
      ],
      systems: [
        { related: 'pragmatic', type: 'related-to', strength: 0.6 },
        { related: 'stoic', type: 'similar-to', strength: 0.4 }
      ],
      psychoanalytic: [
        { related: 'existential', type: 'related-to', strength: 0.7 },
        { related: 'mythic', type: 'related-to', strength: 0.6 }
      ],
      stoic: [
        { related: 'pragmatic', type: 'similar-to', strength: 0.5 },
        { related: 'existential', type: 'related-to', strength: 0.4 }
      ],
      absurdist: [
        { related: 'existential', type: 'derived-from', strength: 0.8 },
        { related: 'playful', type: 'similar-to', strength: 0.5 }
      ]
    };

    const rels = frameRelationships[frame] || [];
    for (const rel of rels) {
      relations.push({
        frame: rel.related,
        relationship: rel.type,
        strength: rel.strength,
        reasoning: `${frame} and ${rel.related} share conceptual connections`
      });
    }

    return relations;
  }

  private inferDomains(frame: Frame): string[] {
    const domainMap: Record<Frame, string[]> = {
      existential: ['Philosophy', 'Psychology', 'Literature'],
      pragmatic: ['Engineering', 'Business', 'Problem-Solving'],
      poetic: ['Arts', 'Literature', 'Aesthetics'],
      adversarial: ['Law', 'Debate', 'Critical Analysis'],
      playful: ['Entertainment', 'Education', 'Design'],
      mythic: ['Religion', 'Anthropology', 'Narrative'],
      systems: ['Science', 'Technology', 'Management'],
      psychoanalytic: ['Psychology', 'Therapy', 'Self-understanding'],
      stoic: ['Ethics', 'Self-development', 'Leadership'],
      absurdist: ['Philosophy', 'Art', 'Comedy']
    };
    return domainMap[frame] || [];
  }

  private inferCulturalContexts(frame: Frame): string[] {
    const contextMap: Record<Frame, string[]> = {
      existential: ['Western European', 'Modern', 'Post-war'],
      pragmatic: ['American', 'Modern', 'Industrial'],
      poetic: ['Romantic Era', 'Cross-cultural', 'Artistic'],
      adversarial: ['Socratic', 'Legal', 'Academic'],
      playful: ['Contemporary', 'Counter-cultural', 'Youth'],
      mythic: ['Ancient', 'Cross-cultural', 'Religious'],
      systems: ['Contemporary', 'Scientific', 'Global'],
      psychoanalytic: ['Viennese', 'Modern', 'Clinical'],
      stoic: ['Greco-Roman', 'Classical', 'Military'],
      absurdist: ['Post-modern', 'European', 'Artistic']
    };
    return contextMap[frame] || [];
  }

  addSource(source: Omit<KnowledgeSource, 'id' | 'status'>): KnowledgeSource {
    const newSource: KnowledgeSource = {
      ...source,
      id: `source-${Date.now()}`,
      status: 'active'
    };
    this.sources.set(newSource.id, newSource);
    return newSource;
  }

  removeSource(sourceId: string): boolean {
    return this.sources.delete(sourceId);
  }

  getSources(): KnowledgeSource[] {
    return Array.from(this.sources.values());
  }

  resolveEntity(query: string): EntityResolution {
    const candidates: ResolvedEntity[] = [];
    const queryLower = query.toLowerCase();

    for (const entity of this.entities.values()) {
      const labelLower = entity.label.toLowerCase();

      if (labelLower === queryLower) {
        candidates.push({
          entity,
          score: 1.0,
          matchType: 'exact',
          disambiguationHints: []
        });
      } else if (labelLower.includes(queryLower) || queryLower.includes(labelLower)) {
        candidates.push({
          entity,
          score: 0.7,
          matchType: 'partial',
          disambiguationHints: [entity.description || '']
        });
      } else if (entity.description?.toLowerCase().includes(queryLower)) {
        candidates.push({
          entity,
          score: 0.4,
          matchType: 'semantic',
          disambiguationHints: [entity.description]
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    return {
      query,
      candidates: candidates.slice(0, 5),
      bestMatch: candidates[0],
      confidence: candidates[0]?.score || 0
    };
  }

  linkEntity(entityId: string, targetId: string, relationType: RelationType): boolean {
    const entity = this.entities.get(entityId);
    const target = this.entities.get(targetId);

    if (!entity || !target) return false;

    entity.relationships.push({
      type: relationType,
      targetId,
      targetLabel: target.label,
      weight: 0.5,
      bidirectional: false
    });

    return true;
  }

  expandConcept(entityId: string, depth: number = 2): ConceptExpansion | null {
    const seed = this.entities.get(entityId);
    if (!seed) return null;

    const expanded: Entity[] = [];
    const visited = new Set<string>([entityId]);
    let relationshipsExplored = 0;

    const queue: { entity: Entity; currentDepth: number }[] = [{ entity: seed, currentDepth: 0 }];

    while (queue.length > 0) {
      const { entity, currentDepth } = queue.shift()!;

      if (currentDepth >= depth) continue;

      for (const rel of entity.relationships) {
        relationshipsExplored++;

        if (!visited.has(rel.targetId)) {
          visited.add(rel.targetId);
          const related = this.entities.get(rel.targetId);

          if (related) {
            expanded.push(related);
            queue.push({ entity: related, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return {
      seed,
      expanded,
      depth,
      relationshipsExplored
    };
  }

  inferFromContext(query: string, context: Entity[]): InferenceResult {
    const inferences: Inference[] = [];
    const reasoning: string[] = [];

    // Simple inference based on entity relationships
    for (const entity of context) {
      for (const rel of entity.relationships) {
        if (rel.type === 'is-a') {
          inferences.push({
            statement: `${entity.label} is a type of ${rel.targetLabel}`,
            type: 'factual',
            confidence: rel.weight,
            supportingEntities: [entity.id, rel.targetId]
          });
          reasoning.push(`Derived from is-a relationship in knowledge base`);
        } else if (rel.type === 'related-to') {
          inferences.push({
            statement: `${entity.label} is related to ${rel.targetLabel}`,
            type: 'probabilistic',
            confidence: rel.weight * 0.8,
            supportingEntities: [entity.id, rel.targetId]
          });
          reasoning.push(`Inferred from related-to relationship`);
        }
      }
    }

    return {
      query,
      inferences,
      confidence: inferences.length > 0
        ? inferences.reduce((sum, i) => sum + i.confidence, 0) / inferences.length
        : 0,
      reasoning
    };
  }

  enrichFrame(frame: Frame): FrameEnrichment {
    // Return cached enrichment or compute new one
    let enrichment = this.frameEnrichments.get(frame);
    if (!enrichment) {
      enrichment = this.computeFrameEnrichment(frame);
      this.frameEnrichments.set(frame, enrichment);
    }
    return enrichment;
  }

  injectKnowledge(stance: Stance, concepts: string[]): KnowledgeInjection {
    const entities: Entity[] = [];

    for (const concept of concepts) {
      const resolution = this.resolveEntity(concept);
      if (resolution.bestMatch) {
        entities.push(resolution.bestMatch.entity);
      }
    }

    const enrichment = this.enrichFrame(stance.frame);
    const newInsights = entities
      .filter(e => !enrichment.concepts.some(c => c.entity.id === e.id))
      .map(e => `Added ${e.label} to ${stance.frame} context`);

    return {
      stanceField: 'frame',
      entities,
      context: `Knowledge injection for ${stance.frame} frame`,
      impact: {
        enrichmentLevel: newInsights.length > 2 ? 'significant' : newInsights.length > 0 ? 'moderate' : 'minimal',
        affectedAreas: ['frame', 'metaphors', 'constraints'],
        newInsights
      }
    };
  }

  addEntity(entity: Omit<Entity, 'id'>): Entity {
    const newEntity: Entity = {
      ...entity,
      id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    };
    this.entities.set(newEntity.id, newEntity);
    return newEntity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  searchEntities(query: string, type?: EntityType): Entity[] {
    const queryLower = query.toLowerCase();
    return Array.from(this.entities.values()).filter(e =>
      (e.label.toLowerCase().includes(queryLower) ||
       e.description?.toLowerCase().includes(queryLower)) &&
      (!type || e.type === type)
    );
  }

  getSemanticMap(frame: Frame): Record<string, Entity[]> {
    const enrichment = this.enrichFrame(frame);
    const map: Record<string, Entity[]> = {
      core: [],
      supporting: [],
      tangential: [],
      related: []
    };

    for (const concept of enrichment.concepts) {
      const category = concept.contribution;
      map[category].push(concept.entity);
    }

    return map;
  }
}

export function createKnowledgeManager(): KnowledgeIntegrationManager {
  return new KnowledgeIntegrationManager();
}
