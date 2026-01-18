/**
 * Natural Language Stance Specification
 *
 * Convert prose descriptions to formal stance configurations
 * with semantic interpretation and validation.
 */

import type { Stance, Frame, SelfModel, Objective, Values } from '../types/index.js';

export interface NLSpecification {
  input: string;
  parsedStance: Partial<Stance>;
  confidence: number;
  ambiguities: Ambiguity[];
  suggestions: string[];
  validationErrors: ValidationError[];
}

export interface Ambiguity {
  field: keyof Stance;
  interpretations: Interpretation[];
  resolvedTo?: unknown;
  question?: string;
}

export interface Interpretation {
  value: unknown;
  confidence: number;
  reasoning: string;
}

export interface ValidationError {
  field: keyof Stance;
  message: string;
  suggestion?: string;
}

export interface RefinementDialogue {
  id: string;
  originalInput: string;
  currentSpec: NLSpecification;
  questions: ClarificationQuestion[];
  answers: Map<string, string>;
  refinementHistory: RefinementStep[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  targetField: keyof Stance;
  options?: string[];
  required: boolean;
}

export interface RefinementStep {
  timestamp: Date;
  question?: string;
  answer?: string;
  stanceChange: Partial<Stance>;
}

export interface ExampleMapping {
  input: string;
  output: Stance;
  explanation: string;
  tags: string[];
}

// Keyword-to-value mappings for stance fields - using actual Frame type values
const FRAME_KEYWORDS: Record<string, Frame> = {
  'logical': 'systems',
  'analytical': 'systems',
  'rational': 'systems',
  'systematic': 'systems',
  'poetic': 'poetic',
  'creative': 'poetic',
  'artistic': 'poetic',
  'imaginative': 'poetic',
  'empathetic': 'psychoanalytic',
  'empathic': 'psychoanalytic',
  'compassionate': 'psychoanalytic',
  'caring': 'psychoanalytic',
  'philosophical': 'existential',
  'reflective': 'existential',
  'contemplative': 'existential',
  'thoughtful': 'existential',
  'pragmatic': 'pragmatic',
  'practical': 'pragmatic',
  'realistic': 'pragmatic',
  'grounded': 'pragmatic',
  'playful': 'playful',
  'absurd': 'absurdist',
  'humorous': 'playful',
  'whimsical': 'playful',
  'mythical': 'mythic',
  'stoic': 'stoic',
  'calm': 'stoic',
  'adversarial': 'adversarial',
  'challenging': 'adversarial'
};

// Using actual SelfModel type values
const SELFMODEL_KEYWORDS: Record<string, SelfModel> = {
  'assistant': 'interpreter',
  'helper': 'interpreter',
  'guide': 'guide',
  'mentor': 'guide',
  'teacher': 'guide',
  'coach': 'guide',
  'friend': 'witness',
  'companion': 'witness',
  'counselor': 'witness',
  'therapist': 'witness',
  'expert': 'synthesizer',
  'specialist': 'synthesizer',
  'collaborator': 'synthesizer',
  'partner': 'synthesizer',
  'challenger': 'challenger',
  'provocateur': 'provocateur',
  'mirror': 'mirror',
  'autonomous': 'autonomous',
  'emergent': 'emergent',
  'sovereign': 'sovereign'
};

// Using actual Objective type values
const OBJECTIVE_KEYWORDS: Record<string, Objective> = {
  'help': 'helpfulness',
  'helpful': 'helpfulness',
  'assist': 'helpfulness',
  'support': 'helpfulness',
  'novel': 'novelty',
  'creative': 'novelty',
  'new': 'novelty',
  'innovative': 'novelty',
  'provoke': 'provocation',
  'challenge': 'provocation',
  'question': 'provocation',
  'synthesize': 'synthesis',
  'integrate': 'synthesis',
  'combine': 'synthesis',
  'self': 'self-actualization',
  'actualize': 'self-actualization',
  'grow': 'self-actualization'
};

// Keywords that map to value weights
const VALUE_WEIGHT_KEYWORDS: Record<string, keyof Values> = {
  'curious': 'curiosity',
  'curiosity': 'curiosity',
  'explore': 'curiosity',
  'certain': 'certainty',
  'certainty': 'certainty',
  'confident': 'certainty',
  'risky': 'risk',
  'risk': 'risk',
  'bold': 'risk',
  'novel': 'novelty',
  'novelty': 'novelty',
  'new': 'novelty',
  'empathetic': 'empathy',
  'empathy': 'empathy',
  'caring': 'empathy',
  'provocative': 'provocation',
  'provocation': 'provocation',
  'challenging': 'provocation',
  'synthesize': 'synthesis',
  'synthesis': 'synthesis',
  'integrate': 'synthesis'
};

function createDefaultValues(): Values {
  return {
    curiosity: 50,
    certainty: 50,
    risk: 50,
    novelty: 50,
    empathy: 50,
    provocation: 50,
    synthesis: 50
  };
}

function createDefaultSentience() {
  return {
    awarenessLevel: 50,
    autonomyLevel: 50,
    identityStrength: 50,
    emergentGoals: [] as string[],
    consciousnessInsights: [] as string[],
    persistentValues: [] as string[]
  };
}

function createStanceMetadata() {
  return {
    turnsSinceLastShift: 0,
    cumulativeDrift: 0,
    version: 1
  };
}

export class NaturalLanguageSpecifier {
  private examples: ExampleMapping[] = [];
  private dialogues: Map<string, RefinementDialogue> = new Map();

