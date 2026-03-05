import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClientMessage, ServerMessage } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

const POLL_INTERVAL = 10_000;

export interface ClaudeSessionStatus {
  sessionId: string;
  status: 'idle' | 'running' | 'crashed' | 'stopped' | 'error' | 'budget_paused';
  restartCount: number;
  lastStartedAt?: number;
}

interface UseClaudeStatusReturn {
  statuses: ClaudeSessionStatus[];
  getSessionStatus: (sessionId: string) => ClaudeSessionStatus | undefined;
  startClaude: (sessionId: string, prompt?: string) => void;
  stopClaude: (sessionId: string) => void;
  requestRefresh: () => void;
}

export function useClaudeStatus(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseClaudeStatusReturn {
  const [statuses, setStatuses] = useState<ClaudeSessionStatus[]>([]);
  const connectionStateRef = useRef(connectionState);
  connectionStateRef.current = connectionState;

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'claude:status:result') {
        setStatuses(msg.sessions);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Initial request + polling
  useEffect(() => {
    if (connectionState !== 'connected') return;
    send({ type: 'claude:status' });
    const timer = setInterval(() => {
      if (connectionStateRef.current === 'connected') {
        send({ type: 'claude:status' });
      }
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [connectionState, send]);

  const getSessionStatus = useCallback(
    (sessionId: string) => statuses.find((s) => s.sessionId === sessionId),
    [statuses],
  );

  const startClaude = useCallback(
    (sessionId: string, prompt?: string) => {
      send({ type: 'claude:start', sessionId, prompt, autoRestart: true });
    },
    [send],
  );

  const stopClaude = useCallback(
    (sessionId: string) => {
      send({ type: 'claude:stop', sessionId });
    },
    [send],
  );

  const requestRefresh = useCallback(() => {
    if (connectionStateRef.current === 'connected') {
      send({ type: 'claude:status' });
    }
  }, [send]);

  return { statuses, getSessionStatus, startClaude, stopClaude, requestRefresh };
}
