/**
 * WorkspaceManager — Manages doubltmux workspaces.
 *
 * A workspace groups sessions together, similar to how tmux sessions
 * contain multiple windows. Each workspace has a root working directory
 * and can contain multiple sessions.
 *
 * Hierarchy: Workspace → Session(s)
 * All workspace state is synced to connected mobile clients.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  Workspace,
  WorkspaceId,
  WorkspaceCreateOptions,
  WorkspaceListItem,
  WorkspaceStatus,
} from '@doublt/shared';
import type { SessionManager } from '../session/SessionManager.js';

export class WorkspaceManager extends EventEmitter {
  private workspaces = new Map<WorkspaceId, Workspace>();
  private nextIndex = 0;

  constructor(private sessionManager: SessionManager) {
    super();

    // Update workspace activity when sessions change
    this.sessionManager.on('session:updated', (session) => {
      if (session.workspaceId) {
        this.updateActivity(session.workspaceId);
      }
    });
  }

  create(options: WorkspaceCreateOptions = {}): Workspace {
    const id = `ws-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    const workspace: Workspace = {
      id,
      name: options.name ?? `workspace-${this.nextIndex}`,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
      cwd: options.cwd ?? process.cwd(),
      sessionIds: [],
    };

    this.workspaces.set(id, workspace);
    this.nextIndex++;
    this.emit('workspace:created', workspace);
    return workspace;
  }

  get(id: WorkspaceId): Workspace | undefined {
    return this.workspaces.get(id);
  }

  list(): WorkspaceListItem[] {
    let idx = 0;
    return Array.from(this.workspaces.values())
      .filter(ws => ws.status !== 'archived')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(ws => {
        const activeSessions = ws.sessionIds.filter(sid => {
          const s = this.sessionManager.get(sid);
          return s && s.status === 'active';
        });
        return {
          id: ws.id,
          name: ws.name,
          status: ws.status,
          sessionCount: ws.sessionIds.length,
          activeSessionCount: activeSessions.length,
          lastActivityAt: ws.lastActivityAt,
          cwd: ws.cwd,
          index: idx++,
        };
      });
  }

  addSession(workspaceId: WorkspaceId, sessionId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    if (!workspace.sessionIds.includes(sessionId)) {
      workspace.sessionIds.push(sessionId);
      workspace.lastActivityAt = Date.now();
      this.emit('workspace:updated', workspace);
    }
    return true;
  }

  removeSession(workspaceId: WorkspaceId, sessionId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.sessionIds = workspace.sessionIds.filter(sid => sid !== sessionId);
    workspace.lastActivityAt = Date.now();

    if (workspace.sessionIds.length === 0) {
      workspace.status = 'idle';
    }

    this.emit('workspace:updated', workspace);
    return true;
  }

  rename(workspaceId: WorkspaceId, name: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.name = name;
    this.emit('workspace:updated', workspace);
    return true;
  }

  archive(workspaceId: WorkspaceId): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.status = 'archived';
    this.emit('workspace:updated', workspace);
    this.emit('workspace:deleted', workspaceId);
    return true;
  }

  private updateActivity(workspaceId: WorkspaceId): void {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.lastActivityAt = Date.now();
    }
  }

  /**
   * Return all workspaces as raw Workspace objects (for persistence).
   */
  listAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Restore workspaces from persisted state.
   */
  restoreWorkspaces(workspaces: Workspace[]): void {
    for (const workspace of workspaces) {
      this.workspaces.set(workspace.id, { ...workspace });
      this.nextIndex++;
    }
  }

  /** Get all sessions for a workspace */
  getWorkspaceSessions(workspaceId: WorkspaceId): string[] {
    return this.workspaces.get(workspaceId)?.sessionIds ?? [];
  }

  /** Find workspace containing a given session */
  findWorkspaceBySession(sessionId: string): Workspace | undefined {
    for (const ws of this.workspaces.values()) {
      if (ws.sessionIds.includes(sessionId)) return ws;
    }
    return undefined;
  }

  toListItem(ws: Workspace): WorkspaceListItem {
    const activeSessions = ws.sessionIds.filter(sid => {
      const s = this.sessionManager.get(sid);
      return s && s.status === 'active';
    });
    const allWorkspaces = this.list();
    const idx = allWorkspaces.findIndex(w => w.id === ws.id);
    return {
      id: ws.id,
      name: ws.name,
      status: ws.status,
      sessionCount: ws.sessionIds.length,
      activeSessionCount: activeSessions.length,
      lastActivityAt: ws.lastActivityAt,
      cwd: ws.cwd,
      index: idx >= 0 ? idx : 0,
    };
  }
}
