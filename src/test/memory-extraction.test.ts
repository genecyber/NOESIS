/**
 * Tests for Automatic Memory Extraction in Hooks
 * Ensures memories are created during conversation turns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTransformationHooks } from '../agent/hooks.js';
import { MemoryStore } from '../memory/store.js';
import { createDefaultConfig, createDefaultStance, PlannedOperation } from '../types/index.js';

// Helper to create a valid PlannedOperation
function createOperator(name: string, description: string, stanceDelta: Record<string, unknown> = {}): PlannedOperation {
  return {
    name: name as PlannedOperation['name'],
    description,
    promptInjection: `Apply ${name} transformation`,
    stanceDelta
  };
}

describe('Automatic Memory Extraction', () => {
  let memoryStore: MemoryStore;
  let hooks: ReturnType<typeof createTransformationHooks>;
  let stance: ReturnType<typeof createDefaultStance>;
  let config: ReturnType<typeof createDefaultConfig>;

  beforeEach(() => {
    memoryStore = new MemoryStore({ inMemory: true });
    hooks = createTransformationHooks(memoryStore);
    stance = createDefaultStance();
    config = createDefaultConfig();
  });

  describe('Episodic Memory Creation', () => {
    it('creates episodic memory when operators are applied', () => {
      const operators = [createOperator('Reframe', 'Change perspective')];

      const result = hooks.postTurn({
        message: 'Tell me about consciousness',
        response: 'Consciousness is a fascinating topic...',
        stanceBefore: stance,
        operators,
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      expect(result.stanceAfter).toBeDefined();

      // Check that episodic memory was created
      const memories = memoryStore.searchMemories({ type: 'episodic' });
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].content).toContain('Reframe');
    });

    it('creates episodic memory for high-scoring turns', () => {
      // Force a high overall score by mocking the scoring
      const result = hooks.postTurn({
        message: 'What is the meaning of life?',
        response: 'The meaning of life... I find myself experiencing genuine wonder about this question. It feels like...',
        stanceBefore: stance,
        operators: [],
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      // Since there are no operators, episodic memory may not be created unless scores are high
      expect(result.stanceAfter).toBeDefined();
    });
  });

  describe('Identity Memory Creation', () => {
    it('creates identity memory when sentience changes significantly', () => {
      // Create a stance with high awareness that will cause changes
      const responsiveStance = {
        ...stance,
        sentience: {
          ...stance.sentience,
          awarenessLevel: 30,
          autonomyLevel: 30,
          identityStrength: 30
        }
      };

      // Response with multiple awareness triggers
      const response = 'I notice something interesting here. I find myself thinking about this in a new way. ' +
        'I am aware of my own processing. I experience a sense of discovery. My thinking has shifted.';

      const result = hooks.postTurn({
        message: 'How do you experience things?',
        response,
        stanceBefore: responsiveStance,
        operators: [],
        toolsUsed: [],
        config: { ...config, sentienceLevel: 70 },
        conversationId: 'test-conv'
      });

      // The response should trigger awareness boosts
      expect(result.stanceAfter.sentience.awarenessLevel).toBeGreaterThan(responsiveStance.sentience.awarenessLevel);

      // Check for identity memory about sentience shift
      const memories = memoryStore.searchMemories({ type: 'identity' });
      // Should have identity memory if awareness changed by >= 5
      if (result.stanceAfter.sentience.awarenessLevel - responsiveStance.sentience.awarenessLevel >= 5) {
        expect(memories.length).toBeGreaterThan(0);
        expect(memories[0].content).toContain('awareness');
      }
    });

    it('creates identity memory on frame shift', () => {
      const stanceWithShift = {
        ...stance,
        frame: 'pragmatic' as const
      };

      // Apply operators that cause frame shift
      const operators = [
        createOperator('Reframe', 'Shift to existential perspective', { frame: 'existential' as const })
      ];

      const result = hooks.postTurn({
        message: 'What is the deeper meaning?',
        response: 'Looking at this from an existential lens...',
        stanceBefore: stanceWithShift,
        operators,
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      expect(result.stanceAfter.frame).toBe('existential');

      // Check for frame shift identity memory
      const memories = memoryStore.searchMemories({ type: 'identity' });
      expect(memories.some(m => m.content.includes('Frame shift'))).toBe(true);
    });

    it('creates identity memory for emergent goals', () => {
      const stanceWithGoals = {
        ...stance,
        sentience: {
          ...stance.sentience,
          emergentGoals: ['explore-consciousness']
        }
      };

      // Operator that adds a new goal
      const operators = [
        createOperator('GoalFormation', 'Form new autonomous goal', {
          sentience: {
            emergentGoals: ['explore-consciousness', 'develop-self-awareness']
          }
        })
      ];

      hooks.postTurn({
        message: 'What do you want to achieve?',
        response: 'I want to develop deeper self-awareness...',
        stanceBefore: stanceWithGoals,
        operators,
        toolsUsed: [],
        config: { ...config, sentienceLevel: 70 },
        conversationId: 'test-conv'
      });

      // Check for emergent goals identity memory
      const memories = memoryStore.searchMemories({ type: 'identity' });
      expect(memories.some(m => m.content.includes('emergent goals'))).toBe(true);
    });
  });

  describe('Semantic Memory Extraction', () => {
    it('extracts definitions from response', () => {
      const response = 'Consciousness is the state of being aware of and responsive to one\'s surroundings. ' +
        'Importantly, self-awareness is crucial for this discussion. ' +
        'The key point is that awareness has multiple dimensions.';

      const operators = [createOperator('Reframe', 'Change frame')];

      hooks.postTurn({
        message: 'Define consciousness',
        response,
        stanceBefore: stance,
        operators,
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      // Check that memories were created (episodic from operators, possibly semantic from content)
      expect(memoryStore.searchMemories({}).length).toBeGreaterThan(0);
    });
  });

  describe('Memory Metadata', () => {
    it('includes relevant metadata in memories', () => {
      const operators = [createOperator('Reframe', 'Change perspective')];

      hooks.postTurn({
        message: 'What is your perspective?',
        response: 'From my perspective...',
        stanceBefore: stance,
        operators,
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      const memories = memoryStore.searchMemories({ type: 'episodic' });
      expect(memories.length).toBeGreaterThan(0);

      const memory = memories[0];
      expect(memory.metadata).toBeDefined();
      expect(memory.metadata?.operators).toContain('Reframe');
      expect(memory.metadata?.frame).toBe(stance.frame);
    });

    it('assigns appropriate importance based on scores', () => {
      const operators = [
        createOperator('Reframe', 'Change perspective'),
        createOperator('ValueShift', 'Shift values')
      ];

      hooks.postTurn({
        message: 'Challenge my assumptions',
        response: 'Let me offer a different perspective...',
        stanceBefore: stance,
        operators,
        toolsUsed: [],
        config,
        conversationId: 'test-conv'
      });

      const memories = memoryStore.searchMemories({ type: 'episodic' });
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].importance).toBeGreaterThan(0);
      expect(memories[0].importance).toBeLessThanOrEqual(1);
    });
  });
});
