// Ambient module declarations for uninstalled dependencies.
// These will be replaced by actual @types packages after `pnpm install`.

declare module 'ws' {
  import { EventEmitter } from 'node:events';

  class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    static readonly CLOSED: number;

    readyState: number;

    constructor(address: string, options?: any);
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    terminate(): void;

    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export { WebSocket };
  export default WebSocket;
}

declare module 'commander' {
  class Command {
    name(str: string): this;
    description(str: string): this;
    version(str: string): this;
    command(nameAndArgs: string): Command;
    option(flags: string, description?: string, defaultValue?: string | boolean): this;
    action(fn: (...args: any[]) => void | Promise<void>): this;
    parse(argv?: string[]): this;
  }
  export { Command };
}

declare module 'chalk' {
  interface Chalk {
    (text: string): string;
    bold: Chalk;
    dim: Chalk;
    red: Chalk;
    green: Chalk;
    yellow: Chalk;
    blue: Chalk;
    cyan: Chalk;
    gray: Chalk;
    white: Chalk;
  }
  const chalk: Chalk;
  export default chalk;
}

declare module 'qrcode-terminal' {
  function generate(text: string, opts?: { small?: boolean }, cb?: (qrcode: string) => void): void;
  export { generate };
}
