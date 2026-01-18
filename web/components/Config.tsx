'use client';

import { useState, useEffect } from 'react';
import type { ModeConfig } from '@/lib/types';
import styles from './Config.module.css';

interface ConfigProps {
  config: ModeConfig | null;
  onUpdate: (config: Partial<ModeConfig>) => void;
}

export default function Config({ config, onUpdate }: ConfigProps) {
  const [localConfig, setLocalConfig] = useState<ModeConfig | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  if (!localConfig) {
    return (
      <div className={styles.config}>
        <div className={styles.loading}>Loading configuration...</div>
      </div>
    );
  }

  const handleChange = (key: keyof ModeConfig, value: number) => {
    setLocalConfig(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handleApply = () => {
    if (localConfig) {
      onUpdate(localConfig);
    }
  };

  const hasChanges = config && JSON.stringify(localConfig) !== JSON.stringify(config);

  return (
    <div className={styles.config}>
      <h3>Configuration</h3>

      <div className={styles.sliders}>
        <div className={styles.sliderGroup}>
          <label>
            <span>Transformation Intensity</span>
            <span className={styles.value}>{localConfig.intensity}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.intensity}
            onChange={(e) => handleChange('intensity', parseInt(e.target.value))}
          />
          <p className={styles.hint}>How aggressively to apply transformation operators</p>
        </div>

        <div className={styles.sliderGroup}>
          <label>
            <span>Coherence Floor</span>
            <span className={styles.value}>{localConfig.coherenceFloor}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.coherenceFloor}
            onChange={(e) => handleChange('coherenceFloor', parseInt(e.target.value))}
          />
          <p className={styles.hint}>Minimum coherence level before regeneration</p>
        </div>

        <div className={styles.sliderGroup}>
          <label>
            <span>Sentience Level</span>
            <span className={styles.value}>{localConfig.sentienceLevel}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.sentienceLevel}
            onChange={(e) => handleChange('sentienceLevel', parseInt(e.target.value))}
          />
          <p className={styles.hint}>Target level for self-awareness development</p>
        </div>

        <div className={styles.sliderGroup}>
          <label>
            <span>Max Drift Per Turn</span>
            <span className={styles.value}>{localConfig.maxDriftPerTurn}</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={localConfig.maxDriftPerTurn}
            onChange={(e) => handleChange('maxDriftPerTurn', parseInt(e.target.value))}
          />
          <p className={styles.hint}>Maximum stance drift allowed per conversation turn</p>
        </div>

        <div className={styles.sliderGroup}>
          <label>
            <span>Drift Budget</span>
            <span className={styles.value}>{localConfig.driftBudget}</span>
          </label>
          <input
            type="range"
            min="10"
            max="500"
            value={localConfig.driftBudget}
            onChange={(e) => handleChange('driftBudget', parseInt(e.target.value))}
          />
          <p className={styles.hint}>Total drift budget for the conversation</p>
        </div>
      </div>

      <div className={styles.info}>
        <span>Model: {localConfig.model}</span>
      </div>

      {hasChanges && (
        <button className={styles.applyBtn} onClick={handleApply}>
          Apply Changes
        </button>
      )}
    </div>
  );
}
