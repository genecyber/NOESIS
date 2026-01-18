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
import styles from './CommandPalette.module.css';

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
    <div className={styles.palette}>
      <div className={styles.header}>
        <span className={styles.title}>Commands</span>
        <span className={styles.hint}>
          <kbd>Tab</kbd> to select, <kbd>Esc</kbd> to close
        </span>
      </div>

      <div className={styles.list} ref={listRef}>
        {showGrouped && commandsByCategory ? (
          // Grouped view
          Object.entries(commandsByCategory).map(([category, commands]) => {
            if (commands.length === 0) return null;
            const categoryInfo = COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES];

            return (
              <div key={category} className={styles.group}>
                <div
                  className={styles.categoryHeader}
                  style={{ borderLeftColor: categoryInfo.color }}
                >
                  {categoryInfo.label}
                </div>
                {commands.map((cmd, i) => {
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
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className={styles.commandName}>
        <span className={styles.slash}>/</span>
        {command.name}
        {command.aliases.length > 0 && (
          <span className={styles.aliases}>
            ({command.aliases.map(a => `/${a}`).join(', ')})
          </span>
        )}
      </div>
      <div className={styles.description}>{command.description}</div>
      {command.args && command.args.length > 0 && (
        <div className={styles.args}>
          {command.args.map(arg => (
            <span key={arg.name} className={styles.arg}>
              {arg.required ? `<${arg.name}>` : `[${arg.name}]`}
            </span>
          ))}
        </div>
      )}
      {command.subcommands && command.subcommands.length > 0 && (
        <div className={styles.subcommands}>
          {command.subcommands.map(sub => (
            <span key={sub.name} className={styles.subcommand}>
              {sub.name}
            </span>
          ))}
        </div>
      )}
      <span
        className={styles.categoryBadge}
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
    <div className={styles.helpOverlay} onClick={onClose}>
      <div className={styles.helpPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.helpHeader}>
          <h2>METAMORPH Commands</h2>
          <button onClick={onClose} className={styles.closeButton}>
            &times;
          </button>
        </div>

        <div className={styles.helpContent}>
          {Object.entries(commandsByCategory).map(([category, commands]) => {
            if (commands.length === 0) return null;
            const categoryInfo = COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES];

            return (
              <div key={category} className={styles.helpCategory}>
                <h3 style={{ color: categoryInfo.color }}>{categoryInfo.label}</h3>
                <div className={styles.helpCommands}>
                  {commands.map(cmd => (
                    <div key={cmd.name} className={styles.helpCommand}>
                      <code>/{cmd.name}</code>
                      <span>{cmd.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.helpFooter}>
          <p>Type <code>/</code> in the chat input to see command autocomplete</p>
        </div>
      </div>
    </div>
  );
}
