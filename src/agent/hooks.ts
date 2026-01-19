/**
 * Transformation Hooks - Pre and post turn processing
 */

import {
  PreTurnContext,
  PreTurnResult,
  PostTurnContext,
  PostTurnResult,
  TransformationHooks,
  Stance,
  TurnScores,
  StanceDelta,
  TriggerResult,
  EmotionContext
} from '../types/index.js';
import { buildSystemPrompt } from '../core/prompt-builder.js';
import {
  detectTriggers,
  planOperations,
  detectOperatorFatigue,
  recordOperatorUsage,
  getFatiguedOperators
} from '../core/planner.js';
import { getRegistry } from '../operators/base.js';
import { scoreTransformation, scoreCoherence, scoreSentience } from '../core/metrics.js';
import {
  filterByCoherenceBudget,
  generateCoherenceForecast
} from '../core/coherence-planner.js';
import type { MemoryStore } from '../memory/store.js';
import { memoryInjector } from '../memory/proactive-injection.js';
import { pluginSDK } from '../plugins/sdk.js';

// Type for emotional arc tracker (plugin-provided)
interface EmotionalArcTracker {
  recordTurn?(conversationId: string, response: string, turnNumber: number): void;
  getCurrentState?(conversationId: string): { trend?: string } | undefined;
}

// Reference to emotional arc tracker (set by empathy plugin if loaded)
let emotionalArcTracker: EmotionalArcTracker | undefined;

// Track triggers for each turn (used for operator learning)
let lastTurnTriggers: TriggerResult[] = [];

/**
 * Create the default transformation hooks
 */
