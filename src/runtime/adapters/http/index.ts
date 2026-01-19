import { Express, Request, Response } from 'express';
import { MetamorphRuntime } from '../../runtime.js';

export interface HTTPAdapterOptions {
  enableSSE?: boolean;
}

export class HTTPAdapter {
  private runtime: MetamorphRuntime;

  constructor(runtime: MetamorphRuntime, _options: HTTPAdapterOptions = {}) {
    this.runtime = runtime;
    // Options stored for future SSE configuration
    void _options;
  }

  setupRoutes(app: Express): void {
    // Session management
    app.post('/api/sessions', this.createSession);
    app.get('/api/sessions', this.listSessions);
    app.get('/api/sessions/:id', this.getSession);
    app.delete('/api/sessions/:id', this.deleteSession);

    // Chat
    app.post('/api/chat', this.handleChat);
    app.post('/api/chat/stream', this.handleChatStream);

    // Commands - NEW unified endpoint
    app.post('/api/command', this.handleCommand);
    app.get('/api/commands', this.listCommands);

    // Legacy compatibility endpoints (map to new runtime)
    app.get('/api/stance', this.getStance);
    app.get('/api/history', this.getHistory);
    app.get('/api/config', this.getConfig);
  }

  // Session handlers
  private createSession = (req: Request, res: Response) => {
    const { config, name } = req.body || {};
    const session = this.runtime.createSession(config, name);
    res.json({
      sessionId: session.id,
      name: session.name,
      createdAt: session.createdAt
    });
  };

  private listSessions = (_req: Request, res: Response) => {
    const sessions = this.runtime.sessions.listSessions();
    res.json({ sessions });
  };

  private getSession = (req: Request, res: Response) => {
    const info = this.runtime.getSessionInfo(req.params.id);
    if (!info) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(info);
  };

  private deleteSession = (req: Request, res: Response) => {
    const deleted = this.runtime.deleteSession(req.params.id);
    res.json({ deleted });
  };

  // Chat handlers
  private handleChat = async (req: Request, res: Response) => {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      res.status(400).json({ error: 'sessionId and message required' });
      return;
    }

    try {
      const response = await this.runtime.chat(sessionId, message);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Chat failed'
      });
    }
  };

  private handleChatStream = async (req: Request, res: Response) => {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      res.status(400).json({ error: 'sessionId and message required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      res.write('event: start\ndata: {}\n\n');
      await this.runtime.chatStream(sessionId, message, {
        onText: (text: string) => res.write(`event: token\ndata: ${JSON.stringify({ token: text })}\n\n`),
        onComplete: (response) => {
          res.write(`event: complete\ndata: ${JSON.stringify(response)}\n\n`);
          res.end();
        }
      });
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
      res.end();
    }
  };

  // Command handlers
  private handleCommand = async (req: Request, res: Response) => {
    const { sessionId, command, args = [] } = req.body;
    if (!sessionId || !command) {
      res.status(400).json({ error: 'sessionId and command required' });
      return;
    }

    const result = await this.runtime.executeCommand(sessionId, command, args);
    res.json(result);
  };

  private listCommands = (_req: Request, res: Response) => {
    const commands = this.runtime.listCommands();
    res.json({ commands });
  };

  // Legacy compatibility
  private getStance = (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    const session = this.runtime.sessions.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session.agent.getCurrentStance());
  };

  private getHistory = (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    const session = this.runtime.sessions.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ history: session.agent.getHistory() });
  };

  private getConfig = (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    const session = this.runtime.sessions.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session.agent.getConfig());
  };
}
