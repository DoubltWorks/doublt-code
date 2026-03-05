import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClientMessage, ServerMessage } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

export interface SessionInfo {
  id: string;
  name: string;
  status: string;
  clientCount: number;
  contextUsage: number;
  lastActivityAt: number;
  cwd: string;
  index: number;
  workspaceId?: string;
}

interface UseSessionManagerReturn {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
  createSession: (workspaceId?: string) => void;
  attachSession: (id: string) => void;
  detachSession: (id: string) => void;
  archiveSession: (id: string) => void;
}

export function useSessionManager(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseSessionManagerReturn {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'session:list:result':
          setSessions(msg.sessions);
          if (msg.sessions.length > 0 && !activeSessionIdRef.current) {
            setActiveSessionId(msg.sessions[0].id);
          }
          break;

        case 'session:created':
          setSessions((prev) => {
            if (prev.some((s) => s.id === msg.session.id)) return prev;
            return [...prev, msg.session];
          });
          setActiveSessionId(msg.session.id);
          break;

        case 'session:updated':
          setSessions((prev) =>
            prev.map((s) => (s.id === msg.session.id ? { ...s, ...msg.session } : s)),
          );
          break;

        case 'session:archived':
          setSessions((prev) => {
            const next = prev.filter((s) => s.id !== msg.sessionId);
            if (activeSessionIdRef.current === msg.sessionId) {
              setActiveSessionId(next.length > 0 ? next[0].id : null);
            }
            return next;
          });
          break;
      }
    });

    return unsubscribe;
  }, [subscribe]);

  // Request session list when connection becomes ready
  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'session:list' });
    }
  }, [connectionState, send]);

  const createSession = useCallback((workspaceId?: string) => {
    send({
      type: 'session:create',
      options: {
        name: `session-${Date.now().toString(36)}`,
        ...(workspaceId ? { workspaceId } : {}),
      },
    });
  }, [send]);

  const attachSession = useCallback(
    (id: string) => {
      send({ type: 'session:attach', sessionId: id });
    },
    [send],
  );

  const detachSession = useCallback(
    (id: string) => {
      send({ type: 'session:detach', sessionId: id });
    },
    [send],
  );

  const archiveSession = useCallback(
    (id: string) => {
      send({ type: 'session:archive', sessionId: id });
    },
    [send],
  );

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    attachSession,
    detachSession,
    archiveSession,
  };
}
