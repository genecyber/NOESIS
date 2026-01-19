/**
 * Camera Stream Provider
 *
 * Provides interval-based webcam frame emission that plugins can subscribe to.
 * Supports both Node.js (using node-webcam) and browser environments.
 */

import type { CameraConfig, CameraFrame, CameraDevice, FrameHandler } from './types.js';
import { bufferToDataUrl, isNodeEnvironment, normalizeConfig } from './utils.js';

/**
 * Camera stream provider for interval-based webcam frame capture.
 *
 * Follows the subscription pattern from AdaptiveStreamingController:
 * - subscribe(handler) returns an unsubscribe function
 * - Set<FrameHandler> for handler management
 *
 * @example
 * ```typescript
 * const stream = new CameraStreamProvider({ frameIntervalMs: 500 });
 *
 * // Subscribe to frames
 * const unsubscribe = stream.subscribe((frame) => {
 *   console.log('Received frame:', frame.timestamp);
 *   // Send frame.dataUrl to Claude vision API
 * });
 *
 * // Start capturing
 * await stream.start();
 *
 * // Later: stop and unsubscribe
 * stream.stop();
 * unsubscribe();
 * ```
 */
export class CameraStreamProvider {
  private config: CameraConfig;
  private handlers: Set<FrameHandler> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  // Node.js specific
  private nodeWebcam: any = null;

  // Browser specific
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private mediaStream: MediaStream | null = null;

  /**
   * Create a new CameraStreamProvider instance
   *
   * @param config - Partial configuration (defaults will be applied)
   */
  constructor(config: Partial<CameraConfig> = {}) {
    this.config = normalizeConfig(config);
  }

  /**
   * Subscribe to camera frame events
   *
   * @param handler - Function to call when a new frame is captured
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = cameraStream.subscribe(async (frame) => {
   *   await processFrame(frame);
   * });
   *
   * // Later: stop receiving frames
   * unsubscribe();
   * ```
   */
  subscribe(handler: FrameHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Start capturing frames at the configured interval
   *
   * @throws Error if camera is not available or permission is denied
   *
   * @example
   * ```typescript
   * try {
   *   await cameraStream.start();
   *   console.log('Camera started');
   * } catch (error) {
   *   console.error('Failed to start camera:', error);
   * }
   * ```
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      if (isNodeEnvironment()) {
        await this.initializeNodeCapture();
      } else {
        await this.initializeBrowserCapture();
      }

      this.isRunning = true;

      // Start the capture interval
      this.intervalId = setInterval(() => {
        this.captureFrame().catch((error) => {
          console.error('[CameraStreamProvider] Frame capture error:', error);
        });
      }, this.config.frameIntervalMs);

      // Capture first frame immediately
      await this.captureFrame();
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop capturing frames
   *
   * @example
   * ```typescript
   * cameraStream.stop();
   * console.log('Camera stopped');
   * ```
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Clear the interval
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Cleanup resources
    if (isNodeEnvironment()) {
      this.cleanupNodeCapture();
    } else {
      this.cleanupBrowserCapture();
    }

    this.isRunning = false;
  }

  /**
   * Update camera configuration
   *
   * Note: Some changes may require stop/start to take effect
   *
   * @param config - Partial configuration to merge
   *
   * @example
   * ```typescript
   * cameraStream.updateConfig({
   *   frameIntervalMs: 500,
   *   quality: 90
   * });
   * ```
   */
  updateConfig(config: Partial<CameraConfig>): void {
    this.config = normalizeConfig({ ...this.config, ...config });

    // Update interval if running
    if (this.isRunning && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.captureFrame().catch((error) => {
          console.error('[CameraStreamProvider] Frame capture error:', error);
        });
      }, this.config.frameIntervalMs);
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current camera configuration
   */
  getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Check if the camera is currently capturing
   *
   * @returns true if capturing, false otherwise
   */
  isCapturing(): boolean {
    return this.isRunning;
  }

  /**
   * List available camera devices
   *
   * @returns Promise resolving to array of available camera devices
   *
   * @example
   * ```typescript
   * const devices = await CameraStreamProvider.listDevices();
   * console.log('Available cameras:', devices);
   * // [{ deviceId: '...', label: 'FaceTime HD Camera' }, ...]
   * ```
   */
  static async listDevices(): Promise<CameraDevice[]> {
    if (isNodeEnvironment()) {
      return CameraStreamProvider.listNodeDevices();
    } else {
      return CameraStreamProvider.listBrowserDevices();
    }
  }

  // ============================================================================
  // Node.js Implementation
  // ============================================================================

