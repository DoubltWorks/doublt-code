import { useState, useEffect, useCallback } from 'react';
import type { ServerBridge } from '../../bridge/ServerBridge.js';
import type {
  ServerMessage,
  SessionListItem,
  WorkspaceListItem,
  SessionNotification,
} from '@doublt/shared';

const MAX_TERMINAL_LINES = 1000;

export function useServerBridge(bridge: ServerBridge) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [terminalBuffers, setTerminalBuffers] = useState<Map<string, string[]>>(new Map());
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  useEffect(() => {
    const onConnected = () => setConnectionState('connected');
    const onDisconnected = () => setConnectionState('disconnected');
    const onReconnecting = () => setConnectionState('reconnecting');

    const onSessionList = (msg: ServerMessage & { type: 'session:list:result' }) => {
      setSessions(msg.sessions);
    };

    const onSessionCreated = (msg: ServerMessage & { type: 'session:created' }) => {
      setSessions((prev: SessionListItem[]) => [...prev, msg.session]);
    };

    const onWorkspaceList = (msg: ServerMessage & { type: 'workspace:list:result' }) => {
      setWorkspaces(msg.workspaces);
    };

    const onWorkspaceCreated = (msg: ServerMessage & { type: 'workspace:created' }) => {
      setWorkspaces((prev: WorkspaceListItem[]) => [...prev, msg.workspace]);
    };

    const onTerminalOutput = (msg: ServerMessage & { type: 'terminal:output' }) => {
      setTerminalBuffers((prev: Map<string, string[]>) => {
        const next = new Map(prev);
        const sessionId = msg.output.sessionId;
        const lines = next.get(sessionId) ?? [];
        const newLines = msg.output.data.split('\n');
        const updated = [...lines, ...newLines].slice(-MAX_TERMINAL_LINES);
        next.set(sessionId, updated);
        return next;
      });
    };

    const onNotification = (msg: ServerMessage & { type: 'notification' }) => {
      setNotifications((prev: SessionNotification[]) => [...prev, msg.notification]);
    };

    bridge.on('connected', onConnected);
    bridge.on('disconnected', onDisconnected);
    bridge.on('reconnecting', onReconnecting);
    bridge.on('message:session:list:result', onSessionList);
    bridge.on('message:session:created', onSessionCreated);
    bridge.on('message:workspace:list:result', onWorkspaceList);
    bridge.on('message:workspace:created', onWorkspaceCreated);
    bridge.on('message:terminal:output', onTerminalOutput);
    bridge.on('message:notification', onNotification);

    return () => {
      bridge.off('connected', onConnected);
      bridge.off('disconnected', onDisconnected);
      bridge.off('reconnecting', onReconnecting);
      bridge.off('message:session:list:result', onSessionList);
      bridge.off('message:session:created', onSessionCreated);
      bridge.off('message:workspace:list:result', onWorkspaceList);
      bridge.off('message:workspace:created', onWorkspaceCreated);
      bridge.off('message:terminal:output', onTerminalOutput);
      bridge.off('message:notification', onNotification);
    };
  }, [bridge]);

  const getTerminalLines = useCallback((sessionId: string): string[] => {
    return terminalBuffers.get(sessionId) ?? [];
  }, [terminalBuffers]);

  return {
    sessions,
    workspaces,
    terminalBuffers,
    notifications,
    connectionState,
    getTerminalLines,
  };
}
