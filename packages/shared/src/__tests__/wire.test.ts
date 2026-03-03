import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage } from '../protocol/wire.js';
import type { ClientMessage, ServerMessage, WireMessage } from '../protocol/wire.js';

describe('Wire Protocol', () => {
  describe('encodeMessage / decodeMessage roundtrip', () => {
    it('should roundtrip an authenticate message', () => {
      const msg: ClientMessage = {
        type: 'authenticate',
        token: 'abc123',
        clientType: 'cli',
        deviceInfo: 'macOS terminal',
      };
      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);
      expect(decoded).toEqual(msg);
    });

    it('should roundtrip a session:create message', () => {
      const msg: ClientMessage = {
        type: 'session:create',
        options: { name: 'my-session', cwd: '/home/user/project' },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a session:attach message', () => {
      const msg: ClientMessage = { type: 'session:attach', sessionId: 'sess-1' };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a session:detach message', () => {
      const msg: ClientMessage = { type: 'session:detach', sessionId: 'sess-1' };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a chat:send message', () => {
      const msg: ClientMessage = {
        type: 'chat:send',
        sessionId: 'sess-1',
        content: 'Hello world',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a tool:approve message', () => {
      const msg: ClientMessage = {
        type: 'tool:approve',
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        approved: true,
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a workspace:create message', () => {
      const msg: ClientMessage = {
        type: 'workspace:create',
        options: { name: 'my-workspace', cwd: '/projects' },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a policy:set message with preset', () => {
      const msg: ClientMessage = {
        type: 'policy:set',
        preset: 'moderate',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a task:create message', () => {
      const msg: ClientMessage = {
        type: 'task:create',
        title: 'Fix bug',
        description: 'Fix the login bug',
        priority: 'high',
        workspaceId: 'ws-1',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a search:query message', () => {
      const msg: ClientMessage = {
        type: 'search:query',
        query: {
          query: 'authentication',
          scope: 'all',
          filters: { type: 'message', sessionId: 'sess-1' },
        },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a digest:request message', () => {
      const msg: ClientMessage = { type: 'digest:request', since: 1700000000000 };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a budget:set message', () => {
      const msg: ClientMessage = {
        type: 'budget:set',
        config: { dailyLimitUsd: 10, weeklyLimitUsd: 50 },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a claude:start message', () => {
      const msg: ClientMessage = {
        type: 'claude:start',
        sessionId: 'sess-1',
        prompt: 'fix the bug in auth module',
        autoRestart: true,
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a claude:stop message', () => {
      const msg: ClientMessage = { type: 'claude:stop', sessionId: 'sess-1' };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a claude:status message', () => {
      const msg: ClientMessage = { type: 'claude:status', sessionId: 'sess-1' };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });
  });

  describe('Server messages roundtrip', () => {
    it('should roundtrip an auth:result message', () => {
      const msg: ServerMessage = {
        type: 'auth:result',
        success: true,
        clientId: 'client-1',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a session:created message', () => {
      const msg: ServerMessage = {
        type: 'session:created',
        session: {
          id: 'sess-1',
          name: 'test',
          status: 'active',
          clientCount: 1,
          contextUsage: 0,
          lastActivityAt: Date.now(),
          cwd: '/tmp',
          index: 0,
        },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a chat:message with nested objects', () => {
      const msg: ServerMessage = {
        type: 'chat:message',
        message: {
          id: 'msg-1',
          sessionId: 'sess-1',
          role: 'assistant',
          content: 'Here is the result',
          timestamp: Date.now(),
          sourceClient: 'client-1',
        },
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip an error message', () => {
      const msg: ServerMessage = {
        type: 'error',
        code: 'AUTH_FAILED',
        message: 'Invalid token',
        sessionId: 'sess-1',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a task:list:result with array of tasks', () => {
      const msg: ServerMessage = {
        type: 'task:list:result',
        tasks: [
          {
            id: 't-1',
            title: 'Task 1',
            description: 'Desc',
            priority: 'high',
            status: 'queued',
            createdAt: Date.now(),
          },
          {
            id: 't-2',
            title: 'Task 2',
            description: 'Desc 2',
            priority: 'low',
            status: 'completed',
            createdAt: Date.now(),
            completedAt: Date.now(),
          },
        ],
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a cost:update message', () => {
      const msg: ServerMessage = {
        type: 'cost:update',
        sessionId: 'sess-1',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          model: 'claude-3-sonnet',
          timestamp: Date.now(),
        },
        estimatedCostUsd: 0.0105,
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a search:result message', () => {
      const msg: ServerMessage = {
        type: 'search:result',
        results: [
          {
            type: 'message',
            id: 'r-1',
            title: 'Found message',
            snippet: '...matching text...',
            matchScore: 0.85,
            timestamp: Date.now(),
            sessionId: 'sess-1',
          },
        ],
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a handoff:ready message', () => {
      const msg: ServerMessage = {
        type: 'handoff:ready',
        parentSessionId: 'sess-1',
        newSessionId: 'sess-2',
        handoffSummary: 'Context transferred',
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });

    it('should roundtrip a claude:status:result message', () => {
      const msg: ServerMessage = {
        type: 'claude:status:result',
        sessions: [
          { sessionId: 'sess-1', status: 'running', restartCount: 0, lastStartedAt: 1700000000000 },
          { sessionId: 'sess-2', status: 'idle', restartCount: 2 },
        ],
      };
      expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
    });
  });

  describe('type discriminator preservation', () => {
    it('should preserve the type field through roundtrip', () => {
      const types: WireMessage['type'][] = [
        'authenticate',
        'session:create',
        'chat:send',
        'auth:result',
        'session:created',
        'error',
      ];

      for (const type of types) {
        const minimal = { type } as WireMessage;
        const decoded = decodeMessage(encodeMessage(minimal));
        expect(decoded.type).toBe(type);
      }
    });
  });

  describe('encodeMessage', () => {
    it('should return a valid JSON string', () => {
      const msg: ClientMessage = { type: 'session:list' };
      const encoded = encodeMessage(msg);
      expect(() => JSON.parse(encoded)).not.toThrow();
    });
  });

  describe('decodeMessage', () => {
    it('should parse valid JSON into a WireMessage', () => {
      const raw = JSON.stringify({ type: 'session:list' });
      const decoded = decodeMessage(raw);
      expect(decoded.type).toBe('session:list');
    });

    it('should throw on invalid JSON', () => {
      expect(() => decodeMessage('not json')).toThrow();
    });
  });
});
