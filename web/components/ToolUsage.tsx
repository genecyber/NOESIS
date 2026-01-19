'use client';

import { useState } from 'react';
import type { ToolUseEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Zap, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface ToolUsageProps {
  tools: ToolUseEvent[];
}

export default function ToolUsage({ tools }: ToolUsageProps) {
  if (tools.length === 0) return null;

  return (
    <div className="bg-emblem-primary/10 border border-emblem-primary/30 rounded-lg p-2.5 mb-2">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-wide">
        <Zap className="w-3 h-3" />
        <span className="text-emblem-primary font-semibold">Tools Used</span>
        <span className="bg-emblem-primary/30 text-emblem-primary/90 px-1.5 py-0.5 rounded-full text-[10px]">
          {tools.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tools.map((tool) => (
          <ToolItem key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}

interface ToolItemProps {
  tool: ToolUseEvent;
}

function ToolItem({ tool }: ToolItemProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Format input params for display
  const formatInput = (input: Record<string, unknown>): string => {
    const entries = Object.entries(input);
    if (entries.length === 0) return '';

    // Show first 2 params inline
    const preview = entries.slice(0, 2).map(([key, value]) => {
      const strValue = typeof value === 'string'
        ? value.slice(0, 50) + (value.length > 50 ? '...' : '')
        : JSON.stringify(value).slice(0, 50);
      return `${key}: ${strValue}`;
    });

    if (entries.length > 2) {
      preview.push(`+${entries.length - 2} more`);
    }

    return preview.join(', ');
  };

  // Truncate result for display
  const truncateResult = (result: string, maxLen = 500): string => {
    if (result.length <= maxLen) return result;
    return result.slice(0, maxLen) + '...';
  };

  const statusConfig = {
    started: {
      icon: Loader2,
      color: 'text-emblem-warning',
      borderColor: 'border-l-emblem-warning',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-emblem-accent',
      borderColor: 'border-l-emblem-accent',
    },
    error: {
      icon: XCircle,
      color: 'text-emblem-danger',
      borderColor: 'border-l-emblem-danger',
    },
  };

  const config = statusConfig[tool.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        'relative bg-emblem-surface border border-emblem-surface-2 rounded-md p-2 cursor-pointer transition-all',
        'hover:border-emblem-primary hover:bg-emblem-surface-2',
        'border-l-[3px]',
        config.borderColor
      )}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className="flex items-center gap-1.5">
        <StatusIcon
          className={cn(
            'w-3 h-3',
            config.color,
            tool.status === 'started' && 'animate-spin'
          )}
        />
        <span className="font-mono text-xs font-semibold text-emblem-text">
          {tool.name}
        </span>
        {tool.status === 'started' && (
          <div className="ml-auto w-2.5 h-2.5 border-2 border-emblem-surface-2 border-t-emblem-warning rounded-full animate-spin" />
        )}
      </div>

      <div className="font-mono text-[11px] text-emblem-muted mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
        {formatInput(tool.input)}
      </div>

      {/* Hover tooltip with full details */}
      {showDetails && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-emblem-surface border border-emblem-surface-2 rounded-lg p-3 z-[100] shadow-2xl max-h-[300px] overflow-y-auto">
          <div className="mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-primary mb-1">
              Input
            </div>
            <pre className="bg-emblem-bg border border-emblem-surface-2 rounded p-2 text-[10px] font-mono text-emblem-muted overflow-x-auto whitespace-pre-wrap break-words max-h-[150px] overflow-y-auto m-0">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>

          {tool.result && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-primary mb-1">
                Result
              </div>
              <pre className="bg-emblem-bg border border-emblem-surface-2 rounded p-2 text-[10px] font-mono text-emblem-muted overflow-x-auto whitespace-pre-wrap break-words max-h-[150px] overflow-y-auto m-0">
                {truncateResult(tool.result)}
              </pre>
            </div>
          )}

          {tool.error && (
            <div className="mb-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emblem-danger mb-1">
                Error
              </div>
              <div className="bg-emblem-danger/10 border border-emblem-danger/30 rounded p-2 text-[11px] text-emblem-danger">
                {tool.error}
              </div>
            </div>
          )}
        </div>
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
