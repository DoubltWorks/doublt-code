/**
 * DoubltClient — Mobile WebSocket client for doublt-code.
 *
 * Connects to the doublt server from the mobile app.
 * Unlike Happy Coder's separate remote mode, this client
 * connects as a co-participant alongside the CLI — both can
 * send messages and receive updates simultaneously.
 *
 * Extended with:
 * - Workspace management (list, create, switch)
 * - Terminal I/O sync (view PC terminal output on mobile)
 * - Push notification token registration
 * - Long-running command tracking
 */

import { EventEmitter } from 'events';
import type {
  ClientMessage,
  ServerMessage,
  SessionId,
  WorkspaceId,
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

  connectWithPairing(host: string, port: number, pairingCode: string): void {
    this.serverUrl = `ws://${host}:${port}`;
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
          this.listSessions();
          this.listWorkspaces();
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

      // Workspace messages
      case 'workspace:list:result':
        this.emit('workspacesUpdated', msg.workspaces);
        break;
      case 'workspace:created':
        this.emit('workspaceCreated', msg.workspace);
        break;
      case 'workspace:updated':
        this.emit('workspaceUpdated', msg.workspace);
        break;
      case 'workspace:deleted':
        this.emit('workspaceDeleted', msg.workspaceId);
        break;

      // Terminal sync
      case 'terminal:output':
        this.emit('terminalOutput', msg.output);
        break;
      case 'terminal:resized':
        this.emit('terminalResized', msg.resize);
        break;

      // Command tracking
      case 'command:status':
        this.emit('commandStatus', msg.command);
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

  // ─── Session API ────────────────────────────────────

  listSessions(workspaceId?: WorkspaceId): void {
    this.sendRaw({ type: 'session:list', workspaceId });
  }

  attachSession(sessionId: SessionId): void {
    this.sendRaw({ type: 'session:attach', sessionId });
  }

  detachSession(sessionId: SessionId): void {
    this.sendRaw({ type: 'session:detach', sessionId });
  }

  createSession(name?: string, workspaceId?: WorkspaceId): void {
    this.sendRaw({ type: 'session:create', options: { name, workspaceId } });
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

  // ─── Workspace API ──────────────────────────────────

  listWorkspaces(): void {
    this.sendRaw({ type: 'workspace:list' });
  }

  createWorkspace(name?: string, cwd?: string): void {
    this.sendRaw({ type: 'workspace:create', options: { name, cwd } });
  }

  deleteWorkspace(workspaceId: WorkspaceId): void {
    this.sendRaw({ type: 'workspace:delete', workspaceId });
  }

  renameWorkspace(workspaceId: WorkspaceId, name: string): void {
    this.sendRaw({ type: 'workspace:rename', workspaceId, name });
  }

  // ─── Terminal sync API ──────────────────────────────

  sendTerminalInput(sessionId: SessionId, data: string): void {
    this.sendRaw({
      type: 'terminal:input',
      input: { sessionId, data, timestamp: Date.now() },
    });
  }

  // ─── Push notification API ──────────────────────────

  registerPushToken(pushToken: string, platform: 'ios' | 'android'): void {
    this.sendRaw({ type: 'push:register', pushToken, platform });
  }

  unregisterPushToken(): void {
    this.sendRaw({ type: 'push:unregister' });
  }
}
