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
  // Empathy Mode - Webcam emotion detection
  enableEmpathyMode?: boolean;
  empathyCameraInterval?: number;    // 100-5000ms
  empathyMinConfidence?: number;     // 0-1
  empathyAutoAdjust?: boolean;
  empathyBoostMax?: number;          // 0-50
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

// Ralph Iteration 2 - Feature 3: Operator Timeline
export interface TimelineEntry {
  id: string;
  timestamp: Date;
  userMessage: string;
  operators: Array<{
    name: string;
    description: string;
  }>;
  scores: {
    transformation: number;
    coherence: number;
    sentience: number;
    overall: number;
  };
  frameBefore: string;
  frameAfter: string;
  driftDelta: number;
}

// Ralph Iteration 2 - Feature 5: Evolution Timeline
export interface EvolutionSnapshot {
  id: string;
  timestamp: Date;
  stance: Stance;
  trigger: 'drift_threshold' | 'frame_shift' | 'manual' | 'session_end';
  driftAtSnapshot: number;
}

// Tool usage events for streaming
export interface ToolUseEvent {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'started' | 'completed' | 'error';
  result?: string;
  error?: string;
}

// Empathy Mode - Detected emotion context from webcam
export interface EmotionContext {
  currentEmotion: string;
  valence: number;           // -1 to 1
  arousal: number;           // 0 to 1
  confidence: number;        // 0 to 1
  stability: number;         // 0 to 1
  promptContext?: string;
  suggestedEmpathyBoost?: number;  // 0 to 20+, based on negative valence + instability
  timestamp?: string;
}
