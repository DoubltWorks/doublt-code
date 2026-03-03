/**
 * doublt-code server — The central orchestrator.
 *
 * Architecture overview:
 * ┌─────────────────────────────────────────────────────────┐
 * │                    doublt server                        │
 * │                                                        │
 * │  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
 * │  │ SessionMgr   │  │ ConnectionMgr│  │ HandoffMgr   │  │
 * │  │ (multi-sess) │  │ (WebSocket)  │  │ (HANDOFF.md) │  │
 * │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
 * │         │                 │                 │          │
 * │         └────────┬────────┘─────────────────┘          │
 * │                  │                                     │
 * │           ┌──────┴───────┐                             │
 * │           │  Orchestrator │                             │
 * │           └──────────────┘                             │
 * │                                                        │
 * └────────┬──────────────┬────────────────────────────────┘
 *          │              │
 *    ┌─────┴─────┐  ┌────┴──────┐
 *    │  CLI (PC)  │  │  Mobile   │
 *    │  (cmux)    │  │  (phone)  │
 *    └───────────┘  └───────────┘
 *    Both connected simultaneously — no mode switching!
 */

import { SessionManager } from './session/SessionManager.js';
import { ConnectionManager } from './websocket/ConnectionManager.js';
import { HandoffManager } from './handoff/HandoffManager.js';
import { AuthManager } from './api/AuthManager.js';
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

  private port: number;
  private host: string;

  constructor(options: DoubltServerOptions = {}) {
    this.port = options.port ?? 9800;
    this.host = options.host ?? '0.0.0.0';

    this.sessionManager = new SessionManager();
    this.connectionManager = new ConnectionManager();
    this.handoffManager = new HandoffManager(this.sessionManager, options.baseDir);
    this.authManager = new AuthManager();

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
        },
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
    });
  }

  private handleClientMessage(clientId: string, msg: ClientMessage): void {
    const clientType = this.connectionManager.getClientType(clientId);

    switch (msg.type) {
      case 'session:create': {
        const session = this.sessionManager.create(msg.options);
        this.sessionManager.attachClient(session.id, clientId, clientType ?? 'cli', '');
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
        const sessions = this.sessionManager.list();
        this.connectionManager.sendToClient(clientId, {
          type: 'session:list:result',
          sessions,
        });
        break;
      }

      case 'chat:send': {
        // Broadcast the user's message to all clients attached to this session
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
        // Forward approval to all clients (the CLI will handle it)
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
    }
  }

  start(): void {
    const serverToken = this.authManager.generateServerToken();
    this.connectionManager.start(this.port);

    console.log(`doublt-code server started on port ${this.port}`);
    console.log(`Server token: ${serverToken}`);

    // Create a default session
    this.sessionManager.create({ name: 'default' });

    // Periodic cleanup
    setInterval(() => {
      this.sessionManager.pruneStaleClients();
      this.authManager.cleanup();
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