  /**
   * Initialize Node.js webcam capture using node-webcam
   */
  private async initializeNodeCapture(): Promise<void> {
    try {
      // Dynamic import of node-webcam
      const NodeWebcam = await import('node-webcam');

      const webcamOptions = {
        width: this.config.width,
        height: this.config.height,
        quality: this.config.quality,
        output: this.config.format,
        device: this.config.deviceId || false,
        callbackReturn: 'buffer',
        verbose: false,
      };

      this.nodeWebcam = NodeWebcam.create(webcamOptions);
    } catch (error) {
      throw new Error(
        `Failed to initialize camera in Node.js environment. ` +
        `Ensure 'node-webcam' package is installed. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Capture a frame using node-webcam
   */
  private async captureNodeFrame(): Promise<CameraFrame> {
    return new Promise((resolve, reject) => {
      if (!this.nodeWebcam) {
        reject(new Error('Node webcam not initialized'));
        return;
      }

      this.nodeWebcam.capture('capture', (err: Error | null, data: Buffer) => {
        if (err) {
          reject(new Error(`Failed to capture frame: ${err.message}`));
          return;
        }

        const frame: CameraFrame = {
          timestamp: new Date(),
          width: this.config.width,
          height: this.config.height,
          format: this.config.format,
          data: data,
          dataUrl: bufferToDataUrl(data, this.config.format),
        };

        resolve(frame);
      });
    });
  }

  /**
   * Cleanup Node.js webcam resources
   */
  private cleanupNodeCapture(): void {
    if (this.nodeWebcam) {
      // node-webcam doesn't have a cleanup method, just nullify the reference
      this.nodeWebcam = null;
    }
  }

  /**
   * List available devices in Node.js environment
   */
  private static async listNodeDevices(): Promise<CameraDevice[]> {
    try {
      const NodeWebcam = await import('node-webcam');
      const webcam = NodeWebcam.create({});

      return new Promise((resolve) => {
        webcam.list((list: string[]) => {
          const devices: CameraDevice[] = list.map((device, index) => ({
            deviceId: device,
            label: device || `Camera ${index + 1}`,
          }));
          resolve(devices);
        });
      });
    } catch {
      // If node-webcam is not available, return empty list
      return [];
    }
  }

  // ============================================================================
  // Browser Implementation
  // ============================================================================

  /**
   * Initialize browser webcam capture using getUserMedia
   */
  private async initializeBrowserCapture(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Camera access not available in this browser environment');
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
        },
        audio: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create video element for frame capture
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) {
          reject(new Error('Video element not created'));
          return;
        }

        this.videoElement.onloadedmetadata = () => {
          this.videoElement!.play()
            .then(() => resolve())
            .catch(reject);
        };

        this.videoElement.onerror = () => {
          reject(new Error('Failed to load video stream'));
        };
      });

      // Create canvas for frame extraction
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = this.config.width;
      this.canvasElement.height = this.config.height;
      this.canvasContext = this.canvasElement.getContext('2d');

      if (!this.canvasContext) {
        throw new Error('Failed to create canvas context');
      }
    } catch (error) {
      this.cleanupBrowserCapture();

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Camera permission denied. Please allow camera access.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No camera device found.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera is in use by another application.');
        }
      }

      throw error;
    }
  }

  /**
   * Capture a frame from the browser video stream
   */
  private async captureBrowserFrame(): Promise<CameraFrame> {
    if (!this.videoElement || !this.canvasElement || !this.canvasContext) {
      throw new Error('Browser capture not initialized');
    }

    // Apply mirror transform if needed
    if (this.config.mirror) {
      this.canvasContext.save();
      this.canvasContext.scale(-1, 1);
      this.canvasContext.drawImage(
        this.videoElement,
        -this.config.width,
        0,
        this.config.width,
        this.config.height
      );
      this.canvasContext.restore();
    } else {
      this.canvasContext.drawImage(
        this.videoElement,
        0,
        0,
        this.config.width,
        this.config.height
      );
    }

    // Convert to blob
    const mimeType = this.config.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = this.config.quality / 100;

    return new Promise((resolve, reject) => {
      this.canvasElement!.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to capture frame as blob'));
            return;
          }

          try {
            // Convert blob to buffer
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const frame: CameraFrame = {
              timestamp: new Date(),
              width: this.config.width,
              height: this.config.height,
              format: this.config.format,
              data: buffer,
              dataUrl: bufferToDataUrl(buffer, this.config.format),
            };

            resolve(frame);
          } catch (error) {
            reject(error);
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Cleanup browser webcam resources
   */
  private cleanupBrowserCapture(): void {
    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Cleanup video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    // Cleanup canvas
    this.canvasElement = null;
    this.canvasContext = null;
  }

  /**
   * List available devices in browser environment
   */
  private static async listBrowserDevices(): Promise<CameraDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return [];
    }

    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

      const devices = await navigator.mediaDevices.enumerateDevices();

      return devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        }));
    } catch {
      // If permission denied, return empty list
      return [];
    }
  }

  // ============================================================================
  // Common Methods
  // ============================================================================

  /**
   * Capture a single frame and emit to all handlers
   */
  private async captureFrame(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const frame = isNodeEnvironment()
        ? await this.captureNodeFrame()
        : await this.captureBrowserFrame();

      // Emit to all handlers
      await this.emit(frame);
    } catch (error) {
      // Log but don't stop capture on individual frame errors
      console.error('[CameraStreamProvider] Frame capture failed:', error);
    }
  }

  /**
   * Emit a frame to all subscribed handlers
   */
  private async emit(frame: CameraFrame): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const handler of this.handlers) {
      try {
        const result = handler(frame);
        if (result instanceof Promise) {
          promises.push(result.catch((error) => {
            console.error('[CameraStreamProvider] Handler error:', error);
          }));
        }
      } catch (error) {
        console.error('[CameraStreamProvider] Handler error:', error);
      }
    }

    // Wait for all async handlers to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default singleton instance of the camera stream provider.
 *
 * @example
 * ```typescript
 * import { cameraStream } from './camera';
 *
 * cameraStream.subscribe((frame) => {
 *   console.log('New frame:', frame.timestamp);
 * });
 *
 * await cameraStream.start();
 * ```
 */
export const cameraStream = new CameraStreamProvider();
