/**
 * Multi-Agent Orchestration - Ralph Iteration 6 Feature 5
 *
 * Coordinates multiple METAMORPH instances with shared memory,
 * stance consensus, and distributed task delegation.
 */

import { v4 as uuidv4 } from 'uuid';
import { Stance, ModeConfig } from '../types/index.js';

/**
 * Agent instance in the federation
 */
export interface FederatedAgent {
  id: string;
  name: string;
  specialization: AgentSpecialization;
  stance: Stance;
  config: ModeConfig;
  status: 'idle' | 'busy' | 'offline';
  lastSeen: Date;
  capabilities: string[];
  performance: {
    tasksCompleted: number;
    avgEffectiveness: number;
    specialtyScore: number;
  };
}

/**
 * Agent specialization types
 */
export type AgentSpecialization =
  | 'research'
  | 'creative'
  | 'analytical'
  | 'empathetic'
  | 'provocative'
  | 'synthesizer'
  | 'generalist';

/**
 * Task for delegation
 */
export interface DelegatedTask {
  id: string;
  type: 'research' | 'creative' | 'analysis' | 'synthesis' | 'debate' | 'reflection';
  description: string;
  context: string;
  assignedTo?: string;  // Agent ID
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  completedAt?: Date;
  result?: TaskResult;
}

/**
 * Task result from delegated agent
 */
export interface TaskResult {
  content: string;
  stanceUsed: Stance;
  effectiveness: number;
  insights: string[];
  suggestedFollowUp?: string;
}

/**
 * Shared memory pool entry
 */
export interface SharedMemory {
  id: string;
  content: string;
  type: 'fact' | 'insight' | 'question' | 'conclusion';
  contributorAgentId: string;
  relevanceScore: number;
  usageCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Stance consensus request
 */
export interface ConsensusRequest {
  id: string;
  topic: string;
  proposedChange: Partial<Stance>;
  initiatorAgentId: string;
  votes: Map<string, 'agree' | 'disagree' | 'abstain'>;
  status: 'voting' | 'approved' | 'rejected';
  requiredMajority: number;  // Percentage (0-100)
  createdAt: Date;
  deadline: Date;
}

/**
 * Debate session between agents
 */
export interface DebateSession {
  id: string;
  topic: string;
  participants: string[];  // Agent IDs
  format: 'structured' | 'free_form' | 'dialectic';
  turns: DebateTurn[];
  status: 'active' | 'concluded';
  conclusion?: string;
  createdAt: Date;
}

/**
 * Single turn in a debate
 */
export interface DebateTurn {
  agentId: string;
  position: 'thesis' | 'antithesis' | 'synthesis' | 'question' | 'clarification';
  content: string;
  stanceAtTurn: Stance;
  timestamp: Date;
}

/**
 * Federation protocol message
 */
export interface FederationMessage {
  type: 'join' | 'leave' | 'task' | 'result' | 'consensus' | 'memory_share' | 'stance_sync';
  fromAgentId: string;
  toAgentId?: string;  // undefined = broadcast
  payload: unknown;
  timestamp: Date;
}

/**
 * Multi-Agent Orchestration Manager
 */
class MultiAgentOrchestrator {
  private agents: Map<string, FederatedAgent> = new Map();
  private tasks: Map<string, DelegatedTask> = new Map();
  private sharedMemory: Map<string, SharedMemory> = new Map();
  private consensusRequests: Map<string, ConsensusRequest> = new Map();
  private debates: Map<string, DebateSession> = new Map();
  private messageQueue: FederationMessage[] = [];
  private localAgentId: string | null = null;

