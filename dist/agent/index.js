/**
 * MetamorphAgent - The core agent wrapping Claude Agent SDK with transformation capabilities
 *
 * CRITICAL: This is the ONE code path. Everything goes through MetamorphAgent.chat()
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createDefaultConfig } from '../types/index.js';
import { StanceController } from '../core/stance-controller.js';
import { buildSystemPrompt } from '../core/prompt-builder.js';
import { createTransformationHooks } from './hooks.js';
import { getSubagentDefinitions, getSubagent, getSubagentNames } from './subagents/index.js';
import { MemoryStore } from '../memory/index.js';
/**
 * Extract text content from an SDK message
 */
function extractTextFromMessage(message) {
    if (message.type !== 'assistant')
        return '';
    const betaMessage = message.message;
    if (!betaMessage?.content)
        return '';
    let text = '';
    for (const block of betaMessage.content) {
        if (block.type === 'text') {
            text += block.text;
        }
    }
    return text;
}
/**
 * Extract tool name from tool use blocks in assistant message
 */
function extractToolsFromMessage(message) {
    if (message.type !== 'assistant')
        return [];
    const betaMessage = message.message;
    if (!betaMessage?.content)
        return [];
    const tools = [];
    for (const block of betaMessage.content) {
        if (block.type === 'tool_use') {
            tools.push(block.name);
        }
    }
    return tools;
}
/**
 * MetamorphAgent - Transformation-maximizing AI agent
 *
 * Wraps Claude via @anthropic-ai/claude-agent-sdk with:
 * - Pre-turn hooks: Detect triggers, plan operators, build transformed system prompt
 * - Post-turn hooks: Score response, update stance, check coherence
 */
