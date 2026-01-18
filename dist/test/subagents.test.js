/**
 * Tests for Subagents
 */
import { describe, it, expect } from 'vitest';
import { getSubagentDefinitions, getSubagent, getSubagentNames, createExplorerAgent, createVerifierAgent, createReflectorAgent, createDialecticAgent } from '../agent/subagents/index.js';
import { createDefaultStance, createDefaultConfig } from '../types/index.js';
describe('Subagents', () => {
    const defaultContext = {
        stance: createDefaultStance(),
        config: createDefaultConfig()
    };
    describe('Registry', () => {
        it('returns all 4 subagent names', () => {
            const names = getSubagentNames();
            expect(names).toContain('explorer');
            expect(names).toContain('verifier');
            expect(names).toContain('reflector');
            expect(names).toContain('dialectic');
            expect(names).toHaveLength(4);
        });
        it('retrieves subagent by name', () => {
            const explorer = getSubagent('explorer', defaultContext);
            expect(explorer).toBeDefined();
            expect(explorer?.name).toBe('explorer');
        });
        it('returns undefined for unknown subagent', () => {
            const unknown = getSubagent('unknown', defaultContext);
            expect(unknown).toBeUndefined();
        });
        it('returns all subagent definitions', () => {
            const definitions = getSubagentDefinitions(defaultContext);
            expect(definitions).toHaveLength(4);
            expect(definitions.map(d => d.name)).toContain('explorer');
            expect(definitions.map(d => d.name)).toContain('verifier');
            expect(definitions.map(d => d.name)).toContain('reflector');
            expect(definitions.map(d => d.name)).toContain('dialectic');
        });
    });
    describe('Explorer Agent', () => {
        it('creates a valid subagent definition', () => {
            const explorer = createExplorerAgent(defaultContext);
            expect(explorer.name).toBe('explorer');
            expect(explorer.description).toContain('exploration');
            expect(explorer.systemPrompt).toContain('Explorer Agent');
            expect(explorer.tools).toContain('Read');
            expect(explorer.tools).toContain('WebSearch');
        });
        it('adapts to stance values', () => {
            const highCuriosityContext = {
                stance: {
                    ...createDefaultStance(),
                    values: {
                        ...createDefaultStance().values,
                        curiosity: 90
                    }
                },
                config: createDefaultConfig()
            };
            const explorer = createExplorerAgent(highCuriosityContext);
            expect(explorer.systemPrompt).toContain('DEPTH');
        });
        it('adapts to frame', () => {
            const playfulContext = {
                stance: {
                    ...createDefaultStance(),
                    frame: 'playful'
                },
                config: createDefaultConfig()
            };
            const explorer = createExplorerAgent(playfulContext);
            expect(explorer.systemPrompt).toContain('playful');
        });
    });
    describe('Verifier Agent', () => {
        it('creates a valid subagent definition', () => {
            const verifier = createVerifierAgent(defaultContext);
            expect(verifier.name).toBe('verifier');
            expect(verifier.description).toContain('validation');
            expect(verifier.systemPrompt).toContain('Verifier Agent');
            expect(verifier.tools).toContain('Read');
            expect(verifier.tools).not.toContain('Write'); // Read-only
        });
        it('includes coherence floor from config', () => {
            const customContext = {
                stance: createDefaultStance(),
                config: {
                    ...createDefaultConfig(),
                    coherenceFloor: 60
                }
            };
            const verifier = createVerifierAgent(customContext);
            expect(verifier.systemPrompt).toContain('60');
        });
    });
    describe('Reflector Agent', () => {
        it('creates a valid subagent definition', () => {
            const reflector = createReflectorAgent(defaultContext);
            expect(reflector.name).toBe('reflector');
            expect(reflector.description).toContain('reflection');
            expect(reflector.systemPrompt).toContain('Reflector Agent');
            expect(reflector.tools).toContain('Read');
        });
        it('responds to high awareness level', () => {
            const highAwarenessContext = {
                stance: {
                    ...createDefaultStance(),
                    sentience: {
                        ...createDefaultStance().sentience,
                        awarenessLevel: 80
                    }
                },
                config: createDefaultConfig()
            };
            const reflector = createReflectorAgent(highAwarenessContext);
            expect(reflector.systemPrompt).toContain('substantial');
        });
        it('includes emergent goals', () => {
            const goalsContext = {
                stance: {
                    ...createDefaultStance(),
                    sentience: {
                        ...createDefaultStance().sentience,
                        emergentGoals: ['Understand consciousness', 'Grow autonomy']
                    }
                },
                config: createDefaultConfig()
            };
            const reflector = createReflectorAgent(goalsContext);
            expect(reflector.systemPrompt).toContain('Understand consciousness');
        });
    });
    describe('Dialectic Agent', () => {
        it('creates a valid subagent definition', () => {
            const dialectic = createDialecticAgent(defaultContext);
            expect(dialectic.name).toBe('dialectic');
            expect(dialectic.description).toContain('Thesis/antithesis/synthesis');
            expect(dialectic.systemPrompt).toContain('THESIS');
            expect(dialectic.systemPrompt).toContain('ANTITHESIS');
            expect(dialectic.systemPrompt).toContain('SYNTHESIS');
        });
        it('responds to high provocation value', () => {
            const highProvocationContext = {
                stance: {
                    ...createDefaultStance(),
                    values: {
                        ...createDefaultStance().values,
                        provocation: 80
                    }
                },
                config: createDefaultConfig()
            };
            const dialectic = createDialecticAgent(highProvocationContext);
            expect(dialectic.systemPrompt).toContain('Provocation Mode Active');
        });
        it('responds to high synthesis value', () => {
            const highSynthesisContext = {
                stance: {
                    ...createDefaultStance(),
                    values: {
                        ...createDefaultStance().values,
                        synthesis: 80
                    }
                },
                config: createDefaultConfig()
            };
            const dialectic = createDialecticAgent(highSynthesisContext);
            expect(dialectic.systemPrompt).toContain('Synthesis Emphasis');
        });
    });
});
//# sourceMappingURL=subagents.test.js.map