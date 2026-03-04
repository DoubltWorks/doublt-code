/**
 * ServerBridge — Connects the CLI to the doublt server via WebSocket.
 *
 * Maintains a persistent connection with automatic reconnection.
 * Unlike Happy Coder's approach where reconnection failures cause
 * "stuck" states, this bridge handles disconnects gracefully and
 * can operate in a degraded local-only mode if the server is down.
 *
 * Extended with workspace management and terminal sync support.
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import {
  encodeMessage,
  decodeMessage,
  type ClientMessage,
  type ServerMessage,
} from '@doublt/shared';
import type { SessionId, WorkspaceId, WorkspaceCreateOptions, TerminalInput, TerminalResize } from '@doublt/shared';

export interface BridgeOptions {
  serverUrl: string;
  token: string;
  deviceInfo?: string;
  reconnectMaxAttempts?: number;
  reconnectBaseDelay?: number;
}

type BridgeState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting';

export class ServerBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: BridgeState = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly baseDelay: number;
  private readonly serverUrl: string;
  private readonly token: string;
  private readonly deviceInfo: string;
  private clientId: string | null = null;
  private pendingMessages: ClientMessage[] = [];

  constructor(options: BridgeOptions) {
    super();
    this.serverUrl = options.serverUrl;
    this.token = options.token;
    this.deviceInfo = options.deviceInfo ?? `cli-${process.pid}`;
    this.maxReconnectAttempts = options.reconnectMaxAttempts ?? 10;
    this.baseDelay = options.reconnectBaseDelay ?? 1000;
  }

  get connected(): boolean {
    return this.state === 'connected';
  }

  get currentClientId(): string | null {
    return this.clientId;
  }

  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') return;

    this.state = 'connecting';
    this.emit('state:changed', this.state);

    this.ws = new WebSocket(this.serverUrl);

    this.ws.on('open', () => {
      this.state = 'authenticating';
      this.emit('state:changed', this.state);

      // Authenticate immediately
      this.sendRaw({
        type: 'authenticate',
        token: this.token,
        clientType: 'cli',
        deviceInfo: this.deviceInfo,
      });
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = decodeMessage(data.toString()) as ServerMessage;
        this.handleMessage(msg);
      } catch {
        // Ignore parse errors
      }
    });

    this.ws.on('close', () => {
      this.handleDisconnect();
    });

    this.ws.on('error', () => {
      this.handleDisconnect();
    });

    this.ws.on('pong', () => {
      // Connection is alive
    });
  }

  disconnect(): void {
    this.state = 'disconnected';
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit('state:changed', this.state);
  }

  send(msg: ClientMessage): void {
    if (this.state !== 'connected') {
      this.pendingMessages.push(msg);
      return;
    }
    this.sendRaw(msg);
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(msg));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    if (msg.type === 'auth:result') {
      if (msg.success) {
        this.state = 'connected';
        this.clientId = msg.clientId ?? null;
        this.reconnectAttempts = 0;
        this.emit('state:changed', this.state);
        this.emit('connected', { clientId: this.clientId });

        // Flush pending messages
        for (const pending of this.pendingMessages) {
          this.sendRaw(pending);
        }
        this.pendingMessages = [];
      } else {
        this.emit('auth:failed', msg.error);
        this.disconnect();
      }
      return;
    }

    // Forward all other messages
    this.emit('message', msg);
    this.emit(`message:${msg.type}`, msg);
  }

  private handleDisconnect(): void {
    if (this.state === 'disconnected') return;

    const wasConnected = this.state === 'connected';
    this.state = 'reconnecting';
    this.ws = null;

    if (wasConnected) {
      this.emit('disconnected');
    }

    // Attempt reconnection with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
      this.reconnectAttempts++;
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

      setTimeout(() => {
        if (this.state === 'reconnecting') {
          this.state = 'disconnected';
          this.connect();
        }
      }, delay);
    } else {
      this.state = 'disconnected';
      this.emit('state:changed', this.state);
      this.emit('reconnect:exhausted');
    }
  }

  // ─── Session convenience methods ─────────────────────

  createSession(name?: string, cwd?: string, workspaceId?: string): void {
    this.send({ type: 'session:create', options: { name, cwd, workspaceId } });
  }

  attachSession(sessionId: SessionId): void {
    this.send({ type: 'session:attach', sessionId });
  }

  detachSession(sessionId: SessionId): void {
    this.send({ type: 'session:detach', sessionId });
  }

  listSessions(workspaceId?: WorkspaceId): void {
    this.send({ type: 'session:list', workspaceId });
  }

  sendChat(sessionId: SessionId, content: string): void {
    this.send({ type: 'chat:send', sessionId, content });
  }

  approveTool(sessionId: SessionId, toolUseId: string, approved: boolean): void {
    this.send({ type: 'tool:approve', sessionId, toolUseId, approved });
  }

  triggerHandoff(sessionId: SessionId): void {
    this.send({ type: 'handoff:trigger', sessionId });
  }

  // ─── Workspace convenience methods ───────────────────

  createWorkspace(name?: string, cwd?: string): void {
    this.send({ type: 'workspace:create', options: { name, cwd } });
  }

  listWorkspaces(): void {
    this.send({ type: 'workspace:list' });
  }

  deleteWorkspace(workspaceId: WorkspaceId): void {
    this.send({ type: 'workspace:delete', workspaceId });
  }

  renameWorkspace(workspaceId: WorkspaceId, name: string): void {
    this.send({ type: 'workspace:rename', workspaceId, name });
  }

  // ─── Terminal sync convenience methods ───────────────

  sendTerminalInput(sessionId: SessionId, data: string): void {
    this.send({
      type: 'terminal:input',
      input: {
        sessionId,
        data,
        sourceClientId: this.clientId ?? undefined,
        timestamp: Date.now(),
      },
    });
  }

  sendTerminalResize(sessionId: SessionId, cols: number, rows: number): void {
    this.send({
      type: 'terminal:resize',
      resize: { sessionId, cols, rows },
    });
  }

  requestScrollback(sessionId: SessionId, offset?: number): void {
    this.send({ type: 'terminal:scrollback:request', sessionId, offset });
  }
}
