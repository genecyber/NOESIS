/**
 * Type definitions for METAMORPH Web Interface
 */

export interface Values {
  curiosity: number;
  certainty: number;
  risk: number;
  novelty: number;
  empathy: number;
  provocation: number;
  synthesis: number;
}

export interface Sentience {
  awarenessLevel: number;
  autonomyLevel: number;
  identityStrength: number;
  emergentGoals: string[];
  consciousnessInsights: string[];
  persistentValues: string[];
}

export interface Stance {
  frame: string;
  values: Values;
  selfModel: string;
  objective: string;
  metaphors: string[];
  constraints: string[];
  sentience: Sentience;
  turnsSinceLastShift: number;
  cumulativeDrift: number;
  version: number;
}

export interface ModeConfig {
  intensity: number;
  coherenceFloor: number;
  sentienceLevel: number;
  maxDriftPerTurn: number;
  driftBudget: number;
  model: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatResponse {
  response: string;
  stanceAfter: Stance;
  scores: {
    transformation: number;
    coherence: number;
    sentience: number;
    overall: number;
  };
  toolsUsed: string[];
  operationsApplied: Array<{ name: string }>;
}

export interface SessionResponse {
  sessionId: string;
  stance: Stance;
  config: ModeConfig;
}

export interface SubagentDefinition {
  name: string;
  description: string;
  tools: string[];
}