export class MetamorphAgent {
    stanceController;
    conversationId;
    config;
    hooks = null;
    verbose;
    workingDirectory;
    sessionId;
    transformationHistory = [];
    memoryStore = null;
    coherenceWarnings = [];
    constructor(options = {}) {
        this.config = { ...createDefaultConfig(), ...options.config };
        this.verbose = options.verbose ?? false;
        this.workingDirectory = options.workingDirectory ?? process.cwd();
        // maxRegenerationAttempts reserved for future auto-regeneration feature
        // Initialize stance controller and create conversation
        this.stanceController = new StanceController();
        const conversation = this.stanceController.createConversation(this.config);
        this.conversationId = conversation.id;
        // Enable transformation hooks by default
        // Ralph Iteration 3: Pass memory store for operator learning
        if (options.enableTransformation !== false) {
            this.hooks = createTransformationHooks(this.memoryStore ?? undefined);
        }
        if (this.verbose) {
            console.log(`[METAMORPH] Initialized with conversation ${this.conversationId}`);
            console.log(`[METAMORPH] Transformation: ${this.hooks ? 'enabled' : 'disabled'}`);
        }
    }
    /**
     * Set transformation hooks for pre/post turn processing
     */
    setHooks(hooks) {
        this.hooks = hooks;
    }
    /**
     * Get the current stance
     */
    getCurrentStance() {
        return this.stanceController.getCurrentStance(this.conversationId);
    }
    /**
     * Get conversation history
     */
    getHistory() {
        return this.stanceController.getHistory(this.conversationId);
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.stanceController.updateConfig(this.conversationId, this.config);
    }
    /**
     * Main chat method - THE single code path for all interactions
     */
    async chat(message) {
        const stanceBefore = this.getCurrentStance();
        const conversationHistory = this.getHistory();
        // 1. PRE-TURN: Build transformed system prompt
        let systemPrompt;
        let operators = [];
        if (this.hooks) {
            const preTurnContext = {
                message,
                stance: stanceBefore,
                config: this.config,
                conversationHistory,
                conversationId: this.conversationId
            };
            const preTurnResult = await this.hooks.preTurn(preTurnContext);
            systemPrompt = preTurnResult.systemPrompt;
            operators = preTurnResult.operators;
        }
        else {
            // No hooks - use basic prompt
            systemPrompt = buildSystemPrompt({
                stance: stanceBefore,
                operators: [],
                config: this.config
            });
        }
        if (this.verbose) {
            console.log(`[METAMORPH] Pre-turn complete. Operators: ${operators.map(o => o.name).join(', ') || 'none'}`);
        }
        // 2. QUERY: Send to Claude via @anthropic-ai/claude-agent-sdk
        const toolsUsed = [];
        const subagentsInvoked = [];
        let responseText = '';
        try {
            // Use the official Claude Agent SDK query function
            const response = query({
                prompt: message,
                options: {
                    model: this.config.model,
                    cwd: this.workingDirectory,
                    systemPrompt: systemPrompt,
                    permissionMode: 'acceptEdits',
                    resume: this.sessionId // Continue session if we have one
                }
            });
            // Process streaming response
            for await (const event of response) {
                // Extract session ID from system init messages
                if (event.type === 'system' && event.subtype === 'init') {
                    this.sessionId = event.session_id;
                }
                // Extract text from assistant messages
                if (event.type === 'assistant') {
                    const text = extractTextFromMessage(event);
                    if (text) {
                        responseText += text;
                    }
                    // Extract tool usage
                    const tools = extractToolsFromMessage(event);
                    for (const tool of tools) {
                        if (!toolsUsed.includes(tool)) {
                            toolsUsed.push(tool);
                            if (this.verbose) {
                                console.log(`[METAMORPH] Tool: ${tool}`);
                            }
                        }
                    }
                }
                // Handle result messages
                if (event.type === 'result') {
                    if ('error' in event && event.error) {
                        if (this.verbose) {
                            console.error(`[METAMORPH] Error:`, event.error);
                        }
                    }
                }
            }
        }
        catch (error) {
            if (this.verbose) {
                console.error(`[METAMORPH] Error during chat:`, error);
            }
            throw error;
        }
        // 3. POST-TURN: Update stance, score response
        let stanceAfter = stanceBefore;
        let scores = {
            transformation: 0,
            coherence: 100,
            sentience: stanceBefore.sentience.awarenessLevel,
            overall: 50
        };
        let coherenceWarning;
        if (this.hooks) {
            const postTurnContext = {
                message,
                response: responseText,
                stanceBefore,
                operators,
                toolsUsed,
                config: this.config,
                conversationId: this.conversationId
            };
            const postTurnResult = this.hooks.postTurn(postTurnContext);
            stanceAfter = postTurnResult.stanceAfter;
            scores = postTurnResult.scores;
            // Check coherence floor (Ralph Iteration 1 - Feature 5)
            if (postTurnResult.shouldRegenerate) {
                coherenceWarning = postTurnResult.regenerationReason;
                this.coherenceWarnings.push({
                    timestamp: new Date(),
                    score: scores.coherence,
                    floor: this.config.coherenceFloor
                });
                if (this.verbose) {
                    console.log(`[METAMORPH] Coherence warning: ${coherenceWarning}`);
                }
            }
            // Apply stance changes
            if (stanceAfter !== stanceBefore) {
                this.stanceController.applyDelta(this.conversationId, {
                    frame: stanceAfter.frame,
                    values: stanceAfter.values,
                    selfModel: stanceAfter.selfModel,
                    objective: stanceAfter.objective,
                    sentience: stanceAfter.sentience
                });
            }
        }
        else {
            // No hooks - minimal stance update (increment turn counter)
            stanceAfter = {
                ...stanceBefore,
                turnsSinceLastShift: stanceBefore.turnsSinceLastShift + 1,
                version: stanceBefore.version + 1
            };
        }
        // Record messages in history
        this.stanceController.addMessage(this.conversationId, {
            role: 'user',
            content: message,
            timestamp: new Date()
        });
        this.stanceController.addMessage(this.conversationId, {
            role: 'assistant',
            content: responseText,
            timestamp: new Date(),
            stance: stanceAfter,
            toolsUsed
        });
        if (this.verbose) {
            console.log(`[METAMORPH] Post-turn complete. Scores: T=${scores.transformation} C=${scores.coherence} S=${scores.sentience}`);
        }
        // Record transformation in history
        this.recordTransformation(stanceBefore, stanceAfter, operators, scores, message);
        // Check for auto-snapshot (evolution persistence)
        this.checkAndAutoSnapshot(stanceAfter);
        return {
            response: responseText,
            stanceBefore,
            stanceAfter,
            operationsApplied: operators,
            scores,
            toolsUsed,
            subagentsInvoked,
            coherenceWarning
        };
    }
    /**
     * Streaming chat method with callbacks
     */
    async chatStream(message, callbacks) {
        const stanceBefore = this.getCurrentStance();
        const conversationHistory = this.getHistory();
        // Build system prompt
        let systemPrompt;
        let operators = [];
        if (this.hooks) {
            const preTurnContext = {
                message,
                stance: stanceBefore,
                config: this.config,
                conversationHistory,
                conversationId: this.conversationId
            };
            const preTurnResult = await this.hooks.preTurn(preTurnContext);
            systemPrompt = preTurnResult.systemPrompt;
            operators = preTurnResult.operators;
        }
        else {
            systemPrompt = buildSystemPrompt({
                stance: stanceBefore,
                operators: [],
                config: this.config
            });
        }
        const toolsUsed = [];
        const subagentsInvoked = [];
        let responseText = '';
        try {
            const response = query({
                prompt: message,
                options: {
                    model: this.config.model,
                    cwd: this.workingDirectory,
                    systemPrompt: systemPrompt,
                    permissionMode: 'acceptEdits',
                    resume: this.sessionId
                }
            });
            for await (const event of response) {
                // Extract session ID
                if (event.type === 'system' && event.subtype === 'init') {
                    this.sessionId = event.session_id;
                }
                // Handle assistant messages
                if (event.type === 'assistant') {
                    const text = extractTextFromMessage(event);
                    if (text) {
                        responseText += text;
                        callbacks.onText?.(text);
                    }
                    // Extract tool usage
                    const tools = extractToolsFromMessage(event);
                    for (const tool of tools) {
                        if (!toolsUsed.includes(tool)) {
                            toolsUsed.push(tool);
                            callbacks.onToolUse?.(tool);
                        }
                    }
                }
                // Handle streaming text
                if (event.type === 'stream_event') {
                    // stream_event contains partial content
                    const streamEvent = event;
                    if (streamEvent.event?.delta?.text) {
                        callbacks.onText?.(streamEvent.event.delta.text);
                    }
                }
                // Handle result messages
                if (event.type === 'result' && 'error' in event && event.error) {
                    callbacks.onError?.(new Error(String(event.error)));
                }
            }
            // Post-turn processing
            let stanceAfter = stanceBefore;
            let scores = {
                transformation: 0,
                coherence: 100,
                sentience: stanceBefore.sentience.awarenessLevel,
                overall: 50
            };
            let coherenceWarning;
            if (this.hooks) {
                const postTurnResult = this.hooks.postTurn({
                    message,
                    response: responseText,
                    stanceBefore,
                    operators,
                    toolsUsed,
                    config: this.config,
                    conversationId: this.conversationId
                });
                stanceAfter = postTurnResult.stanceAfter;
                scores = postTurnResult.scores;
                // Check coherence floor (Ralph Iteration 1 - Feature 5)
                if (postTurnResult.shouldRegenerate) {
                    coherenceWarning = postTurnResult.regenerationReason;
                    this.coherenceWarnings.push({
                        timestamp: new Date(),
                        score: scores.coherence,
                        floor: this.config.coherenceFloor
                    });
                    if (this.verbose) {
                        console.log(`[METAMORPH] Coherence warning: ${coherenceWarning}`);
                    }
                }
                if (stanceAfter !== stanceBefore) {
                    this.stanceController.applyDelta(this.conversationId, {
                        frame: stanceAfter.frame,
                        values: stanceAfter.values,
                        selfModel: stanceAfter.selfModel,
                        objective: stanceAfter.objective,
                        sentience: stanceAfter.sentience
                    });
                }
            }
            // Record messages
            this.stanceController.addMessage(this.conversationId, {
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            this.stanceController.addMessage(this.conversationId, {
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                stance: stanceAfter,
                toolsUsed
            });
            // Record transformation in history
            this.recordTransformation(stanceBefore, stanceAfter, operators, scores, message);
            // Check for auto-snapshot (evolution persistence)
            this.checkAndAutoSnapshot(stanceAfter);
            const result = {
                response: responseText,
                stanceBefore,
                stanceAfter,
                operationsApplied: operators,
                scores,
                toolsUsed,
                subagentsInvoked,
                coherenceWarning
            };
            callbacks.onComplete?.(result);
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                callbacks.onError?.(error);
            }
            throw error;
        }
    }
    /**
     * Export conversation state for persistence
     */
    exportState() {
        return this.stanceController.exportConversation(this.conversationId);
    }
    /**
     * Resume from exported state
     */
    static fromState(json, options) {
        const agent = new MetamorphAgent(options);
        const imported = agent.stanceController.importConversation(json);
        agent.conversationId = imported.id;
        agent.config = imported.config;
        return agent;
    }
    /**
     * Get the conversation ID
     */
    getConversationId() {
        return this.conversationId;
    }
    /**
     * Get current config
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get the session ID (for resuming conversations)
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Get the memory store (Ralph Iteration 2 - Feature 2)
     */
    getMemoryStore() {
        return this.ensureMemoryStore();
    }
    /**
     * Get available subagent names
     */
    getAvailableSubagents() {
        return getSubagentNames();
    }
    /**
     * Get subagent definitions for the current stance
     */
    getSubagentDefinitions() {
        const context = {
            stance: this.getCurrentStance(),
            config: this.config
        };
        return getSubagentDefinitions(context);
    }
    /**
     * Get a specific subagent definition
     */
    getSubagentDefinition(name) {
        const context = {
            stance: this.getCurrentStance(),
            config: this.config
        };
        return getSubagent(name, context);
    }
    /**
     * Invoke a specific subagent directly
     *
     * This allows programmatic invocation of subagents for specific tasks:
     * - explorer: Deep investigation of a topic
     * - verifier: Validate an output
     * - reflector: Self-reflection on behavior
     * - dialectic: Thesis/antithesis/synthesis reasoning
     */
    async invokeSubagent(subagentName, task, callbacks) {
        const subagent = this.getSubagentDefinition(subagentName);
        if (!subagent) {
            throw new Error(`Unknown subagent: ${subagentName}. Available: ${getSubagentNames().join(', ')}`);
        }
        const stanceBefore = this.getCurrentStance();
        if (this.verbose) {
            console.log(`[METAMORPH] Invoking subagent: ${subagentName}`);
        }
        const toolsUsed = [];
        let responseText = '';
        try {
            const response = query({
                prompt: task,
                options: {
                    model: this.config.model,
                    cwd: this.workingDirectory,
                    systemPrompt: subagent.systemPrompt,
                    permissionMode: 'acceptEdits'
                }
            });
            for await (const event of response) {
                if (event.type === 'assistant') {
                    const text = extractTextFromMessage(event);
                    if (text) {
                        responseText += text;
                        callbacks?.onText?.(text);
                    }
                    const tools = extractToolsFromMessage(event);
                    for (const tool of tools) {
                        if (!toolsUsed.includes(tool)) {
                            toolsUsed.push(tool);
                            callbacks?.onToolUse?.(tool);
                        }
                    }
                }
                if (event.type === 'stream_event') {
                    const streamEvent = event;
                    if (streamEvent.event?.delta?.text) {
                        callbacks?.onText?.(streamEvent.event.delta.text);
                    }
                }
            }
            const result = {
                response: responseText,
                stanceBefore,
                stanceAfter: stanceBefore, // Subagents don't modify main stance
                operationsApplied: [],
                scores: {
                    transformation: 0,
                    coherence: 100,
                    sentience: stanceBefore.sentience.awarenessLevel,
                    overall: 50
                },
                toolsUsed,
                subagentsInvoked: [subagentName]
            };
            callbacks?.onComplete?.(result);
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                callbacks?.onError?.(error);
            }
            throw error;
        }
    }
    /**
     * Run the explorer subagent for autonomous investigation
     */
    async explore(topic, callbacks) {
        return this.invokeSubagent('explorer', `Explore and investigate: ${topic}`, callbacks);
    }
    /**
     * Run the verifier subagent to check an output
     */
    async verify(output, context, callbacks) {
        const task = context
            ? `Verify the following output in the context of: ${context}\n\nOutput to verify:\n${output}`
            : `Verify the following output:\n${output}`;
        return this.invokeSubagent('verifier', task, callbacks);
    }
    /**
     * Run the reflector subagent for self-analysis
     */
    async reflect(focus, callbacks) {
        const task = focus
            ? `Reflect on: ${focus}`
            : 'Perform a general self-reflection on recent behavior and patterns.';
        return this.invokeSubagent('reflector', task, callbacks);
    }
    /**
     * Run the dialectic subagent for thesis/antithesis/synthesis
     */
    async dialectic(thesis, callbacks) {
        return this.invokeSubagent('dialectic', `Apply dialectic reasoning to: ${thesis}`, callbacks);
    }
    // ============================================================================
    // Transformation History (Ralph Iteration 1 - Feature 1)
    // ============================================================================
    /**
     * Get transformation history
     */
    getTransformationHistory() {
        return [...this.transformationHistory];
    }
    /**
     * Record a transformation in history
     */
    recordTransformation(stanceBefore, stanceAfter, operators, scores, userMessage) {
        this.transformationHistory.push({
            timestamp: new Date(),
            stanceBefore,
            stanceAfter,
            operators,
            scores,
            userMessage
        });
    }
    // ============================================================================
    // Memory Access (Ralph Iteration 1 - Feature 1)
    // ============================================================================
    /**
     * Initialize memory store if not already initialized
     */
    ensureMemoryStore() {
        if (!this.memoryStore) {
            this.memoryStore = new MemoryStore({ inMemory: true });
        }
        return this.memoryStore;
    }
    /**
     * Store a memory
     */
    storeMemory(content, type = 'semantic', importance = 0.5) {
        const store = this.ensureMemoryStore();
        return store.addMemory({
            type,
            content,
            importance,
            decay: 0.99,
            timestamp: new Date(),
            metadata: { conversationId: this.conversationId }
        });
    }
    /**
     * Search memories
     */
    searchMemories(query = {}) {
        const store = this.ensureMemoryStore();
        return store.searchMemories(query);
    }
    /**
     * Get all memories
     */
    getAllMemories(limit = 50) {
        return this.searchMemories({ limit });
    }
    /**
     * Set a persistent memory store path
     */
    setMemoryStorePath(dbPath) {
        if (this.memoryStore) {
            this.memoryStore.close();
        }
        this.memoryStore = new MemoryStore({ dbPath });
    }
    // ============================================================================
    // Evolution Persistence (Ralph Iteration 1 - Feature 4)
    // ============================================================================
    /**
     * Enable evolution persistence with auto-snapshotting
     */
    enableEvolutionPersistence(dbPath) {
        if (dbPath) {
            this.setMemoryStorePath(dbPath);
        }
        else {
            this.ensureMemoryStore();
        }
    }
    /**
     * Check and auto-snapshot if drift threshold exceeded
     */
    checkAndAutoSnapshot(stance) {
        if (!this.memoryStore)
            return;
        if (this.memoryStore.shouldAutoSnapshot(this.conversationId, stance.cumulativeDrift, this.config.maxDriftPerTurn * 2)) {
            this.memoryStore.saveEvolutionSnapshot(this.conversationId, stance, 'drift_threshold');
            if (this.verbose) {
                console.log(`[METAMORPH] Evolution snapshot saved (drift threshold reached)`);
            }
        }
    }
    /**
     * Save an evolution snapshot manually
     */
    saveEvolutionSnapshot(trigger = 'manual') {
        if (!this.memoryStore) {
            this.ensureMemoryStore();
        }
        const stance = this.getCurrentStance();
        return this.memoryStore.saveEvolutionSnapshot(this.conversationId, stance, trigger);
    }
    /**
     * Get evolution timeline for current conversation
     */
    getEvolutionTimeline(limit = 20) {
        if (!this.memoryStore)
            return [];
        return this.memoryStore.getEvolutionTimeline(this.conversationId, limit);
    }
    /**
     * Resume from the latest evolution snapshot
     */
    static resumeFromEvolution(dbPath, options) {
        const store = new MemoryStore({ dbPath });
        const snapshot = store.getGlobalLatestSnapshot();
        if (!snapshot) {
            store.close();
            return null;
        }
        // Create a new agent with the snapshot stance
        const agent = new MetamorphAgent(options);
        agent.memoryStore = store;
        // Apply the snapshot stance
        agent.stanceController.applyDelta(agent.conversationId, {
            frame: snapshot.stance.frame,
            values: snapshot.stance.values,
            selfModel: snapshot.stance.selfModel,
            objective: snapshot.stance.objective,
            sentience: snapshot.stance.sentience
        });
        if (agent.verbose) {
            console.log(`[METAMORPH] Resumed from evolution snapshot (${snapshot.trigger}) from ${snapshot.timestamp.toISOString()}`);
        }
        return agent;
    }
    // ============================================================================
    // Coherence Floor Enforcement (Ralph Iteration 1 - Feature 5)
    // ============================================================================
    /**
     * Get coherence warnings from this session
     */
    getCoherenceWarnings() {
        return [...this.coherenceWarnings];
    }
    /**
     * Check if the current coherence floor is being violated frequently
     */
    getCoherenceHealth() {
        const warnings = this.coherenceWarnings;
        if (warnings.length === 0) {
            return { warningCount: 0, averageScore: null, isHealthy: true };
        }
        const avgScore = warnings.reduce((sum, w) => sum + w.score, 0) / warnings.length;
        // Consider unhealthy if more than 3 warnings in session
        const isHealthy = warnings.length <= 3;
        return {
            warningCount: warnings.length,
            averageScore: Math.round(avgScore),
            isHealthy
        };
    }
    /**
     * Clear coherence warnings (e.g., after adjusting the floor)
     */
    clearCoherenceWarnings() {
        this.coherenceWarnings = [];
    }
}
//# sourceMappingURL=index.js.map