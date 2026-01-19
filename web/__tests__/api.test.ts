/**
 * Tests for METAMORPH API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, getState, updateConfig, chat, chatStream } from '@/lib/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const mockResponse = {
        sessionId: 'test-session-123',
        stance: { frame: 'existential', values: {} },
        config: { intensity: 50 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result.sessionId).toBe('test-session-123');
    });

    it('should pass config to createSession', async () => {
      const mockResponse = {
        sessionId: 'test-session-123',
        stance: {},
        config: { intensity: 80 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await createSession({ intensity: 80 });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({
          body: JSON.stringify({ config: { intensity: 80 } }),
        })
      );
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal error' }),
      });

      await expect(createSession()).rejects.toThrow('Internal error');
    });
  });

  describe('getState', () => {
    it('should get current state', async () => {
      const mockResponse = {
        stance: { frame: 'existential' },
        config: { intensity: 50 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getState('test-session');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/state?sessionId=test-session',
        expect.anything()
      );
      expect(result.stance.frame).toBe('existential');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', async () => {
      const mockResponse = {
        success: true,
        config: { intensity: 75 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await updateConfig('test-session', { intensity: 75 });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ sessionId: 'test-session', config: { intensity: 75 } }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('chat', () => {
    it('should send chat message', async () => {
      const mockResponse = {
        sessionId: 'test-session',
        response: 'Hello!',
        stanceAfter: { frame: 'existential' },
        scores: { transformation: 50, coherence: 70 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await chat('test-session', 'Hi there');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'test-session', message: 'Hi there' }),
        })
      );
      expect(result.response).toBe('Hello!');
    });
  });

  describe('chatStream', () => {
    it('should return abort function', () => {
      // Mock a response that never resolves
      mockFetch.mockReturnValueOnce(new Promise(() => {}));

      const abort = chatStream('test-session', 'Hello', null, {});

      expect(typeof abort).toBe('function');
    });

    it('should call onError on fetch failure', async () => {
      const onError = vi.fn();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      chatStream('test-session', 'Hello', null, { onError });

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onToolEvent when tool events are received', async () => {
      const onToolEvent = vi.fn();
      const onComplete = vi.fn();

      // Create SSE data with tool events - full message in one chunk
      const toolEvent = {
        id: 'tool-123',
        name: 'Read',
        input: { file_path: '/test.txt' },
        status: 'started',
      };
      const completeEvent = {
        response: 'Done',
        stanceAfter: { frame: 'existential' },
        scores: { transformation: 50 },
      };

      // SSE format: event line, then data line, then blank line
      const sseData = `event: tool_event\ndata: ${JSON.stringify(toolEvent)}\n\nevent: complete\ndata: ${JSON.stringify(completeEvent)}\n\n`;

      // Create a mock reader that returns all SSE data at once
      const encoder = new TextEncoder();
      let readCount = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (readCount === 0) {
            readCount++;
            return { done: false, value: encoder.encode(sseData) };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockBody,
      });

      chatStream('test-session', 'Hello', null, { onToolEvent, onComplete });

      // Wait for async stream processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onToolEvent).toHaveBeenCalledWith(expect.objectContaining({
        id: 'tool-123',
        name: 'Read',
        status: 'started',
      }));
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
