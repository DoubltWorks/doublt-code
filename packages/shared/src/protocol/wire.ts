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
 * - Approval policy system
 * - Task queue & scheduling
 * - Catch-up digest & activity timeline
 * - Git status integration
 * - Cost & usage tracking
 * - Search & session templates
 */

import type { SessionId, ClientId, ClientType, SessionListItem, SessionCreateOptions } from '../types/session.js';
import type { ChatMessage, ToolUseMessage, SessionNotification } from '../types/message.js';
import type { WorkspaceId, WorkspaceListItem, WorkspaceCreateOptions } from '../types/workspace.js';
import type { TerminalOutput, TerminalInput, TerminalResize, LongRunningCommand } from '../types/terminal.js';
import type { ApprovalPolicy, ApprovalQueueItem, ApprovalDecision, ApprovalPreset } from '../types/approval.js';
import type { Task, TaskPriority } from '../types/taskqueue.js';
import type { DigestSummary, TimelineEntry, HistoryPage } from '../types/digest.js';
import type { GitStatus, GitCommit, GitDiff } from '../types/git.js';
import type { TokenUsage, UsageSummary, BudgetConfig, BudgetAlert } from '../types/cost.js';
import type { SearchQuery, SearchResult, SessionTemplate } from '../types/search.js';

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

// ─── Approval policy messages (Client → Server) ──────────────

export interface PolicySetMsg {
  type: 'policy:set';
  policy?: ApprovalPolicy;
  preset?: ApprovalPreset;
}

export interface PolicyGetMsg {
  type: 'policy:get';
}

export interface PolicyListMsg {
  type: 'policy:list';
}

export interface ApprovalQueueListMsg {
  type: 'approval:queue:list';
}

export interface ApprovalDecideMsg {
  type: 'approval:decide';
  queueItemId: string;
  approved: boolean;
  reason?: string;
}

// ─── Task queue messages (Client → Server) ───────────────────

export interface TaskCreateMsg {
  type: 'task:create';
  title: string;
  description: string;
  priority: TaskPriority;
  workspaceId?: string;
  sessionId?: string;
}

export interface TaskUpdateMsg {
  type: 'task:update';
  taskId: string;
  updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>;
}

export interface TaskDeleteMsg {
  type: 'task:delete';
  taskId: string;
}

export interface TaskReorderMsg {
  type: 'task:reorder';
  taskIds: string[];
}

export interface TaskListMsg {
  type: 'task:list';
  workspaceId?: string;
}

// ─── Digest & timeline messages (Client → Server) ────────────

export interface DigestRequestMsg {
  type: 'digest:request';
  since: number;
}

