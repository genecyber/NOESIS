/**
 * Emotion Detection Panel
 *
 * A plugin panel for real-time emotion detection.
 * Uses the Plugin SDK capabilities for webcam and vision access.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Brain,
  Eye,
} from 'lucide-react';
import type { PanelProps } from '@/lib/plugins/types';
import type { EmotionContext } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button, Slider } from '@/components/ui';

// Import face-api for browser-side detection
import { loadModels, detectEmotions, calculateValence, calculateArousal } from '@/lib/face-api';

// Import emotion aggregator
import { EmotionAggregator } from '@/lib/emotion-aggregator';

// Detection modes
type DetectionMode = 'browser' | 'ai' | 'off';

interface EmotionPanelState {
  mode: DetectionMode;
  detectionInterval: number;
  minConfidence: number;
  isLoading: boolean;
  error: string | null;
  modelsLoaded: boolean;
}

/**
 * Emotion Detection Panel Component
 */
export default function EmotionPanel({
  sessionId,
  config,
  emotionContext,
  capabilities,
  onEmotionUpdate,
}: PanelProps) {
  // Panel state
  const [state, setState] = useState<EmotionPanelState>({
    mode: 'off',
    detectionInterval: 1000,
    minConfidence: 0.5,
    isLoading: false,
    error: null,
    modelsLoaded: false,
  });

  // Current detection result
  const [currentEmotion, setCurrentEmotion] = useState<EmotionContext | null>(emotionContext);

  // Settings panel visibility
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const aggregatorRef = useRef<EmotionAggregator | null>(null);

  // Initialize aggregator
  useEffect(() => {
    const aggregator = new EmotionAggregator();
    if (sessionId) {
      aggregator.sessionId = sessionId;
    }
    aggregatorRef.current = aggregator;
    return () => {
      aggregatorRef.current = null;
    };
  }, [sessionId]);

  // Sync emotionContext prop with local state
  useEffect(() => {
    if (emotionContext) {
      setCurrentEmotion(emotionContext);
    }
  }, [emotionContext]);

  // Load face-api models
  const loadFaceApiModels = useCallback(async () => {
    if (state.modelsLoaded) return true;

    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const success = await loadModels();
      setState(s => ({ ...s, modelsLoaded: success, isLoading: false }));
      return success;
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load models',
      }));
      return false;
    }
  }, [state.modelsLoaded]);

  // Start webcam
  const startWebcam = useCallback(async () => {
    if (!capabilities.webcam) return;

    try {
      const stream = await capabilities.webcam.start();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState(s => ({ ...s, error: null }));
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to start webcam',
      }));
    }
  }, [capabilities.webcam]);

  // Stop webcam
  const stopWebcam = useCallback(() => {
    if (capabilities.webcam) {
      capabilities.webcam.stop();
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [capabilities.webcam]);

  // Run browser-side detection
  const runBrowserDetection = useCallback(async () => {
    if (!videoRef.current || !state.modelsLoaded) return;

    try {
      const result = await detectEmotions(videoRef.current);
      if (result && result.confidence >= state.minConfidence) {
        const valence = calculateValence(result.expressions);
        const arousal = calculateArousal(result.expressions);

        const emotion: EmotionContext = {
          currentEmotion: result.currentEmotion,
          valence,
          arousal,
          confidence: result.confidence,
          stability: 1 - arousal, // Inverse correlation
          promptContext: `User appears ${result.currentEmotion} (valence: ${valence.toFixed(2)}, arousal: ${arousal.toFixed(2)})`,
          suggestedEmpathyBoost: Math.abs(valence) < 0 ? Math.round(Math.abs(valence) * 15) : 0,
        };

        // Add to aggregator
        if (aggregatorRef.current) {
          aggregatorRef.current.addReading({
            currentEmotion: emotion.currentEmotion,
            valence: emotion.valence,
            arousal: emotion.arousal,
            confidence: emotion.confidence,
          });

          // Get aggregate stats
          const aggregate = aggregatorRef.current.getAggregate();
          if (aggregate) {
            emotion.stability = aggregate.stability;
            emotion.suggestedEmpathyBoost = aggregate.suggestedEmpathyBoost;
            emotion.promptContext = aggregate.promptContext;
          }
        }

        setCurrentEmotion(emotion);
        onEmotionUpdate?.(emotion);
      }
    } catch (err) {
      console.error('[EmotionPanel] Detection error:', err);
    }
  }, [state.modelsLoaded, state.minConfidence, onEmotionUpdate]);

  // Run AI-based detection
  const runAIDetection = useCallback(async () => {
    if (!capabilities.vision || !capabilities.webcam || !capabilities.vision.canAnalyze) {
      return;
    }

    try {
      const frame = await capabilities.webcam.captureFrame();
      if (!frame) return;

      const emotion = await capabilities.vision.analyzeEmotion(frame);
      setCurrentEmotion(emotion);
      onEmotionUpdate?.(emotion);
    } catch (err) {
      console.error('[EmotionPanel] AI detection error:', err);
    }
  }, [capabilities.vision, capabilities.webcam, onEmotionUpdate]);

  // Start/stop detection based on mode
  useEffect(() => {
    if (state.mode === 'off') {
      if (detectionLoopRef.current) {
        clearInterval(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
      stopWebcam();
      return;
    }

    // Start webcam for both modes
    startWebcam();

    // Load models for browser mode
    if (state.mode === 'browser') {
      loadFaceApiModels();
    }

    // Start detection loop
    const runDetection = state.mode === 'browser' ? runBrowserDetection : runAIDetection;
    detectionLoopRef.current = setInterval(runDetection, state.detectionInterval);

    return () => {
      if (detectionLoopRef.current) {
        clearInterval(detectionLoopRef.current);
      }
    };
  }, [state.mode, state.detectionInterval, startWebcam, stopWebcam, loadFaceApiModels, runBrowserDetection, runAIDetection]);

  // Toggle detection mode
  const toggleMode = (newMode: DetectionMode) => {
    setState(s => ({ ...s, mode: s.mode === newMode ? 'off' : newMode }));
  };

  // Format valence label
  const getValenceLabel = (valence: number): string => {
    if (valence > 0.3) return 'Positive';
    if (valence < -0.3) return 'Negative';
    return 'Neutral';
  };

  // Format arousal label
  const getArousalLabel = (arousal: number): string => {
    if (arousal > 0.6) return 'High';
    if (arousal < 0.4) return 'Low';
    return 'Moderate';
  };

  const empathyEnabled = config?.enableEmpathyMode ?? false;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold gradient-text">Emotion Detection</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'p-1.5 rounded transition-colors',
            showSettings
              ? 'bg-emblem-primary/20 text-emblem-primary'
              : 'text-emblem-muted hover:text-emblem-text hover:bg-white/5'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs">
        {state.mode !== 'off' ? (
          <CheckCircle className="w-3.5 h-3.5 text-emblem-accent" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-emblem-muted" />
        )}
        <span className="text-emblem-muted">
          {state.mode === 'off'
            ? 'Detection disabled'
            : state.mode === 'browser'
            ? 'Browser detection active'
            : 'AI detection active'}
        </span>
      </div>

      {/* Error display */}
      {state.error && (
        <div className="px-3 py-2 bg-emblem-danger/10 border border-emblem-danger/20 rounded-lg text-xs text-emblem-danger">
          {state.error}
        </div>
      )}

      {/* Mode toggles */}
      <div className="flex gap-2">
        <button
          onClick={() => toggleMode('browser')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            state.mode === 'browser'
              ? 'bg-emblem-primary/20 text-emblem-primary border border-emblem-primary/30'
              : 'bg-emblem-surface-2 text-emblem-muted border border-white/5 hover:text-emblem-text'
          )}
        >
          <Eye className="w-4 h-4" />
          <span>Browser</span>
        </button>
        <button
          onClick={() => toggleMode('ai')}
          disabled={!capabilities.vision?.canAnalyze}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            state.mode === 'ai'
              ? 'bg-emblem-secondary/20 text-emblem-secondary border border-emblem-secondary/30'
              : 'bg-emblem-surface-2 text-emblem-muted border border-white/5 hover:text-emblem-text',
            !capabilities.vision?.canAnalyze && 'opacity-50 cursor-not-allowed'
          )}
          title={!capabilities.vision?.canAnalyze ? `Cooldown: ${capabilities.vision?.cooldownRemaining}s` : undefined}
        >
          <Brain className="w-4 h-4" />
          <span>AI Vision</span>
        </button>
      </div>

      {/* Video preview */}
      <div className="relative aspect-video bg-emblem-surface rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'absolute inset-0 w-full h-full object-cover',
            state.mode === 'off' && 'hidden'
          )}
        />
        {state.mode === 'off' && (
          <div className="absolute inset-0 flex items-center justify-center text-emblem-muted">
            <CameraOff className="w-8 h-8" />
          </div>
        )}
        {state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <RefreshCw className="w-6 h-6 text-emblem-secondary animate-spin" />
          </div>
        )}
      </div>

      {/* Current emotion display */}
      <AnimatePresence mode="wait">
        {currentEmotion && (
          <motion.div
            key={currentEmotion.currentEmotion}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-display font-bold text-emblem-text capitalize">
                {currentEmotion.currentEmotion}
              </span>
              <span className="text-sm text-emblem-muted">
                {Math.round(currentEmotion.confidence * 100)}% confident
              </span>
            </div>

            {/* Valence bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-emblem-muted">
                <span>Valence</span>
                <span>{getValenceLabel(currentEmotion.valence)}</span>
              </div>
              <div className="h-2 bg-emblem-surface rounded-full relative overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/20" />
                <motion.div
                  className={cn(
                    'absolute h-full rounded-full',
                    currentEmotion.valence >= 0
                      ? 'left-1/2 bg-gradient-to-r from-emblem-secondary to-emblem-accent'
                      : 'right-1/2 bg-gradient-to-l from-emblem-secondary to-emblem-danger'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.abs(currentEmotion.valence) * 50}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            </div>

            {/* Arousal bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-emblem-muted">
                <span>Arousal</span>
                <span>{getArousalLabel(currentEmotion.arousal)}</span>
              </div>
              <div className="h-2 bg-emblem-surface rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emblem-primary to-emblem-secondary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${currentEmotion.arousal * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            </div>

            {/* Empathy boost suggestion */}
            {currentEmotion.suggestedEmpathyBoost !== undefined && currentEmotion.suggestedEmpathyBoost > 0 && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emblem-muted">Suggested Empathy Boost</span>
                  <span className="text-emblem-accent font-medium">
                    +{currentEmotion.suggestedEmpathyBoost}%
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-4">
              <h4 className="text-sm font-medium text-emblem-text">Settings</h4>

              {/* Detection interval */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-emblem-muted">
                  <span>Detection Interval</span>
                  <span>{state.detectionInterval}ms</span>
                </div>
                <Slider
                  value={[state.detectionInterval]}
                  min={100}
                  max={5000}
                  step={100}
                  onValueChange={([value]) =>
                    setState(s => ({ ...s, detectionInterval: value }))
                  }
                />
              </div>

              {/* Minimum confidence */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-emblem-muted">
                  <span>Min Confidence</span>
                  <span>{Math.round(state.minConfidence * 100)}%</span>
                </div>
                <Slider
                  value={[state.minConfidence]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([value]) =>
                    setState(s => ({ ...s, minConfidence: value }))
                  }
                />
              </div>

              {/* Empathy mode status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-emblem-muted">Empathy Mode</span>
                <span className={empathyEnabled ? 'text-emblem-accent' : 'text-emblem-muted'}>
                  {empathyEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
