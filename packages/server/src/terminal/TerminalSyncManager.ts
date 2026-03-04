/**
 * TerminalSyncManager — Synchronizes terminal I/O across all clients.
 *
 * When a command runs in a session (e.g., `ls`, `claude`), the terminal
 * output is captured and relayed to all connected clients (PC + mobile).
 * This enables real-time view synchronization.
 *
 * Also tracks long-running commands and emits notifications when they
 * complete, enabling mobile push notifications for background tasks.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  SessionId,
  ClientId,
  TerminalOutput,
  TerminalInput,
  TerminalResize,
  LongRunningCommand,
} from '@doublt/shared';

/** Threshold (ms) after which a command is considered "long-running" */
const LONG_RUNNING_THRESHOLD = 10_000;

export class TerminalSyncManager extends EventEmitter {
  /** Active terminal dimensions per session */
  private terminalSizes = new Map<SessionId, { cols: number; rows: number }>();

  /** Chunk counter per session for ordering */
  private chunkCounters = new Map<SessionId, number>();

  /** Tracked long-running commands */
  private runningCommands = new Map<string, LongRunningCommand>();

  /** Terminal output buffer per session (last N chunks for late-joining clients) */
  private outputBuffers = new Map<SessionId, TerminalOutput[]>();
  private readonly maxBufferSize = 1000;

  /** Scrollback line buffer per session (raw text, 1000 lines max) */
  private scrollbackBuffers = new Map<SessionId, string[]>();
  private readonly maxScrollbackLines = 1000;

  /**
   * Process terminal output from a client and broadcast to all others.
   */
  handleOutput(sessionId: SessionId, data: string, sourceClientId?: ClientId): TerminalOutput {
    const counter = (this.chunkCounters.get(sessionId) ?? 0) + 1;
    this.chunkCounters.set(sessionId, counter);

    const output: TerminalOutput = {
      sessionId,
      chunkId: counter,
      data,
      sourceClientId,
      timestamp: Date.now(),
    };

    // Buffer for late joiners
    const buffer = this.outputBuffers.get(sessionId) ?? [];
    buffer.push(output);
    if (buffer.length > this.maxBufferSize) {
      buffer.splice(0, buffer.length - this.maxBufferSize);
    }
    this.outputBuffers.set(sessionId, buffer);

    // Maintain scrollback line buffer (strip \r for clean line counting)
    const lines = this.scrollbackBuffers.get(sessionId) ?? [];
    const newLines = data.split('\n').map(l => l.replace(/\r/g, ''));
    if (lines.length > 0 && newLines.length > 0) {
      // Append first fragment to last incomplete line
      lines[lines.length - 1] += newLines[0];
      lines.push(...newLines.slice(1));
    } else {
      lines.push(...newLines);
    }
    if (lines.length > this.maxScrollbackLines) {
      lines.splice(0, lines.length - this.maxScrollbackLines);
    }
    this.scrollbackBuffers.set(sessionId, lines);

    this.emit('terminal:output', output);
    return output;
  }

  /**
   * Process terminal input from a client (mobile or CLI) and relay.
   */
  handleInput(input: TerminalInput): void {
    this.emit('terminal:input', input);
  }

  /**
   * Handle terminal resize events.
   */
  handleResize(resize: TerminalResize): void {
    this.terminalSizes.set(resize.sessionId, { cols: resize.cols, rows: resize.rows });
    this.emit('terminal:resized', resize);
  }

  /**
   * Get buffered output for a session (for late-joining mobile clients).
   */
  getBufferedOutput(sessionId: SessionId): TerminalOutput[] {
    return this.outputBuffers.get(sessionId) ?? [];
  }

  /**
   * Get scrollback buffer for a session (for session attach / reconnect).
   * Returns { data, totalLines, offset } for paginated scrollback.
   */
  getScrollback(sessionId: SessionId, offset = 0): { data: string; totalLines: number; offset: number } {
    const lines = this.scrollbackBuffers.get(sessionId) ?? [];
    const totalLines = lines.length;
    const sliced = lines.slice(offset);
    return {
      data: sliced.join('\n'),
      totalLines,
      offset,
    };
  }

  /**
   * Get current terminal size for a session.
   */
  getTerminalSize(sessionId: SessionId): { cols: number; rows: number } {
    return this.terminalSizes.get(sessionId) ?? { cols: 80, rows: 24 };
  }

  // ─── Long-running command tracking ───────────────────────

  /**
   * Track a new command execution. Returns the command tracker.
   */
  trackCommand(sessionId: SessionId, command: string): LongRunningCommand {
    const cmd: LongRunningCommand = {
      id: `cmd-${randomUUID().slice(0, 8)}`,
      sessionId,
      command,
      startedAt: Date.now(),
      progress: null,
      status: 'running',
    };

    this.runningCommands.set(cmd.id, cmd);

    // Set timer for long-running detection
    setTimeout(() => {
      const tracked = this.runningCommands.get(cmd.id);
      if (tracked && tracked.status === 'running') {
        this.emit('command:long_running', tracked);
      }
    }, LONG_RUNNING_THRESHOLD);

    this.emit('command:started', cmd);
    return cmd;
  }

  /**
   * Update command progress.
   */
  updateCommandProgress(commandId: string, progress: number): void {
    const cmd = this.runningCommands.get(commandId);
    if (!cmd) return;

    cmd.progress = Math.min(1, Math.max(0, progress));
    this.emit('command:status', cmd);
  }

  /**
   * Mark a command as completed or failed.
   */
  completeCommand(commandId: string, exitCode: number): void {
    const cmd = this.runningCommands.get(commandId);
    if (!cmd) return;

    cmd.status = exitCode === 0 ? 'completed' : 'failed';
    cmd.completedAt = Date.now();
    cmd.exitCode = exitCode;
    cmd.progress = 1;

    this.emit('command:status', cmd);

    // Emit notification if it was a long-running command
    const elapsed = cmd.completedAt - cmd.startedAt;
    if (elapsed >= LONG_RUNNING_THRESHOLD) {
      this.emit('command:completed_notification', cmd);
    }

    this.runningCommands.delete(commandId);
  }

  /**
   * Get all running commands for a session.
   */
  getRunningCommands(sessionId: SessionId): LongRunningCommand[] {
    return Array.from(this.runningCommands.values())
      .filter(cmd => cmd.sessionId === sessionId);
  }

  /**
   * Clean up resources for a session.
   */
  cleanupSession(sessionId: SessionId): void {
    this.outputBuffers.delete(sessionId);
    this.scrollbackBuffers.delete(sessionId);
    this.chunkCounters.delete(sessionId);
    this.terminalSizes.delete(sessionId);
    for (const [id, cmd] of this.runningCommands) {
      if (cmd.sessionId === sessionId) {
        this.runningCommands.delete(id);
      }
    }
  }
}
