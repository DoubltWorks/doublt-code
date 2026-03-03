/**
 * doublt-code server — The central orchestrator.
 *
 * Architecture overview:
 * ┌───────────────────────────────────────────────────────────────────┐
 * │                        doublt server                              │
 * │                                                                   │
 * │  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐               │
 * │  │ SessionMgr   │ │ ConnectionMgr│ │ HandoffMgr   │               │
 * │  │ (multi-sess) │ │ (WebSocket)  │ │ (HANDOFF.md) │               │
 * │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘               │
 * │         │                │                │                       │
 * │  ┌──────┴───────┐ ┌─────┴────────┐ ┌─────┴──────────┐            │
 * │  │ WorkspaceMgr │ │ TerminalSync │ │ NotificationMgr│            │
 * │  │ (workspaces) │ │ (I/O sync)   │ │ (push/in-app)  │            │
 * │  └──────┬───────┘ └──────┬───────┘ └──────┬─────────┘            │
 * │         │                │                │                       │
 * │         └────────┬───────┘────────────────┘                       │
 * │                  │                                                │
 * │           ┌──────┴───────┐                                        │
 * │           │  Orchestrator │                                        │
 * │           └──────────────┘                                        │
 * │                                                                   │
 * └────────┬──────────────┬───────────────────────────────────────────┘
 *          │              │
 *    ┌─────┴─────┐  ┌────┴──────┐
 *    │  CLI (PC)  │  │  Mobile   │
 *    │ (doubltmux)│  │  (phone)  │
 *    └───────────┘  └───────────┘
 *    Both connected simultaneously — no mode switching!
 */

import { SessionManager } from './session/SessionManager.js';
import { ConnectionManager } from './websocket/ConnectionManager.js';
import { HandoffManager } from './handoff/HandoffManager.js';
import { AuthManager } from './api/AuthManager.js';
import { WorkspaceManager } from './workspace/WorkspaceManager.js';
import { TerminalSyncManager } from './terminal/TerminalSyncManager.js';
import { NotificationManager } from './notification/NotificationManager.js';
import type { ClientMessage, ServerMessage } from '@doublt/shared';

export interface DoubltServerOptions {
  port?: number;
  host?: string;
  baseDir?: string;
}

export class DoubltServer {
  readonly sessionManager: SessionManager;
  readonly connectionManager: ConnectionManager;
  readonly handoffManager: HandoffManager;
  readonly authManager: AuthManager;
  readonly workspaceManager: WorkspaceManager;
  readonly terminalSyncManager: TerminalSyncManager;
  readonly notificationManager: NotificationManager;

  private port: number;
  private host: string;

  constructor(options: DoubltServerOptions = {}) {
    this.port = options.port ?? 9800;
    this.host = options.host ?? '0.0.0.0';

    this.sessionManager = new SessionManager();
    this.connectionManager = new ConnectionManager();
    this.handoffManager = new HandoffManager(this.sessionManager, options.baseDir);
    this.authManager = new AuthManager();
    this.workspaceManager = new WorkspaceManager(this.sessionManager);
    this.terminalSyncManager = new TerminalSyncManager();
    this.notificationManager = new NotificationManager();

    this.wireUpEvents();
  }

