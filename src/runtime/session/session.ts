/**
 * Session interface for unified runtime
 */

import { MetamorphAgent } from '../../agent/index.js';
import { Stance, ModeConfig } from '../../types/index.js';

/**
 * Session represents a single conversation/interaction context
 */
export interface Session {
  id: string;
  agent: MetamorphAgent;
  createdAt: Date;
  lastActivity: Date;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * SessionInfo for listing sessions (without full agent)
 */
export interface SessionInfo {
  id: string;
  name?: string;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  currentFrame?: string;
  currentDrift?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  id?: string;  // Optional custom ID
  name?: string;
  config?: Partial<ModeConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * Session state that can be persisted/restored
 */
export interface SessionState {
  id: string;
  name?: string;
  createdAt: string;  // ISO date
  lastActivity: string;  // ISO date
  stance: Stance;
  config: ModeConfig;
  messageCount: number;
  metadata?: Record<string, unknown>;
}

// Re-export for convenience
export type { MetamorphAgent } from '../../agent/index.js';
export type { Stance, ModeConfig } from '../../types/index.js';
