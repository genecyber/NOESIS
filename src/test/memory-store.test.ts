/**
 * Tests for MemoryStore - Session and Evolution Persistence
 * Ralph Iteration 2 - Feature 4: Enhanced Test Coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../memory/store.js';
import { createDefaultStance } from '../types/index.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ inMemory: true });
  });

  afterEach(() => {
    store.close();
  });

  describe('Session Management (Ralph Iteration 2 - Feature 2)', () => {
    it('saves and retrieves session', () => {
      store.saveSession({
        id: 'test-session-1',
        name: 'My Test Session',
        messageCount: 5,
        currentFrame: 'poetic',
        currentDrift: 25
      });

      const session = store.getSessionInfo('test-session-1');
      expect(session).not.toBeNull();
      expect(session!.name).toBe('My Test Session');
      expect(session!.messageCount).toBe(5);
      expect(session!.currentFrame).toBe('poetic');
      expect(session!.currentDrift).toBe(25);
    });

    it('updates existing session', () => {
      store.saveSession({
        id: 'test-session-1',
        name: 'Original Name'
      });

      store.saveSession({
        id: 'test-session-1',
        name: 'Updated Name',
        messageCount: 10
      });

      const session = store.getSessionInfo('test-session-1');
      expect(session!.name).toBe('Updated Name');
      expect(session!.messageCount).toBe(10);
    });

    it('lists sessions ordered by last accessed', () => {
      store.saveSession({ id: 'session-1', name: 'First' });
      store.saveSession({ id: 'session-2', name: 'Second' });
      store.saveSession({ id: 'session-3', name: 'Third' });

      // Access session-1 again to make it most recent
      store.saveSession({ id: 'session-1', messageCount: 1 });

      const sessions = store.listSessions();
      expect(sessions.length).toBe(3);
      expect(sessions[0].id).toBe('session-1'); // Most recently accessed
    });

    it('searches sessions by name', () => {
      store.saveSession({ id: 'session-1', name: 'Project Alpha' });
      store.saveSession({ id: 'session-2', name: 'Project Beta' });
      store.saveSession({ id: 'session-3', name: 'Work Meeting' });

      const results = store.listSessions({ search: 'Project' });
      expect(results.length).toBe(2);
      expect(results.some(s => s.name === 'Project Alpha')).toBe(true);
      expect(results.some(s => s.name === 'Project Beta')).toBe(true);
    });

    it('renames session', () => {
      store.saveSession({ id: 'test-session', name: 'Old Name' });

      const renamed = store.renameSession('test-session', 'New Name');
      expect(renamed).toBe(true);

      const session = store.getSessionInfo('test-session');
      expect(session!.name).toBe('New Name');
    });

    it('deletes session', () => {
      store.saveSession({ id: 'to-delete', name: 'Delete Me' });

      const deleted = store.deleteSession('to-delete');
      expect(deleted).toBe(true);

      const session = store.getSessionInfo('to-delete');
      expect(session).toBeNull();
    });

    it('gets most recent session', async () => {
      store.saveSession({ id: 'old-session', name: 'Old' });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      store.saveSession({ id: 'new-session', name: 'New' });

      const mostRecent = store.getMostRecentSession();
      expect(mostRecent).not.toBeNull();
      expect(mostRecent!.id).toBe('new-session');
    });

    it('limits session list', () => {
      for (let i = 0; i < 20; i++) {
        store.saveSession({ id: `session-${i}`, name: `Session ${i}` });
      }

      const limited = store.listSessions({ limit: 5 });
      expect(limited.length).toBe(5);
    });
  });

  describe('Evolution Snapshots', () => {
    const testConvId = 'test-conv-1';
    const testStance = createDefaultStance();

    it('saves evolution snapshot', () => {
      const id = store.saveEvolutionSnapshot(testConvId, testStance, 'manual');
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('retrieves latest snapshot', async () => {
      store.saveEvolutionSnapshot(testConvId, { ...testStance, frame: 'poetic' }, 'frame_shift');
      await new Promise(r => setTimeout(r, 10));
      store.saveEvolutionSnapshot(testConvId, { ...testStance, frame: 'mythic' }, 'frame_shift');

      const latest = store.getLatestSnapshot(testConvId);
      expect(latest).not.toBeNull();
      expect(latest!.stance.frame).toBe('mythic');
      expect(latest!.trigger).toBe('frame_shift');
    });

    it('gets evolution timeline', async () => {
      store.saveEvolutionSnapshot(testConvId, { ...testStance, cumulativeDrift: 10 }, 'drift_threshold');
      await new Promise(r => setTimeout(r, 10));
      store.saveEvolutionSnapshot(testConvId, { ...testStance, cumulativeDrift: 20 }, 'drift_threshold');
      await new Promise(r => setTimeout(r, 10));
      store.saveEvolutionSnapshot(testConvId, { ...testStance, cumulativeDrift: 30 }, 'drift_threshold');

      const timeline = store.getEvolutionTimeline(testConvId);
      expect(timeline.length).toBe(3);
      // Most recent first
      expect(timeline[0].driftAtSnapshot).toBe(30);
    });

    it('detects when auto snapshot needed', () => {
      store.saveEvolutionSnapshot(testConvId, { ...testStance, cumulativeDrift: 10 }, 'manual');

      // Drift increased by 15, threshold is 20
      expect(store.shouldAutoSnapshot(testConvId, 25, 20)).toBe(false);

      // Drift increased by 25, threshold is 20
      expect(store.shouldAutoSnapshot(testConvId, 35, 20)).toBe(true);
    });

    it('gets global latest snapshot', async () => {
      store.saveEvolutionSnapshot('conv-1', testStance, 'manual');
      await new Promise(r => setTimeout(r, 10));
      store.saveEvolutionSnapshot('conv-2', { ...testStance, frame: 'poetic' }, 'manual');

      const global = store.getGlobalLatestSnapshot();
      expect(global).not.toBeNull();
      expect(global!.conversationId).toBe('conv-2');
      expect(global!.stance.frame).toBe('poetic');
    });
  });

  describe('Semantic Memory', () => {
    it('adds and retrieves memory', () => {
      const id = store.addMemorySync({
        type: 'semantic',
        content: 'Test memory content',
        importance: 0.8,
        decay: 0.99,
        timestamp: new Date(),
        metadata: { source: 'test' }
      });

      const memory = store.getMemory(id);
      expect(memory).not.toBeNull();
      expect(memory!.content).toBe('Test memory content');
      expect(memory!.importance).toBe(0.8);
    });

    it('searches memories by type', () => {
      store.addMemorySync({
        type: 'episodic',
        content: 'Episode 1',
        importance: 0.5,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      store.addMemorySync({
        type: 'semantic',
        content: 'Fact 1',
        importance: 0.7,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      const episodic = store.searchMemories({ type: 'episodic' });
      expect(episodic.length).toBe(1);
      expect(episodic[0].content).toBe('Episode 1');
    });

    it('searches memories by importance', () => {
      store.addMemorySync({
        type: 'semantic',
        content: 'Low importance',
        importance: 0.3,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      store.addMemorySync({
        type: 'semantic',
        content: 'High importance',
        importance: 0.9,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      const highImportance = store.searchMemories({ minImportance: 0.5 });
      expect(highImportance.length).toBe(1);
      expect(highImportance[0].content).toBe('High importance');
    });

    it('applies decay to memories', () => {
      const id = store.addMemorySync({
        type: 'semantic',
        content: 'Decaying memory',
        importance: 1.0,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      store.applyDecay(0.5);

      const memory = store.getMemory(id);
      expect(memory!.importance).toBe(0.5);
    });
  });

  describe('Utility', () => {
    it('clears all data', () => {
      store.saveSession({ id: 'session-1', name: 'Test' });
      store.addMemorySync({
        type: 'semantic',
        content: 'Memory',
        importance: 0.5,
        decay: 0.99,
        timestamp: new Date(),
        metadata: {}
      });

      store.clear();

      expect(store.listSessions()).toHaveLength(0);
      expect(store.searchMemories({})).toHaveLength(0);
    });
  });
});
