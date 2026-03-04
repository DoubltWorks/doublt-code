/**
 * Workspace types for doubltmux.
 *
 * A Workspace groups multiple sessions together — like a tmux session
 * containing multiple windows. Each workspace has its own working directory
 * and can contain multiple sessions (equivalent to tmux windows).
 *
 * Hierarchy: Workspace → Session → (Claude / terminal)
 */

export type WorkspaceId = string;

export type WorkspaceStatus = 'active' | 'idle' | 'archived';

export interface Workspace {
  id: WorkspaceId;
  name: string;
  status: WorkspaceStatus;
  createdAt: number;
  lastActivityAt: number;
  /** Root working directory for this workspace */
  cwd: string;
  /** Session IDs belonging to this workspace */
  sessionIds: string[];
}

export interface WorkspaceCreateOptions {
  name?: string;
  cwd?: string;
}

export interface WorkspaceListItem {
  id: WorkspaceId;
  name: string;
  status: WorkspaceStatus;
  sessionCount: number;
  activeSessionCount: number;
  lastActivityAt: number;
  cwd: string;
  /** Visual indicator like tmux session numbers */
  index: number;
}
