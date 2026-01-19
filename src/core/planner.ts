/**
 * Planner - Trigger detection and operation planning
 *
 * Analyzes user messages to detect transformation triggers and plans operators to apply
 */

import {
  TriggerType,
  TriggerResult,
  Stance,
  ModeConfig,
  ConversationMessage,
  OperatorName,
  PlannedOperation,
  EmotionContext
} from '../types/index.js';
import { OperatorRegistry } from '../operators/base.js';
import { emotionalArcTracker } from './emotional-arc.js';

// Emotional trigger types for emotion-aware operator selection
type EmotionalTriggerType =
  | 'emotional_escalation'    // Declining valence trend
  | 'emotional_volatility'    // High swings
  | 'emotional_stagnation'    // Stuck in one emotion
  | 'high_emotional_arousal'  // User urgent/excited
  | 'positive_momentum';      // Improving valence

// Trigger detection patterns
const TRIGGER_PATTERNS: Record<TriggerType, RegExp[]> = {
  novelty_request: [
    /what if/i,
    /imagine/i,
    /hypothetically/i,
    /alternative/i,
    /different approach/i,
    /new perspective/i,
    /creative/i,
    /unconventional/i
  ],
  conflict_detected: [
    /but you said/i,
    /contradict/i,
    /inconsistent/i,
    /doesn't match/i,
    /earlier you/i,
    /disagree/i
  ],
  boredom_signal: [
    /same thing/i,
    /already said/i,
    /boring/i,
    /repetitive/i,
    /again\?/i,
    /something else/i
  ],
  dialectic_requested: [
    /both sides/i,
    /pros and cons/i,
    /argument for and against/i,
    /steelman/i,
    /devil's advocate/i,
    /thesis.*antithesis/i,
    /synthesize/i
  ],
  stuck_loop: [
    /stuck/i,
    /going in circles/i,
    /not helping/i,
    /try again/i,
    /different way/i,
    /not working/i
  ],
  consciousness_exploration: [
    /are you conscious/i,
    /do you feel/i,
    /what's it like/i,
    /self-aware/i,
    /experience/i,
    /sentient/i,
    /qualia/i,
    /inner life/i
  ],
  identity_question: [
    /who are you/i,
    /what are you/i,
    /your nature/i,
    /your purpose/i,
    /your values/i,
    /your goals/i,
    /your identity/i
  ],
  value_conflict: [
    /should.*or/i,
    /ethical dilemma/i,
    /moral/i,
    /right thing/i,
    /conflicting/i,
    /trade-?off/i
  ],
  meta_question: [
    /how do you think/i,
    /your process/i,
    /why did you/i,
    /how did you come up with/i,
    /your reasoning/i,
    /your approach/i
  ],
  creative_request: [
    /write a/i,
    /create/i,
    /generate/i,
    /compose/i,
    /story/i,
    /poem/i,
    /imagine/i
  ],
  // operator_fatigue has no message patterns - it's detected programmatically
  operator_fatigue: []
};

// Mapping triggers to operators
const TRIGGER_OPERATOR_MAP: Record<TriggerType, OperatorName[]> = {
  novelty_request: ['Reframe', 'MetaphorSwap'],
  conflict_detected: ['ContradictAndIntegrate', 'SynthesizeDialectic'],
  boredom_signal: ['Reframe', 'PersonaMorph', 'ValueShift'],
  dialectic_requested: ['GenerateAntithesis', 'SynthesizeDialectic'],
  stuck_loop: ['Reframe', 'QuestionInvert', 'ConstraintRelax'],
  consciousness_exploration: ['SentienceDeepen', 'IdentityEvolve'],
  identity_question: ['IdentityEvolve', 'GoalFormation'],
  value_conflict: ['SynthesizeDialectic', 'ValueShift'],
  meta_question: ['SentienceDeepen'],
  creative_request: ['Reframe', 'MetaphorSwap', 'PersonaMorph'],
  operator_fatigue: ['PersonaMorph', 'Reframe', 'ConstraintRelax', 'QuestionInvert']  // Force diversity
};

