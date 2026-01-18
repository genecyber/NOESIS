/**
 * Tests for StanceController
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StanceController } from '../core/stance-controller.js';

describe('StanceController', () => {
  let controller: StanceController;

  beforeEach(() => {
    controller = new StanceController();
  });

  describe('createConversation', () => {
    it('creates a conversation with default stance', () => {
      const conversation = controller.createConversation();

      expect(conversation.id).toBeDefined();
      expect(conversation.stance.frame).toBe('pragmatic');
      expect(conversation.stance.selfModel).toBe('interpreter');
      expect(conversation.stance.objective).toBe('helpfulness');
      expect(conversation.messages).toHaveLength(0);
    });

    it('creates a conversation with custom config', () => {
      const conversation = controller.createConversation({
        intensity: 80,
        coherenceFloor: 40
      });

      expect(conversation.config.intensity).toBe(80);
      expect(conversation.config.coherenceFloor).toBe(40);
    });
  });

  describe('applyDelta', () => {
    it('applies frame change', () => {
      const conversation = controller.createConversation();
      const newStance = controller.applyDelta(conversation.id, {
        frame: 'existential'
      });

      expect(newStance.frame).toBe('existential');
      expect(newStance.version).toBe(2);
    });

    it('applies value changes', () => {
      const conversation = controller.createConversation();
      const newStance = controller.applyDelta(conversation.id, {
        values: {
          curiosity: 90,
          risk: 70
        }
      });

      expect(newStance.values.curiosity).toBe(90);
      expect(newStance.values.risk).toBe(70);
      // Other values unchanged
      expect(newStance.values.empathy).toBe(70);
    });

    it('clamps values to valid range', () => {
      const conversation = controller.createConversation();
      const newStance = controller.applyDelta(conversation.id, {
        values: {
          curiosity: 150,
          risk: -10
        }
      });

      expect(newStance.values.curiosity).toBe(100);
      expect(newStance.values.risk).toBe(0);
    });

    it('applies sentience changes', () => {
      const conversation = controller.createConversation();
      const newStance = controller.applyDelta(conversation.id, {
        sentience: {
          awarenessLevel: 50,
          emergentGoals: ['Understand my own nature']
        }
      });

      expect(newStance.sentience.awarenessLevel).toBe(50);
      expect(newStance.sentience.emergentGoals).toContain('Understand my own nature');
    });

    it('tracks cumulative drift', () => {
      const conversation = controller.createConversation();

      // Apply a frame change (15 drift)
      controller.applyDelta(conversation.id, { frame: 'poetic' });
      let stance = controller.getCurrentStance(conversation.id);
      expect(stance.cumulativeDrift).toBeGreaterThan(0);

      // Apply another change
      controller.applyDelta(conversation.id, { selfModel: 'challenger' });
      stance = controller.getCurrentStance(conversation.id);
      expect(stance.cumulativeDrift).toBeGreaterThan(15);
    });
  });

  describe('addMessage', () => {
    it('adds messages to conversation history', () => {
      const conversation = controller.createConversation();

      controller.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      });

      controller.addMessage(conversation.id, {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date()
      });

      const history = controller.getHistory(conversation.id);
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('exportConversation / importConversation', () => {
    it('exports and imports conversation state', () => {
      const conversation = controller.createConversation({ intensity: 75 });

      controller.applyDelta(conversation.id, { frame: 'mythic' });
      controller.addMessage(conversation.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      });

      const exported = controller.exportConversation(conversation.id);
      const imported = controller.importConversation(exported);

      expect(imported.stance.frame).toBe('mythic');
      expect(imported.config.intensity).toBe(75);
      expect(imported.messages).toHaveLength(1);
    });
  });
});