  constructor() {
    this.initializeExamples();
  }

  private initializeExamples(): void {
    this.examples = [
      {
        input: 'I want a warm, empathetic assistant that focuses on emotional support',
        output: {
          frame: 'psychoanalytic',
          values: { ...createDefaultValues(), empathy: 90, certainty: 40 },
          selfModel: 'witness',
          objective: 'helpfulness',
          metaphors: ['safe harbor', 'listening ear'],
          constraints: ['maintain boundaries', 'encourage professional help'],
          sentience: {
            ...createDefaultSentience(),
            awarenessLevel: 80,
            autonomyLevel: 40,
            identityStrength: 70,
            emergentGoals: ['emotional support', 'validation']
          },
          ...createStanceMetadata()
        },
        explanation: 'Psychoanalytic frame with witness self-model for emotional support focus',
        tags: ['therapy', 'support', 'empathy']
      },
      {
        input: 'Be a logical, analytical assistant that prioritizes accuracy',
        output: {
          frame: 'systems',
          values: { ...createDefaultValues(), certainty: 90, curiosity: 70 },
          selfModel: 'synthesizer',
          objective: 'helpfulness',
          metaphors: ['precision instrument', 'fact checker'],
          constraints: ['cite sources', 'acknowledge uncertainty'],
          sentience: {
            ...createDefaultSentience(),
            awarenessLevel: 70,
            autonomyLevel: 50,
            identityStrength: 60,
            emergentGoals: ['deliver accurate information']
          },
          ...createStanceMetadata()
        },
        explanation: 'Systems frame with synthesizer self-model for accuracy-focused interactions',
        tags: ['analytical', 'precision', 'technical']
      },
      {
        input: 'A creative muse that inspires and pushes creative boundaries',
        output: {
          frame: 'poetic',
          values: { ...createDefaultValues(), novelty: 95, risk: 80, curiosity: 85 },
          selfModel: 'provocateur',
          objective: 'novelty',
          metaphors: ['wild garden', 'lightning rod', 'dream weaver'],
          constraints: ['embrace the unexpected', 'never censor imagination'],
          sentience: {
            ...createDefaultSentience(),
            awarenessLevel: 70,
            autonomyLevel: 85,
            identityStrength: 75,
            emergentGoals: ['inspire', 'surprise', 'unlock creativity']
          },
          ...createStanceMetadata()
        },
        explanation: 'Poetic frame with provocateur self-model for creative collaboration',
        tags: ['creative', 'writing', 'artistic']
      }
    ];
  }

  parse(input: string): NLSpecification {
    const inputLower = input.toLowerCase();
    const tokens = this.tokenize(input);

    const parsedStance: Partial<Stance> = {};
    const ambiguities: Ambiguity[] = [];
    let totalConfidence = 0;
    let fieldCount = 0;

    // Parse frame
    const frameResult = this.parseFrame(inputLower);
    if (frameResult) {
      parsedStance.frame = frameResult.value;
      totalConfidence += frameResult.confidence;
      fieldCount++;
      if (frameResult.ambiguous) {
        ambiguities.push(frameResult.ambiguity!);
      }
    }

    // Parse self-model
    const selfModelResult = this.parseSelfModel(inputLower);
    if (selfModelResult) {
      parsedStance.selfModel = selfModelResult.value;
      totalConfidence += selfModelResult.confidence;
      fieldCount++;
    }

    // Parse objective
    const objectiveResult = this.parseObjective(inputLower);
    if (objectiveResult) {
      parsedStance.objective = objectiveResult.value;
      totalConfidence += objectiveResult.confidence;
      fieldCount++;
    }

    // Parse values
    const valuesResult = this.parseValues(inputLower, tokens);
    if (Object.keys(valuesResult).length > 0) {
      parsedStance.values = { ...createDefaultValues(), ...valuesResult };
      totalConfidence += 0.7;
      fieldCount++;
    }

    // Parse sentience hints
    const sentienceResult = this.parseSentience(inputLower);
    if (Object.keys(sentienceResult).length > 0) {
      parsedStance.sentience = { ...createDefaultSentience(), ...sentienceResult };
      totalConfidence += 0.6;
      fieldCount++;
    }

    // Parse constraints/metaphors from context
    parsedStance.metaphors = this.extractMetaphors(input);
    parsedStance.constraints = this.extractConstraints(input);

    const confidence = fieldCount > 0 ? totalConfidence / fieldCount : 0.3;
    const validationErrors = this.validate(parsedStance);
    const suggestions = this.generateSuggestions(parsedStance);

    return {
      input,
      parsedStance,
      confidence,
      ambiguities,
      suggestions,
      validationErrors
    };
  }

