import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClientMessage, ServerMessage, GitStatus, GitCommit } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

const REFRESH_INTERVAL = 30_000;

interface UseGitStatusReturn {
  status: GitStatus | null;
  commits: GitCommit[];
  requestRefresh: () => void;
}

export function useGitStatus(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
  activeSessionId: string | null,
): UseGitStatusReturn {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'git:status:result':
          if (msg.sessionId === activeSessionIdRef.current) {
            setStatus(msg.status);
          }
          break;
        case 'git:log:result':
          if (msg.sessionId === activeSessionIdRef.current) {
            setCommits(msg.commits);
          }
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  const connectionStateRef = useRef(connectionState);
  connectionStateRef.current = connectionState;

  const requestRefresh = useCallback(() => {
    if (connectionStateRef.current !== 'connected' || !activeSessionIdRef.current) return;
    send({ type: 'git:status:request', sessionId: activeSessionIdRef.current });
    send({ type: 'git:log:request', sessionId: activeSessionIdRef.current, count: 5 });
  }, [send]);

  // Clear stale data + request fresh on session change
  useEffect(() => {
    setStatus(null);
    setCommits([]);
    if (connectionState === 'connected' && activeSessionId) {
      send({ type: 'git:status:request', sessionId: activeSessionId });
      send({ type: 'git:log:request', sessionId: activeSessionId, count: 5 });
    }
  }, [connectionState, activeSessionId, send]);

  // Auto-refresh
  useEffect(() => {
    if (connectionState !== 'connected' || !activeSessionId) return;
    const timer = setInterval(() => {
      if (activeSessionIdRef.current) {
        send({ type: 'git:status:request', sessionId: activeSessionIdRef.current });
      }
    }, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [connectionState, activeSessionId, send]);

  return { status, commits, requestRefresh };
}
