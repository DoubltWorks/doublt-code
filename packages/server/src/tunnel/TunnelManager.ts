import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';

const MAX_RESTART_ATTEMPTS = 3;
const STARTUP_TIMEOUT = 15_000;

export class TunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private url: string | null = null;
  private provider: 'cloudflare' | 'ngrok';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private restartCount = 0;
  private port: number | null = null;
  private stopping = false;
  private fallingBack = false;

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

    this.port = port;
    this.stopping = false;
    this.fallingBack = false;
    this.restartCount = 0;

    return this.startProcess(port);
  }

  private startProcess(port: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.clearTimeout();

      this.timeoutId = setTimeout(() => {
        // Set fallingBack before kill to prevent exit handler from triggering restart
        const willFallback = this.provider === 'cloudflare' && !this.stopping;
        if (willFallback) this.fallingBack = true;

        this.killProcess();

        // Try ngrok fallback if cloudflare timed out
        if (willFallback) {
          this.provider = 'ngrok';
          this.emit('tunnel:fallback', { from: 'cloudflare', to: 'ngrok' });
          this.startProcess(port).then(resolve, reject).finally(() => { this.fallingBack = false; });
          return;
        }

        const err = new Error(
          `Tunnel startup timed out after ${STARTUP_TIMEOUT / 1000}s. ` +
          `Is ${this.provider === 'cloudflare' ? 'cloudflared' : 'ngrok'} installed?`
        );
        this.emit('tunnel:error', err);
        reject(err);
      }, STARTUP_TIMEOUT);

      const cmd = this.provider === 'cloudflare' ? 'cloudflared' : 'ngrok';
      const args = this.provider === 'cloudflare'
        ? ['tunnel', '--url', `http://localhost:${port}`]
        : ['http', `${port}`, '--log=stdout'];

      this.process = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        const urlPattern = this.provider === 'cloudflare'
          ? /https:\/\/[a-z0-9-]+\.trycloudflare\.com/
          : /https:\/\/[a-z0-9-]+\.ngrok[a-z.-]*\.(?:io|app)/;

        const urlMatch = text.match(urlPattern);
        if (urlMatch && !this.url) {
          this.url = urlMatch[0];
          this.clearTimeout();
          this.restartCount = 0;
          this.emit('tunnel:ready', this.url);
          resolve(this.url);
        }
      };

      this.process.stdout?.on('data', handleOutput);
      this.process.stderr?.on('data', handleOutput);

      this.process.on('error', (err) => {
        this.clearTimeout();
        this.process = null;
        this.url = null;

        // Try ngrok fallback if cloudflare is not found
        if (this.provider === 'cloudflare' && !this.stopping) {
          this.fallingBack = true;
          this.provider = 'ngrok';
          this.emit('tunnel:fallback', { from: 'cloudflare', to: 'ngrok' });
          this.startProcess(port).then(resolve, reject).finally(() => { this.fallingBack = false; });
          return;
        }

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
        this.clearTimeout();
        this.process = null;
        const prevUrl = this.url;
        this.url = null;
        this.emit('tunnel:stopped', { code, url: prevUrl });

        // Auto-restart on crash (not on graceful stop or fallback)
        if (!this.stopping && !this.fallingBack && this.port !== null && this.restartCount < MAX_RESTART_ATTEMPTS) {
          this.restartCount++;
          const delay = Math.pow(2, this.restartCount) * 1000; // exponential backoff: 2s, 4s, 8s
          this.emit('tunnel:restarting', { attempt: this.restartCount, delay });
          setTimeout(() => {
            if (!this.stopping && this.port !== null) {
              this.startProcess(this.port).catch((err) => {
                this.emit('tunnel:error', err);
              });
            }
          }, delay);
        }
      });
    });
  }

  stop(): void {
    this.stopping = true;
    this.clearTimeout();
    this.killProcess();
  }

  private killProcess(): void {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Already dead
      }

      // Force kill after 3 seconds if still alive
      const proc = this.process;
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Already dead
        }
      }, 3000);

      this.process = null;
      this.url = null;
    }
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