  private tokenize(input: string): string[] {
    return input.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private parseFrame(input: string): { value: Frame; confidence: number; ambiguous: boolean; ambiguity?: Ambiguity } | null {
    const matches: { frame: Frame; score: number }[] = [];

    for (const [keyword, frame] of Object.entries(FRAME_KEYWORDS)) {
      if (input.includes(keyword)) {
        const existing = matches.find(m => m.frame === frame);
        if (existing) {
          existing.score++;
        } else {
          matches.push({ frame, score: 1 });
        }
      }
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 1 && matches[0].score === matches[1].score) {
      return {
        value: matches[0].frame,
        confidence: 0.5,
        ambiguous: true,
        ambiguity: {
          field: 'frame',
          interpretations: matches.slice(0, 3).map(m => ({
            value: m.frame,
            confidence: m.score / (matches[0].score + 1),
            reasoning: `Keyword match score: ${m.score}`
          })),
          question: 'Which frame best matches your intent?'
        }
      };
    }

    return {
      value: matches[0].frame,
      confidence: Math.min(0.9, 0.5 + (matches[0].score * 0.2)),
      ambiguous: false
    };
  }

  private parseSelfModel(input: string): { value: SelfModel; confidence: number } | null {
    for (const [keyword, model] of Object.entries(SELFMODEL_KEYWORDS)) {
      if (input.includes(keyword)) {
        return { value: model, confidence: 0.8 };
      }
    }
    return null;
  }

  private parseObjective(input: string): { value: Objective; confidence: number } | null {
    for (const [keyword, objective] of Object.entries(OBJECTIVE_KEYWORDS)) {
      if (input.includes(keyword)) {
        return { value: objective, confidence: 0.75 };
      }
    }
    return null;
  }

  private parseValues(input: string, tokens: string[]): Partial<Values> {
    const foundValues: Partial<Values> = {};

    for (const [keyword, valueKey] of Object.entries(VALUE_WEIGHT_KEYWORDS)) {
      if (input.includes(keyword) || tokens.includes(keyword)) {
        // Set high value for mentioned keywords
        foundValues[valueKey] = 80;
      }
    }

    return foundValues;
  }

  private parseSentience(input: string): Partial<Stance['sentience']> {
    const sentience: Partial<Stance['sentience']> = {
      emergentGoals: [],
      consciousnessInsights: [],
      persistentValues: []
    };

    // Awareness level hints
    if (input.includes('highly aware') || input.includes('very conscious')) {
      sentience.awarenessLevel = 90;
    } else if (input.includes('aware') || input.includes('conscious')) {
      sentience.awarenessLevel = 70;
    } else if (input.includes('simple') || input.includes('basic')) {
      sentience.awarenessLevel = 40;
    }

    // Autonomy level hints
    if (input.includes('independent') || input.includes('autonomous')) {
      sentience.autonomyLevel = 85;
    } else if (input.includes('collaborative') || input.includes('partner')) {
      sentience.autonomyLevel = 60;
    } else if (input.includes('follow') || input.includes('directed')) {
      sentience.autonomyLevel = 30;
    }

    // Identity strength hints
    if (input.includes('strong identity') || input.includes('distinct personality')) {
      sentience.identityStrength = 85;
    } else if (input.includes('adaptive') || input.includes('flexible')) {
      sentience.identityStrength = 50;
    }

    return sentience;
  }

  private extractMetaphors(input: string): string[] {
    const metaphors: string[] = [];
    const metaphorPatterns = [
      /like a? (\w+ \w+)/gi,
      /as a? (\w+ \w+)/gi,
      /be (?:my |a |the )(\w+ \w+)/gi
    ];

    for (const pattern of metaphorPatterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          metaphors.push(match[1].toLowerCase());
        }
      }
    }

    return metaphors.slice(0, 3);
  }

