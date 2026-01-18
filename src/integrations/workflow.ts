/**
 * External Workflow Integration (Ralph Iteration 9, Feature 6)
 *
 * Slack bot for stance monitoring, Discord integration, webhook support,
 * Zapier/IFTTT connectors, and email digest summaries.
 */

import type { Stance } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowConfig {
  enabledIntegrations: IntegrationType[];
  webhookTimeout: number;
  retryAttempts: number;
  batchEvents: boolean;
  batchInterval: number;  // milliseconds
}

export type IntegrationType =
  | 'slack'
  | 'discord'
  | 'webhook'
  | 'zapier'
  | 'ifttt'
  | 'email'
  | 'calendar';

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

export type EventType =
  | 'stance_changed'
  | 'operator_applied'
  | 'threshold_crossed'
  | 'coherence_alert'
  | 'session_started'
  | 'session_ended'
  | 'goal_achieved'
  | 'custom';

export interface EventData {
  stance?: Stance;
  previousStance?: Stance;
  operator?: string;
  threshold?: { name: string; value: number; limit: number };
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
  text?: { type: 'mrkdwn' | 'plain_text'; text: string };
  elements?: unknown[];
  accessory?: unknown;
}

export interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields?: Array<{ title: string; value: string; short: boolean }>;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline: boolean }>;
  timestamp: string;
  footer?: { text: string };
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
  attachments?: Array<{ name: string; content: string }>;
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
  cooldown: number;  // milliseconds
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

// ============================================================================
// Workflow Integration Manager
// ============================================================================

export class WorkflowIntegrationManager {
  private config: WorkflowConfig;
  private integrations: Map<string, Integration> = new Map();
  private events: WorkflowEvent[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private eventQueue: WorkflowEvent[] = [];
  private stats: WorkflowStats;
  private batchTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = {
      enabledIntegrations: ['webhook', 'slack', 'discord'],
      webhookTimeout: 10000,
      retryAttempts: 3,
      batchEvents: true,
      batchInterval: 5000,
      ...config
    };

    this.stats = {
      totalEvents: 0,
      eventsByType: {} as Record<EventType, number>,
      integrationsSynced: 0,
      alertsTriggered: 0,
      failedDeliveries: 0
    };
  }

