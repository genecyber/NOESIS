'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Command,
  COMMANDS,
  COMMAND_CATEGORIES,
  getMatchingCommands,
  findCommand,
  getCommandsByCategory,
} from '@/lib/commands';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface CommandPaletteProps {
  input: string;
  visible: boolean;
  onSelect: (command: string) => void;
  onClose: () => void;
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}

export default function CommandPalette({
  input,
  visible,
  onSelect,
  onClose,
  selectedIndex,
  onIndexChange,
}: CommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Get matching commands based on input
  const getFilteredCommands = useCallback((): Command[] => {
    if (!input.startsWith('/')) return [];

    const query = input.slice(1).toLowerCase().split(' ')[0];

    if (!query) {
      // Show all commands grouped
      return COMMANDS;
    }

    return getMatchingCommands(query);
  }, [input]);

  const filteredCommands = getFilteredCommands();

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!visible || filteredCommands.length === 0) {
    return null;
  }

  // Group commands by category for display when showing all
  const showGrouped = input === '/' || input === '';
  const commandsByCategory = showGrouped ? getCommandsByCategory() : null;

  return (
    <div className="absolute bottom-full left-0 right-0 max-h-[400px] bg-emblem-surface border border-white/10 border-b-0 rounded-t-xl overflow-hidden flex flex-col z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="flex justify-between items-center px-4 py-2.5 bg-emblem-surface-2 border-b border-white/10">
        <span className="font-semibold text-emblem-secondary text-[13px] uppercase tracking-wider">
          Commands
        </span>
        <span className="text-[11px] text-emblem-muted">
          <kbd className="bg-emblem-surface px-1.5 py-0.5 rounded mx-0.5">Tab</kbd> to select,{' '}
          <kbd className="bg-emblem-surface px-1.5 py-0.5 rounded mx-0.5">Esc</kbd> to close
        </span>
      </div>

      <div className="overflow-y-auto p-2 max-h-[350px] scrollbar-styled" ref={listRef}>
        {showGrouped && commandsByCategory ? (
          // Grouped view
          Object.entries(commandsByCategory).map(([category, commands]) => {
            if (commands.length === 0) return null;
            const categoryInfo = COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES];

            return (
              <div key={category} className="mb-2">
                <div
                  className="text-[11px] font-semibold text-emblem-muted uppercase tracking-wider px-3 py-2 pb-1.5 border-l-[3px] mb-1"
                  style={{ borderLeftColor: categoryInfo.color }}
                >
                  {categoryInfo.label}
                </div>
                {commands.map((cmd) => {
                  const globalIndex = COMMANDS.indexOf(cmd);
                  return (
                    <CommandItem
                      key={cmd.name}
                      command={cmd}
                      isSelected={globalIndex === selectedIndex}
                      onClick={() => onSelect(`/${cmd.name} `)}
                      onMouseEnter={() => onIndexChange(globalIndex)}
                    />
                  );
                })}
              </div>
            );
          })
        ) : (
          // Filtered view
          filteredCommands.map((cmd, i) => (
            <CommandItem
              key={cmd.name}
              command={cmd}
              isSelected={i === selectedIndex}
              onClick={() => onSelect(`/${cmd.name} `)}
              onMouseEnter={() => onIndexChange(i)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItem({ command, isSelected, onClick, onMouseEnter }: CommandItemProps) {
  const categoryInfo = COMMAND_CATEGORIES[command.category];

  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-lg cursor-pointer transition-colors relative',
        'hover:bg-emblem-surface-2',
        isSelected && 'bg-emblem-surface-2 outline outline-1 outline-white/10'
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="font-mono text-sm text-emblem-text mb-1">
        <span className="text-emblem-secondary font-bold">/</span>
        {command.name}
        {command.aliases.length > 0 && (
          <span className="text-[11px] text-emblem-muted ml-2">
            ({command.aliases.map(a => `/${a}`).join(', ')})
          </span>
        )}
      </div>
      <div className="text-xs text-emblem-muted mb-1">{command.description}</div>
      {command.args && command.args.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
          {command.args.map(arg => (
            <span
              key={arg.name}
              className="text-[11px] font-mono text-emblem-warning bg-emblem-warning/15 px-1.5 py-0.5 rounded"
            >
              {arg.required ? `<${arg.name}>` : `[${arg.name}]`}
            </span>
          ))}
        </div>
      )}
      {command.subcommands && command.subcommands.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
          {command.subcommands.map(sub => (
            <span
              key={sub.name}
              className="text-[10px] font-mono text-emblem-primary bg-emblem-primary/15 px-1.5 py-0.5 rounded"
            >
              {sub.name}
            </span>
          ))}
        </div>
      )}
      <span
        className="absolute top-2.5 right-3 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white opacity-80"
        style={{ backgroundColor: categoryInfo.color }}
      >
        {categoryInfo.label}
      </span>
    </div>
  );
}

/**
 * Help panel showing all commands
 */
export function CommandHelp({ onClose }: { onClose: () => void }) {
  const commandsByCategory = getCommandsByCategory();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[800px] max-h-[80vh] bg-emblem-surface border border-white/10 rounded-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-4 bg-emblem-surface-2 border-b border-white/10">
          <h2 className="m-0 text-lg text-emblem-secondary font-display font-bold">METAMORPH Commands</h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-emblem-muted text-2xl cursor-pointer p-0 leading-none hover:text-emblem-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto scrollbar-styled">
          {Object.entries(commandsByCategory).map(([category, commands]) => {
            if (commands.length === 0) return null;
            const categoryInfo = COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES];

            return (
              <div key={category} className="mb-6">
                <h3
                  className="m-0 mb-3 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: categoryInfo.color }}
                >
                  {categoryInfo.label}
                </h3>
                <div className="flex flex-col gap-2">
                  {commands.map(cmd => (
                    <div
                      key={cmd.name}
                      className="grid grid-cols-[180px_1fr] gap-3 px-3 py-2 bg-emblem-surface-2 rounded-lg items-center"
                    >
                      <code className="font-mono text-[13px] text-emblem-secondary">/{cmd.name}</code>
                      <span className="text-[13px] text-emblem-muted">{cmd.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-emblem-surface-2 border-t border-white/10 text-center">
          <p className="m-0 text-xs text-emblem-muted">
            Type <code className="bg-emblem-surface px-1.5 py-0.5 rounded text-emblem-secondary">/</code> in the chat input to see command autocomplete
          </p>
        </div>
      </div>
    </div>
  );
}