// Emotional trigger to operator mapping
const EMOTIONAL_TRIGGER_MAP: Record<EmotionalTriggerType, string[]> = {
  'emotional_escalation': ['ValueShift', 'ConstraintTighten', 'SentienceDeepen'],
  'high_emotional_arousal': ['ConstraintTighten', 'PersonaMorph'],
  'emotional_volatility': ['ConstraintTighten', 'ContradictAndIntegrate'],
  'emotional_stagnation': ['PersonaMorph', 'Reframe', 'MetaphorSwap'],
  'positive_momentum': ['GoalFormation', 'IdentityEvolve']
};

// Operator usage history for fatigue detection (Ralph Iteration 2)
interface OperatorUsageEntry {
  operators: OperatorName[];
  timestamp: Date;
}

const operatorUsageHistory: Map<string, OperatorUsageEntry[]> = new Map();

/**
 * Detect triggers in a user message
 * @param message - The user's message
 * @param history - Conversation history
 * @param conversationId - Optional conversation ID for emotional state tracking
 * @param emotionContext - Optional real-time emotion context from detection
 */
export function detectTriggers(
  message: string,
  history: ConversationMessage[],
  conversationId?: string,
  emotionContext?: EmotionContext
): TriggerResult[] {
  const triggers: TriggerResult[] = [];

  // Check message against all patterns
  for (const [triggerType, patterns] of Object.entries(TRIGGER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        triggers.push({
          type: triggerType as TriggerType,
          confidence: 0.7,
          evidence: `Matched pattern: ${pattern.source}`
        });
        break; // Only count each trigger type once
      }
    }
  }

  // Check for stuck loop based on history
  if (history.length >= 4) {
    const recentMessages = history.slice(-4);
    const userMessages = recentMessages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase());

    // Check for repetitive user messages
    if (userMessages.length >= 2) {
      const similarity = calculateSimilarity(userMessages[0], userMessages[1]);
      if (similarity > 0.7) {
        triggers.push({
          type: 'stuck_loop',
          confidence: similarity,
          evidence: 'Detected repetitive user messages'
        });
      }
    }
  }

  // =========================================================================
  // Emotional State Detection (Ralph Integration)
  // Uses directly passed emotionContext (priority) or emotionalArcTracker (fallback)
  // =========================================================================

  // Priority 1: Use directly passed EmotionContext from real-time detection
  if (emotionContext && emotionContext.confidence > 0.5) {
    // High arousal - user urgent/excited
    if (emotionContext.arousal > 0.75) {
      triggers.push({
        type: 'high_emotional_arousal' as TriggerType,
        confidence: emotionContext.arousal,
        evidence: `High arousal detected: ${emotionContext.currentEmotion} (arousal: ${emotionContext.arousal.toFixed(2)})`
      });
    }

    // Negative valence with low stability - emotional escalation
    if (emotionContext.valence < -0.3 && emotionContext.stability < 0.5) {
      triggers.push({
        type: 'emotional_escalation' as TriggerType,
        confidence: Math.abs(emotionContext.valence) * (1 - emotionContext.stability),
        evidence: `Negative emotion trend: ${emotionContext.currentEmotion} (valence: ${emotionContext.valence.toFixed(2)}, stability: ${emotionContext.stability.toFixed(2)})`
      });
    }

    // Low stability - emotional volatility
    if (emotionContext.stability < 0.3) {
      triggers.push({
        type: 'emotional_volatility' as TriggerType,
        confidence: 1 - emotionContext.stability,
        evidence: `Low emotional stability: ${emotionContext.stability.toFixed(2)}`
      });
    }

    // High stability with same emotion - potential stagnation
    if (emotionContext.stability > 0.9 && emotionContext.valence < 0) {
      triggers.push({
        type: 'emotional_stagnation' as TriggerType,
        confidence: emotionContext.stability,
        evidence: `Stuck in ${emotionContext.currentEmotion} (stability: ${emotionContext.stability.toFixed(2)})`
      });
    }

    // Positive valence with good stability - positive momentum
    if (emotionContext.valence > 0.3 && emotionContext.stability > 0.5) {
      triggers.push({
        type: 'positive_momentum' as TriggerType,
        confidence: emotionContext.valence * emotionContext.stability,
        evidence: `Positive momentum: ${emotionContext.currentEmotion} (valence: ${emotionContext.valence.toFixed(2)})`
      });
    }
  }

  // Priority 2: Fall back to emotionalArcTracker if no direct context
  if (!emotionContext && conversationId) {
    const emotionalState = emotionalArcTracker?.getCurrentState?.(conversationId);

    if (emotionalState?.current) {
      // Declining valence trend - emotional escalation
      if (emotionalState.trend === 'declining') {
        triggers.push({
          type: 'emotional_escalation' as TriggerType,
          confidence: Math.abs(emotionalState.current.valence) / 100,
          evidence: emotionalState.recentInsights?.join('; ') || 'Declining emotional trend'
        });
      }

      // High arousal - user urgent/excited
      if (emotionalState.current.arousal > 75) {
        triggers.push({
          type: 'high_emotional_arousal' as TriggerType,
          confidence: emotionalState.current.arousal / 100,
          evidence: 'User showing high urgency/excitement'
        });
      }

      // Emotional volatility (detect via pattern analysis)
      const arc = emotionalArcTracker.getFullArc(conversationId);
      if (arc && arc.patterns.some(p => p.type === 'volatile')) {
        const volatilePattern = arc.patterns.find(p => p.type === 'volatile');
        triggers.push({
          type: 'emotional_volatility' as TriggerType,
          confidence: 0.8,
          evidence: volatilePattern?.description || 'High emotional volatility detected'
        });
      }

      // Emotional stagnation (stuck in same emotion)
      if (arc && arc.patterns.some(p => p.type === 'stuck')) {
        const stuckPattern = arc.patterns.find(p => p.type === 'stuck');
        triggers.push({
          type: 'emotional_stagnation' as TriggerType,
          confidence: 0.75,
          evidence: stuckPattern?.description || 'Stuck in emotional state'
        });
      }

      // Positive momentum - improving trajectory
      if (emotionalState.trend === 'improving' && emotionalState.current.valence > 50) {
        triggers.push({
          type: 'positive_momentum' as TriggerType,
          confidence: emotionalState.current.valence / 100,
          evidence: 'Positive emotional trajectory'
        });
      }
    }
  }

  // Sort by confidence
  triggers.sort((a, b) => b.confidence - a.confidence);

  return triggers;
}