  /**
   * Register local agent in federation
   */
  registerLocalAgent(
    name: string,
    specialization: AgentSpecialization,
    stance: Stance,
    config: ModeConfig
  ): FederatedAgent {
    const agent: FederatedAgent = {
      id: uuidv4(),
      name,
      specialization,
      stance: JSON.parse(JSON.stringify(stance)),
      config: JSON.parse(JSON.stringify(config)),
      status: 'idle',
      lastSeen: new Date(),
      capabilities: this.getCapabilitiesForSpecialization(specialization),
      performance: {
        tasksCompleted: 0,
        avgEffectiveness: 0,
        specialtyScore: 80
      }
    };

    this.agents.set(agent.id, agent);
    this.localAgentId = agent.id;

    this.broadcastMessage({
      type: 'join',
      fromAgentId: agent.id,
      payload: { name, specialization, capabilities: agent.capabilities },
      timestamp: new Date()
    });

    return agent;
  }

  /**
   * Get capabilities for specialization
   */
  private getCapabilitiesForSpecialization(spec: AgentSpecialization): string[] {
    switch (spec) {
      case 'research':
        return ['web_search', 'fact_checking', 'source_analysis', 'deep_investigation'];
      case 'creative':
        return ['ideation', 'metaphor_generation', 'narrative_crafting', 'artistic_interpretation'];
      case 'analytical':
        return ['logical_reasoning', 'data_analysis', 'pattern_recognition', 'systematic_breakdown'];
      case 'empathetic':
        return ['emotional_understanding', 'perspective_taking', 'conflict_resolution', 'supportive_dialogue'];
      case 'provocative':
        return ['devil_advocate', 'assumption_challenging', 'contrarian_thinking', 'boundary_pushing'];
      case 'synthesizer':
        return ['integration', 'summary_generation', 'connection_finding', 'holistic_view'];
      default:
        return ['general_reasoning', 'conversation', 'task_handling'];
    }
  }

  /**
   * Connect to remote agent
   */
  connectAgent(
    agentId: string,
    name: string,
    specialization: AgentSpecialization,
    stance: Stance,
    config: ModeConfig
  ): FederatedAgent {
    const agent: FederatedAgent = {
      id: agentId,
      name,
      specialization,
      stance,
      config,
      status: 'idle',
      lastSeen: new Date(),
      capabilities: this.getCapabilitiesForSpecialization(specialization),
      performance: {
        tasksCompleted: 0,
        avgEffectiveness: 0,
        specialtyScore: 80
      }
    };

    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Disconnect agent
   */
  disconnectAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Reassign any pending tasks
    for (const task of this.tasks.values()) {
      if (task.assignedTo === agentId && task.status !== 'completed') {
        task.assignedTo = undefined;
        task.status = 'pending';
      }
    }

    this.broadcastMessage({
      type: 'leave',
      fromAgentId: agentId,
      payload: { name: agent.name },
      timestamp: new Date()
    });

    return this.agents.delete(agentId);
  }

  /**
   * Create and delegate a task
   */
  createTask(
    type: DelegatedTask['type'],
    description: string,
    context: string,
    priority: DelegatedTask['priority'] = 'medium'
  ): DelegatedTask {
    const task: DelegatedTask = {
      id: uuidv4(),
      type,
      description,
      context,
      status: 'pending',
      priority,
      createdAt: new Date()
    };

    this.tasks.set(task.id, task);

    // Auto-assign based on specialization match
    const bestAgent = this.findBestAgentForTask(task);
    if (bestAgent) {
      this.assignTask(task.id, bestAgent.id);
    }

    return task;
  }

  /**
   * Find best agent for a task
   */
  private findBestAgentForTask(task: DelegatedTask): FederatedAgent | null {
    const typeToSpecialization: Record<string, AgentSpecialization[]> = {
      research: ['research', 'analytical'],
      creative: ['creative', 'synthesizer'],
      analysis: ['analytical', 'research'],
      synthesis: ['synthesizer', 'analytical'],
      debate: ['provocative', 'analytical'],
      reflection: ['empathetic', 'synthesizer']
    };

    const preferredSpecs = typeToSpecialization[task.type] || ['generalist'];

    // Score agents
    const candidates = Array.from(this.agents.values())
      .filter(a => a.status === 'idle' && a.id !== this.localAgentId)
      .map(agent => {
        let score = 0;

        // Specialization match
        if (preferredSpecs.includes(agent.specialization)) {
          score += 50;
          if (agent.specialization === preferredSpecs[0]) score += 20;
        }

        // Performance score
        score += agent.performance.avgEffectiveness * 0.3;

        // Specialty score
        score += agent.performance.specialtyScore * 0.2;

        return { agent, score };
      })
      .sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].agent : null;
  }

