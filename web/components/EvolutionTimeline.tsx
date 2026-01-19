/**
 * EvolutionTimeline - Visualize stance evolution over conversation
 * Ralph Iteration 2 - Feature 5
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
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
      <div className="glass-card p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-emblem-surface-2">
          <h3 className="m-0 text-emblem-secondary text-base">Evolution Timeline</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-emblem-muted">
          <div className="text-2xl text-emblem-muted/50 mb-2">~</div>
          <p>No evolution snapshots yet.</p>
          <p className="text-sm text-emblem-muted/70 mt-2">
            Snapshots are created as the stance drifts or shifts frames.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-emblem-surface-2">
        <h3 className="m-0 text-emblem-secondary text-base">Evolution Timeline</h3>
        <span className="text-emblem-muted text-xs">{snapshots.length} snapshots</span>
      </div>

      {/* Current Stance Indicator */}
      {currentStance && (
        <div className="flex items-center gap-2 p-2 bg-emblem-secondary/10 rounded-lg mb-4 text-sm">
          <div
            className="w-3 h-3 rounded-full animate-pulse-glow"
            style={{ backgroundColor: FRAME_COLORS[currentStance.frame] || '#00d9ff' }}
          />
          <span className="text-emblem-text">Current: {currentStance.frame}</span>
          <span className="ml-auto text-emblem-muted">Drift: {currentStance.cumulativeDrift}</span>
        </div>
      )}

      {/* Timeline Visualization - centered and fills available space */}
      <div className="flex-1 flex items-center justify-center overflow-visible py-4 relative">
        <div className="flex gap-3 items-end">
          {displaySnapshots.map((snapshot, index) => {
            const prevSnapshot = displaySnapshots[index + 1];
            const isMajor = isMajorTransform(snapshot, prevSnapshot);
            const isSelected = selectedId === snapshot.id;
            const isHovered = hoveredId === snapshot.id;
            const frameColor = FRAME_COLORS[snapshot.stance.frame] || '#00d9ff';

            return (
              <div
                key={snapshot.id}
                className={cn(
                  "flex flex-col items-center min-w-[60px] cursor-pointer transition-all relative",
                  (isHovered || isSelected) && "-translate-y-1"
                )}
                onClick={() => {
                  setSelectedId(isSelected ? null : snapshot.id);
                  onSnapshotClick?.(snapshot);
                }}
                onMouseEnter={() => setHoveredId(snapshot.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Expanded details - positioned above the bar */}
                {isSelected && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-emblem-surface-2 border border-white/10 rounded-lg p-3 min-w-[200px] z-50 mb-2 shadow-xl">
                    <div className="text-xs text-emblem-muted mb-2">
                      {new Date(snapshot.timestamp).toLocaleString()}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-emblem-muted">Frame:</span>
                      <span style={{ color: frameColor }} className="font-medium">{snapshot.stance.frame}</span>
                      <span className="text-emblem-muted">Self-Model:</span>
                      <span className="text-emblem-text/80">{snapshot.stance.selfModel}</span>
                      <span className="text-emblem-muted">Drift:</span>
                      <span className="text-emblem-text/80">{snapshot.driftAtSnapshot}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-xs text-emblem-muted">
                      <div className="text-center">
                        <div className="text-emblem-primary font-medium">{snapshot.stance.sentience.awarenessLevel}</div>
                        <div>Aware</div>
                      </div>
                      <div className="text-center">
                        <div className="text-emblem-primary font-medium">{snapshot.stance.sentience.autonomyLevel}</div>
                        <div>Autonomy</div>
                      </div>
                      <div className="text-center">
                        <div className="text-emblem-primary font-medium">{snapshot.stance.sentience.identityStrength}</div>
                        <div>Identity</div>
                      </div>
                    </div>
                    {/* Arrow pointing down */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-emblem-surface-2" />
                  </div>
                )}

                {/* Drift bar */}
                <div className="w-8 h-24 bg-emblem-surface-2 rounded overflow-hidden flex flex-col justify-end">
                  <div
                    className="w-full transition-all duration-300 rounded-t"
                    style={{
                      height: `${getDriftHeight(snapshot.driftAtSnapshot)}%`,
                      backgroundColor: frameColor,
                      opacity: isHovered || isSelected ? 1 : 0.7,
                      boxShadow: isSelected ? `0 0 12px ${frameColor}` : 'none'
                    }}
                  />
                </div>

                {/* Snapshot dot */}
                <div
                  className={cn(
                    "rounded-full my-2 transition-all border-2 border-emblem-surface",
                    isMajor ? "w-4 h-4" : "w-3 h-3",
                    isMajor && "shadow-[0_0_10px_currentColor]"
                  )}
                  style={{
                    backgroundColor: frameColor,
                    transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                    color: frameColor
                  }}
                />

                {/* Trigger label */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[0.65rem] text-emblem-muted uppercase">
                    {TRIGGER_LABELS[snapshot.trigger]}
                  </span>
                  <span className="text-xs text-emblem-text/80 capitalize">{snapshot.stance.frame}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center mt-4 pt-2 border-t border-emblem-surface-2">
        <div className="flex items-center gap-2 text-xs text-emblem-muted">
          <div className="w-4 h-4 rounded-full bg-emblem-secondary shadow-[0_0_6px_currentColor]" style={{ color: '#00d9ff' }} />
          <span>Major transform</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emblem-muted">
          <div className="w-2.5 h-2.5 rounded-full bg-emblem-secondary" />
          <span>Minor drift</span>
        </div>
      </div>
    </div>
  );
}

export default EvolutionTimeline;