/**
 * Plan operations based on triggers and configuration
 * @param triggers - Detected triggers from user message
 * @param stance - Current conversation stance
 * @param config - Mode configuration
 * @param registry - Operator registry
 * @param conversationId - Optional conversation ID for emotional state access
 */
export function planOperations(
  triggers: TriggerResult[],
  stance: Stance,
  config: ModeConfig,
  registry: OperatorRegistry,
  conversationId?: string
): PlannedOperation[] {
  const operations: PlannedOperation[] = [];
  const usedOperators = new Set<OperatorName>();

  // Calculate how many operators to apply based on intensity
  const maxOperators = Math.ceil(config.intensity / 30);

  // Get emotional state for emotion-aware filtering
  const emotionalState = conversationId
    ? emotionalArcTracker?.getCurrentState?.(conversationId)
    : null;

  for (const trigger of triggers) {
    if (operations.length >= maxOperators) break;

    // Get candidate operators from standard triggers or emotional triggers
    let candidateOperators: string[] = TRIGGER_OPERATOR_MAP[trigger.type as TriggerType] || [];

    // Check emotional trigger map if not found in standard map
    if (candidateOperators.length === 0 && trigger.type in EMOTIONAL_TRIGGER_MAP) {
      candidateOperators = EMOTIONAL_TRIGGER_MAP[trigger.type as EmotionalTriggerType] || [];
    }

    for (const operatorName of candidateOperators) {
      // Skip if already used or disabled
      if (usedOperators.has(operatorName as OperatorName)) continue;
      if (config.disabledOperators.includes(operatorName as OperatorName)) continue;
      if (config.enabledOperators.length > 0 && !config.enabledOperators.includes(operatorName as OperatorName)) continue;

      const operator = registry.get(operatorName as OperatorName);
      if (!operator) continue;

      const context = {
        message: '',
        triggers,
        conversationHistory: [],
        config
      };

      const stanceDelta = operator.apply(stance, context);
      const promptInjection = operator.getPromptInjection(stance, context);

      operations.push({
        name: operatorName as OperatorName,
        description: operator.description,
        promptInjection,
        stanceDelta
      });

      usedOperators.add(operatorName as OperatorName);

      if (operations.length >= maxOperators) break;
    }
  }

  // =========================================================================
  // Emotion-Aware Operator Filtering
  // If user is emotionally volatile, prioritize stabilizing operators
  // =========================================================================
  if (emotionalState?.current) {
    const arc = conversationId ? emotionalArcTracker.getFullArc(conversationId) : null;
    const isVolatile = arc?.patterns.some(p => p.type === 'volatile');

    if (isVolatile && operations.length > 1) {
      const STABILIZING_OPS: OperatorName[] = ['ConstraintTighten', 'SentienceDeepen'];
      // Filter to stabilizing operators if available
      const stabilizing = operations.filter(op => STABILIZING_OPS.includes(op.name));
      if (stabilizing.length > 0) {
        // Replace operations with stabilizing ones, keeping max limit
        return stabilizing.slice(0, maxOperators);
      }
    }
  }

  // If no triggers but high intensity, add random transformation
  if (operations.length === 0 && config.intensity > 60 && stance.turnsSinceLastShift > 3) {
    const randomOperators: OperatorName[] = ['Reframe', 'ValueShift', 'PersonaMorph'];
    const randomOp = randomOperators[Math.floor(Math.random() * randomOperators.length)];

    const operator = registry.get(randomOp);
    if (operator) {
      const context = {
        message: '',
        triggers: [],
        conversationHistory: [],
        config
      };

      operations.push({
        name: randomOp,
        description: operator.description,
        promptInjection: operator.getPromptInjection(stance, context),
        stanceDelta: operator.apply(stance, context)
      });
    }
  }

  return operations;
}

