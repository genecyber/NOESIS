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

  const handleBooleanChange = (key: keyof ModeConfig, value: boolean) => {
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

      {/* Empathy Mode Section */}
      <div className={styles.sectionDivider}>
        <h4 className={styles.sectionHeader}>Empathy Mode</h4>

        <div className={styles.toggleGroup}>
          <label htmlFor="enableEmpathyMode">Enable Empathy Mode</label>
          <div className={styles.toggleSwitch}>
            <input
              type="checkbox"
              id="enableEmpathyMode"
              checked={localConfig.enableEmpathyMode ?? false}
              onChange={(e) => handleBooleanChange('enableEmpathyMode', e.target.checked)}
            />
            <span className={styles.toggleSlider}></span>
          </div>
        </div>

        {localConfig.enableEmpathyMode && (
          <div className={styles.conditionalSection}>
            <div className={styles.sliderGroup}>
              <label>
                <span>Camera Interval</span>
                <span className={styles.value}>{localConfig.empathyCameraInterval ?? 1000}ms</span>
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={localConfig.empathyCameraInterval ?? 1000}
                onChange={(e) => handleChange('empathyCameraInterval', parseInt(e.target.value))}
              />
              <p className={styles.hint}>How often to capture webcam frames for emotion detection</p>
            </div>

            <div className={styles.sliderGroup}>
              <label>
                <span>Min Confidence</span>
                <span className={styles.value}>{Math.round((localConfig.empathyMinConfidence ?? 0.5) * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((localConfig.empathyMinConfidence ?? 0.5) * 100)}
                onChange={(e) => handleChange('empathyMinConfidence', parseInt(e.target.value) / 100)}
              />
              <p className={styles.hint}>Minimum confidence threshold for emotion detection</p>
            </div>

            <div className={styles.toggleGroup}>
              <label htmlFor="empathyAutoAdjust">Auto-Adjust Response</label>
              <div className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  id="empathyAutoAdjust"
                  checked={localConfig.empathyAutoAdjust ?? false}
                  onChange={(e) => handleBooleanChange('empathyAutoAdjust', e.target.checked)}
                />
                <span className={styles.toggleSlider}></span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <label>
                <span>Max Boost</span>
                <span className={styles.value}>{localConfig.empathyBoostMax ?? 10}</span>
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={localConfig.empathyBoostMax ?? 10}
                onChange={(e) => handleChange('empathyBoostMax', parseInt(e.target.value))}
              />
              <p className={styles.hint}>Maximum empathy boost value applied to responses</p>
            </div>
          </div>
        )}
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
