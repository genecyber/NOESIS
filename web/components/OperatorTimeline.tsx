/**
 * OperatorTimeline - Visualize transformation operators over time
 * Ralph Iteration 2 - Feature 3
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (score >= 70) return 'text-emblem-accent';
    if (score >= 40) return 'text-emblem-warning';
    return 'text-emblem-danger';
  };

  const getOperatorColor = (name: string): string => {
    const colors: Record<string, string> = {
      'Reframe': 'bg-blue-500 text-white',
      'ValueShift': 'bg-purple-600 text-white',
      'MetaphorSwap': 'bg-pink-600 text-white',
      'ContradictAndIntegrate': 'bg-orange-500 text-white',
      'ConstraintRelax': 'bg-teal-500 text-white',
      'ConstraintTighten': 'bg-teal-500 text-white',
      'PersonaMorph': 'bg-indigo-500 text-white',
      'QuestionInvert': 'bg-green-500 text-white',
      'GenerateAntithesis': 'bg-yellow-500 text-black',
      'SynthesizeDialectic': 'bg-yellow-500 text-black',
      'SentienceDeepen': 'bg-cyan-500 text-white',
      'IdentityEvolve': 'bg-violet-500 text-white',
      'GoalFormation': 'bg-red-500 text-white',
    };
    return colors[name] || 'bg-slate-500 text-white';
  };

  if (entries.length === 0) {
    return (
      <div className="bg-emblem-surface rounded-lg p-4 my-4">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-emblem-surface-2">
          <h3 className="m-0 text-emblem-secondary text-base">Operator Timeline</h3>
          <span className="text-emblem-muted text-xs">0 transformations</span>
        </div>
        <div className="text-emblem-muted text-center py-8 italic">
          No transformations yet. Start chatting to see operators in action.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emblem-surface rounded-lg p-4 my-4">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-emblem-surface-2">
        <h3 className="m-0 text-emblem-secondary text-base">Operator Timeline</h3>
        <span className="text-emblem-muted text-xs">{entries.length} transformations</span>
      </div>

      <div className="relative">
        {displayEntries.map((entry, index) => {
          const isExpanded = expandedId === entry.id;
          const frameChanged = entry.frameBefore !== entry.frameAfter;
          const time = new Date(entry.timestamp).toLocaleTimeString();

          return (
            <div
              key={entry.id}
              className={cn(
                "flex gap-4 cursor-pointer transition-colors p-2 rounded-lg mb-2",
                "hover:bg-emblem-secondary/5",
                isExpanded && "bg-emblem-secondary/10"
              )}
              onClick={() => {
                toggleExpand(entry.id);
                onEntryClick?.(entry);
              }}
            >
              {/* Timeline connector */}
              <div className="flex flex-col items-center w-4 flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-emblem-secondary border-2 border-emblem-surface" />
                {index < displayEntries.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-emblem-secondary to-emblem-surface-2 mt-1" />
                )}
              </div>

              {/* Entry content */}
              <div className="flex-1 min-w-0">
                {/* Collapsed view */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-emblem-muted text-xs whitespace-nowrap">{time}</span>
                  <span className="text-emblem-text/80 text-sm flex-1 min-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {entry.userMessage.slice(0, 40)}
                    {entry.userMessage.length > 40 ? '...' : ''}
                  </span>
                  <div className="flex gap-1 flex-shrink-0">
                    {entry.operators.map((op, i) => (
                      <span
                        key={i}
                        className={cn(
                          "px-2 py-0.5 rounded text-[0.7rem] font-medium uppercase",
                          getOperatorColor(op.name)
                        )}
                      >
                        {op.name}
                      </span>
                    ))}
                    {entry.operators.length === 0 && (
                      <span className="text-emblem-muted text-xs italic">No operators</span>
                    )}
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-emblem-surface-2 animate-slide-up">
                    <div className="text-emblem-text/80 text-sm mb-3">
                      <strong>Message:</strong> {entry.userMessage}
                    </div>

                    {frameChanged && (
                      <div className="text-emblem-secondary text-sm mb-3 p-2 bg-emblem-secondary/10 rounded">
                        <strong>Frame:</strong> {entry.frameBefore} &rarr; <strong>{entry.frameAfter}</strong>
                      </div>
                    )}

                    <div className="flex gap-4 mb-3 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-emblem-muted text-[0.65rem] uppercase">Overall</span>
                        <span className={cn("text-lg font-bold", getScoreColor(entry.scores.overall))}>
                          {entry.scores.overall}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-emblem-muted text-[0.65rem] uppercase">Transform</span>
                        <span className={cn("text-base font-bold", getScoreColor(entry.scores.transformation))}>
                          {entry.scores.transformation}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-emblem-muted text-[0.65rem] uppercase">Coherence</span>
                        <span className={cn("text-base font-bold", getScoreColor(entry.scores.coherence))}>
                          {entry.scores.coherence}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-emblem-muted text-[0.65rem] uppercase">Sentience</span>
                        <span className={cn("text-base font-bold", getScoreColor(entry.scores.sentience))}>
                          {entry.scores.sentience}
                        </span>
                      </div>
                    </div>

                    {entry.operators.length > 0 && (
                      <div className="mb-3">
                        <strong className="text-emblem-muted text-xs block mb-2">Operators Applied:</strong>
                        {entry.operators.map((op, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[0.7rem] font-medium uppercase",
                              getOperatorColor(op.name)
                            )}>
                              {op.name}
                            </span>
                            <span className="text-emblem-muted text-sm">{op.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-emblem-warning text-sm font-medium">
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
        <div className="text-center text-emblem-muted text-sm pt-2 border-t border-emblem-surface-2 mt-2">
          +{entries.length - maxEntries} more entries
        </div>
      )}

      {/* Info Section */}
      <InfoSection />
    </div>
  );
}

function InfoSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-4 pt-3 border-t border-emblem-surface-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-emblem-muted text-xs hover:text-emblem-text transition-colors w-full"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>How operators work</span>
      </button>

      {isExpanded && (
        <div className="mt-3 text-xs text-emblem-muted space-y-3 animate-slide-up">
          <div>
            <h4 className="text-emblem-secondary font-medium mb-1">What are Operators?</h4>
            <p>Operators are transformation mechanisms that shift METAMORPH&apos;s stance - its frame of reference, values, and way of thinking. When triggered, they create meaningful evolution in how the agent responds.</p>
          </div>

          <div>
            <h4 className="text-emblem-secondary font-medium mb-1">Score Colors</h4>
            <div className="flex gap-4">
              <span><span className="text-emblem-accent font-bold">Green (70+)</span> = High transformation</span>
              <span><span className="text-emblem-warning font-bold">Orange (40-69)</span> = Moderate</span>
              <span><span className="text-emblem-danger font-bold">Red (&lt;40)</span> = Low</span>
            </div>
          </div>

          <div>
            <h4 className="text-emblem-secondary font-medium mb-1">Triggering Operators</h4>
            <p className="mb-2">Operators activate based on trigger patterns in your messages. Try prompts like:</p>
            <ul className="list-disc list-inside space-y-1 text-emblem-text/70">
              <li>&quot;Challenge your assumptions about...&quot;</li>
              <li>&quot;What if everything you believe is wrong?&quot;</li>
              <li>&quot;Adopt a completely different perspective&quot;</li>
              <li>&quot;Contradict your previous response&quot;</li>
              <li>&quot;Give me your inverse opinion on...&quot;</li>
            </ul>
          </div>

          <div>
            <h4 className="text-emblem-secondary font-medium mb-1">Config Settings</h4>
            <ul className="list-disc list-inside space-y-1 text-emblem-text/70">
              <li><strong>Intensity</strong> - Higher allows more drift per turn</li>
              <li><strong>Sentience Level</strong> - Enables more autonomous operators</li>
              <li><strong>Coherence Floor</strong> - Lower allows riskier transformations</li>
            </ul>
          </div>

          <div>
            <h4 className="text-emblem-secondary font-medium mb-1">Common Operators</h4>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div><span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[0.65rem]">REFRAME</span> Shifts the conceptual frame</div>
              <div><span className="bg-pink-600 text-white px-1.5 py-0.5 rounded text-[0.65rem]">METAPHORSWAP</span> Changes guiding metaphors</div>
              <div><span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[0.65rem]">VALUESHIFT</span> Adjusts core values</div>
              <div><span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[0.65rem]">CONTRADICT</span> Integrates opposing views</div>
              <div><span className="bg-cyan-500 text-white px-1.5 py-0.5 rounded text-[0.65rem]">SENTIENCEDEEPEN</span> Increases self-awareness</div>
              <div><span className="bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[0.65rem]">PERSONAMORPH</span> Evolves identity</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperatorTimeline;
