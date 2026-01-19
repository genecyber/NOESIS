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

// Radar chart component with interactivity and animations
function RadarChart({
  values,
  sentience,
  changedKeys = new Set<string>()
}: {
  values: Stance['values'];
  sentience: Stance['sentience'];
  changedKeys?: Set<string>;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const size = 320;
  const center = size / 2;
  const radius = size * 0.28;

  // All values + sentience metrics (10 total) with type info
  const dataPoints = [
    { label: 'Curiosity', value: values.curiosity ?? 50, key: 'curiosity', type: 'value' as const },
    { label: 'Certainty', value: values.certainty ?? 50, key: 'certainty', type: 'value' as const },
    { label: 'Risk', value: values.risk ?? 50, key: 'risk', type: 'value' as const },
    { label: 'Novelty', value: values.novelty ?? 50, key: 'novelty', type: 'value' as const },
    { label: 'Empathy', value: values.empathy ?? 50, key: 'empathy', type: 'value' as const },
    { label: 'Provocation', value: values.provocation ?? 50, key: 'provocation', type: 'value' as const },
    { label: 'Synthesis', value: values.synthesis ?? 50, key: 'synthesis', type: 'value' as const },
    { label: 'Awareness', value: sentience.awarenessLevel, key: 'awareness', type: 'sentience' as const },
    { label: 'Autonomy', value: sentience.autonomyLevel, key: 'autonomy', type: 'sentience' as const },
    { label: 'Identity', value: sentience.identityStrength, key: 'identity', type: 'sentience' as const },
  ];

  const numPoints = dataPoints.length;
  const angleStep = (Math.PI * 2) / numPoints;

  const getPoint = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const gridCircles = [20, 40, 60, 80, 100];

  const axes = dataPoints.map((point, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const endX = center + radius * Math.cos(angle);
    const endY = center + radius * Math.sin(angle);
    const labelX = center + (radius + 30) * Math.cos(angle);
    const labelY = center + (radius + 30) * Math.sin(angle);
    return { point, endX, endY, labelX, labelY, angle, index: i };
  });

  const polygonPoints = dataPoints
    .map((_, i) => {
      const p = getPoint(dataPoints[i].value, i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  // Generate segment path for hover highlight
  const getSegmentPath = (index: number) => {
    const startAngle = angleStep * index - Math.PI / 2 - angleStep / 2;
    const endAngle = startAngle + angleStep;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full mx-auto">
      {/* Marching ants pattern for hover */}
      <defs>
        <pattern id="marchingAnts" patternUnits="userSpaceOnUse" width="8" height="8">
          <path d="M0,4 L8,4" stroke="hsl(190 100% 50%)" strokeWidth="1" strokeDasharray="4,4">
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="0.5s" repeatCount="indefinite" />
          </path>
        </pattern>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(246 100% 68%)" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(190 100% 50%)" />
          <stop offset="100%" stopColor="hsl(155 100% 55%)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

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
      {axes.map(({ endX, endY, index }) => (
        <line
          key={index}
          x1={center}
          y1={center}
          x2={endX}
          y2={endY}
          stroke="currentColor"
          strokeWidth={hoveredIndex === index ? "1.5" : "0.5"}
          className={hoveredIndex === index ? "text-emblem-secondary" : "text-white/10"}
        />
      ))}

      {/* Hover segment highlight with marching ants */}
      {hoveredIndex !== null && (
        <path
          d={getSegmentPath(hoveredIndex)}
          fill="hsl(190 100% 50% / 0.1)"
          stroke="url(#marchingAnts)"
          strokeWidth="2"
          className="pointer-events-none"
        />
      )}

      {/* Animated data polygon */}
      <motion.polygon
        points={polygonPoints}
        fill="url(#radarGradient)"
        stroke="url(#radarStroke)"
        strokeWidth="2"
        initial={false}
        animate={{
          points: polygonPoints,
          filter: changedKeys.size > 0 ? "url(#glow)" : "none"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="opacity-80"
      />

      {/* Interactive hit areas for each segment */}
      {dataPoints.map((_, i) => (
        <path
          key={`hit-${i}`}
          d={getSegmentPath(i)}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}

      {/* Animated data points */}
      {dataPoints.map((point, i) => {
        const p = getPoint(point.value, i);
        const hasChanged = changedKeys.has(point.key);
        const isHovered = hoveredIndex === i;

        return (
          <motion.circle
            key={i}
            initial={false}
            animate={{
              cx: p.x,
              cy: p.y,
              r: isHovered ? 6 : hasChanged ? 5 : 4,
              filter: hasChanged ? "url(#glow)" : "none"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              isHovered ? "fill-emblem-accent" :
              point.type === 'sentience' ? "fill-emblem-primary" : "fill-emblem-secondary"
            )}
          />
        );
      })}

      {/* Labels with color coding */}
      {axes.map(({ point, labelX, labelY, angle, index }) => {
        const isTop = angle < -Math.PI / 4 && angle > -3 * Math.PI / 4;
        const isBottom = angle > Math.PI / 4 && angle < 3 * Math.PI / 4;
        const isRight = angle > -Math.PI / 4 && angle < Math.PI / 4;
        const isLeft = angle < -3 * Math.PI / 4 || angle > 3 * Math.PI / 4;
        const isHovered = hoveredIndex === index;
        const hasChanged = changedKeys.has(point.key);

        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (isRight) textAnchor = 'start';
        else if (isLeft) textAnchor = 'end';

        return (
          <text
            key={index}
            x={labelX}
            y={labelY}
            textAnchor={textAnchor}
            dominantBaseline={isTop ? 'auto' : isBottom ? 'hanging' : 'middle'}
            className={cn(
              "text-[9px] font-mono transition-all cursor-pointer",
              isHovered ? "font-bold" : "",
              hasChanged ? "animate-pulse" : "",
              point.type === 'sentience'
                ? (isHovered ? "fill-emblem-primary" : "fill-emblem-primary/70")
                : (isHovered ? "fill-emblem-secondary" : "fill-emblem-secondary/70")
            )}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {point.label}
          </text>
        );
      })}

      {/* Hover tooltip */}
      {hoveredIndex !== null && (
        <g className="pointer-events-none">
          <rect
            x={center - 35}
            y={center - 18}
            width="70"
            height="36"
            rx="6"
            className="fill-emblem-surface"
            stroke="hsl(190 100% 50% / 0.5)"
            strokeWidth="1"
          />
          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            className={cn(
              "text-[10px] font-bold",
              dataPoints[hoveredIndex].type === 'sentience' ? "fill-emblem-primary" : "fill-emblem-secondary"
            )}
          >
            {dataPoints[hoveredIndex].label}
          </text>
          <text
            x={center}
            y={center + 10}
            textAnchor="middle"
            className="fill-emblem-text text-[12px] font-mono font-bold"
          >
            {dataPoints[hoveredIndex].value}%
          </text>
        </g>
      )}
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
          <RadarChart
            values={stance.values}
            sentience={stance.sentience}
            changedKeys={new Set(valueChanges.map(c => c.key))}
          />
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
