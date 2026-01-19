'use client';

import { useMemo } from 'react';
import type { Stance, ModeConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui';

interface CommandOutputProps {
  command: string;
  data: unknown;
  error?: string;
}

export default function CommandOutput({ command, data, error }: CommandOutputProps) {
  if (error) {
    return (
      <div className="bg-emblem-surface border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 text-emblem-danger p-3">
          <span className="flex items-center justify-center w-5 h-5 bg-emblem-danger/20 rounded-full font-bold">
            <AlertCircle className="w-3 h-3" />
          </span>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emblem-surface border border-white/10 rounded-xl overflow-hidden">
      <div className="bg-emblem-surface-2 px-3 py-2 font-mono text-[13px] text-emblem-muted border-b border-white/10">
        <span className="text-emblem-secondary font-bold">/</span>
        {command}
      </div>
      <div className="p-3">
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
  if (!data) return <div className="text-emblem-muted italic text-center py-5">No stance data available</div>;

  return (
    <div>
      <div className="mb-4">
        <h4 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-emblem-secondary">Identity</h4>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emblem-muted text-[13px] min-w-[100px]">Frame:</span>
          <span className="text-emblem-text text-[13px] font-medium">{data.frame}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emblem-muted text-[13px] min-w-[100px]">Self-Model:</span>
          <span className="text-emblem-text text-[13px] font-medium">{data.selfModel}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emblem-muted text-[13px] min-w-[100px]">Objective:</span>
          <span className="text-emblem-text text-[13px] font-medium">{data.objective}</span>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-emblem-secondary">Values</h4>
        <div className="flex flex-col gap-1.5">
          {Object.entries(data.values).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2.5">
              <span className="text-emblem-muted text-xs w-[90px] capitalize">{key}</span>
              <div className="flex-1 h-2 bg-emblem-surface-2 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emblem-secondary to-emblem-accent rounded transition-all duration-300"
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-emblem-text text-xs font-mono w-[30px] text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {data.sentience && (
        <div className="mb-4">
          <h4 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-emblem-secondary">Sentience</h4>
          {[
            { key: 'awarenessLevel', label: 'Awareness' },
            { key: 'autonomyLevel', label: 'Autonomy' },
            { key: 'identityStrength', label: 'Identity' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2.5 mb-1.5">
              <span className="text-emblem-muted text-xs w-[90px]">{label}</span>
              <div className="flex-1 h-2 bg-emblem-surface-2 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emblem-primary to-emblem-secondary rounded transition-all duration-300"
                  style={{ width: `${data.sentience[key as keyof typeof data.sentience]}%` }}
                />
              </div>
              <span className="text-emblem-text text-xs font-mono w-[30px] text-right">
                {data.sentience[key as keyof typeof data.sentience]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 pt-3 border-t border-white/10 mt-3 text-[11px] text-emblem-muted">
        <span>Version: {data.version}</span>
        <span>Drift: {data.cumulativeDrift}</span>
      </div>
    </div>
  );
}

// Config output
function ConfigOutput({ data }: { data: ModeConfig }) {
  if (!data) return <div className="text-emblem-muted italic text-center py-5">No config data available</div>;

  return (
    <div className="flex flex-col gap-3">
      {[
        { key: 'intensity', label: 'Intensity', suffix: '%' },
        { key: 'coherenceFloor', label: 'Coherence Floor', suffix: '%' },
        { key: 'sentienceLevel', label: 'Sentience Level', suffix: '%' }
      ].map(({ key, label, suffix }) => (
        <div key={key} className="flex items-center gap-2.5">
          <span className="text-emblem-muted text-xs w-[120px]">{label}</span>
          <div className="flex-1 h-2 bg-emblem-surface-2 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emblem-secondary to-emblem-accent rounded"
              style={{ width: `${data[key as keyof ModeConfig]}%` }}
            />
          </div>
          <span className="text-emblem-text text-xs font-mono">{data[key as keyof ModeConfig]}{suffix}</span>
        </div>
      ))}
      <div className="flex items-center gap-2.5">
        <span className="text-emblem-muted text-xs w-[120px]">Max Drift/Turn</span>
        <span className="text-emblem-text text-xs font-mono">{data.maxDriftPerTurn}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-emblem-muted text-xs w-[120px]">Drift Budget</span>
        <span className="text-emblem-text text-xs font-mono">{data.driftBudget}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-emblem-muted text-xs w-[120px]">Model</span>
        <span className="text-emblem-text text-xs font-mono">{data.model}</span>
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
  if (!data) return <div className="text-emblem-muted italic text-center py-5">No stats available</div>;

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-4 mb-4">
        {[
          { value: data.messages, label: 'Total Messages' },
          { value: data.userMessages, label: 'User Messages' },
          { value: data.agentMessages, label: 'Agent Messages' },
          { value: data.stanceVersion, label: 'Stance Version' },
          { value: data.totalDrift, label: 'Total Drift' }
        ].map(({ value, label }) => (
          <div key={label} className="text-center p-3 bg-emblem-surface-2 rounded-lg">
            <span className="block text-2xl font-semibold text-emblem-secondary mb-1">{value}</span>
            <span className="text-[11px] text-emblem-muted uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-[11px] text-emblem-muted font-mono">
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
    return <div className="text-emblem-muted italic text-center py-5">No conversation history</div>;
  }

  return (
    <div>
      <div className="text-[11px] text-emblem-muted mb-3">
        Showing {Math.min(10, data.messages.length)} of {data.total} messages
      </div>
      <div className="flex flex-col gap-2">
        {data.messages.slice(-10).map((msg, i) => (
          <div
            key={i}
            className={cn(
              'px-3 py-2 bg-emblem-surface-2 rounded-lg text-[13px] border-l-[3px]',
              msg.role === 'user' ? 'border-l-emblem-accent' : 'border-l-emblem-primary'
            )}
          >
            <span className={cn(
              'font-semibold mr-2',
              msg.role === 'user' ? 'text-emblem-accent' : 'text-emblem-primary'
            )}>
              {msg.role === 'user' ? 'You' : 'Metamorph'}:
            </span>
            <span className="text-emblem-muted">
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
    <div>
      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" />
          Copy to Clipboard
        </Button>
      </div>
      <pre className="bg-emblem-bg border border-white/10 rounded-lg p-3 text-[11px] font-mono text-emblem-muted overflow-x-auto max-h-[200px] overflow-y-auto m-0">
        {data}
      </pre>
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
    return <div className="text-emblem-muted italic text-center py-5">No subagents available</div>;
  }

  return (
    <div>
      {data.map(agent => (
        <div key={agent.name} className="p-3 bg-emblem-surface-2 rounded-lg mb-2 last:mb-0">
          <div className="font-semibold text-emblem-text mb-1">{agent.name}</div>
          <div className="text-[13px] text-emblem-muted mb-2">{agent.description}</div>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map(tool => (
              <span key={tool} className="text-[10px] px-2 py-0.5 bg-emblem-surface rounded text-emblem-muted">
                {tool}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-3 text-[11px] text-emblem-muted italic">
        Invoke with: /explore, /reflect, /dialectic, /verify
      </div>
    </div>
  );
}

// Help output
function HelpOutput() {
  return (
    <div className="text-[13px] text-emblem-muted leading-relaxed">
      <p>Type <code className="bg-emblem-surface-2 px-1.5 py-0.5 rounded text-emblem-secondary font-mono">/</code> to see available commands with autocomplete.</p>
      <p>Commands are organized by category:</p>
      <ul className="my-3 pl-5">
        <li className="mb-1"><strong className="text-emblem-text">Chat & Control</strong> - /stance, /config, /stats, /mode</li>
        <li className="mb-1"><strong className="text-emblem-text">Memory</strong> - /memories, /transformations, /coherence</li>
        <li className="mb-1"><strong className="text-emblem-text">Subagents</strong> - /explore, /reflect, /dialectic, /verify</li>
        <li className="mb-1"><strong className="text-emblem-text">Sessions</strong> - /sessions list/name/resume/delete</li>
        <li className="mb-1"><strong className="text-emblem-text">Advanced</strong> - /branch, /presets, /agents, and more</li>
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
    return <div className="text-emblem-muted italic text-center py-5">No transformations recorded</div>;
  }

  return (
    <div>
      {data.slice(-10).map((t, i) => (
        <div key={i} className="flex justify-between px-3 py-2 bg-emblem-surface-2 rounded-md mb-1">
          <span className="text-emblem-primary font-medium">{t.operator}</span>
          <span className="text-emblem-muted text-xs">Score: {t.score.toFixed(2)}</span>
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
    return <div className="text-emblem-muted italic text-center py-5">No operator statistics available</div>;
  }

  return (
    <div>
      {Object.entries(data).map(([name, stats]) => (
        <div key={name} className="p-3 bg-emblem-surface-2 rounded-lg mb-2">
          <div className="font-semibold text-emblem-danger mb-1.5">{name}</div>
          <div className="flex gap-4 text-xs text-emblem-muted">
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
    return <div className="text-emblem-muted italic text-center py-5">No coherence data available</div>;
  }

  return (
    <div>
      <div className="flex gap-6 mb-4">
        {[
          { label: 'Current', value: data.current },
          { label: 'Floor', value: data.floor },
          { label: 'Forecast', value: data.forecast }
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <span className="block text-[11px] text-emblem-muted uppercase tracking-wider mb-1">{label}</span>
            <span className="text-xl font-semibold text-emblem-secondary">{value}%</span>
          </div>
        ))}
      </div>
      {data.driftCosts && Object.keys(data.driftCosts).length > 0 && (
        <div className="pt-3 border-t border-white/10">
          <h5 className="m-0 mb-2 text-[11px] text-emblem-muted uppercase">Drift Costs</h5>
          {Object.entries(data.driftCosts).map(([op, cost]) => (
            <div key={op} className="flex justify-between text-xs py-1 text-emblem-muted">
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
    return <div className="text-emblem-muted italic text-center py-5">No mood data available</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-emblem-muted text-xs">Current Mood:</span>
        <span className="text-emblem-text font-medium">{data.current}</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-emblem-muted text-xs">Sentiment:</span>
        <span className={cn(
          'font-medium',
          data.sentiment > 0 ? 'text-emblem-accent' : data.sentiment < 0 ? 'text-emblem-danger' : 'text-emblem-text'
        )}>
          {data.sentiment > 0 ? '+' : ''}{data.sentiment.toFixed(2)}
        </span>
      </div>
      {data.arc?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <h5 className="m-0 mb-2 text-[11px] text-emblem-muted uppercase">Emotional Arc</h5>
          <div>
            {data.arc.slice(-5).map((entry, i) => (
              <span key={i} className="inline-block px-2 py-1 bg-emblem-surface-2 rounded m-0.5 text-xs text-emblem-warning">
                {entry.mood}
              </span>
            ))}
          </div>
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
    return <div className="text-emblem-muted italic text-center py-5">No memories stored yet</div>;
  }

  const typeColors: Record<string, string> = {
    episodic: '#3b82f6',
    semantic: '#8b5cf6',
    identity: '#ec4899',
  };

  return (
    <div>
      {data.memories.slice(0, 10).map((memory) => (
        <div key={memory.id} className="p-3 bg-emblem-surface-2 rounded-lg mb-2 last:mb-0">
          <div className="flex justify-between items-center mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: typeColors[memory.type] || '#666' }}
            >
              {memory.type}
            </span>
            <span className="text-[11px] text-emblem-muted">Importance: {memory.importance}</span>
          </div>
          <div className="text-[13px] text-emblem-text leading-relaxed">
            {memory.content.slice(0, 200)}{memory.content.length > 200 ? '...' : ''}
          </div>
        </div>
      ))}
      {data.memories.length > 10 && (
        <div className="mt-3 text-[11px] text-emblem-muted text-center italic">
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
    return <div className="text-emblem-muted text-[13px] leading-relaxed">{data}</div>;
  }

  if (!data?.sessions?.length) {
    return <div className="text-emblem-muted italic text-center py-5">{data?.message || 'No sessions found'}</div>;
  }

  return (
    <div>
      {data.sessions.map((session) => (
        <div key={session.id} className="flex justify-between items-center p-3 bg-emblem-surface-2 rounded-lg mb-2 last:mb-0">
          <div className="font-mono text-[13px] text-emblem-accent">
            {session.name || session.id.slice(0, 8)}...
          </div>
          <div className="flex gap-4 text-[11px] text-emblem-muted">
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
    return <div className="text-emblem-muted italic text-center py-5">Command executed successfully</div>;
  }

  if (typeof data === 'string') {
    return <div className="text-emblem-muted text-[13px] leading-relaxed">{data}</div>;
  }

  return (
    <pre className="bg-emblem-bg border border-white/10 rounded-lg p-3 text-[11px] font-mono text-emblem-muted overflow-x-auto max-h-[300px] overflow-y-auto m-0">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
