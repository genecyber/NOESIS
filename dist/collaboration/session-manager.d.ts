/**
 * Real-Time Collaborative Sessions - Ralph Iteration 5 Feature 3
 *
 * Enables multiple participants in conversations with real-time sync,
 * presence indicators, and collaborative transformation voting.
 */
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
    cursorPosition?: number;
}
/**
 * Collaborative session state
 */
export interface CollaborativeSession {
    id: string;
    code: string;
    name: string;
    host: Participant;
    participants: Map<string, Participant>;
    mode: 'turn-taking' | 'free-form';
    currentSpeaker?: string;
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
    weight: number;
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
    votingThreshold: number;
    turnTimeout: number;
    autoRecord: boolean;
}
/**
 * Session event for WebSocket broadcasting
 */
export interface SessionEvent {
    type: 'participant_joined' | 'participant_left' | 'message' | 'stance_update' | 'vote_cast' | 'speaker_changed' | 'session_ended' | 'typing';
    sessionId: string;
    participantId?: string;
    data: unknown;
    timestamp: Date;
}
/**
 * Collaborative Session Manager
 */
declare class CollaborativeSessionManager {
    private sessions;
    private codeToSession;
    private eventListeners;
    private defaultConfig;
    /**
     * Set default configuration
     */
    setDefaultConfig(config: Partial<CollaborationConfig>): void;
    /**
     * Create a new collaborative session
     */
    createSession(hostName: string, stance: Stance, options?: {
        name?: string;
        mode?: 'turn-taking' | 'free-form';
        config?: Partial<CollaborationConfig>;
    }): {
        session: CollaborativeSession;
        hostId: string;
    };
    /**
     * Join a session by code
     */
    joinSession(code: string, participantName: string, asObserver?: boolean): {
        session: CollaborativeSession;
        participantId: string;
    } | null;
    /**
     * Leave a session
     */
    leaveSession(sessionId: string, participantId: string): boolean;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): CollaborativeSession | null;
    /**
     * Get session by code
     */
    getSessionByCode(code: string): CollaborativeSession | null;
    /**
     * Add a message to the session
     */
    addMessage(sessionId: string, participantId: string, content: string, isAgentResponse?: boolean): CollaborativeMessage | null;
    /**
     * Update session stance
     */
    updateStance(sessionId: string, stance: Stance): boolean;
    /**
     * Cast a vote for transformation operator
     */
    castVote(sessionId: string, participantId: string, operatorName: string): {
        accepted: boolean;
        votes: TransformVote[];
    } | null;
    /**
     * Get winning operator from votes
     */
    getWinningOperator(sessionId: string): string | null;
    /**
     * Request turn in turn-taking mode
     */
    requestTurn(sessionId: string, participantId: string): number;
    /**
     * Pass turn to next in queue
     */
    passTurn(sessionId: string): boolean;
    /**
     * Broadcast speaker change
     */
    private broadcastSpeakerChange;
    /**
     * Start recording session
     */
    startRecording(sessionId: string): boolean;
    /**
     * Stop recording session
     */
    stopRecording(sessionId: string): SessionRecording | null;
    /**
     * Record an event
     */
    private recordEvent;
    /**
     * End a session
     */
    endSession(sessionId: string): SessionRecording | null;
    /**
     * Subscribe to session events
     */
    subscribe(sessionId: string, listener: (event: SessionEvent) => void): () => void;
    /**
     * Broadcast event to all listeners
     */
    private broadcastEvent;
    /**
     * Update participant typing status
     */
    setTypingStatus(sessionId: string, participantId: string, isTyping: boolean): void;
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
    }>;
    /**
     * Get session participants
     */
    getParticipants(sessionId: string): Participant[];
    /**
     * Get session status
     */
    getStatus(): {
        activeSessions: number;
        totalParticipants: number;
        recordingSessions: number;
    };
}
export declare const collaborationManager: CollaborativeSessionManager;
export {};
//# sourceMappingURL=session-manager.d.ts.map