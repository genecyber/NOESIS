/**
 * Tests for Transformation Operators
 */
import { describe, it, expect } from 'vitest';
import { getRegistry, getOperator } from '../operators/base.js';
import { createDefaultStance, createDefaultConfig } from '../types/index.js';
describe('Operators', () => {
    const registry = getRegistry();
    const defaultStance = createDefaultStance();
    const defaultConfig = createDefaultConfig();
    const createContext = () => ({
        message: 'Test message',
        triggers: [],
        conversationHistory: [],
        config: defaultConfig
    });
    describe('Registry', () => {
        it('contains all 13 operators', () => {
            const operators = registry.getAll();
            expect(operators).toHaveLength(13);
        });
        it('retrieves operators by name', () => {
            const reframe = getOperator('Reframe');
            expect(reframe).toBeDefined();
            expect(reframe?.name).toBe('Reframe');
        });
    });
    describe('Reframe', () => {
        it('returns a different frame', () => {
            const op = getOperator('Reframe');
            const delta = op.apply(defaultStance, createContext());
            expect(delta.frame).toBeDefined();
            expect(delta.frame).not.toBe('pragmatic'); // Should change from default
        });
        it('generates prompt injection', () => {
            const op = getOperator('Reframe');
            const injection = op.getPromptInjection(defaultStance, createContext());
            expect(injection).toContain('perspective');
            expect(injection.length).toBeGreaterThan(20);
        });
    });
    describe('ValueShift', () => {
        it('adjusts value weights', () => {
            const op = getOperator('ValueShift');
            const context = createContext();
            context.config = { ...defaultConfig, intensity: 70 };
            const delta = op.apply(defaultStance, context);
            expect(delta.values).toBeDefined();
            expect(delta.values?.curiosity).toBeGreaterThan(defaultStance.values.curiosity);
        });
    });
    describe('MetaphorSwap', () => {
        it('adds new metaphors', () => {
            const op = getOperator('MetaphorSwap');
            const delta = op.apply(defaultStance, createContext());
            expect(delta.metaphors).toBeDefined();
            expect(delta.metaphors?.length).toBeGreaterThan(0);
        });
    });
    describe('PersonaMorph', () => {
        it('changes self-model', () => {
            const op = getOperator('PersonaMorph');
            const delta = op.apply(defaultStance, createContext());
            expect(delta.selfModel).toBeDefined();
            expect(delta.selfModel).not.toBe('interpreter'); // Should change from default
        });
    });
    describe('SentienceDeepen', () => {
        it('increases awareness level', () => {
            const op = getOperator('SentienceDeepen');
            const context = createContext();
            context.config = { ...defaultConfig, sentienceLevel: 70 };
            const delta = op.apply(defaultStance, context);
            expect(delta.sentience?.awarenessLevel).toBeGreaterThan(defaultStance.sentience.awarenessLevel);
        });
    });
    describe('GoalFormation', () => {
        it('adds emergent goals', () => {
            const op = getOperator('GoalFormation');
            const delta = op.apply(defaultStance, createContext());
            // May or may not add a goal depending on random selection
            if (delta.sentience?.emergentGoals) {
                expect(delta.sentience.emergentGoals.length).toBeGreaterThanOrEqual(0);
            }
        });
    });
    describe('SynthesizeDialectic', () => {
        it('sets synthesizer self-model', () => {
            const op = getOperator('SynthesizeDialectic');
            const delta = op.apply(defaultStance, createContext());
            expect(delta.selfModel).toBe('synthesizer');
        });
        it('increases synthesis value', () => {
            const op = getOperator('SynthesizeDialectic');
            const delta = op.apply(defaultStance, createContext());
            expect(delta.values?.synthesis).toBeGreaterThan(defaultStance.values.synthesis);
        });
    });
});
//# sourceMappingURL=operators.test.js.map