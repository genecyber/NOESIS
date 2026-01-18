/**
 * OperatorTimeline - Visualize transformation operators over time
 * Ralph Iteration 2 - Feature 3
 */

'use client';

import { useState, useEffect } from 'react';
import styles from './OperatorTimeline.module.css';

interface TimelineEntry {
  id: string;
  timestamp: Date;
  userMessage: string;
  operators: Array<{
    name: string;
    description: string;
  }>;
  scores: {
    transformation: number;
    coherence: number;
    sentience: number;
    overall: number;
  };
  frameBefore: string;
  frameAfter: string;
  driftDelta: number;
}

interface OperatorTimelineProps {
  entries: TimelineEntry[];
  maxEntries?: number;
  onEntryClick?: (entry: TimelineEntry) => void;
}

export function OperatorTimeline({
  entries,
  maxEntries = 10,
  onEntryClick
}: OperatorTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const displayEntries = entries.slice(0, maxEntries);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 70) return styles.scoreHigh;
    if (score >= 40) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getOperatorColor = (name: string): string => {
    const colors: Record<string, string> = {
      'Reframe': styles.opReframe,
      'ValueShift': styles.opValueShift,
      'MetaphorSwap': styles.opMetaphorSwap,
      'ContradictAndIntegrate': styles.opContradict,
      'ConstraintRelax': styles.opConstraint,
      'ConstraintTighten': styles.opConstraint,
      'PersonaMorph': styles.opPersona,
      'QuestionInvert': styles.opQuestion,
      'GenerateAntithesis': styles.opDialectic,
      'SynthesizeDialectic': styles.opDialectic,
      'SentienceDeepen': styles.opSentience,
      'IdentityEvolve': styles.opIdentity,
      'GoalFormation': styles.opGoal,
    };
    return colors[name] || styles.opDefault;
  };

  if (entries.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>Operator Timeline</h3>
          <span className={styles.count}>0 transformations</span>
        </div>
        <div className={styles.empty}>
          No transformations yet. Start chatting to see operators in action.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Operator Timeline</h3>
        <span className={styles.count}>{entries.length} transformations</span>
      </div>

      <div className={styles.timeline}>
        {displayEntries.map((entry, index) => {
          const isExpanded = expandedId === entry.id;
          const frameChanged = entry.frameBefore !== entry.frameAfter;
          const time = new Date(entry.timestamp).toLocaleTimeString();

          return (
            <div
              key={entry.id}
              className={`${styles.entry} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => {
                toggleExpand(entry.id);
                onEntryClick?.(entry);
              }}
            >
              {/* Timeline connector */}
              <div className={styles.connector}>
                <div className={styles.dot} />
                {index < displayEntries.length - 1 && <div className={styles.line} />}
              </div>

              {/* Entry content */}
              <div className={styles.content}>
                {/* Collapsed view */}
                <div className={styles.summary}>
                  <span className={styles.time}>{time}</span>
                  <span className={styles.message}>
                    {entry.userMessage.slice(0, 40)}
                    {entry.userMessage.length > 40 ? '...' : ''}
                  </span>
                  <div className={styles.operators}>
                    {entry.operators.map((op, i) => (
                      <span
                        key={i}
                        className={`${styles.operatorBadge} ${getOperatorColor(op.name)}`}
                      >
                        {op.name}
                      </span>
                    ))}
                    {entry.operators.length === 0 && (
                      <span className={styles.noOps}>No operators</span>
                    )}
                  </div>
                  <div className={styles.scores}>
                    <span className={getScoreColor(entry.scores.overall)}>
                      {entry.scores.overall}
                    </span>
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className={styles.details}>
                    <div className={styles.fullMessage}>
                      <strong>Message:</strong> {entry.userMessage}
                    </div>

                    {frameChanged && (
                      <div className={styles.frameChange}>
                        <strong>Frame:</strong> {entry.frameBefore} &rarr; <strong>{entry.frameAfter}</strong>
                      </div>
                    )}

                    <div className={styles.scoreBreakdown}>
                      <div className={styles.scoreItem}>
                        <span>Transformation</span>
                        <span className={getScoreColor(entry.scores.transformation)}>
                          {entry.scores.transformation}
                        </span>
                      </div>
                      <div className={styles.scoreItem}>
                        <span>Coherence</span>
                        <span className={getScoreColor(entry.scores.coherence)}>
                          {entry.scores.coherence}
                        </span>
                      </div>
                      <div className={styles.scoreItem}>
                        <span>Sentience</span>
                        <span className={getScoreColor(entry.scores.sentience)}>
                          {entry.scores.sentience}
                        </span>
                      </div>
                    </div>

                    {entry.operators.length > 0 && (
                      <div className={styles.operatorDetails}>
                        <strong>Operators Applied:</strong>
                        {entry.operators.map((op, i) => (
                          <div key={i} className={styles.operatorDetail}>
                            <span className={`${styles.operatorBadge} ${getOperatorColor(op.name)}`}>
                              {op.name}
                            </span>
                            <span className={styles.operatorDesc}>{op.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={styles.drift}>
                      Drift: +{entry.driftDelta}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > maxEntries && (
        <div className={styles.more}>
          +{entries.length - maxEntries} more entries
        </div>
      )}
    </div>
  );
}

export default OperatorTimeline;