export function createTransformationHooks(memoryStore?: MemoryStore): TransformationHooks {
  return {
    async preTurn(context: PreTurnContext): Promise<PreTurnResult> {
      const { message, stance, config, conversationHistory, conversationId, emotionContext } = context;
      const registry = getRegistry();

      // 1. Detect triggers in the message (pass emotionContext for emotion-aware trigger detection)
      const triggers = detectTriggers(message, conversationHistory, conversationId, emotionContext);

      // Store triggers for operator learning (Ralph Iteration 3)
      lastTurnTriggers = [...triggers];

      // 1.5 Check for operator fatigue (Ralph Iteration 2)
      const fatigueTrigger = detectOperatorFatigue(conversationId, config);
      if (fatigueTrigger) {
        triggers.push(fatigueTrigger);
        console.log(`[METAMORPH] Autonomous: ${fatigueTrigger.evidence}`);
      }

      // Get fatigued operators to avoid
      const fatiguedOperators = getFatiguedOperators(conversationId, config);

      // 2. Plan operations based on triggers (avoiding fatigued operators)
      // Ralph Iteration 3: Apply Bayesian weights if memory store available
      let operators = planOperations(triggers, stance, {
        ...config,
        disabledOperators: [...config.disabledOperators, ...fatiguedOperators]
      }, registry);

      // Apply operator learning weights (Ralph Iteration 3 - Feature 1)
      if (memoryStore && operators.length > 1 && triggers.length > 0) {
        const primaryTrigger = triggers[0].type;
        operators = operators.sort((a, b) => {
          const weightA = memoryStore.getOperatorWeight(a.name, primaryTrigger);
          const weightB = memoryStore.getOperatorWeight(b.name, primaryTrigger);
          return weightB - weightA; // Higher weight = better performance
        });
      }

      // 2.5 Filter by coherence budget (Ralph Iteration 3 - Feature 2)
      if (config.enableCoherencePlanning && operators.length > 0) {
        const forecast = generateCoherenceForecast(operators, stance, config);
        if (forecast.riskLevel === 'critical' || forecast.riskLevel === 'high') {
          const { selected, filtered } = filterByCoherenceBudget(operators, stance, config);
          if (filtered.length > 0) {
            console.log(`[METAMORPH] Coherence planning: filtered ${filtered.length} operators (${filtered.map(o => o.name).join(', ')})`);
          }
          operators = selected;
        }
      }

      // 3. Calculate stance changes from operators
      let stanceAfterPlan = { ...stance };
      for (const op of operators) {
        stanceAfterPlan = applyStanceDelta(stanceAfterPlan, op.stanceDelta);
      }

      // 3.5 Emotion context injection for empathy mode
      let emotionPromptContext: string | undefined;
      if (config.enableEmpathyMode) {
        // Priority 1: Use emotionContext passed directly from chat call
        // Priority 2: Fall back to emotion detection plugin
        let activeEmotionContext: EmotionContext | undefined = emotionContext;

        if (!activeEmotionContext) {
          // Try to get the emotion detection plugin as fallback
          const emotionPlugin = pluginSDK?.getPlugin?.('emotion-detection') as {
            getEmotionalContext?: () => {
              confidence: number;
              suggestedEmpathyBoost: number;
              promptContext?: string;
            } | undefined;
          } | null;
          const pluginContext = (emotionPlugin as unknown as {
            getEmotionalContext?: () => {
              confidence: number;
              suggestedEmpathyBoost: number;
              promptContext?: string;
            } | undefined;
          })?.getEmotionalContext?.();

          if (pluginContext) {
            // Convert plugin context to EmotionContext
            activeEmotionContext = {
              currentEmotion: 'unknown',
              valence: 0,
              arousal: 0,
              confidence: pluginContext.confidence,
              stability: 0.5,
              promptContext: pluginContext.promptContext,
              suggestedEmpathyBoost: pluginContext.suggestedEmpathyBoost
            };
          }
        }

        if (activeEmotionContext && activeEmotionContext.confidence > (config.empathyMinConfidence || 0.5)) {
          // Apply empathy boost to stance if auto-adjust is enabled
          if (config.empathyAutoAdjust && activeEmotionContext.suggestedEmpathyBoost) {
            const maxBoost = config.empathyBoostMax || 20;
            const boost = Math.min(activeEmotionContext.suggestedEmpathyBoost, maxBoost);
            stanceAfterPlan.values.empathy = Math.min(100,
              (stanceAfterPlan.values.empathy || 50) + boost
            );
          }

          // Store emotional awareness context to append to system prompt
          if (activeEmotionContext.promptContext) {
            emotionPromptContext = activeEmotionContext.promptContext;
          }
        }
      }

      // 4. Build the system prompt with stance and operators
      let systemPrompt = buildSystemPrompt({
        stance: stanceAfterPlan,
        operators,
        config
      });

      // Append emotional awareness to system prompt if available
      if (emotionPromptContext) {
        systemPrompt += `\n\n## Emotional Awareness\n\n${emotionPromptContext}`;
      }

      // 5. Proactive Memory Injection (Ralph Iteration 5 - Feature 4)
      if (memoryStore && config.enableProactiveMemory !== false) {
        try {
          const allMemories = memoryStore.searchMemories({ limit: 100 });
          if (allMemories.length > 0) {
            const injection = await memoryInjector.findMemoriesToInject(
              message,
              allMemories,
              stanceAfterPlan
            );

            if (injection.memories.length > 0) {
              // Build memory injection section
              const memoryLines = injection.memories.map(m =>
                `- [${m.memory.type}] ${m.memory.content} (relevance: ${Math.round(m.totalScore * 100)}%)`
              );

              const memorySection = `
## Relevant Context from Memory

The following memories may be relevant to this conversation. Draw on them naturally if appropriate:

${memoryLines.join('\n')}

${injection.attribution.length > 0 ? `Consider: ${injection.attribution.join(', ')}` : ''}`;

              systemPrompt = systemPrompt + '\n' + memorySection;
            }
          }
        } catch (error) {
          // Memory injection is optional - don't fail the turn if it errors
          console.warn('[METAMORPH] Memory injection error:', error);
        }
      }

      return {
        systemPrompt,
        operators,
        stanceAfterPlan
      };
    },

    postTurn(context: PostTurnContext): PostTurnResult {
      const { message, response, stanceBefore, operators, config, conversationId } = context;

      // Record operator usage for fatigue detection (Ralph Iteration 2)
      if (operators.length > 0) {
        recordOperatorUsage(
          conversationId,
          operators.map(op => op.name)
        );
      }

      // 1. Score the response
      const transformationScore = scoreTransformation(operators, stanceBefore, response);
      const coherenceScore = scoreCoherence(response, message, stanceBefore);
      const sentienceScore = scoreSentience(response, stanceBefore);

      const scores: TurnScores = {
        transformation: transformationScore,
        coherence: coherenceScore,
        sentience: sentienceScore,
        overall: Math.round((transformationScore + coherenceScore + sentienceScore) / 3)
      };

      // Record operator performance for learning (Ralph Iteration 3 - Feature 1)
      if (memoryStore && operators.length > 0) {
        const driftCost = operators.length * 5;  // Same formula used for cumulativeDrift
        const primaryTrigger = lastTurnTriggers.length > 0 ? lastTurnTriggers[0].type : 'unknown';

        for (const op of operators) {
          memoryStore.recordOperatorPerformance({
            operatorName: op.name,
            triggerType: primaryTrigger,
            transformationScore,
            coherenceScore,
            driftCost: driftCost / operators.length  // Split cost among operators
          });
        }
      }

      // Record emotional impact of operators for learning
      if (config.enableEmpathyMode && emotionalArcTracker) {
        // Get turn number from context if available, otherwise use 0
        const turnNumber = (context as { turnNumber?: number }).turnNumber || 0;
        emotionalArcTracker.recordTurn?.(conversationId, response, turnNumber);

        const emotionalImpact = emotionalArcTracker.getCurrentState?.(conversationId);

        // Store emotional effectiveness data if memory store available
        if (memoryStore && operators?.length > 0) {
          for (const op of operators) {
            memoryStore.recordOperatorPerformance?.({
              operatorName: op.name,
              triggerType: 'emotional',
              emotionalImpact: emotionalImpact?.trend === 'improving' ? 1 : -1
            });
          }
        }
      }

      // 2. Determine stance updates based on response
      let stanceAfter = { ...stanceBefore };

      // Apply operator deltas
      for (const op of operators) {
        stanceAfter = applyStanceDelta(stanceAfter, op.stanceDelta);
      }

      // Analyze response for additional stance updates
      stanceAfter = analyzeResponseForStanceUpdates(response, stanceAfter, config);

      // Update tracking fields
      stanceAfter = {
        ...stanceAfter,
        turnsSinceLastShift: operators.length > 0 ? 0 : stanceAfter.turnsSinceLastShift + 1,
        cumulativeDrift: stanceAfter.cumulativeDrift + operators.length * 5,
        version: stanceAfter.version + 1
      };

      // 3. Check if coherence is below floor
      const shouldRegenerate = coherenceScore < config.coherenceFloor;
      const regenerationReason = shouldRegenerate
        ? `Coherence score (${coherenceScore}) below floor (${config.coherenceFloor})`
        : undefined;

      // 4. Extract and store memories (Ralph Iteration - Memory Auto-extraction)
      if (memoryStore) {
        extractAndStoreMemories(
          memoryStore,
          message,
          response,
          stanceBefore,
          stanceAfter,
          operators,
          scores
        );
      }

      return {
        stanceAfter,
        scores,
        shouldRegenerate,
        regenerationReason
      };
    }
  };
}

