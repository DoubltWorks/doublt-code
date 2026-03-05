import { useEffect, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, TimelineEntry, DigestSummary } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

interface UseActivityTimelineReturn {
  entries: TimelineEntry[];
  digest: DigestSummary | null;
  requestTimeline: (limit?: number) => void;
  requestDigest: (sinceHoursAgo?: number) => void;
}

export function useActivityTimeline(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseActivityTimelineReturn {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [digest, setDigest] = useState<DigestSummary | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'timeline:result':
          setEntries(msg.entries);
          break;
        case 'digest:result':
          setDigest(msg.digest);
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'timeline:request', limit: 50 });
      send({ type: 'digest:request', since: Date.now() - 24 * 3600_000 });
    }
  }, [connectionState, send]);

  const requestTimeline = useCallback(
    (limit = 50) => {
      send({ type: 'timeline:request', limit });
    },
    [send],
  );

  const requestDigest = useCallback(
    (sinceHoursAgo = 24) => {
      send({ type: 'digest:request', since: Date.now() - sinceHoursAgo * 3600_000 });
    },
    [send],
  );

  return { entries, digest, requestTimeline, requestDigest };
}
