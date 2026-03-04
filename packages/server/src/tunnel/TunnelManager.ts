import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';

export class TunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private url: string | null = null;
  private provider: string;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(provider: 'cloudflare' | 'ngrok' = 'cloudflare') {
    super();
    this.provider = provider;
  }

  getUrl(): string | null {
    return this.url;
  }

  getProvider(): string {
    return this.provider;
  }

  async start(port: number): Promise<string> {
    if (this.process) {
      throw new Error('Tunnel already running');
    }

    return new Promise<string>((resolve, reject) => {
      // 15 second timeout
      this.timeoutId = setTimeout(() => {
        this.stop();
        const err = new Error('Tunnel startup timed out after 15s. Is cloudflared installed? Run: brew install cloudflare/cloudflare/cloudflared');
        this.emit('tunnel:error', err);
        reject(err);
      }, 15_000);

      const args = this.provider === 'cloudflare'
        ? ['tunnel', '--url', `http://localhost:${port}`]
        : ['http', `${port}`]; // ngrok fallback

      const cmd = this.provider === 'cloudflare' ? 'cloudflared' : 'ngrok';

      this.process = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const handleOutput = (data: Buffer) => {
        const text = data.toString();

        // Parse tunnel URL from output
        const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !this.url) {
          this.url = urlMatch[0];
          if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
          }
          this.emit('tunnel:ready', this.url);
          resolve(this.url);
        }
      };

      this.process.stdout?.on('data', handleOutput);
      this.process.stderr?.on('data', handleOutput);

      this.process.on('error', (err) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.process = null;
        this.url = null;

        const wrappedErr = new Error(
          `Failed to start ${cmd}. Is it installed? ` +
          (this.provider === 'cloudflare'
            ? 'Run: brew install cloudflare/cloudflare/cloudflared'
            : 'Run: brew install ngrok')
        );
        this.emit('tunnel:error', wrappedErr);
        reject(wrappedErr);
      });

      this.process.on('exit', (code) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.process = null;
        const prevUrl = this.url;
        this.url = null;
        this.emit('tunnel:stopped', { code, url: prevUrl });
      });
    });
  }

  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.url = null;
    }
  }
}
