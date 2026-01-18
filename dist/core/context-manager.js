/**
 * Context Window Management - Ralph Iteration 4 Feature 4
 *
 * Intelligent conversation summarization and context preservation
 * to maximize effective use of the context window.
 */
const DEFAULT_CONFIG = {
    maxTokens: 200000, // Claude's context window
    systemReserveRatio: 0.15,
    memoryReserveRatio: 0.1,
    compressionThreshold: 0.8,
    minPreservedTurns: 5,
    summaryMaxLength: 500
};
/**
 * Importance keywords for scoring
 */
const IMPORTANCE_PATTERNS = {
    critical: [
        /\b(always|never|must|critical|important|remember)\b/i,
        /\b(identity|purpose|core|fundamental)\b/i,
        /\b(evolve|transform|shift|change.*frame)\b/i,
        /\b(user.*preference|setting|config)\b/i
    ],
    high: [
        /\b(goal|objective|task|want|need)\b/i,
        /\b(decision|chose|decided|strategy)\b/i,
        /\b(problem|issue|error|bug|fix)\b/i,
        /\b(breakthrough|insight|realized)\b/i
    ],
    medium: [
        /\b(think|believe|consider|feel)\b/i,
        /\b(example|instance|case)\b/i,
        /\b(question|wondering|curious)\b/i
    ],
    low: [
        /\b(maybe|perhaps|possibly)\b/i,
        /\b(small|minor|little)\b/i,
        /\b(just|only|simply)\b/i
    ]
};
/**
 * Context window manager
 */
