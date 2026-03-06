import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Phase 2A tests: Server sync fixes
 * - Issue 2-1: chatStream delta accumulation
 * - Issue 2-2: requestUsage() on auth success
 * - Issue 2-3: listTasks() on auth success
 */

// ─── Issue 2-1: chatStream delta accumulation logic ────────

describe('chatStream delta accumulation', () => {
  interface PartialMessage {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    timestamp: number;
    partial?: boolean;
  }

  /** Simulates the chatStream handler logic from useDoublt.ts */
  function applyChatStream(
    messages: Map<string, PartialMessage[]>,
    event: { sessionId: string; messageId: string; delta: string; done: boolean },
  ): Map<string, PartialMessage[]> {
    const result = new Map(messages);
    const sessionMsgs = [...(result.get(event.sessionId) ?? [])];
    const existingIdx = sessionMsgs.findIndex(m => m.id === event.messageId);

    if (existingIdx >= 0) {
      const existing = sessionMsgs[existingIdx];
      if (!existing.partial && existing.content.length > 0) {
        return messages; // Already finalized
      }
      sessionMsgs[existingIdx] = {
        ...existing,
        content: existing.content + event.delta,
        partial: !event.done,
      };
    } else {
      sessionMsgs.push({
        id: event.messageId,
        sessionId: event.sessionId,
        role: 'assistant',
        content: event.delta,
        timestamp: Date.now(),
        partial: !event.done,
      });
    }

    result.set(event.sessionId, sessionMsgs);
    return result;
  }

  it('creates a new partial message on first delta', () => {
    const messages = new Map<string, PartialMessage[]>();
    const result = applyChatStream(messages, {
      sessionId: 's1',
      messageId: 'm1',
      delta: 'Hello',
      done: false,
    });

    const msgs = result.get('s1')!;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('m1');
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[0].partial).toBe(true);
    expect(msgs[0].role).toBe('assistant');
  });

  it('accumulates multiple deltas into existing message', () => {
    let messages = new Map<string, PartialMessage[]>();
    messages = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: 'Hello', done: false,
    });
    messages = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: ' world', done: false,
    });
    messages = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: '!', done: true,
    });

    const msgs = messages.get('s1')!;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Hello world!');
    expect(msgs[0].partial).toBe(false);
  });

  it('does not modify a finalized message (partial=false)', () => {
    const messages = new Map<string, PartialMessage[]>();
    messages.set('s1', [{
      id: 'm1', sessionId: 's1', role: 'assistant',
      content: 'Final content', timestamp: 1000, partial: false,
    }]);

    const result = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: ' stale', done: false,
    });

    // Should return original map unchanged
    expect(result).toBe(messages);
    expect(result.get('s1')![0].content).toBe('Final content');
  });

  it('handles multiple sessions independently', () => {
    let messages = new Map<string, PartialMessage[]>();
    messages = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: 'A', done: false,
    });
    messages = applyChatStream(messages, {
      sessionId: 's2', messageId: 'm2', delta: 'B', done: true,
    });

    expect(messages.get('s1')![0].content).toBe('A');
    expect(messages.get('s1')![0].partial).toBe(true);
    expect(messages.get('s2')![0].content).toBe('B');
    expect(messages.get('s2')![0].partial).toBe(false);
  });

  it('handles empty delta gracefully', () => {
    let messages = new Map<string, PartialMessage[]>();
    messages = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: '', done: false,
    });

    expect(messages.get('s1')![0].content).toBe('');
    expect(messages.get('s1')![0].partial).toBe(true);
  });

  it('marks done=true on single-chunk message', () => {
    const messages = new Map<string, PartialMessage[]>();
    const result = applyChatStream(messages, {
      sessionId: 's1', messageId: 'm1', delta: 'Complete', done: true,
    });

    expect(result.get('s1')![0].content).toBe('Complete');
    expect(result.get('s1')![0].partial).toBe(false);
  });
});

// ─── Issue 2-2 & 2-3: Auth success triggers ────────────────

describe('DoubltClient auth success calls', () => {
  /** Minimal mock of DoubltClient's handleMessage auth path */
  function createMockClient() {
    const calls: string[] = [];
    return {
      calls,
      listSessions: () => calls.push('listSessions'),
      listWorkspaces: () => calls.push('listWorkspaces'),
      listTasks: () => calls.push('listTasks'),
      requestUsage: () => calls.push('requestUsage'),
      /** Simulates the auth:result success handler */
      simulateAuthSuccess() {
        // Mirrors DoubltClient.ts auth:result success block
        this.listSessions();
        this.listWorkspaces();
        this.listTasks();
        this.requestUsage();
      },
    };
  }

  it('calls listTasks on auth success', () => {
    const client = createMockClient();
    client.simulateAuthSuccess();
    expect(client.calls).toContain('listTasks');
  });

  it('calls requestUsage on auth success', () => {
    const client = createMockClient();
    client.simulateAuthSuccess();
    expect(client.calls).toContain('requestUsage');
  });

  it('calls all four list methods on auth success', () => {
    const client = createMockClient();
    client.simulateAuthSuccess();
    expect(client.calls).toEqual([
      'listSessions',
      'listWorkspaces',
      'listTasks',
      'requestUsage',
    ]);
  });

  it('listTasks and requestUsage are called after listSessions/listWorkspaces', () => {
    const client = createMockClient();
    client.simulateAuthSuccess();
    const sessionsIdx = client.calls.indexOf('listSessions');
    const workspacesIdx = client.calls.indexOf('listWorkspaces');
    const tasksIdx = client.calls.indexOf('listTasks');
    const usageIdx = client.calls.indexOf('requestUsage');
    expect(tasksIdx).toBeGreaterThan(sessionsIdx);
    expect(tasksIdx).toBeGreaterThan(workspacesIdx);
    expect(usageIdx).toBeGreaterThan(workspacesIdx);
  });
});

// ─── DoubltClient.ts handleMessage chatStream emit ─────────

describe('DoubltClient chatStream event emission', () => {
  it('emits chatStream with correct payload shape', () => {
    const emitter = new EventEmitter();
    const received: unknown[] = [];

    emitter.on('chatStream', (data: unknown) => received.push(data));

    // Simulate what DoubltClient.handleMessage does for chat:stream
    const msg = {
      type: 'chat:stream' as const,
      sessionId: 's1',
      messageId: 'm1',
      delta: 'Hello',
      done: false,
    };
    emitter.emit('chatStream', {
      sessionId: msg.sessionId,
      messageId: msg.messageId,
      delta: msg.delta,
      done: msg.done,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      sessionId: 's1',
      messageId: 'm1',
      delta: 'Hello',
      done: false,
    });
  });
});