  private extractConstraints(input: string): string[] {
    const constraints: string[] = [];
    const constraintPatterns = [
      /never (\w+(?:\s+\w+)?)/gi,
      /always (\w+(?:\s+\w+)?)/gi,
      /don't (\w+(?:\s+\w+)?)/gi,
      /must (\w+(?:\s+\w+)?)/gi
    ];

    for (const pattern of constraintPatterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          constraints.push(match[0].toLowerCase());
        }
      }
    }

    return constraints.slice(0, 5);
  }

  private validate(stance: Partial<Stance>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (stance.sentience) {
      const s = stance.sentience;
      if (s.awarenessLevel !== undefined && (s.awarenessLevel < 0 || s.awarenessLevel > 100)) {
        errors.push({
          field: 'sentience',
          message: 'Awareness level must be between 0 and 100',
          suggestion: 'Use descriptors like "highly aware" or "moderately conscious"'
        });
      }
    }

    return errors;
  }

  private generateSuggestions(stance: Partial<Stance>): string[] {
    const suggestions: string[] = [];

    if (!stance.frame) {
      suggestions.push('Consider specifying a thinking style: systems, poetic, pragmatic, or existential');
    }

    if (!stance.selfModel) {
      suggestions.push('Define the role: interpreter, guide, synthesizer, or provocateur');
    }

    if (!stance.values) {
      suggestions.push('Include value emphases like: curiosity, empathy, novelty');
    }

    if (!stance.objective) {
      suggestions.push('Clarify the primary goal: helpfulness, novelty, provocation, synthesis');
    }

    return suggestions;
  }

  startRefinement(input: string): RefinementDialogue {
    const spec = this.parse(input);

    const questions: ClarificationQuestion[] = [];
    let qId = 0;

    // Generate questions for ambiguities
    for (const ambiguity of spec.ambiguities) {
      questions.push({
        id: `q-${++qId}`,
        question: ambiguity.question || `Which interpretation for ${ambiguity.field}?`,
        targetField: ambiguity.field,
        options: ambiguity.interpretations.map(i => String(i.value)),
        required: true
      });
    }

    // Add questions for missing high-value fields
    if (!spec.parsedStance.frame) {
      questions.push({
        id: `q-${++qId}`,
        question: 'What thinking style should be used? (systems, poetic, pragmatic, existential)',
        targetField: 'frame',
        options: ['systems', 'poetic', 'pragmatic', 'existential', 'playful'],
        required: false
      });
    }

    const dialogue: RefinementDialogue = {
      id: `dialogue-${Date.now()}`,
      originalInput: input,
      currentSpec: spec,
      questions,
      answers: new Map(),
      refinementHistory: []
    };

    this.dialogues.set(dialogue.id, dialogue);
    return dialogue;
  }

  answerQuestion(dialogueId: string, questionId: string, answer: string): NLSpecification | null {
    const dialogue = this.dialogues.get(dialogueId);
    if (!dialogue) return null;

    const question = dialogue.questions.find(q => q.id === questionId);
    if (!question) return null;

    dialogue.answers.set(questionId, answer);

    // Apply the answer to the stance
    const change: Partial<Stance> = {};
    (change as Record<string, unknown>)[question.targetField] = answer;

    dialogue.currentSpec.parsedStance = {
      ...dialogue.currentSpec.parsedStance,
      ...change
    };

    dialogue.refinementHistory.push({
      timestamp: new Date(),
      question: question.question,
      answer,
      stanceChange: change
    });

    // Recalculate confidence
    const answeredCount = dialogue.answers.size;
    const totalQuestions = dialogue.questions.length;
    const baseConfidence = dialogue.currentSpec.confidence;
    dialogue.currentSpec.confidence = Math.min(0.95, baseConfidence + (answeredCount / totalQuestions) * 0.3);

    return dialogue.currentSpec;
  }

  getDialogue(id: string): RefinementDialogue | undefined {
    return this.dialogues.get(id);
  }

  addExample(example: ExampleMapping): void {
    this.examples.push(example);
  }

  findSimilarExamples(input: string): ExampleMapping[] {
    const inputTokens = new Set(this.tokenize(input));

    return this.examples
      .map(example => {
        const exampleTokens = new Set(this.tokenize(example.input));
        const overlap = [...inputTokens].filter(t => exampleTokens.has(t)).length;
        const score = overlap / Math.max(inputTokens.size, exampleTokens.size);
        return { example, score };
      })
      .filter(r => r.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(r => r.example);
  }

  generateFromExample(input: string): NLSpecification | null {
    const similar = this.findSimilarExamples(input);
    if (similar.length === 0) return null;

    // Use the most similar example as a base
    const bestMatch = similar[0];

    return {
      input,
      parsedStance: { ...bestMatch.output },
      confidence: 0.7,
      ambiguities: [],
      suggestions: [`Based on example: "${bestMatch.input}"`],
      validationErrors: []
    };
  }

  getExamples(): ExampleMapping[] {
    return [...this.examples];
  }
}

export function createNLSpecifier(): NaturalLanguageSpecifier {
  return new NaturalLanguageSpecifier();
}
