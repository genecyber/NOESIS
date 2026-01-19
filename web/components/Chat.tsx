'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import type { Message, ChatResponse, Stance, ModeConfig, ToolUseEvent } from '@/lib/types';
import { chatStream, getState, getHistory, exportState, getSubagents, updateConfig, invokeSubagent, getMemories, getSessions, deleteSession } from '@/lib/api';
import CommandPalette, { CommandHelp } from './CommandPalette';
import CommandOutput from './CommandOutput';
import ToolUsage, { ActiveToolsBar } from './ToolUsage';
import { findCommand, parseCommand, COMMANDS, getCommandsByCategory } from '@/lib/commands';
import { isPluginCommand, executePluginCommand } from '@/lib/plugins/registry';
import { useInputHistory } from '@/lib/hooks/useLocalStorage';
import { saveMessages, getMessages, saveLastSessionId } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { Components } from 'react-markdown';

type ConnectionStatus = 'connected' | 'disconnected' | 'streaming';

// Shared markdown components for consistent rendering during streaming and final display
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="text-xl font-display font-bold text-emblem-secondary mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-display font-semibold text-emblem-secondary mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-display font-semibold text-emblem-secondary mt-3 mb-2 first:mt-0">{children}</h3>,
  code: ({ children, className }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[0.9em] break-all">{children}</code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/40 p-4 rounded-lg overflow-x-auto my-3 font-mono text-sm max-w-full scrollbar-styled">{children}</pre>
  ),
  ul: ({ children }) => <ul className="my-2 pl-6 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-6 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="my-1">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-3 border-emblem-primary my-3 pl-4 text-emblem-muted">{children}</blockquote>,
  strong: ({ children }) => <strong className="text-emblem-secondary font-semibold">{children}</strong>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emblem-primary underline hover:text-emblem-secondary transition-colors">{children}</a>,
  img: ({ src, alt }) => <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg my-2" />,
};

// Import EmotionContext from types
import type { EmotionContext } from '@/lib/types';

