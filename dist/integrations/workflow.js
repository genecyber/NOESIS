/**
 * External Workflow Integration (Ralph Iteration 9, Feature 6)
 *
 * Slack bot for stance monitoring, Discord integration, webhook support,
 * Zapier/IFTTT connectors, and email digest summaries.
 */
// ============================================================================
// Workflow Integration Manager
// ============================================================================
export class WorkflowIntegrationManager {
    config;
    integrations = new Map();
    events = [];
    alertRules = new Map();
    eventQueue = [];
    stats;
    batchTimer = null;
    constructor(config = {}) {
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
            eventsByType: {},
            integrationsSynced: 0,
            alertsTriggered: 0,
            failedDeliveries: 0
        };
    }
    /**
     * Register an integration
     */
    registerIntegration(type, name, config) {
        const integration = {
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
    activateIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration)
            return false;
        integration.status = 'active';
        integration.lastSync = new Date();
        return true;
    }
    /**
     * Deactivate an integration
     */
    deactivateIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration)
            return false;
        integration.status = 'inactive';
        return true;
    }
    /**
     * Emit a workflow event
     */
    emitEvent(type, data, source = 'system') {
        const event = {
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
        }
        else {
            this.processEvent(event);
        }
        // Check alert rules
        this.checkAlertRules(event);
        return event;
    }
    /**
     * Schedule batch processing
     */
    scheduleBatchProcessing() {
        if (this.batchTimer)
            return;
        this.batchTimer = setTimeout(() => {
            this.processBatch();
            this.batchTimer = null;
        }, this.config.batchInterval);
    }
    /**
     * Process event batch
     */
    processBatch() {
        const batch = [...this.eventQueue];
        this.eventQueue = [];
        for (const event of batch) {
            this.processEvent(event);
        }
    }
    /**
     * Process a single event
     */
    async processEvent(event) {
        const activeIntegrations = [...this.integrations.values()]
            .filter(i => i.status === 'active');
        for (const integration of activeIntegrations) {
            try {
                await this.deliverToIntegration(integration, event);
                integration.lastSync = new Date();
                this.stats.integrationsSynced++;
            }
            catch (error) {
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
    async deliverToIntegration(integration, event) {
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
    async deliverToSlack(integration, event) {
        const message = this.formatSlackMessage(event);
        // In a real implementation, this would call the Slack API
        console.log(`[Slack:${integration.config.channel}] ${JSON.stringify(message)}`);
    }
    /**
     * Format Slack message
     */
    formatSlackMessage(event) {
        const blocks = [
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
    async deliverToDiscord(_integration, event) {
        const embed = this.formatDiscordEmbed(event);
        // In a real implementation, this would call the Discord webhook
        console.log(`[Discord] ${JSON.stringify(embed)}`);
    }
    /**
     * Format Discord embed
     */
    formatDiscordEmbed(event) {
        const fields = [];
        if (event.data.stance) {
            fields.push({ name: 'Frame', value: event.data.stance.frame, inline: true }, { name: 'Self-Model', value: event.data.stance.selfModel, inline: true }, { name: 'Coherence', value: `${100 - event.data.stance.cumulativeDrift}%`, inline: true });
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
    async deliverToWebhook(integration, event) {
        const payload = this.formatWebhookPayload(event);
        // In a real implementation, this would make an HTTP request
        console.log(`[Webhook:${integration.config.webhookUrl}] ${JSON.stringify(payload)}`);
    }
    /**
     * Format webhook payload
     */
    formatWebhookPayload(event) {
        return {
            event: event.type,
            timestamp: event.timestamp.toISOString(),
            data: event.data
        };
    }
    /**
     * Deliver to email
     */
    async deliverToEmail(integration, event) {
        const digest = this.formatEmailDigest([event]);
        // In a real implementation, this would send an email
        console.log(`[Email:${integration.config.email}] ${digest.subject}`);
    }
    /**
     * Format email digest
     */
    formatEmailDigest(events) {
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
    getEventTitle(type) {
        const titles = {
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
    getEventColor(type) {
        const colors = {
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
    createAlertRule(name, condition, actions, cooldown = 60000) {
        const rule = {
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
    checkAlertRules(event) {
        for (const rule of this.alertRules.values()) {
            if (!rule.enabled)
                continue;
            // Check cooldown
            if (rule.lastTriggered) {
                const elapsed = Date.now() - rule.lastTriggered.getTime();
                if (elapsed < rule.cooldown)
                    continue;
            }
            if (this.evaluateCondition(rule.condition, event)) {
                this.triggerAlert(rule, event);
            }
        }
    }
    /**
     * Evaluate an alert condition
     */
    evaluateCondition(condition, event) {
        let value;
        // Extract value from event based on metric
        if (condition.metric === 'coherence' && event.data.stance) {
            value = 100 - event.data.stance.cumulativeDrift;
        }
        else if (condition.metric === 'frame' && event.data.stance) {
            value = event.data.stance.frame;
        }
        else if (condition.metric === 'eventType') {
            value = event.type;
        }
        else {
            return false;
        }
        // Evaluate condition
        switch (condition.operator) {
            case 'gt':
                return typeof value === 'number' && value > condition.value;
            case 'lt':
                return typeof value === 'number' && value < condition.value;
            case 'eq':
                return value === condition.value;
            case 'ne':
                return value !== condition.value;
            case 'contains':
                return typeof value === 'string' && value.includes(condition.value);
            default:
                return false;
        }
    }
    /**
     * Trigger an alert
     */
    triggerAlert(rule, event) {
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
    scheduleCalendarEvent(event) {
        // In a real implementation, this would integrate with calendar APIs
        const eventId = `cal-${Date.now()}`;
        console.log(`[Calendar] Scheduled: ${event.title} at ${event.startTime.toISOString()}`);
        return eventId;
    }
    /**
     * Generate Zapier webhook payload
     */
    generateZapierPayload(event) {
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
    generateIFTTTPayload(event) {
        return {
            value1: event.type,
            value2: event.data.stance?.frame || '',
            value3: event.data.message || ''
        };
    }
    /**
     * Get integration by ID
     */
    getIntegration(integrationId) {
        return this.integrations.get(integrationId) || null;
    }
    /**
     * List integrations
     */
    listIntegrations(type) {
        const integrations = [...this.integrations.values()];
        if (type) {
            return integrations.filter(i => i.type === type);
        }
        return integrations;
    }
    /**
     * Get event history
     */
    getEventHistory(limit) {
        const events = [...this.events];
        return limit ? events.slice(-limit) : events;
    }
    /**
     * Get alert rules
     */
    getAlertRules() {
        return [...this.alertRules.values()];
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Export configuration
     */
    exportConfig() {
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
    reset() {
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
            eventsByType: {},
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
//# sourceMappingURL=workflow.js.map