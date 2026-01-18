'use client';

import { useMemo } from 'react';
import type { Stance, ModeConfig } from '@/lib/types';
import styles from './CommandOutput.module.css';

interface CommandOutputProps {
  command: string;
  data: unknown;
  error?: string;
}

export default function CommandOutput({ command, data, error }: CommandOutputProps) {
  if (error) {
    return (
      <div className={styles.output}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>!</span>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.output}>
      <div className={styles.commandHeader}>
        <span className={styles.slash}>/</span>
        {command}
      </div>
      <div className={styles.content}>
        <CommandRenderer command={command} data={data} />
      </div>
    </div>
  );
}

interface CommandRendererProps {
  command: string;
  data: unknown;
}

function CommandRenderer({ command, data }: CommandRendererProps) {
  const baseCommand = command.split(' ')[0];

  switch (baseCommand) {
    case 'stance':
      return <StanceOutput data={data as Stance} />;
    case 'config':
      return <ConfigOutput data={data as ModeConfig} />;
    case 'stats':
      return <StatsOutput data={data as StatsData} />;
    case 'history':
      return <HistoryOutput data={data as HistoryData} />;
    case 'export':
      return <ExportOutput data={data as string} />;
    case 'subagents':
      return <SubagentsOutput data={data as SubagentData[]} />;
    case 'help':
      return <HelpOutput />;
    case 'transformations':
    case 'transforms':
      return <TransformationsOutput data={data as TransformationData[]} />;
    case 'operator-stats':
    case 'ops':
      return <OperatorStatsOutput data={data as OperatorStats} />;
    case 'coherence':
      return <CoherenceOutput data={data as CoherenceData} />;
    case 'mood':
    case 'emotional-arc':
      return <MoodOutput data={data as MoodData} />;
    case 'memories':
      return <MemoriesOutput data={data as MemoriesData} />;
    case 'sessions':
    case 'session':
      return <SessionsOutput data={data as SessionsData} />;
    default:
      return <GenericOutput data={data} />;
  }
}

