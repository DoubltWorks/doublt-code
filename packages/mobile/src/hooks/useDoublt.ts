/**
 * useDoublt — React hook for doublt-code mobile integration.
 *
 * Provides reactive state management for the mobile app's
 * connection to the doublt server.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DoubltClient } from '../services/DoubltClient';
import type {
  SessionListItem,
  ChatMessage,
  ToolUseMessage,
  SessionNotification,
  SessionId,
} from '@doublt/shared';

interface DoubltState {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  sessions: SessionListItem[];
  activeSessionId: SessionId | null;
  messages: Map<SessionId, ChatMessage[]>;
  pendingApprovals: ToolUseMessage[];
  notifications: SessionNotification[];
}

export function useDoublt() {
  const clientRef = useRef<DoubltClient | null>(null);
  const [state, setState] = useState<DoubltState>({
    connectionState: 'disconnected',
    sessions: [],
    activeSessionId: null,
    messages: new Map(),
    pendingApprovals: [],
    notifications: [],
  });

  useEffect(() => {
    const client = new DoubltClient();
    clientRef.current = client;

    client.on('stateChanged', (connectionState: string) => {
      setState(prev => ({ ...prev, connectionState: connectionState as DoubltState['connectionState'] }));
    });

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

    client.on('chatMessage', (message: ChatMessage) => {
      setState(prev => {
        const messages = new Map(prev.messages);
        const sessionMsgs = messages.get(message.sessionId) ?? [];

        // Update existing partial message or add new one
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

    client.on('notification', (notification: SessionNotification) => {
      setState(prev => ({
        ...prev,
        notifications: [notification, ...prev.notifications].slice(0, 50),
      }));
    });

    client.on('handoffReady', ({ newSessionId }: { newSessionId: string }) => {
      // Auto-switch to the new session
      setState(prev => ({ ...prev, activeSessionId: newSessionId }));
    });

    return () => {
      client.disconnect();
      client.removeAllListeners();
    };
  }, []);

  const connect = useCallback((serverUrl: string, token: string) => {
    clientRef.current?.connectWithToken(serverUrl, token);
  }, []);

  const connectWithPairing = useCallback((host: string, port: number, code: string) => {
    clientRef.current?.connectWithPairing(host, port, code);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const selectSession = useCallback((sessionId: SessionId) => {
    clientRef.current?.attachSession(sessionId);
    setState(prev => ({ ...prev, activeSessionId: sessionId }));
  }, []);

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

  return {
    ...state,
    activeMessages: state.activeSessionId
      ? (state.messages.get(state.activeSessionId) ?? [])
      : [],
    connect,
    connectWithPairing,
    disconnect,
    selectSession,
    sendMessage,
    approveTool,
    triggerHandoff,
  };
}
