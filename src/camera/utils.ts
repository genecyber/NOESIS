/**
 * Camera Stream Utility Functions
 *
 * Helper functions and constants for the camera stream provider.
 */

import type { CameraConfig } from './types.js';

/**
 * Default camera configuration values
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  deviceId: undefined,
  width: 640,
  height: 480,
  frameIntervalMs: 1000,
  format: 'jpeg',
  quality: 80,
  mirror: false,
};

/**
 * Convert a Buffer to a base64-encoded data URL
 *
 * @param buffer - The image data buffer
 * @param format - The image format ('jpeg' or 'png')
 * @returns Base64-encoded data URL suitable for Claude vision API
 *
 * @example
 * ```typescript
 * const dataUrl = bufferToDataUrl(imageBuffer, 'jpeg');
 * // Returns: "data:image/jpeg;base64,/9j/4AAQ..."
 * ```
 */
export function bufferToDataUrl(buffer: Buffer, format: 'jpeg' | 'png'): string {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Detect if the current environment is Node.js
 *
 * @returns true if running in Node.js, false if in browser
 *
 * @example
 * ```typescript
 * if (isNodeEnvironment()) {
 *   // Use node-webcam
 * } else {
 *   // Use navigator.mediaDevices
 * }
 * ```
 */
export function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Validate a quality value is within acceptable range
 *
 * @param quality - Quality value to validate (0-100)
 * @returns Clamped quality value between 0 and 100
 */
export function clampQuality(quality: number): number {
  return Math.max(0, Math.min(100, Math.round(quality)));
}

/**
 * Validate and normalize camera configuration
 *
 * @param config - Partial configuration to normalize
 * @returns Complete configuration with defaults applied
 */
export function normalizeConfig(config: Partial<CameraConfig>): CameraConfig {
  return {
    ...DEFAULT_CAMERA_CONFIG,
    ...config,
    quality: clampQuality(config.quality ?? DEFAULT_CAMERA_CONFIG.quality),
    width: Math.max(1, config.width ?? DEFAULT_CAMERA_CONFIG.width),
    height: Math.max(1, config.height ?? DEFAULT_CAMERA_CONFIG.height),
    frameIntervalMs: Math.max(16, config.frameIntervalMs ?? DEFAULT_CAMERA_CONFIG.frameIntervalMs),
  };
}
