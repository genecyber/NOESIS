/**
 * EvolutionTimeline - Visualize stance evolution over conversation
 * Ralph Iteration 2 - Feature 5
 */

'use client';

import { useState } from 'react';
import styles from './EvolutionTimeline.module.css';
import type { Stance } from '../lib/types';

interface EvolutionSnapshot {
  id: string;
  timestamp: Date;
  stance: Stance;
  trigger: 'drift_threshold' | 'frame_shift' | 'manual' | 'session_end';
  driftAtSnapshot: number;
}

interface EvolutionTimelineProps {
  snapshots: EvolutionSnapshot[];
  currentStance?: Stance;
  onSnapshotClick?: (snapshot: EvolutionSnapshot) => void;
}

const FRAME_COLORS: Record<string, string> = {
  pragmatic: '#6366f1',
  existential: '#8b5cf6',
  poetic: '#ec4899',
  adversarial: '#f97316',
  playful: '#22c55e',
  mythic: '#eab308',
  systems: '#14b8a6',
  psychoanalytic: '#a855f7',
  stoic: '#64748b',
  absurdist: '#ef4444'
};

const TRIGGER_LABELS: Record<string, string> = {
  drift_threshold: 'Drift',
  frame_shift: 'Frame Shift',
  manual: 'Manual',
  session_end: 'Session End'
};

export function EvolutionTimeline({
  snapshots,
  currentStance,
  onSnapshotClick
}: EvolutionTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Reverse to show newest first
  const displaySnapshots = [...snapshots].reverse();

  // Calculate max drift for scaling
  const maxDrift = Math.max(...snapshots.map(s => s.driftAtSnapshot), currentStance?.cumulativeDrift || 0, 100);

  const getDriftHeight = (drift: number) => {
    return Math.round((drift / maxDrift) * 100);
  };

  const isMajorTransform = (snapshot: EvolutionSnapshot, prevSnapshot?: EvolutionSnapshot) => {
    if (!prevSnapshot) return snapshot.trigger === 'frame_shift';
    return snapshot.stance.frame !== prevSnapshot.stance.frame ||
           snapshot.trigger === 'frame_shift';
  };

  if (snapshots.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Evolution Timeline</h3>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>~</div>
          <p>No evolution snapshots yet.</p>
          <p className={styles.emptyHint}>Snapshots are created as the stance drifts or shifts frames.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Evolution Timeline</h3>
        <span className={styles.count}>{snapshots.length} snapshots</span>
      </div>

      {/* Current Stance Indicator */}
      {currentStance && (
        <div className={styles.currentStance}>
          <div
            className={styles.currentDot}
            style={{ backgroundColor: FRAME_COLORS[currentStance.frame] || '#00d9ff' }}
          />
          <span>Current: {currentStance.frame}</span>
          <span className={styles.driftValue}>Drift: {currentStance.cumulativeDrift}</span>
        </div>
      )}

      {/* Timeline Visualization */}
      <div className={styles.timeline}>
        {displaySnapshots.map((snapshot, index) => {
          const prevSnapshot = displaySnapshots[index + 1];
          const isMajor = isMajorTransform(snapshot, prevSnapshot);
          const isSelected = selectedId === snapshot.id;
          const isHovered = hoveredId === snapshot.id;
          const frameColor = FRAME_COLORS[snapshot.stance.frame] || '#00d9ff';

          return (
            <div
              key={snapshot.id}
              className={`${styles.snapshot} ${isMajor ? styles.major : ''} ${isSelected ? styles.selected : ''}`}
              onClick={() => {
                setSelectedId(isSelected ? null : snapshot.id);
                onSnapshotClick?.(snapshot);
              }}
              onMouseEnter={() => setHoveredId(snapshot.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Drift bar */}
              <div className={styles.driftBar}>
                <div
                  className={styles.driftFill}
                  style={{
                    height: `${getDriftHeight(snapshot.driftAtSnapshot)}%`,
                    backgroundColor: frameColor,
                    opacity: isHovered || isSelected ? 1 : 0.7
                  }}
                />
              </div>

              {/* Snapshot dot */}
              <div
                className={`${styles.dot} ${isMajor ? styles.majorDot : ''}`}
                style={{
                  backgroundColor: frameColor,
                  transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                }}
              />

              {/* Trigger label */}
              <div className={styles.label}>
                <span className={styles.triggerLabel}>
                  {TRIGGER_LABELS[snapshot.trigger]}
                </span>
                <span className={styles.frame}>{snapshot.stance.frame}</span>
              </div>

              {/* Expanded details */}
              {isSelected && (
                <div className={styles.details}>
                  <div className={styles.detailRow}>
                    <span>Time:</span>
                    <span>{new Date(snapshot.timestamp).toLocaleString()}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Frame:</span>
                    <span style={{ color: frameColor }}>{snapshot.stance.frame}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Self-Model:</span>
                    <span>{snapshot.stance.selfModel}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Drift:</span>
                    <span>{snapshot.driftAtSnapshot}</span>
                  </div>
                  <div className={styles.valuesPreview}>
                    <span>Awareness: {snapshot.stance.sentience.awarenessLevel}</span>
                    <span>Autonomy: {snapshot.stance.sentience.autonomyLevel}</span>
                    <span>Identity: {snapshot.stance.sentience.identityStrength}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.majorDot}`} />
          <span>Major transform</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} />
          <span>Minor drift</span>
        </div>
      </div>
    </div>
  );
}

export default EvolutionTimeline;
