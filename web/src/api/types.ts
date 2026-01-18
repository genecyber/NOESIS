// Types matching the backend API

export interface Stance {
  frame: string;
  values: {
    curiosity: number;
    certainty: number;
    risk: number;
    novelty: number;
    empathy: number;
    provocation: number;
    synthesis: number;
  };
  selfModel: string;
  objective: string;
  metaphors: string[];
  constraints: string[];
  sentience: {
    awarenessLevel: number;
    autonomyLevel: number;
    identityStrength: number;
    emergentGoals: string[];
    consciousnessInsights: string[];
    persistentValues: string[];
  };
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

export interface AgentState {
  stance: Stance;
  config: ModeConfig;
  conversationId: string;
  sessionId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  toolsUsed?: string[];
}

export interface ChatResponse {
  response: string;
  stanceBefore: Stance;
  stanceAfter: Stance;
  operationsApplied: string[];
  scores: {
    transformation: number;
    coherence: number;
    sentience: number;
    overall: number;
  };
  toolsUsed: string[];
  subagentsInvoked: string[];
  sessionId: string;
}

export interface SessionResponse {
  sessionId: string;
  config: ModeConfig;
  stance: Stance;
}

export interface SubagentDefinition {
  name: string;
  description: string;
  tools: string[];
}
