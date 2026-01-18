'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, ChatResponse, Stance } from '@/lib/types';
import { chatStream } from '@/lib/api';
import styles from './Chat.module.css';

type ConnectionStatus = 'connected' | 'disconnected' | 'streaming';

interface ChatProps {
  sessionId: string | undefined;
  onSessionChange?: (sessionId: string) => void;
  onResponse?: (response: ChatResponse) => void;
  onStanceUpdate?: (stance: Stance) => void;
}

export default function Chat({ sessionId, onSessionChange, onResponse, onStanceUpdate }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const accumulatedTextRef = useRef<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    setConnectionStatus('streaming');
    accumulatedTextRef.current = '';

    abortRef.current = chatStream(sessionId, userMessage.content, {
      onText: (text) => {
        accumulatedTextRef.current += text;
        setStreamingText(accumulatedTextRef.current);
      },
      onComplete: (data) => {
        setIsLoading(false);
        setConnectionStatus('connected');
        const finalContent = accumulatedTextRef.current || data.response;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
          },
        ]);
        setStreamingText('');
        accumulatedTextRef.current = '';
        onResponse?.(data);

        // Notify of stance update
        if (data.stanceAfter && onStanceUpdate) {
          onStanceUpdate(data.stanceAfter);
        }

        // If we get a new session ID, notify parent
        if ((data as unknown as { sessionId?: string }).sessionId && onSessionChange) {
          onSessionChange((data as unknown as { sessionId: string }).sessionId);
        }
      },
      onError: (error) => {
        setIsLoading(false);
        setConnectionStatus('disconnected');
        setStreamingText('');
        accumulatedTextRef.current = '';
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: Date.now(),
          },
        ]);

        // Auto-reconnect after 3 seconds
        setTimeout(() => setConnectionStatus('connected'), 3000);
      },
    });
  }, [input, isLoading, sessionId, onResponse, onStanceUpdate, onSessionChange]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsLoading(false);
      setConnectionStatus('connected');
      if (streamingText) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: streamingText, timestamp: Date.now() },
        ]);
        setStreamingText('');
      }
      accumulatedTextRef.current = '';
    }
  };

  const statusColor = connectionStatus === 'connected' ? '#10b981'
    : connectionStatus === 'streaming' ? '#3b82f6'
    : '#ef4444';

  const statusText = connectionStatus === 'connected' ? 'Connected'
    : connectionStatus === 'streaming' ? 'Streaming...'
    : 'Reconnecting...';

  return (
    <div className={styles.chat}>
      <div className={styles.statusBar}>
        <span className={styles.statusDot} style={{ backgroundColor: statusColor }} />
        <span className={styles.statusText}>{statusText}</span>
      </div>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <h2>METAMORPH</h2>
            <p>Transformation-maximizing AI interface</p>
            <p className={styles.hint}>Type a message to begin...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${styles[msg.role]}`}
          >
            <div className={styles.content}>{msg.content}</div>
          </div>
        ))}
        {streamingText && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.content}>{streamingText}</div>
          </div>
        )}
        {isLoading && !streamingText && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.loading}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className={styles.input}
        />
        {isLoading ? (
          <button type="button" onClick={handleStop} className={styles.stopButton}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className={styles.sendButton}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