class ContextWindowManager {
    config = DEFAULT_CONFIG;
    conversationBuffer = new Map();
    compactionHistory = new Map();
    /**
     * Set configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Estimate token count (rough approximation: ~4 chars per token)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Calculate context budget
     */
    calculateBudget(currentMessages) {
        const totalTokens = this.config.maxTokens;
        const systemReserve = Math.floor(totalTokens * this.config.systemReserveRatio);
        const memoryReserve = Math.floor(totalTokens * this.config.memoryReserveRatio);
        const conversationAllocation = totalTokens - systemReserve - memoryReserve;
        const usedTokens = currentMessages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
        return {
            totalTokens,
            usedTokens,
            availableTokens: Math.max(0, conversationAllocation - usedTokens),
            systemReserve,
            memoryReserve,
            conversationAllocation
        };
    }
    /**
     * Score message importance
     */
    scoreMessage(message, stance, turnNumber) {
        const reasons = [];
        let score = 50; // Base score
        // Check importance patterns
        for (const [level, patterns] of Object.entries(IMPORTANCE_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(message.content)) {
                    switch (level) {
                        case 'critical':
                            score += 30;
                            reasons.push(`Contains critical keyword (${level})`);
                            break;
                        case 'high':
                            score += 20;
                            reasons.push(`Contains high-importance keyword`);
                            break;
                        case 'medium':
                            score += 10;
                            reasons.push(`Contains medium-importance keyword`);
                            break;
                        case 'low':
                            score -= 5;
                            reasons.push(`Contains low-importance keyword`);
                            break;
                    }
                }
            }
        }
        // Recency bonus
        const recencyBonus = Math.min(30, turnNumber * 3);
        score += recencyBonus;
        if (recencyBonus > 15) {
            reasons.push(`Recent message (turn ${turnNumber})`);
        }
        // Length factor (very long messages might be detailed/important)
        if (message.content.length > 500) {
            score += 10;
            reasons.push('Detailed content');
        }
        // Check for stance-related content
        if (message.content.toLowerCase().includes(stance.frame) ||
            message.content.toLowerCase().includes(stance.selfModel)) {
            score += 15;
            reasons.push('References current stance');
        }
        // Check for questions (user questions are often important)
        if (message.role === 'user' && message.content.includes('?')) {
            score += 10;
            reasons.push('User question');
        }
        // Check for code blocks (technical content)
        if (/```[\s\S]*?```/.test(message.content)) {
            score += 15;
            reasons.push('Contains code');
        }
        // Determine importance level
        let importance;
        if (score >= 90)
            importance = 'critical';
        else if (score >= 70)
            importance = 'high';
        else if (score >= 50)
            importance = 'medium';
        else if (score >= 30)
            importance = 'low';
        else
            importance = 'disposable';
        return {
            message,
            importance,
            score: Math.min(100, Math.max(0, score)),
            reasons,
            isCompacted: false
        };
    }
    /**
     * Process conversation and score all messages
     */
    processConversation(conversationId, messages, stance) {
        const totalTurns = messages.length;
        const scored = messages.map((msg, index) => this.scoreMessage(msg, stance, totalTurns - index));
        this.conversationBuffer.set(conversationId, scored);
        return scored;
    }
    /**
     * Check if compaction is needed
     */
    needsCompaction(messages) {
        const budget = this.calculateBudget(messages);
        const usageRatio = budget.usedTokens / budget.conversationAllocation;
        return usageRatio >= this.config.compressionThreshold;
    }
    /**
     * Generate summary for a group of messages
     */
    summarizeMessages(messages) {
        if (messages.length === 0)
            return '';
        const topics = new Set();
        const keyPoints = [];
        for (const m of messages) {
            // Extract potential topics (nouns, capitalized words)
            const words = m.message.content.match(/\b[A-Z][a-z]+\b/g) || [];
            words.slice(0, 5).forEach(w => topics.add(w));
            // Extract key sentences (first sentence often contains main point)
            const firstSentence = m.message.content.split(/[.!?]/)[0];
            if (firstSentence && firstSentence.length > 20 && firstSentence.length < 100) {
                keyPoints.push(firstSentence.trim());
            }
        }
        const summary = [
            `[${messages.length} messages summarized]`,
            topics.size > 0 ? `Topics: ${Array.from(topics).slice(0, 5).join(', ')}` : '',
            keyPoints.length > 0 ? `Key points: ${keyPoints.slice(0, 3).join('; ')}` : ''
        ].filter(Boolean).join(' | ');
        return summary.slice(0, this.config.summaryMaxLength);
    }
    /**
     * Compact conversation to fit within budget
     */
    compactConversation(conversationId, messages, stance) {
        // Score all messages
        const scored = this.processConversation(conversationId, messages, stance);
        // Always preserve the most recent turns
        const minPreserve = Math.min(this.config.minPreservedTurns * 2, // *2 for user+assistant
        scored.length);
        const recentMessages = scored.slice(-minPreserve);
        const olderMessages = scored.slice(0, -minPreserve);
        // Sort older messages by importance
        const sortedOlder = [...olderMessages].sort((a, b) => b.score - a.score);
        // Separate critical messages
        const critical = sortedOlder.filter(m => m.importance === 'critical');
        const nonCritical = sortedOlder.filter(m => m.importance !== 'critical');
        // Group non-critical messages for summarization
        const summaries = [];
        const chunkSize = 6; // Summarize in groups of 6
        for (let i = 0; i < nonCritical.length; i += chunkSize) {
            const chunk = nonCritical.slice(i, i + chunkSize);
            const summary = this.summarizeMessages(chunk);
            if (summary) {
                summaries.push(summary);
            }
        }
        // Build compacted conversation
        const compactedMessages = [];
        // Add summaries as system context at the start
        if (summaries.length > 0) {
            compactedMessages.push({
                role: 'assistant',
                content: `[Prior conversation summary: ${summaries.join(' ')}]`,
                timestamp: new Date()
            });
        }
        // Add critical messages
        for (const m of critical) {
            compactedMessages.push(m.message);
        }
        // Add recent messages
        for (const m of recentMessages) {
            compactedMessages.push(m.message);
        }
        // Calculate savings
        const originalTokens = messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
        const compactedTokens = compactedMessages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
        const result = {
            originalMessages: messages.length,
            compactedMessages: compactedMessages.length,
            tokensSaved: originalTokens - compactedTokens,
            summaries,
            preservedCritical: critical.length
        };
        // Store compaction history
        const history = this.compactionHistory.get(conversationId) || [];
        history.push(result);
        this.compactionHistory.set(conversationId, history);
        return { messages: compactedMessages, result };
    }
    /**
     * Get context status for a conversation
     */
    getContextStatus(messages) {
        const budget = this.calculateBudget(messages);
        const usagePercentage = (budget.usedTokens / budget.conversationAllocation) * 100;
        const needsCompaction = this.needsCompaction(messages);
        let recommendation;
        if (usagePercentage < 50) {
            recommendation = 'Context healthy - no action needed';
        }
        else if (usagePercentage < 80) {
            recommendation = 'Context filling up - consider organizing important points';
        }
        else if (usagePercentage < 95) {
            recommendation = 'Context nearly full - compaction recommended';
        }
        else {
            recommendation = 'Context critical - compaction required';
        }
        return {
            budget,
            usagePercentage,
            needsCompaction,
            recommendation
        };
    }
    /**
     * Get compaction history for a conversation
     */
    getCompactionHistory(conversationId) {
        return this.compactionHistory.get(conversationId) || [];
    }
    /**
     * Extract key insights for long-term memory
     */
    extractKeyInsights(messages, stance) {
        const scored = messages.map((msg, i) => this.scoreMessage(msg, stance, messages.length - i));
        const critical = scored.filter(m => m.importance === 'critical' || m.importance === 'high');
        return critical.map(m => {
            const preview = m.message.content.slice(0, 150);
            return `[${m.importance}] ${m.message.role}: ${preview}...`;
        });
    }
    /**
     * Clear state for a conversation
     */
    clearState(conversationId) {
        this.conversationBuffer.delete(conversationId);
        this.compactionHistory.delete(conversationId);
    }
}
// Singleton instance
export const contextManager = new ContextWindowManager();
//# sourceMappingURL=context-manager.js.map