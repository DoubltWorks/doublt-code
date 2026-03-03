/**
 * WebSocket wire protocol for doublt-code.
 *
 * All communication between server, CLI, and mobile uses this protocol.
 * The key design difference from Happy Coder: there is NO mode switching.
 * All clients share the same bidirectional stream simultaneously.
 */

import type { SessionId, ClientId, ClientType, SessionListItem, SessionCreateOptions } from '../types/session.js';
import type { ChatMessage, ToolUseMessage, SessionNotification } from '../types/message.js';

// ─── Client → Server ────────────────────────────────────────

export interface AuthenticateMsg {
  type: 'authenticate';
  token: string;
  clientType: ClientType;
  deviceInfo: string;
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

export type ClientMessage =
  | AuthenticateMsg
  | SessionCreateMsg
  | SessionAttachMsg
  | SessionDetachMsg
  | SessionListMsg
  | SendChatMsg
  | ApproveToolMsg
  | HandoffTriggerMsg;

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
  | ErrorMsg;

// ─── Unified ─────────────────────────────────────────────────

export type WireMessage = ClientMessage | ServerMessage;

export function encodeMessage(msg: WireMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(raw: string): WireMessage {
  return JSON.parse(raw) as WireMessage;
}