export interface TimelineRequestMsg {
  type: 'timeline:request';
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryRequestMsg {
  type: 'history:request';
  sessionId: string;
  cursor?: string;
  limit?: number;
}

// ─── Git status messages (Client → Server) ───────────────────

export interface GitStatusRequestMsg {
  type: 'git:status:request';
  sessionId: SessionId;
}

export interface GitLogRequestMsg {
  type: 'git:log:request';
  sessionId: SessionId;
  count?: number;
}

export interface GitDiffRequestMsg {
  type: 'git:diff:request';
  sessionId: SessionId;
  filePath?: string;
  staged?: boolean;
}

// ─── Cost & usage messages (Client → Server) ─────────────────

export interface UsageRequestMsg {
  type: 'usage:request';
  period?: 'daily' | 'weekly' | 'monthly';
}

export interface BudgetSetMsg {
  type: 'budget:set';
  config: Partial<BudgetConfig>;
}

// ─── Search & template messages (Client → Server) ────────────

export interface SearchQueryMsg {
  type: 'search:query';
  query: SearchQuery;
}

export interface TemplateListMsg {
  type: 'template:list';
  category?: string;
}

export interface TemplateCreateMsg {
  type: 'template:create';
  name: string;
  description: string;
  category: string;
  prompts: string[];
  tags?: string[];
}

export interface TemplateUseMsg {
  type: 'template:use';
  templateId: string;
}

// ─── Claude session messages (Client → Server) ───────────────

export interface ClaudeStartMsg {
  type: 'claude:start';
  sessionId: SessionId;
  prompt?: string;
  autoRestart?: boolean;
}

export interface ClaudeStopMsg {
  type: 'claude:stop';
  sessionId: SessionId;
}

export interface ClaudeStatusMsg {
  type: 'claude:status';
  sessionId?: SessionId;
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
  | PushUnregisterMsg
  // Approval policy
  | PolicySetMsg
  | PolicyGetMsg
  | PolicyListMsg
  | ApprovalQueueListMsg
  | ApprovalDecideMsg
  // Task queue
  | TaskCreateMsg
  | TaskUpdateMsg
  | TaskDeleteMsg
  | TaskReorderMsg
  | TaskListMsg
  // Digest & timeline
  | DigestRequestMsg
  | TimelineRequestMsg
  | HistoryRequestMsg
  // Git status
  | GitStatusRequestMsg
  | GitLogRequestMsg
  | GitDiffRequestMsg
  // Cost & usage
  | UsageRequestMsg
  | BudgetSetMsg
  // Search & templates
  | SearchQueryMsg
  | TemplateListMsg
  | TemplateCreateMsg
  | TemplateUseMsg
  // Claude session
  | ClaudeStartMsg
  | ClaudeStopMsg
  | ClaudeStatusMsg;

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

// ─── Approval policy messages (Server → Client) ──────────────

export interface PolicyResultMsg {
  type: 'policy:result';
  policy: ApprovalPolicy | null;
}

export interface PolicyListResultMsg {
  type: 'policy:list:result';
  policies: ApprovalPolicy[];
}

export interface ApprovalQueueResultMsg {
  type: 'approval:queue:result';
  queue: ApprovalQueueItem[];
}

export interface ApprovalNeededMsg {
  type: 'approval:needed';
  item: ApprovalQueueItem;
}

export interface ApprovalDecidedMsg {
  type: 'approval:decided';
  decision: ApprovalDecision;
}

// ─── Task queue messages (Server → Client) ───────────────────

export interface TaskCreatedMsg {
  type: 'task:created';
  task: Task;
}

export interface TaskUpdatedMsg {
  type: 'task:updated';
  task: Task;
}

export interface TaskDeletedMsg {
  type: 'task:deleted';
  taskId: string;
}

export interface TaskListResultMsg {
  type: 'task:list:result';
  tasks: Task[];
}

// ─── Digest & timeline messages (Server → Client) ────────────

export interface DigestResultMsg {
  type: 'digest:result';
  digest: DigestSummary;
}

export interface TimelineResultMsg {
  type: 'timeline:result';
  entries: TimelineEntry[];
}

export interface HistoryResultMsg {
  type: 'history:result';
  page: HistoryPage;
}

// ─── Git status messages (Server → Client) ───────────────────

export interface GitStatusResultMsg {
  type: 'git:status:result';
  sessionId: SessionId;
  status: GitStatus;
}

export interface GitLogResultMsg {
  type: 'git:log:result';
  sessionId: SessionId;
  commits: GitCommit[];
}

export interface GitDiffResultMsg {
  type: 'git:diff:result';
  sessionId: SessionId;
  diffs: GitDiff[];
}

// ─── Cost & usage messages (Server → Client) ─────────────────

export interface CostUpdateMsg {
  type: 'cost:update';
  sessionId: SessionId;
  usage: TokenUsage;
  estimatedCostUsd: number;
}

export interface UsageResultMsg {
  type: 'usage:result';
  summary: UsageSummary;
}

export interface BudgetAlertMsg {
  type: 'budget:alert';
  alert: BudgetAlert;
}

// ─── Search & template messages (Server → Client) ────────────

export interface SearchResultsMsg {
  type: 'search:result';
  results: SearchResult[];
}

export interface TemplateListResultMsg {
  type: 'template:list:result';
  templates: SessionTemplate[];
}

export interface TemplateCreatedMsg {
  type: 'template:created';
  template: SessionTemplate;
}

export interface TemplateUsedMsg {
  type: 'template:used';
  template: SessionTemplate;
}

// ─── Claude session messages (Server → Client) ───────────────

export interface ClaudeStatusResultMsg {
  type: 'claude:status:result';
  sessions: Array<{
    sessionId: SessionId;
    status: 'idle' | 'running' | 'crashed' | 'stopped' | 'budget_paused';
    restartCount: number;
    lastStartedAt?: number;
  }>;
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
  | CommandStatusMsg
  // Approval policy
  | PolicyResultMsg
  | PolicyListResultMsg
  | ApprovalQueueResultMsg
  | ApprovalNeededMsg
  | ApprovalDecidedMsg
  // Task queue
  | TaskCreatedMsg
  | TaskUpdatedMsg
  | TaskDeletedMsg
  | TaskListResultMsg
  // Digest & timeline
  | DigestResultMsg
  | TimelineResultMsg
  | HistoryResultMsg
  // Git status
  | GitStatusResultMsg
  | GitLogResultMsg
  | GitDiffResultMsg
  // Cost & usage
  | CostUpdateMsg
  | UsageResultMsg
  | BudgetAlertMsg
  // Search & templates
  | SearchResultsMsg
  | TemplateListResultMsg
  | TemplateCreatedMsg
  | TemplateUsedMsg
  // Claude session
  | ClaudeStatusResultMsg;

// ─── Unified ─────────────────────────────────────────────────

export type WireMessage = ClientMessage | ServerMessage;

export function encodeMessage(msg: WireMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(raw: string): WireMessage {
  return JSON.parse(raw) as WireMessage;
}
