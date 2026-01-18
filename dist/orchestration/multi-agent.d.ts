/**
 * Multi-Agent Orchestration - Ralph Iteration 6 Feature 5
 *
 * Coordinates multiple METAMORPH instances with shared memory,
 * stance consensus, and distributed task delegation.
 */
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
export type AgentSpecialization = 'research' | 'creative' | 'analytical' | 'empathetic' | 'provocative' | 'synthesizer' | 'generalist';
/**
 * Task for delegation
 */
export interface DelegatedTask {
    id: string;
    type: 'research' | 'creative' | 'analysis' | 'synthesis' | 'debate' | 'reflection';
    description: string;
    context: string;
    assignedTo?: string;
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
    requiredMajority: number;
    createdAt: Date;
    deadline: Date;
}
/**
 * Debate session between agents
 */
export interface DebateSession {
    id: string;
    topic: string;
    participants: string[];
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
    toAgentId?: string;
    payload: unknown;
    timestamp: Date;
}
/**
 * Multi-Agent Orchestration Manager
 */
declare class MultiAgentOrchestrator {
    private agents;
    private tasks;
    private sharedMemory;
    private consensusRequests;
    private debates;
    private messageQueue;
    private localAgentId;
    /**
     * Register local agent in federation
     */
    registerLocalAgent(name: string, specialization: AgentSpecialization, stance: Stance, config: ModeConfig): FederatedAgent;
    /**
     * Get capabilities for specialization
     */
    private getCapabilitiesForSpecialization;
    /**
     * Connect to remote agent
     */
    connectAgent(agentId: string, name: string, specialization: AgentSpecialization, stance: Stance, config: ModeConfig): FederatedAgent;
    /**
     * Disconnect agent
     */
    disconnectAgent(agentId: string): boolean;
    /**
     * Create and delegate a task
     */
    createTask(type: DelegatedTask['type'], description: string, context: string, priority?: DelegatedTask['priority']): DelegatedTask;
    /**
     * Find best agent for a task
     */
    private findBestAgentForTask;
    /**
     * Assign task to agent
     */
    assignTask(taskId: string, agentId: string): boolean;
    /**
     * Complete a task
     */
    completeTask(taskId: string, result: TaskResult): boolean;
    /**
     * Share memory with federation
     */
    shareMemory(content: string, type: SharedMemory['type'], expiryHours?: number): SharedMemory;
    /**
     * Get relevant shared memories
     */
    getRelevantMemories(context: string, limit?: number): SharedMemory[];
    /**
     * Initiate stance consensus
     */
    initiateConsensus(topic: string, proposedChange: Partial<Stance>, requiredMajority?: number, deadlineMinutes?: number): ConsensusRequest;
    /**
     * Vote on consensus
     */
    voteOnConsensus(requestId: string, vote: 'agree' | 'disagree' | 'abstain'): boolean;
    /**
     * Resolve consensus
     */
    private resolveConsensus;
    /**
     * Start a debate session
     */
    startDebate(topic: string, participantIds: string[], format?: DebateSession['format']): DebateSession;
    /**
     * Add turn to debate
     */
    addDebateTurn(debateId: string, position: DebateTurn['position'], content: string, stance: Stance): DebateTurn | null;
    /**
     * Conclude debate
     */
    concludeDebate(debateId: string, conclusion: string): boolean;
    /**
     * Broadcast message to all agents
     */
    private broadcastMessage;
    /**
     * Send message to specific agent
     */
    private sendMessage;
    /**
     * Get pending messages
     */
    getMessages(): FederationMessage[];
    /**
     * List all agents
     */
    listAgents(): FederatedAgent[];
    /**
     * List tasks
     */
    listTasks(status?: DelegatedTask['status']): DelegatedTask[];
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
    };
}
export declare const multiAgentOrchestrator: MultiAgentOrchestrator;
export {};
//# sourceMappingURL=multi-agent.d.ts.map