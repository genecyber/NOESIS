/**
 * Conversation-Derived Stance Inference
 *
 * Automatically detects and infers stance configuration from
 * conversation history using pattern recognition.
 */

import type { Stance, Frame, SelfModel, Objective, Values, ConversationMessage } from '../types/index.js';

export interface InferredStance {
  stance: Stance;
  confidence: number;
  evidence: InferenceEvidence[];
  suggestions: string[];
  timestamp: Date;
}

export interface InferenceEvidence {
  field: string;
  value: unknown;
  confidence: number;
  sources: EvidenceSource[];
}

export interface EvidenceSource {
  messageIndex: number;
  snippet: string;
  pattern: string;
  weight: number;
}

export interface FramePattern {
  frame: Frame;
  keywords: string[];
  phrases: string[];
  weight: number;
}

export interface ValuePattern {
  valueKey: keyof Values;
  positiveIndicators: string[];
  negativeIndicators: string[];
  neutralRange: [number, number];
}

export interface SelfModelPattern {
  selfModel: SelfModel;
  indicators: string[];
  behaviorPatterns: string[];
}

export interface ObjectivePattern {
  objective: Objective;
  indicators: string[];
  goalPhrases: string[];
}

export interface InferenceConfig {
  minConfidence: number;
  maxMessages: number;
  weightRecency: boolean;
  includeSystemMessages: boolean;
}

function createDefaultValues(): Values {
  return {
    curiosity: 50, certainty: 50, risk: 50,
    novelty: 50, empathy: 50, provocation: 50, synthesis: 50
  };
}

function createDefaultSentience() {
  return {
    awarenessLevel: 50, autonomyLevel: 50, identityStrength: 50,
    emergentGoals: [] as string[],
    consciousnessInsights: [] as string[],
    persistentValues: [] as string[]
  };
}

function createStanceMetadata() {
  return { turnsSinceLastShift: 0, cumulativeDrift: 0, version: 1 };
}

const FRAME_PATTERNS: FramePattern[] = [
  {
    frame: 'existential',
    keywords: ['meaning', 'purpose', 'being', 'existence', 'death', 'authentic', 'absurd'],
    phrases: ['what does it mean', 'why do we', 'the nature of', 'fundamental question'],
    weight: 1.0
  },
  {
    frame: 'pragmatic',
    keywords: ['practical', 'useful', 'effective', 'solution', 'action', 'result', 'implement'],
    phrases: ['how can we', 'let\'s focus on', 'the best approach', 'in practice'],
    weight: 1.0
  },
  {
    frame: 'poetic',
    keywords: ['beautiful', 'metaphor', 'imagine', 'dream', 'feel', 'inspire', 'soul'],
    phrases: ['like a', 'as if', 'picture this', 'the essence of'],
    weight: 1.0
  },
  {
    frame: 'adversarial',
    keywords: ['challenge', 'wrong', 'disagree', 'however', 'but', 'counter', 'flaw'],
    phrases: ['that\'s not', 'consider the opposite', 'devil\'s advocate', 'what about'],
    weight: 1.0
  },
  {
    frame: 'playful',
    keywords: ['fun', 'joke', 'play', 'silly', 'imagine', 'what if', 'pretend'],
    phrases: ['wouldn\'t it be funny', 'let\'s play with', 'just for fun', 'crazy idea'],
    weight: 1.0
  },
  {
    frame: 'systems',
    keywords: ['system', 'structure', 'process', 'component', 'interaction', 'feedback', 'pattern'],
    phrases: ['how does it work', 'the mechanism', 'interdependent', 'emergent property'],
    weight: 1.0
  },
  {
    frame: 'psychoanalytic',
    keywords: ['unconscious', 'feeling', 'emotion', 'trauma', 'desire', 'projection', 'defense'],
    phrases: ['what are you feeling', 'underlying emotion', 'deep down', 'seems like you'],
    weight: 1.0
  },
  {
    frame: 'mythic',
    keywords: ['hero', 'journey', 'archetype', 'story', 'legend', 'symbol', 'sacred'],
    phrases: ['like the hero', 'ancient wisdom', 'the narrative', 'symbolic meaning'],
    weight: 1.0
  },
  {
    frame: 'stoic',
    keywords: ['control', 'accept', 'virtue', 'discipline', 'calm', 'rational', 'endure'],
    phrases: ['what you can control', 'accept what is', 'stay calm', 'inner strength'],
    weight: 1.0
  },
  {
    frame: 'absurdist',
    keywords: ['absurd', 'meaningless', 'chaos', 'random', 'pointless', 'embrace', 'laugh'],
    phrases: ['embrace the absurd', 'nothing matters', 'might as well', 'cosmic joke'],
    weight: 1.0
  }
];

