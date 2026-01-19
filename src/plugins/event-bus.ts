/**
 * Plugin Event Bus (Ralph Iteration 8)
 *
 * Central event bus for plugin communication with the Metamorph agent.
 * Provides type-safe event emission and subscription.
 */

import type { Stance, MemoryEntry, EmotionContext } from '../types/index.js';

// ============================================================================
// Event Types
// ============================================================================

/**
 * All plugin event types
 */
export type PluginEventType =
  | 'turn:start'
  | 'turn:complete'
  | 'stance:changed'
  | 'config:changed'
  | 'config:empathyMode'
  | 'camera:frame'
  | 'emotion:detected'
  | 'emotion:vision_request'
  | 'memory:added'
  | 'operator:applied';

/**
 * Type-safe event data mapping
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
    config: Record<string, unknown>;
  };
  'config:empathyMode': boolean;
  'camera:frame': {
    frame: {
      data: Uint8Array | string;
      width: number;
      height: number;
      format: 'rgb' | 'rgba' | 'jpeg' | 'png';
      timestamp: number;
    };
  };
  'emotion:detected': EmotionContext;
  'emotion:vision_request': {
    imageSize: number;
    prompt?: string;
    timestamp?: number;
  };
  'memory:added': {
    memory: MemoryEntry;
  };
  'operator:applied': {
    operator: string;
    result: {
      success: boolean;
      stanceDelta?: Partial<Stance>;
      error?: string;
    };
  };
}

/**
 * Type-safe event handler
 */
export type PluginEventHandler<T extends PluginEventType> = (
  data: PluginEventData[T]
) => void | Promise<void>;

// ============================================================================
// Event Bus Implementation
// ============================================================================

/**
 * Plugin Event Bus
 *
 * Features:
 * - Type-safe event emission and subscription
 * - Fire-and-forget async handler execution
 * - Unsubscribe function returned from on()
 * - Debug logging for event emissions
 */
export class PluginEventBus {
  private handlers: Map<PluginEventType, Set<PluginEventHandler<any>>>;
  private debugMode: boolean;

  constructor(options?: { debug?: boolean }) {
    this.handlers = new Map();
    this.debugMode = options?.debug ?? false;
  }

  /**
   * Emit an event to all registered handlers
   *
   * Handlers are called asynchronously (fire-and-forget).
   * Errors in handlers are caught and logged, not propagated.
   */
  emit<T extends PluginEventType>(event: T, data: PluginEventData[T]): void {
    if (this.debugMode) {
      console.debug(`[PluginEventBus] Emitting: ${event}`, data);
    }

    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    // Fire-and-forget async execution for all handlers
    for (const handler of eventHandlers) {
      // Execute handler asynchronously without awaiting
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
   * Subscribe to an event
   *
   * @param event - The event type to subscribe to
   * @param handler - The handler function to call when the event is emitted
   * @returns An unsubscribe function
   */
  on<T extends PluginEventType>(
    event: T,
    handler: PluginEventHandler<T>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const eventHandlers = this.handlers.get(event)!;
    eventHandlers.add(handler);

    if (this.debugMode) {
      console.debug(
        `[PluginEventBus] Handler registered for: ${event} (total: ${eventHandlers.size})`
      );
    }

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a handler from an event
   */
  off<T extends PluginEventType>(
    event: T,
    handler: PluginEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);

      if (this.debugMode) {
        console.debug(
          `[PluginEventBus] Handler removed for: ${event} (remaining: ${eventHandlers.size})`
        );
      }
    }
  }

  /**
   * Remove all listeners for a specific event or all events
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
   * Get the number of handlers for a specific event
   */
  listenerCount(event: PluginEventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Get all registered event types
   */
  eventNames(): PluginEventType[] {
    return [...this.handlers.keys()];
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global plugin event bus instance
 */
export const pluginEventBus = new PluginEventBus();