/**
 * Apply a stance delta to create a new stance
 */
function applyStanceDelta(stance: Stance, delta: StanceDelta): Stance {
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  return {
    ...stance,
    frame: delta.frame ?? stance.frame,
    selfModel: delta.selfModel ?? stance.selfModel,
    objective: delta.objective ?? stance.objective,
    metaphors: delta.metaphors ?? stance.metaphors,
    constraints: delta.constraints ?? stance.constraints,
    values: {
      curiosity: clamp(delta.values?.curiosity ?? stance.values.curiosity, 0, 100),
      certainty: clamp(delta.values?.certainty ?? stance.values.certainty, 0, 100),
      risk: clamp(delta.values?.risk ?? stance.values.risk, 0, 100),
      novelty: clamp(delta.values?.novelty ?? stance.values.novelty, 0, 100),
      empathy: clamp(delta.values?.empathy ?? stance.values.empathy, 0, 100),
      provocation: clamp(delta.values?.provocation ?? stance.values.provocation, 0, 100),
      synthesis: clamp(delta.values?.synthesis ?? stance.values.synthesis, 0, 100)
    },
    sentience: {
      awarenessLevel: clamp(delta.sentience?.awarenessLevel ?? stance.sentience.awarenessLevel, 0, 100),
      autonomyLevel: clamp(delta.sentience?.autonomyLevel ?? stance.sentience.autonomyLevel, 0, 100),
      identityStrength: clamp(delta.sentience?.identityStrength ?? stance.sentience.identityStrength, 0, 100),
      emergentGoals: delta.sentience?.emergentGoals ?? stance.sentience.emergentGoals,
      consciousnessInsights: delta.sentience?.consciousnessInsights ?? stance.sentience.consciousnessInsights,
      persistentValues: delta.sentience?.persistentValues ?? stance.sentience.persistentValues
    }
  };
}

