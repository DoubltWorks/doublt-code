/**
 * SessionManager — The core of doublt-code's multi-session system.
 *
 * Unlike Happy Coder which manages a single session with remote/local modes,
 * SessionManager handles multiple concurrent sessions (cmux-style).
 * Each session can have multiple clients attached simultaneously —
 * no mode switching, no remote/local distinction.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  Session,
  SessionId,
  ClientId,
  ClientType,
  ConnectedClient,
  SessionCreateOptions,
  SessionListItem,
  SessionStatus,
} from '@doublt/shared';

export class SessionManager extends EventEmitter {
  private sessions = new Map<SessionId, Session>();
  private nextIndex = 0;

  /** Context usage threshold at which to suggest handoff (0-1) */
  private readonly handoffThreshold = 0.85;

  create(options: SessionCreateOptions = {}): Session {
    const id = randomUUID().slice(0, 8);
    const now = Date.now();

    const session: Session = {
      id,
      name: options.name ?? `session-${this.nextIndex}`,
      status: 'active',
      createdAt: now,
      lastActivityAt: now,
      cwd: options.cwd ?? process.cwd(),
      clients: [],
      contextUsage: 0,
      parentSessionId: options.fromHandoff?.parentSessionId,
      handoffContext: options.fromHandoff?.handoffContent,
      workspaceId: options.workspaceId,
    };

    this.sessions.set(id, session);
    this.nextIndex++;
    this.emit('session:created', session);
    return session;
  }

  get(id: SessionId): Session | undefined {
    return this.sessions.get(id);
  }

  list(workspaceId?: string): SessionListItem[] {
    let idx = 0;
    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'archived')
      .filter(s => !workspaceId || s.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        clientCount: s.clients.length,
        contextUsage: s.contextUsage,
        lastActivityAt: s.lastActivityAt,
        cwd: s.cwd,
        index: idx++,
        workspaceId: s.workspaceId,
      }));
  }

  /**
   * Attach a client to a session. Both CLI and mobile clients can be
   * attached simultaneously — this is the key difference from Happy Coder's
   * remote/local mode split.
   */
  attachClient(sessionId: SessionId, clientId: ClientId, clientType: ClientType, deviceInfo: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove if already attached (reconnection)
    session.clients = session.clients.filter(c => c.id !== clientId);

    const client: ConnectedClient = {
      id: clientId,
      type: clientType,
      connectedAt: Date.now(),
      lastSeenAt: Date.now(),
      deviceInfo,
    };

    session.clients.push(client);
    session.lastActivityAt = Date.now();

    if (session.status === 'idle') {
      session.status = 'active';
    }

    this.emit('session:updated', session);
    this.emit('client:attached', { sessionId, clientId, clientType });
    return true;
  }

  detachClient(sessionId: SessionId, clientId: ClientId): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.clients = session.clients.filter(c => c.id !== clientId);

    if (session.clients.length === 0) {
      session.status = 'idle';
    }

    session.lastActivityAt = Date.now();
    this.emit('session:updated', session);
    this.emit('client:detached', { sessionId, clientId });
    return true;
  }

  /**
   * Update context usage for a session. When it crosses the threshold,
   * emit an event so the handoff system can prepare HANDOFF.md.
   */
  updateContextUsage(sessionId: SessionId, usage: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const previousUsage = session.contextUsage;
    session.contextUsage = Math.min(1, Math.max(0, usage));

    if (previousUsage < this.handoffThreshold && session.contextUsage >= this.handoffThreshold) {
      session.status = 'handoff_pending';
      this.emit('session:handoff_needed', session);
    }

    this.emit('session:updated', session);
  }

  /**
   * Get all clients attached to a session — used to broadcast messages
   * to both PC and mobile simultaneously.
   */
  getSessionClients(sessionId: SessionId): ConnectedClient[] {
    return this.sessions.get(sessionId)?.clients ?? [];
  }

  /**
   * Get all sessions a specific client is attached to.
   */
  getClientSessions(clientId: ClientId): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.clients.some(c => c.id === clientId));
  }

  archive(sessionId: SessionId): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'archived';
    session.clients = [];
    this.emit('session:updated', session);
    return true;
  }

  updateActivity(sessionId: SessionId): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Return all sessions as raw Session objects (for persistence).
   */
  listAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Restore sessions from persisted state. Clears connected clients
   * since no clients are present on startup.
   */
  restoreSessions(sessions: Session[]): void {
    for (const session of sessions) {
      // No clients are connected on startup
      const restored: Session = { ...session, clients: [] };
      this.sessions.set(restored.id, restored);
      // Keep nextIndex beyond the highest restored session index
      this.nextIndex++;
    }
  }

  /**
   * Remove stale clients that haven't been seen recently.
   * This prevents the "stuck remote mode" problem from Happy Coder.
   */
  pruneStaleClients(maxAgeMs: number = 60_000): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      const before = session.clients.length;
      session.clients = session.clients.filter(c => now - c.lastSeenAt < maxAgeMs);
      if (session.clients.length !== before) {
        if (session.clients.length === 0) {
          session.status = 'idle';
        }
        this.emit('session:updated', session);
      }
    }
  }
}
