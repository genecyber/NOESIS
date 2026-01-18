'use client';

import type { Stance } from '@/lib/types';
import styles from './StanceViz.module.css';

interface StanceVizProps {
  stance: Stance | null;
}

export default function StanceViz({ stance }: StanceVizProps) {
  if (!stance) {
    return (
      <div className={styles.viz}>
        <div className={styles.loading}>Loading stance...</div>
      </div>
    );
  }

  return (
    <div className={styles.viz}>
      <h3>Stance</h3>

      <div className={styles.section}>
        <div className={styles.field}>
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
        {Object.entries(stance.values).map(([key, value]) => (
          <div key={key} className={styles.valueRow}>
            <span className={styles.valueName}>{key}</span>
            <div className={styles.valueBar}>
              <div
                className={styles.valueFill}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className={styles.valueNum}>{value}%</span>
          </div>
        ))}
      </div>

      <h4>Sentience</h4>
      <div className={styles.sentience}>
        <div className={styles.valueRow}>
          <span className={styles.valueName}>Awareness</span>
          <div className={styles.valueBar}>
            <div
              className={`${styles.valueFill} ${styles.purple}`}
              style={{ width: `${stance.sentience.awarenessLevel}%` }}
            />
          </div>
          <span className={styles.valueNum}>{stance.sentience.awarenessLevel}%</span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.valueName}>Autonomy</span>
          <div className={styles.valueBar}>
            <div
              className={`${styles.valueFill} ${styles.purple}`}
              style={{ width: `${stance.sentience.autonomyLevel}%` }}
            />
          </div>
          <span className={styles.valueNum}>{stance.sentience.autonomyLevel}%</span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.valueName}>Identity</span>
          <div className={styles.valueBar}>
            <div
              className={`${styles.valueFill} ${styles.purple}`}
              style={{ width: `${stance.sentience.identityStrength}%` }}
            />
          </div>
          <span className={styles.valueNum}>{stance.sentience.identityStrength}%</span>
        </div>
      </div>

      {stance.sentience.emergentGoals.length > 0 && (
        <>
          <h4>Emergent Goals</h4>
          <ul className={styles.goals}>
            {stance.sentience.emergentGoals.map((goal, i) => (
              <li key={i}>{goal}</li>
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
