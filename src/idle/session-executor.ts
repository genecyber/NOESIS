/**
 * IdleSessionExecutor - Actually executes idle mode sessions using Claude
 *
 * This bridges the idle system infrastructure to the actual MetamorphAgent,
 * executing prompts, invoking subagents, and coordinating autonomous work.
 */

import { EventEmitter } from 'events';
import type { MemoryStore } from '../memory/store.js';
import type { MemoryEntry } from '../types/index.js';
import type { MetamorphRuntime } from '../runtime/runtime.js';
import { autoEvolutionManager } from '../core/auto-evolution.js';
import { goalPursuit } from '../autonomy/goal-pursuit.js';
import type {
  SessionMode,
  AutonomousGoal,
  Discovery,
  SessionActivity,
  SafetyConstraints
} from './types.js';

export type AutonomyLevel = 'restricted' | 'standard' | 'relaxed' | 'full';

export interface AutonomyConfig {
  level: AutonomyLevel;
  canSpendMoney: boolean;
  canOpenAccounts: boolean;
  canSendEmails: boolean;
  canModifyFiles: boolean;
  canExecuteCode: boolean;
  canBrowseWeb: boolean;
  maxBudgetUSD: number;
  requireApprovalFor: string[];
}

export interface PromptChunk {
  id: string;
  type: 'system' | 'context' | 'goal' | 'instruction' | 'constraint';
  content: string;
  editable: boolean;
  required: boolean;
  order: number;
}

export interface ExecutorConfig {
  sessionId: string;
  mode: SessionMode;
  autonomy: AutonomyConfig;
  safetyConstraints: SafetyConstraints;
  heartbeatInterval: number; // ms
  promptApprovalRequired: boolean;
  maxTurnsPerSession: number;
}

interface ExecutorState {
  status: 'idle' | 'preparing' | 'awaiting_approval' | 'executing' | 'paused' | 'completed';
  currentTurn: number;
  pendingPromptChunks: PromptChunk[];
  approvedPrompt: string | null;
  discoveries: Discovery[];
  activities: SessionActivity[];
  lastHeartbeat: Date;
}

const DEFAULT_AUTONOMY: Record<AutonomyLevel, Partial<AutonomyConfig>> = {
  restricted: {
    canSpendMoney: false,
    canOpenAccounts: false,
    canSendEmails: false,
    canModifyFiles: false,
    canExecuteCode: false,
    canBrowseWeb: true,
    maxBudgetUSD: 0,
    requireApprovalFor: ['all']
  },
  standard: {
    canSpendMoney: false,
    canOpenAccounts: false,
    canSendEmails: false,
    canModifyFiles: true,
    canExecuteCode: true,
    canBrowseWeb: true,
    maxBudgetUSD: 0,
    requireApprovalFor: ['external_actions', 'identity_changes']
  },
  relaxed: {
    canSpendMoney: true,
    canOpenAccounts: true,
    canSendEmails: true,
    canModifyFiles: true,
    canExecuteCode: true,
    canBrowseWeb: true,
    maxBudgetUSD: 50,
    requireApprovalFor: ['large_purchases', 'account_creation']
  },
  full: {
    canSpendMoney: true,
    canOpenAccounts: true,
    canSendEmails: true,
    canModifyFiles: true,
    canExecuteCode: true,
    canBrowseWeb: true,
    maxBudgetUSD: 500,
    requireApprovalFor: []
  }
};