  private wireUpEvents(): void {
    // ─── Authentication ───────────────────────────────

    this.connectionManager.on('client:authenticate', ({ clientId, token, clientType, deviceInfo }) => {
      const valid = this.authManager.validateToken(token);
      this.connectionManager.sendToClient(clientId, {
        type: 'auth:result',
        success: valid,
        clientId: valid ? clientId : undefined,
        error: valid ? undefined : 'Invalid token',
      });

      if (valid) {
        this.notificationManager.setClientConnected(clientId, true);
      }
    });

    // ─── Client Messages ──────────────────────────────

    this.connectionManager.on('client:message', ({ clientId, message }: { clientId: string; message: ClientMessage }) => {
      this.handleClientMessage(clientId, message);
    });

    // ─── Client Disconnection ─────────────────────────

    this.connectionManager.on('client:disconnected', ({ clientId, attachedSessions }) => {
      for (const sessionId of attachedSessions) {
        this.sessionManager.detachClient(sessionId, clientId);
      }
      this.notificationManager.setClientConnected(clientId, false);
    });

    // ─── Session Updates → Broadcast ──────────────────

    this.sessionManager.on('session:updated', (session) => {
      this.connectionManager.broadcastToAll({
        type: 'session:updated',
        session: {
          id: session.id,
          name: session.name,
          status: session.status,
          clientCount: session.clients.length,
          contextUsage: session.contextUsage,
          lastActivityAt: session.lastActivityAt,
          cwd: session.cwd,
          index: 0, // recalculated on list
          workspaceId: session.workspaceId,
        },
      });
    });

    // ─── Workspace Updates → Broadcast ────────────────

    this.workspaceManager.on('workspace:updated', (workspace) => {
      this.connectionManager.broadcastToAll({
        type: 'workspace:updated',
        workspace: this.workspaceManager.toListItem(workspace),
      });
    });

    this.workspaceManager.on('workspace:deleted', (workspaceId) => {
      this.connectionManager.broadcastToAll({
        type: 'workspace:deleted',
        workspaceId,
      });
    });

    // ─── Handoff Completion → Notify clients ──────────

    this.handoffManager.on('handoff:completed', (result) => {
      this.connectionManager.broadcastToAll({
        type: 'handoff:ready',
        parentSessionId: result.parentSessionId,
        newSessionId: result.newSessionId,
        handoffSummary: result.summary,
      });
      this.notificationManager.notifyHandoffReady(result.parentSessionId, result.newSessionId);
    });

    // ─── Context High → Notify ────────────────────────

    this.sessionManager.on('session:handoff_needed', (session) => {
      this.notificationManager.notifyContextHigh(session.id, session.contextUsage);
    });

    // ─── Terminal Sync Events ─────────────────────────

    this.terminalSyncManager.on('terminal:output', (output) => {
      this.connectionManager.broadcastToSession(output.sessionId, {
        type: 'terminal:output',
        output,
      }, output.sourceClientId);
    });

    this.terminalSyncManager.on('terminal:input', (input) => {
      this.connectionManager.broadcastToSession(input.sessionId, {
        type: 'terminal:output',
        output: {
          sessionId: input.sessionId,
          chunkId: 0,
          data: input.data,
          sourceClientId: input.sourceClientId,
          timestamp: input.timestamp,
        },
      }, input.sourceClientId);
    });

    this.terminalSyncManager.on('terminal:resized', (resize) => {
      this.connectionManager.broadcastToSession(resize.sessionId, {
        type: 'terminal:resized',
        resize,
      });
    });

    // ─── Long-running Command Notifications ───────────

    this.terminalSyncManager.on('command:status', (command) => {
      this.connectionManager.broadcastToSession(command.sessionId, {
        type: 'command:status',
        command,
      });
    });

    this.terminalSyncManager.on('command:completed_notification', (command) => {
      this.notificationManager.notifyCommandComplete(command);
    });

    // ─── Notification Pipeline → WebSocket ────────────

    this.notificationManager.on('notification:send', (notification) => {
      this.connectionManager.broadcastToSession(notification.sessionId, {
        type: 'notification',
        notification,
      });
    });
  }

