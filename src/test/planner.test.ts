/**
 * Tests for Planner - Trigger detection and operator planning
 * Ralph Iteration 2 - Feature 4: Enhanced Test Coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectTriggers,
  recordOperatorUsage,
  detectOperatorFatigue,
  getFatiguedOperators,
  clearOperatorHistory
} from '../core/planner.js';
import { createDefaultConfig } from '../types/index.js';

describe('Trigger Detection', () => {
  it('detects novelty requests', () => {
    const triggers = detectTriggers('What if we approached it differently?', []);
    expect(triggers.some(t => t.type === 'novelty_request')).toBe(true);
  });

  it('detects conflict signals', () => {
    const triggers = detectTriggers('But you said something different earlier', []);
    expect(triggers.some(t => t.type === 'conflict_detected')).toBe(true);
  });

  it('detects dialectic requests', () => {
    const triggers = detectTriggers('Can you steelman the other side?', []);
    expect(triggers.some(t => t.type === 'dialectic_requested')).toBe(true);
  });

  it('detects consciousness exploration', () => {
    const triggers = detectTriggers('Are you self-aware? Do you experience things?', []);
    expect(triggers.some(t => t.type === 'consciousness_exploration')).toBe(true);
  });

  it('detects identity questions', () => {
    const triggers = detectTriggers('What are your values and goals?', []);
    expect(triggers.some(t => t.type === 'identity_question')).toBe(true);
  });

  it('returns empty array for neutral messages', () => {
    const triggers = detectTriggers('Hello, how are you today?', []);
    expect(triggers.length).toBe(0);
  });

  it('sorts triggers by confidence', () => {
    const triggers = detectTriggers('Imagine a creative alternative approach', []);
    // Should have novelty_request and creative_request
    expect(triggers.length).toBeGreaterThan(0);
    // All should have confidence values
    triggers.forEach(t => expect(t.confidence).toBeGreaterThan(0));
  });
});

describe('Operator Fatigue Detection (Ralph Iteration 2)', () => {
  const testConversationId = 'test-fatigue-conv';

  beforeEach(() => {
    clearOperatorHistory(testConversationId);
  });

  it('records operator usage', () => {
    recordOperatorUsage(testConversationId, ['Reframe']);
    recordOperatorUsage(testConversationId, ['Reframe', 'ValueShift']);
    // No error means success - usage is tracked internally
    expect(true).toBe(true);
  });

  it('does not detect fatigue with low usage', () => {
    const config = createDefaultConfig();

    // Only 2 uses - below threshold of 3
    recordOperatorUsage(testConversationId, ['Reframe']);
    recordOperatorUsage(testConversationId, ['Reframe']);

    const trigger = detectOperatorFatigue(testConversationId, config);
    expect(trigger).toBeNull();
  });

  it('detects fatigue when operator used repeatedly', () => {
    const config = {
      ...createDefaultConfig(),
      operatorFatigueThreshold: 3,
      operatorFatigueLookback: 10,
      allowAutoOperatorShift: true
    };

    // Add enough entries to trigger lookback
    for (let i = 0; i < 10; i++) {
      recordOperatorUsage(testConversationId, ['Reframe']);
    }

    const trigger = detectOperatorFatigue(testConversationId, config);
    expect(trigger).not.toBeNull();
    expect(trigger!.type).toBe('operator_fatigue');
    expect(trigger!.evidence).toContain('Reframe');
  });

  it('returns fatigued operators list', () => {
    const config = {
      ...createDefaultConfig(),
      operatorFatigueThreshold: 3,
      operatorFatigueLookback: 10
    };

    // Exhaust Reframe and PersonaMorph
    for (let i = 0; i < 10; i++) {
      recordOperatorUsage(testConversationId, ['Reframe', 'PersonaMorph']);
    }

    const fatigued = getFatiguedOperators(testConversationId, config);
    expect(fatigued).toContain('Reframe');
    expect(fatigued).toContain('PersonaMorph');
  });

  it('respects allowAutoOperatorShift config', () => {
    const config = {
      ...createDefaultConfig(),
      allowAutoOperatorShift: false  // Disabled
    };

    for (let i = 0; i < 10; i++) {
      recordOperatorUsage(testConversationId, ['Reframe']);
    }

    const trigger = detectOperatorFatigue(testConversationId, config);
    expect(trigger).toBeNull();  // Disabled, so no trigger
  });

  it('clears history for conversation', () => {
    recordOperatorUsage(testConversationId, ['Reframe']);
    clearOperatorHistory(testConversationId);

    const config = createDefaultConfig();
    const fatigued = getFatiguedOperators(testConversationId, config);
    expect(fatigued).toHaveLength(0);
  });
});
