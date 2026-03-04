/**
 * ConnectionManager — Manages WebSocket connections from all client types.
 *
 * Key design principles:
 * 1. No mode switching: CLI and mobile connections coexist
 * 2. Automatic reconnection handling (solves Happy Coder's "stuck" issue)
 * 3. Per-session message broadcasting to all attached clients
 * 4. Heartbeat-based liveness detection
 */

import { EventEmitter } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ClientId, ClientType, SessionId } from '@doublt/shared';
import {
  encodeMessage,
  decodeMessage,
  type ClientMessage,
  type ServerMessage,
  type WireMessage,
} from '@doublt/shared';

interface ClientConnection {
  id: ClientId;
  ws: WebSocket;
  type: ClientType;
  deviceInfo: string;
  authenticated: boolean;
  attachedSessions: Set<SessionId>;
  lastPong: number;
}

export class ConnectionManager extends EventEmitter {
  private clients = new Map<ClientId, ClientConnection>();
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private readonly HEARTBEAT_INTERVAL = 15_000;
  private readonly PONG_TIMEOUT = 30_000;

  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleNewConnection(ws, req);
    });

    // Heartbeat to detect dead connections (prevents Happy Coder's "stuck" problem)
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), this.HEARTBEAT_INTERVAL);

    this.emit('server:started', { port });
  }

  /**
   * Attach WebSocket server to an existing HTTP server.
   * Uses noServer mode to avoid conflicts with Express — only
   * WebSocket upgrade requests are handled, regular HTTP goes to Express.
   */
  startWithServer(server: import('node:http').Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleNewConnection(ws, req);
    });

    // Manually handle HTTP upgrade so Express and WS don't conflict
    server.on('upgrade', (req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => {
      (this.wss as any).handleUpgrade(req, socket, head, (ws: WebSocket) => {
        this.wss!.emit('connection', ws, req);
      });
    });

    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), this.HEARTBEAT_INTERVAL);

    this.emit('server:started', {});
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private handleNewConnection(ws: WebSocket, _req: IncomingMessage): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const conn: ClientConnection = {
      id: clientId,
      ws,
      type: 'cli', // updated after authentication
      deviceInfo: '',
      authenticated: false,
      attachedSessions: new Set(),
      lastPong: Date.now(),
    };

    this.clients.set(clientId, conn);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = decodeMessage(data.toString()) as ClientMessage;
        this.handleClientMessage(clientId, msg);
      } catch (err) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Failed to parse message',
        });
      }
    });

    ws.on('pong', () => {
      conn.lastPong = Date.now();
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', () => {
      this.handleDisconnection(clientId);
    });
  }

  private handleClientMessage(clientId: ClientId, msg: ClientMessage): void {
    const conn = this.clients.get(clientId);
    if (!conn) return;

    if (msg.type === 'authenticate') {
      conn.type = msg.clientType;
      conn.deviceInfo = msg.deviceInfo;
      conn.authenticated = true;
      // Emit for auth handler to validate token
      this.emit('client:authenticate', { clientId, token: msg.token, clientType: msg.clientType, deviceInfo: msg.deviceInfo });
      return;
    }

    if (!conn.authenticated) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'NOT_AUTHENTICATED',
        message: 'Authenticate first',
      });
      return;
    }

    // Track session attachments
    if (msg.type === 'session:attach') {
      conn.attachedSessions.add(msg.sessionId);
    } else if (msg.type === 'session:detach') {
      conn.attachedSessions.delete(msg.sessionId);
    }

    // Forward all authenticated messages to the main event handler
    this.emit('client:message', { clientId, message: msg });
  }

  private handleDisconnection(clientId: ClientId): void {
    const conn = this.clients.get(clientId);
    if (!conn) return;

    this.emit('client:disconnected', {
      clientId,
      clientType: conn.type,
      attachedSessions: Array.from(conn.attachedSessions),
    });

    this.clients.delete(clientId);
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(clientId: ClientId, msg: ServerMessage): boolean {
    const conn = this.clients.get(clientId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;

    conn.ws.send(encodeMessage(msg));
    return true;
  }

  /**
   * Broadcast a message to ALL clients attached to a session.
   * This is what enables simultaneous PC + mobile interaction.
   */
  broadcastToSession(sessionId: SessionId, msg: ServerMessage, excludeClient?: ClientId): void {
    for (const conn of this.clients.values()) {
      if (conn.attachedSessions.has(sessionId) && conn.id !== excludeClient) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(encodeMessage(msg));
        }
      }
    }
  }

  /**
   * Broadcast to all authenticated clients (for session list updates, etc.)
   */
  broadcastToAll(msg: ServerMessage): void {
    for (const conn of this.clients.values()) {
      if (conn.authenticated && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(encodeMessage(msg));
      }
    }
  }

  /**
   * Heartbeat check — disconnects clients that haven't responded.
   * This solves Happy Coder's "stuck remote mode" issue where
   * a disconnected phone leaves the session in a broken state.
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [clientId, conn] of this.clients) {
      if (now - conn.lastPong > this.PONG_TIMEOUT) {
        conn.ws.terminate();
        this.handleDisconnection(clientId);
      } else {
        conn.ws.ping();
      }
    }
  }

  getClientType(clientId: ClientId): ClientType | undefined {
    return this.clients.get(clientId)?.type;
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }
}
