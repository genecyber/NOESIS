'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, Radar } from 'lucide-react';
import type { Stance } from '@/lib/types';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'radar';

interface StanceVizProps {
  stance: Stance | null;
}

interface ValueChange {
  key: string;
  delta: number;
  timestamp: number;
}

// Radar chart component
function RadarChart({ values, sentience }: { values: Stance['values']; sentience: Stance['sentience'] }) {
  const size = 240;
  const center = size / 2;
  const radius = size * 0.38;

  // Combine values and sentience for radar
  const dataPoints = [
    { label: 'Curiosity', value: values.curiosity ?? 50 },
    { label: 'Certainty', value: values.certainty ?? 50 },
    { label: 'Risk', value: values.risk ?? 50 },
    { label: 'Novelty', value: values.novelty ?? 50 },
    { label: 'Empathy', value: values.empathy ?? 50 },
    { label: 'Provocation', value: values.provocation ?? 50 },
    { label: 'Synthesis', value: values.synthesis ?? 50 },
    { label: 'Awareness', value: sentience.awarenessLevel },
  ];

  const numPoints = dataPoints.length;
  const angleStep = (Math.PI * 2) / numPoints;

  // Calculate polygon points for data
  const getPoint = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Generate grid circles
  const gridCircles = [20, 40, 60, 80, 100];

  // Generate axis lines and labels
  const axes = dataPoints.map((point, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const endX = center + radius * Math.cos(angle);
    const endY = center + radius * Math.sin(angle);
    const labelX = center + (radius + 18) * Math.cos(angle);
    const labelY = center + (radius + 18) * Math.sin(angle);
    return { point, endX, endY, labelX, labelY, angle };
  });

  // Generate data polygon path
  const polygonPoints = dataPoints
    .map((_, i) => {
      const p = getPoint(dataPoints[i].value, i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {/* Grid circles */}
      {gridCircles.map((pct) => (
        <circle
          key={pct}
          cx={center}
          cy={center}
          r={(pct / 100) * radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-white/10"
          strokeDasharray={pct === 100 ? "none" : "2,2"}
        />
      ))}

      {/* Axis lines */}
      {axes.map(({ endX, endY }, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={endX}
          y2={endY}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-white/10"
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="url(#radarGradient)"
        stroke="url(#radarStroke)"
        strokeWidth="2"
        className="opacity-80"
      />

      {/* Data points */}
      {dataPoints.map((_, i) => {
        const p = getPoint(dataPoints[i].value, i);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            className="fill-emblem-secondary"
          />
        );
      })}

      {/* Labels */}
      {axes.map(({ point, labelX, labelY, angle }, i) => (
        <text
          key={i}
          x={labelX}
          y={labelY}
          textAnchor={Math.abs(angle) < 0.1 ? 'middle' : angle > -Math.PI / 2 && angle < Math.PI / 2 ? 'start' : 'end'}
          dominantBaseline="middle"
          className="fill-emblem-muted text-[9px] font-mono"
        >
          {point.label}
        </text>
      ))}

      {/* Gradient definitions */}
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(246 100% 68%)" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(190 100% 50%)" />
          <stop offset="100%" stopColor="hsl(155 100% 55%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function StanceViz({ stance }: StanceVizProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [prevStance, setPrevStance] = useState<Stance | null>(null);
  const [valueChanges, setValueChanges] = useState<ValueChange[]>([]);
  const [frameShifted, setFrameShifted] = useState(false);
  const [newGoals, setNewGoals] = useState<Set<string>>(new Set());
  const prevGoalsRef = useRef<string[]>([]);

  // Track changes when stance updates
  useEffect(() => {
    if (!stance) return;

    if (prevStance) {
      // Detect value changes
      const changes: ValueChange[] = [];
      const now = Date.now();

      Object.entries(stance.values).forEach(([key, value]) => {
        const prevValue = prevStance.values[key as keyof typeof prevStance.values];
        if (prevValue !== undefined && value !== prevValue) {
          changes.push({ key, delta: value - prevValue, timestamp: now });
        }
      });

      // Track sentience changes
      if (stance.sentience.awarenessLevel !== prevStance.sentience.awarenessLevel) {
        changes.push({
          key: 'awareness',
          delta: stance.sentience.awarenessLevel - prevStance.sentience.awarenessLevel,
          timestamp: now
        });
      }

      if (changes.length > 0) {
        setValueChanges(changes);
        // Clear after animation
        setTimeout(() => setValueChanges([]), 2000);
      }

      // Detect frame shift
      if (stance.frame !== prevStance.frame) {
        setFrameShifted(true);
        setTimeout(() => setFrameShifted(false), 1500);
      }

      // Detect new emergent goals
      const prevGoals = new Set(prevGoalsRef.current);
      const newGoalSet = new Set<string>();
      stance.sentience.emergentGoals.forEach(goal => {
        if (!prevGoals.has(goal)) {
          newGoalSet.add(goal);
        }
      });
      if (newGoalSet.size > 0) {
        setNewGoals(newGoalSet);
        setTimeout(() => setNewGoals(new Set()), 3000);
      }
    }

    prevGoalsRef.current = stance.sentience.emergentGoals;
    setPrevStance(stance);
  }, [stance, prevStance]);

  if (!stance) {
    return (
      <div className="glass-card p-4">
        <div className="text-center py-8 text-emblem-muted">Loading stance...</div>
      </div>
    );
  }

  const getChangeForKey = (key: string): ValueChange | undefined =>
    valueChanges.find(c => c.key === key);

  const isHighValue = (value: number) => value >= 80;
  const isLowValue = (value: number) => value <= 20;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold gradient-text">Stance</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('list')}
            disabled={viewMode === 'list'}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'list'
                ? 'bg-emblem-primary/20 text-emblem-primary cursor-default'
                : 'text-emblem-muted hover:text-emblem-text hover:bg-white/5'
            )}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('radar')}
            disabled={viewMode === 'radar'}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'radar'
                ? 'bg-emblem-primary/20 text-emblem-primary cursor-default'
                : 'text-emblem-muted hover:text-emblem-text hover:bg-white/5'
            )}
            title="Radar view"
          >
            <Radar className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'radar' ? (
        <>
          <RadarChart values={stance.values} sentience={stance.sentience} />
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-emblem-muted">Frame</span>
              <span className="text-emblem-secondary font-medium">{stance.frame}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emblem-muted">Self-Model</span>
              <span className="text-emblem-secondary font-medium">{stance.selfModel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emblem-muted">Objective</span>
              <span className="text-emblem-secondary font-medium">{stance.objective}</span>
            </div>
          </div>
        </>
      ) : (
        <>
      <div className="flex flex-col gap-2">
        <div className={cn(
          'flex justify-between text-sm transition-all duration-300',
          frameShifted && 'animate-frame-shift'
        )}>
          <span className="text-emblem-muted">Frame</span>
          <span className="text-emblem-secondary font-medium">{stance.frame}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emblem-muted">Self-Model</span>
          <span className="text-emblem-secondary font-medium">{stance.selfModel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emblem-muted">Objective</span>
          <span className="text-emblem-secondary font-medium">{stance.objective}</span>
        </div>
      </div>

      <h4 className="mt-4 mb-2 text-sm text-emblem-muted">Values</h4>
      <div className="flex flex-col gap-2">
        {Object.entries(stance.values).map(([key, value]) => {
          const change = getChangeForKey(key);
          const highPulse = isHighValue(value);
          const lowPulse = isLowValue(value);

          return (
            <div
              key={key}
              className={cn(
                'grid grid-cols-[80px_1fr_60px] items-center gap-2 text-xs transition-all duration-300',
                change && 'animate-value-change'
              )}
            >
              <span className="capitalize text-emblem-muted">{key}</span>
              <div className="h-1.5 bg-emblem-surface rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={cn(
                    'h-full bg-gradient-to-r from-emblem-secondary to-emblem-accent rounded-full',
                    highPulse && 'animate-pulse-high',
                    lowPulse && 'animate-pulse-low'
                  )}
                />
              </div>
              <span className="text-right text-emblem-muted flex items-center gap-1 justify-end">
                {value}%
                {change && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1 rounded',
                    change.delta > 0 ? 'text-emblem-accent bg-emblem-accent/15' : 'text-emblem-danger bg-emblem-danger/15'
                  )}>
                    {change.delta > 0 ? '+' : ''}{change.delta}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <h4 className="mt-4 mb-2 text-sm text-emblem-muted">Sentience</h4>
      <div className="flex flex-col gap-2">
        {[
          { key: 'awareness', label: 'Awareness', value: stance.sentience.awarenessLevel },
          { key: 'autonomy', label: 'Autonomy', value: stance.sentience.autonomyLevel },
          { key: 'identity', label: 'Identity', value: stance.sentience.identityStrength }
        ].map(({ key, label, value }) => {
          const change = getChangeForKey(key);
          const highPulse = isHighValue(value);

          return (
            <div
              key={key}
              className={cn(
                'grid grid-cols-[80px_1fr_60px] items-center gap-2 text-xs transition-all duration-300',
                change && 'animate-value-change'
              )}
            >
              <span className="text-emblem-muted">{label}</span>
              <div className="h-1.5 bg-emblem-surface rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={cn(
                    'h-full bg-gradient-to-r from-emblem-primary to-emblem-secondary rounded-full',
                    highPulse && 'animate-pulse-high'
                  )}
                />
              </div>
              <span className="text-right text-emblem-muted flex items-center gap-1 justify-end">
                {value}%
                {change && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1 rounded',
                    change.delta > 0 ? 'text-emblem-accent bg-emblem-accent/15' : 'text-emblem-danger bg-emblem-danger/15'
                  )}>
                    {change.delta > 0 ? '+' : ''}{change.delta}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {stance.sentience.emergentGoals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <h4 className="mt-4 mb-2 text-sm text-emblem-muted">Emergent Goals</h4>
            <ul className="text-xs list-none">
              {stance.sentience.emergentGoals.map((goal, i) => (
                <motion.li
                  key={goal}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.1 }}
                  className={cn(
                    'py-1 text-emblem-primary',
                    newGoals.has(goal) && 'text-emblem-accent'
                  )}
                >
                  <span className="text-emblem-secondary mr-1">•</span>
                  {goal}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}

      <div className="flex justify-between mt-4 pt-2 border-t border-white/5 text-xs text-emblem-muted">
        <span>v{stance.version}</span>
        <span>Drift: {stance.cumulativeDrift}</span>
      </div>
    </div>
  );
}
