import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DigestManager } from '../digest/DigestManager.js';

describe('DigestManager', () => {
  let manager: DigestManager;

  beforeEach(() => {
    manager = new DigestManager();
  });

  describe('event logging', () => {
    it('should log an event and emit event:logged', () => {
      const handler = vi.fn();
      manager.on('event:logged', handler);

      const event = manager.logEvent('message', 'sess-1', 'User sent a message');
      expect(event.id).toBeDefined();
      expect(event.type).toBe('message');
      expect(event.sessionId).toBe('sess-1');
      expect(event.summary).toBe('User sent a message');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should store events newest first', () => {
      manager.logEvent('message', 's1', 'First');
      manager.logEvent('message', 's1', 'Second');
      manager.logEvent('message', 's1', 'Third');

      const recent = manager.getRecentEvents(3);
      expect(recent[0].summary).toBe('Third');
      expect(recent[2].summary).toBe('First');
    });

    it('should enforce 10,000 event cap', () => {
      for (let i = 0; i < 10_050; i++) {
        manager.logEvent('message', 's1', `Event ${i}`);
      }
      const all = manager.getRecentEvents(20_000);
      expect(all.length).toBe(10_000);
      // Most recent should be the last inserted
      expect(all[0].summary).toBe('Event 10049');
    });

    it('should store optional data', () => {
      const event = manager.logEvent('tool_use', 's1', 'Used tool', { toolName: 'read' });
      expect(event.data).toEqual({ toolName: 'read' });
    });
  });

  describe('generateDigest', () => {
    beforeEach(() => {
      // Create events of different types
      manager.logEvent('message', 'sess-1', 'Msg 1');
      manager.logEvent('message', 'sess-1', 'Msg 2');
      manager.logEvent('message', 'sess-2', 'Msg 3');
      manager.logEvent('tool_use', 'sess-1', 'Tool used');
      manager.logEvent('error', 'sess-1', 'Something failed');
      manager.logEvent('command', 'sess-2', 'npm install');
      manager.logEvent('handoff', 'sess-1', 'Context transferred');
    });

    it('should count events by type', () => {
      const digest = manager.generateDigest(0);
      expect(digest.messagesCount).toBe(3);
      expect(digest.toolUseCount).toBe(1);
      expect(digest.errorsCount).toBe(1);
      expect(digest.commandsRun).toBe(1);
    });

    it('should count active sessions', () => {
      const digest = manager.generateDigest(0);
      expect(digest.sessionsActive).toBe(2);
    });

    it('should include key events (errors, handoffs, commands)', () => {
      const digest = manager.generateDigest(0);
      expect(digest.keyEvents.length).toBeGreaterThan(0);
      expect(digest.keyEvents.length).toBeLessThanOrEqual(5);

      const keyTypes = digest.keyEvents.map(e => e.type);
      expect(keyTypes).toContain('error');
      expect(keyTypes).toContain('handoff');
      expect(keyTypes).toContain('command');
    });

    it('should generate summary text', () => {
      const digest = manager.generateDigest(0);
      expect(digest.summary).toContain('3 messages');
      expect(digest.summary).toContain('2 sessions');
      expect(digest.summary).toContain('1 tool use');
      expect(digest.summary).toContain('1 error');
    });

    it('should filter by time window', () => {
      const now = Date.now();
      const digest = manager.generateDigest(now + 100_000);
      expect(digest.messagesCount).toBe(0);
      expect(digest.sessionsActive).toBe(0);
    });

    it('should emit digest:generated', () => {
      const handler = vi.fn();
      manager.on('digest:generated', handler);
      manager.generateDigest(0);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('getTimeline', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        manager.logEvent('message', i < 5 ? 'sess-1' : 'sess-2', `Event ${i}`);
      }
    });

    it('should return all events as timeline entries', () => {
      const timeline = manager.getTimeline();
      expect(timeline.length).toBe(10);
      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('type');
      expect(timeline[0]).toHaveProperty('title');
      expect(timeline[0]).toHaveProperty('detail');
    });

    it('should filter by session', () => {
      const timeline = manager.getTimeline('sess-1');
      expect(timeline.length).toBe(5);
      expect(timeline.every(t => t.sessionId === 'sess-1')).toBe(true);
    });

    it('should respect limit', () => {
      const timeline = manager.getTimeline(undefined, { limit: 3 });
      expect(timeline.length).toBe(3);
    });

    it('should respect offset', () => {
      const all = manager.getTimeline();
      const sliced = manager.getTimeline(undefined, { offset: 5 });
      expect(sliced.length).toBe(5);
      expect(sliced[0].detail).toBe(all[5].detail);
    });

    it('should map event types to titles', () => {
      manager.logEvent('error', 's1', 'err');
      manager.logEvent('tool_use', 's1', 'tool');
      manager.logEvent('handoff', 's1', 'hoff');
      manager.logEvent('command', 's1', 'cmd');
      manager.logEvent('commit', 's1', 'cmt');

      const timeline = manager.getTimeline('s1');
      const titles = timeline.map(t => t.title);
      expect(titles).toContain('Error');
      expect(titles).toContain('Tool Use');
      expect(titles).toContain('Handoff');
      expect(titles).toContain('Command');
      expect(titles).toContain('Commit');
    });
  });

  describe('getHistory - cursor-based pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 50; i++) {
        manager.logEvent('message', 'sess-1', `Message ${i}`);
      }
    });

    it('should return first page without cursor', () => {
      const page = manager.getHistory('sess-1');
      expect(page.messages.length).toBe(20);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('20');
    });

    it('should return second page with cursor', () => {
      const page = manager.getHistory('sess-1', '20');
      expect(page.messages.length).toBe(20);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('40');
    });

    it('should return last page with hasMore=false', () => {
      const page = manager.getHistory('sess-1', '40');
      expect(page.messages.length).toBe(10);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeUndefined();
    });

    it('should respect custom limit', () => {
      const page = manager.getHistory('sess-1', undefined, 5);
      expect(page.messages.length).toBe(5);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('5');
    });

    it('should filter by sessionId', () => {
      manager.logEvent('message', 'sess-2', 'Other session');
      const page = manager.getHistory('sess-1');
      expect(page.messages.every(m => m.sessionId === 'sess-1')).toBe(true);
    });
  });

  describe('getRecentEvents', () => {
    it('should return up to N recent events', () => {
      for (let i = 0; i < 20; i++) {
        manager.logEvent('message', 's1', `Event ${i}`);
      }
      const recent = manager.getRecentEvents(5);
      expect(recent.length).toBe(5);
    });

    it('should default to 10', () => {
      for (let i = 0; i < 20; i++) {
        manager.logEvent('message', 's1', `Event ${i}`);
      }
      const recent = manager.getRecentEvents();
      expect(recent.length).toBe(10);
    });
  });

  describe('clearOldEvents', () => {
    it('should remove events older than timestamp', () => {
      const now = Date.now();
      // Log events — they all get timestamp ~now
      for (let i = 0; i < 5; i++) {
        manager.logEvent('message', 's1', `Event ${i}`);
      }

      // Clear events older than future time — removes all
      const deleted = manager.clearOldEvents(now + 100_000);
      expect(deleted).toBe(5);
      expect(manager.getRecentEvents(100).length).toBe(0);
    });

    it('should keep events newer than timestamp', () => {
      for (let i = 0; i < 5; i++) {
        manager.logEvent('message', 's1', `Event ${i}`);
      }

      const deleted = manager.clearOldEvents(0);
      expect(deleted).toBe(0);
      expect(manager.getRecentEvents(100).length).toBe(5);
    });
  });
});
