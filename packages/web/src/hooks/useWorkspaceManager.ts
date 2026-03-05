import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClientMessage, ServerMessage, WorkspaceListItem } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

interface UseWorkspaceManagerReturn {
  workspaces: WorkspaceListItem[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  createWorkspace: (name?: string, cwd?: string) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
}

export function useWorkspaceManager(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseWorkspaceManagerReturn {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const activeRef = useRef(activeWorkspaceId);
  activeRef.current = activeWorkspaceId;

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'workspace:list:result':
          setWorkspaces(msg.workspaces);
          if (msg.workspaces.length > 0 && !activeRef.current) {
            setActiveWorkspaceId(msg.workspaces[0].id);
          }
          break;
        case 'workspace:created':
          setWorkspaces((prev) => {
            if (prev.some((w) => w.id === msg.workspace.id)) return prev;
            return [...prev, msg.workspace];
          });
          setActiveWorkspaceId(msg.workspace.id);
          break;
        case 'workspace:updated':
          setWorkspaces((prev) =>
            prev.map((w) => (w.id === msg.workspace.id ? msg.workspace : w)),
          );
          break;
        case 'workspace:deleted':
          setWorkspaces((prev) => {
            const next = prev.filter((w) => w.id !== msg.workspaceId);
            if (activeRef.current === msg.workspaceId) {
              setActiveWorkspaceId(next.length > 0 ? next[0].id : null);
            }
            return next;
          });
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'workspace:list' });
    }
  }, [connectionState, send]);

  const createWorkspace = useCallback(
    (name?: string, cwd?: string) => {
      send({ type: 'workspace:create', options: { name, cwd } });
    },
    [send],
  );

  const deleteWorkspace = useCallback(
    (id: string) => {
      send({ type: 'workspace:delete', workspaceId: id });
    },
    [send],
  );

  const renameWorkspace = useCallback(
    (id: string, name: string) => {
      send({ type: 'workspace:rename', workspaceId: id, name });
    },
    [send],
  );

  return {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
  };
}
