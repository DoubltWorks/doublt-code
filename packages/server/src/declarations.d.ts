// Ambient module declarations for uninstalled dependencies.
// These will be replaced by actual @types packages after `pnpm install`.

declare module 'ws' {
  import { EventEmitter } from 'node:events';
  import { IncomingMessage } from 'node:http';
  import { Server as HttpServer } from 'node:http';

  class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    static readonly CLOSED: number;
    static readonly CONNECTING: number;

    readyState: number;

    constructor(address: string, options?: any);
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    terminate(): void;

    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  class WebSocketServer extends EventEmitter {
    constructor(options: { port?: number; server?: HttpServer; noServer?: boolean });
    close(cb?: (err?: Error) => void): void;
    clients: Set<WebSocket>;

    on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'close' | 'listening', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export { WebSocket, WebSocketServer };
  export default WebSocket;
}
