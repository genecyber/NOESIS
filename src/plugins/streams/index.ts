/**
 * Streams Plugin
 *
 * Provides WebSocket-based pipable streams for agent scripts.
 * Allows external processes to pipe data to the web UI in real-time.
 */

import type { Plugin, PluginContext, PluginManifest } from '../sdk.js';
import { pluginEventBus } from '../event-bus.js';
import { streamManager, StreamManager } from './stream-manager.js';

export const streamsManifest: PluginManifest = {
  name: 'streams',
  version: '1.0.0',
  description: 'WebSocket-based pipable streams for real-time data from external processes',
  author: 'Metamorph Team',
  hooks: [],
  settings: [
    {
      key: 'maxHistoryPerStream',
      type: 'number' as const,
      label: 'Max History Per Stream',
      description: 'Maximum number of events to keep in history per stream',
      default: 1000,
    },
    {
      key: 'maxStreamsPerSession',
      type: 'number' as const,
      label: 'Max Streams Per Session',
      description: 'Maximum number of concurrent streams per session',
      default: 50,
    },
  ],
};

export class StreamsPlugin implements Plugin {
  private context: PluginContext | null = null;
  private unsubscribers: Array<() => void> = [];

  get manifest(): PluginManifest {
    return streamsManifest;
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Streams plugin initialized');
  }

  async activate(): Promise<void> {
    if (!this.context) return;

    // Forward stream events to plugin event bus
    const onCreated = (data: { channel: string; sessionId: string; info: unknown }) => {
      pluginEventBus.emit('stream:created', data);
    };

    const onEvent = (data: { channel: string; event: unknown }) => {
      pluginEventBus.emit('stream:event', data);
    };

    const onClosed = (data: { channel: string; reason?: string }) => {
      pluginEventBus.emit('stream:closed', data);
    };

    const onValidationError = (data: { channel: string; errors?: string[] }) => {
      pluginEventBus.emit('stream:validation_error', data);
    };

    streamManager.on('stream:created', onCreated);
    streamManager.on('stream:event', onEvent);
    streamManager.on('stream:closed', onClosed);
    streamManager.on('stream:validation_error', onValidationError);

    this.unsubscribers.push(
      () => streamManager.off('stream:created', onCreated),
      () => streamManager.off('stream:event', onEvent),
      () => streamManager.off('stream:closed', onClosed),
      () => streamManager.off('stream:validation_error', onValidationError)
    );

    this.context.logger.info('Streams plugin activated');
  }

  async deactivate(): Promise<void> {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    this.context?.logger.info('Streams plugin deactivated');
  }

  async dispose(): Promise<void> {
    await this.deactivate();
    this.context = null;
  }
}

// Export singleton and manager
export { streamManager, StreamManager };
export * from './types.js';
