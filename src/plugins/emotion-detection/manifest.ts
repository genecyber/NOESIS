/**
 * Emotion Detection Plugin Manifest
 *
 * Plugin metadata and configuration for the webcam-based
 * facial emotion detection system.
 */

import type { PluginManifest } from '../sdk.js';

export const emotionDetectionManifest: PluginManifest = {
  name: 'emotion-detection',
  version: '1.0.0',
  description: 'Webcam facial emotion detection using face-api.js for real-time operator emotional awareness',
  author: 'Metamorph Team',
  license: 'MIT',
  keywords: ['emotion', 'detection', 'webcam', 'face-api', 'facial-recognition', 'empathy'],
  metamorphVersion: '1.0.0',
  entryPoint: 'index.js',
  permissions: ['stance:read', 'stance:write', 'memory:write', 'config:read'],
  dependencies: {
    'face-api.js': '^0.22.2',
    '@tensorflow/tfjs-node': '^4.17.0'
  }
};
