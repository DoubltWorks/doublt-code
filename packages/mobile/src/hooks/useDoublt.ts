/**
 * useDoublt — React hook for doublt-code mobile integration.
 *
 * Provides reactive state management for the mobile app's
 * connection to the doublt server. Extended with:
 * - Workspace management
 * - Terminal output sync
 * - Notification handling
 * - Background task integration
 * - Approval policy & queue
 * - Task queue
 * - Catch-up digest & timeline
 * - Git status
 * - Cost & usage tracking
 * - Search & templates
 * - Command macros
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DoubltClient } from '../services/DoubltClient';
import { NotificationService, type InAppNotification } from '../services/NotificationService';
import { BackgroundTaskService } from '../services/BackgroundTaskService';
import type {
  SessionListItem,
  WorkspaceListItem,
  ChatMessage,
  ToolUseMessage,
  SessionId,
  WorkspaceId,
  TerminalOutput,
  LongRunningCommand,
  ApprovalPolicy,
  ApprovalQueueItem,
  ApprovalPreset,
  Task,
  TaskPriority,
  DigestSummary,
  TimelineEntry,
  GitStatus,
  GitCommit,
  UsageSummary,
  BudgetConfig,
  SearchResult,
  SessionTemplate,
  CommandMacro,
} from '@doublt/shared';

interface DoubltState {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  workspaces: WorkspaceListItem[];
  activeWorkspaceId: WorkspaceId | null;
  sessions: SessionListItem[];
  activeSessionId: SessionId | null;
  messages: Map<SessionId, ChatMessage[]>;
  pendingApprovals: ToolUseMessage[];
  terminalOutput: Map<SessionId, string>;
  notifications: InAppNotification[];
  unreadNotificationCount: number;
  runningCommands: LongRunningCommand[];
  // Approval policy
  approvalQueue: ApprovalQueueItem[];
  activePolicy: ApprovalPolicy | null;
  policies: ApprovalPolicy[];
  // Task queue
  tasks: Task[];
  // Digest & timeline
  digest: DigestSummary | null;
  timeline: TimelineEntry[];
  // Git status
  gitStatus: Map<SessionId, GitStatus>;
  gitLog: GitCommit[];
  // Cost & usage
  sessionCosts: Map<SessionId, number>;
  usageSummary: UsageSummary | null;
  budgetConfig: BudgetConfig | null;
  // Search & templates
  searchResults: SearchResult[];
  templates: SessionTemplate[];
  // Macros
  macros: CommandMacro[];
}

export function useDoublt() {
  const clientRef = useRef<DoubltClient | null>(null);
  const notificationServiceRef = useRef<NotificationService | null>(null);
  const backgroundServiceRef = useRef<BackgroundTaskService | null>(null);

  const [state, setState] = useState<DoubltState>({
    connectionState: 'disconnected',
    workspaces: [],
    activeWorkspaceId: null,
    sessions: [],
    activeSessionId: null,
    messages: new Map(),
    pendingApprovals: [],
    terminalOutput: new Map(),
    notifications: [],
    unreadNotificationCount: 0,
    runningCommands: [],
    approvalQueue: [],
    activePolicy: null,
    policies: [],
    tasks: [],
    digest: null,
    timeline: [],
    gitStatus: new Map(),
    gitLog: [],
    sessionCosts: new Map(),
    usageSummary: null,
    budgetConfig: null,
    searchResults: [],
    templates: [],
    macros: [],
  });

  useEffect(() => {
    const client = new DoubltClient();
    const notificationService = new NotificationService();
    const backgroundService = new BackgroundTaskService(client, notificationService);

    clientRef.current = client;
    notificationServiceRef.current = notificationService;
    backgroundServiceRef.current = backgroundService;

    // ─── Connection state ─────────────────────────────

    client.on('stateChanged', (connectionState: string) => {
      setState(prev => ({ ...prev, connectionState: connectionState as DoubltState['connectionState'] }));
    });

    // ─── Workspace events ─────────────────────────────

    client.on('workspacesUpdated', (workspaces: WorkspaceListItem[]) => {
      setState(prev => ({
        ...prev,
        workspaces,
        activeWorkspaceId: prev.activeWorkspaceId ?? (workspaces.length > 0 ? workspaces[0].id : null),
      }));
    });

    client.on('workspaceCreated', (workspace: WorkspaceListItem) => {
      setState(prev => ({
        ...prev,
        workspaces: [...prev.workspaces, workspace],
      }));
    });

    client.on('workspaceUpdated', (workspace: WorkspaceListItem) => {
      setState(prev => ({
        ...prev,
        workspaces: prev.workspaces.map(ws => ws.id === workspace.id ? workspace : ws),
      }));
    });

    client.on('workspaceDeleted', (workspaceId: string) => {
      setState(prev => ({
        ...prev,
        workspaces: prev.workspaces.filter(ws => ws.id !== workspaceId),
        activeWorkspaceId: prev.activeWorkspaceId === workspaceId ? null : prev.activeWorkspaceId,
      }));
    });

    // ─── Session events ───────────────────────────────

    client.on('sessionsUpdated', (sessions: SessionListItem[]) => {
      setState(prev => ({ ...prev, sessions }));
    });

    client.on('sessionUpdated', (session: SessionListItem) => {
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => s.id === session.id ? session : s),
      }));
    });

    client.on('sessionCreated', (session: SessionListItem) => {
      setState(prev => ({
        ...prev,
        sessions: [...prev.sessions, session],
      }));
    });

    // ─── Chat events ──────────────────────────────────

    client.on('chatMessage', (message: ChatMessage) => {
      setState(prev => {
        const messages = new Map(prev.messages);
        const sessionMsgs = [...(messages.get(message.sessionId) ?? [])];
        const existingIdx = sessionMsgs.findIndex(m => m.id === message.id);
        if (existingIdx >= 0) {
          sessionMsgs[existingIdx] = message;
        } else {
          sessionMsgs.push(message);
        }
        messages.set(message.sessionId, sessionMsgs);
        return { ...prev, messages };
      });
    });

    // ─── Tool events ──────────────────────────────────

    client.on('toolUse', (tool: ToolUseMessage) => {
      if (tool.status === 'pending') {
        setState(prev => ({
          ...prev,
          pendingApprovals: [...prev.pendingApprovals, tool],
        }));
      } else {
        setState(prev => ({
          ...prev,
          pendingApprovals: prev.pendingApprovals.filter(t => t.id !== tool.id),
        }));
      }
    });

    // ─── Terminal sync events ─────────────────────────

    client.on('terminalOutput', (output: TerminalOutput) => {
      setState(prev => {
        const terminalOutput = new Map(prev.terminalOutput);
        const existing = terminalOutput.get(output.sessionId) ?? '';
        const updated = (existing + output.data).slice(-50_000);
        terminalOutput.set(output.sessionId, updated);
        return { ...prev, terminalOutput };
      });
    });

    // ─── Scrollback sync events ──────────────────────

    client.on('scrollbackResult', ({ sessionId, data }: { sessionId: string; data: string }) => {
      setState(prev => {
        const terminalOutput = new Map(prev.terminalOutput);
        const existing = terminalOutput.get(sessionId) ?? '';
        const updated = (data + existing).slice(-50_000);
        terminalOutput.set(sessionId, updated);
        return { ...prev, terminalOutput };
      });
    });

    // ─── Command tracking events ──────────────────────

    client.on('commandStatus', (command: LongRunningCommand) => {
      setState(prev => {
        let runningCommands = [...prev.runningCommands];
        if (command.status === 'running') {
          const idx = runningCommands.findIndex(c => c.id === command.id);
          if (idx >= 0) {
            runningCommands[idx] = command;
          } else {
            runningCommands.push(command);
          }
        } else {
          runningCommands = runningCommands.filter(c => c.id !== command.id);
        }
        return { ...prev, runningCommands };
      });
    });

    // ─── Notification events ──────────────────────────

    notificationService.onNotification((notification: InAppNotification) => {
      setState(prev => ({
        ...prev,
        notifications: [notification, ...prev.notifications].slice(0, 100),
        unreadNotificationCount: prev.unreadNotificationCount + 1,
      }));
    });

    // ─── Handoff events ───────────────────────────────

    client.on('handoffReady', ({ newSessionId }: { newSessionId: string }) => {
      setState(prev => ({ ...prev, activeSessionId: newSessionId }));
    });

    // ─── Approval policy events ───────────────────────

    client.on('policyResult', (policy: ApprovalPolicy | null) => {
      setState(prev => ({ ...prev, activePolicy: policy }));
    });

    client.on('policiesUpdated', (policies: ApprovalPolicy[]) => {
      setState(prev => ({ ...prev, policies }));
    });

    client.on('approvalQueueUpdated', (queue: ApprovalQueueItem[]) => {
      setState(prev => ({ ...prev, approvalQueue: queue }));
    });

    client.on('approvalNeeded', (item: ApprovalQueueItem) => {
      setState(prev => ({
        ...prev,
        approvalQueue: [...prev.approvalQueue, item],
      }));
    });

    client.on('approvalDecided', () => {
      // Refresh the queue
      client.listApprovalQueue();
    });

    // ─── Task queue events ────────────────────────────

    client.on('taskCreated', (task: Task) => {
      setState(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    });

    client.on('taskUpdated', (task: Task) => {
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? task : t),
      }));
    });

    client.on('taskDeleted', (taskId: string) => {
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== taskId),
      }));
    });

    client.on('tasksUpdated', (tasks: Task[]) => {
      setState(prev => ({ ...prev, tasks }));
    });

    // ─── Digest & timeline events ─────────────────────

    client.on('digestResult', (digest: DigestSummary) => {
      setState(prev => ({ ...prev, digest }));
    });

    client.on('timelineResult', (entries: TimelineEntry[]) => {
      setState(prev => ({ ...prev, timeline: entries }));
    });

    // ─── Git status events ────────────────────────────

    client.on('gitStatusResult', ({ sessionId, status }: { sessionId: string; status: GitStatus }) => {
      setState(prev => {
        const gitStatus = new Map(prev.gitStatus);
        gitStatus.set(sessionId, status);
        return { ...prev, gitStatus };
      });
    });

    client.on('gitLogResult', ({ commits }: { commits: GitCommit[] }) => {
      setState(prev => ({ ...prev, gitLog: commits }));
    });

    // ─── Cost & usage events ──────────────────────────

    client.on('costUpdate', ({ sessionId, estimatedCostUsd }: { sessionId: string; estimatedCostUsd: number }) => {
      setState(prev => {
        const sessionCosts = new Map(prev.sessionCosts);
        const existing = sessionCosts.get(sessionId) ?? 0;
        sessionCosts.set(sessionId, existing + estimatedCostUsd);
        return { ...prev, sessionCosts };
      });
    });

    client.on('usageResult', (summary: UsageSummary) => {
      setState(prev => ({ ...prev, usageSummary: summary }));
    });

    client.on('budgetAlert', () => {
      // Refresh usage on budget alert
      client.requestUsage();
    });

    // ─── Search & template events ─────────────────────

    client.on('searchResults', (results: SearchResult[]) => {
      setState(prev => ({ ...prev, searchResults: results }));
    });

    client.on('templatesUpdated', (templates: SessionTemplate[]) => {
      setState(prev => ({ ...prev, templates }));
    });

    client.on('templateCreated', (template: SessionTemplate) => {
      setState(prev => ({ ...prev, templates: [...prev.templates, template] }));
    });

    return () => {
      backgroundService.destroy();
      client.disconnect();
      client.removeAllListeners();
    };
  }, []);

  // ─── Actions ──────────────────────────────────────────

  const connect = useCallback((serverUrl: string, token: string) => {
    clientRef.current?.connectWithToken(serverUrl, token);
  }, []);

  const connectWithPairing = useCallback((host: string, port: number, code: string) => {
    clientRef.current?.connectWithPairing(host, port, code);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const selectWorkspace = useCallback((workspaceId: WorkspaceId) => {
    setState(prev => ({ ...prev, activeWorkspaceId: workspaceId }));
    clientRef.current?.listSessions(workspaceId);
  }, []);

  const createWorkspace = useCallback((name?: string) => {
    clientRef.current?.createWorkspace(name);
  }, []);

  const selectSession = useCallback((sessionId: SessionId) => {
    clientRef.current?.attachSession(sessionId);
    setState(prev => ({ ...prev, activeSessionId: sessionId }));
  }, []);

  const createSession = useCallback((name?: string) => {
    clientRef.current?.createSession(name, state.activeWorkspaceId ?? undefined);
  }, [state.activeWorkspaceId]);

  const sendMessage = useCallback((content: string) => {
    const sessionId = state.activeSessionId;
    if (sessionId) {
      clientRef.current?.sendMessage(sessionId, content);
    }
  }, [state.activeSessionId]);

  const approveTool = useCallback((toolUseId: string, approved: boolean) => {
    const sessionId = state.activeSessionId;
    if (sessionId) {
      clientRef.current?.approveTool(sessionId, toolUseId, approved);
    }
  }, [state.activeSessionId]);

  const triggerHandoff = useCallback(() => {
    const sessionId = state.activeSessionId;
    if (sessionId) {
      clientRef.current?.triggerHandoff(sessionId);
    }
  }, [state.activeSessionId]);

  const sendTerminalInput = useCallback((data: string) => {
    const sessionId = state.activeSessionId;
    if (sessionId) {
      clientRef.current?.sendTerminalInput(sessionId, data);
    }
  }, [state.activeSessionId]);

  const markNotificationRead = useCallback((notificationId: string) => {
    notificationServiceRef.current?.markRead(notificationId);
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadNotificationCount: Math.max(0, prev.unreadNotificationCount - 1),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    notificationServiceRef.current?.markAllRead();
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadNotificationCount: 0,
    }));
  }, []);

  // ─── Approval Policy Actions ────────────────────────

  const setApprovalPreset = useCallback((preset: ApprovalPreset) => {
    clientRef.current?.setPolicy(preset);
  }, []);

  const listApprovalQueue = useCallback(() => {
    clientRef.current?.listApprovalQueue();
  }, []);

  const decideApproval = useCallback((queueItemId: string, approved: boolean) => {
    clientRef.current?.decideApproval(queueItemId, approved);
  }, []);

  const decideAllApprovals = useCallback((approved: boolean) => {
    for (const item of state.approvalQueue) {
      clientRef.current?.decideApproval(item.id, approved);
    }
  }, [state.approvalQueue]);

  // ─── Task Queue Actions ─────────────────────────────

  const createTask = useCallback((title: string, description: string, priority: TaskPriority) => {
    clientRef.current?.createTask(title, description, priority, state.activeWorkspaceId ?? undefined);
  }, [state.activeWorkspaceId]);

  const cancelTask = useCallback((taskId: string) => {
    clientRef.current?.updateTask(taskId, { status: 'cancelled' });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    clientRef.current?.deleteTask(taskId);
  }, []);

  const reorderTasks = useCallback((taskIds: string[]) => {
    clientRef.current?.reorderTasks(taskIds);
  }, []);

  // ─── Digest & Timeline Actions ──────────────────────

  const requestDigest = useCallback((since: number) => {
    clientRef.current?.requestDigest(since);
  }, []);

  const requestTimeline = useCallback((sessionId?: string) => {
    clientRef.current?.requestTimeline(sessionId);
  }, []);

  // ─── Git Status Actions ─────────────────────────────

  const requestGitStatus = useCallback((sessionId?: SessionId) => {
    const sid = sessionId ?? state.activeSessionId;
    if (sid) clientRef.current?.requestGitStatus(sid);
  }, [state.activeSessionId]);

  const requestGitLog = useCallback((sessionId?: SessionId) => {
    const sid = sessionId ?? state.activeSessionId;
    if (sid) clientRef.current?.requestGitLog(sid);
  }, [state.activeSessionId]);

  // ─── Cost & Usage Actions ───────────────────────────

  const requestUsage = useCallback((period?: 'daily' | 'weekly' | 'monthly') => {
    clientRef.current?.requestUsage(period);
  }, []);

  const setBudget = useCallback((dailyLimit: number) => {
    clientRef.current?.setBudget({ dailyLimitUsd: dailyLimit });
  }, []);

  // ─── Search & Template Actions ──────────────────────

  const searchQuery = useCallback((query: string) => {
    clientRef.current?.search({ query, scope: 'all' });
  }, []);

  const loadTemplates = useCallback((category?: string) => {
    clientRef.current?.listTemplates(category);
  }, []);

  const useTemplate = useCallback((templateId: string) => {
    clientRef.current?.useTemplate(templateId);
  }, []);

  const createTemplate = useCallback((name: string, description: string, category: string, prompts: string[]) => {
    clientRef.current?.createTemplate(name, description, category, prompts);
  }, []);

  // ─── Macro Actions ──────────────────────────────────

  const saveMacro = useCallback((name: string, command: string, description: string, category: string) => {
    const macro: CommandMacro = {
      id: `macro-${Date.now()}`,
      name,
      command,
      description,
      category,
      usageCount: 0,
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, macros: [...prev.macros, macro] }));
  }, []);

  const deleteMacro = useCallback((macroId: string) => {
    setState(prev => ({
      ...prev,
      macros: prev.macros.filter(m => m.id !== macroId),
    }));
  }, []);

  // ─── Computed values ────────────────────────────────

  const activeSessionCost = state.activeSessionId
    ? (state.sessionCosts.get(state.activeSessionId) ?? 0)
    : 0;

  const activeGitStatus = state.activeSessionId
    ? (state.gitStatus.get(state.activeSessionId) ?? null)
    : null;

  return {
    ...state,
    activeMessages: state.activeSessionId
      ? (state.messages.get(state.activeSessionId) ?? [])
      : [],
    activeTerminalOutput: state.activeSessionId
      ? (state.terminalOutput.get(state.activeSessionId) ?? '')
      : '',
    workspaceSessions: state.activeWorkspaceId
      ? state.sessions.filter(s => s.workspaceId === state.activeWorkspaceId)
      : state.sessions,
    activeSessionCost,
    activeGitStatus,
    connect,
    connectWithPairing,
    disconnect,
    selectWorkspace,
    createWorkspace,
    selectSession,
    createSession,
    sendMessage,
    approveTool,
    triggerHandoff,
    sendTerminalInput,
    markNotificationRead,
    markAllNotificationsRead,
    // Approval
    setApprovalPreset,
    listApprovalQueue,
    decideApproval,
    decideAllApprovals,
    // Tasks
    createTask,
    cancelTask,
    deleteTask,
    reorderTasks,
    // Digest
    requestDigest,
    requestTimeline,
    // Git
    requestGitStatus,
    requestGitLog,
    // Cost
    requestUsage,
    setBudget,
    // Search
    searchQuery,
    loadTemplates,
    useTemplate,
    createTemplate,
    // Macros
    saveMacro,
    deleteMacro,
  };
}
