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

// ─── Approval Policy ────────────────────────────────────────

export type {
  ApprovalAction,
  ApprovalRule,
  ApprovalPolicy,
  ApprovalPreset,
  ApprovalQueueItem,
  ApprovalDecision,
  ScheduledPolicy,
  SessionPolicyOverride,
} from './types/approval.js';

// ─── Task Queue ─────────────────────────────────────────────

export type {
  TaskPriority,
  TaskStatus,
  Task,
  TaskQueue,
  ScheduledTask,
} from './types/taskqueue.js';

// ─── Digest & Timeline ─────────────────────────────────────

export type {
  ActivityEventType,
  ActivityEvent,
  DigestSummary,
  TimelineEntry,
  HistoryPage,
} from './types/digest.js';

// ─── Quick Actions ──────────────────────────────────────────

export type {
  QuickActionType,
  QuickAction,
  CommandMacro,
} from './types/quickaction.js';

// ─── Git Status ─────────────────────────────────────────────

export type {
  GitFileStatus,
  GitStatus,
  GitCommit,
  GitDiff,
  GitHunk,
} from './types/git.js';

// ─── Offline Cache ──────────────────────────────────────────

export type {
  CachedMessage,
  PendingActionType,
  PendingAction,
  SyncState,
} from './types/offline.js';

// ─── Cost & Usage ───────────────────────────────────────────

export type {
  TokenUsage,
  CostEstimate,
  UsageSummary,
  BudgetAlert,
  BudgetConfig,
} from './types/cost.js';

// ─── Search & Templates ────────────────────────────────────

export type {
  SearchScope,
  SearchResultType,
  SearchQuery,
  SearchResult,
  SessionTemplate,
} from './types/search.js';
