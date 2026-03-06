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
 * - Offline cache & sync queue
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
import type { SyncState } from '@doublt/shared/src/types/offline.js';

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
  // Sync state
  syncState: SyncState;
}

/** Debounce helper: returns a function that delays execution */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T;
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
    syncState: { lastSyncedAt: 0, pendingCount: 0, cacheSize: 0, isOnline: false },
  });

  useEffect(() => {
    const client = new DoubltClient();
    const notificationService = new NotificationService();
    const backgroundService = new BackgroundTaskService(client, notificationService);

    clientRef.current = client;
    notificationServiceRef.current = notificationService;
    backgroundServiceRef.current = backgroundService;

    // ─── Initialize offline subsystems & load cache ────

    void (async () => {
      await client.initOffline();

      // Load cached data into initial state
      const [cachedSessions, cachedWorkspaces, cachedNotifications] = await Promise.all([
        client.offlineStore.loadMetadata<SessionListItem[]>('sessions'),
        client.offlineStore.loadMetadata<WorkspaceListItem[]>('workspaces'),
        client.offlineStore.loadNotifications(),
      ]);

      const syncState = await client.offlineStore.getSyncState(
        client.syncQueue.pendingCount,
        client.isConnected,
      );

      setState(prev => ({
        ...prev,
        sessions: cachedSessions ?? prev.sessions,
        workspaces: cachedWorkspaces ?? prev.workspaces,
        activeWorkspaceId: cachedWorkspaces?.length ? cachedWorkspaces[0].id : prev.activeWorkspaceId,
        syncState,
      }));

      // Load cached notifications into NotificationService
      for (const notif of cachedNotifications) {
        notificationService.handleServerNotification(notif);
      }
    })();

    // ─── Debounced cache save helpers ──────────────────

    const saveSessionsCache = debounce((sessions: SessionListItem[]) => {
      void client.offlineStore.cacheMetadata('sessions', sessions);
    }, 1000);

    const saveWorkspacesCache = debounce((workspaces: WorkspaceListItem[]) => {
      void client.offlineStore.cacheMetadata('workspaces', workspaces);
    }, 1000);

    const saveMessagesCache = debounce((sessionId: string, messages: ChatMessage[]) => {
      void client.offlineStore.cacheMessages(sessionId, messages);
    }, 2000);

    // ─── Connection state ─────────────────────────────

    client.on('stateChanged', (connectionState: string) => {
      setState(prev => ({
        ...prev,
        connectionState: connectionState as DoubltState['connectionState'],
        syncState: { ...prev.syncState, isOnline: connectionState === 'connected' },
      }));
    });

    // ─── Sync events ──────────────────────────────────

    client.syncQueue.on('enqueued', () => {
      setState(prev => ({
        ...prev,
        syncState: { ...prev.syncState, pendingCount: client.syncQueue.pendingCount },
      }));
    });

    client.syncQueue.on('flushed', () => {
      setState(prev => ({
        ...prev,
        syncState: { ...prev.syncState, pendingCount: client.syncQueue.pendingCount },
      }));
    });

    client.on('syncComplete', () => {
      void client.offlineStore.getSyncState(
        client.syncQueue.pendingCount,
        client.isConnected,
      ).then(syncState => {
        setState(prev => ({ ...prev, syncState }));
      });
    });

    // ─── Workspace events ─────────────────────────────

    client.on('workspacesUpdated', (workspaces: WorkspaceListItem[]) => {
      setState(prev => ({
        ...prev,
        workspaces,
        activeWorkspaceId: prev.activeWorkspaceId ?? (workspaces.length > 0 ? workspaces[0].id : null),
      }));
      saveWorkspacesCache(workspaces);
    });

    client.on('workspaceCreated', (workspace: WorkspaceListItem) => {
      setState(prev => {
        const workspaces = [...prev.workspaces, workspace];
        saveWorkspacesCache(workspaces);
        return { ...prev, workspaces };
      });
    });

    client.on('workspaceUpdated', (workspace: WorkspaceListItem) => {
      setState(prev => {
        const workspaces = prev.workspaces.map(ws => ws.id === workspace.id ? workspace : ws);
        saveWorkspacesCache(workspaces);
        return { ...prev, workspaces };
      });
    });

    client.on('workspaceDeleted', (workspaceId: string) => {
      setState(prev => {
        const workspaces = prev.workspaces.filter(ws => ws.id !== workspaceId);
        saveWorkspacesCache(workspaces);
        return {
          ...prev,
          workspaces,
          activeWorkspaceId: prev.activeWorkspaceId === workspaceId ? null : prev.activeWorkspaceId,
        };
      });
    });

    // ─── Session events ───────────────────────────────

    client.on('sessionsUpdated', (sessions: SessionListItem[]) => {
      setState(prev => ({ ...prev, sessions }));
      saveSessionsCache(sessions);
    });

    client.on('sessionUpdated', (session: SessionListItem) => {
      setState(prev => {
        const sessions = prev.sessions.map(s => s.id === session.id ? session : s);
        saveSessionsCache(sessions);
        return { ...prev, sessions };
      });
    });

    client.on('sessionCreated', (session: SessionListItem) => {
      setState(prev => {
        const sessions = [...prev.sessions, session];
        saveSessionsCache(sessions);
        return { ...prev, sessions };
      });
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
        // Cache messages for offline access
        saveMessagesCache(message.sessionId, sessionMsgs);
        return { ...prev, messages };
      });
    });

    // ─── Chat stream events ───────────────────────────

    client.on('chatStream', ({ sessionId, messageId, delta, done }: {
      sessionId: string; messageId: string; delta: string; done: boolean;
    }) => {
      setState(prev => {
        const messages = new Map(prev.messages);
        const sessionMsgs = [...(messages.get(sessionId) ?? [])];
        const existingIdx = sessionMsgs.findIndex(m => m.id === messageId);

        if (existingIdx >= 0) {
          const existing = sessionMsgs[existingIdx];
          // Skip if already finalized by a chat:message event
          if (!existing.partial && existing.content.length > 0) {
            return prev;
          }
          sessionMsgs[existingIdx] = {
            ...existing,
            content: existing.content + delta,
            partial: !done,
          };
        } else {
          // Create new partial message
          sessionMsgs.push({
            id: messageId,
            sessionId,
            role: 'assistant' as const,
            content: delta,
            timestamp: Date.now(),
            partial: !done,
          });
        }

        messages.set(sessionId, sessionMsgs);

        // Only cache when message is complete to avoid thrashing storage
        if (done) {
          saveMessagesCache(sessionId, sessionMsgs);
        }

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
      notificationService.destroy();
      client.disconnect();
      client.removeAllListeners();
      client.syncQueue.removeAllListeners();
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

    // Load cached messages for this session
    if (clientRef.current) {
      void clientRef.current.offlineStore.loadMessages(sessionId).then(cached => {
        if (cached.length > 0) {
          setState(prev => {
            const messages = new Map(prev.messages);
            const existing = messages.get(sessionId) ?? [];
            if (existing.length === 0) {
              messages.set(sessionId, cached);
              return { ...prev, messages };
            }
            return prev;
          });
        }
      });
    }
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

  // ─── Offline Actions ────────────────────────────────

  const cleanupCache = useCallback(async () => {
    if (clientRef.current) {
      return clientRef.current.offlineStore.cleanup();
    }
    return 0;
  }, []);

  const clearCache = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.offlineStore.clearAll();
      clientRef.current.syncQueue.clear();
      setState(prev => ({
        ...prev,
        syncState: { lastSyncedAt: 0, pendingCount: 0, cacheSize: 0, isOnline: prev.syncState.isOnline },
      }));
    }
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
    // Offline
    cleanupCache,
    clearCache,
  };
}
