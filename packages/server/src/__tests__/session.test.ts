import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../session/SessionManager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe('session creation', () => {
    it('should create a session with defaults', () => {
      const session = manager.create();
      expect(session.id).toBeDefined();
      expect(session.name).toMatch(/^session-/);
      expect(session.status).toBe('active');
      expect(session.clients).toEqual([]);
      expect(session.contextUsage).toBe(0);
    });

    it('should create a session with custom options', () => {
      const session = manager.create({ name: 'my-session', cwd: '/custom/path', workspaceId: 'ws-1' });
      expect(session.name).toBe('my-session');
      expect(session.cwd).toBe('/custom/path');
      expect(session.workspaceId).toBe('ws-1');
    });

    it('should create a session from handoff', () => {
      const session = manager.create({
        fromHandoff: { parentSessionId: 'parent-1', handoffContent: 'handoff content' },
      });
      expect(session.parentSessionId).toBe('parent-1');
      expect(session.handoffContext).toBe('handoff content');
    });

    it('should emit session:created', () => {
      const handler = vi.fn();
      manager.on('session:created', handler);
      manager.create();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('get and list', () => {
    it('should get a session by id', () => {
      const session = manager.create();
      expect(manager.get(session.id)).toEqual(session);
    });

    it('should return undefined for non-existent session', () => {
      expect(manager.get('nope')).toBeUndefined();
    });

    it('should list sessions excluding archived', () => {
      manager.create({ name: 'active' });
      const toArchive = manager.create({ name: 'to-archive' });
      manager.archive(toArchive.id);

      const list = manager.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('active');
    });

    it('should list sessions filtered by workspaceId', () => {
      manager.create({ workspaceId: 'ws-1' });
      manager.create({ workspaceId: 'ws-2' });
      manager.create({ workspaceId: 'ws-1' });

      const list = manager.list('ws-1');
      expect(list).toHaveLength(2);
    });

    it('should include index in list items', () => {
      manager.create();
      manager.create();
      const list = manager.list();
      expect(list[0].index).toBe(0);
      expect(list[1].index).toBe(1);
    });
  });

  describe('client attach/detach', () => {
    it('should attach a client', () => {
      const session = manager.create();
      const result = manager.attachClient(session.id, 'client-1', 'cli', 'macOS');
      expect(result).toBe(true);

      const clients = manager.getSessionClients(session.id);
      expect(clients).toHaveLength(1);
      expect(clients[0].id).toBe('client-1');
      expect(clients[0].type).toBe('cli');
    });

    it('should handle reconnection (re-attach same client)', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'client-1', 'cli', 'macOS');
      manager.attachClient(session.id, 'client-1', 'cli', 'macOS v2');

      const clients = manager.getSessionClients(session.id);
      expect(clients).toHaveLength(1);
      expect(clients[0].deviceInfo).toBe('macOS v2');
    });

    it('should attach multiple clients (PC + mobile simultaneously)', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'cli-1', 'cli', 'PC');
      manager.attachClient(session.id, 'mobile-1', 'mobile', 'iPhone');

      const clients = manager.getSessionClients(session.id);
      expect(clients).toHaveLength(2);
    });

    it('should set idle session to active when client attaches', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'dev');
      manager.detachClient(session.id, 'c1');
      expect(manager.get(session.id)!.status).toBe('idle');

      manager.attachClient(session.id, 'c2', 'mobile', 'phone');
      expect(manager.get(session.id)!.status).toBe('active');
    });

    it('should return false for non-existent session', () => {
      expect(manager.attachClient('nope', 'c1', 'cli', 'd')).toBe(false);
    });

    it('should detach a client', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');
      expect(manager.detachClient(session.id, 'c1')).toBe(true);
      expect(manager.getSessionClients(session.id)).toHaveLength(0);
    });

    it('should set session to idle when last client detaches', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');
      manager.detachClient(session.id, 'c1');
      expect(manager.get(session.id)!.status).toBe('idle');
    });

    it('should emit session:updated on attach and detach', () => {
      const handler = vi.fn();
      manager.on('session:updated', handler);
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');
      manager.detachClient(session.id, 'c1');
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('getClientSessions', () => {
    it('should return all sessions for a client', () => {
      const s1 = manager.create();
      const s2 = manager.create();
      manager.create(); // s3 - not attached

      manager.attachClient(s1.id, 'c1', 'cli', 'd');
      manager.attachClient(s2.id, 'c1', 'cli', 'd');

      const sessions = manager.getClientSessions('c1');
      expect(sessions).toHaveLength(2);
    });
  });

  describe('context usage and handoff', () => {
    it('should update context usage', () => {
      const session = manager.create();
      manager.updateContextUsage(session.id, 0.5);
      expect(manager.get(session.id)!.contextUsage).toBe(0.5);
    });

    it('should clamp context usage to [0, 1]', () => {
      const session = manager.create();
      manager.updateContextUsage(session.id, 1.5);
      expect(manager.get(session.id)!.contextUsage).toBe(1);

      manager.updateContextUsage(session.id, -0.5);
      expect(manager.get(session.id)!.contextUsage).toBe(0);
    });

    it('should emit session:handoff_needed at 0.85 threshold', () => {
      const handler = vi.fn();
      manager.on('session:handoff_needed', handler);

      const session = manager.create();
      manager.updateContextUsage(session.id, 0.5);
      expect(handler).not.toHaveBeenCalled();

      manager.updateContextUsage(session.id, 0.85);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should not re-emit handoff_needed if already above threshold', () => {
      const handler = vi.fn();
      manager.on('session:handoff_needed', handler);

      const session = manager.create();
      manager.updateContextUsage(session.id, 0.86);
      manager.updateContextUsage(session.id, 0.90);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should set status to handoff_pending when crossing threshold', () => {
      const session = manager.create();
      manager.updateContextUsage(session.id, 0.9);
      expect(manager.get(session.id)!.status).toBe('handoff_pending');
    });

    it('should not fire for non-existent session', () => {
      const handler = vi.fn();
      manager.on('session:handoff_needed', handler);
      manager.updateContextUsage('nope', 0.9);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a session', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');

      expect(manager.archive(session.id)).toBe(true);
      expect(manager.get(session.id)!.status).toBe('archived');
      expect(manager.get(session.id)!.clients).toHaveLength(0);
    });

    it('should return false for non-existent session', () => {
      expect(manager.archive('nope')).toBe(false);
    });
  });

  describe('pruneStaleClients', () => {
    it('should remove clients not seen recently', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');

      // Manually set lastSeenAt to the past
      const s = manager.get(session.id)!;
      s.clients[0].lastSeenAt = Date.now() - 120_000;

      manager.pruneStaleClients(60_000);
      expect(manager.getSessionClients(session.id)).toHaveLength(0);
    });

    it('should set session to idle after pruning all clients', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');

      const s = manager.get(session.id)!;
      s.clients[0].lastSeenAt = Date.now() - 120_000;

      manager.pruneStaleClients(60_000);
      expect(manager.get(session.id)!.status).toBe('idle');
    });

    it('should keep fresh clients', () => {
      const session = manager.create();
      manager.attachClient(session.id, 'c1', 'cli', 'd');

      manager.pruneStaleClients(60_000);
      expect(manager.getSessionClients(session.id)).toHaveLength(1);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivityAt', () => {
      const session = manager.create();
      const before = session.lastActivityAt;

      // Small delay to ensure different timestamp
      manager.updateActivity(session.id);
      expect(manager.get(session.id)!.lastActivityAt).toBeGreaterThanOrEqual(before);
    });
  });
});
