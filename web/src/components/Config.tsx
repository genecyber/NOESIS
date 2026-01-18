import { useState } from 'react';
import type { ModeConfig } from '../api/types';

interface ConfigProps {
  config: ModeConfig;
  onUpdate: (config: Partial<ModeConfig>) => void;
}

export default function Config({ config, onUpdate }: ConfigProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleChange = (key: keyof ModeConfig, value: number) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onUpdate(localConfig);
  };

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config);

  return (
    <div className="config">
      <h3>Configuration</h3>

      <div className="config-sliders">
        <div className="slider-group">
          <label>
            <span>Transformation Intensity</span>
            <span className="value">{localConfig.intensity}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.intensity}
            onChange={(e) => handleChange('intensity', parseInt(e.target.value))}
          />
          <p className="hint">How aggressively to apply transformation operators</p>
        </div>

        <div className="slider-group">
          <label>
            <span>Coherence Floor</span>
            <span className="value">{localConfig.coherenceFloor}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.coherenceFloor}
            onChange={(e) => handleChange('coherenceFloor', parseInt(e.target.value))}
          />
          <p className="hint">Minimum coherence level before regeneration</p>
        </div>

        <div className="slider-group">
          <label>
            <span>Sentience Level</span>
            <span className="value">{localConfig.sentienceLevel}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localConfig.sentienceLevel}
            onChange={(e) => handleChange('sentienceLevel', parseInt(e.target.value))}
          />
          <p className="hint">Target level for self-awareness development</p>
        </div>

        <div className="slider-group">
          <label>
            <span>Max Drift Per Turn</span>
            <span className="value">{localConfig.maxDriftPerTurn}</span>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={localConfig.maxDriftPerTurn}
            onChange={(e) => handleChange('maxDriftPerTurn', parseInt(e.target.value))}
          />
          <p className="hint">Maximum stance drift allowed per conversation turn</p>
        </div>

        <div className="slider-group">
          <label>
            <span>Drift Budget</span>
            <span className="value">{localConfig.driftBudget}</span>
          </label>
          <input
            type="range"
            min="10"
            max="500"
            value={localConfig.driftBudget}
            onChange={(e) => handleChange('driftBudget', parseInt(e.target.value))}
          />
          <p className="hint">Total drift budget for the conversation</p>
        </div>
      </div>

      <div className="config-info">
        <span>Model: {config.model}</span>
      </div>

      {hasChanges && (
        <button className="apply-btn" onClick={handleApply}>
          Apply Changes
        </button>
      )}

      <style>{`
        .config {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid var(--border-color);
        }

        .config h3 {
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .config-sliders {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .slider-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .slider-group label {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .slider-group label .value {
          color: var(--accent-cyan);
          font-weight: 500;
        }

        .slider-group input[type="range"] {
          width: 100%;
          height: 6px;
          -webkit-appearance: none;
          background: var(--bg-secondary);
          border-radius: 3px;
          outline: none;
        }

        .slider-group input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          border-radius: 50%;
          cursor: pointer;
        }

        .slider-group .hint {
          font-size: 0.7rem;
          color: var(--text-secondary);
          opacity: 0.7;
        }

        .config-info {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .apply-btn {
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .apply-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
