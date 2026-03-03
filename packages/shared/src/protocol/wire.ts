/**
 * WebSocket wire protocol for doublt-code.
 *
 * All communication between server, CLI, and mobile uses this protocol.
 * The key design difference from Happy Coder: there is NO mode switching.
 * All clients share the same bidirectional stream simultaneously.
 *
 * Extended with:
 * - Workspace management (create, list, switch)
 * - Terminal I/O sync (output streaming, input relay)
 * - Long-running command tracking
 * - Push notification registration
 */

import type { SessionId, ClientId, ClientType, SessionListItem, SessionCreateOptions } from '../types/session.js';
import type { ChatMessage, ToolUseMessage, SessionNotification } from '../types/message.js';
import type { WorkspaceId, WorkspaceListItem, WorkspaceCreateOptions } from '../types/workspace.js';
import type { TerminalOutput, TerminalInput, TerminalResize, LongRunningCommand } from '../types/terminal.js';

// ─── Client → Server ────────────────────────────────────────

export interface AuthenticateMsg {
  type: 'authenticate';
  token: string;
  clientType: ClientType;
  deviceInfo: string;
  /** Push notification token for mobile clients */
  pushToken?: string;
}

export interface SessionCreateMsg {
  type: 'session:create';
  options: SessionCreateOptions;
}

export interface SessionAttachMsg {
  type: 'session:attach';
  sessionId: SessionId;
}

export interface SessionDetachMsg {
  type: 'session:detach';
  sessionId: SessionId;
}

export interface SessionListMsg {
  type: 'session:list';
  /** Optional: filter sessions by workspace */
  workspaceId?: WorkspaceId;
}

export interface SendChatMsg {
  type: 'chat:send';
  sessionId: SessionId;
  content: string;
}

export interface ApproveToolMsg {
  type: 'tool:approve';
  sessionId: SessionId;
  toolUseId: string;
  approved: boolean;
}

export interface HandoffTriggerMsg {
  type: 'handoff:trigger';
  sessionId: SessionId;
}

// ─── Workspace messages (Client → Server) ───────────────────

export interface WorkspaceCreateMsg {
  type: 'workspace:create';
  options: WorkspaceCreateOptions;
}

export interface WorkspaceListMsg {
  type: 'workspace:list';
}

export interface WorkspaceDeleteMsg {
  type: 'workspace:delete';
  workspaceId: WorkspaceId;
}

export interface WorkspaceRenameMsg {
  type: 'workspace:rename';
  workspaceId: WorkspaceId;
  name: string;
}

// ─── Terminal sync messages (Client → Server) ────────────────

export interface TerminalInputMsg {
  type: 'terminal:input';
  input: TerminalInput;
}

export interface TerminalResizeMsg {
  type: 'terminal:resize';
  resize: TerminalResize;
}

// ─── Push notification registration (Client → Server) ────────

export interface PushRegisterMsg {
  type: 'push:register';
  pushToken: string;
  platform: 'ios' | 'android';
}

export interface PushUnregisterMsg {
  type: 'push:unregister';
}

export type ClientMessage =
  | AuthenticateMsg
  | SessionCreateMsg
  | SessionAttachMsg
  | SessionDetachMsg
  | SessionListMsg
  | SendChatMsg
  | ApproveToolMsg
  | HandoffTriggerMsg
  | WorkspaceCreateMsg
  | WorkspaceListMsg
  | WorkspaceDeleteMsg
  | WorkspaceRenameMsg
  | TerminalInputMsg
  | TerminalResizeMsg
  | PushRegisterMsg
  | PushUnregisterMsg;

// ─── Server → Client ────────────────────────────────────────

export interface AuthResultMsg {
  type: 'auth:result';
  success: boolean;
  clientId?: ClientId;
  error?: string;
}

export interface SessionCreatedMsg {
  type: 'session:created';
  session: SessionListItem;
}

export interface SessionListResultMsg {
  type: 'session:list:result';
  sessions: SessionListItem[];
}

export interface SessionUpdatedMsg {
  type: 'session:updated';
  session: SessionListItem;
}

export interface ChatMessageMsg {
  type: 'chat:message';
  message: ChatMessage;
}

export interface ChatStreamMsg {
  type: 'chat:stream';
  sessionId: SessionId;
  messageId: string;
  delta: string;
  done: boolean;
}

export interface ToolUseMsg {
  type: 'tool:use';
  tool: ToolUseMessage;
}

export interface NotificationMsg {
  type: 'notification';
  notification: SessionNotification;
}

export interface HandoffReadyMsg {
  type: 'handoff:ready';
  parentSessionId: SessionId;
  newSessionId: SessionId;
  handoffSummary: string;
}

export interface ErrorMsg {
  type: 'error';
  code: string;
  message: string;
  sessionId?: SessionId;
}

// ─── Workspace messages (Server → Client) ───────────────────

export interface WorkspaceCreatedMsg {
  type: 'workspace:created';
  workspace: WorkspaceListItem;
}

export interface WorkspaceListResultMsg {
  type: 'workspace:list:result';
  workspaces: WorkspaceListItem[];
}

export interface WorkspaceUpdatedMsg {
  type: 'workspace:updated';
  workspace: WorkspaceListItem;
}

export interface WorkspaceDeletedMsg {
  type: 'workspace:deleted';
  workspaceId: WorkspaceId;
}

// ─── Terminal sync messages (Server → Client) ────────────────

export interface TerminalOutputMsg {
  type: 'terminal:output';
  output: TerminalOutput;
}

export interface TerminalResizedMsg {
  type: 'terminal:resized';
  resize: TerminalResize;
}

// ─── Long-running command tracking (Server → Client) ─────────

export interface CommandStatusMsg {
  type: 'command:status';
  command: LongRunningCommand;
}

export type ServerMessage =
  | AuthResultMsg
  | SessionCreatedMsg
  | SessionListResultMsg
  | SessionUpdatedMsg
  | ChatMessageMsg
  | ChatStreamMsg
  | ToolUseMsg
  | NotificationMsg
  | HandoffReadyMsg
  | ErrorMsg
  | WorkspaceCreatedMsg
  | WorkspaceListResultMsg
  | WorkspaceUpdatedMsg
  | WorkspaceDeletedMsg
  | TerminalOutputMsg
  | TerminalResizedMsg
  | CommandStatusMsg;

// ─── Unified ─────────────────────────────────────────────────

export type WireMessage = ClientMessage | ServerMessage;

export function encodeMessage(msg: WireMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(raw: string): WireMessage {
  return JSON.parse(raw) as WireMessage;
}
