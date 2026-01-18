/**
 * Real-Time Collaborative Sessions - Ralph Iteration 5 Feature 3
 *
 * Enables multiple participants in conversations with real-time sync,
 * presence indicators, and collaborative transformation voting.
 */

import { v4 as uuidv4 } from 'uuid';
import { Stance, ConversationMessage } from '../types/index.js';

/**
 * Participant in a collaborative session
 */
export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'participant' | 'observer';
  joinedAt: Date;
  lastActive: Date;
  isOnline: boolean;
  cursorPosition?: number;  // For typing indicators
}

/**
 * Collaborative session state
 */
export interface CollaborativeSession {
  id: string;
  code: string;  // Short join code
  name: string;
  host: Participant;
  participants: Map<string, Participant>;
  mode: 'turn-taking' | 'free-form';
  currentSpeaker?: string;  // Participant ID in turn-taking mode
  speakerQueue: string[];
  messages: CollaborativeMessage[];
  stance: Stance;
  isRecording: boolean;
  recording?: SessionRecording;
  createdAt: Date;
  config: CollaborationConfig;
}

/**
 * Message with participant attribution
 */
export interface CollaborativeMessage extends ConversationMessage {
  participantId: string;
  participantName: string;
  votes?: TransformVote[];
  isAgentResponse: boolean;
}

/**
 * Vote for transformation operator
 */
export interface TransformVote {
  participantId: string;
  operatorName: string;
  weight: number;  // Based on participant role
}

/**
 * Session recording for playback
 */
export interface SessionRecording {
  sessionId: string;
  events: RecordingEvent[];
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
}

/**
 * Recorded event for playback
 */
export interface RecordingEvent {
  type: 'message' | 'join' | 'leave' | 'stance_change' | 'vote' | 'speaker_change';
  timestamp: Date;
  participantId?: string;
  data: unknown;
}

/**
 * Session configuration
 */
export interface CollaborationConfig {
  maxParticipants: number;
  allowObservers: boolean;
  votingEnabled: boolean;
  votingThreshold: number;  // Percentage needed to apply transformation
  turnTimeout: number;  // Seconds before turn auto-passes (0 = no timeout)
  autoRecord: boolean;
}

/**
 * Session event for WebSocket broadcasting
 */
export interface SessionEvent {
  type: 'participant_joined' | 'participant_left' | 'message' | 'stance_update' |
        'vote_cast' | 'speaker_changed' | 'session_ended' | 'typing';
  sessionId: string;
  participantId?: string;
  data: unknown;
  timestamp: Date;
}

const DEFAULT_CONFIG: CollaborationConfig = {
  maxParticipants: 10,
  allowObservers: true,
  votingEnabled: true,
  votingThreshold: 50,
  turnTimeout: 0,
  autoRecord: false
};

/**
 * Generate short join code
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Collaborative Session Manager
 */
class CollaborativeSessionManager {
  private sessions: Map<string, CollaborativeSession> = new Map();
  private codeToSession: Map<string, string> = new Map();  // code -> session ID
  private eventListeners: Map<string, Array<(event: SessionEvent) => void>> = new Map();
  private defaultConfig: CollaborationConfig = DEFAULT_CONFIG;

