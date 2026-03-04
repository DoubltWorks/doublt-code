/**
 * PtyManager — Manages pseudo-terminal processes per session.
 *
 * Each session gets its own PTY (pseudo-terminal) that spawns a real shell.
 * PTY output is piped to TerminalSyncManager for broadcasting to all clients.
 * Client input is piped to the PTY stdin.
 *
 * This is what makes doubltmux a real terminal multiplexer, not just a
 * chat interface.
 */

import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import os from 'node:os';
import type { SessionId } from '@doublt/shared';
import type { TerminalSyncManager } from './TerminalSyncManager.js';

/** node-pty types (ambient — real types come from @types/node-pty after install) */
interface IPty {
  pid: number;
  cols: number;
  rows: number;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

interface IPtySpawnOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

interface IPtyModule {
  spawn: (file: string, args: string[], options: IPtySpawnOptions) => IPty;
}

/** Default scrollback buffer size (lines approximation via chunks) */
const DEFAULT_SCROLLBACK_CHUNKS = 1000;

/** Grace period before SIGKILL after SIGTERM (ms) */
const KILL_TIMEOUT = 5000;

export interface PtySessionInfo {
  sessionId: SessionId;
  pid: number;
  shell: string;
  cwd: string;
  alive: boolean;
  createdAt: number;
}

export class PtyManager extends EventEmitter {
  private ptys = new Map<SessionId, IPty>();
  private disposers = new Map<SessionId, Array<{ dispose: () => void }>>();
  private sessionInfo = new Map<SessionId, PtySessionInfo>();
  private ptyModule: IPtyModule | null = null;

  constructor(private terminalSync: TerminalSyncManager) {
    super();
  }

  /**
   * Lazy-load node-pty module. This allows the server to start even if
   * node-pty is not installed (graceful degradation).
   */
  private async loadPtyModule(): Promise<IPtyModule> {
    if (this.ptyModule) return this.ptyModule;
    try {
      // Dynamic import to avoid build-time dependency
      this.ptyModule = await import('node-pty') as unknown as IPtyModule;
      return this.ptyModule;
    } catch {
      throw new Error(
        'node-pty is not installed. Run: pnpm add node-pty\n' +
        'node-pty requires native build tools (node-gyp, python, C++ compiler).'
      );
    }
  }