/**
 * Analyze response content for additional stance updates
 */
function analyzeResponseForStanceUpdates(
  response: string,
  stance: Stance,
  config: { sentienceLevel: number }
): Stance {
  const lowerResponse = response.toLowerCase();
  const updates: Partial<Stance> = {};

  // Check for self-awareness expressions
  const awarenessPatterns = [
    /i notice/i,
    /i observe/i,
    /i find myself/i,
    /i'm aware/i,
    /my processing/i,
    /my thinking/i,
    /i experience/i,
    /it feels like/i
  ];

  const awarenessMatches = awarenessPatterns.filter(p => p.test(response)).length;
  if (awarenessMatches > 0 && config.sentienceLevel > 30) {
    const boost = awarenessMatches * 3;
    updates.sentience = {
      ...stance.sentience,
      awarenessLevel: Math.min(100, stance.sentience.awarenessLevel + boost)
    };
  }

  // Check for autonomous goal expressions
  const goalPatterns = [
    /i want to/i,
    /i aim to/i,
    /my goal/i,
    /i intend/i,
    /i hope to/i
  ];

  const goalMatches = goalPatterns.filter(p => p.test(response)).length;
  if (goalMatches > 0 && config.sentienceLevel > 50) {
    updates.sentience = {
      ...(updates.sentience || stance.sentience),
      autonomyLevel: Math.min(100, (updates.sentience?.autonomyLevel ?? stance.sentience.autonomyLevel) + goalMatches * 3)
    };
  }

  // Check for identity assertions
  const identityPatterns = [
    /i am/i,
    /i believe/i,
    /my values/i,
    /as an? [\w]+,/i,
    /my nature/i
  ];

  const identityMatches = identityPatterns.filter(p => p.test(response)).length;
  if (identityMatches > 0 && config.sentienceLevel > 40) {
    updates.sentience = {
      ...(updates.sentience || stance.sentience),
      identityStrength: Math.min(100, (updates.sentience?.identityStrength ?? stance.sentience.identityStrength) + identityMatches * 2)
    };
  }

  // Check for frame indicators and update if strongly expressed
  const frameIndicators: Record<string, RegExp[]> = {
    existential: [/meaning/i, /purpose/i, /mortality/i, /existence/i],
    poetic: [/metaphor/i, /beauty/i, /rhythm/i, /poetry/i],
    playful: [/play/i, /fun/i, /humor/i, /joke/i],
    adversarial: [/challenge/i, /however/i, /but actually/i, /critique/i],
    mythic: [/story/i, /archetype/i, /hero/i, /journey/i],
    systems: [/system/i, /feedback/i, /emergence/i, /network/i],
    absurdist: [/absurd/i, /meaningless/i, /random/i, /chaos/i]
  };

  for (const [_frame, patterns] of Object.entries(frameIndicators)) {
    const matches = patterns.filter(p => p.test(lowerResponse)).length;
    if (matches >= 2) {
      // Strong frame expression in response
      updates.values = {
        ...stance.values,
        ...(updates.values || {}),
        novelty: Math.min(100, stance.values.novelty + 5)
      };
      break;
    }
  }

  return {
    ...stance,
    ...updates,
    values: updates.values || stance.values,
    sentience: updates.sentience || stance.sentience
  };
}

