/**
 * ElizaOS Integration - Ralph Iteration 4 Feature 5
 *
 * Research and integration layer for ElizaOS agent discovery.
 * ElizaOS is an open-source AI agent framework that enables
 * multi-agent coordination and shared memory.
 *
 * Research Notes:
 * - ElizaOS provides agent discovery via runtime plugins
 * - Agents expose capabilities through character definitions
 * - Memory can be shared across agents via adapters
 * - Integration requires runtime registration
 *
 * See: https://github.com/elizaOS/eliza
 */
/**
 * ElizaOS Agent Character (simplified)
 * Based on ElizaOS character schema
 */
export interface ElizaCharacter {
    name: string;
    description: string;
    modelProvider?: string;
    bio: string[];
    lore: string[];
    knowledge: string[];
    topics: string[];
    style: {
        all: string[];
        chat: string[];
        post: string[];
    };
    adjectives: string[];
}
/**
 * ElizaOS Agent Discovery Result
 */
export interface DiscoveredAgent {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    endpoint?: string;
    status: 'online' | 'offline' | 'unknown';
    lastSeen?: Date;
}
/**
 * ElizaOS Integration Configuration
 */
export interface ElizaConfig {
    enabled: boolean;
    discoveryEndpoint?: string;
    refreshInterval: number;
    timeout: number;
}
/**
 * ElizaOS Integration Manager
 *
 * Note: This is a research stub. Full implementation requires:
 * 1. ElizaOS runtime dependency
 * 2. Agent discovery protocol implementation
 * 3. Memory adapter integration
 * 4. Character definition parser
 */
declare class ElizaOSIntegration {
    private config;
    private discoveredAgents;
    private lastDiscovery;
    /**
     * Set configuration
     */
    setConfig(config: Partial<ElizaConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): ElizaConfig;
    /**
     * Enable ElizaOS integration
     */
    enable(endpoint?: string): void;
    /**
     * Disable ElizaOS integration
     */
    disable(): void;
    /**
     * Discover available ElizaOS agents
     * Note: Stub implementation - real discovery requires network calls
     */
    discoverAgents(): Promise<DiscoveredAgent[]>;
    /**
     * Register a local agent for discovery by others
     */
    registerAgent(character: ElizaCharacter): Promise<boolean>;
    /**
     * Send message to discovered ElizaOS agent
     */
    sendToAgent(agentId: string, message: string): Promise<string | null>;
    /**
     * Get list of discovered agents
     */
    getDiscoveredAgents(): DiscoveredAgent[];
    /**
     * Get last discovery timestamp
     */
    getLastDiscovery(): Date | null;
    /**
     * Check if integration is available
     */
    isAvailable(): boolean;
    /**
     * Get integration status
     */
    getStatus(): {
        enabled: boolean;
        endpoint: string | undefined;
        agentCount: number;
        lastDiscovery: Date | null;
    };
    /**
     * Generate METAMORPH character for ElizaOS compatibility
     */
    generateMetamorphCharacter(): ElizaCharacter;
}
export declare const elizaOSIntegration: ElizaOSIntegration;
export {};
//# sourceMappingURL=eliza-os.d.ts.map