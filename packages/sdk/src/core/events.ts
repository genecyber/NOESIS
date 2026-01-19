/**
 * METAMORPH Plugin SDK - Event Bus
 *
 * Type-safe event emission and subscription for plugins.
 */

import type {
  PluginEventType,
  PluginEventHandler,
  PluginEventSubscription,
  EmotionContext,
  Stance,
  ModeConfig,
} from './types.js';

// =============================================================================
// Event Data Types
// =============================================================================

/**
 * Type-safe event data mapping.
 */
export interface PluginEventData {
  'turn:start': {
    message: string;
    stance: Stance;
    hasVision?: boolean;
  };
  'turn:complete': {
    response: {
      text: string;
      toolsUsed: string[];
      operatorsApplied: string[];
    };
  };
  'stance:changed': {
    before: Stance;
    after: Stance;
  };
  'config:changed': {
    config: ModeConfig;
  };
  'config:empathyMode': boolean;
  'emotion:detected': EmotionContext;
  'emotion:vision_request': {
    imageSize: number;
    prompt?: string;
    timestamp?: number;
  };
  'memory:added': {
    memory: {
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    };
  };
  'operator:applied': {
    operator: string;
    result: {
      success: boolean;
      stanceDelta?: Partial<Stance>;
      error?: string;
    };
  };
  'camera:frame': {
    frame: {
      data: Uint8Array | string;
      width: number;
      height: number;
      format: 'rgb' | 'rgba' | 'jpeg' | 'png';
      timestamp: number;
    };
  };
}

// =============================================================================
// Event Bus Implementation
// =============================================================================

/**
 * Plugin event bus for inter-plugin communication.
 */
export class PluginEventBus {
  private handlers: Map<PluginEventType, Set<PluginEventHandler<unknown>>> = new Map();
  private debugMode: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debugMode = options?.debug ?? false;
  }

  /**
   * Emit an event to all registered handlers.
   * Handlers are called asynchronously (fire-and-forget).
   */
  emit<T extends PluginEventType>(event: T, data: PluginEventData[T]): void {
    if (this.debugMode) {
      console.debug(`[PluginEventBus] Emitting: ${event}`, data);
    }

    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    for (const handler of eventHandlers) {
      Promise.resolve()
        .then(() => handler(data))
        .catch((error) => {
          console.error(
            `[PluginEventBus] Error in handler for event '${event}':`,
            error
          );
        });
    }
  }

  /**
   * Subscribe to an event.
   * @returns Subscription object with unsubscribe method
   */
  on<T extends PluginEventType>(
    event: T,
    handler: PluginEventHandler<PluginEventData[T]>
  ): PluginEventSubscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const eventHandlers = this.handlers.get(event)!;
    eventHandlers.add(handler as PluginEventHandler<unknown>);

    if (this.debugMode) {
      console.debug(
        `[PluginEventBus] Handler registered for: ${event} (total: ${eventHandlers.size})`
      );
    }

    return {
      unsubscribe: () => this.off(event, handler),
    };
  }

  /**
   * Unsubscribe a handler from an event.
   */
  off<T extends PluginEventType>(
    event: T,
    handler: PluginEventHandler<PluginEventData[T]>
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler as PluginEventHandler<unknown>);

      if (this.debugMode) {
        console.debug(
          `[PluginEventBus] Handler removed for: ${event} (remaining: ${eventHandlers.size})`
        );
      }
    }
  }

  /**
   * Subscribe to an event once.
   */
  once<T extends PluginEventType>(
    event: T,
    handler: PluginEventHandler<PluginEventData[T]>
  ): PluginEventSubscription {
    const wrappedHandler: PluginEventHandler<PluginEventData[T]> = (data) => {
      this.off(event, wrappedHandler);
      return handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * Remove all listeners for a specific event or all events.
   */
  removeAllListeners(event?: PluginEventType): void {
    if (event) {
      this.handlers.delete(event);
      if (this.debugMode) {
        console.debug(`[PluginEventBus] All handlers removed for: ${event}`);
      }
    } else {
      this.handlers.clear();
      if (this.debugMode) {
        console.debug(`[PluginEventBus] All handlers removed for all events`);
      }
    }
  }

  /**
   * Get the number of handlers for a specific event.
   */
  listenerCount(event: PluginEventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Get all registered event types.
   */
  eventNames(): PluginEventType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Enable or disable debug mode.
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

/**
 * Global plugin event bus instance.
 */
export const pluginEventBus = new PluginEventBus();
