/**
 * MCP Tool Integration - Ralph Iteration 4 Feature 6
 *
 * Integration layer for Model Context Protocol (MCP) tools.
 * This enables METAMORPH to use external MCP servers and tools
 * like those from Hustle-v5 and other MCP-compatible providers.
 *
 * MCP Overview:
 * - Model Context Protocol is a standard for LLM tool integration
 * - Tools expose capabilities via JSON-RPC over stdio/HTTP
 * - Claude Code and other clients can discover and use MCP tools
 *
 * See: https://modelcontextprotocol.io/
 */
/**
 * MCP Tool Definition
 */
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, MCPPropertySchema>;
        required?: string[];
    };
}
/**
 * MCP Property Schema
 */
export interface MCPPropertySchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    items?: MCPPropertySchema;
    default?: unknown;
}
/**
 * MCP Server Definition
 */
export interface MCPServer {
    name: string;
    description: string;
    version: string;
    tools: MCPTool[];
    transport: 'stdio' | 'http' | 'websocket';
    endpoint?: string;
}
/**
 * MCP Tool Result
 */
export interface MCPToolResult {
    success: boolean;
    result?: unknown;
    error?: string;
    executionTime?: number;
}
/**
 * MCP Integration Configuration
 */
export interface MCPConfig {
    enabled: boolean;
    servers: MCPServerConfig[];
    timeout: number;
    retries: number;
}
export interface MCPServerConfig {
    name: string;
    command?: string;
    args?: string[];
    endpoint?: string;
    enabled: boolean;
}
/**
 * Hustle-v5 MCP Tools
 *
 * Common tools from Hustle-v5 that could be integrated:
 * - Web search and fetch
 * - File operations
 * - Code execution
 * - Database queries
 */
export declare const HUSTLE_V5_TOOLS: MCPTool[];
/**
 * MCP Integration Manager
 */
declare class MCPIntegration {
    private config;
    private connectedServers;
    private toolRegistry;
    /**
     * Set configuration
     */
    setConfig(config: Partial<MCPConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): MCPConfig;
    /**
     * Enable MCP integration
     */
    enable(): void;
    /**
     * Disable MCP integration
     */
    disable(): void;
    /**
     * Add server configuration
     */
    addServer(server: MCPServerConfig): void;
    /**
     * Remove server configuration
     */
    removeServer(name: string): boolean;
    /**
     * Connect to MCP server
     * Note: Stub implementation - real connection requires MCP client
     */
    connectServer(name: string): Promise<boolean>;
    /**
     * Disconnect from server
     */
    disconnectServer(name: string): void;
    /**
     * Disconnect all servers
     */
    disconnectAll(): void;
    /**
     * Get available tools
     */
    getAvailableTools(): MCPTool[];
    /**
     * Get tool by name
     */
    getTool(name: string): MCPTool | undefined;
    /**
     * Execute MCP tool
     * Note: Stub implementation
     */
    executeTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult>;
    /**
     * Get connected servers
     */
    getConnectedServers(): MCPServer[];
    /**
     * Get integration status
     */
    getStatus(): {
        enabled: boolean;
        configuredServers: number;
        connectedServers: number;
        availableTools: number;
    };
    /**
     * Generate METAMORPH tools for MCP exposure
     */
    generateMetamorphTools(): MCPTool[];
}
export declare const mcpIntegration: MCPIntegration;
export {};
//# sourceMappingURL=mcp-tools.d.ts.map