  /**
   * Spawn a PTY for a session. Creates a real shell process.
   */
  async spawn(sessionId: SessionId, options: {
    shell?: string;
    cwd?: string;
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
  } = {}): Promise<PtySessionInfo> {
    // Don't double-spawn
    if (this.ptys.has(sessionId)) {
      const existing = this.sessionInfo.get(sessionId)!;
      if (existing.alive) return existing;
      // Dead PTY — clean up and respawn
      this.cleanup(sessionId);
    }

    const nodePty = await this.loadPtyModule();

    let shell = options.shell || process.env.SHELL || '/bin/zsh';
    if (!existsSync(shell)) {
      console.warn(`[PTY] Shell not found: ${shell}, falling back to /bin/sh`);
      shell = '/bin/sh';
    }
    let cwd = options.cwd || process.cwd();
    if (!existsSync(cwd)) {
      console.warn(`[PTY] cwd not found: ${cwd}, falling back to ${os.homedir()}`);
      cwd = os.homedir();
    }
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    const pty = nodePty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env as Record<string, string>,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...options.env,
      },
    });

    const disposers: Array<{ dispose: () => void }> = [];

    // PTY stdout → TerminalSyncManager → broadcast to all clients
    const dataDisposer = pty.onData((data: string) => {
      this.terminalSync.handleOutput(sessionId, data, `pty-${sessionId}`);
    });
    disposers.push(dataDisposer);

    // PTY exit handler
    const exitDisposer = pty.onExit(({ exitCode, signal }) => {
      const info = this.sessionInfo.get(sessionId);
      if (info) {
        info.alive = false;
      }
      this.emit('pty:exited', { sessionId, exitCode, signal });
      this.cleanup(sessionId);
    });
    disposers.push(exitDisposer);

    this.ptys.set(sessionId, pty);
    this.disposers.set(sessionId, disposers);

    const info: PtySessionInfo = {
      sessionId,
      pid: pty.pid,
      shell,
      cwd,
      alive: true,
      createdAt: Date.now(),
    };
    this.sessionInfo.set(sessionId, info);

    this.emit('pty:spawned', info);
    return info;
  }

  /**
   * Write data to a session's PTY stdin.
   * This is how client input reaches the shell.
   */
  write(sessionId: SessionId, data: string): boolean {
    const pty = this.ptys.get(sessionId);
    if (!pty) return false;
    pty.write(data);
    return true;
  }

  /**
   * Resize a session's PTY.
   */
  resize(sessionId: SessionId, cols: number, rows: number): boolean {
    const pty = this.ptys.get(sessionId);
    if (!pty) return false;
    try {
      pty.resize(cols, rows);
      return true;
    } catch {
      // PTY might already be dead
      return false;
    }
  }

  /**
   * Get info about a session's PTY.
   */
  getInfo(sessionId: SessionId): PtySessionInfo | undefined {
    return this.sessionInfo.get(sessionId);
  }

  /**
   * Check if a session has an active PTY.
   */
  isAlive(sessionId: SessionId): boolean {
    return this.sessionInfo.get(sessionId)?.alive ?? false;
  }

  /**
   * Kill a session's PTY process gracefully.
   * Sends SIGTERM first, then SIGKILL after timeout.
   * Disposes spawn-time handlers first to prevent double cleanup.
   */
  async kill(sessionId: SessionId): Promise<void> {
    const pty = this.ptys.get(sessionId);
    if (!pty) return;

    const info = this.sessionInfo.get(sessionId);
    if (info) info.alive = false;

    // Dispose spawn-time handlers to prevent double cleanup/event emission
    const spawnDisposers = this.disposers.get(sessionId);
    if (spawnDisposers) {
      for (const d of spawnDisposers) {
        try { d.dispose(); } catch { /* ignore */ }
      }
    }
    this.disposers.delete(sessionId);

    return new Promise<void>((resolve) => {
      let killed = false;

      const forceKillTimer = setTimeout(() => {
        if (!killed) {
          try {
            pty.kill('SIGKILL');
          } catch {
            // Already dead
          }
          killed = true;
          this.ptys.delete(sessionId);
          resolve();
        }
      }, KILL_TIMEOUT);

      // Listen for exit (only kill-time handler now)
      const exitDisposer = pty.onExit(() => {
        if (!killed) {
          killed = true;
          clearTimeout(forceKillTimer);
          exitDisposer.dispose();
          this.ptys.delete(sessionId);
          resolve();
        }
      });

      try {
        pty.kill('SIGTERM');
      } catch {
        killed = true;
        clearTimeout(forceKillTimer);
        exitDisposer.dispose();
        this.ptys.delete(sessionId);
        resolve();
      }
    });
  }

  /**
   * Kill all PTY processes. Used during server shutdown.
   */
  async killAll(): Promise<void> {
    const kills = Array.from(this.ptys.keys()).map(sid => this.kill(sid));
    await Promise.all(kills);
  }

  /**
   * Get all active PTY sessions.
   */
  listActive(): PtySessionInfo[] {
    return Array.from(this.sessionInfo.values()).filter(info => info.alive);
  }

  /**
   * Clean up resources for a session's PTY.
   */
  private cleanup(sessionId: SessionId): void {
    const disposers = this.disposers.get(sessionId);
    if (disposers) {
      for (const d of disposers) {
        try { d.dispose(); } catch { /* ignore */ }
      }
    }
    this.disposers.delete(sessionId);
    this.ptys.delete(sessionId);
    // Keep sessionInfo for status tracking (alive=false)
  }
}
