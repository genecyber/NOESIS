/**
 * Camera Stream Provider Module
 *
 * Provides interval-based webcam frame emission that plugins can subscribe to.
 * Supports both Node.js (using node-webcam) and browser environments.
 *
 * @module camera
 *
 * @example
 * ```typescript
 * import { cameraStream, CameraStreamProvider, type CameraFrame } from './camera';
 *
 * // Using the singleton
 * const unsubscribe = cameraStream.subscribe((frame: CameraFrame) => {
 *   console.log('Frame received:', frame.timestamp);
 *   // Send frame.dataUrl to Claude vision API
 * });
 *
 * await cameraStream.start();
 *
 * // Or create a custom instance
 * const customStream = new CameraStreamProvider({
 *   width: 1280,
 *   height: 720,
 *   frameIntervalMs: 500,
 *   format: 'jpeg',
 *   quality: 90
 * });
 * ```
 */

// Export types
export type {
  CameraConfig,
  CameraFrame,
  CameraDevice,
  FrameHandler,
} from './types.js';

// Export main class and singleton
export { CameraStreamProvider, cameraStream } from './camera-stream.js';

// Export utilities
export {
  DEFAULT_CAMERA_CONFIG,
  bufferToDataUrl,
  isNodeEnvironment,
  clampQuality,
  normalizeConfig,
} from './utils.js';
