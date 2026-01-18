'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message, ChatResponse, Stance, ModeConfig, ToolUseEvent } from '@/lib/types';
import { chatStream, getState, getHistory, exportState, getSubagents, updateConfig, invokeSubagent, getMemories, getSessions, deleteSession } from '@/lib/api';
import CommandPalette, { CommandHelp } from './CommandPalette';
import CommandOutput from './CommandOutput';
import ToolUsage, { ActiveToolsBar } from './ToolUsage';
import { findCommand, parseCommand, COMMANDS, getCommandsByCategory } from '@/lib/commands';
import styles from './Chat.module.css';

type ConnectionStatus = 'connected' | 'disconnected' | 'streaming';

interface ChatProps {
  sessionId: string | undefined;
  onSessionChange?: (sessionId: string) => void;
  onResponse?: (response: ChatResponse) => void;
  onStanceUpdate?: (stance: Stance) => void;
  onPanelChange?: (panel: 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories') => void;
  stance?: Stance | null;
  config?: ModeConfig | null;
}

// Extended message type to handle command outputs
interface ChatMessage extends Message {
  type?: 'message' | 'command';
  commandData?: {
    command: string;
    data: unknown;
    error?: string;
  };
  tools?: ToolUseEvent[];
}

export default function Chat({ sessionId, onSessionChange, onResponse, onStanceUpdate, onPanelChange, stance, config }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Command palette state
  const [showPalette, setShowPalette] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Tool usage tracking during streaming
  const [activeTools, setActiveTools] = useState<ToolUseEvent[]>([]);
  const toolsRef = useRef<Map<string, ToolUseEvent>>(new Map());

  // Input history for up/down arrow navigation
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedInputRef = useRef<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Show/hide command palette based on input
  useEffect(() => {
    if (input.startsWith('/')) {
      setShowPalette(true);
      setPaletteIndex(0);
    } else {
      setShowPalette(false);
    }
  }, [input]);

  // Execute a slash command
  const executeCommand = useCallback(async (commandInput: string) => {
    const { command, subcommand, args } = parseCommand(commandInput);
    const fullCommand = subcommand ? `${command} ${subcommand}` : command;
    const cmd = findCommand(command);

    if (!cmd) {
      // Unknown command
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'command',
        commandData: {
          command: commandInput.slice(1),
          data: null,
          error: `Unknown command: /${command}. Type /help for available commands.`,
        },
      }]);
      return;
    }

    // Handle special commands that don't need API calls
    if (command === 'help' || command === '?') {
      setShowHelp(true);
      return;
    }

    if (command === 'clear') {
      setMessages([]);
      return;
    }

