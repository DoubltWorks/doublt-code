/**
 * DoubltClient — Mobile WebSocket client for doublt-code.
 *
 * Connects to the doublt server from the mobile app.
 * Unlike Happy Coder's separate remote mode, this client
 * connects as a co-participant alongside the CLI — both can
 * send messages and receive updates simultaneously.
 */

import { EventEmitter } from 'events';
import type {
  ClientMessage,
  ServerMessage,
  SessionId,
  SessionListItem,
  ChatMessage,
} from '@doublt/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class DoubltClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private serverUrl: string = '';
  private token: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 15;

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Connect to server using pairing info (from QR code scan).
   */
  connectWithPairing(host: string, port: number, pairingCode: string): void {
    this.serverUrl = `ws://${host}:${port}`;
    // In a real implementation, the pairing code would be exchanged
    // for a token via an HTTP endpoint first
    this.token = pairingCode;
    this.connect();
  }

  connectWithToken(serverUrl: string, token: string): void {
    this.serverUrl = serverUrl;
    this.token = token;
    this.connect();
  }

  private connect(): void {
    if (this.state === 'connecting') return;
    this.state = 'connecting';
    this.emit('stateChanged', this.state);

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        // Authenticate as mobile client
        this.sendRaw({
          type: 'authenticate',
          token: this.token,
          clientType: 'mobile',
          deviceInfo: 'mobile-app',
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          this.handleMessage(msg);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => this.handleDisconnect();
      this.ws.onerror = () => this.handleDisconnect();
    } catch {
      this.handleDisconnect();
    }
  }

  disconnect(): void {
    this.state = 'disconnected';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit('stateChanged', this.state);
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'auth:result':
        if (msg.success) {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.emit('stateChanged', this.state);
          this.emit('connected');
          // Request session list
          this.listSessions();
        } else {
          this.emit('authFailed', msg.error);
          this.disconnect();
        }
        break;

      case 'session:list:result':
        this.emit('sessionsUpdated', msg.sessions);
        break;

      case 'session:updated':
        this.emit('sessionUpdated', msg.session);
        break;

      case 'session:created':
        this.emit('sessionCreated', msg.session);
        break;

      case 'chat:message':
        this.emit('chatMessage', msg.message);
        break;

      case 'chat:stream':
        this.emit('chatStream', {
          sessionId: msg.sessionId,
          messageId: msg.messageId,
          delta: msg.delta,
          done: msg.done,
        });
        break;

      case 'tool:use':
        this.emit('toolUse', msg.tool);
        break;

      case 'notification':
        this.emit('notification', msg.notification);
        break;

      case 'handoff:ready':
        this.emit('handoffReady', {
          parentSessionId: msg.parentSessionId,
          newSessionId: msg.newSessionId,
          summary: msg.handoffSummary,
        });
        break;

      case 'error':
        this.emit('serverError', { code: msg.code, message: msg.message });
        break;
    }
  }

  private handleDisconnect(): void {
    if (this.state === 'disconnected') return;

    this.ws = null;
    this.state = 'reconnecting';
    this.emit('stateChanged', this.state);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

      this.reconnectTimer = setTimeout(() => {
        this.state = 'disconnected';
        this.connect();
      }, delay);
    } else {
      this.state = 'disconnected';
      this.emit('stateChanged', this.state);
      this.emit('reconnectFailed');
    }
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ─── Public API ───────────────────────────────────

  listSessions(): void {
    this.sendRaw({ type: 'session:list' });
  }

  attachSession(sessionId: SessionId): void {
    this.sendRaw({ type: 'session:attach', sessionId });
  }

  detachSession(sessionId: SessionId): void {
    this.sendRaw({ type: 'session:detach', sessionId });
  }

  sendMessage(sessionId: SessionId, content: string): void {
    this.sendRaw({ type: 'chat:send', sessionId, content });
  }

  approveTool(sessionId: SessionId, toolUseId: string, approved: boolean): void {
    this.sendRaw({ type: 'tool:approve', sessionId, toolUseId, approved });
  }

  triggerHandoff(sessionId: SessionId): void {
    this.sendRaw({ type: 'handoff:trigger', sessionId });
  }
}
