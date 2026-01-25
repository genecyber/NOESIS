/**
 * Tests for REST API Server
 */

import { describe, it, expect } from 'vitest';
import { app } from '../server/index.js';
import request from 'supertest';

// Note: These are unit tests for route definitions
// Full integration tests would require running the server
// EMBLEM_DEV_MODE=true is set in vitest.config.ts for auth bypass

// Test vault ID for multitenancy testing
const TEST_VAULT_ID = 'test-vault';

/**
 * Helper to add auth headers to requests
 * In dev mode, uses X-Vault-Id header for vault identification
 */
function withAuth(req: request.Test): request.Test {
  return req.set('X-Vault-Id', TEST_VAULT_ID);
}

describe('Server', () => {
  describe('Health Check', () => {
    it('returns ok status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.version).toBe('0.1.0');
    });
  });

  describe('API Info', () => {
    it('returns API documentation', async () => {
      const response = await withAuth(request(app).get('/api'));
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('METAMORPH API');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('creates a new session', async () => {
      const response = await withAuth(request(app)
        .post('/api/session')
        .send({}));

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.stance).toBeDefined();
      expect(response.body.config).toBeDefined();
    });

    it('creates session with custom config', async () => {
      const response = await withAuth(request(app)
        .post('/api/session')
        .send({
          config: {
            intensity: 80,
            coherenceFloor: 40
          }
        }));

      expect(response.status).toBe(200);
      expect(response.body.config.intensity).toBe(80);
      expect(response.body.config.coherenceFloor).toBe(40);
    });
  });

  describe('State Endpoint', () => {
    it('returns current state', async () => {
      // First create a session
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      // Then get state
      const response = await withAuth(request(app)
        .get(`/api/state?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.stance).toBeDefined();
      expect(response.body.config).toBeDefined();
    });
  });

  describe('Config Endpoint', () => {
    it('updates configuration', async () => {
      // First create a session
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      // Update config
      const response = await withAuth(request(app)
        .put('/api/config')
        .send({
          sessionId,
          config: { intensity: 90 }
        }));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.config.intensity).toBe(90);
    });

    it('returns error without config', async () => {
      const response = await withAuth(request(app)
        .put('/api/config')
        .send({}));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Config is required');
    });
  });

  describe('Identity Endpoint', () => {
    it('returns identity information', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/identity?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.frame).toBeDefined();
      expect(response.body.selfModel).toBeDefined();
      expect(response.body.sentience).toBeDefined();
    });
  });

  describe('Subagents Endpoint', () => {
    it('lists available subagents', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/subagents?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.subagents).toHaveLength(4);
      expect(response.body.subagents.map((s: { name: string }) => s.name)).toContain('explorer');
      expect(response.body.subagents.map((s: { name: string }) => s.name)).toContain('verifier');
    });
  });

  describe('History Endpoint', () => {
    it('returns empty history for new session', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/history?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
      expect(response.body.messages).toHaveLength(0);
    });
  });

  describe('Chat Endpoint', () => {
    it('returns error without message', async () => {
      const response = await withAuth(request(app)
        .post('/api/chat')
        .send({}));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message is required');
    });
  });

  describe('Export/Import', () => {
    it('exports session state', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/export?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.state).toBeDefined();
    });
  });

  // New tests for v0.5.0 features
  describe('Timeline Endpoint', () => {
    it('returns empty timeline for new session', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/timeline?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeDefined();
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('respects limit parameter', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/timeline?sessionId=${sessionId}&limit=5`));

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeDefined();
    });
  });

  describe('Evolution Endpoint', () => {
    it('returns evolution snapshots for session', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/evolution?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.snapshots).toBeDefined();
      expect(Array.isArray(response.body.snapshots)).toBe(true);
    });

    it('respects limit parameter', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/evolution?sessionId=${sessionId}&limit=10`));

      expect(response.status).toBe(200);
      expect(response.body.snapshots).toBeDefined();
    });
  });

  describe('Memories Endpoint', () => {
    it('returns memories for session', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/memories?sessionId=${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.memories).toBeDefined();
      expect(Array.isArray(response.body.memories)).toBe(true);
    });

    it('filters by memory type', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .get(`/api/memories?sessionId=${sessionId}&type=episodic`));

      expect(response.status).toBe(200);
      expect(response.body.memories).toBeDefined();
    });
  });

  describe('Sessions List Endpoint', () => {
    it('returns list of all sessions', async () => {
      // Create a session first
      await withAuth(request(app).post('/api/session').send({}));

      const response = await withAuth(request(app).get('/api/sessions'));

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeDefined();
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);
    });

    it('includes session metadata', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));

      const response = await withAuth(request(app).get('/api/sessions'));

      expect(response.status).toBe(200);
      const createdSession = response.body.sessions.find(
        (s: { id: string }) => s.id === session.body.sessionId
      );
      expect(createdSession).toBeDefined();
      // SessionInfo has currentFrame and currentDrift instead of full stance
      expect(createdSession.currentFrame).toBeDefined();
      expect(createdSession.messageCount).toBeDefined();
    });
  });

  describe('Session Deletion Endpoint', () => {
    it('deletes existing session', async () => {
      const session = await withAuth(request(app).post('/api/session').send({}));
      const sessionId = session.body.sessionId;

      const response = await withAuth(request(app)
        .delete(`/api/session/${sessionId}`));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('returns 404 for non-existent session', async () => {
      const response = await withAuth(request(app)
        .delete('/api/session/non-existent-id'));

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('Streaming Endpoint Validation', () => {
    it('returns error without message for GET stream', async () => {
      const response = await withAuth(request(app)
        .get('/api/chat/stream'));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message query parameter is required');
    });

    it('returns error without message for POST stream', async () => {
      const response = await withAuth(request(app)
        .post('/api/chat/stream')
        .send({}));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message is required');
    });
  });
});
