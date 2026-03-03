/**
 * useDoublt — React hook for doublt-code mobile integration.
 *
 * Provides reactive state management for the mobile app's
 * connection to the doublt server. Extended with:
 * - Workspace management
 * - Terminal output sync
 * - Notification handling
 * - Background task integration
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
  };
}
