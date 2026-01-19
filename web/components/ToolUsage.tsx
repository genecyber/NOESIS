'use client';

import type { ToolUseEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface ToolUsageProps {
  tools: ToolUseEvent[];
}

export default function ToolUsage({ tools }: ToolUsageProps) {
  if (tools.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wide text-emblem-muted">
          <Zap className="w-3 h-3 text-emblem-primary" />
          <span>Tools</span>
          <span className="bg-emblem-primary/20 text-emblem-primary px-1.5 py-0.5 rounded-full text-[9px] font-medium">
            {tools.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <ToolChip key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

interface ToolChipProps {
  tool: ToolUseEvent;
}

function ToolChip({ tool }: ToolChipProps) {
  // Format input params as comma-separated values (just values, not keys)
  const formatParams = (input: Record<string, unknown>): string => {
    const values = Object.values(input);
    if (values.length === 0) return '';

    return values.map(value => {
      if (typeof value === 'string') {
        // Truncate long strings and show just the value
        return value.length > 40 ? value.slice(0, 40) + '…' : value;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      // For objects/arrays, show a brief representation
      return JSON.stringify(value).slice(0, 30);
    }).join(', ');
  };

  // Format full input for tooltip
  const formatFullInput = (input: Record<string, unknown>): string => {
    return Object.entries(input)
      .map(([key, value]) => {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        return `${key}: ${strValue}`;
      })
      .join('\n');
  };

  const statusConfig = {
    started: {
      bg: 'bg-emblem-warning/15',
      border: 'border-emblem-warning/40',
      text: 'text-emblem-warning',
      icon: '🔧',
    },
    completed: {
      bg: 'bg-emblem-accent/10',
      border: 'border-emblem-accent/30',
      text: 'text-emblem-accent',
      icon: '✓',
    },
    error: {
      bg: 'bg-emblem-danger/10',
      border: 'border-emblem-danger/30',
      text: 'text-emblem-danger',
      icon: '✗',
    },
  };

  const config = statusConfig[tool.status];
  const params = formatParams(tool.input);
  const fullInput = formatFullInput(tool.input);

  const chipContent = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] cursor-default',
        config.bg,
        config.border
      )}
    >
      {/* Status indicator - emoji icons only, NO SVG spinner */}
      <span className={cn('text-xs leading-none', config.text)}>
        {config.icon}
      </span>

      {/* Tool name */}
      <span className="font-mono font-semibold text-emblem-text">{tool.name}</span>

      {/* Params as comma-separated values */}
      {params && (
        <>
          <span className="text-emblem-muted/50">—</span>
          <span className="text-emblem-muted font-mono truncate max-w-[300px]">{params}</span>
        </>
      )}
    </div>
  );

  // Only show tooltip if there are input params
  if (Object.keys(tool.input).length === 0) {
    return chipContent;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {chipContent}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-emblem-surface border-2 border-emblem-primary rounded-lg p-3 shadow-xl z-[9999] max-w-[400px]"
          sideOffset={5}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-primary mb-1.5">
            Input
          </div>
          <pre className="text-[11px] font-mono text-emblem-muted whitespace-pre-wrap break-all m-0">
            {fullInput}
          </pre>
          {tool.result && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-accent mt-3 mb-1.5">
                Result
              </div>
              <pre className="text-[11px] font-mono text-emblem-muted whitespace-pre-wrap break-all m-0 max-h-[150px] overflow-y-auto">
                {tool.result.slice(0, 500)}{tool.result.length > 500 ? '…' : ''}
              </pre>
            </>
          )}
          {tool.error && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-danger mt-3 mb-1.5">
                Error
              </div>
              <div className="text-[11px] text-emblem-danger">
                {tool.error}
              </div>
            </>
          )}
          <Tooltip.Arrow className="fill-emblem-primary" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Inline tool indicator for showing during streaming
 */
export function ToolIndicator({ tool }: { tool: ToolUseEvent }) {
  const statusConfig = {
    started: { color: 'bg-emblem-warning/20 text-emblem-warning', icon: '🔧' },
    completed: { color: 'bg-emblem-accent/20 text-emblem-accent', icon: '✓' },
    error: { color: 'bg-emblem-danger/20 text-emblem-danger', icon: '✗' },
  };

  const config = statusConfig[tool.status];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] m-0.5', config.color)}>
      <span className="text-[10px]">{config.icon}</span>
      <span className="font-mono text-[10px]">{tool.name}</span>
    </span>
  );
}

/**
 * Active tools bar - shows tools currently in progress (NO SVG SPINNERS)
 */
export function ActiveToolsBar({ tools }: { tools: ToolUseEvent[] }) {
  const activeTools = tools.filter(t => t.status === 'started');

  if (activeTools.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-emblem-warning/10 border border-emblem-warning/30 rounded-lg mb-2 flex-wrap">
      <span className="text-[11px] text-emblem-warning font-medium">Working with:</span>
      {activeTools.map(tool => (
        <span key={tool.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emblem-warning/20 rounded-xl font-mono text-[11px] text-emblem-warning">
          <span>🔧</span>
          {tool.name}
        </span>
      ))}
    </div>
  );
}