  /**
   * Set default configuration
   */
  setDefaultConfig(config: Partial<CollaborationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Create a new collaborative session
   */
  createSession(
    hostName: string,
    stance: Stance,
    options: {
      name?: string;
      mode?: 'turn-taking' | 'free-form';
      config?: Partial<CollaborationConfig>;
    } = {}
  ): { session: CollaborativeSession; hostId: string } {
    const sessionId = uuidv4();
    const hostId = uuidv4();
    const code = generateJoinCode();

    const host: Participant = {
      id: hostId,
      name: hostName,
      role: 'host',
      joinedAt: new Date(),
      lastActive: new Date(),
      isOnline: true
    };

    const session: CollaborativeSession = {
      id: sessionId,
      code,
      name: options.name || `Session ${code}`,
      host,
      participants: new Map([[hostId, host]]),
      mode: options.mode || 'free-form',
      speakerQueue: [],
      messages: [],
      stance,
      isRecording: options.config?.autoRecord ?? this.defaultConfig.autoRecord,
      createdAt: new Date(),
      config: { ...this.defaultConfig, ...options.config }
    };

    // Initialize recording if enabled
    if (session.isRecording) {
      session.recording = {
        sessionId,
        events: [],
        startTime: new Date()
      };
    }

    this.sessions.set(sessionId, session);
    this.codeToSession.set(code, sessionId);

    return { session, hostId };
  }

  /**
   * Join a session by code
   */
  joinSession(
    code: string,
    participantName: string,
    asObserver: boolean = false
  ): { session: CollaborativeSession; participantId: string } | null {
    const sessionId = this.codeToSession.get(code.toUpperCase());
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check capacity
    if (session.participants.size >= session.config.maxParticipants) {
      throw new Error('Session is full');
    }

    // Check observer permission
    if (asObserver && !session.config.allowObservers) {
      throw new Error('This session does not allow observers');
    }

    const participantId = uuidv4();
    const participant: Participant = {
      id: participantId,
      name: participantName,
      role: asObserver ? 'observer' : 'participant',
      joinedAt: new Date(),
      lastActive: new Date(),
      isOnline: true
    };

    session.participants.set(participantId, participant);

    // Record event
    this.recordEvent(session, {
      type: 'join',
      timestamp: new Date(),
      participantId,
      data: { name: participantName, role: participant.role }
    });

    // Broadcast join
    this.broadcastEvent(session.id, {
      type: 'participant_joined',
      sessionId: session.id,
      participantId,
      data: participant,
      timestamp: new Date()
    });

    return { session, participantId };
  }

  /**
   * Leave a session
   */
  leaveSession(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.get(participantId);
    if (!participant) return false;

    // Remove from queue if present
    session.speakerQueue = session.speakerQueue.filter(id => id !== participantId);

    // If current speaker, pass turn
    if (session.currentSpeaker === participantId) {
      this.passTurn(sessionId);
    }

    session.participants.delete(participantId);

    // Record event
    this.recordEvent(session, {
      type: 'leave',
      timestamp: new Date(),
      participantId,
      data: { name: participant.name }
    });

    // Broadcast leave
    this.broadcastEvent(session.id, {
      type: 'participant_left',
      sessionId: session.id,
      participantId,
      data: { name: participant.name },
      timestamp: new Date()
    });

    // If host left and session is empty, end it
    if (participant.role === 'host' && session.participants.size === 0) {
      this.endSession(sessionId);
    }

    return true;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborativeSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session by code
   */
  getSessionByCode(code: string): CollaborativeSession | null {
    const sessionId = this.codeToSession.get(code.toUpperCase());
    return sessionId ? this.sessions.get(sessionId) || null : null;
  }

  /**
   * Add a message to the session
   */
  addMessage(
    sessionId: string,
    participantId: string,
    content: string,
    isAgentResponse: boolean = false
  ): CollaborativeMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const participant = session.participants.get(participantId);
    if (!participant) return null;

    // In turn-taking mode, check if it's this participant's turn
    if (session.mode === 'turn-taking' && !isAgentResponse) {
      if (session.currentSpeaker && session.currentSpeaker !== participantId) {
        throw new Error('Not your turn to speak');
      }
    }

    const message: CollaborativeMessage = {
      role: isAgentResponse ? 'assistant' : 'user',
      content,
      timestamp: new Date(),
      participantId,
      participantName: participant.name,
      isAgentResponse
    };

    session.messages.push(message);
    participant.lastActive = new Date();

    // Record event
    this.recordEvent(session, {
      type: 'message',
      timestamp: new Date(),
      participantId,
      data: { content, isAgentResponse }
    });

    // Broadcast message
    this.broadcastEvent(session.id, {
      type: 'message',
      sessionId: session.id,
      participantId,
      data: message,
      timestamp: new Date()
    });

    return message;
  }

  /**
   * Update session stance
   */
  updateStance(sessionId: string, stance: Stance): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.stance = stance;

    // Record event
    this.recordEvent(session, {
      type: 'stance_change',
      timestamp: new Date(),
      data: stance
    });

    // Broadcast stance update
    this.broadcastEvent(session.id, {
      type: 'stance_update',
      sessionId: session.id,
      data: stance,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Cast a vote for transformation operator
   */
  castVote(
    sessionId: string,
    participantId: string,
    operatorName: string
  ): { accepted: boolean; votes: TransformVote[] } | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.config.votingEnabled) return null;

    const participant = session.participants.get(participantId);
    if (!participant || participant.role === 'observer') return null;

    // Get or create votes array for current turn
    const currentMessage = session.messages[session.messages.length - 1];
    if (!currentMessage || currentMessage.isAgentResponse) return null;

    if (!currentMessage.votes) {
      currentMessage.votes = [];
    }

    // Calculate weight based on role
    const weight = participant.role === 'host' ? 2 : 1;

    // Remove previous vote from this participant
    currentMessage.votes = currentMessage.votes.filter(v => v.participantId !== participantId);

    // Add new vote
    const vote: TransformVote = { participantId, operatorName, weight };
    currentMessage.votes.push(vote);

    // Record event
    this.recordEvent(session, {
      type: 'vote',
      timestamp: new Date(),
      participantId,
      data: { operatorName, weight }
    });

    // Broadcast vote
    this.broadcastEvent(session.id, {
      type: 'vote_cast',
      sessionId: session.id,
      participantId,
      data: vote,
      timestamp: new Date()
    });

    // Check if threshold is met
    const totalWeight = currentMessage.votes.reduce((sum, v) => sum + v.weight, 0);
    const participantCount = Array.from(session.participants.values())
      .filter(p => p.role !== 'observer').length;
    const maxWeight = participantCount + 1;  // +1 for host weight bonus

    const percentage = (totalWeight / maxWeight) * 100;
    const accepted = percentage >= session.config.votingThreshold;

    return { accepted, votes: currentMessage.votes };
  }

  /**
   * Get winning operator from votes
   */
  getWinningOperator(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const currentMessage = session.messages[session.messages.length - 1];
    if (!currentMessage?.votes || currentMessage.votes.length === 0) return null;

    // Count weighted votes per operator
    const voteCounts = new Map<string, number>();
    for (const vote of currentMessage.votes) {
      const current = voteCounts.get(vote.operatorName) || 0;
      voteCounts.set(vote.operatorName, current + vote.weight);
    }

    // Find operator with most votes
    let winner: string | null = null;
    let maxVotes = 0;
    for (const [operator, votes] of voteCounts) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = operator;
      }
    }

