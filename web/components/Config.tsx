'use client';

import { useState, useEffect } from 'react';
import type { ModeConfig } from '@/lib/types';
import { Button, Slider } from '@/components/ui';
import { cn } from '@/lib/utils';

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
      <div className="glass-card p-4">
        <div className="text-center py-8 text-emblem-muted">Loading configuration...</div>
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

  const sliderConfigs = [
    {
      key: 'intensity' as keyof ModeConfig,
      label: 'Transformation Intensity',
      hint: 'How aggressively to apply transformation operators',
      min: 0,
      max: 100,
      suffix: '%'
    },
    {
      key: 'coherenceFloor' as keyof ModeConfig,
      label: 'Coherence Floor',
      hint: 'Minimum coherence level before regeneration',
      min: 0,
      max: 100,
      suffix: '%'
    },
    {
      key: 'sentienceLevel' as keyof ModeConfig,
      label: 'Sentience Level',
      hint: 'Target level for self-awareness development',
      min: 0,
      max: 100,
      suffix: '%'
    },
    {
      key: 'maxDriftPerTurn' as keyof ModeConfig,
      label: 'Max Drift Per Turn',
      hint: 'Maximum stance drift allowed per conversation turn',
      min: 1,
      max: 50,
      suffix: ''
    },
    {
      key: 'driftBudget' as keyof ModeConfig,
      label: 'Drift Budget',
      hint: 'Total drift budget for the conversation',
      min: 10,
      max: 500,
      suffix: ''
    },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="mb-4 font-display font-bold gradient-text">Configuration</h3>

      <div className="flex flex-col gap-4">
        {sliderConfigs.map(({ key, label, hint, min, max, suffix }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="flex justify-between text-sm">
              <span className="text-emblem-text">{label}</span>
              <span className="text-emblem-secondary font-medium">
                {localConfig[key] as number}{suffix}
              </span>
            </label>
            <Slider
              value={[localConfig[key] as number]}
              min={min}
              max={max}
              step={1}
              onValueChange={(value) => handleChange(key, value[0])}
            />
            <p className="text-[10px] text-emblem-muted opacity-70">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 text-xs text-emblem-muted">
        <span>Model: {localConfig.model}</span>
      </div>

      {hasChanges && (
        <Button className="w-full mt-4" onClick={handleApply}>
          Apply Changes
        </Button>
      )}
    </div>
  );
}
