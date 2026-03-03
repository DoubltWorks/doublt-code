/**
 * ClaudeSessionRunner — Manages claude CLI processes within PTY sessions.
 *
 * Runs `claude --dangerously-skip-permissions` inside a PTY for full-auto
 * 24/7 coding. Handles crash detection, exponential backoff restart,
 * and budget-based pause.
 *
 * This is the core of doublt-code's "sleep and code" capability.
 */

import { EventEmitter } from 'node:events';
import type { SessionId } from '@doublt/shared';
import type { PtyManager } from '../terminal/PtyManager.js';
import type { CostTracker } from '../cost/CostTracker.js';

export interface ClaudeRunnerOptions {
  /** Max consecutive crash restarts before giving up */
  maxRestarts?: number;
  /** Max task execution time in ms (default: 4 hours) */
  maxTaskDurationMs?: number;
  /** Custom claude binary path */
  claudePath?: string;
}

export interface ClaudeSessionState {
  sessionId: SessionId;
  status: 'idle' | 'running' | 'crashed' | 'stopped' | 'budget_paused';
  restartCount: number;
  lastStartedAt?: number;
  lastCrashedAt?: number;
  currentPrompt?: string;
  autoRestart: boolean;
}

const DEFAULT_MAX_RESTARTS = 5;
const DEFAULT_MAX_TASK_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const BACKOFF_BASE_MS = 1000;

export class ClaudeSessionRunner extends EventEmitter {
  private sessions = new Map<SessionId, ClaudeSessionState>();
  private restartTimers = new Map<SessionId, ReturnType<typeof setTimeout>>();
  private taskTimers = new Map<SessionId, ReturnType<typeof setTimeout>>();
  private maxRestarts: number;
  private maxTaskDurationMs: number;
  private claudePath: string;
  private budgetPaused = false;

  constructor(
    private ptyManager: PtyManager,
    private costTracker: CostTracker,
    options: ClaudeRunnerOptions = {},
  ) {
    super();
    this.maxRestarts = options.maxRestarts ?? DEFAULT_MAX_RESTARTS;
    this.maxTaskDurationMs = options.maxTaskDurationMs ?? DEFAULT_MAX_TASK_DURATION_MS;
    this.claudePath = options.claudePath ?? 'claude';

    // Listen for budget exceeded events
    this.costTracker.on('budget:exceeded', () => {
      this.pauseAllForBudget();
    });

    // Listen for PTY exits to detect claude crashes
    this.ptyManager.on('pty:exited', ({ sessionId, exitCode }) => {
      const state = this.sessions.get(sessionId);
      if (!state || state.status !== 'running') return;

      if (exitCode !== 0) {
        this.handleCrash(sessionId, exitCode);
      } else {
        // Clean exit — claude finished normally
        state.status = 'idle';
        state.restartCount = 0;
        this.clearTaskTimer(sessionId);
        this.emit('claude:completed', { sessionId });
      }
    });
  }

  /**
   * Start claude in a session's PTY with --dangerously-skip-permissions.
   * Optionally sends an initial prompt.
   */
  async startClaude(
    sessionId: SessionId,
    options: {
      prompt?: string;
      cwd?: string;
      autoRestart?: boolean;
    } = {},
  ): Promise<ClaudeSessionState> {
    if (this.budgetPaused) {
      throw new Error('Budget exceeded — automatic mode paused. Resume manually.');
    }

    let state = this.sessions.get(sessionId);
    if (state?.status === 'running') {
      return state; // Already running
    }

    // Ensure PTY is alive
    if (!this.ptyManager.isAlive(sessionId)) {
      await this.ptyManager.spawn(sessionId, { cwd: options.cwd });
    }

    // Build claude command
    const cmd = `${this.claudePath} --dangerously-skip-permissions`;

    // Write command to PTY
    this.ptyManager.write(sessionId, cmd + '\n');

    // If prompt provided, send it after a small delay for claude to start
    if (options.prompt) {
      setTimeout(() => {
        this.ptyManager.write(sessionId, options.prompt + '\n');
      }, 2000);
    }

    state = {
      sessionId,
      status: 'running',
      restartCount: state?.restartCount ?? 0,
      lastStartedAt: Date.now(),
      currentPrompt: options.prompt,
      autoRestart: options.autoRestart ?? true,
    };

    this.sessions.set(sessionId, state);

    // Set max task duration timer
    this.setTaskTimer(sessionId);

    this.emit('claude:started', { sessionId, prompt: options.prompt });
    return state;
  }

