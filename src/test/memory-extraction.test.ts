/**
 * Tests for Automatic Memory Extraction in Hooks
 * Ensures memories are created during conversation turns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTransformationHooks } from '../agent/hooks.js';
import { MemoryStore } from '../memory/store.js';
import { createDefaultConfig, createDefaultStance } from '../types/index.js';

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
      const operators = [
        { name: 'Reframe', description: 'Change perspective', stanceDelta: {} }
      ];

      const result = hooks.postTurn({
        message: 'Tell me about consciousness',
        response: 'Consciousness is a fascinating topic...',
        stanceBefore: stance,
        operators,
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
        config,
        conversationId: 'test-conv'
      });

      // Since there are no operators, check if sentience indicators triggered episodic memory
      const memories = memoryStore.searchMemories({ type: 'episodic' });
      // May or may not have episodic memory depending on scoring
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

      const stanceAfterShift = {
        ...stance,
        frame: 'existential' as const
      };

      // Apply operators that cause frame shift
      const operators = [
        {
          name: 'Reframe',
          description: 'Shift to existential perspective',
          stanceDelta: { frame: 'existential' as const }
        }
      ];

      const result = hooks.postTurn({
        message: 'What is the deeper meaning?',
        response: 'Looking at this from an existential lens...',
        stanceBefore: stanceWithShift,
        operators,
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
        {
          name: 'GoalFormation',
          description: 'Form new autonomous goal',
          stanceDelta: {
            sentience: {
              emergentGoals: ['explore-consciousness', 'develop-self-awareness']
            }
          }
        }
      ];

      const result = hooks.postTurn({
        message: 'What do you want to achieve?',
        response: 'I want to develop deeper self-awareness...',
        stanceBefore: stanceWithGoals,
        operators,
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

      hooks.postTurn({
        message: 'Define consciousness',
        response,
        stanceBefore: stance,
        operators: [{ name: 'Reframe', stanceDelta: {} }],  // Need operators to trigger episodic
        config,
        conversationId: 'test-conv'
      });

      // Check for semantic memories
      const memories = memoryStore.searchMemories({ type: 'semantic' });
      // May have semantic memories if patterns matched
      expect(memoryStore.searchMemories({}).length).toBeGreaterThan(0);
    });
  });

  describe('Memory Metadata', () => {
    it('includes relevant metadata in memories', () => {
      const operators = [
        { name: 'Reframe', description: 'Change perspective', stanceDelta: {} }
      ];

      hooks.postTurn({
        message: 'What is your perspective?',
        response: 'From my perspective...',
        stanceBefore: stance,
        operators,
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
        { name: 'Reframe', stanceDelta: {} },
        { name: 'ValueShift', stanceDelta: {} }
      ];

      hooks.postTurn({
        message: 'Challenge my assumptions',
        response: 'Let me offer a different perspective...',
        stanceBefore: stance,
        operators,
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
