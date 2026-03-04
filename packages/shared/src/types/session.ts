/**
 * Core session types for doublt-code.
 *
 * A "session" represents a single Claude Code instance with its own
 * conversation context. Multiple sessions can be managed simultaneously
 * (cmux-style), and any session can be accessed from both PC and mobile
 * at the same time (no mode switching needed).
 */

export type SessionId = string;
export type ClientId = string;

export type SessionStatus = 'active' | 'idle' | 'handoff_pending' | 'archived';

export type ClientType = 'cli' | 'mobile' | 'web';

export interface Session {
  id: SessionId;
  name: string;
  status: SessionStatus;
  createdAt: number;
  lastActivityAt: number;
  /** Working directory for this session */
  cwd: string;
  /** Connected clients — both PC and mobile can be connected simultaneously */
  clients: ConnectedClient[];
  /** Context usage estimate (0-1), triggers handoff near 1.0 */
  contextUsage: number;
  /** If this session was created via handoff, reference to parent */
  parentSessionId?: SessionId;
  /** HANDOFF.md content that seeded this session */
  handoffContext?: string;
  /** Workspace this session belongs to */
  workspaceId?: string;
}

export interface ConnectedClient {
  id: ClientId;
  type: ClientType;
  connectedAt: number;
  lastSeenAt: number;
  /** User agent or device info */
  deviceInfo: string;
}

export interface SessionCreateOptions {
  name?: string;
  cwd?: string;
  /** Workspace to create this session in */
  workspaceId?: string;
  /** Create from a handoff — carries context from parent session */
  fromHandoff?: {
    parentSessionId: SessionId;
    handoffContent: string;
  };
}

export interface SessionListItem {
  id: SessionId;
  name: string;
  status: SessionStatus;
  clientCount: number;
  contextUsage: number;
  lastActivityAt: number;
  cwd: string;
  /** Visual indicator like tmux window numbers */
  index: number;
  /** Workspace this session belongs to */
  workspaceId?: string;
}