// Stance output
function StanceOutput({ data }: { data: Stance }) {
  if (!data) return <div className={styles.noData}>No stance data available</div>;

  return (
    <div className={styles.stanceOutput}>
      <div className={styles.section}>
        <h4>Identity</h4>
        <div className={styles.field}>
          <span className={styles.label}>Frame:</span>
          <span className={styles.value}>{data.frame}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Self-Model:</span>
          <span className={styles.value}>{data.selfModel}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Objective:</span>
          <span className={styles.value}>{data.objective}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h4>Values</h4>
        <div className={styles.values}>
          {Object.entries(data.values).map(([key, value]) => (
            <div key={key} className={styles.valueRow}>
              <span className={styles.valueName}>{key}</span>
              <div className={styles.valueBar}>
                <div
                  className={styles.valueFill}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className={styles.valueNumber}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {data.sentience && (
        <div className={styles.section}>
          <h4>Sentience</h4>
          <div className={styles.valueRow}>
            <span className={styles.valueName}>Awareness</span>
            <div className={styles.valueBar}>
              <div
                className={styles.valueFill}
                style={{ width: `${data.sentience.awarenessLevel}%` }}
              />
            </div>
            <span className={styles.valueNumber}>{data.sentience.awarenessLevel}</span>
          </div>
          <div className={styles.valueRow}>
            <span className={styles.valueName}>Autonomy</span>
            <div className={styles.valueBar}>
              <div
                className={styles.valueFill}
                style={{ width: `${data.sentience.autonomyLevel}%` }}
              />
            </div>
            <span className={styles.valueNumber}>{data.sentience.autonomyLevel}</span>
          </div>
          <div className={styles.valueRow}>
            <span className={styles.valueName}>Identity</span>
            <div className={styles.valueBar}>
              <div
                className={styles.valueFill}
                style={{ width: `${data.sentience.identityStrength}%` }}
              />
            </div>
            <span className={styles.valueNumber}>{data.sentience.identityStrength}</span>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <span>Version: {data.version}</span>
        <span>Drift: {data.cumulativeDrift}</span>
      </div>
    </div>
  );
}

// Config output
function ConfigOutput({ data }: { data: ModeConfig }) {
  if (!data) return <div className={styles.noData}>No config data available</div>;

  return (
    <div className={styles.configOutput}>
      <div className={styles.configGrid}>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Intensity</span>
          <div className={styles.valueBar}>
            <div className={styles.valueFill} style={{ width: `${data.intensity}%` }} />
          </div>
          <span className={styles.configValue}>{data.intensity}%</span>
        </div>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Coherence Floor</span>
          <div className={styles.valueBar}>
            <div className={styles.valueFill} style={{ width: `${data.coherenceFloor}%` }} />
          </div>
          <span className={styles.configValue}>{data.coherenceFloor}%</span>
        </div>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Sentience Level</span>
          <div className={styles.valueBar}>
            <div className={styles.valueFill} style={{ width: `${data.sentienceLevel}%` }} />
          </div>
          <span className={styles.configValue}>{data.sentienceLevel}%</span>
        </div>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Max Drift/Turn</span>
          <span className={styles.configValue}>{data.maxDriftPerTurn}</span>
        </div>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Drift Budget</span>
          <span className={styles.configValue}>{data.driftBudget}</span>
        </div>
        <div className={styles.configItem}>
          <span className={styles.configLabel}>Model</span>
          <span className={styles.configValue}>{data.model}</span>
        </div>
      </div>
    </div>
  );
}

// Stats output
interface StatsData {
  messages: number;
  userMessages: number;
  agentMessages: number;
  stanceVersion: number;
  totalDrift: number;
  sessionId: string;
  conversationId: string;
}

function StatsOutput({ data }: { data: StatsData }) {
  if (!data) return <div className={styles.noData}>No stats available</div>;

  return (
    <div className={styles.statsOutput}>
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.messages}</span>
          <span className={styles.statLabel}>Total Messages</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.userMessages}</span>
          <span className={styles.statLabel}>User Messages</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.agentMessages}</span>
          <span className={styles.statLabel}>Agent Messages</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.stanceVersion}</span>
          <span className={styles.statLabel}>Stance Version</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{data.totalDrift}</span>
          <span className={styles.statLabel}>Total Drift</span>
        </div>
      </div>
      <div className={styles.statsMeta}>
        <div>Session: {data.sessionId?.slice(0, 8) || 'N/A'}...</div>
        <div>Conversation: {data.conversationId?.slice(0, 8) || 'N/A'}...</div>
      </div>
    </div>
  );
}

// History output
interface HistoryData {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  total: number;
}

function HistoryOutput({ data }: { data: HistoryData }) {
  if (!data?.messages?.length) {
    return <div className={styles.noData}>No conversation history</div>;
  }

  return (
    <div className={styles.historyOutput}>
      <div className={styles.historyHeader}>
        Showing {Math.min(10, data.messages.length)} of {data.total} messages
      </div>
      <div className={styles.historyList}>
        {data.messages.slice(-10).map((msg, i) => (
          <div key={i} className={`${styles.historyItem} ${styles[msg.role]}`}>
            <span className={styles.historyRole}>
              {msg.role === 'user' ? 'You' : 'Metamorph'}:
            </span>
            <span className={styles.historyContent}>
              {msg.content.slice(0, 100)}{msg.content.length > 100 ? '...' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Export output
function ExportOutput({ data }: { data: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(data);
  };

  return (
    <div className={styles.exportOutput}>
      <div className={styles.exportActions}>
        <button onClick={handleCopy} className={styles.copyButton}>
          Copy to Clipboard
        </button>
      </div>
      <pre className={styles.exportCode}>{data}</pre>
    </div>
  );
}

// Subagents output
interface SubagentData {
  name: string;
  description: string;
  tools: string[];
}

function SubagentsOutput({ data }: { data: SubagentData[] }) {
  if (!data?.length) {
    return <div className={styles.noData}>No subagents available</div>;
  }

  return (
    <div className={styles.subagentsOutput}>
      {data.map(agent => (
        <div key={agent.name} className={styles.subagentItem}>
          <div className={styles.subagentName}>{agent.name}</div>
          <div className={styles.subagentDesc}>{agent.description}</div>
          <div className={styles.subagentTools}>
            {agent.tools.map(tool => (
              <span key={tool} className={styles.toolBadge}>{tool}</span>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.subagentHint}>
        Invoke with: /explore, /reflect, /dialectic, /verify
      </div>
    </div>
  );
}

// Help output
function HelpOutput() {
  return (
    <div className={styles.helpOutput}>
      <p>Type <code>/</code> to see available commands with autocomplete.</p>
      <p>Commands are organized by category:</p>
      <ul>
        <li><strong>Chat & Control</strong> - /stance, /config, /stats, /mode</li>
        <li><strong>Memory</strong> - /memories, /transformations, /coherence</li>
        <li><strong>Subagents</strong> - /explore, /reflect, /dialectic, /verify</li>
        <li><strong>Sessions</strong> - /sessions list/name/resume/delete</li>
        <li><strong>Advanced</strong> - /branch, /presets, /agents, and more</li>
      </ul>
      <p>Use the side panel tabs to view detailed information.</p>
    </div>
  );
}

// Transformations output
interface TransformationData {
  operator: string;
  score: number;
  timestamp: number;
}

function TransformationsOutput({ data }: { data: TransformationData[] }) {
  if (!data?.length) {
    return <div className={styles.noData}>No transformations recorded</div>;
  }

  return (
    <div className={styles.transformationsOutput}>
      {data.slice(-10).map((t, i) => (
        <div key={i} className={styles.transformItem}>
          <span className={styles.transformOperator}>{t.operator}</span>
          <span className={styles.transformScore}>
            Score: {t.score.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Operator stats output
interface OperatorStats {
  [operator: string]: {
    uses: number;
    avgScore: number;
    lastUsed: number;
  };
}

function OperatorStatsOutput({ data }: { data: OperatorStats }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className={styles.noData}>No operator statistics available</div>;
  }

  return (
    <div className={styles.operatorStatsOutput}>
      {Object.entries(data).map(([name, stats]) => (
        <div key={name} className={styles.operatorStatItem}>
          <div className={styles.operatorName}>{name}</div>
          <div className={styles.operatorMeta}>
            <span>Uses: {stats.uses}</span>
            <span>Avg Score: {stats.avgScore.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Coherence output
interface CoherenceData {
  current: number;
  floor: number;
  forecast: number;
  driftCosts: { [operator: string]: number };
}

function CoherenceOutput({ data }: { data: CoherenceData }) {
  if (!data) {
    return <div className={styles.noData}>No coherence data available</div>;
  }

  return (
    <div className={styles.coherenceOutput}>
      <div className={styles.coherenceMain}>
        <div className={styles.coherenceMetric}>
          <span className={styles.coherenceLabel}>Current</span>
          <span className={styles.coherenceValue}>{data.current}%</span>
        </div>
        <div className={styles.coherenceMetric}>
          <span className={styles.coherenceLabel}>Floor</span>
          <span className={styles.coherenceValue}>{data.floor}%</span>
        </div>
        <div className={styles.coherenceMetric}>
          <span className={styles.coherenceLabel}>Forecast</span>
          <span className={styles.coherenceValue}>{data.forecast}%</span>
        </div>
      </div>
      {data.driftCosts && Object.keys(data.driftCosts).length > 0 && (
        <div className={styles.driftCosts}>
          <h5>Drift Costs</h5>
          {Object.entries(data.driftCosts).map(([op, cost]) => (
            <div key={op} className={styles.driftCostItem}>
              <span>{op}</span>
              <span>{cost}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mood output
interface MoodData {
  current: string;
  arc: Array<{ mood: string; timestamp: number }>;
  sentiment: number;
}

function MoodOutput({ data }: { data: MoodData }) {
  if (!data) {
    return <div className={styles.noData}>No mood data available</div>;
  }

  return (
    <div className={styles.moodOutput}>
      <div className={styles.moodCurrent}>
        <span className={styles.moodLabel}>Current Mood:</span>
        <span className={styles.moodValue}>{data.current}</span>
      </div>
      <div className={styles.moodSentiment}>
        <span className={styles.moodLabel}>Sentiment:</span>
        <span className={`${styles.moodValue} ${data.sentiment > 0 ? styles.positive : data.sentiment < 0 ? styles.negative : ''}`}>
          {data.sentiment > 0 ? '+' : ''}{data.sentiment.toFixed(2)}
        </span>
      </div>
      {data.arc?.length > 0 && (
        <div className={styles.moodArc}>
          <h5>Emotional Arc</h5>
          {data.arc.slice(-5).map((entry, i) => (
            <div key={i} className={styles.moodArcItem}>
              <span>{entry.mood}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Memories output
interface MemoriesData {
  memories: Array<{
    id: string;
    type: 'episodic' | 'semantic' | 'identity';
    content: string;
    importance: number;
    timestamp: Date | string;
  }>;
}

function MemoriesOutput({ data }: { data: MemoriesData }) {
  if (!data?.memories?.length) {
    return <div className={styles.noData}>No memories stored yet</div>;
  }

  const typeColors: Record<string, string> = {
    episodic: '#3b82f6',
    semantic: '#8b5cf6',
    identity: '#ec4899',
  };

  return (
    <div className={styles.memoriesOutput}>
      {data.memories.slice(0, 10).map((memory) => (
        <div key={memory.id} className={styles.memoryItem}>
          <div className={styles.memoryHeader}>
            <span
              className={styles.memoryType}
              style={{ backgroundColor: typeColors[memory.type] || '#666' }}
            >
              {memory.type}
            </span>
            <span className={styles.memoryImportance}>
              Importance: {memory.importance}
            </span>
          </div>
          <div className={styles.memoryContent}>
            {memory.content.slice(0, 200)}{memory.content.length > 200 ? '...' : ''}
          </div>
        </div>
      ))}
      {data.memories.length > 10 && (
        <div className={styles.memoryFooter}>
          + {data.memories.length - 10} more memories
        </div>
      )}
    </div>
  );
}

// Sessions output
interface SessionsData {
  sessions?: Array<{
    id: string;
    stance?: { frame: string };
    messageCount?: number;
    name?: string;
  }>;
  message?: string;
}

function SessionsOutput({ data }: { data: SessionsData }) {
  if (typeof data === 'string') {
    return <div className={styles.genericOutput}>{data}</div>;
  }

  if (!data?.sessions?.length) {
    return <div className={styles.noData}>{data?.message || 'No sessions found'}</div>;
  }

  return (
    <div className={styles.sessionsOutput}>
      {data.sessions.map((session) => (
        <div key={session.id} className={styles.sessionItem}>
          <div className={styles.sessionId}>
            {session.name || session.id.slice(0, 8)}...
          </div>
          <div className={styles.sessionMeta}>
            {session.stance && <span>Frame: {session.stance.frame}</span>}
            {session.messageCount !== undefined && (
              <span>{session.messageCount} messages</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic output for unhandled commands
function GenericOutput({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <div className={styles.noData}>Command executed successfully</div>;
  }

  if (typeof data === 'string') {
    return <div className={styles.genericOutput}>{data}</div>;
  }

  return (
    <pre className={styles.jsonOutput}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
