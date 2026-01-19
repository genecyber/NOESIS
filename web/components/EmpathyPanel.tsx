'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Lock, ChevronRight, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { loadModels, isModelsLoaded, detectEmotions, calculateValence, calculateArousal } from '../lib/face-api';
import { analyzeVisionEmotion } from '../lib/api';
import { emotionAggregator, type EmotionAggregate } from '../lib/emotion-aggregator';
import type { EmotionContext } from '../lib/types';

interface EmpathyConfig {
  empathyCameraInterval?: number;
  empathyMinConfidence?: number;
  empathyAutoAdjust?: boolean;
  empathyBoostMax?: number;
}

interface EmpathyPanelProps {
  enabled: boolean;
  emotionContext?: EmotionContext | null;
  onToggle: (enabled: boolean) => void;
  onEmotionDetected?: (context: EmotionContext) => void;
  detectionInterval?: number; // milliseconds between detection calls
  onVisionRequest?: (frame: string, prompt: string) => void; // deprecated, kept for compatibility
  sessionId?: string; // Session ID for vision API calls
  // Config settings (moved from Config panel)
  config?: EmpathyConfig;
  onConfigUpdate?: (updates: Partial<EmpathyConfig>) => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

const EMOTION_COLORS: Record<string, string> = {
  neutral: '#a1a1aa',
  happy: '#4ade80',
  sad: '#60a5fa',
  angry: '#f87171',
  surprised: '#fbbf24',
  fearful: '#a78bfa',
  disgusted: '#84cc16',
  contempt: '#f472b6',
};

// Default detection interval (1 second)
const DEFAULT_DETECTION_INTERVAL = 1000;

// localStorage key for emotion prompt
const EMOTION_PROMPT_STORAGE_KEY = 'metamorph:emotionPrompt';

// Default prompt for Claude Vision emotion analysis
const DEFAULT_EMOTION_PROMPT = `Analyze the person's emotional state in this image. Describe:
1. Primary emotion (happy, sad, angry, fearful, surprised, disgusted, neutral)
2. Emotional intensity (low, medium, high)
3. Any secondary emotions
4. Confidence level in your assessment

Be concise and respond in JSON format:
{"emotion": "...", "intensity": "...", "secondary": [...], "confidence": "..."}`;

export default function EmpathyPanel({
  enabled,
  emotionContext: externalEmotionContext,
  onToggle,
  onEmotionDetected,
  detectionInterval = DEFAULT_DETECTION_INTERVAL,
  onVisionRequest,
  sessionId,
  config,
  onConfigUpdate
}: EmpathyPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [localEmotionContext, setLocalEmotionContext] = useState<EmotionContext | null>(null);
  const [emotionAggregate, setEmotionAggregate] = useState<EmotionAggregate | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  // Claude Vision state
  const [useClaudeVision, setUseClaudeVision] = useState(false);
  const [emotionPrompt, setEmotionPrompt] = useState(DEFAULT_EMOTION_PROMPT);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Load emotion prompt from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrompt = localStorage.getItem(EMOTION_PROMPT_STORAGE_KEY);
      if (savedPrompt) {
        setEmotionPrompt(savedPrompt);
      }
    }
  }, []);

  // Save emotion prompt to localStorage when it changes
  const handlePromptChange = useCallback((newPrompt: string) => {
    setEmotionPrompt(newPrompt);
    if (typeof window !== 'undefined') {
      localStorage.setItem(EMOTION_PROMPT_STORAGE_KEY, newPrompt);
    }
  }, []);

  // Reset prompt to default
  const handleResetPrompt = useCallback(() => {
    setEmotionPrompt(DEFAULT_EMOTION_PROMPT);
    if (typeof window !== 'undefined') {
      localStorage.setItem(EMOTION_PROMPT_STORAGE_KEY, DEFAULT_EMOTION_PROMPT);
    }
  }, []);

  // Capture frame and send to Claude Vision
  const captureAndSendFrame = useCallback(() => {
    if (!videoRef.current || !onVisionRequest) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Create canvas if needed
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const frame = canvas.toDataURL('image/jpeg', 0.8);

    // Send to parent component
    onVisionRequest(frame, emotionPrompt);
  }, [onVisionRequest, emotionPrompt]);

  // Use external emotion context if provided, otherwise use local
  const emotionContext = externalEmotionContext ?? localEmotionContext;

  // Enumerate available cameras
  const loadDevices = useCallback(async () => {
    try {
      console.log('[Empathy] Enumerating devices...');

      // Need to request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(track => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map((device, idx) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${idx + 1}`
        }));

      console.log('[Empathy] Found cameras:', videoDevices);
      setDevices(videoDevices);

      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('[Empathy] Failed to enumerate devices:', err);
    }
  }, [selectedDevice]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const stopCamera = useCallback(() => {
    console.log('[Empathy] Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('[Empathy] Stopping track:', track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDebugInfo('Camera stopped');
    setDetectionStatus('');
    setLocalEmotionContext(null);
    setEmotionAggregate(null);
    emotionAggregator.clear(); // Clear aggregated readings
  }, []);

  // Browser-side detection loop (disabled when Claude Vision is enabled)
  useEffect(() => {
    // Skip browser-side detection if Claude Vision is enabled
    if (useClaudeVision) {
      console.log('[Empathy] Browser detection disabled - using Claude Vision instead');
      setModelsLoading(false);
      setDetectionStatus('Using AI Vision');
      return;
    }

    if (!cameraActive || !videoRef.current) {
      console.log('[Empathy] Detection loop not starting - camera inactive or no video ref');
      return;
    }

    let mounted = true;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const runDetection = async () => {
      if (!mounted || !videoRef.current) return;

      // Check if video is ready
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('[Empathy] Video not ready for detection');
        return;
      }

      setIsDetecting(true);
      console.log('[Empathy] Running browser-side detection...');

      try {
        const result = await detectEmotions(video);

        if (!mounted) return;

        if (result) {
          consecutiveFailures = 0;
          const valence = calculateValence(result.expressions);
          const arousal = calculateArousal(result.expressions);

          // Add reading to aggregator (no LLM calls - just local math)
          emotionAggregator.addReading({
            currentEmotion: result.currentEmotion,
            valence,
            arousal,
            confidence: result.confidence
          });

          // Get aggregated data
          const aggregate = emotionAggregator.getAggregate();
          setEmotionAggregate(aggregate);

          // Build context from aggregate (richer data) or latest if no aggregate
          const context: EmotionContext = aggregate ? {
            currentEmotion: aggregate.dominantEmotion,
            valence: aggregate.avgValence,
            arousal: aggregate.avgArousal,
            confidence: aggregate.avgConfidence,
            stability: aggregate.stability,
            suggestedEmpathyBoost: aggregate.suggestedEmpathyBoost,
            promptContext: aggregate.promptContext
          } : {
            currentEmotion: result.currentEmotion,
            valence,
            arousal,
            confidence: result.confidence,
            stability: 0.5
          };

          console.log('[Empathy] Detected:', result.currentEmotion, '| Aggregate:', aggregate?.sampleCount, 'samples, trend:', aggregate?.trend);
          setLocalEmotionContext(context);
          setDetectionStatus(`${result.currentEmotion} (${aggregate?.sampleCount ?? 1} samples)`);
          onEmotionDetected?.(context);
        } else {
          consecutiveFailures++;
          console.log('[Empathy] No face detected');
          setDetectionStatus('No face detected');

          if (consecutiveFailures >= MAX_FAILURES) {
            setDetectionStatus('No face - check camera position');
          }
        }
      } catch (err) {
        console.error('[Empathy] Detection error:', err);
        consecutiveFailures++;
        setDetectionStatus('Detection error');
      } finally {
        setIsDetecting(false);
      }
    };

    // Load models first, then start detection loop
    console.log('[Empathy] Starting detection - loading models...');
    setModelsLoading(true);
    setDetectionStatus('Loading models...');

    loadModels().then((loaded) => {
      if (!mounted) return;

      setModelsLoading(false);
      setModelsReady(loaded);

      if (!loaded) {
        setError('Failed to load face detection models');
        setDetectionStatus('Model loading failed');
        return;
      }

      console.log('[Empathy] Models loaded, starting detection loop');
      setDetectionStatus('Initializing detection...');

      // Initial delay to let video stabilize
      setTimeout(() => {
        if (!mounted) return;
        runDetection();
        intervalId = setInterval(runDetection, detectionInterval);
      }, 500);
    });

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      console.log('[Empathy] Detection loop stopped');
    };
  }, [cameraActive, detectionInterval, onEmotionDetected, useClaudeVision]);

  // Claude Vision detection loop (replaces browser face-api when enabled)
  useEffect(() => {
    if (!cameraActive || !useClaudeVision || !videoRef.current) {
      return;
    }

    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isProcessing = false;

    const runVisionDetection = async () => {
      if (!mounted || !videoRef.current || isProcessing) return;

      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('[Empathy] Video not ready for Claude Vision');
        return;
      }

      // Capture frame
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL('image/jpeg', 0.8);

      console.log('[Empathy] Sending frame to Claude Vision...');
      setDetectionStatus('Analyzing with AI...');
      isProcessing = true;

      try {
        // Call the API directly
        const result = await analyzeVisionEmotion(sessionId || 'default', frame);

        if (!mounted) return;

        if (result.success && result.emotionContext) {
          console.log('[Empathy] Vision detected:', result.emotionContext);
          setLocalEmotionContext(result.emotionContext);
          setDetectionStatus(`AI: ${result.emotionContext.currentEmotion}`);
          onEmotionDetected?.(result.emotionContext);

          // Also call legacy callback for compatibility
          onVisionRequest?.(frame, emotionPrompt);
        } else {
          setDetectionStatus('AI analysis complete');
        }
      } catch (err) {
        console.error('[Empathy] Vision API error:', err);
        // Don't show rate limit errors as errors in UI
        if (err instanceof Error && err.message.includes('Rate limited')) {
          setDetectionStatus('AI: Waiting for cooldown...');
        } else {
          setDetectionStatus('AI analysis error');
        }
      } finally {
        isProcessing = false;
      }
    };

    // Initial delay then start loop
    setTimeout(() => {
      if (!mounted) return;
      runVisionDetection();
      // Run Claude Vision once per minute to match server cooldown
      intervalId = setInterval(runVisionDetection, 60000);
    }, 1000);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      console.log('[Empathy] Claude Vision loop stopped');
    };
  }, [cameraActive, useClaudeVision, sessionId, onEmotionDetected, onVisionRequest, emotionPrompt]);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null);
      setPermissionDenied(false);
      setDebugInfo('Starting camera...');
      console.log('[Empathy] Starting camera with device:', deviceId || 'default');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported in this browser.');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'user' },
        audio: false
      };

      console.log('[Empathy] Requesting stream with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('[Empathy] Got stream:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().length,
        videoTrack: {
          label: videoTrack.label,
          enabled: videoTrack.enabled,
          readyState: videoTrack.readyState,
          settings: settings
        }
      });

      setDebugInfo(`Stream: ${videoTrack.label} (${settings.width}x${settings.height})`);
      streamRef.current = stream;
      setCameraActive(true);
      onToggle(true);
    } catch (err) {
      console.error('[Empathy] Camera access error:', err);
      setDebugInfo(`Error: ${err}`);

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true);
          setError('Camera permission denied.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera in use by another app.');
        } else if (err.name === 'OverconstrainedError') {
          // Retry without device constraint
          console.log('[Empathy] Retrying with default constraints...');
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            streamRef.current = fallbackStream;
            setCameraActive(true);
            onToggle(true);
            setError(null);
            return;
          } catch (e) {
            setError('Could not access camera.');
          }
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('Failed to access camera.');
      }

      setCameraActive(false);
      onToggle(false);
    }
  }, [onToggle]);

  const handleToggle = useCallback(() => {
    if (cameraActive) {
      stopCamera();
      onToggle(false);
    } else {
      startCamera(selectedDevice);
    }
  }, [cameraActive, stopCamera, startCamera, selectedDevice, onToggle]);

  const handleDeviceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    console.log('[Empathy] Device changed to:', newDeviceId);
    setSelectedDevice(newDeviceId);

    if (cameraActive) {
      stopCamera();
      setTimeout(() => startCamera(newDeviceId), 100);
    }
  }, [cameraActive, stopCamera, startCamera]);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      const stream = streamRef.current;

      console.log('[Empathy] Attaching stream to video element');
      console.log('[Empathy] Video element:', {
        readyState: video.readyState,
        paused: video.paused,
        currentSrc: video.currentSrc
      });

      video.srcObject = stream;

      // Listen for video events
      video.onloadedmetadata = () => {
        console.log('[Empathy] Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
        setDebugInfo(`Video: ${video.videoWidth}x${video.videoHeight}`);
      };

      video.onplay = () => {
        console.log('[Empathy] Video playing');
      };

      video.onerror = (e) => {
        console.error('[Empathy] Video error:', e);
      };

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[Empathy] Video play() succeeded');
          })
          .catch((err) => {
            console.warn('[Empathy] Video autoplay failed:', err);
          });
      }
    }
  }, [cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Stop camera if disabled externally
  useEffect(() => {
    if (!enabled && cameraActive) {
      stopCamera();
    }
  }, [enabled, cameraActive, stopCamera]);

  const getEmotionColor = (emotion: string): string => {
    return EMOTION_COLORS[emotion.toLowerCase()] || EMOTION_COLORS.neutral;
  };

  const formatValenceLabel = (valence: number): string => {
    if (valence < -0.3) return 'Negative';
    if (valence > 0.3) return 'Positive';
    return 'Neutral';
  };

  const formatArousalLabel = (arousal: number): string => {
    if (arousal < 0.3) return 'Calm';
    if (arousal > 0.7) return 'Excited';
    return 'Moderate';
  };

  return (
    <div className="bg-emblem-surface-2 rounded-lg p-4 border border-emblem-surface-2">
      <h3 className="mb-4 bg-gradient-to-r from-emblem-secondary to-emblem-primary bg-clip-text text-transparent font-semibold">
        Empathy Mode
      </h3>

      {/* Device selector */}
      {devices.length > 1 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <label htmlFor="camera-select" className="text-emblem-muted">
            Camera:
          </label>
          <select
            id="camera-select"
            value={selectedDevice}
            onChange={handleDeviceChange}
            className="flex-1 bg-emblem-surface border border-emblem-surface-2 rounded px-2 py-1 text-emblem-text text-xs cursor-pointer focus:outline-none focus:border-emblem-secondary"
          >
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative w-full max-w-[280px] aspect-[4/3] mx-auto mb-4 rounded-lg overflow-hidden bg-emblem-surface border border-emblem-surface-2">
        {cameraActive ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1] block"
            autoPlay
            playsInline
            muted
            style={{ backgroundColor: '#000' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emblem-muted text-2xl">
            {permissionDenied ? (
              <Lock className="w-8 h-8 text-emblem-danger opacity-70" />
            ) : (
              <Camera className="w-8 h-8 opacity-50" />
            )}
          </div>
        )}

        {cameraActive && emotionContext && (
          <div
            className="absolute top-2 right-2 w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] animate-pulse-glow"
            style={{ backgroundColor: getEmotionColor(emotionContext.currentEmotion) }}
          />
        )}
      </div>

      {/* Model loading status */}
      {modelsLoading && (
        <div className="flex items-center justify-center gap-2 p-3 mb-3 bg-emblem-secondary/10 border border-emblem-secondary/30 rounded-md text-emblem-secondary text-xs">
          <span className="w-2 h-2 bg-emblem-secondary rounded-full animate-pulse-glow" />
          Loading face detection models...
        </div>
      )}

      {/* Debug info */}
      {(debugInfo || detectionStatus) && !modelsLoading && (
        <div className="bg-emblem-secondary/10 border border-emblem-secondary/30 rounded px-2 py-2 mb-3 text-[10px] text-emblem-secondary font-mono break-all">
          {debugInfo}
          {debugInfo && detectionStatus && ' | '}
          {detectionStatus}
          {isDetecting && ' ...'}
        </div>
      )}

      {error && (
        <div className="bg-emblem-danger/10 border border-emblem-danger/30 rounded-md p-3 mb-4 text-xs text-emblem-danger text-center">
          {error}
        </div>
      )}

      {cameraActive && emotionContext && (
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2 p-2 bg-emblem-surface rounded-md">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getEmotionColor(emotionContext.currentEmotion) }}
            />
            <span className="flex-1 font-medium capitalize text-sm">
              {emotionContext.currentEmotion}
            </span>
            <span className="text-emblem-secondary text-xs font-semibold">
              {Math.round(emotionContext.confidence * 100)}%
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-emblem-muted">Valence</span>
              <span className="text-emblem-text font-medium">{formatValenceLabel(emotionContext.valence)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="relative h-1.5 bg-gradient-to-r from-emblem-danger via-emblem-surface 45% via-emblem-surface 55% to-emblem-accent rounded-full">
                <div
                  className="absolute top-1/2 w-3 h-3 bg-gradient-to-br from-emblem-secondary to-emblem-primary rounded-full -translate-y-1/2 -translate-x-1/2 shadow-[0_0_6px_rgba(0,255,255,0.5)] transition-all duration-300"
                  style={{ left: `${(emotionContext.valence + 1) * 50}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-emblem-muted px-0.5">
                <span>-</span>
                <span>+</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-emblem-muted">Arousal</span>
              <span className="text-emblem-text font-medium">{formatArousalLabel(emotionContext.arousal)}</span>
            </div>
            <div className="relative w-full h-6 bg-emblem-surface rounded overflow-hidden">
              <div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emblem-secondary to-emblem-primary rounded transition-all duration-300"
                style={{ height: `${emotionContext.arousal * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-emblem-muted flex-shrink-0">Stability</span>
            <div className="flex-1 h-1 bg-emblem-surface rounded overflow-hidden">
              <div
                className="h-full bg-emblem-accent rounded transition-all duration-300"
                style={{ width: `${emotionContext.stability * 100}%` }}
              />
            </div>
          </div>

          {/* Aggregate Stats */}
          {emotionAggregate && (
            <div className="mt-2 p-2 bg-emblem-surface rounded-md border border-emblem-surface-2">
              <div className="flex justify-between items-center py-1 text-[11px]">
                <span className="text-emblem-muted">Samples</span>
                <span className="text-emblem-text font-medium">{emotionAggregate.sampleCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-emblem-surface-2 text-[11px]">
                <span className="text-emblem-muted">Trend</span>
                <span className={cn(
                  'font-medium',
                  emotionAggregate.trend === 'improving' && 'text-emblem-accent',
                  emotionAggregate.trend === 'stable' && 'text-emblem-secondary',
                  emotionAggregate.trend === 'declining' && 'text-emblem-danger'
                )}>
                  {emotionAggregate.trend === 'improving' ? '↑' : emotionAggregate.trend === 'declining' ? '↓' : '→'} {emotionAggregate.trend}
                </span>
              </div>
              {emotionAggregate.suggestedEmpathyBoost > 0 && (
                <div className="flex justify-between items-center py-1 border-t border-emblem-surface-2 text-[11px]">
                  <span className="text-emblem-muted">Empathy Boost</span>
                  <span className="text-emblem-text font-medium">+{emotionAggregate.suggestedEmpathyBoost}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {cameraActive && !emotionContext && !modelsLoading && (
        <div className="flex items-center justify-center gap-2 p-3 mb-4 text-emblem-muted text-sm">
          <span className="w-2 h-2 bg-emblem-secondary rounded-full animate-pulse-glow" />
          Analyzing...
        </div>
      )}

      <Button
        onClick={handleToggle}
        className={cn(
          'w-full',
          cameraActive && 'bg-gradient-to-r from-emblem-secondary to-emblem-primary'
        )}
        variant={cameraActive ? 'default' : 'secondary'}
      >
        {cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
      </Button>

      {/* Advanced Settings Section */}
      <div className="mt-4 border border-emblem-surface-2 rounded-lg overflow-hidden bg-emblem-surface">
        <button
          className="flex items-center gap-2 w-full p-3 bg-transparent border-none text-emblem-text text-xs font-medium cursor-pointer transition-colors hover:bg-emblem-surface-2"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          aria-expanded={advancedOpen}
        >
          <ChevronRight
            className={cn(
              'w-3 h-3 text-emblem-muted transition-transform',
              advancedOpen && 'rotate-90'
            )}
          />
          Advanced Settings
        </button>

        {advancedOpen && (
          <div className="p-3 border-t border-emblem-surface-2 flex flex-col gap-3">
            {/* Claude Vision Toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Switch
                checked={useClaudeVision}
                onCheckedChange={setUseClaudeVision}
              />
              <span className="text-xs text-emblem-text">AI Emotion Analysis</span>
            </label>

            {useClaudeVision && (
              <p className="m-0 text-[11px] text-emblem-muted leading-relaxed pl-[52px]">
                Captures frames and sends them to Claude for additional emotion inference.
              </p>
            )}

            {/* Emotion Prompt Editor (only visible when Claude Vision is enabled) */}
            {useClaudeVision && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-emblem-muted">
                  Emotion Analysis Prompt:
                </label>
                <textarea
                  className="w-full min-h-[120px] p-3 bg-emblem-surface-2 border border-emblem-surface-2 rounded-md text-emblem-text font-mono text-[11px] leading-relaxed resize-y transition-all focus:outline-none focus:border-emblem-secondary focus:shadow-[0_0_0_2px_rgba(0,255,255,0.2)]"
                  value={emotionPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  rows={8}
                  placeholder="Enter the prompt for Claude Vision emotion analysis..."
                />
                <Button
                  onClick={handleResetPrompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                >
                  Reset to Default
                </Button>
              </div>
            )}

            {/* Detection Settings */}
            <div className="mt-4 pt-3 border-t border-emblem-surface-2">
              <h4 className="text-xs font-semibold text-emblem-muted mb-3 uppercase tracking-wider">
                Detection Settings
              </h4>

              {/* Camera Interval */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-emblem-text">Camera Interval</span>
                  <span className="text-xs text-emblem-secondary font-medium">{config?.empathyCameraInterval ?? 1000}ms</span>
                </div>
                <Slider
                  min={100}
                  max={5000}
                  step={100}
                  value={[config?.empathyCameraInterval ?? 1000]}
                  onValueChange={(values) => onConfigUpdate?.({ empathyCameraInterval: values[0] })}
                />
                <p className="text-[10px] text-emblem-muted mt-1 opacity-70">
                  How often to capture frames for emotion detection
                </p>
              </div>

              {/* Min Confidence */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-emblem-text">Min Confidence</span>
                  <span className="text-xs text-emblem-secondary font-medium">{Math.round((config?.empathyMinConfidence ?? 0.5) * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={[Math.round((config?.empathyMinConfidence ?? 0.5) * 100)]}
                  onValueChange={(values) => onConfigUpdate?.({ empathyMinConfidence: values[0] / 100 })}
                />
                <p className="text-[10px] text-emblem-muted mt-1 opacity-70">
                  Minimum confidence threshold for emotion detection
                </p>
              </div>

              {/* Auto-Adjust Response */}
              <div className="mb-3">
                <label className="flex items-center justify-between text-xs text-emblem-text cursor-pointer">
                  <span>Auto-Adjust Response</span>
                  <Switch
                    checked={config?.empathyAutoAdjust ?? false}
                    onCheckedChange={(checked) => onConfigUpdate?.({ empathyAutoAdjust: checked })}
                  />
                </label>
              </div>

              {/* Max Boost */}
              <div className="mb-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-emblem-text">Max Boost</span>
                  <span className="text-xs text-emblem-secondary font-medium">{config?.empathyBoostMax ?? 10}</span>
                </div>
                <Slider
                  min={0}
                  max={50}
                  value={[config?.empathyBoostMax ?? 10]}
                  onValueChange={(values) => onConfigUpdate?.({ empathyBoostMax: values[0] })}
                />
                <p className="text-[10px] text-emblem-muted mt-1 opacity-70">
                  Maximum empathy boost value applied to responses
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-emblem-surface-2 text-[11px] text-emblem-muted opacity-70 leading-relaxed">
        Empathy mode uses your webcam to detect emotional context and adapt responses accordingly.
      </div>
    </div>
  );
}
