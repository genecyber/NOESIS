/**
 * Tests for REST API Server
 */
import { describe, it, expect } from 'vitest';
import { app } from '../server/index.js';
import request from 'supertest';
// Note: These are unit tests for route definitions
// Full integration tests would require running the server
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
            const response = await request(app).get('/api');
            expect(response.status).toBe(200);
            expect(response.body.name).toBe('METAMORPH API');
            expect(response.body.endpoints).toBeDefined();
        });
    });
    describe('Session Management', () => {
        it('creates a new session', async () => {
            const response = await request(app)
                .post('/api/session')
                .send({});
            expect(response.status).toBe(200);
            expect(response.body.sessionId).toBeDefined();
            expect(response.body.stance).toBeDefined();
            expect(response.body.config).toBeDefined();
        });
        it('creates session with custom config', async () => {
            const response = await request(app)
                .post('/api/session')
                .send({
                config: {
                    intensity: 80,
                    coherenceFloor: 40
                }
            });
            expect(response.status).toBe(200);
            expect(response.body.config.intensity).toBe(80);
            expect(response.body.config.coherenceFloor).toBe(40);
        });
    });
    describe('State Endpoint', () => {
        it('returns current state', async () => {
            // First create a session
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            // Then get state
            const response = await request(app)
                .get(`/api/state?sessionId=${sessionId}`);
            expect(response.status).toBe(200);
            expect(response.body.stance).toBeDefined();
            expect(response.body.config).toBeDefined();
        });
    });
    describe('Config Endpoint', () => {
        it('updates configuration', async () => {
            // First create a session
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            // Update config
            const response = await request(app)
                .put('/api/config')
                .send({
                sessionId,
                config: { intensity: 90 }
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.config.intensity).toBe(90);
        });
        it('returns error without config', async () => {
            const response = await request(app)
                .put('/api/config')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Config is required');
        });
    });
    describe('Identity Endpoint', () => {
        it('returns identity information', async () => {
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            const response = await request(app)
                .get(`/api/identity?sessionId=${sessionId}`);
            expect(response.status).toBe(200);
            expect(response.body.frame).toBeDefined();
            expect(response.body.selfModel).toBeDefined();
            expect(response.body.sentience).toBeDefined();
        });
    });
    describe('Subagents Endpoint', () => {
        it('lists available subagents', async () => {
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            const response = await request(app)
                .get(`/api/subagents?sessionId=${sessionId}`);
            expect(response.status).toBe(200);
            expect(response.body.subagents).toHaveLength(4);
            expect(response.body.subagents.map((s) => s.name)).toContain('explorer');
            expect(response.body.subagents.map((s) => s.name)).toContain('verifier');
        });
    });
    describe('History Endpoint', () => {
        it('returns empty history for new session', async () => {
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            const response = await request(app)
                .get(`/api/history?sessionId=${sessionId}`);
            expect(response.status).toBe(200);
            expect(response.body.total).toBe(0);
            expect(response.body.messages).toHaveLength(0);
        });
    });
    describe('Chat Endpoint', () => {
        it('returns error without message', async () => {
            const response = await request(app)
                .post('/api/chat')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Message is required');
        });
    });
    describe('Export/Import', () => {
        it('exports session state', async () => {
            const session = await request(app).post('/api/session').send({});
            const sessionId = session.body.sessionId;
            const response = await request(app)
                .get(`/api/export?sessionId=${sessionId}`);
            expect(response.status).toBe(200);
            expect(response.body.state).toBeDefined();
        });
    });
});
//# sourceMappingURL=server.test.js.map