  /**
   * Assign task to agent
   */
  assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);

    if (!task || !agent || agent.status !== 'idle') return false;

    task.assignedTo = agentId;
    task.status = 'assigned';
    agent.status = 'busy';

    this.sendMessage({
      type: 'task',
      fromAgentId: this.localAgentId!,
      toAgentId: agentId,
      payload: task,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, result: TaskResult): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed') return false;

    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    // Update agent performance
    if (task.assignedTo) {
      const agent = this.agents.get(task.assignedTo);
      if (agent) {
        agent.status = 'idle';
        agent.performance.tasksCompleted++;
        agent.performance.avgEffectiveness =
          (agent.performance.avgEffectiveness * (agent.performance.tasksCompleted - 1) +
           result.effectiveness) / agent.performance.tasksCompleted;
      }
    }

    this.broadcastMessage({
      type: 'result',
      fromAgentId: task.assignedTo || this.localAgentId!,
      payload: { taskId, result },
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Share memory with federation
   */
  shareMemory(
    content: string,
    type: SharedMemory['type'],
    expiryHours?: number
  ): SharedMemory {
    const memory: SharedMemory = {
      id: uuidv4(),
      content,
      type,
      contributorAgentId: this.localAgentId!,
      relevanceScore: 0.5,
      usageCount: 0,
      createdAt: new Date(),
      expiresAt: expiryHours
        ? new Date(Date.now() + expiryHours * 3600000)
        : undefined
    };

    this.sharedMemory.set(memory.id, memory);

    this.broadcastMessage({
      type: 'memory_share',
      fromAgentId: this.localAgentId!,
      payload: memory,
      timestamp: new Date()
    });

    return memory;
  }

  /**
   * Get relevant shared memories
   */
  getRelevantMemories(context: string, limit: number = 5): SharedMemory[] {
    const now = Date.now();

    // Filter and score memories
    return Array.from(this.sharedMemory.values())
      .filter(m => !m.expiresAt || m.expiresAt.getTime() > now)
      .map(m => {
        // Simple keyword matching for relevance
        const contextWords = new Set(context.toLowerCase().split(/\s+/));
        const memoryWords = m.content.toLowerCase().split(/\s+/);
        const matches = memoryWords.filter(w => contextWords.has(w)).length;
        const relevance = matches / Math.max(memoryWords.length, 1);

        return { ...m, relevanceScore: relevance };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Initiate stance consensus
   */
  initiateConsensus(
    topic: string,
    proposedChange: Partial<Stance>,
    requiredMajority: number = 51,
    deadlineMinutes: number = 5
  ): ConsensusRequest {
    const request: ConsensusRequest = {
      id: uuidv4(),
      topic,
      proposedChange,
      initiatorAgentId: this.localAgentId!,
      votes: new Map(),
      status: 'voting',
      requiredMajority,
      createdAt: new Date(),
      deadline: new Date(Date.now() + deadlineMinutes * 60000)
    };

    // Local agent votes yes automatically
    request.votes.set(this.localAgentId!, 'agree');

    this.consensusRequests.set(request.id, request);

    this.broadcastMessage({
      type: 'consensus',
      fromAgentId: this.localAgentId!,
      payload: { action: 'initiate', request },
      timestamp: new Date()
    });

    return request;
  }

  /**
   * Vote on consensus
   */
  voteOnConsensus(
    requestId: string,
    vote: 'agree' | 'disagree' | 'abstain'
  ): boolean {
    const request = this.consensusRequests.get(requestId);
    if (!request || request.status !== 'voting') return false;

    if (new Date() > request.deadline) {
      this.resolveConsensus(requestId);
      return false;
    }

    request.votes.set(this.localAgentId!, vote);

    this.broadcastMessage({
      type: 'consensus',
      fromAgentId: this.localAgentId!,
      payload: { action: 'vote', requestId, vote },
      timestamp: new Date()
    });

    // Check if all agents have voted
    if (request.votes.size >= this.agents.size) {
      this.resolveConsensus(requestId);
    }

    return true;
  }

  /**
   * Resolve consensus
   */
  private resolveConsensus(requestId: string): void {
    const request = this.consensusRequests.get(requestId);
    if (!request) return;

    const votes = Array.from(request.votes.values());
    const agrees = votes.filter(v => v === 'agree').length;
    const total = votes.filter(v => v !== 'abstain').length;

    const percentage = total > 0 ? (agrees / total) * 100 : 0;

    request.status = percentage >= request.requiredMajority ? 'approved' : 'rejected';

    this.broadcastMessage({
      type: 'consensus',
      fromAgentId: this.localAgentId!,
      payload: { action: 'resolve', requestId, status: request.status, percentage },
      timestamp: new Date()
    });
  }

  /**
   * Start a debate session
   */
  startDebate(
    topic: string,
    participantIds: string[],
    format: DebateSession['format'] = 'dialectic'
  ): DebateSession {
    const debate: DebateSession = {
      id: uuidv4(),
      topic,
      participants: participantIds,
      format,
      turns: [],
      status: 'active',
      createdAt: new Date()
    };

    this.debates.set(debate.id, debate);
    return debate;
  }

  /**
   * Add turn to debate
   */
  addDebateTurn(
    debateId: string,
    position: DebateTurn['position'],
    content: string,
    stance: Stance
  ): DebateTurn | null {
    const debate = this.debates.get(debateId);
    if (!debate || debate.status !== 'active') return null;

    const turn: DebateTurn = {
      agentId: this.localAgentId!,
      position,
      content,
      stanceAtTurn: JSON.parse(JSON.stringify(stance)),
      timestamp: new Date()
    };

    debate.turns.push(turn);
    return turn;
  }

  /**
   * Conclude debate
   */
  concludeDebate(debateId: string, conclusion: string): boolean {
    const debate = this.debates.get(debateId);
    if (!debate || debate.status !== 'active') return false;

    debate.status = 'concluded';
    debate.conclusion = conclusion;
    return true;
  }

  /**
   * Broadcast message to all agents
   */
  private broadcastMessage(message: FederationMessage): void {
    this.messageQueue.push(message);
    // In a real implementation, this would send to all connected agents
  }

  /**
   * Send message to specific agent
   */
  private sendMessage(message: FederationMessage): void {
    this.messageQueue.push(message);
    // In a real implementation, this would send to the specific agent
  }

  /**
   * Get pending messages
   */
  getMessages(): FederationMessage[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }

  /**
   * List all agents
   */
  listAgents(): FederatedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * List tasks
   */
  listTasks(status?: DelegatedTask['status']): DelegatedTask[] {
    return Array.from(this.tasks.values())
      .filter(t => !status || t.status === status)
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  /**
   * Get orchestration status
   */
  getStatus(): {
    agentCount: number;
    activeAgents: number;
    pendingTasks: number;
    sharedMemories: number;
    activeConsensus: number;
    activeDebates: number;
  } {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    return {
      agentCount: agents.length,
      activeAgents: agents.filter(a => a.status !== 'offline').length,
      pendingTasks: tasks.filter(t => t.status === 'pending' || t.status === 'assigned').length,
      sharedMemories: this.sharedMemory.size,
      activeConsensus: Array.from(this.consensusRequests.values())
        .filter(r => r.status === 'voting').length,
      activeDebates: Array.from(this.debates.values())
        .filter(d => d.status === 'active').length
    };
  }
}

// Singleton instance
export const multiAgentOrchestrator = new MultiAgentOrchestrator();
