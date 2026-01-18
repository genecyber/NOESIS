import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import StanceViz from './components/StanceViz';
import Config from './components/Config';
import { ApiClient } from './api/client';
import type { Stance, ModeConfig, AgentState } from './api/types';

const api = new ApiClient();

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Initialize session
  useEffect(() => {
    async function init() {
      try {
        const session = await api.createSession();
        setSessionId(session.sessionId);
        setStance(session.stance);
        setConfig(session.config);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to API:', error);
        setIsConnected(false);
      }
    }
    init();
  }, []);

  // Update stance after messages
  const handleStanceUpdate = (newStance: Stance) => {
    setStance(newStance);
  };

  // Update config
  const handleConfigUpdate = async (newConfig: Partial<ModeConfig>) => {
    if (!sessionId) return;

    try {
      const result = await api.updateConfig(sessionId, newConfig);
      setConfig(result.config);
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="title">METAMORPH</h1>
          <span className="subtitle">Transformation-Maximizing AI</span>
        </div>
        <div className="header-right">
          <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            className="config-btn"
            onClick={() => setShowConfig(!showConfig)}
          >
            Config
          </button>
        </div>
      </header>

      <main className="main">
        <div className="chat-panel">
          <Chat
            api={api}
            sessionId={sessionId}
            onStanceUpdate={handleStanceUpdate}
          />
        </div>

        <aside className="sidebar">
          {showConfig && config && (
            <Config
              config={config}
              onUpdate={handleConfigUpdate}
            />
          )}

          {stance && (
            <StanceViz stance={stance} />
          )}
        </aside>
      </main>

      <style>{`
        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .header-left {
          display: flex;
          align-items: baseline;
          gap: 1rem;
        }

        .title {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .status {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .status.connected {
          background: rgba(16, 185, 129, 0.2);
          color: var(--accent-green);
        }

        .status.disconnected {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .config-btn {
          padding: 0.5rem 1rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .config-btn:hover {
          border-color: var(--accent-cyan);
        }

        .main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .chat-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar {
          width: 350px;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-color);
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (max-width: 900px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