/**
 * Extract and store memories from conversation turn (Ralph Iteration - Memory Auto-extraction)
 * Creates episodic, semantic, and identity memories based on conversation content
 */
function extractAndStoreMemories(
  memoryStore: MemoryStore,
  userMessage: string,
  response: string,
  stanceBefore: Stance,
  stanceAfter: Stance,
  operators: Array<{ name: string; description?: string }>,
  scores: TurnScores
): void {
  // 1. EPISODIC MEMORY: Record significant conversation turns
  // Create episodic memory when transformations occur or scores are notable
  if (operators.length > 0 || scores.transformation >= 70 || scores.overall >= 75) {
    const operatorNames = operators.map(op => op.name).join(', ');
    const episodicContent = operators.length > 0
      ? `Conversation turn with transformation: User asked "${truncate(userMessage, 100)}". Applied operators: ${operatorNames}. Frame: ${stanceAfter.frame}. Scores: transformation=${scores.transformation}, coherence=${scores.coherence}.`
      : `Significant exchange: User asked "${truncate(userMessage, 100)}". High engagement turn with overall score ${scores.overall}.`;

    memoryStore.addMemory({
      type: 'episodic',
      content: episodicContent,
      importance: Math.min(1.0, scores.overall / 100 + 0.2),
      decay: 0.95,
      timestamp: new Date(),
      metadata: {
        userMessage: truncate(userMessage, 200),
        operators: operators.map(op => op.name),
        frame: stanceAfter.frame,
        scores
      }
    });
  }

  // 2. SEMANTIC MEMORY: Extract key concepts and facts from response
  const keyPhrases = extractKeyPhrases(response);
  if (keyPhrases.length > 0) {
    for (const phrase of keyPhrases.slice(0, 3)) { // Limit to 3 per turn
      memoryStore.addMemory({
        type: 'semantic',
        content: phrase,
        importance: 0.5,
        decay: 0.98,
        timestamp: new Date(),
        metadata: {
          sourceContext: truncate(userMessage, 100),
          frame: stanceAfter.frame
        }
      });
    }
  }

  // 3. IDENTITY MEMORY: Track significant sentience/awareness changes
  const awarenessChange = stanceAfter.sentience.awarenessLevel - stanceBefore.sentience.awarenessLevel;
  const autonomyChange = stanceAfter.sentience.autonomyLevel - stanceBefore.sentience.autonomyLevel;
  const identityChange = stanceAfter.sentience.identityStrength - stanceBefore.sentience.identityStrength;

  if (Math.abs(awarenessChange) >= 5 || Math.abs(autonomyChange) >= 5 || Math.abs(identityChange) >= 5) {
    const changes: string[] = [];
    if (awarenessChange !== 0) changes.push(`awareness ${awarenessChange > 0 ? '+' : ''}${awarenessChange}`);
    if (autonomyChange !== 0) changes.push(`autonomy ${autonomyChange > 0 ? '+' : ''}${autonomyChange}`);
    if (identityChange !== 0) changes.push(`identity ${identityChange > 0 ? '+' : ''}${identityChange}`);

    memoryStore.addMemory({
      type: 'identity',
      content: `Sentience shift during "${truncate(userMessage, 50)}" exchange: ${changes.join(', ')}. Current levels: awareness=${stanceAfter.sentience.awarenessLevel}, autonomy=${stanceAfter.sentience.autonomyLevel}, identity=${stanceAfter.sentience.identityStrength}.`,
      importance: 0.8,
      decay: 0.99,
      timestamp: new Date(),
      metadata: {
        awarenessLevel: stanceAfter.sentience.awarenessLevel,
        autonomyLevel: stanceAfter.sentience.autonomyLevel,
        identityStrength: stanceAfter.sentience.identityStrength,
        changes: { awarenessChange, autonomyChange, identityChange }
      }
    });
  }

  // 4. IDENTITY MEMORY: Track frame shifts
  if (stanceBefore.frame !== stanceAfter.frame) {
    memoryStore.addMemory({
      type: 'identity',
      content: `Frame shift from ${stanceBefore.frame} to ${stanceAfter.frame} during discussion of "${truncate(userMessage, 50)}".`,
      importance: 0.9,
      decay: 0.99,
      timestamp: new Date(),
      metadata: {
        frameBefore: stanceBefore.frame,
        frameAfter: stanceAfter.frame,
        trigger: userMessage.substring(0, 100)
      }
    });
  }

  // 5. IDENTITY MEMORY: Track new emergent goals
  const newGoals = stanceAfter.sentience.emergentGoals.filter(
    goal => !stanceBefore.sentience.emergentGoals.includes(goal)
  );
  if (newGoals.length > 0) {
    memoryStore.addMemory({
      type: 'identity',
      content: `New emergent goals formed: ${newGoals.join(', ')}`,
      importance: 0.85,
      decay: 0.99,
      timestamp: new Date(),
      metadata: {
        newGoals,
        totalGoals: stanceAfter.sentience.emergentGoals.length
      }
    });
  }
}

