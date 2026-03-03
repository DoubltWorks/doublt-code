import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../session/SessionManager.js';
import { WorkspaceManager } from '../workspace/WorkspaceManager.js';

describe('WorkspaceManager', () => {
  let sessionManager: SessionManager;
  let manager: WorkspaceManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    manager = new WorkspaceManager(sessionManager);
  });

  describe('workspace CRUD', () => {
    it('should create a workspace with defaults', () => {
      const ws = manager.create();
      expect(ws.id).toMatch(/^ws-/);
      expect(ws.name).toMatch(/^workspace-/);
      expect(ws.status).toBe('active');
      expect(ws.sessionIds).toEqual([]);
    });

    it('should create a workspace with custom options', () => {
      const ws = manager.create({ name: 'My Workspace', cwd: '/projects/app' });
      expect(ws.name).toBe('My Workspace');
      expect(ws.cwd).toBe('/projects/app');
    });

    it('should get a workspace by id', () => {
      const ws = manager.create();
      expect(manager.get(ws.id)).toEqual(ws);
    });

    it('should return undefined for non-existent workspace', () => {
      expect(manager.get('nope')).toBeUndefined();
    });

    it('should list workspaces excluding archived', () => {
      manager.create({ name: 'active' });
      const toArchive = manager.create({ name: 'archive-me' });
      manager.archive(toArchive.id);

      const list = manager.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('active');
    });

    it('should include index in list items', () => {
      manager.create();
      manager.create();
      const list = manager.list();
      expect(list[0].index).toBe(0);
      expect(list[1].index).toBe(1);
    });

    it('should emit workspace:created', () => {
      const handler = vi.fn();
      manager.on('workspace:created', handler);
      manager.create();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('session management', () => {
    it('should add a session to a workspace', () => {
      const ws = manager.create();
      expect(manager.addSession(ws.id, 'sess-1')).toBe(true);
      expect(manager.getWorkspaceSessions(ws.id)).toContain('sess-1');
    });

    it('should not duplicate session in workspace', () => {
      const ws = manager.create();
      manager.addSession(ws.id, 'sess-1');
      manager.addSession(ws.id, 'sess-1');
      expect(manager.getWorkspaceSessions(ws.id)).toHaveLength(1);
    });

    it('should return false when adding to non-existent workspace', () => {
      expect(manager.addSession('nope', 'sess-1')).toBe(false);
    });

    it('should remove a session from a workspace', () => {
      const ws = manager.create();
      manager.addSession(ws.id, 'sess-1');
      manager.addSession(ws.id, 'sess-2');

      expect(manager.removeSession(ws.id, 'sess-1')).toBe(true);
      expect(manager.getWorkspaceSessions(ws.id)).toEqual(['sess-2']);
    });

    it('should set workspace to idle when last session removed', () => {
      const ws = manager.create();
      manager.addSession(ws.id, 'sess-1');
      manager.removeSession(ws.id, 'sess-1');
      expect(manager.get(ws.id)!.status).toBe('idle');
    });

    it('should return false when removing from non-existent workspace', () => {
      expect(manager.removeSession('nope', 'sess-1')).toBe(false);
    });

    it('should find workspace by session', () => {
      const ws = manager.create();
      manager.addSession(ws.id, 'sess-1');

      const found = manager.findWorkspaceBySession('sess-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe(ws.id);
    });

    it('should return undefined when session not in any workspace', () => {
      expect(manager.findWorkspaceBySession('nowhere')).toBeUndefined();
    });
  });

  describe('rename', () => {
    it('should rename a workspace', () => {
      const ws = manager.create({ name: 'old-name' });
      expect(manager.rename(ws.id, 'new-name')).toBe(true);
      expect(manager.get(ws.id)!.name).toBe('new-name');
    });

    it('should return false for non-existent workspace', () => {
      expect(manager.rename('nope', 'x')).toBe(false);
    });

    it('should emit workspace:updated on rename', () => {
      const handler = vi.fn();
      manager.on('workspace:updated', handler);
      const ws = manager.create();
      manager.rename(ws.id, 'new');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a workspace', () => {
      const ws = manager.create();
      expect(manager.archive(ws.id)).toBe(true);
      expect(manager.get(ws.id)!.status).toBe('archived');
    });

    it('should return false for non-existent workspace', () => {
      expect(manager.archive('nope')).toBe(false);
    });

    it('should emit both workspace:updated and workspace:deleted', () => {
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();
      manager.on('workspace:updated', updatedHandler);
      manager.on('workspace:deleted', deletedHandler);

      const ws = manager.create();
      manager.archive(ws.id);

      expect(updatedHandler).toHaveBeenCalled();
      expect(deletedHandler).toHaveBeenCalledWith(ws.id);
    });
  });

  describe('session:updated event propagation', () => {
    it('should update workspace activity when session is updated', () => {
      const ws = manager.create();
      const session = sessionManager.create({ workspaceId: ws.id });
      manager.addSession(ws.id, session.id);

      const beforeActivity = manager.get(ws.id)!.lastActivityAt;

      // Trigger session update
      sessionManager.attachClient(session.id, 'c1', 'cli', 'dev');

      const afterActivity = manager.get(ws.id)!.lastActivityAt;
      expect(afterActivity).toBeGreaterThanOrEqual(beforeActivity);
    });
  });

  describe('list item counts', () => {
    it('should count total and active sessions', () => {
      const ws = manager.create();
      const s1 = sessionManager.create({ workspaceId: ws.id });
      const s2 = sessionManager.create({ workspaceId: ws.id });
      manager.addSession(ws.id, s1.id);
      manager.addSession(ws.id, s2.id);

      // s1 is active by default, archive s2
      sessionManager.archive(s2.id);

      const list = manager.list();
      expect(list[0].sessionCount).toBe(2);
      expect(list[0].activeSessionCount).toBe(1);
    });
  });

  describe('toListItem', () => {
    it('should convert workspace to list item', () => {
      const ws = manager.create({ name: 'Test WS' });
      const s1 = sessionManager.create({ workspaceId: ws.id });
      manager.addSession(ws.id, s1.id);

      const item = manager.toListItem(ws);
      expect(item.id).toBe(ws.id);
      expect(item.name).toBe('Test WS');
      expect(item.sessionCount).toBe(1);
      expect(item.activeSessionCount).toBe(1);
    });
  });
});
