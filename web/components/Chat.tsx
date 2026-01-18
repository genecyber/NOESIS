'use client';

import { useState, useRef, useEffect } from 'react';
import type { Message, ChatResponse } from '@/lib/types';
import { chatStream } from '@/lib/api';
import styles from './Chat.module.css';

interface ChatProps {
  sessionId: string | undefined;
  onSessionChange?: (sessionId: string) => void;
  onResponse?: (response: ChatResponse) => void;
}

export default function Chat({ sessionId, onSessionChange, onResponse }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingText('');

    abortRef.current = chatStream(sessionId, userMessage.content, {
      onText: (text) => {
        setStreamingText(prev => prev + text);
      },
      onComplete: (data) => {
        setIsLoading(false);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: streamingText || data.response,
            timestamp: Date.now(),
          },
        ]);
        setStreamingText('');
        onResponse?.(data);

        // If we get a new session ID, notify parent
        if ((data as unknown as { sessionId?: string }).sessionId && onSessionChange) {
          onSessionChange((data as unknown as { sessionId: string }).sessionId);
        }
      },
      onError: (error) => {
        setIsLoading(false);
        setStreamingText('');
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: Date.now(),
          },
        ]);
      },
    });
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsLoading(false);
      if (streamingText) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: streamingText, timestamp: Date.now() },
        ]);
        setStreamingText('');
      }
    }
  };

  return (
    <div className={styles.chat}>
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
