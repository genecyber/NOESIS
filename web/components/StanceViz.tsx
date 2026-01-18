'use client';

import { useState, useEffect, useRef } from 'react';
import type { Stance } from '@/lib/types';
import styles from './StanceViz.module.css';

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
      <div className={styles.viz}>
        <div className={styles.loading}>Loading stance...</div>
      </div>
    );
  }

  const getChangeForKey = (key: string): ValueChange | undefined =>
    valueChanges.find(c => c.key === key);

  const isHighValue = (value: number) => value >= 80;
  const isLowValue = (value: number) => value <= 20;

  return (
    <div className={styles.viz}>
      <h3>Stance</h3>

      <div className={styles.section}>
        <div className={`${styles.field} ${frameShifted ? styles.frameShift : ''}`}>
          <span className={styles.label}>Frame</span>
          <span className={styles.value}>{stance.frame}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Self-Model</span>
          <span className={styles.value}>{stance.selfModel}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Objective</span>
          <span className={styles.value}>{stance.objective}</span>
        </div>
      </div>

      <h4>Values</h4>
      <div className={styles.values}>
        {Object.entries(stance.values).map(([key, value]) => {
          const change = getChangeForKey(key);
          const highPulse = isHighValue(value);
          const lowPulse = isLowValue(value);

          return (
            <div
              key={key}
              className={`${styles.valueRow} ${change ? styles.valueChanged : ''}`}
            >
              <span className={styles.valueName}>{key}</span>
              <div className={styles.valueBar}>
                <div
                  className={`${styles.valueFill} ${highPulse ? styles.highPulse : ''} ${lowPulse ? styles.lowPulse : ''}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className={styles.valueNum}>
                {value}%
                {change && (
                  <span className={`${styles.delta} ${change.delta > 0 ? styles.up : styles.down}`}>
                    {change.delta > 0 ? '+' : ''}{change.delta}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <h4>Sentience</h4>
      <div className={styles.sentience}>
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
              className={`${styles.valueRow} ${change ? styles.valueChanged : ''}`}
            >
              <span className={styles.valueName}>{label}</span>
              <div className={styles.valueBar}>
                <div
                  className={`${styles.valueFill} ${styles.purple} ${highPulse ? styles.highPulse : ''}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className={styles.valueNum}>
                {value}%
                {change && (
                  <span className={`${styles.delta} ${change.delta > 0 ? styles.up : styles.down}`}>
                    {change.delta > 0 ? '+' : ''}{change.delta}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {stance.sentience.emergentGoals.length > 0 && (
        <>
          <h4>Emergent Goals</h4>
          <ul className={styles.goals}>
            {stance.sentience.emergentGoals.map((goal, i) => (
              <li
                key={i}
                className={newGoals.has(goal) ? styles.newGoal : ''}
              >
                {goal}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.meta}>
        <span>v{stance.version}</span>
        <span>Drift: {stance.cumulativeDrift}</span>
      </div>
    </div>
  );
}
