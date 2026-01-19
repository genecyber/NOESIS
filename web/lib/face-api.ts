import * as faceapi from 'face-api.js';

let modelsLoaded = false;

// Load models from CDN (jsdelivr hosts face-api.js models)
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

export async function loadModels(): Promise<boolean> {
  if (modelsLoaded) return true;

  try {
    console.log('[FaceAPI] Loading models from CDN...');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    console.log('[FaceAPI] Models loaded successfully');
    return true;
  } catch (error) {
    console.error('[FaceAPI] Failed to load models:', error);
    return false;
  }
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface EmotionResult {
  currentEmotion: string;
  expressions: Record<string, number>;
  confidence: number;
}

export async function detectEmotions(video: HTMLVideoElement): Promise<EmotionResult | null> {
  if (!modelsLoaded) {
    console.warn('[FaceAPI] Models not loaded');
    return null;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (!detection) {
      return null;
    }

    const expressions = detection.expressions;

    // Find dominant emotion
    let maxScore = 0;
    let dominantEmotion = 'neutral';

    for (const [emotion, score] of Object.entries(expressions)) {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }

    return {
      currentEmotion: dominantEmotion,
      expressions: expressions as unknown as Record<string, number>,
      confidence: maxScore
    };
  } catch (error) {
    console.error('[FaceAPI] Detection error:', error);
    return null;
  }
}

// Calculate valence from expressions (-1 to 1)
export function calculateValence(expressions: Record<string, number>): number {
  const positive = (expressions.happy || 0) + (expressions.surprised || 0) * 0.5;
  const negative = (expressions.sad || 0) + (expressions.angry || 0) +
                   (expressions.fearful || 0) + (expressions.disgusted || 0);
  return Math.max(-1, Math.min(1, positive - negative));
}

// Calculate arousal from expressions (0 to 1)
export function calculateArousal(expressions: Record<string, number>): number {
  const highArousal = (expressions.surprised || 0) + (expressions.angry || 0) +
                      (expressions.fearful || 0);
  const lowArousal = (expressions.sad || 0) + (expressions.neutral || 0);
  return Math.max(0, Math.min(1, 0.5 + highArousal * 0.5 - lowArousal * 0.3));
}