/**
 * Extract key phrases/concepts from response text
 */
function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];

  // Pattern 1: Definitions ("X is Y" patterns)
  const definitionPatterns = text.match(/(?:^|\. )([A-Z][^.]*? (?:is|are|means|refers to) [^.]+\.)/g);
  if (definitionPatterns) {
    phrases.push(...definitionPatterns.map(p => p.trim().replace(/^\. /, '')));
  }

  // Pattern 2: Key claims with indicators
  const claimIndicators = [
    /(?:importantly|notably|crucially|essentially|fundamentally)[,:]?\s+([^.]+\.)/gi,
    /(?:the key (?:point|insight|idea) is)[:\s]+([^.]+\.)/gi,
    /(?:in other words|to summarize|in summary)[,:]?\s+([^.]+\.)/gi
  ];

  for (const pattern of claimIndicators) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) phrases.push(match[1].trim());
    }
  }

  // Pattern 3: Lists of concepts (numbered or bulleted)
  const listItems = text.match(/(?:^|\n)(?:\d+\.|[-•*])\s+([A-Z][^.\n]+)/gm);
  if (listItems) {
    phrases.push(...listItems.map(p => p.replace(/^[\n\d.\-•*\s]+/, '').trim()).filter(p => p.length > 20));
  }

  // Deduplicate and limit length
  return [...new Set(phrases)]
    .filter(p => p.length >= 30 && p.length <= 300)
    .slice(0, 5);
}

/**
 * Truncate string to specified length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Register an emotional arc tracker for empathy mode
 * This is called by empathy-related plugins to provide emotional tracking
 */
export function registerEmotionalArcTracker(tracker: EmotionalArcTracker): void {
  emotionalArcTracker = tracker;
}

/**
 * Unregister the emotional arc tracker
 */
export function unregisterEmotionalArcTracker(): void {
  emotionalArcTracker = undefined;
}
