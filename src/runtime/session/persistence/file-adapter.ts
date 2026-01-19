/**
 * FileAdapter - File-based session persistence
 *
 * Stores session state as JSON files on disk.
 * Provides durability across process restarts.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { PersistenceAdapter, SessionListOptions } from './adapter.js';
import { SessionState, SessionInfo } from '../session.js';

export interface FileAdapterOptions {
  /** Directory to store session files */
  dataDir?: string;
  /** File extension for session files */
  extension?: string;
}

export class FileAdapter implements PersistenceAdapter {
  private dataDir: string;
  private extension: string;
  private initialized: boolean = false;

  constructor(options: FileAdapterOptions = {}) {
    this.dataDir = options.dataDir ?? './data/sessions';
    this.extension = options.extension ?? '.json';
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      // Directory might already exist
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      this.initialized = true;
    }
  }

  /**
   * Get file path for a session ID
   */
  private getPath(id: string): string {
    return join(this.dataDir, `${id}${this.extension}`);
  }

  /**
   * Save a session state to disk
   */
  async save(state: SessionState): Promise<void> {
    await this.ensureDir();

    const path = this.getPath(state.id);
    const data = JSON.stringify(state, null, 2);

    // Write to temp file first, then rename for atomicity
    const tempPath = `${path}.tmp`;
    await fs.writeFile(tempPath, data, 'utf-8');
    await fs.rename(tempPath, path);
  }

  /**
   * Load a session state from disk
   */
  async load(id: string): Promise<SessionState | null> {
    await this.ensureDir();

    const path = this.getPath(id);

    try {
      const data = await fs.readFile(path, 'utf-8');
      const state = JSON.parse(data) as SessionState;

      // Convert date strings back to Date objects
      state.createdAt = state.createdAt;
      state.lastActivity = state.lastActivity;

      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a session from disk
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureDir();

    const path = this.getPath(id);

    try {
      await fs.unlink(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all sessions from disk
   */
  async list(options: SessionListOptions = {}): Promise<SessionInfo[]> {
    await this.ensureDir();

    const { limit = 50, offset = 0, orderBy = 'lastActivity', orderDir = 'desc' } = options;

    try {
      const files = await fs.readdir(this.dataDir);
      const sessionFiles = files.filter(f => f.endsWith(this.extension));

      const sessions: SessionInfo[] = [];

      for (const file of sessionFiles) {
        const path = join(this.dataDir, file);
        try {
          const data = await fs.readFile(path, 'utf-8');
          const state = JSON.parse(data) as SessionState;

          sessions.push({
            id: state.id,
            name: state.name,
            createdAt: new Date(state.createdAt),
            lastActivity: new Date(state.lastActivity),
            messageCount: state.messageCount,
            currentFrame: state.stance?.frame,
            currentDrift: state.stance?.cumulativeDrift,
            metadata: state.metadata
          });
        } catch {
          // Skip corrupted files
          console.warn(`[FileAdapter] Skipping corrupted session file: ${file}`);
        }
      }

      // Sort and paginate
      sessions.sort((a, b) => {
        const aVal = a[orderBy].getTime();
        const bVal = b[orderBy].getTime();
        return orderDir === 'desc' ? bVal - aVal : aVal - bVal;
      });

      return sessions.slice(offset, offset + limit);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a session exists on disk
   */
  async exists(id: string): Promise<boolean> {
    await this.ensureDir();

    const path = this.getPath(id);

    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update session metadata
   */
  async updateMetadata(id: string, updates: Partial<SessionState>): Promise<void> {
    const existing = await this.load(id);
    if (existing) {
      await this.save({ ...existing, ...updates });
    }
  }

  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Export all sessions for backup
   */
  async exportAll(): Promise<SessionState[]> {
    await this.ensureDir();

    const files = await fs.readdir(this.dataDir);
    const sessionFiles = files.filter(f => f.endsWith(this.extension));

    const sessions: SessionState[] = [];

    for (const file of sessionFiles) {
      const path = join(this.dataDir, file);
      try {
        const data = await fs.readFile(path, 'utf-8');
        sessions.push(JSON.parse(data) as SessionState);
      } catch {
        // Skip corrupted files
      }
    }

    return sessions;
  }

  /**
   * Import sessions from backup
   */
  async importAll(sessions: SessionState[]): Promise<number> {
    let imported = 0;

    for (const session of sessions) {
      try {
        await this.save(session);
        imported++;
      } catch (error) {
        console.warn(`[FileAdapter] Failed to import session ${session.id}:`, error);
      }
    }

    return imported;
  }
}
