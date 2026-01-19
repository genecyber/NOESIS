/**
 * Camera Stream Provider Types
 *
 * Interfaces for interval-based webcam frame emission that plugins can subscribe to.
 */

/**
 * Configuration for the camera stream provider
 */
export interface CameraConfig {
  /** Device ID of the camera to use (optional, uses default if not specified) */
  deviceId?: string;
  /** Width of captured frames in pixels (default: 640) */
  width: number;
  /** Height of captured frames in pixels (default: 480) */
  height: number;
  /** Interval between frame captures in milliseconds (default: 1000ms) */
  frameIntervalMs: number;
  /** Image format for captured frames */
  format: 'jpeg' | 'png';
  /** Image quality 0-100 (only applies to jpeg format) */
  quality: number;
  /** Whether to horizontally mirror the captured frames */
  mirror: boolean;
}

/**
 * Represents a single captured camera frame
 */
export interface CameraFrame {
  /** Timestamp when the frame was captured */
  timestamp: Date;
  /** Width of the frame in pixels */
  width: number;
  /** Height of the frame in pixels */
  height: number;
  /** Image format of the frame */
  format: 'jpeg' | 'png';
  /** Raw image data as a Buffer */
  data: Buffer;
  /** Base64-encoded data URL for Claude vision API */
  dataUrl: string;
}

/**
 * Represents an available camera device
 */
export interface CameraDevice {
  /** Unique identifier for the device */
  deviceId: string;
  /** Human-readable label for the device */
  label: string;
}

/**
 * Handler function type for receiving camera frames
 * Can be sync or async
 */
export type FrameHandler = (frame: CameraFrame) => void | Promise<void>;
