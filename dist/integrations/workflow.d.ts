/**
 * External Workflow Integration (Ralph Iteration 9, Feature 6)
 *
 * Slack bot for stance monitoring, Discord integration, webhook support,
 * Zapier/IFTTT connectors, and email digest summaries.
 */
import type { Stance } from '../types/index.js';
export interface WorkflowConfig {
    enabledIntegrations: IntegrationType[];
    webhookTimeout: number;
    retryAttempts: number;
    batchEvents: boolean;
    batchInterval: number;
}
export type IntegrationType = 'slack' | 'discord' | 'webhook' | 'zapier' | 'ifttt' | 'email' | 'calendar';
export interface Integration {
    id: string;
    type: IntegrationType;
    name: string;
    config: IntegrationConfig;
    status: 'active' | 'inactive' | 'error';
    lastSync: Date | null;
    errorMessage?: string;
}
export interface IntegrationConfig {
    endpoint?: string;
    apiKey?: string;
    channel?: string;
    webhookUrl?: string;
    email?: string;
    calendarId?: string;
    customHeaders?: Record<string, string>;
}
export interface WorkflowEvent {
    id: string;
    type: EventType;
    timestamp: Date;
    data: EventData;
    source: string;
    processed: boolean;
}
export type EventType = 'stance_changed' | 'operator_applied' | 'threshold_crossed' | 'coherence_alert' | 'session_started' | 'session_ended' | 'goal_achieved' | 'custom';
export interface EventData {
    stance?: Stance;
    previousStance?: Stance;
    operator?: string;
    threshold?: {
        name: string;
        value: number;
        limit: number;
    };
    message?: string;
    metadata?: Record<string, unknown>;
}
export interface SlackMessage {
    channel: string;
    text: string;
    blocks?: SlackBlock[];
    attachments?: SlackAttachment[];
}
export interface SlackBlock {
    type: 'section' | 'divider' | 'header' | 'context' | 'actions';
    text?: {
        type: 'mrkdwn' | 'plain_text';
        text: string;
    };
    elements?: unknown[];
    accessory?: unknown;
}
export interface SlackAttachment {
    color: string;
    title: string;
    text: string;
    fields?: Array<{
        title: string;
        value: string;
        short: boolean;
    }>;
}
export interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: Array<{
        name: string;
        value: string;
        inline: boolean;
    }>;
    timestamp: string;
    footer?: {
        text: string;
    };
}
export interface WebhookPayload {
    event: string;
    timestamp: string;
    data: EventData;
    signature?: string;
}
export interface EmailDigest {
    subject: string;
    recipients: string[];
    body: string;
    format: 'html' | 'text';
    attachments?: Array<{
        name: string;
        content: string;
    }>;
}
export interface CalendarEvent {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: string[];
}
export interface AlertRule {
    id: string;
    name: string;
    condition: AlertCondition;
    actions: AlertAction[];
    enabled: boolean;
    cooldown: number;
    lastTriggered: Date | null;
}
export interface AlertCondition {
    type: 'threshold' | 'change' | 'pattern';
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains';
    value: unknown;
}
export interface AlertAction {
    type: IntegrationType;
    config: IntegrationConfig;
    template?: string;
}
export interface WorkflowStats {
    totalEvents: number;
    eventsByType: Record<EventType, number>;
    integrationsSynced: number;
    alertsTriggered: number;
    failedDeliveries: number;
}
export declare class WorkflowIntegrationManager {
    private config;
    private integrations;
    private events;
    private alertRules;
    private eventQueue;
    private stats;
    private batchTimer;
    constructor(config?: Partial<WorkflowConfig>);
    /**
     * Register an integration
     */
    registerIntegration(type: IntegrationType, name: string, config: IntegrationConfig): Integration;
    /**
     * Activate an integration
     */
    activateIntegration(integrationId: string): boolean;
    /**
     * Deactivate an integration
     */
    deactivateIntegration(integrationId: string): boolean;
    /**
     * Emit a workflow event
     */
    emitEvent(type: EventType, data: EventData, source?: string): WorkflowEvent;
    /**
     * Schedule batch processing
     */
    private scheduleBatchProcessing;
    /**
     * Process event batch
     */
    private processBatch;
    /**
     * Process a single event
     */
    private processEvent;
    /**
     * Deliver event to integration
     */
    private deliverToIntegration;
    /**
     * Deliver to Slack
     */
    private deliverToSlack;
    /**
     * Format Slack message
     */
    formatSlackMessage(event: WorkflowEvent): SlackMessage;
    /**
     * Deliver to Discord
     */
    private deliverToDiscord;
    /**
     * Format Discord embed
     */
    formatDiscordEmbed(event: WorkflowEvent): DiscordEmbed;
    /**
     * Deliver to webhook
     */
    private deliverToWebhook;
    /**
     * Format webhook payload
     */
    formatWebhookPayload(event: WorkflowEvent): WebhookPayload;
    /**
     * Deliver to email
     */
    private deliverToEmail;
    /**
     * Format email digest
     */
    formatEmailDigest(events: WorkflowEvent[]): EmailDigest;
    /**
     * Get event title
     */
    private getEventTitle;
    /**
     * Get event color (for Discord)
     */
    private getEventColor;
    /**
     * Create an alert rule
     */
    createAlertRule(name: string, condition: AlertCondition, actions: AlertAction[], cooldown?: number): AlertRule;
    /**
     * Check alert rules against an event
     */
    private checkAlertRules;
    /**
     * Evaluate an alert condition
     */
    private evaluateCondition;
    /**
     * Trigger an alert
     */
    private triggerAlert;
    /**
     * Schedule a calendar event
     */
    scheduleCalendarEvent(event: CalendarEvent): string;
    /**
     * Generate Zapier webhook payload
     */
    generateZapierPayload(event: WorkflowEvent): Record<string, unknown>;
    /**
     * Generate IFTTT webhook payload
     */
    generateIFTTTPayload(event: WorkflowEvent): Record<string, string>;
    /**
     * Get integration by ID
     */
    getIntegration(integrationId: string): Integration | null;
    /**
     * List integrations
     */
    listIntegrations(type?: IntegrationType): Integration[];
    /**
     * Get event history
     */
    getEventHistory(limit?: number): WorkflowEvent[];
    /**
     * Get alert rules
     */
    getAlertRules(): AlertRule[];
    /**
     * Get statistics
     */
    getStats(): WorkflowStats;
    /**
     * Export configuration
     */
    exportConfig(): Record<string, unknown>;
    /**
     * Reset manager
     */
    reset(): void;
}
export declare const workflowIntegration: WorkflowIntegrationManager;
//# sourceMappingURL=workflow.d.ts.map