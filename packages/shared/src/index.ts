export type {
  SessionId,
  ClientId,
  SessionStatus,
  ClientType,
  Session,
  ConnectedClient,
  SessionCreateOptions,
  SessionListItem,
} from './types/session.js';

export type {
  MessageRole,
  ChatMessage,
  ToolUseMessage,
  SessionNotification,
} from './types/message.js';

export type {
  WorkspaceId,
  WorkspaceStatus,
  Workspace,
  WorkspaceCreateOptions,
  WorkspaceListItem,
} from './types/workspace.js';

export type {
  TerminalOutput,
  TerminalInput,
  TerminalResize,
  LongRunningCommand,
} from './types/terminal.js';

export type {
  ClientMessage,
  ServerMessage,
  WireMessage,
} from './protocol/wire.js';

export {
  encodeMessage,
  decodeMessage,
} from './protocol/wire.js';

export type { HandoffData } from './utils/handoff.js';
export { generateHandoffMd, parseHandoffMd } from './utils/handoff.js';
