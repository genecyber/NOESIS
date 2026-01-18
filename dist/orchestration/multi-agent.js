/**
 * Multi-Agent Orchestration - Ralph Iteration 6 Feature 5
 *
 * Coordinates multiple METAMORPH instances with shared memory,
 * stance consensus, and distributed task delegation.
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Multi-Agent Orchestration Manager
 */
class MultiAgentOrchestrator {
    agents = new Map();
    tasks = new Map();
    sharedMemory = new Map();
    consensusRequests = new Map();
    debates = new Map();
    messageQueue = [];
    localAgentId = null;
    /**
     * Register local agent in federation
     */
    registerLocalAgent(name, specialization, stance, config) {
        const agent = {
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
    getCapabilitiesForSpecialization(spec) {
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
    connectAgent(agentId, name, specialization, stance, config) {
        const agent = {
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
    disconnectAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
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
    createTask(type, description, context, priority = 'medium') {
        const task = {
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
    findBestAgentForTask(task) {
        const typeToSpecialization = {
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
                if (agent.specialization === preferredSpecs[0])
                    score += 20;
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
    assignTask(taskId, agentId) {
        const task = this.tasks.get(taskId);
        const agent = this.agents.get(agentId);
        if (!task || !agent || agent.status !== 'idle')
            return false;
        task.assignedTo = agentId;
        task.status = 'assigned';
        agent.status = 'busy';
        this.sendMessage({
            type: 'task',
            fromAgentId: this.localAgentId,
            toAgentId: agentId,
            payload: task,
            timestamp: new Date()
        });
        return true;
    }
    /**
     * Complete a task
     */
    completeTask(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task || task.status === 'completed')
            return false;
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
            fromAgentId: task.assignedTo || this.localAgentId,
            payload: { taskId, result },
            timestamp: new Date()
        });
        return true;
    }
    /**
     * Share memory with federation
     */
    shareMemory(content, type, expiryHours) {
        const memory = {
            id: uuidv4(),
            content,
            type,
            contributorAgentId: this.localAgentId,
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
            fromAgentId: this.localAgentId,
            payload: memory,
            timestamp: new Date()
        });
        return memory;
    }
    /**
     * Get relevant shared memories
     */
    getRelevantMemories(context, limit = 5) {
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
    initiateConsensus(topic, proposedChange, requiredMajority = 51, deadlineMinutes = 5) {
        const request = {
            id: uuidv4(),
            topic,
            proposedChange,
            initiatorAgentId: this.localAgentId,
            votes: new Map(),
            status: 'voting',
            requiredMajority,
            createdAt: new Date(),
            deadline: new Date(Date.now() + deadlineMinutes * 60000)
        };
        // Local agent votes yes automatically
        request.votes.set(this.localAgentId, 'agree');
        this.consensusRequests.set(request.id, request);
        this.broadcastMessage({
            type: 'consensus',
            fromAgentId: this.localAgentId,
            payload: { action: 'initiate', request },
            timestamp: new Date()
        });
        return request;
    }
    /**
     * Vote on consensus
     */
    voteOnConsensus(requestId, vote) {
        const request = this.consensusRequests.get(requestId);
        if (!request || request.status !== 'voting')
            return false;
        if (new Date() > request.deadline) {
            this.resolveConsensus(requestId);
            return false;
        }
        request.votes.set(this.localAgentId, vote);
        this.broadcastMessage({
            type: 'consensus',
            fromAgentId: this.localAgentId,
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
    resolveConsensus(requestId) {
        const request = this.consensusRequests.get(requestId);
        if (!request)
            return;
        const votes = Array.from(request.votes.values());
        const agrees = votes.filter(v => v === 'agree').length;
        const total = votes.filter(v => v !== 'abstain').length;
        const percentage = total > 0 ? (agrees / total) * 100 : 0;
        request.status = percentage >= request.requiredMajority ? 'approved' : 'rejected';
        this.broadcastMessage({
            type: 'consensus',
            fromAgentId: this.localAgentId,
            payload: { action: 'resolve', requestId, status: request.status, percentage },
            timestamp: new Date()
        });
    }
    /**
     * Start a debate session
     */
    startDebate(topic, participantIds, format = 'dialectic') {
        const debate = {
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
    addDebateTurn(debateId, position, content, stance) {
        const debate = this.debates.get(debateId);
        if (!debate || debate.status !== 'active')
            return null;
        const turn = {
            agentId: this.localAgentId,
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
    concludeDebate(debateId, conclusion) {
        const debate = this.debates.get(debateId);
        if (!debate || debate.status !== 'active')
            return false;
        debate.status = 'concluded';
        debate.conclusion = conclusion;
        return true;
    }
    /**
     * Broadcast message to all agents
     */
    broadcastMessage(message) {
        this.messageQueue.push(message);
        // In a real implementation, this would send to all connected agents
    }
    /**
     * Send message to specific agent
     */
    sendMessage(message) {
        this.messageQueue.push(message);
        // In a real implementation, this would send to the specific agent
    }
    /**
     * Get pending messages
     */
    getMessages() {
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        return messages;
    }
    /**
     * List all agents
     */
    listAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * List tasks
     */
    listTasks(status) {
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
    getStatus() {
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
//# sourceMappingURL=multi-agent.js.map