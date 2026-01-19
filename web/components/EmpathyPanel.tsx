'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './EmpathyPanel.module.css';

interface EmotionContext {
  currentEmotion: string;
  valence: number;
  arousal: number;
  confidence: number;
  stability: number;
}

interface EmpathyPanelProps {
  enabled: boolean;
  emotionContext?: EmotionContext | null;
  onToggle: (enabled: boolean) => void;
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

export default function EmpathyPanel({ enabled, emotionContext, onToggle }: EmpathyPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

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
  }, []);

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
    <div className={styles.panel}>
      <h3>Empathy Mode</h3>

      {/* Device selector */}
      {devices.length > 1 && (
        <div className={styles.deviceSelector}>
          <label htmlFor="camera-select">Camera:</label>
          <select
            id="camera-select"
            value={selectedDevice}
            onChange={handleDeviceChange}
            className={styles.select}
          >
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.previewContainer}>
        {cameraActive ? (
          <video
            ref={videoRef}
            className={styles.preview}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: 'auto', backgroundColor: '#000' }}
          />
        ) : (
          <div className={styles.placeholder}>
            {permissionDenied ? (
              <span className={styles.permissionIcon}>🔒</span>
            ) : (
              <span className={styles.cameraIcon}>📷</span>
            )}
          </div>
        )}

        {cameraActive && emotionContext && (
          <div
            className={styles.emotionIndicator}
            style={{ backgroundColor: getEmotionColor(emotionContext.currentEmotion) }}
          />
        )}
      </div>

      {/* Debug info */}
      {debugInfo && (
        <div className={styles.debugInfo}>
          {debugInfo}
        </div>
      )}

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {cameraActive && emotionContext && (
        <div className={styles.emotionData}>
          <div className={styles.currentEmotion}>
            <span
              className={styles.emotionDot}
              style={{ backgroundColor: getEmotionColor(emotionContext.currentEmotion) }}
            />
            <span className={styles.emotionLabel}>
              {emotionContext.currentEmotion}
            </span>
            <span className={styles.confidence}>
              {Math.round(emotionContext.confidence * 100)}%
            </span>
          </div>

          <div className={styles.metric}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Valence</span>
              <span className={styles.metricValue}>{formatValenceLabel(emotionContext.valence)}</span>
            </div>
            <div className={styles.valenceBar}>
              <div className={styles.valenceTrack}>
                <div
                  className={styles.valenceIndicator}
                  style={{ left: `${(emotionContext.valence + 1) * 50}%` }}
                />
              </div>
              <div className={styles.valenceLabels}>
                <span>-</span>
                <span>+</span>
              </div>
            </div>
          </div>

          <div className={styles.metric}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Arousal</span>
              <span className={styles.metricValue}>{formatArousalLabel(emotionContext.arousal)}</span>
            </div>
            <div className={styles.arousalBar}>
              <div
                className={styles.arousalFill}
                style={{ height: `${emotionContext.arousal * 100}%` }}
              />
            </div>
          </div>

          <div className={styles.stability}>
            <span className={styles.stabilityLabel}>Stability</span>
            <div className={styles.stabilityBar}>
              <div
                className={styles.stabilityFill}
                style={{ width: `${emotionContext.stability * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {cameraActive && !emotionContext && (
        <div className={styles.analyzing}>
          <span className={styles.pulse} />
          Analyzing...
        </div>
      )}

      <button
        className={`${styles.toggleBtn} ${cameraActive ? styles.active : ''}`}
        onClick={handleToggle}
      >
        {cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
      </button>

      <div className={styles.info}>
        Empathy mode uses your webcam to detect emotional context and adapt responses accordingly.
      </div>
    </div>
  );
}