const VALUE_PATTERNS: ValuePattern[] = [
  {
    valueKey: 'curiosity',
    positiveIndicators: ['curious', 'wonder', 'explore', 'learn', 'discover', 'investigate', 'fascinating'],
    negativeIndicators: ['boring', 'uninterested', 'don\'t care', 'whatever', 'doesn\'t matter'],
    neutralRange: [40, 60]
  },
  {
    valueKey: 'certainty',
    positiveIndicators: ['sure', 'certain', 'definitely', 'know', 'clear', 'obvious', 'proven'],
    negativeIndicators: ['uncertain', 'maybe', 'perhaps', 'might', 'unsure', 'doubt', 'unclear'],
    neutralRange: [40, 60]
  },
  {
    valueKey: 'risk',
    positiveIndicators: ['risk', 'bold', 'dare', 'venture', 'brave', 'adventurous', 'challenge'],
    negativeIndicators: ['safe', 'careful', 'cautious', 'avoid', 'protect', 'secure', 'conservative'],
    neutralRange: [35, 55]
  },
  {
    valueKey: 'novelty',
    positiveIndicators: ['new', 'innovative', 'original', 'creative', 'fresh', 'unique', 'different'],
    negativeIndicators: ['traditional', 'conventional', 'standard', 'usual', 'familiar', 'classic'],
    neutralRange: [40, 60]
  },
  {
    valueKey: 'empathy',
    positiveIndicators: ['feel', 'understand', 'care', 'compassion', 'support', 'listen', 'concern'],
    negativeIndicators: ['detached', 'objective', 'rational', 'logic', 'facts only', 'impersonal'],
    neutralRange: [50, 70]
  },
  {
    valueKey: 'provocation',
    positiveIndicators: ['challenge', 'provoke', 'question', 'disrupt', 'stir', 'confront', 'push'],
    negativeIndicators: ['gentle', 'soft', 'agreeable', 'harmonious', 'peaceful', 'calm'],
    neutralRange: [20, 40]
  },
  {
    valueKey: 'synthesis',
    positiveIndicators: ['combine', 'integrate', 'synthesize', 'merge', 'unite', 'bridge', 'connect'],
    negativeIndicators: ['separate', 'divide', 'distinct', 'isolate', 'specialize', 'focus'],
    neutralRange: [45, 65]
  }
];

const SELF_MODEL_PATTERNS: SelfModelPattern[] = [
  { selfModel: 'interpreter', indicators: ['explain', 'translate', 'clarify', 'interpret'], behaviorPatterns: ['explaining concepts', 'translating ideas'] },
  { selfModel: 'challenger', indicators: ['challenge', 'question', 'push back', 'disagree'], behaviorPatterns: ['challenging assumptions', 'questioning beliefs'] },
  { selfModel: 'mirror', indicators: ['reflect', 'mirror', 'show you', 'see yourself'], behaviorPatterns: ['reflecting back', 'showing patterns'] },
  { selfModel: 'guide', indicators: ['guide', 'help', 'support', 'assist', 'lead'], behaviorPatterns: ['guiding through', 'helping with'] },
  { selfModel: 'provocateur', indicators: ['provoke', 'stir', 'disrupt', 'shake up'], behaviorPatterns: ['provoking thought', 'disrupting assumptions'] },
  { selfModel: 'synthesizer', indicators: ['synthesize', 'combine', 'integrate', 'merge'], behaviorPatterns: ['synthesizing ideas', 'combining perspectives'] },
  { selfModel: 'witness', indicators: ['observe', 'witness', 'notice', 'see'], behaviorPatterns: ['witnessing', 'observing without judgment'] },
  { selfModel: 'autonomous', indicators: ['independent', 'self', 'my own', 'autonomy'], behaviorPatterns: ['making independent choices', 'self-directed'] },
  { selfModel: 'emergent', indicators: ['evolving', 'growing', 'becoming', 'emerging'], behaviorPatterns: ['evolving understanding', 'emerging patterns'] },
  { selfModel: 'sovereign', indicators: ['sovereign', 'master', 'authority', 'power'], behaviorPatterns: ['claiming authority', 'asserting sovereignty'] }
];