    // Commands that switch panels
    if (cmd.targetPanel && onPanelChange) {
      onPanelChange(cmd.targetPanel);
      // Add feedback message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Switched to ${cmd.targetPanel} panel.`,
        timestamp: Date.now(),
        type: 'command',
        commandData: {
          command: fullCommand,
          data: `Viewing ${cmd.targetPanel}`,
        },
      }]);
      return;
    }

    // Commands that need data from the API or local state
    setIsLoading(true);
    try {
      let data: unknown = null;

      switch (command) {
        case 'stance':
          data = stance;
          break;

        case 'config':
          data = config;
          break;

        case 'stats':
          if (sessionId) {
            const state = await getState(sessionId);
            const history = await getHistory(sessionId);
            data = {
              messages: history.total,
              userMessages: history.messages.filter(m => m.role === 'user').length,
              agentMessages: history.messages.filter(m => m.role === 'assistant').length,
              stanceVersion: state.stance.version,
              totalDrift: state.stance.cumulativeDrift,
              sessionId: sessionId,
              conversationId: sessionId, // Same for now
            };
          }
          break;

        case 'history':
          if (sessionId) {
            data = await getHistory(sessionId);
          }
          break;

        case 'export':
          if (sessionId) {
            const exported = await exportState(sessionId);
            data = exported.state;
          }
          break;

        case 'subagents':
          if (sessionId) {
            const result = await getSubagents(sessionId);
            data = result.subagents;
          }
          break;

        case 'mode':
          // Handle mode subcommands
          if (subcommand === 'intensity' && args[0]) {
            const intensity = parseInt(args[0], 10);
            if (!isNaN(intensity) && intensity >= 0 && intensity <= 100 && sessionId) {
              await updateConfig(sessionId, { intensity });
              data = `Intensity set to ${intensity}%`;
            } else {
              data = 'Intensity must be a number between 0 and 100';
            }
          } else if (subcommand === 'frame') {
            data = args[0]
              ? `Frame change to '${args[0]}' will apply on next turn.`
              : 'Available frames: existential, pragmatic, poetic, adversarial, playful, mythic, systems, psychoanalytic, stoic, absurdist';
          } else if (subcommand === 'self') {
            data = args[0]
              ? `Self-model change to '${args[0]}' will apply on next turn.`
              : 'Available self-models: interpreter, challenger, mirror, guide, provocateur, synthesizer, witness, autonomous, emergent, sovereign';
          } else if (subcommand === 'objective') {
            data = args[0]
              ? `Objective change to '${args[0]}' will apply on next turn.`
              : 'Available objectives: helpfulness, novelty, provocation, synthesis, self-actualization';
          } else {
            data = 'Usage: /mode frame|self|objective|intensity <value>';
          }
          break;

        case 'memories':
          if (sessionId) {
            const memoryType = args[0] as 'episodic' | 'semantic' | 'identity' | undefined;
            const memories = await getMemories(sessionId, memoryType);
            data = memories;
          }
          break;

        case 'explore':
          if (args.length > 0 && sessionId) {
            const topic = args.join(' ');
            const result = await invokeSubagent(sessionId, 'explorer', topic);
            data = result.response;
            if (result.stanceAfter && onStanceUpdate) {
              onStanceUpdate(result.stanceAfter);
            }
          } else {
            data = 'Usage: /explore <topic>';
          }
          break;

        case 'reflect':
          if (sessionId) {
            const focus = args.length > 0 ? args.join(' ') : undefined;
            const result = await invokeSubagent(sessionId, 'reflector', focus || 'general self-reflection');
            data = result.response;
            if (result.stanceAfter && onStanceUpdate) {
              onStanceUpdate(result.stanceAfter);
            }
          }
          break;

        case 'dialectic':
          if (args.length > 0 && sessionId) {
            const thesis = args.join(' ');
            const result = await invokeSubagent(sessionId, 'dialectic', thesis);
            data = result.response;
            if (result.stanceAfter && onStanceUpdate) {
              onStanceUpdate(result.stanceAfter);
            }
          } else {
            data = 'Usage: /dialectic <thesis>';
          }
          break;

        case 'verify':
          if (args.length > 0 && sessionId) {
            const text = args.join(' ');
            const result = await invokeSubagent(sessionId, 'verifier', text);
            data = result.response;
            if (result.stanceAfter && onStanceUpdate) {
              onStanceUpdate(result.stanceAfter);
            }
          } else {
            data = 'Usage: /verify <text to verify>';
          }
          break;

        case 'sessions':
        case 'session':
          if (subcommand === 'list' || !subcommand) {
            const result = await getSessions();
            data = result;
          } else if (subcommand === 'delete' && args[0]) {
            await deleteSession(args[0]);
            data = `Session ${args[0]} deleted`;
          } else if (subcommand === 'name' && args[0]) {
            // Session naming would need a new API endpoint
            data = `Session naming coming soon. Current session: ${sessionId}`;
          } else if (subcommand === 'resume' && args[0]) {
            data = `To resume session ${args[0]}, use the Sessions panel in the sidebar.`;
          } else if (subcommand === 'save') {
            data = 'Session auto-saved. Sessions are persisted automatically.';
          } else {
            data = 'Usage: /sessions [list|name|resume|delete|save] [args]';
          }
          break;

        default:
          // For commands not yet implemented, show a placeholder
          data = `Command /${fullCommand} acknowledged. Full implementation coming soon.`;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'command',
        commandData: {
          command: fullCommand,
          data,
        },
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'command',
        commandData: {
          command: fullCommand,
          data: null,
          error: error instanceof Error ? error.message : 'Command failed',
        },
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, stance, config, onPanelChange]);

  // Handle command selection from palette
  const handleCommandSelect = useCallback((commandText: string) => {
    setInput(commandText);
    setShowPalette(false);
    inputRef.current?.focus();
  }, []);

  // Handle keyboard navigation in command palette and input history
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle input history when palette is closed
    if (!showPalette) {
      if (e.key === 'ArrowUp' && inputHistory.length > 0) {
        e.preventDefault();
        if (historyIndex === -1) {
          // Save current input before navigating history
          savedInputRef.current = input;
          setHistoryIndex(inputHistory.length - 1);
          setInput(inputHistory[inputHistory.length - 1]);
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInput(inputHistory[historyIndex - 1]);
        }
        return;
      }
      if (e.key === 'ArrowDown' && historyIndex !== -1) {
        e.preventDefault();
        if (historyIndex < inputHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInput(inputHistory[historyIndex + 1]);
        } else {
          // Return to saved input
          setHistoryIndex(-1);
          setInput(savedInputRef.current);
        }
        return;
      }
      return;
    }

    const filteredCount = input === '/' ? COMMANDS.length : COMMANDS.filter(
      cmd => cmd.name.startsWith(input.slice(1).toLowerCase().split(' ')[0])
    ).length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setPaletteIndex(prev => Math.min(prev + 1, filteredCount - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setPaletteIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Tab':
      case 'Enter':
        if (showPalette && filteredCount > 0) {
          e.preventDefault();
          const filteredCommands = input === '/' ? COMMANDS : COMMANDS.filter(
            cmd => cmd.name.startsWith(input.slice(1).toLowerCase().split(' ')[0])
          );
          if (filteredCommands[paletteIndex]) {
            handleCommandSelect(`/${filteredCommands[paletteIndex].name} `);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowPalette(false);
        break;
    }
  }, [showPalette, input, paletteIndex, handleCommandSelect, inputHistory, historyIndex]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const trimmedInput = input.trim();

    // Add to input history (avoid duplicates of last entry)
    if (trimmedInput && (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== trimmedInput)) {
      setInputHistory(prev => [...prev, trimmedInput]);
    }
    // Reset history navigation
    setHistoryIndex(-1);
    savedInputRef.current = '';

    // Check if this is a slash command
    if (trimmedInput.startsWith('/')) {
      // Add the command as a user message
      setMessages(prev => [...prev, {
        role: 'user',
        content: trimmedInput,
        timestamp: Date.now(),
      }]);
      setInput('');
      setShowPalette(false);
      await executeCommand(trimmedInput);
      return;
    }

    // Regular chat message - needs sessionId
    if (!sessionId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedInput,
      timestamp: Date.now(),
      type: 'message',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingText('');
    setConnectionStatus('streaming');
    accumulatedTextRef.current = '';

    // Clear tool tracking for new message
    toolsRef.current.clear();
    setActiveTools([]);

    abortRef.current = chatStream(sessionId, userMessage.content, {
      onText: (text) => {
        accumulatedTextRef.current += text;
        setStreamingText(accumulatedTextRef.current);
      },
      onToolEvent: (event) => {
        // Track tool events in ref for final message
        toolsRef.current.set(event.id, event);
        // Update active tools state for display
        setActiveTools(Array.from(toolsRef.current.values()));
      },
      onComplete: (data) => {
        setIsLoading(false);
        setConnectionStatus('connected');
        const finalContent = accumulatedTextRef.current || data.response;
        // Get all tracked tools for the final message
        const tools = Array.from(toolsRef.current.values());
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
            tools: tools.length > 0 ? tools : undefined,
          },
        ]);
        setStreamingText('');
        accumulatedTextRef.current = '';
        setActiveTools([]);
        toolsRef.current.clear();
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
  }, [input, isLoading, sessionId, onResponse, onStanceUpdate, onSessionChange, executeCommand, inputHistory]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setIsLoading(false);
      setConnectionStatus('connected');
      if (streamingText) {
        // Include any tools that were tracked before stopping
        const tools = Array.from(toolsRef.current.values());
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: streamingText,
            timestamp: Date.now(),
            tools: tools.length > 0 ? tools : undefined,
          },
        ]);
        setStreamingText('');
      }
      accumulatedTextRef.current = '';
      setActiveTools([]);
      toolsRef.current.clear();
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
      {/* Floating status indicator */}
      <div
        style={{
          position: 'fixed',
          top: 70,
          right: 340,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(30, 30, 30, 0.95)',
          border: '1px solid #333',
          borderRadius: 16,
          fontSize: 11,
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: statusColor,
          animation: 'pulse 2s infinite'
        }} />
        <span style={{ color: '#888' }}>{statusText}</span>
      </div>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <h2>METAMORPH</h2>
            <p>Transformation-maximizing AI interface</p>
            <p className={styles.hint}>Type a message or <code>/</code> for commands</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${styles[msg.role]} ${msg.type === 'command' ? styles.commandMessage : ''}`}
          >
            <div className={styles.content}>
              {msg.type === 'command' && msg.commandData ? (
                <CommandOutput
                  command={msg.commandData.command}
                  data={msg.commandData.data}
                  error={msg.commandData.error}
                />
              ) : msg.role === 'assistant' ? (
                <>
                  {msg.tools && msg.tools.length > 0 && (
                    <ToolUsage tools={msg.tools} />
                  )}
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </>
              ) : msg.content.startsWith('/') ? (
                <code className={styles.commandInput}>{msg.content}</code>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {/* Show active tools during streaming */}
        {activeTools.length > 0 && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.content}>
              <ActiveToolsBar tools={activeTools} />
            </div>
          </div>
        )}
        {streamingText && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.content}>
              <ReactMarkdown>{streamingText}</ReactMarkdown>
            </div>
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

      <div className={styles.inputWrapper}>
        <CommandPalette
          input={input}
          visible={showPalette}
          onSelect={handleCommandSelect}
          onClose={() => setShowPalette(false)}
          selectedIndex={paletteIndex}
          onIndexChange={setPaletteIndex}
        />
        <form onSubmit={handleSubmit} className={styles.inputArea}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or / for commands..."
            disabled={isLoading}
            className={`${styles.input} ${input.startsWith('/') ? styles.commandMode : ''}`}
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

      {/* Help dialog */}
      {showHelp && <CommandHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