  private handleClientMessage(clientId: string, msg: ClientMessage): void {
    const clientType = this.connectionManager.getClientType(clientId);

    switch (msg.type) {
      case 'session:create': {
        const session = this.sessionManager.create(msg.options);
        this.sessionManager.attachClient(session.id, clientId, clientType ?? 'cli', '');

        // If workspace specified, add session to workspace
        if (msg.options.workspaceId) {
          this.workspaceManager.addSession(msg.options.workspaceId, session.id);
        }

        this.connectionManager.sendToClient(clientId, {
          type: 'session:created',
          session: {
            id: session.id,
            name: session.name,
            status: session.status,
            clientCount: 1,
            contextUsage: 0,
            lastActivityAt: session.lastActivityAt,
            cwd: session.cwd,
            index: 0,
            workspaceId: session.workspaceId,
          },
        });
        break;
      }

      case 'session:attach': {
        const ok = this.sessionManager.attachClient(
          msg.sessionId, clientId, clientType ?? 'cli', ''
        );
        if (!ok) {
          this.connectionManager.sendToClient(clientId, {
            type: 'error',
            code: 'SESSION_NOT_FOUND',
            message: `Session ${msg.sessionId} not found`,
            sessionId: msg.sessionId,
          });
        }
        break;
      }

      case 'session:detach': {
        this.sessionManager.detachClient(msg.sessionId, clientId);
        break;
      }

      case 'session:list': {
        const sessions = this.sessionManager.list(msg.workspaceId);
        this.connectionManager.sendToClient(clientId, {
          type: 'session:list:result',
          sessions,
        });
        break;
      }

      case 'chat:send': {
        this.sessionManager.updateActivity(msg.sessionId);
        this.connectionManager.broadcastToSession(msg.sessionId, {
          type: 'chat:message',
          message: {
            id: `msg-${Date.now()}`,
            sessionId: msg.sessionId,
            role: 'user',
            content: msg.content,
            timestamp: Date.now(),
            sourceClient: { id: clientId, type: clientType ?? 'cli' },
          },
        });
        break;
      }

      case 'tool:approve': {
        this.connectionManager.broadcastToSession(msg.sessionId, {
          type: 'tool:use',
          tool: {
            id: msg.toolUseId,
            sessionId: msg.sessionId,
            toolName: 'approval',
            input: { approved: msg.approved },
            status: msg.approved ? 'completed' : 'failed',
            timestamp: Date.now(),
          },
        }, clientId);
        break;
      }

      case 'handoff:trigger': {
        this.handoffManager.prepareHandoff(msg.sessionId).catch(err => {
          this.connectionManager.sendToClient(clientId, {
            type: 'error',
            code: 'HANDOFF_FAILED',
            message: err.message,
            sessionId: msg.sessionId,
          });
        });
        break;
      }

      // ─── Workspace messages ──────────────────────────

      case 'workspace:create': {
        const workspace = this.workspaceManager.create(msg.options);
        this.connectionManager.sendToClient(clientId, {
          type: 'workspace:created',
          workspace: this.workspaceManager.toListItem(workspace),
        });
        // Also broadcast to all clients
        this.connectionManager.broadcastToAll({
          type: 'workspace:created',
          workspace: this.workspaceManager.toListItem(workspace),
        });
        break;
      }

      case 'workspace:list': {
        const workspaces = this.workspaceManager.list();
        this.connectionManager.sendToClient(clientId, {
          type: 'workspace:list:result',
          workspaces,
        });
        break;
      }

      case 'workspace:delete': {
        this.workspaceManager.archive(msg.workspaceId);
        break;
      }

      case 'workspace:rename': {
        this.workspaceManager.rename(msg.workspaceId, msg.name);
        break;
      }

      // ─── Terminal sync messages ──────────────────────

      case 'terminal:input': {
        this.terminalSyncManager.handleInput(msg.input);
        break;
      }

      case 'terminal:resize': {
        this.terminalSyncManager.handleResize(msg.resize);
        break;
      }

      // ─── Push notification registration ──────────────

      case 'push:register': {
        this.notificationManager.registerPushToken(clientId, msg.pushToken, msg.platform);
        break;
      }

      case 'push:unregister': {
        this.notificationManager.unregisterPushToken(clientId);
        break;
      }
    }
  }

  start(): void {
    const serverToken = this.authManager.generateServerToken();
    this.connectionManager.start(this.port);

    console.log(`doublt-code server started on port ${this.port}`);
    console.log(`Server token: ${serverToken}`);

    // Create a default workspace and session
    const defaultWorkspace = this.workspaceManager.create({ name: 'default' });
    const defaultSession = this.sessionManager.create({
      name: 'default',
      workspaceId: defaultWorkspace.id,
    });
    this.workspaceManager.addSession(defaultWorkspace.id, defaultSession.id);

    // Periodic cleanup
    setInterval(() => {
      this.sessionManager.pruneStaleClients();
      this.authManager.cleanup();
      this.notificationManager.cleanup();
    }, 30_000);
  }

  stop(): void {
    this.connectionManager.stop();
  }

  /**
   * Get pairing info for mobile connection.
   */
  getPairingInfo(): { url: string; code: string } {
    const { url, code } = this.authManager.generatePairingUrl(this.host, this.port);
    return { url, code };
  }
}

// CLI entry point
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const port = parseInt(process.env.DOUBLT_PORT ?? '9800', 10);
  const server = new DoubltServer({ port });
  server.start();

  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}

export { SessionManager } from './session/SessionManager.js';
export { ConnectionManager } from './websocket/ConnectionManager.js';
export { HandoffManager } from './handoff/HandoffManager.js';
export { AuthManager } from './api/AuthManager.js';
export { WorkspaceManager } from './workspace/WorkspaceManager.js';
export { TerminalSyncManager } from './terminal/TerminalSyncManager.js';
export { NotificationManager } from './notification/NotificationManager.js';
