'use client';

import type { ChatResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface InjectedMemoriesProps {
  injectedMemories: NonNullable<ChatResponse['injectedMemories']>;
}

export default function InjectedMemories({ injectedMemories }: InjectedMemoriesProps) {
  if (injectedMemories.count === 0) return null;

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wide text-emblem-muted">
          <BookOpen className="w-3 h-3 text-purple-400" />
          <span>Injected Memories</span>
          <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full text-[9px] font-medium">
            {injectedMemories.count}
          </span>
          <span className="text-[9px] text-emblem-muted/60 ml-1">
            ({injectedMemories.tokensUsed} tokens)
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {injectedMemories.memories.map((memory, idx) => (
            <MemoryChip key={idx} memory={memory} />
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

interface MemoryChipProps {
  memory: {
    type: string;
    content: string;
    relevanceScore: number;
    reason: string;
  };
}

function MemoryChip({ memory }: MemoryChipProps) {
  // Type-based styling
  const typeConfig = {
    episodic: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: 'history',
    },
    semantic: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: 'book',
    },
    identity: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      icon: 'user',
    },
  };

  const config = typeConfig[memory.type as keyof typeof typeConfig] || {
    bg: 'bg-emblem-primary/10',
    border: 'border-emblem-primary/30',
    text: 'text-emblem-primary',
    icon: 'memory',
  };

  // Truncate content for display
  const truncatedContent = memory.content.length > 50
    ? memory.content.slice(0, 50) + '...'
    : memory.content;

  const chipContent = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] cursor-default',
        config.bg,
        config.border
      )}
    >
      {/* Type badge */}
      <span className={cn('text-[9px] uppercase font-semibold', config.text)}>
        {memory.type}
      </span>

      {/* Relevance score */}
      <span className="text-emblem-muted/70">
        {Math.round(memory.relevanceScore * 100)}%
      </span>

      {/* Content preview */}
      <span className="text-emblem-muted/50">-</span>
      <span className="text-emblem-muted font-mono truncate max-w-[200px]">
        {truncatedContent}
      </span>
    </div>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {chipContent}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-emblem-surface border border-purple-500/50 rounded-lg p-3 shadow-xl z-[9999] max-w-[400px]"
          sideOffset={5}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1.5">
            {memory.type} Memory
          </div>
          <div className="text-[11px] text-emblem-text mb-2">
            {memory.content}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-emblem-muted">
            <span>
              <span className="font-semibold text-emblem-text">Relevance:</span>{' '}
              {Math.round(memory.relevanceScore * 100)}%
            </span>
            <span>
              <span className="font-semibold text-emblem-text">Reason:</span>{' '}
              {memory.reason}
            </span>
          </div>
          <Tooltip.Arrow className="fill-emblem-surface" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Compact inline indicator for showing in message headers
 */
export function InjectedMemoriesIndicator({ count, tokensUsed }: { count: number; tokensUsed: number }) {
  if (count === 0) return null;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 cursor-default">
            <BookOpen className="w-3 h-3" />
            <span>{count} {count === 1 ? 'memory' : 'memories'}</span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-emblem-surface border border-purple-500/50 rounded-lg p-2 shadow-xl z-[9999]"
            sideOffset={5}
          >
            <div className="text-[10px] text-emblem-muted">
              {count} {count === 1 ? 'memory' : 'memories'} injected ({tokensUsed} tokens)
            </div>
            <Tooltip.Arrow className="fill-emblem-surface" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
