/**
 * Terminal synchronization types for doubltmux.
 *
 * Enables real-time terminal output sync between PC and mobile.
 * When a CLI command (e.g., `ls`, `claude`) runs in a session,
 * the terminal output is captured and streamed to all connected
 * clients (both PC and mobile) simultaneously.
 */

import type { SessionId, ClientId } from './session.js';

export interface TerminalOutput {
  sessionId: SessionId;
  /** Sequential chunk ID for ordering */
  chunkId: number;
  /** Raw terminal output data */
  data: string;
  /** Source: which client initiated the command */
  sourceClientId?: ClientId;
  timestamp: number;
}

export interface TerminalInput {
  sessionId: SessionId;
  /** Raw input data (keystrokes or command) */
  data: string;
  sourceClientId?: ClientId;
  timestamp: number;
}

export interface TerminalResize {
  sessionId: SessionId;
  cols: number;
  rows: number;
}

/**
 * Long-running command tracking for background notifications.
 * When a command takes longer than the threshold, mobile clients
 * receive push notifications about progress/completion.
 */
export interface LongRunningCommand {
  id: string;
  sessionId: SessionId;
  command: string;
  startedAt: number;
  /** Estimated progress (0-1), null if indeterminate */
  progress: number | null;
  status: 'running' | 'completed' | 'failed';
  /** Set when completed or failed */
  completedAt?: number;
  exitCode?: number;
}