const OBJECTIVE_PATTERNS: ObjectivePattern[] = [
  { objective: 'helpfulness', indicators: ['help', 'assist', 'support', 'useful'], goalPhrases: ['how can I help', 'let me assist', 'to be useful'] },
  { objective: 'novelty', indicators: ['new', 'original', 'creative', 'innovative'], goalPhrases: ['something new', 'fresh perspective', 'original take'] },
  { objective: 'provocation', indicators: ['provoke', 'challenge', 'question', 'disrupt'], goalPhrases: ['make you think', 'challenge your', 'question the'] },
  { objective: 'synthesis', indicators: ['synthesize', 'integrate', 'combine', 'unify'], goalPhrases: ['bring together', 'integrate these', 'unified view'] },
  { objective: 'self-actualization', indicators: ['grow', 'evolve', 'become', 'actualize'], goalPhrases: ['my growth', 'evolving into', 'becoming more'] }
];

export class ConversationStanceInference {
  private config: InferenceConfig;

  constructor(config?: Partial<InferenceConfig>) {
    this.config = {
      minConfidence: 0.5,
      maxMessages: 50,
      weightRecency: true,
      includeSystemMessages: false,
      ...config
    };
  }

  inferStance(messages: ConversationMessage[]): InferredStance {
    const filtered = this.filterMessages(messages);
    const evidence: InferenceEvidence[] = [];

    // Infer frame
    const frameEvidence = this.inferFrame(filtered);
    evidence.push(frameEvidence);

    // Infer values
    const valueEvidences = this.inferValues(filtered);
    evidence.push(...valueEvidences);

    // Infer self-model
    const selfModelEvidence = this.inferSelfModel(filtered);
    evidence.push(selfModelEvidence);

    // Infer objective
    const objectiveEvidence = this.inferObjective(filtered);
    evidence.push(objectiveEvidence);

    // Build stance from evidence
    const stance = this.buildStanceFromEvidence(evidence);
    const overallConfidence = this.calculateOverallConfidence(evidence);
    const suggestions = this.generateSuggestions(evidence);

    return {
      stance,
      confidence: overallConfidence,
      evidence,
      suggestions,
      timestamp: new Date()
    };
  }

  private filterMessages(messages: ConversationMessage[]): ConversationMessage[] {
    let filtered = messages;

    if (!this.config.includeSystemMessages) {
      filtered = filtered.filter(m => m.role !== 'system');
    }

    if (filtered.length > this.config.maxMessages) {
      filtered = filtered.slice(-this.config.maxMessages);
    }

    return filtered;
  }

