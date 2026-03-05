import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ClientMessage, ServerMessage, ApprovalQueueItem } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

interface UseApprovalQueueReturn {
  queue: ApprovalQueueItem[];
  pendingCount: number;
  decide: (queueItemId: string, approved: boolean, reason?: string) => void;
}

export function useApprovalQueue(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseApprovalQueueReturn {
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'approval:queue:result':
          setQueue(msg.queue);
          break;
        case 'approval:needed':
          setQueue((prev) => {
            if (prev.some((q) => q.id === msg.item.id)) return prev;
            return [...prev, msg.item];
          });
          break;
        case 'approval:decided':
          setQueue((prev) =>
            prev.map((q) =>
              q.id === msg.decision.queueItemId
                ? { ...q, status: msg.decision.approved ? 'approved' as const : 'denied' as const }
                : q,
            ),
          );
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'approval:queue:list' });
    }
  }, [connectionState, send]);

  const pendingCount = useMemo(() => queue.filter((q) => q.status === 'pending').length, [queue]);

  const decide = useCallback(
    (queueItemId: string, approved: boolean, reason?: string) => {
      send({ type: 'approval:decide', queueItemId, approved, reason });
    },
    [send],
  );

  return { queue, pendingCount, decide };
}
