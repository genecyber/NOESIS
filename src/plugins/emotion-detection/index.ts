/**
 * Emotion Detection Plugin
 *
 * Webcam-based facial emotion detection using face-api.js.
 * Provides real-time emotional awareness for the operator.
 *
 * Features:
 * - Real-time facial emotion detection (7 emotions)
 * - Valence/arousal calculation
 * - Emotion stability tracking
 * - Empathy boost suggestions
 * - Natural language prompt context
 *
 * Usage:
 * 1. Initialize and activate the plugin
 * 2. Subscribe to 'emotion:detected' events or call getEmotionalContext()
 * 3. Use suggestedEmpathyBoost to adjust response empathy
 * 4. Include promptContext in system prompts for emotional awareness
 */

import type { Plugin, PluginContext } from '../sdk.js';
import { pluginEventBus } from '../event-bus.js';
import { emotionDetectionManifest } from './manifest.js';
import { FaceApiDetector } from './face-api-detector.js';
import { EmotionProcessor } from './emotion-processor.js';
import type { OperatorEmotionContext, CameraFrame } from './types.js';

/**
 * Minimum confidence change to emit a new emotion event
 */
const SIGNIFICANT_CHANGE_THRESHOLD = 0.15;

/**
 * Emotion Detection Plugin
 *
 * Implements the Plugin interface from the Metamorph SDK.
 * Subscribes to camera:frame events and emits emotion:detected events.
 */
export class EmotionDetectionPlugin implements Plugin {
  private context: PluginContext | null = null;
  private detector: FaceApiDetector;
  private processor: EmotionProcessor;
  private currentContext: OperatorEmotionContext | null = null;
  private unsubscribeCamera: (() => void) | null = null;
  private lastEmittedEmotion: string | null = null;
  private isActive: boolean = false;
  private processingFrame: boolean = false;

  constructor(modelsPath?: string) {
    this.detector = new FaceApiDetector(modelsPath);
    this.processor = new EmotionProcessor();
  }

  /**
   * Plugin manifest
   */
  get manifest() {
    return emotionDetectionManifest;
  }

  /**
   * Initialize the plugin with context
   * Loads face-api.js models
   */
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Initializing emotion detection plugin...');

    try {
      await this.detector.initialize();
      context.logger.info('Emotion detection models loaded');
    } catch (error) {
      context.logger.error(
        'Failed to load emotion detection models:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Activate the plugin
   * Subscribes to camera:frame events
   */
  async activate(): Promise<void> {
    if (!this.context) {
      throw new Error('Plugin not initialized');
    }

    if (this.isActive) {
      this.context.logger.warn('Plugin already active');
      return;
    }

    this.context.logger.info('Activating emotion detection...');

    // Subscribe to camera frames
    this.unsubscribeCamera = pluginEventBus.on(
      'camera:frame',
      (data) => this.handleFrame(data.frame)
    );

    this.isActive = true;
    this.context.logger.info('Emotion detection activated');
  }

  /**
   * Deactivate the plugin
   * Unsubscribes from camera:frame events
   */
  async deactivate(): Promise<void> {
    if (!this.context) {
      return;
    }

    this.context.logger.info('Deactivating emotion detection...');

    // Unsubscribe from camera frames
    if (this.unsubscribeCamera) {
      this.unsubscribeCamera();
      this.unsubscribeCamera = null;
    }

    this.isActive = false;
    this.context.logger.info('Emotion detection deactivated');
  }

  /**
   * Dispose of plugin resources
   */
  async dispose(): Promise<void> {
    await this.deactivate();

    this.detector.dispose();
    this.processor.clearHistory();
    this.currentContext = null;
    this.context = null;
  }

  /**
   * Get the current emotional context
   * Returns null if no valid detection has occurred
   */
  getEmotionalContext(): OperatorEmotionContext | null {
    return this.currentContext;
  }

  /**
   * Check if the plugin is active
   */
  isPluginActive(): boolean {
    return this.isActive;
  }

  /**
   * Check if the detector is ready
   */
  isDetectorReady(): boolean {
    return this.detector.isInitialized();
  }

  /**
   * Clear emotion history and reset state
   */
  reset(): void {
    this.processor.clearHistory();
    this.currentContext = null;
    this.lastEmittedEmotion = null;
  }

  /**
   * Handle incoming camera frames
   * Processes frames through face-api and updates emotional context
   */
  private async handleFrame(frame: CameraFrame): Promise<void> {
    // Skip if already processing a frame
    if (this.processingFrame) {
      return;
    }

    // Skip if detector not ready
    if (!this.detector.isInitialized()) {
      return;
    }

    this.processingFrame = true;

    try {
      // Convert frame data to buffer
      const imageData = this.frameToBuffer(frame);

      // Detect emotions
      const faces = await this.detector.detectEmotions(imageData);

      // Process detections
      const emotionContext = this.processor.processDetection(faces);

      if (emotionContext) {
        this.currentContext = emotionContext;

        // Emit event if emotion changed significantly
        if (this.shouldEmitChange(emotionContext)) {
          this.emitEmotionDetected(emotionContext);
        }
      }
    } catch (error) {
      this.context?.logger.error(
        'Error processing frame:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      this.processingFrame = false;
    }
  }

  /**
   * Convert camera frame to buffer for face-api
   */
  private frameToBuffer(frame: CameraFrame): Buffer | string {
    if (typeof frame.data === 'string') {
      return frame.data; // Already base64
    }

    // Convert Uint8Array to Buffer
    return Buffer.from(frame.data);
  }

  /**
   * Determine if the emotion change is significant enough to emit
   */
  private shouldEmitChange(context: OperatorEmotionContext): boolean {
    // Always emit if no previous emission
    if (!this.lastEmittedEmotion) {
      return true;
    }

    // Emit if emotion changed
    if (context.currentEmotion !== this.lastEmittedEmotion) {
      return true;
    }

    // Emit if confidence changed significantly
    // (would need to track last confidence, simplified here)
    return context.confidence >= SIGNIFICANT_CHANGE_THRESHOLD;
  }

  /**
   * Emit emotion:detected event
   */
  private emitEmotionDetected(context: OperatorEmotionContext): void {
    this.lastEmittedEmotion = context.currentEmotion;

    // Emit the full emotion context
    pluginEventBus.emit('emotion:detected', {
      currentEmotion: context.currentEmotion,
      valence: context.valence,
      arousal: context.arousal,
      confidence: context.confidence,
      stability: context.stability,
      promptContext: context.promptContext,
      suggestedEmpathyBoost: context.suggestedEmpathyBoost
    });

    this.context?.logger.debug(
      `Emotion detected: ${context.currentEmotion} (${(context.confidence * 100).toFixed(1)}%)`
    );
  }
}

// Re-export types and manifest
export * from './types.js';
export { emotionDetectionManifest } from './manifest.js';
export { FaceApiDetector } from './face-api-detector.js';
export { EmotionProcessor } from './emotion-processor.js';
