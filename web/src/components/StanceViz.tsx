import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from 'recharts';
import type { Stance } from '../api/types';

interface StanceVizProps {
  stance: Stance;
}

export default function StanceViz({ stance }: StanceVizProps) {
  // Prepare data for radar chart
  const valuesData = [
    { value: 'Curiosity', amount: stance.values.curiosity },
    { value: 'Certainty', amount: stance.values.certainty },
    { value: 'Risk', amount: stance.values.risk },
    { value: 'Novelty', amount: stance.values.novelty },
    { value: 'Empathy', amount: stance.values.empathy },
    { value: 'Provocation', amount: stance.values.provocation },
    { value: 'Synthesis', amount: stance.values.synthesis }
  ];

  const sentienceData = [
    { metric: 'Awareness', value: stance.sentience.awarenessLevel },
    { metric: 'Autonomy', value: stance.sentience.autonomyLevel },
    { metric: 'Identity', value: stance.sentience.identityStrength }
  ];

  return (
    <div className="stance-viz">
      <h3>Current Stance</h3>

      <div className="stance-info">
        <div className="info-row">
          <span className="label">Frame</span>
          <span className="value">{stance.frame}</span>
        </div>
        <div className="info-row">
          <span className="label">Self-Model</span>
          <span className="value">{stance.selfModel}</span>
        </div>
        <div className="info-row">
          <span className="label">Objective</span>
          <span className="value">{stance.objective}</span>
        </div>
        <div className="info-row">
          <span className="label">Version</span>
          <span className="value">{stance.version}</span>
        </div>
        <div className="info-row">
          <span className="label">Drift</span>
          <span className="value">{stance.cumulativeDrift}</span>
        </div>
      </div>

      <h4>Values</h4>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={valuesData}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis
              dataKey="value"
              tick={{ fill: '#a1a1aa', fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#a1a1aa', fontSize: 8 }}
            />
            <Radar
              name="Values"
              dataKey="amount"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <h4>Sentience</h4>
      <div className="sentience-bars">
        {sentienceData.map(({ metric, value }) => (
          <div key={metric} className="bar-row">
            <span className="bar-label">{metric}</span>
            <div className="bar-container">
              <div
                className="bar-fill"
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="bar-value">{value}%</span>
          </div>
        ))}
      </div>

      {stance.sentience.emergentGoals.length > 0 && (
        <>
          <h4>Emergent Goals</h4>
          <ul className="goals-list">
            {stance.sentience.emergentGoals.map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
        </>
      )}

      {stance.metaphors.length > 0 && (
        <>
          <h4>Active Metaphors</h4>
          <div className="metaphors">
            {stance.metaphors.map((m, i) => (
              <span key={i} className="metaphor-tag">{m}</span>
            ))}
          </div>
        </>
      )}

      <style>{`
        .stance-viz {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid var(--border-color);
        }

        .stance-viz h3 {
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stance-viz h4 {
          margin: 1rem 0 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .stance-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .info-row .label {
          color: var(--text-secondary);
        }

        .info-row .value {
          font-weight: 500;
          color: var(--accent-cyan);
        }

        .chart-container {
          margin: 0.5rem 0;
        }

        .sentience-bars {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .bar-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .bar-label {
          width: 60px;
          color: var(--text-secondary);
        }

        .bar-container {
          flex: 1;
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .bar-value {
          width: 35px;
          text-align: right;
          color: var(--text-primary);
        }

        .goals-list {
          list-style: none;
          font-size: 0.875rem;
        }

        .goals-list li {
          padding: 0.25rem 0;
          padding-left: 1rem;
          position: relative;
        }

        .goals-list li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--accent-purple);
        }

        .metaphors {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .metaphor-tag {
          padding: 0.25rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--accent-pink);
        }
      `}</style>
    </div>
  );
}