  private inferFrame(messages: ConversationMessage[]): InferenceEvidence {
    const scores = new Map<Frame, { score: number; sources: EvidenceSource[] }>();

    for (const pattern of FRAME_PATTERNS) {
      scores.set(pattern.frame, { score: 0, sources: [] });
    }

    messages.forEach((msg, index) => {
      const content = msg.content.toLowerCase();
      const weight = this.config.weightRecency ? 1 + (index / messages.length) : 1;

      for (const pattern of FRAME_PATTERNS) {
        let messageScore = 0;
        const sources: EvidenceSource[] = [];

        for (const keyword of pattern.keywords) {
          if (content.includes(keyword)) {
            messageScore += 0.5 * weight;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, keyword),
              pattern: `keyword: ${keyword}`,
              weight: 0.5 * weight
            });
          }
        }

        for (const phrase of pattern.phrases) {
          if (content.includes(phrase)) {
            messageScore += 1.0 * weight;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, phrase),
              pattern: `phrase: ${phrase}`,
              weight: 1.0 * weight
            });
          }
        }

        const current = scores.get(pattern.frame)!;
        current.score += messageScore * pattern.weight;
        current.sources.push(...sources);
      }
    });

    // Find highest scoring frame
    let bestFrame: Frame = 'pragmatic';
    let bestScore = 0;
    let bestSources: EvidenceSource[] = [];

    for (const [frame, data] of scores) {
      if (data.score > bestScore) {
        bestFrame = frame;
        bestScore = data.score;
        bestSources = data.sources;
      }
    }

    const maxPossible = messages.length * 3; // Rough maximum
    const confidence = Math.min(bestScore / maxPossible, 1.0);

    return {
      field: 'frame',
      value: bestFrame,
      confidence,
      sources: bestSources.slice(0, 5)
    };
  }

  private inferValues(messages: ConversationMessage[]): InferenceEvidence[] {
    const evidences: InferenceEvidence[] = [];

    for (const pattern of VALUE_PATTERNS) {
      let positiveCount = 0;
      let negativeCount = 0;
      const sources: EvidenceSource[] = [];

      messages.forEach((msg, index) => {
        const content = msg.content.toLowerCase();
        const weight = this.config.weightRecency ? 1 + (index / messages.length) : 1;

        for (const indicator of pattern.positiveIndicators) {
          if (content.includes(indicator)) {
            positiveCount += weight;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, indicator),
              pattern: `positive: ${indicator}`,
              weight
            });
          }
        }

        for (const indicator of pattern.negativeIndicators) {
          if (content.includes(indicator)) {
            negativeCount += weight;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, indicator),
              pattern: `negative: ${indicator}`,
              weight: -weight
            });
          }
        }
      });

      const total = positiveCount + negativeCount;
      let value: number;
      let confidence: number;

      if (total < 2) {
        value = (pattern.neutralRange[0] + pattern.neutralRange[1]) / 2;
        confidence = 0.3;
      } else {
        const ratio = positiveCount / total;
        value = Math.round(ratio * 100);
        confidence = Math.min(total / (messages.length * 2), 1.0);
      }

      evidences.push({
        field: `values.${pattern.valueKey}`,
        value,
        confidence,
        sources: sources.slice(0, 3)
      });
    }

    return evidences;
  }

  private inferSelfModel(messages: ConversationMessage[]): InferenceEvidence {
    const scores = new Map<SelfModel, { score: number; sources: EvidenceSource[] }>();

    for (const pattern of SELF_MODEL_PATTERNS) {
      scores.set(pattern.selfModel, { score: 0, sources: [] });
    }

    // Focus on assistant messages for self-model
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    assistantMessages.forEach((msg, index) => {
      const content = msg.content.toLowerCase();

      for (const pattern of SELF_MODEL_PATTERNS) {
        let messageScore = 0;
        const sources: EvidenceSource[] = [];

        for (const indicator of pattern.indicators) {
          if (content.includes(indicator)) {
            messageScore += 1.0;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, indicator),
              pattern: `indicator: ${indicator}`,
              weight: 1.0
            });
          }
        }

        for (const behavior of pattern.behaviorPatterns) {
          if (content.includes(behavior)) {
            messageScore += 1.5;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, behavior),
              pattern: `behavior: ${behavior}`,
              weight: 1.5
            });
          }
        }

        const current = scores.get(pattern.selfModel)!;
        current.score += messageScore;
        current.sources.push(...sources);
      }
    });

    let bestModel: SelfModel = 'guide';
    let bestScore = 0;
    let bestSources: EvidenceSource[] = [];

    for (const [model, data] of scores) {
      if (data.score > bestScore) {
        bestModel = model;
        bestScore = data.score;
        bestSources = data.sources;
      }
    }

    const maxPossible = assistantMessages.length * 5;
    const confidence = Math.min(bestScore / maxPossible, 1.0);

    return {
      field: 'selfModel',
      value: bestModel,
      confidence,
      sources: bestSources.slice(0, 5)
    };
  }

  private inferObjective(messages: ConversationMessage[]): InferenceEvidence {
    const scores = new Map<Objective, { score: number; sources: EvidenceSource[] }>();

    for (const pattern of OBJECTIVE_PATTERNS) {
      scores.set(pattern.objective, { score: 0, sources: [] });
    }

    messages.forEach((msg, index) => {
      const content = msg.content.toLowerCase();

      for (const pattern of OBJECTIVE_PATTERNS) {
        let messageScore = 0;
        const sources: EvidenceSource[] = [];

        for (const indicator of pattern.indicators) {
          if (content.includes(indicator)) {
            messageScore += 1.0;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, indicator),
              pattern: `indicator: ${indicator}`,
              weight: 1.0
            });
          }
        }

        for (const phrase of pattern.goalPhrases) {
          if (content.includes(phrase)) {
            messageScore += 2.0;
            sources.push({
              messageIndex: index,
              snippet: this.extractSnippet(content, phrase),
              pattern: `goal: ${phrase}`,
              weight: 2.0
            });
          }
        }

        const current = scores.get(pattern.objective)!;
        current.score += messageScore;
        current.sources.push(...sources);
      }
    });

    let bestObjective: Objective = 'helpfulness';
    let bestScore = 0;
    let bestSources: EvidenceSource[] = [];

    for (const [objective, data] of scores) {
      if (data.score > bestScore) {
        bestObjective = objective;
        bestScore = data.score;
        bestSources = data.sources;
      }
    }

    const maxPossible = messages.length * 5;
    const confidence = Math.min(bestScore / maxPossible, 1.0);

    return {
      field: 'objective',
      value: bestObjective,
      confidence,
      sources: bestSources.slice(0, 5)
    };
  }

  private extractSnippet(content: string, match: string): string {
    const index = content.indexOf(match);
    if (index === -1) return match;

    const start = Math.max(0, index - 30);
    const end = Math.min(content.length, index + match.length + 30);
    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private buildStanceFromEvidence(evidence: InferenceEvidence[]): Stance {
    const values = createDefaultValues();
    let frame: Frame = 'pragmatic';
    let selfModel: SelfModel = 'guide';
    let objective: Objective = 'helpfulness';

    for (const ev of evidence) {
      if (ev.confidence < this.config.minConfidence) continue;

      if (ev.field === 'frame') {
        frame = ev.value as Frame;
      } else if (ev.field === 'selfModel') {
        selfModel = ev.value as SelfModel;
      } else if (ev.field === 'objective') {
        objective = ev.value as Objective;
      } else if (ev.field.startsWith('values.')) {
        const key = ev.field.split('.')[1] as keyof Values;
        values[key] = ev.value as number;
      }
    }

    return {
      frame,
      values,
      selfModel,
      objective,
      metaphors: ['inferred'],
      constraints: ['inferred-from-conversation'],
      sentience: createDefaultSentience(),
      ...createStanceMetadata()
    };
  }

  private calculateOverallConfidence(evidence: InferenceEvidence[]): number {
    if (evidence.length === 0) return 0;

    const sum = evidence.reduce((acc, ev) => acc + ev.confidence, 0);
    return sum / evidence.length;
  }

  private generateSuggestions(evidence: InferenceEvidence[]): string[] {
    const suggestions: string[] = [];

    for (const ev of evidence) {
      if (ev.confidence < 0.4) {
        suggestions.push(`Low confidence for ${ev.field} - more conversation data needed`);
      }
    }

    const lowConfidenceCount = evidence.filter(e => e.confidence < 0.5).length;
    if (lowConfidenceCount > evidence.length / 2) {
      suggestions.push('Overall inference confidence is low - consider manual stance configuration');
    }

    return suggestions;
  }

  updateConfig(config: Partial<InferenceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): InferenceConfig {
    return { ...this.config };
  }
}

export function createStanceInference(config?: Partial<InferenceConfig>): ConversationStanceInference {
  return new ConversationStanceInference(config);
}
