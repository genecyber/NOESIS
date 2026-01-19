'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Stance } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StanceVizProps {
  stance: Stance | null;
}

interface ValueChange {
  key: string;
  delta: number;
  timestamp: number;
}

export default function StanceViz({ stance }: StanceVizProps) {
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
      <h3 className="mb-4 font-display font-bold gradient-text">Stance</h3>

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

      <div className="flex justify-between mt-4 pt-2 border-t border-white/5 text-xs text-emblem-muted">
        <span>v{stance.version}</span>
        <span>Drift: {stance.cumulativeDrift}</span>
      </div>
    </div>
  );
}
