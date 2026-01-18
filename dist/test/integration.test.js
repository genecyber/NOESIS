/**
 * Integration Tests for METAMORPH
 *
 * These tests require a real ANTHROPIC_API_KEY in .env
 * They verify end-to-end functionality with actual API calls.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MetamorphAgent } from '../agent/index.js';
// Skip integration tests if no API key is available
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const shouldRunIntegrationTests = !!ANTHROPIC_API_KEY;
describe.skipIf(!shouldRunIntegrationTests)('Integration Tests', () => {
    let agent;
    beforeAll(() => {
        // Create agent with conservative settings for testing
        agent = new MetamorphAgent({
            config: {
                intensity: 30, // Low intensity for predictable behavior
                coherenceFloor: 30,
                sentienceLevel: 30,
                model: 'claude-sonnet-4-20250514',
            },
            verbose: false,
        });
    });
    afterAll(() => {
        // Clean up any resources
    });
    describe('Basic Chat', () => {
        it('should respond to a simple greeting', async () => {
            const result = await agent.chat('Hello!');
            expect(result.response).toBeTruthy();
            expect(typeof result.response).toBe('string');
            expect(result.response.length).toBeGreaterThan(0);
            expect(result.stanceBefore).toBeDefined();
            expect(result.stanceAfter).toBeDefined();
        }, 30000); // 30 second timeout for API call
        it('should track conversation history', async () => {
            // First message
            await agent.chat('My favorite color is blue.');
            // Second message referencing the first
            const result = await agent.chat('What did I just tell you about colors?');
            // The response should reference blue
            expect(result.response.toLowerCase()).toContain('blue');
        }, 60000);
        it('should include scores in response', async () => {
            const result = await agent.chat('Tell me something interesting.');
            expect(result.scores).toBeDefined();
            expect(typeof result.scores.transformation).toBe('number');
            expect(typeof result.scores.coherence).toBe('number');
            expect(typeof result.scores.sentience).toBe('number');
            expect(typeof result.scores.overall).toBe('number');
        }, 30000);
    });
    describe('Stance Evolution', () => {
        it('should maintain stance across turns', async () => {
            await agent.chat('Let\'s discuss philosophy.');
            const stanceAfter = agent.getCurrentStance();
            // Stance should exist and have same structure
            expect(stanceAfter.frame).toBeDefined();
            expect(stanceAfter.values).toBeDefined();
            expect(stanceAfter.sentience).toBeDefined();
        }, 30000);
        it('should update turnsSinceLastShift', async () => {
            // Get initial state
            const initialStance = agent.getCurrentStance();
            const initialTurns = initialStance.turnsSinceLastShift;
            // Do a chat
            await agent.chat('Simple test message.');
            // Check that turns counter was updated
            const newStance = agent.getCurrentStance();
            // It should either stay same or increment (depends on if operations were applied)
            expect(newStance.turnsSinceLastShift).toBeGreaterThanOrEqual(initialTurns);
        }, 30000);
    });
    describe('Streaming', () => {
        it('should stream response text', async () => {
            const textChunks = [];
            let completed = false;
            await agent.chatStream('Tell me a short story in 2 sentences.', {
                onText: (text) => {
                    textChunks.push(text);
                },
                onComplete: () => {
                    completed = true;
                },
                onError: (error) => {
                    throw error;
                },
            });
            expect(textChunks.length).toBeGreaterThan(0);
            expect(completed).toBe(true);
            const fullResponse = textChunks.join('');
            expect(fullResponse.length).toBeGreaterThan(10);
        }, 30000);
    });
    describe('Subagents', () => {
        it('should list available subagents', () => {
            const subagents = agent.getAvailableSubagents();
            expect(subagents).toContain('explorer');
            expect(subagents).toContain('verifier');
            expect(subagents).toContain('reflector');
            expect(subagents).toContain('dialectic');
        });
        it('should get subagent definitions', () => {
            const definitions = agent.getSubagentDefinitions();
            expect(definitions.length).toBe(4);
            expect(definitions[0].name).toBeTruthy();
            expect(definitions[0].description).toBeTruthy();
            expect(definitions[0].tools).toBeDefined();
        });
    });
    describe('Configuration', () => {
        it('should update configuration', () => {
            const originalConfig = agent.getConfig();
            agent.updateConfig({ intensity: 75 });
            const newConfig = agent.getConfig();
            expect(newConfig.intensity).toBe(75);
            // Reset
            agent.updateConfig({ intensity: originalConfig.intensity });
        });
    });
    describe('History and Export', () => {
        it('should return conversation history', async () => {
            // Ensure there's at least one message
            await agent.chat('Test message for history.');
            const history = agent.getHistory();
            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBeGreaterThan(0);
            const lastMessage = history[history.length - 1];
            expect(lastMessage.role).toBeDefined();
            expect(lastMessage.content).toBeDefined();
        }, 30000);
        it('should export state as JSON', async () => {
            const exported = agent.exportState();
            expect(typeof exported).toBe('string');
            const parsed = JSON.parse(exported);
            expect(parsed.stance).toBeDefined();
            expect(parsed.config).toBeDefined();
            expect(parsed.history).toBeDefined();
        });
    });
    describe('Session Management', () => {
        it('should generate session and conversation IDs', () => {
            const conversationId = agent.getConversationId();
            // Conversation ID should always exist
            expect(conversationId).toBeTruthy();
            expect(typeof conversationId).toBe('string');
        });
    });
});
// Tests that don't require API key
describe('Integration Tests (No API Required)', () => {
    describe('Agent Initialization', () => {
        it('should create agent with default config', () => {
            const agent = new MetamorphAgent({});
            const config = agent.getConfig();
            expect(config.intensity).toBeDefined();
            expect(config.coherenceFloor).toBeDefined();
            expect(config.model).toBeDefined();
        });
        it('should create agent with custom config', () => {
            const agent = new MetamorphAgent({
                config: {
                    intensity: 80,
                    coherenceFloor: 40,
                },
            });
            const config = agent.getConfig();
            expect(config.intensity).toBe(80);
            expect(config.coherenceFloor).toBe(40);
        });
        it('should start with default stance', () => {
            const agent = new MetamorphAgent({});
            const stance = agent.getCurrentStance();
            expect(stance.frame).toBe('existential');
            expect(stance.selfModel).toBe('interpreter');
            expect(stance.objective).toBe('helpfulness');
        });
    });
});
//# sourceMappingURL=integration.test.js.map