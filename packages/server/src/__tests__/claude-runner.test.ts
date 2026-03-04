import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeSessionRunner } from '../claude/ClaudeSessionRunner.js';
import { EventEmitter } from 'events';

// ─── Mocks ──────────────────────────────────────────

function makeMockPtyManager() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    isAlive: vi.fn().mockReturnValue(true),
    spawn: vi.fn().mockResolvedValue({ sessionId: 's1', pid: 123, alive: true }),
    write: vi.fn().mockReturnValue(true),
    resize: vi.fn().mockReturnValue(true),
    kill: vi.fn().mockResolvedValue(undefined),
    killAll: vi.fn().mockResolvedValue(undefined),
    listActive: vi.fn().mockReturnValue([]),
    getInfo: vi.fn(),
  });
}

function makeMockCostTracker() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    recordUsage: vi.fn(),
    getDailySummary: vi.fn(),
    getWeeklySummary: vi.fn(),
    getMonthlySummary: vi.fn(),
    setBudget: vi.fn(),
  });
}

// ─── Tests ──────────────────────────────────────────

describe('ClaudeSessionRunner', () => {
  let runner: ClaudeSessionRunner;
  let pty: ReturnType<typeof makeMockPtyManager>;
  let cost: ReturnType<typeof makeMockCostTracker>;

  beforeEach(() => {
    vi.useFakeTimers();
    pty = makeMockPtyManager();
    cost = makeMockCostTracker();
    runner = new ClaudeSessionRunner(pty as any, cost as any, {
      maxRestarts: 3,
      maxTaskDurationMs: 10_000,
    });
  });

  afterEach(() => {
    runner.destroy();
    vi.useRealTimers();
  });

  describe('startClaude', () => {
    it('starts claude in a session PTY', async () => {
      const state = await runner.startClaude('s1');
      expect(state.status).toBe('running');
      expect(state.sessionId).toBe('s1');
      expect(pty.write).toHaveBeenCalledWith('s1', expect.stringContaining('claude --dangerously-skip-permissions'));
    });

    it('spawns PTY if not alive', async () => {
      pty.isAlive.mockReturnValue(false);
      await runner.startClaude('s1', { cwd: '/tmp' });
      expect(pty.spawn).toHaveBeenCalledWith('s1', { cwd: '/tmp' });
    });

    it('sends prompt after delay', async () => {
      await runner.startClaude('s1', { prompt: 'fix the bug' });

      // Prompt sent after 2s delay
      vi.advanceTimersByTime(2100);
      expect(pty.write).toHaveBeenCalledWith('s1', 'fix the bug\n');
    });

    it('returns existing state if already running', async () => {
      const first = await runner.startClaude('s1');
      const second = await runner.startClaude('s1');
      expect(first).toBe(second);
      // write should have been called only once for the command
      const cmdCalls = pty.write.mock.calls.filter(
        (c: [string, string]) => c[1].includes('claude')
      );
      expect(cmdCalls).toHaveLength(1);
    });

    it('throws when budget is paused', async () => {
      cost.emit('budget:exceeded');
      await expect(runner.startClaude('s1')).rejects.toThrow('Budget exceeded');
    });
  });

  describe('stopClaude', () => {
    it('sends Ctrl-C and /exit', async () => {
      await runner.startClaude('s1');
      await runner.stopClaude('s1');

      expect(pty.write).toHaveBeenCalledWith('s1', '\x03');
      vi.advanceTimersByTime(600);
      expect(pty.write).toHaveBeenCalledWith('s1', '/exit\n');

      const state = runner.getState('s1');
      expect(state?.status).toBe('stopped');
      expect(state?.autoRestart).toBe(false);
    });
  });

  describe('crash handling', () => {
    it('restarts with exponential backoff on crash', async () => {
      const crashEvents: any[] = [];
      runner.on('claude:crashed', (e) => crashEvents.push(e));

      await runner.startClaude('s1', { autoRestart: true });
      pty.write.mockClear();

      // Simulate crash (exit code 1)
      pty.emit('pty:exited', { sessionId: 's1', exitCode: 1 });

      expect(crashEvents).toHaveLength(1);
      expect(crashEvents[0].willRestart).toBe(true);

      // Advance past backoff (1s for first restart)
      vi.advanceTimersByTime(1100);
      expect(pty.write).toHaveBeenCalledWith('s1', expect.stringContaining('claude'));
    });

    it('gives up after max restarts', async () => {
      // Use long task timeout so it doesn't interfere
      runner.destroy();
      runner = new ClaudeSessionRunner(pty as any, cost as any, {
        maxRestarts: 3,
        maxTaskDurationMs: 600_000, // 10 min — won't fire during test
      });

      const maxEvents: any[] = [];
      runner.on('claude:max_restarts', (e) => maxEvents.push(e));

      await runner.startClaude('s1', { autoRestart: true });

      // Crash and advance past each backoff: 1s, 2s, 4s
      for (let i = 0; i < 3; i++) {
        pty.emit('pty:exited', { sessionId: 's1', exitCode: 1 });
        const backoff = 1000 * Math.pow(2, i);
        vi.advanceTimersByTime(backoff + 100);
      }

      // 4th crash — exceeds maxRestarts
      pty.emit('pty:exited', { sessionId: 's1', exitCode: 1 });

      expect(maxEvents).toHaveLength(1);
      expect(runner.getState('s1')?.status).toBe('error');
    });

    it('handles clean exit without restart', async () => {
      const completedEvents: any[] = [];
      runner.on('claude:completed', (e) => completedEvents.push(e));

      await runner.startClaude('s1');
      pty.emit('pty:exited', { sessionId: 's1', exitCode: 0 });

      expect(completedEvents).toHaveLength(1);
      expect(runner.getState('s1')?.status).toBe('idle');
    });
  });

  describe('budget pause', () => {
    it('pauses all running sessions on budget exceeded', async () => {
      const pauseEvents: any[] = [];
      runner.on('claude:budget_paused', (e) => pauseEvents.push(e));

      await runner.startClaude('s1');
      cost.emit('budget:exceeded');

      expect(pauseEvents).toHaveLength(1);
      expect(runner.getState('s1')?.status).toBe('budget_paused');
    });

    it('resumes from budget pause', async () => {
      await runner.startClaude('s1');
      cost.emit('budget:exceeded');

      runner.resumeFromBudgetPause();
      expect(runner.getState('s1')?.status).toBe('idle');
    });
  });

  describe('task timeout', () => {
    it('stops claude after max task duration', async () => {
      const timeoutEvents: any[] = [];
      runner.on('claude:timeout', (e) => timeoutEvents.push(e));

      await runner.startClaude('s1');
      vi.advanceTimersByTime(11_000); // past 10s maxTaskDurationMs

      expect(timeoutEvents).toHaveLength(1);
      expect(runner.getState('s1')?.status).toBe('stopped');
    });
  });

  describe('listSessions / isRunning', () => {
    it('lists all tracked sessions', async () => {
      await runner.startClaude('s1');
      await runner.startClaude('s2');
      expect(runner.listSessions()).toHaveLength(2);
    });

    it('reports running status correctly', async () => {
      expect(runner.isRunning('s1')).toBe(false);
      await runner.startClaude('s1');
      expect(runner.isRunning('s1')).toBe(true);
    });
  });
});
