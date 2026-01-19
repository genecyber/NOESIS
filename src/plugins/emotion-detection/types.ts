/**
 * Emotion Detection Plugin Types
 *
 * Types for webcam-based facial emotion detection using face-api.js
 */

import type { Emotion } from '../../emotion/detector.js';

/**
 * Camera frame data from the event bus
 */
export interface CameraFrame {
  data: Uint8Array | string;
  width: number;
  height: number;
  format: 'rgb' | 'rgba' | 'jpeg' | 'png';
  timestamp: number;
}

/**
 * Detected face with bounding box and expression scores
 */
export interface DetectedFace {
  detection: {
    box: { x: number; y: number; width: number; height: number };
    score: number;
  };
  expressions: FaceExpressions;
}

/**
 * Face-api.js expression scores (0-1 for each emotion)
 */
export interface FaceExpressions {
  angry: number;
  disgusted: number;
  fearful: number;
  happy: number;
  neutral: number;
  sad: number;
  surprised: number;
}

/**
 * Processed emotional context for the operator
 */
export interface OperatorEmotionContext {
  currentEmotion: Emotion;
  valence: number;          // -1 to 1 (negative to positive)
  arousal: number;          // 0 to 1 (calm to excited)
  confidence: number;       // 0 to 1
  stability: number;        // 0 to 1 (how stable the emotion is)
  suggestedEmpathyBoost: number;  // 0-50 percentage boost
  promptContext: string;    // Natural language for system prompt
  timestamp: Date;
}

/**
 * Entry in the emotion history buffer
 */
export interface EmotionHistory {
  emotion: Emotion;
  confidence: number;
  timestamp: Date;
}

/**
 * Face expression to Emotion mapping
 */
export type FaceExpressionKey = keyof FaceExpressions;

/**
 * Expression to Emotion type mapping
 */
export const EXPRESSION_TO_EMOTION: Record<FaceExpressionKey, Emotion> = {
  angry: 'anger',
  disgusted: 'disgust',
  fearful: 'fear',
  happy: 'joy',
  neutral: 'neutral',
  sad: 'sadness',
  surprised: 'surprise'
};
