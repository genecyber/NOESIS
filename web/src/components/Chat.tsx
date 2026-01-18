import { useState, useRef, useEffect } from 'react';
import type { ApiClient } from '../api/client';
import type { Stance, ChatMessage } from '../api/types';

interface ChatProps {
  api: ApiClient;
  sessionId: string | null;
  onStanceUpdate: (stance: Stance) => void;
}

export default function Chat({ api, sessionId, onStanceUpdate }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    setActiveTools([]);

    // Use streaming
    cleanupRef.current = api.chatStream(sessionId, userMessage.content, {
      onText: (text) => {
        setStreamingText(prev => prev + text);
      },
      onTool: (tool) => {
        setActiveTools(prev => prev.includes(tool) ? prev : [...prev, tool]);
      },
      onComplete: (data) => {
        // Create assistant message from accumulated text
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: streamingText,
          timestamp: new Date(),
          toolsUsed: data.toolsUsed
        };

        setMessages(prev => [...prev, assistantMessage]);
        setStreamingText('');
        setIsLoading(false);
        setActiveTools([]);

        if (data.stanceAfter) {
          onStanceUpdate(data.stanceAfter);
        }
      },
      onError: (error) => {
        console.error('Stream error:', error);
        setIsLoading(false);
        setStreamingText('');
      }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && !isLoading && (
          <div className="welcome">
            <h2>Welcome to METAMORPH</h2>
            <p>A transformation-maximizing AI that evolves through conversation.</p>
            <p className="hint">Try asking about something complex, philosophical, or creative.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="role">
                {msg.role === 'user' ? 'You' : 'Metamorph'}
              </span>
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <span className="tools">
                  Used: {msg.toolsUsed.join(', ')}
                </span>
              )}
            </div>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant streaming">
            <div className="message-header">
              <span className="role">Metamorph</span>
              {activeTools.length > 0 && (
                <span className="tools active">
                  Using: {activeTools.join(', ')}
                </span>
              )}
            </div>
            <div className="message-content">
              {streamingText || <span className="thinking">Thinking...</span>}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
          disabled={!sessionId || isLoading}
          rows={2}
        />
        <button type="submit" disabled={!sessionId || isLoading || !input.trim()}>
          Send
        </button>
      </form>

      <style>{`
        .chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .welcome {
          text-align: center;
          padding: 3rem 2rem;
          color: var(--text-secondary);
        }

        .welcome h2 {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .welcome .hint {
          margin-top: 1rem;
          font-size: 0.875rem;
          opacity: 0.7;
        }

        .message {
          max-width: 80%;
          padding: 1rem;
          border-radius: 12px;
          background: var(--bg-secondary);
        }

        .message.user {
          align-self: flex-end;
          background: var(--bg-tertiary);
          border: 1px solid var(--accent-cyan);
        }

        .message.assistant {
          align-self: flex-start;
          border: 1px solid var(--border-color);
        }

        .message.streaming {
          border-color: var(--accent-purple);
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }

        .role {
          font-weight: 600;
          color: var(--accent-cyan);
        }

        .message.user .role {
          color: var(--text-primary);
        }

        .tools {
          color: var(--text-secondary);
          font-style: italic;
        }

        .tools.active {
          color: var(--accent-purple);
        }

        .message-content {
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.5;
        }

        .thinking {
          color: var(--text-secondary);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .input-area {
          display: flex;
          gap: 0.5rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
        }

        .input-area textarea {
          flex: 1;
          padding: 0.75rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.9rem;
          resize: none;
        }

        .input-area textarea:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .input-area textarea::placeholder {
          color: var(--text-secondary);
        }

        .input-area button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .input-area button:hover:not(:disabled) {
          opacity: 0.9;
        }

        .input-area button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