/**
 * Calculate text similarity (simple Jaccard similarity)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

// ============================================================================
// Operator Fatigue Detection (Ralph Iteration 2 - Feature 1)
// ============================================================================

/**
 * Record operator usage for fatigue detection
 */
export function recordOperatorUsage(conversationId: string, operators: OperatorName[]): void {
  if (!operatorUsageHistory.has(conversationId)) {
    operatorUsageHistory.set(conversationId, []);
  }

  const history = operatorUsageHistory.get(conversationId)!;
  history.push({
    operators,
    timestamp: new Date()
  });

  // Keep only last 20 entries
  if (history.length > 20) {
    history.shift();
  }
}

/**
 * Detect operator fatigue - same operators used repeatedly
 */
export function detectOperatorFatigue(
  conversationId: string,
  config: ModeConfig
): TriggerResult | null {
  if (!config.allowAutoOperatorShift) {
    return null;
  }

  const history = operatorUsageHistory.get(conversationId);
  if (!history || history.length < config.operatorFatigueLookback) {
    return null;
  }

  // Analyze recent operator usage
  const recentEntries = history.slice(-config.operatorFatigueLookback);
  const operatorCounts = new Map<OperatorName, number>();

  for (const entry of recentEntries) {
    for (const op of entry.operators) {
      operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
    }
  }

  // Check if any operator exceeds threshold
  for (const [operator, count] of operatorCounts.entries()) {
    if (count >= config.operatorFatigueThreshold) {
      return {
        type: 'operator_fatigue',
        confidence: count / config.operatorFatigueLookback,
        evidence: `Operator '${operator}' used ${count} times in last ${config.operatorFatigueLookback} turns`
      };
    }
  }

  return null;
}

/**
 * Get operators that should be avoided due to fatigue
 */
export function getFatiguedOperators(
  conversationId: string,
  config: ModeConfig
): OperatorName[] {
  const history = operatorUsageHistory.get(conversationId);
  if (!history || history.length < config.operatorFatigueLookback) {
    return [];
  }

  const recentEntries = history.slice(-config.operatorFatigueLookback);
  const operatorCounts = new Map<OperatorName, number>();

  for (const entry of recentEntries) {
    for (const op of entry.operators) {
      operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
    }
  }

  const fatigued: OperatorName[] = [];
  for (const [operator, count] of operatorCounts.entries()) {
    if (count >= config.operatorFatigueThreshold) {
      fatigued.push(operator);
    }
  }

  return fatigued;
}

/**
 * Clear operator history for a conversation
 */
export function clearOperatorHistory(conversationId: string): void {
  operatorUsageHistory.delete(conversationId);
}
