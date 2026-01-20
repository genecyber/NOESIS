/**
 * Subagents Panel
 *
 * Shows available specialized subagents (explorer, verifier, reflector, dialectic)
 * with their status, invocation history, and manual invoke buttons.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  CheckCircle2,
  Brain,
  Scale,
  Play,
  Loader2,
  Sparkles,
  Clock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { PanelProps } from '@/lib/plugins/types';
import { cn } from '@/lib/utils';
import { Button, Switch, Slider } from '@/components/ui';

// Subagent definitions
const SUBAGENTS = [
  {
    id: 'explorer',
    name: 'Explorer',
    icon: Compass,
    description: 'Deep topic investigation and research',
    color: 'text-emblem-secondary',
    bgColor: 'bg-emblem-secondary/10',
    intents: ['investigate', 'research', 'explore', 'analyze deeply'],
  },
  {
    id: 'verifier',
    name: 'Verifier',
    icon: CheckCircle2,
    description: 'Output validation and quality assurance',
    color: 'text-emblem-accent',
    bgColor: 'bg-emblem-accent/10',
    intents: ['check', 'verify', 'validate', 'is this correct'],
  },
  {
    id: 'reflector',
    name: 'Reflector',
    icon: Brain,
    description: 'Self-reflection on behavior and patterns',
    color: 'text-emblem-primary',
    bgColor: 'bg-emblem-primary/10',
    intents: ['reflect', 'analyze patterns', 'self-examine'],
  },
  {
    id: 'dialectic',
    name: 'Dialectic',
    icon: Scale,
    description: 'Thesis/antithesis/synthesis reasoning',
    color: 'text-emblem-warning',
    bgColor: 'bg-emblem-warning/10',
    intents: ['debate', 'both sides', 'opposing view', 'synthesis'],
  },
];

interface SubagentInvocation {
  subagent: string;
  timestamp: Date;
  task?: string;
}

/**
 * Subagents Panel Component
 */
export default function SubagentsPanel({
  sessionId,
  config,
  onConfigUpdate,
}: PanelProps) {
  const [invocations, setInvocations] = useState<SubagentInvocation[]>([]);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Get config values with defaults
  const autoSubagentsEnabled = config?.enableAutoSubagents ?? true;
  const threshold = config?.autoSubagentThreshold ?? 0.6;

  // Handle manual subagent invocation
  const handleInvoke = async (subagentId: string) => {
    if (!sessionId || invoking) return;

    setInvoking(subagentId);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: `[SUBAGENT:${subagentId}] Perform your specialized analysis on the current conversation context.`,
        }),
      });

      if (response.ok) {
        setInvocations(prev => [
          { subagent: subagentId, timestamp: new Date() },
          ...prev,
        ]);
      }
    } catch (error) {
      console.error(`[SubagentsPanel] Failed to invoke ${subagentId}:`, error);
    } finally {
      setInvoking(null);
    }
  };

  // Toggle auto-subagents
  const handleToggleAuto = (enabled: boolean) => {
    onConfigUpdate?.({ enableAutoSubagents: enabled });
  };

  // Update threshold
  const handleThresholdChange = (value: number[]) => {
    onConfigUpdate?.({ autoSubagentThreshold: value[0] });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with auto-routing toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emblem-primary" />
          <span className="text-sm font-medium text-emblem-text">Auto-Routing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs",
            autoSubagentsEnabled ? "text-emblem-accent" : "text-emblem-muted"
          )}>
            {autoSubagentsEnabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            checked={autoSubagentsEnabled}
            onCheckedChange={handleToggleAuto}
          />
        </div>
      </div>

      {/* Threshold slider when auto-routing is enabled */}
      <AnimatePresence>
        {autoSubagentsEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emblem-muted">Detection Threshold</span>
              <span className="text-xs font-mono text-emblem-text">{(threshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={handleThresholdChange}
              min={0.3}
              max={0.9}
              step={0.05}
              className="w-full"
            />
            <p className="text-[10px] text-emblem-muted mt-1">
              Higher = more precise matching, Lower = more triggers
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subagent cards */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {SUBAGENTS.map((subagent) => {
          const Icon = subagent.icon;
          const recentInvocation = invocations.find(i => i.subagent === subagent.id);
          const isInvoking = invoking === subagent.id;

          return (
            <motion.div
              key={subagent.id}
              className={cn(
                "p-3 rounded-lg border border-white/5 transition-all",
                "hover:border-white/10",
                subagent.bgColor
              )}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    "bg-emblem-surface border border-white/10"
                  )}>
                    <Icon className={cn("w-4 h-4", subagent.color)} />
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-medium", subagent.color)}>
                      {subagent.name}
                    </h3>
                    <p className="text-xs text-emblem-muted mt-0.5">
                      {subagent.description}
                    </p>
                    {/* Intent keywords */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {subagent.intents.slice(0, 3).map(intent => (
                        <span
                          key={intent}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-emblem-muted"
                        >
                          {intent}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Invoke button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-7 w-7 p-0",
                    "hover:bg-white/10"
                  )}
                  onClick={() => handleInvoke(subagent.id)}
                  disabled={!sessionId || isInvoking}
                >
                  {isInvoking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>

              {/* Recent invocation indicator */}
              {recentInvocation && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                  <Clock className="w-3 h-3 text-emblem-muted" />
                  <span className="text-[10px] text-emblem-muted">
                    Last invoked {formatTimeAgo(recentInvocation.timestamp)}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Invocation history */}
      {invocations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emblem-muted">Session Activity</span>
            <span className="text-xs font-mono text-emblem-text">
              {invocations.length} invocation{invocations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {invocations.slice(0, 10).map((inv, i) => {
              const subagent = SUBAGENTS.find(s => s.id === inv.subagent);
              return (
                <span
                  key={i}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded",
                    subagent?.bgColor || 'bg-white/5',
                    subagent?.color || 'text-emblem-muted'
                  )}
                >
                  {subagent?.name || inv.subagent}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