  /**
   * Stop claude in a session gracefully.
   */
  async stopClaude(sessionId: SessionId): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    state.status = 'stopped';
    state.autoRestart = false;
    this.clearRestartTimer(sessionId);
    this.clearTaskTimer(sessionId);

    // Send Ctrl-C then exit to claude
    if (this.ptyManager.isAlive(sessionId)) {
      this.ptyManager.write(sessionId, '\x03'); // Ctrl-C
      setTimeout(() => {
        if (this.ptyManager.isAlive(sessionId)) {
          this.ptyManager.write(sessionId, '/exit\n');
        }
      }, 500);
    }

    this.emit('claude:stopped', { sessionId });
  }

  /**
   * Get the state of a claude session.
   */
  getState(sessionId: SessionId): ClaudeSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all claude session states.
   */
  listSessions(): ClaudeSessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if claude is running in a session.
   */
  isRunning(sessionId: SessionId): boolean {
    return this.sessions.get(sessionId)?.status === 'running';
  }

  /**
   * Handle a claude crash with exponential backoff restart.
   */
  private handleCrash(sessionId: SessionId, exitCode: number): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    state.status = 'crashed';
    state.lastCrashedAt = Date.now();
    state.restartCount++;
    this.clearTaskTimer(sessionId);

    this.emit('claude:crashed', {
      sessionId,
      exitCode,
      restartCount: state.restartCount,
      willRestart: state.autoRestart && state.restartCount <= this.maxRestarts,
    });

    if (!state.autoRestart) return;

    if (state.restartCount > this.maxRestarts) {
      state.status = 'stopped';
      this.emit('claude:max_restarts', {
        sessionId,
        restartCount: state.restartCount,
      });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = BACKOFF_BASE_MS * Math.pow(2, state.restartCount - 1);
    const timer = setTimeout(() => {
      this.restartTimers.delete(sessionId);
      this.startClaude(sessionId, {
        prompt: state.currentPrompt,
        autoRestart: true,
      }).catch(err => {
        this.emit('claude:restart_failed', { sessionId, error: err.message });
      });
    }, delay);

    this.restartTimers.set(sessionId, timer);

    this.emit('claude:restarting', {
      sessionId,
      delayMs: delay,
      attempt: state.restartCount,
    });
  }

  /**
   * Pause all auto-mode sessions due to budget exceeded.
   */
  private pauseAllForBudget(): void {
    this.budgetPaused = true;
    for (const [sessionId, state] of this.sessions) {
      if (state.status === 'running') {
        state.status = 'budget_paused';
        this.clearRestartTimer(sessionId);
        this.clearTaskTimer(sessionId);
        this.emit('claude:budget_paused', { sessionId });
      }
    }
    this.emit('claude:all_paused', { reason: 'budget_exceeded' });
  }

  /**
   * Resume after budget pause (manual action required).
   */
  resumeFromBudgetPause(): void {
    this.budgetPaused = false;
    for (const [sessionId, state] of this.sessions) {
      if (state.status === 'budget_paused') {
        state.status = 'idle';
        this.emit('claude:resumed', { sessionId });
      }
    }
  }

  /**
   * Set a max task duration timer to prevent infinite runs.
   */
  private setTaskTimer(sessionId: SessionId): void {
    this.clearTaskTimer(sessionId);
    const timer = setTimeout(() => {
      const state = this.sessions.get(sessionId);
      if (state?.status === 'running') {
        this.emit('claude:timeout', { sessionId, durationMs: this.maxTaskDurationMs });
        this.stopClaude(sessionId).catch(() => {});
      }
    }, this.maxTaskDurationMs);
    this.taskTimers.set(sessionId, timer);
  }

  private clearTaskTimer(sessionId: SessionId): void {
    const timer = this.taskTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(sessionId);
    }
  }

  private clearRestartTimer(sessionId: SessionId): void {
    const timer = this.restartTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(sessionId);
    }
  }

  /**
   * Clean up all timers. Used during server shutdown.
   */
  destroy(): void {
    for (const timer of this.restartTimers.values()) clearTimeout(timer);
    for (const timer of this.taskTimers.values()) clearTimeout(timer);
    this.restartTimers.clear();
    this.taskTimers.clear();
  }
}