    return winner;
  }

  /**
   * Request turn in turn-taking mode
   */
  requestTurn(sessionId: string, participantId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session || session.mode !== 'turn-taking') return -1;

    const participant = session.participants.get(participantId);
    if (!participant || participant.role === 'observer') return -1;

    if (!session.speakerQueue.includes(participantId)) {
      session.speakerQueue.push(participantId);
    }

    // If no current speaker, give turn to first in queue
    if (!session.currentSpeaker && session.speakerQueue.length > 0) {
      session.currentSpeaker = session.speakerQueue.shift();
      this.broadcastSpeakerChange(session);
    }

    return session.speakerQueue.indexOf(participantId) + 1;  // 1-indexed position
  }

  /**
   * Pass turn to next in queue
   */
  passTurn(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.mode !== 'turn-taking') return false;

    if (session.speakerQueue.length > 0) {
      session.currentSpeaker = session.speakerQueue.shift();
    } else {
      session.currentSpeaker = undefined;
    }

    this.broadcastSpeakerChange(session);

    // Record event
    this.recordEvent(session, {
      type: 'speaker_change',
      timestamp: new Date(),
      data: { newSpeaker: session.currentSpeaker }
    });

    return true;
  }

  /**
   * Broadcast speaker change
   */
  private broadcastSpeakerChange(session: CollaborativeSession): void {
    const speaker = session.currentSpeaker
      ? session.participants.get(session.currentSpeaker)
      : null;

    this.broadcastEvent(session.id, {
      type: 'speaker_changed',
      sessionId: session.id,
      participantId: session.currentSpeaker,
      data: {
        speakerId: session.currentSpeaker,
        speakerName: speaker?.name,
        queueLength: session.speakerQueue.length
      },
      timestamp: new Date()
    });
  }

  /**
   * Start recording session
   */
  startRecording(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.isRecording) return false;

    session.isRecording = true;
    session.recording = {
      sessionId,
      events: [],
      startTime: new Date()
    };

    return true;
  }

  /**
   * Stop recording session
   */
  stopRecording(sessionId: string): SessionRecording | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRecording || !session.recording) return null;

    session.isRecording = false;
    session.recording.endTime = new Date();
    session.recording.totalDuration =
      session.recording.endTime.getTime() - session.recording.startTime.getTime();

    return session.recording;
  }

  /**
   * Record an event
   */
  private recordEvent(session: CollaborativeSession, event: RecordingEvent): void {
    if (session.isRecording && session.recording) {
      session.recording.events.push(event);
    }
  }

  /**
   * End a session
   */
  endSession(sessionId: string): SessionRecording | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Stop recording if active
    let recording: SessionRecording | null = null;
    if (session.isRecording) {
      recording = this.stopRecording(sessionId);
    }

    // Broadcast session ended
    this.broadcastEvent(session.id, {
      type: 'session_ended',
      sessionId: session.id,
      data: { endedAt: new Date() },
      timestamp: new Date()
    });

    // Clean up
    this.codeToSession.delete(session.code);
    this.sessions.delete(sessionId);
    this.eventListeners.delete(sessionId);

    return recording;
  }

  /**
   * Subscribe to session events
   */
  subscribe(sessionId: string, listener: (event: SessionEvent) => void): () => void {
    if (!this.eventListeners.has(sessionId)) {
      this.eventListeners.set(sessionId, []);
    }
    this.eventListeners.get(sessionId)!.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(sessionId);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Broadcast event to all listeners
   */
  private broadcastEvent(sessionId: string, event: SessionEvent): void {
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      }
    }
  }

  /**
   * Update participant typing status
   */
  setTypingStatus(sessionId: string, participantId: string, isTyping: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    participant.lastActive = new Date();

    this.broadcastEvent(session.id, {
      type: 'typing',
      sessionId: session.id,
      participantId,
      data: { isTyping, name: participant.name },
      timestamp: new Date()
    });
  }

  /**
   * Get all active sessions
   */
  listSessions(): Array<{
    id: string;
    code: string;
    name: string;
    participantCount: number;
    mode: string;
    createdAt: Date;
  }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      participantCount: s.participants.size,
      mode: s.mode,
      createdAt: s.createdAt
    }));
  }

  /**
   * Get session participants
   */
  getParticipants(sessionId: string): Participant[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.participants.values());
  }

  /**
   * Get session status
   */
  getStatus(): {
    activeSessions: number;
    totalParticipants: number;
    recordingSessions: number;
  } {
    let totalParticipants = 0;
    let recordingSessions = 0;

    for (const session of this.sessions.values()) {
      totalParticipants += session.participants.size;
      if (session.isRecording) recordingSessions++;
    }

    return {
      activeSessions: this.sessions.size,
      totalParticipants,
      recordingSessions
    };
  }
}

// Singleton instance
export const collaborationManager = new CollaborativeSessionManager();