interface ChatProps {
  sessionId: string | undefined;
  onSessionChange?: (sessionId: string) => void;
  onResponse?: (response: ChatResponse) => void;
  onStanceUpdate?: (stance: Stance) => void;
  onPanelChange?: (panel: 'stance' | 'config' | 'timeline' | 'evolution' | 'sessions' | 'memories') => void;
  onNewSession?: () => void;
  stance?: Stance | null;
  config?: ModeConfig | null;
  emotionContext?: EmotionContext | null;
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

export default function Chat({ sessionId, onSessionChange, onResponse, onStanceUpdate, onPanelChange, onNewSession, stance, config, emotionContext }: ChatProps) {
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

  // Input history with localStorage persistence
  const { history: inputHistory, addToHistory } = useInputHistory();
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedInputRef = useRef<string>('');

  // Load messages from localStorage when session changes
  useEffect(() => {
    if (sessionId) {
      const stored = getMessages(sessionId);
      if (stored.length > 0) {
        setMessages(stored as ChatMessage[]);
      } else {
        setMessages([]);
      }
      // Save last active session
      saveLastSessionId(sessionId);
    }
  }, [sessionId]);

  // Persist messages to localStorage when they change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      // Strip out non-serializable data before saving
      const toSave = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp ?? Date.now(),
        type: m.type,
        commandData: m.commandData,
        // Don't save tools - they can be complex objects
      }));
      saveMessages(sessionId, toSave);
    }
  }, [sessionId, messages]);

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

      // Check if this is a plugin command
      if (cmd && isPluginCommand(cmd)) {
        const result = await executePluginCommand(cmd, args);
        data = result.message || (result.success ? 'Command executed successfully' : 'Command failed');
      } else {
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

        case 'new':
        case 'clear':
          if (onNewSession) {
            onNewSession();
            setMessages([]);
            data = 'Started new session.';
          } else {
            data = 'New session creation not available.';
          }
          break;

        default:
          // For commands not yet implemented, show a placeholder
          data = `Command /${fullCommand} acknowledged. Full implementation coming soon.`;
        }
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
  }, [sessionId, stance, config, onPanelChange, onNewSession]);

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

    // Add to input history (persisted to localStorage)
    if (trimmedInput) {
      addToHistory(trimmedInput);
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

    abortRef.current = chatStream(sessionId, userMessage.content, emotionContext, {
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
  }, [input, isLoading, sessionId, onResponse, onStanceUpdate, onSessionChange, executeCommand, addToHistory, emotionContext]);

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

  const statusColor = connectionStatus === 'connected' ? 'bg-emblem-accent'
    : connectionStatus === 'streaming' ? 'bg-blue-500'
    : 'bg-emblem-danger';

  const statusText = connectionStatus === 'connected' ? 'Connected'
    : connectionStatus === 'streaming' ? 'Streaming...'
    : 'Reconnecting...';

  return (
    <div className="flex flex-col h-full min-h-0 glass-panel overflow-hidden relative">
      {/* Floating status indicator - positioned above input */}
      <div className="absolute bottom-[72px] right-4 flex items-center gap-1.5 px-2.5 py-1 bg-emblem-surface/95 border border-white/10 rounded-full text-[11px] z-50 backdrop-blur-lg">
        <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', statusColor)} />
        <span className="text-emblem-muted">{statusText}</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 min-h-0 scrollbar-styled">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4 text-emblem-muted">
            <h2 className="text-3xl font-display font-bold gradient-text mb-2">METAMORPH</h2>
            <p className="mb-2">Transformation-maximizing AI interface</p>
            <p className="text-sm opacity-70">
              Type a message or <code className="bg-emblem-secondary/20 px-1.5 py-0.5 rounded font-mono text-emblem-secondary">/</code> for commands
            </p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.timestamp}-${i}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                'max-w-[80%] p-3 rounded-xl leading-relaxed overflow-hidden min-w-0 flex-shrink-0',
                msg.role === 'user' && !msg.type && 'self-end bg-gradient-to-r from-emblem-secondary to-emblem-primary text-white',
                msg.role === 'assistant' && 'self-start glass-card',
                msg.type === 'command' && 'max-w-full',
                msg.type === 'command' && msg.role === 'user' && 'bg-transparent text-emblem-text'
              )}
            >
            <div className="break-words prose-chat overflow-hidden w-0 min-w-full">
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
                  <ReactMarkdown components={markdownComponents}>
                    {msg.content}
                  </ReactMarkdown>
                </>
              ) : msg.content.startsWith('/') ? (
                <code className="block font-mono text-[0.95em] text-emblem-secondary bg-emblem-secondary/10 px-3 py-2 rounded-md border-l-3 border-emblem-secondary">
                  {msg.content}
                </code>
              ) : (
                msg.content
              )}
            </div>
          </motion.div>
          ))}
        </AnimatePresence>
        {/* Show active tools during streaming */}
        <AnimatePresence>
          {activeTools.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="self-start glass-card max-w-[80%] p-3 rounded-xl overflow-hidden min-w-0 flex-shrink-0"
            >
              <div className="break-words overflow-hidden w-0 min-w-full">
                <ActiveToolsBar tools={activeTools} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {streamingText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="self-start glass-card max-w-[80%] p-3 rounded-xl overflow-hidden min-w-0 flex-shrink-0"
            >
              <div className="break-words prose-chat overflow-hidden w-0 min-w-full">
                <ReactMarkdown components={markdownComponents}>{streamingText}</ReactMarkdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isLoading && !streamingText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="self-start glass-card p-3 rounded-xl"
            >
              <div className="flex gap-1">
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  className="w-2 h-2 bg-emblem-secondary rounded-full"
                />
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                  className="w-2 h-2 bg-emblem-secondary rounded-full"
                />
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                  className="w-2 h-2 bg-emblem-secondary rounded-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="relative">
        <CommandPalette
          input={input}
          visible={showPalette}
          onSelect={handleCommandSelect}
          onClose={() => setShowPalette(false)}
          selectedIndex={paletteIndex}
          onIndexChange={setPaletteIndex}
        />
        <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-emblem-surface-2 border-t border-white/5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or / for commands..."
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-3 bg-emblem-surface border border-white/10 rounded-lg text-emblem-text text-base outline-none transition-colors',
              'focus:border-emblem-secondary',
              'disabled:opacity-50',
              input.startsWith('/') && 'font-mono border-emblem-secondary bg-emblem-secondary/5'
            )}
          />
          {isLoading ? (
            <Button variant="destructive" type="button" onClick={handleStop} className="px-6">
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} className="px-6">
              Send
            </Button>
          )}
        </form>
      </div>

      {/* Help dialog */}
      {showHelp && <CommandHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
