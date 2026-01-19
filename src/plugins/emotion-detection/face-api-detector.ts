/**
 * Face-API Detector
 *
 * Wrapper around face-api.js for facial emotion detection.
 * Uses tinyFaceDetector + faceExpressionNet models (~6MB total).
 * Detects 7 emotions: angry, disgusted, fearful, happy, neutral, sad, surprised.
 */

import type { DetectedFace, FaceExpressions } from './types.js';

// Type definitions for face-api.js (optional dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApiModule = any;

// Dynamic imports for face-api.js (loaded at runtime)
let faceapi: FaceApiModule = null;

/**
 * Default model path (relative to project root)
 */
const DEFAULT_MODELS_PATH = './models/face-api';

/**
 * FaceApiDetector - Handles face detection and expression recognition
 *
 * Uses lightweight models optimized for real-time detection:
 * - tinyFaceDetector: ~190KB, fast face detection
 * - faceExpressionNet: ~5.5MB, 7-emotion classification
 */
export class FaceApiDetector {
  private initialized: boolean = false;
  private modelsPath: string;
  private initializationPromise: Promise<void> | null = null;

  constructor(modelsPath?: string) {
    this.modelsPath = modelsPath ?? DEFAULT_MODELS_PATH;
  }

  /**
   * Initialize face-api.js and load required models
   *
   * Loads:
   * - tinyFaceDetector: Lightweight face detection model
   * - faceExpressionNet: 7-emotion classification model
   *
   * @throws Error if models fail to load
   */
  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initialized) {
      return;
    }

    this.initializationPromise = this.doInitialize();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {
    try {
      // Dynamically import face-api.js
      // Note: face-api.js must be installed separately
      if (!faceapi) {
        // @ts-expect-error - face-api.js is an optional dependency
        faceapi = await import('face-api.js');
      }

      // Load TensorFlow.js backend
      await faceapi.tf.setBackend('tensorflow');
      await faceapi.tf.ready();

      // Load required models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelsPath),
        faceapi.nets.faceExpressionNet.loadFromDisk(this.modelsPath)
      ]);

      this.initialized = true;
      console.info('[FaceApiDetector] Models loaded successfully');
    } catch (error) {
      console.error('[FaceApiDetector] Failed to initialize:', error);
      throw new Error(
        `Failed to initialize face-api.js: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect emotions from image data
   *
   * @param imageData - Image as Buffer or base64 string
   * @returns Array of detected faces with expression scores
   */
  async detectEmotions(imageData: Buffer | string): Promise<DetectedFace[]> {
    if (!this.initialized || !faceapi) {
      console.warn('[FaceApiDetector] Not initialized, returning empty result');
      return [];
    }

    try {
      // Convert input to tensor
      const tensor = await this.imageToTensor(imageData);

      if (!tensor) {
        return [];
      }

      // Detect faces with expressions
      const detections = await faceapi
        .detectAllFaces(tensor, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        }))
        .withFaceExpressions();

      // Dispose tensor to free memory
      tensor.dispose();

      // Map to our interface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return detections.map((detection: any): DetectedFace => ({
        detection: {
          box: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height
          },
          score: detection.detection.score
        },
        expressions: this.normalizeExpressions(detection.expressions)
      }));
    } catch (error) {
      console.error('[FaceApiDetector] Detection error:', error);
      return [];
    }
  }

  /**
   * Check if the detector is initialized and ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Convert image data to a tensor for face-api.js
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async imageToTensor(imageData: Buffer | string): Promise<any> {
    if (!faceapi) {
      return null;
    }

    try {
      let buffer: Buffer;

      if (typeof imageData === 'string') {
        // Handle base64 string
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }

      // Decode image to tensor using TensorFlow.js Node
      return faceapi.tf.node.decodeImage(buffer, 3);
    } catch (error) {
      console.error('[FaceApiDetector] Failed to convert image:', error);
      return null;
    }
  }

  /**
   * Normalize expression scores to our interface
   */
  private normalizeExpressions(
    expressions: Record<string, number>
  ): FaceExpressions {
    return {
      angry: expressions.angry ?? 0,
      disgusted: expressions.disgusted ?? 0,
      fearful: expressions.fearful ?? 0,
      happy: expressions.happy ?? 0,
      neutral: expressions.neutral ?? 0,
      sad: expressions.sad ?? 0,
      surprised: expressions.surprised ?? 0
    };
  }

  /**
   * Get the models path
   */
  getModelsPath(): string {
    return this.modelsPath;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.initialized = false;
    // TensorFlow.js manages its own memory
  }
}