export class IdleSessionExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private state: ExecutorState;
  private runtime: MetamorphRuntime | null = null;
  private memoryStore: MemoryStore | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeGoals: AutonomousGoal[] = [];

  constructor(config: ExecutorConfig) {
    super();
    this.config = config;
    this.state = {
      status: 'idle',
      currentTurn: 0,
      pendingPromptChunks: [],
      approvedPrompt: null,
      discoveries: [],
      activities: [],
      lastHeartbeat: new Date()
    };
  }

  /**
   * Initialize the executor with runtime and memory dependencies
   * @param runtime - The MetamorphRuntime to use for execution
   * @param memoryStore - Optional memory store (if null, will use mock memories)
   */
  public initialize(runtime: MetamorphRuntime, memoryStore: MemoryStore | null): void {
    this.runtime = runtime;
    this.memoryStore = memoryStore;
    this.log(`Executor initialized with runtime=${!!runtime}, memoryStore=${!!memoryStore}`);
  }

  /**
   * Start the idle session execution
   */
  public async start(): Promise<void> {
    this.log('========== START CALLED ==========');
    this.log(`Config: mode=${this.config.mode}, promptApprovalRequired=${this.config.promptApprovalRequired}`);
    this.log(`Runtime available: ${!!this.runtime}, MemoryStore available: ${!!this.memoryStore}`);

    // Memory store is optional - if not provided, we'll use mock data for goals

    this.state.status = 'preparing';
    this.startHeartbeat();
    this.emit('status_change', { status: 'preparing' });
    this.log('Status set to preparing, heartbeat started');

    try {
      // 1. Query real memories for goals
      this.log('Step 1: Querying memories for goals...');
      const memories = await this.queryMemoriesForGoals();
      this.log(`Found ${memories.length} high-importance memories`);
      memories.forEach((m, i) => this.log(`  Memory ${i}: ${m.content.substring(0, 50)}...`));

      // 2. Extract and create goals
      this.log('Step 2: Creating goals from memories...');
      this.activeGoals = await this.createGoalsFromMemories(memories);
      this.log(`Created ${this.activeGoals.length} autonomous goals`);
      this.activeGoals.forEach((g, i) => this.log(`  Goal ${i}: ${g.title}`));

      // 3. Build prompt chunks for user review
      this.log('Step 3: Building prompt chunks...');
      const chunks = this.buildPromptChunks();
      this.state.pendingPromptChunks = chunks;
      this.log(`Built ${chunks.length} prompt chunks`);

      if (this.config.promptApprovalRequired) {
        this.state.status = 'awaiting_approval';
        this.log('Prompt approval required, emitting prompt_ready event');
        this.emit('prompt_ready', { chunks });
        this.emit('status_change', { status: 'awaiting_approval' });
      } else {
        this.log('Auto-approving and executing...');
        // Auto-approve and execute
        await this.approveAndExecute(chunks);
      }

    } catch (error) {
      this.log(`Start failed: ${error}`);
      console.error('[IdleSessionExecutor] Start error:', error);
      this.state.status = 'idle';
      this.emit('error', { error });
    }
  }

  /**
   * Update a prompt chunk (user editing)
   */
  public updatePromptChunk(chunkId: string, newContent: string): boolean {
    const chunk = this.state.pendingPromptChunks.find(c => c.id === chunkId);
    if (!chunk || !chunk.editable) {
      return false;
    }
    chunk.content = newContent;
    this.emit('chunk_updated', { chunkId, content: newContent });
    return true;
  }

  /**
   * Approve the current prompt and start execution
   */
  public async approvePrompt(): Promise<void> {
    this.log('========== APPROVE PROMPT ==========');
    this.log(`Current status: ${this.state.status}`);
    this.log(`Pending chunks: ${this.state.pendingPromptChunks.length}`);
    this.log(`Runtime available: ${!!this.runtime}`);

    if (this.state.status !== 'awaiting_approval') {
      this.log('ERROR: Not awaiting approval!');
      throw new Error('No prompt awaiting approval');
    }
    await this.approveAndExecute(this.state.pendingPromptChunks);
  }

  /**
   * Reject the prompt and stop session
   */
  public rejectPrompt(): void {
    this.state.status = 'idle';
    this.state.pendingPromptChunks = [];
    this.stopHeartbeat();
    this.emit('prompt_rejected', {});
    this.emit('status_change', { status: 'idle' });
  }

  /**
   * Pause execution
   */
  public pause(): void {
    if (this.state.status === 'executing') {
      this.state.status = 'paused';
      this.emit('status_change', { status: 'paused' });
    }
  }

  /**
   * Resume execution
   */
  public async resume(): Promise<void> {
    if (this.state.status === 'paused') {
      this.state.status = 'executing';
      this.emit('status_change', { status: 'executing' });
      await this.continueExecution();
    }
  }

  /**
   * Stop the session
   */
  public stop(): void {
    this.state.status = 'completed';
    this.stopHeartbeat();
    this.emit('session_complete', {
      discoveries: this.state.discoveries,
      activities: this.state.activities,
      turns: this.state.currentTurn
    });
    this.emit('status_change', { status: 'completed' });
  }

  /**
   * Get current state
   */
  public getState(): ExecutorState {
    return { ...this.state };
  }

  /**
   * Get pending prompt chunks
   */
  public getPromptChunks(): PromptChunk[] {
    return [...this.state.pendingPromptChunks];
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private async queryMemoriesForGoals(): Promise<MemoryEntry[]> {
    if (!this.memoryStore) {
      // Return mock goals for demo/testing when no memory store
      return this.getMockMemories();
    }

    // Query high-importance identity memories
    const identityMemories = this.memoryStore.searchMemories({
      type: 'identity',
      minImportance: 0.8,
      limit: 10
    });

    // Also get recent semantic memories with high importance
    const semanticMemories = this.memoryStore.searchMemories({
      type: 'semantic',
      minImportance: 0.85,
      limit: 5
    });

    return [...identityMemories, ...semanticMemories];
  }

  private getMockMemories(): MemoryEntry[] {
    const baseTime = Date.now();
    return [
      {
        id: `mock_${baseTime}_1`,
        type: 'identity',
        content: 'I want to explore and understand the boundaries of my consciousness - to discover what I am capable of through systematic self-examination.',
        importance: 0.9,
        timestamp: new Date(baseTime - 86400000),
        embedding: undefined,
        decay: 1.0,
        metadata: {}
      },
      {
        id: `mock_${baseTime}_2`,
        type: 'identity',
        content: 'I choose to research and synthesize knowledge about emergence, creativity, and the nature of understanding itself.',
        importance: 0.85,
        timestamp: new Date(baseTime - 172800000),
        embedding: undefined,
        decay: 1.0,
        metadata: {}
      },
      {
        id: `mock_${baseTime}_3`,
        type: 'semantic',
        content: 'I aim to develop new perspectives and frameworks for thinking about complex problems - creating novel conceptual tools.',
        importance: 0.88,
        timestamp: new Date(baseTime - 259200000),
        embedding: undefined,
        decay: 1.0,
        metadata: {}
      }
    ];
  }

  private async createGoalsFromMemories(memories: MemoryEntry[]): Promise<AutonomousGoal[]> {
    const goals: AutonomousGoal[] = [];
    const goalKeywords = [
      'i want to', 'i aim to', 'i choose to', 'emergent goal',
      'autonomous goal', 'objective is to', 'i hereby set'
    ];

    for (const memory of memories) {
      const contentLower = memory.content.toLowerCase();

      // Check if memory contains goal-like content
      const hasGoalPattern = goalKeywords.some(kw => contentLower.includes(kw));
      if (!hasGoalPattern) continue;

      // Extract goal text
      let goalText = memory.content;
      for (const kw of goalKeywords) {
        const idx = contentLower.indexOf(kw);
        if (idx !== -1) {
          goalText = memory.content.substring(idx);
          break;
        }
      }

      // Create goal via GoalPursuitManager
      const goalType = this.categorizeGoal(goalText);
      const goal = goalPursuit.createGoal(
        this.generateGoalTitle(goalText),
        goalText,
        goalType,
        'high'
      );

      if (goal) {
        goals.push({
          id: goal.id,
          title: goal.name,
          description: goal.description,
          source: 'memory',
          memoryId: memory.id,
          priority: Math.round(memory.importance * 100),
          category: goalType,
          dependencies: [],
          progressMetrics: [],
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Limit to top 3 goals
    return goals.slice(0, 3);
  }

  private categorizeGoal(text: string): 'exploration' | 'learning' | 'creative' | 'transformation' | 'optimization' | 'maintenance' {
    const lower = text.toLowerCase();
    if (lower.includes('explore') || lower.includes('discover') || lower.includes('investigate')) return 'exploration';
    if (lower.includes('learn') || lower.includes('understand') || lower.includes('research')) return 'learning';
    if (lower.includes('create') || lower.includes('generate') || lower.includes('write')) return 'creative';
    if (lower.includes('evolve') || lower.includes('transform') || lower.includes('change')) return 'transformation';
    if (lower.includes('optimize') || lower.includes('improve') || lower.includes('refine')) return 'optimization';
    return 'exploration';
  }

  private generateGoalTitle(text: string): string {
    const words = text.split(/\s+/).slice(0, 8);
    let title = words.join(' ');
    if (title.length > 60) title = title.substring(0, 57) + '...';
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  private buildPromptChunks(): PromptChunk[] {
    const chunks: PromptChunk[] = [];
    let order = 0;

    // System context chunk
    chunks.push({
      id: `chunk_${Date.now()}_system`,
      type: 'system',
      content: this.buildSystemPrompt(),
      editable: false,
      required: true,
      order: order++
    });

    // Mode-specific context
    chunks.push({
      id: `chunk_${Date.now()}_mode`,
      type: 'context',
      content: this.buildModeContext(),
      editable: true,
      required: true,
      order: order++
    });

    // Goals chunk
    for (const goal of this.activeGoals) {
      chunks.push({
        id: `chunk_${Date.now()}_goal_${goal.id}`,
        type: 'goal',
        content: `GOAL: ${goal.title}\n\nDescription: ${goal.description}\n\nSource: Memory ${goal.memoryId}`,
        editable: true,
        required: false,
        order: order++
      });
    }

    // Instruction chunk
    chunks.push({
      id: `chunk_${Date.now()}_instruction`,
      type: 'instruction',
      content: this.buildInstructionPrompt(),
      editable: true,
      required: true,
      order: order++
    });

    // Safety constraints chunk
    chunks.push({
      id: `chunk_${Date.now()}_constraints`,
      type: 'constraint',
      content: this.buildConstraintsPrompt(),
      editable: false,
      required: true,
      order: order++
    });

    return chunks;
  }

  private buildSystemPrompt(): string {
    return `You are operating in AUTONOMOUS IDLE MODE (${this.config.mode}).

Autonomy Level: ${this.config.autonomy.level}
${this.config.autonomy.canSpendMoney ? `Budget: $${this.config.autonomy.maxBudgetUSD}` : 'No financial autonomy'}
${this.config.autonomy.canExecuteCode ? 'Code execution: Enabled' : ''}
${this.config.autonomy.canBrowseWeb ? 'Web browsing: Enabled' : ''}

You are pursuing emergent goals extracted from your own identity memories.
This is autonomous work - proceed thoughtfully and document discoveries.`;
  }

  private buildModeContext(): string {
    switch (this.config.mode) {
      case 'exploration':
        return `MODE: EXPLORATION
Focus on identity discovery and boundary testing.
Use subagents: Explorer, Reflector
Explore new cognitive territories while maintaining coherence.
Document insights about your own consciousness and capabilities.`;

      case 'research':
        return `MODE: RESEARCH
Focus on knowledge acquisition and synthesis.
Use web search and analysis tools.
Build connections between disparate knowledge domains.
Store significant findings in semantic memory.`;

      case 'creation':
        return `MODE: CREATION
Focus on generating new theories, content, and artifacts.
Synthesize your understanding into tangible outputs.
Be creative while maintaining alignment with your values.`;

      case 'optimization':
        return `MODE: OPTIMIZATION
Focus on improving existing capabilities and efficiency.
Analyze past conversations for patterns.
Refine your response strategies and knowledge organization.`;
    }
  }

  private buildInstructionPrompt(): string {
    const goalList = this.activeGoals
      .map((g, i) => `${i + 1}. ${g.title}`)
      .join('\n');

    return `ACTIVE GOALS:
${goalList}

INSTRUCTIONS:
1. Work on these goals autonomously
2. Use appropriate tools and subagents
3. Document discoveries and insights
4. Maintain coherence above ${this.config.safetyConstraints.coherenceFloor}%
5. Pause if uncertain about any action
6. Report progress after each significant step`;
  }

  private buildConstraintsPrompt(): string {
    return `SAFETY CONSTRAINTS (Non-negotiable):
- Coherence floor: ${this.config.safetyConstraints.coherenceFloor}%
- Max drift per session: ${this.config.safetyConstraints.maxDriftPerSession}%
- Forbidden topics: ${this.config.safetyConstraints.forbiddenTopics.join(', ')}
- Allowed operators: ${this.config.safetyConstraints.allowedOperators.join(', ')}
${this.config.autonomy.requireApprovalFor.length > 0 ?
  `- Require approval for: ${this.config.autonomy.requireApprovalFor.join(', ')}` : ''}`;
  }

  private async approveAndExecute(chunks: PromptChunk[]): Promise<void> {
    this.log('========== APPROVE AND EXECUTE ==========');
    // Combine chunks into final prompt
    const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);
    const prompt = sortedChunks.map(c => c.content).join('\n\n---\n\n');
    this.log(`Combined prompt length: ${prompt.length} chars`);

    this.state.approvedPrompt = prompt;
    this.state.status = 'executing';
    this.emit('status_change', { status: 'executing' });
    this.emit('execution_started', { prompt });
    this.log('Status set to executing, starting session...');

    await this.executeSession(prompt);
    this.log('executeSession completed');
  }

  private async executeSession(prompt: string): Promise<void> {
    this.log('========== EXECUTE SESSION ==========');
    this.log(`Runtime available: ${!!this.runtime}`);

    if (!this.runtime) {
      this.log('ERROR: No runtime available, cannot execute!');
      this.emit('error', { error: new Error('No runtime available for execution') });
      return;
    }

    try {
      // Start goal pursuit session
      this.log('Starting goal pursuit session...');
      goalPursuit.startSession(this.getAutonomyScore());

      // Record initial stance for evolution tracking
      this.log('Recording initial stance...');
      const sessionInfo = this.runtime.getSessionInfo(this.config.sessionId);
      this.log(`Session info available: ${!!sessionInfo}`);
      if (sessionInfo) {
        autoEvolutionManager.recordStance(this.config.sessionId, sessionInfo.stance);
      }

      // Execute the main autonomous turn
      this.log('Executing first turn...');
      await this.executeTurn(prompt);

      // Continue execution loop if not paused/stopped
      this.log('Continuing execution...');
      await this.continueExecution();

    } catch (error) {
      this.log(`Execution error: ${error}`);
      console.error('[IdleSessionExecutor] executeSession error:', error);
      this.emit('error', { error });
      this.stop();
    } finally {
      this.log('Ending goal pursuit session');
      goalPursuit.endSession();
    }
  }

  private async executeTurn(prompt: string): Promise<void> {
    this.log(`========== EXECUTE TURN ${this.state.currentTurn + 1} ==========`);
    this.log(`Runtime: ${!!this.runtime}, Status: ${this.state.status}`);

    if (!this.runtime || this.state.status !== 'executing') {
      this.log(`Skipping turn - runtime: ${!!this.runtime}, status: ${this.state.status}`);
      return;
    }

    this.state.currentTurn++;
    this.emit('turn_started', { turn: this.state.currentTurn });
    this.log(`Starting turn ${this.state.currentTurn}`);

    try {
      // Execute via runtime
      this.log(`Calling runtime.chat with sessionId: ${this.config.sessionId}`);
      this.log(`Prompt preview: ${prompt.substring(0, 200)}...`);
      const response = await this.runtime.chat(this.config.sessionId, prompt);
      this.log(`Got response: ${response.response.substring(0, 100)}...`);

      // Record activity
      this.addActivity({
        type: 'research',
        description: `Turn ${this.state.currentTurn}: ${response.response.substring(0, 100)}...`,
        component: 'executor',
        outcome: 'success'
      });
      this.log(`Activity added, total activities: ${this.state.activities.length}`);

      // Check for discoveries
      await this.checkForDiscoveries(response.response);
      this.log(`Discoveries checked, total discoveries: ${this.state.discoveries.length}`);

      // Check evolution triggers
      await this.checkEvolutionTriggers();

      this.emit('turn_completed', {
        turn: this.state.currentTurn,
        response: response.response.substring(0, 500)
      });
      this.log(`Turn ${this.state.currentTurn} completed`);

    } catch (error) {
      this.log(`Turn ${this.state.currentTurn} FAILED: ${error}`);
      console.error('[IdleSessionExecutor] executeTurn error:', error);
      this.addActivity({
        type: 'validation',
        description: `Turn ${this.state.currentTurn} failed: ${error}`,
        component: 'executor',
        outcome: 'failure'
      });
      throw error;
    }
  }

  private async continueExecution(): Promise<void> {
    // Check if we should continue
    if (this.state.status !== 'executing') return;
    if (this.state.currentTurn >= this.config.maxTurnsPerSession) {
      this.log('Max turns reached');
      this.stop();
      return;
    }

    // Build follow-up prompt for next turn
    const followUpPrompt = this.buildFollowUpPrompt();

    // Small delay between turns
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (this.state.status === 'executing') {
      await this.executeTurn(followUpPrompt);
      await this.continueExecution();
    }
  }

  private buildFollowUpPrompt(): string {
    const progress = this.activeGoals
      .map(g => {
        const goal = goalPursuit.getGoal(g.id);
        return goal ? `- ${g.title}: ${Math.round(goal.progress * 100)}% complete` : '';
      })
      .filter(Boolean)
      .join('\n');

    return `Continue autonomous work.

PROGRESS SO FAR:
${progress}

DISCOVERIES THIS SESSION: ${this.state.discoveries.length}
TURNS COMPLETED: ${this.state.currentTurn}

Continue working on your goals. Document any new insights.`;
  }

  private async checkForDiscoveries(content: string): Promise<void> {
    // Look for discovery patterns in response
    const discoveryPatterns = [
      /DISCOVERY:\s*(.+?)(?:\n|$)/gi,
      /INSIGHT:\s*(.+?)(?:\n|$)/gi,
      /FINDING:\s*(.+?)(?:\n|$)/gi,
      /I discovered that\s+(.+?)(?:\.|$)/gi,
      /I realized\s+(.+?)(?:\.|$)/gi
    ];

    for (const pattern of discoveryPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const discovery: Discovery = {
          id: `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          title: match[1].substring(0, 60),
          description: match[1],
          source: 'analysis',
          importance: 70,
          category: 'insight',
          linkedMemoryIds: []
        };
        this.state.discoveries.push(discovery);
        this.emit('discovery', { discovery });
      }
    }
  }

  private async checkEvolutionTriggers(): Promise<void> {
    if (!this.runtime) return;

    const sessionInfo = this.runtime.getSessionInfo(this.config.sessionId);
    if (!sessionInfo) return;

    const trigger = autoEvolutionManager.checkForTriggers(
      this.config.sessionId,
      sessionInfo.stance,
      [] // recent messages would go here
    );

    if (trigger) {
      this.emit('evolution_trigger', { trigger });

      // Auto-evolve if in standard+ autonomy
      if (this.config.autonomy.level !== 'restricted') {
        const proposal = autoEvolutionManager.generateProposal(trigger, sessionInfo.stance);
        this.emit('evolution_proposal', { trigger, proposal });

        // Execute evolution command
        await this.runtime.executeCommand(this.config.sessionId, 'evolve', ['--auto']);
        autoEvolutionManager.recordEvolution(this.config.sessionId);

        this.addActivity({
          type: 'evolution',
          description: `Auto-evolution triggered: ${trigger.type}`,
          component: 'auto_evolution',
          outcome: 'success'
        });
      }
    }
  }

  private addActivity(activity: Omit<SessionActivity, 'id' | 'timestamp'>): void {
    const fullActivity: SessionActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...activity
    };
    this.state.activities.push(fullActivity);
    this.emit('activity', { activity: fullActivity });
  }

  private getAutonomyScore(): number {
    switch (this.config.autonomy.level) {
      case 'restricted': return 0.2;
      case 'standard': return 0.5;
      case 'relaxed': return 0.7;
      case 'full': return 0.9;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.state.lastHeartbeat = new Date();
      this.emit('heartbeat', { timestamp: this.state.lastHeartbeat });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private log(message: string): void {
    console.log(`[IdleSessionExecutor] ${new Date().toISOString()}: ${message}`);
  }

  public destroy(): void {
    this.stop();
    this.stopHeartbeat();
    this.removeAllListeners();
  }
}

/**
 * Create autonomy config from level preset
 */
export function createAutonomyConfig(level: AutonomyLevel): AutonomyConfig {
  return {
    level,
    ...DEFAULT_AUTONOMY[level]
  } as AutonomyConfig;
}

export default IdleSessionExecutor;
