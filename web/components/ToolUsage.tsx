'use client';

import type { ToolUseEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Zap, Loader2, Check, X } from 'lucide-react';

interface ToolUsageProps {
  tools: ToolUseEvent[];
}

export default function ToolUsage({ tools }: ToolUsageProps) {
  if (tools.length === 0) return null;

  return (
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

  const statusConfig = {
    started: {
      bg: 'bg-emblem-warning/15',
      border: 'border-emblem-warning/40',
      text: 'text-emblem-warning',
      showSpinner: true,
    },
    completed: {
      bg: 'bg-emblem-accent/10',
      border: 'border-emblem-accent/30',
      text: 'text-emblem-accent',
      showSpinner: false,
    },
    error: {
      bg: 'bg-emblem-danger/10',
      border: 'border-emblem-danger/30',
      text: 'text-emblem-danger',
      showSpinner: false,
    },
  };

  const config = statusConfig[tool.status];
  const params = formatParams(tool.input);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]',
        config.bg,
        config.border
      )}
    >
      {/* Status indicator */}
      {config.showSpinner ? (
        <Loader2 className={cn('w-3 h-3 animate-spin', config.text)} />
      ) : tool.status === 'completed' ? (
        <Check className={cn('w-3 h-3', config.text)} />
      ) : (
        <X className={cn('w-3 h-3', config.text)} />
      )}

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
}

/**
 * Inline tool indicator for showing during streaming
 */
export function ToolIndicator({ tool }: { tool: ToolUseEvent }) {
  const statusConfig = {
    started: { color: 'bg-emblem-warning/20 text-emblem-warning', icon: '⏳' },
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
 * Active tools bar - shows tools currently in progress
 */
export function ActiveToolsBar({ tools }: { tools: ToolUseEvent[] }) {
  const activeTools = tools.filter(t => t.status === 'started');

  if (activeTools.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-emblem-warning/10 border border-emblem-warning/30 rounded-lg mb-2 flex-wrap">
      <span className="text-[11px] text-emblem-warning font-medium">Working with:</span>
      {activeTools.map(tool => (
        <span key={tool.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emblem-warning/20 rounded-xl font-mono text-[11px] text-emblem-warning">
          <span className="w-2 h-2 border-[1.5px] border-emblem-warning/30 border-t-emblem-warning rounded-full animate-spin" />
          {tool.name}
        </span>
      ))}
    </div>
  );
}
