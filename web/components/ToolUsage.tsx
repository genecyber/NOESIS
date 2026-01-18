'use client';

import { useState } from 'react';
import type { ToolUseEvent } from '@/lib/types';
import styles from './ToolUsage.module.css';

interface ToolUsageProps {
  tools: ToolUseEvent[];
}

export default function ToolUsage({ tools }: ToolUsageProps) {
  if (tools.length === 0) return null;

  return (
    <div className={styles.toolUsage}>
      <div className={styles.header}>
        <span className={styles.icon}>⚡</span>
        <span className={styles.label}>Tools Used</span>
        <span className={styles.count}>{tools.length}</span>
      </div>
      <div className={styles.tools}>
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

  const statusIcon = {
    started: '⏳',
    completed: '✓',
    error: '✗',
  };

  const statusClass = {
    started: styles.started,
    completed: styles.completed,
    error: styles.error,
  };

  return (
    <div
      className={`${styles.tool} ${statusClass[tool.status]}`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div className={styles.toolHeader}>
        <span className={styles.statusIcon}>{statusIcon[tool.status]}</span>
        <span className={styles.toolName}>{tool.name}</span>
        {tool.status === 'started' && (
          <span className={styles.spinner} />
        )}
      </div>

      <div className={styles.inputPreview}>
        {formatInput(tool.input)}
      </div>

      {/* Hover tooltip with full details */}
      {showDetails && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipSection}>
            <div className={styles.tooltipLabel}>Input</div>
            <pre className={styles.tooltipCode}>
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>

          {tool.result && (
            <div className={styles.tooltipSection}>
              <div className={styles.tooltipLabel}>Result</div>
              <pre className={styles.tooltipCode}>
                {truncateResult(tool.result)}
              </pre>
            </div>
          )}

          {tool.error && (
            <div className={styles.tooltipSection}>
              <div className={`${styles.tooltipLabel} ${styles.errorLabel}`}>Error</div>
              <div className={styles.tooltipError}>{tool.error}</div>
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
  return (
    <span className={`${styles.indicator} ${styles[tool.status]}`}>
      <span className={styles.indicatorIcon}>
        {tool.status === 'started' ? '⏳' : tool.status === 'completed' ? '✓' : '✗'}
      </span>
      <span className={styles.indicatorName}>{tool.name}</span>
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
    <div className={styles.activeBar}>
      <span className={styles.activeLabel}>Working with:</span>
      {activeTools.map(tool => (
        <span key={tool.id} className={styles.activeTool}>
          <span className={styles.activeSpinner} />
          {tool.name}
        </span>
      ))}
    </div>
  );
}
