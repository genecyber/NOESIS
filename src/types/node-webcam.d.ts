/**
 * Type declarations for node-webcam
 *
 * node-webcam is a cross-platform library for capturing images from webcams.
 * This declaration provides minimal types needed for the camera-stream module.
 */

declare module 'node-webcam' {
  export interface WebcamOptions {
    width?: number;
    height?: number;
    quality?: number;
    output?: string;
    device?: string | boolean;
    callbackReturn?: 'location' | 'buffer' | 'base64' | string;
    verbose?: boolean;
  }

  export interface Webcam {
    /**
     * Capture an image
     * @param location - Output file location (or empty string for buffer)
     * @param callback - Callback with error and data
     */
    capture(
      location: string,
      callback: (err: Error | null, data: Buffer | string) => void
    ): void;

    /**
     * List available devices
     * @param callback - Callback with list of device names
     */
    list(callback: (list: string[]) => void): void;

    /**
     * Clear the webcam
     */
    clear(): void;
  }

  /**
   * Create a new webcam instance
   * @param options - Webcam configuration options
   * @returns Webcam instance
   */
  export function create(options: WebcamOptions): Webcam;
}