  /**
   * Register an integration
   */
  registerIntegration(
    type: IntegrationType,
    name: string,
    config: IntegrationConfig
  ): Integration {
    const integration: Integration = {
      id: `int-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      config,
      status: 'inactive',
      lastSync: null
    };

    this.integrations.set(integration.id, integration);
    return integration;
  }

  /**
   * Activate an integration
   */
  activateIntegration(integrationId: string): boolean {
    const integration = this.integrations.get(integrationId);
    if (!integration) return false;

    integration.status = 'active';
    integration.lastSync = new Date();
    return true;
  }

  /**
   * Deactivate an integration
   */
  deactivateIntegration(integrationId: string): boolean {
    const integration = this.integrations.get(integrationId);
    if (!integration) return false;

    integration.status = 'inactive';
    return true;
  }

  /**
   * Emit a workflow event
   */
  emitEvent(type: EventType, data: EventData, source: string = 'system'): WorkflowEvent {
    const event: WorkflowEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
      source,
      processed: false
    };

    this.events.push(event);
    this.stats.totalEvents++;
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1;

    if (this.config.batchEvents) {
      this.eventQueue.push(event);
      this.scheduleBatchProcessing();
    } else {
      this.processEvent(event);
    }

    // Check alert rules
    this.checkAlertRules(event);

    return event;
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, this.config.batchInterval);
  }

  /**
   * Process event batch
   */
  private processBatch(): void {
    const batch = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of batch) {
      this.processEvent(event);
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: WorkflowEvent): Promise<void> {
    const activeIntegrations = [...this.integrations.values()]
      .filter(i => i.status === 'active');

    for (const integration of activeIntegrations) {
      try {
        await this.deliverToIntegration(integration, event);
        integration.lastSync = new Date();
        this.stats.integrationsSynced++;
      } catch (error) {
        integration.status = 'error';
        integration.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.stats.failedDeliveries++;
      }
    }

    event.processed = true;
  }

  /**
   * Deliver event to integration
   */
  private async deliverToIntegration(
    integration: Integration,
    event: WorkflowEvent
  ): Promise<void> {
    switch (integration.type) {
      case 'slack':
        await this.deliverToSlack(integration, event);
        break;
      case 'discord':
        await this.deliverToDiscord(integration, event);
        break;
      case 'webhook':
        await this.deliverToWebhook(integration, event);
        break;
      case 'email':
        await this.deliverToEmail(integration, event);
        break;
      // Other integrations...
    }
  }

  /**
   * Deliver to Slack
   */
  private async deliverToSlack(
    integration: Integration,
    event: WorkflowEvent
  ): Promise<void> {
    const message = this.formatSlackMessage(event);
    // In a real implementation, this would call the Slack API
    console.log(`[Slack:${integration.config.channel}] ${JSON.stringify(message)}`);
  }

  /**
   * Format Slack message
   */
  formatSlackMessage(event: WorkflowEvent): SlackMessage {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: this.getEventTitle(event.type) }
      },
      { type: 'divider' }
    ];

    if (event.data.stance) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Frame:* ${event.data.stance.frame}\n*Self-Model:* ${event.data.stance.selfModel}\n*Coherence:* ${100 - event.data.stance.cumulativeDrift}%`
        }
      });
    }

    if (event.data.message) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: event.data.message }
      });
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_${event.timestamp.toISOString()}_` }]
    });

    return {
      channel: '#metamorph',
      text: this.getEventTitle(event.type),
      blocks
    };
  }

  /**
   * Deliver to Discord
   */
  private async deliverToDiscord(
    _integration: Integration,
    event: WorkflowEvent
  ): Promise<void> {
    const embed = this.formatDiscordEmbed(event);
    // In a real implementation, this would call the Discord webhook
    console.log(`[Discord] ${JSON.stringify(embed)}`);
  }

  /**
   * Format Discord embed
   */
  formatDiscordEmbed(event: WorkflowEvent): DiscordEmbed {
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];

    if (event.data.stance) {
      fields.push(
        { name: 'Frame', value: event.data.stance.frame, inline: true },
        { name: 'Self-Model', value: event.data.stance.selfModel, inline: true },
        { name: 'Coherence', value: `${100 - event.data.stance.cumulativeDrift}%`, inline: true }
      );
    }

    if (event.data.operator) {
      fields.push({ name: 'Operator', value: event.data.operator, inline: true });
    }

    return {
      title: this.getEventTitle(event.type),
      description: event.data.message || '',
      color: this.getEventColor(event.type),
      fields,
      timestamp: event.timestamp.toISOString(),
      footer: { text: 'Metamorph' }
    };
  }

  /**
   * Deliver to webhook
   */
  private async deliverToWebhook(
    integration: Integration,
    event: WorkflowEvent
  ): Promise<void> {
    const payload = this.formatWebhookPayload(event);
    // In a real implementation, this would make an HTTP request
    console.log(`[Webhook:${integration.config.webhookUrl}] ${JSON.stringify(payload)}`);
  }

  /**
   * Format webhook payload
   */
  formatWebhookPayload(event: WorkflowEvent): WebhookPayload {
    return {
      event: event.type,
      timestamp: event.timestamp.toISOString(),
      data: event.data
    };
  }

  /**
   * Deliver to email
   */
  private async deliverToEmail(
    integration: Integration,
    event: WorkflowEvent
  ): Promise<void> {
    const digest = this.formatEmailDigest([event]);
    // In a real implementation, this would send an email
    console.log(`[Email:${integration.config.email}] ${digest.subject}`);
  }

  /**
   * Format email digest
   */
  formatEmailDigest(events: WorkflowEvent[]): EmailDigest {
    let body = '<h1>Metamorph Event Summary</h1>\n';

    for (const event of events) {
      body += `<h2>${this.getEventTitle(event.type)}</h2>\n`;
      body += `<p>Time: ${event.timestamp.toISOString()}</p>\n`;

      if (event.data.stance) {
        body += `<ul>
          <li>Frame: ${event.data.stance.frame}</li>
          <li>Self-Model: ${event.data.stance.selfModel}</li>
          <li>Coherence: ${100 - event.data.stance.cumulativeDrift}%</li>
        </ul>\n`;
      }

      if (event.data.message) {
        body += `<p>${event.data.message}</p>\n`;
      }
    }

    return {
      subject: `Metamorph: ${events.length} event(s)`,
      recipients: [],
      body,
      format: 'html'
    };
  }

  /**
   * Get event title
   */
  private getEventTitle(type: EventType): string {
    const titles: Record<EventType, string> = {
      stance_changed: 'Stance Changed',
      operator_applied: 'Operator Applied',
      threshold_crossed: 'Threshold Crossed',
      coherence_alert: 'Coherence Alert',
      session_started: 'Session Started',
      session_ended: 'Session Ended',
      goal_achieved: 'Goal Achieved',
      custom: 'Custom Event'
    };
    return titles[type] || 'Event';
  }

  /**
   * Get event color (for Discord)
   */
  private getEventColor(type: EventType): number {
    const colors: Record<EventType, number> = {
      stance_changed: 0x3498DB,
      operator_applied: 0x2ECC71,
      threshold_crossed: 0xF39C12,
      coherence_alert: 0xE74C3C,
      session_started: 0x9B59B6,
      session_ended: 0x95A5A6,
      goal_achieved: 0x27AE60,
      custom: 0x7F8C8D
    };
    return colors[type] || 0x7F8C8D;
  }

  /**
   * Create an alert rule
   */
  createAlertRule(
    name: string,
    condition: AlertCondition,
    actions: AlertAction[],
    cooldown: number = 60000
  ): AlertRule {
    const rule: AlertRule = {
      id: `alert-${Date.now()}`,
      name,
      condition,
      actions,
      enabled: true,
      cooldown,
      lastTriggered: null
    };

    this.alertRules.set(rule.id, rule);
    return rule;
  }

  /**
   * Check alert rules against an event
   */
  private checkAlertRules(event: WorkflowEvent): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const elapsed = Date.now() - rule.lastTriggered.getTime();
        if (elapsed < rule.cooldown) continue;
      }

      if (this.evaluateCondition(rule.condition, event)) {
        this.triggerAlert(rule, event);
      }
    }
  }

  /**
   * Evaluate an alert condition
   */
  private evaluateCondition(condition: AlertCondition, event: WorkflowEvent): boolean {
    let value: unknown;

    // Extract value from event based on metric
    if (condition.metric === 'coherence' && event.data.stance) {
      value = 100 - event.data.stance.cumulativeDrift;
    } else if (condition.metric === 'frame' && event.data.stance) {
      value = event.data.stance.frame;
    } else if (condition.metric === 'eventType') {
      value = event.type;
    } else {
      return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string);
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, event: WorkflowEvent): void {
    rule.lastTriggered = new Date();
    this.stats.alertsTriggered++;

    for (const action of rule.actions) {
      const integration = [...this.integrations.values()]
        .find(i => i.type === action.type && i.status === 'active');

      if (integration) {
        this.deliverToIntegration(integration, event);
      }
    }
  }

  /**
   * Schedule a calendar event
   */
  scheduleCalendarEvent(event: CalendarEvent): string {
    // In a real implementation, this would integrate with calendar APIs
    const eventId = `cal-${Date.now()}`;
    console.log(`[Calendar] Scheduled: ${event.title} at ${event.startTime.toISOString()}`);
    return eventId;
  }

  /**
   * Generate Zapier webhook payload
   */
  generateZapierPayload(event: WorkflowEvent): Record<string, unknown> {
    return {
      trigger: event.type,
      timestamp: event.timestamp.toISOString(),
      frame: event.data.stance?.frame,
      selfModel: event.data.stance?.selfModel,
      coherence: event.data.stance ? 100 - event.data.stance.cumulativeDrift : null,
      message: event.data.message,
      metadata: event.data.metadata
    };
  }

  /**
   * Generate IFTTT webhook payload
   */
  generateIFTTTPayload(event: WorkflowEvent): Record<string, string> {
    return {
      value1: event.type,
      value2: event.data.stance?.frame || '',
      value3: event.data.message || ''
    };
  }

  /**
   * Get integration by ID
   */
  getIntegration(integrationId: string): Integration | null {
    return this.integrations.get(integrationId) || null;
  }

  /**
   * List integrations
   */
  listIntegrations(type?: IntegrationType): Integration[] {
    const integrations = [...this.integrations.values()];
    if (type) {
      return integrations.filter(i => i.type === type);
    }
    return integrations;
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): WorkflowEvent[] {
    const events = [...this.events];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules.values()];
  }

  /**
   * Get statistics
   */
  getStats(): WorkflowStats {
    return { ...this.stats };
  }

  /**
   * Export configuration
   */
  exportConfig(): Record<string, unknown> {
    return {
      config: this.config,
      integrations: [...this.integrations.values()].map(i => ({
        type: i.type,
        name: i.name,
        status: i.status
      })),
      alertRules: [...this.alertRules.values()]
    };
  }

  /**
   * Reset manager
   */
  reset(): void {
    this.integrations.clear();
    this.events = [];
    this.alertRules.clear();
    this.eventQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.stats = {
      totalEvents: 0,
      eventsByType: {} as Record<EventType, number>,
      integrationsSynced: 0,
      alertsTriggered: 0,
      failedDeliveries: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const workflowIntegration = new WorkflowIntegrationManager();
