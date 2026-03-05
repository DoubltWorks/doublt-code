import { useEffect, useState, useCallback, useRef } from 'react';
import type { ClientMessage, ServerMessage, UsageSummary, BudgetAlert } from '@doublt/shared';
import type { ConnectionState } from './useWebSocket';

interface UseCostTrackerReturn {
  summary: UsageSummary | null;
  alerts: BudgetAlert[];
  requestRefresh: () => void;
}

export function useCostTracker(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  connectionState: ConnectionState,
): UseCostTrackerReturn {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'usage:result':
          setSummary(msg.summary);
          break;
        case 'cost:update':
          // Incrementally update summary if we have one
          setSummary((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              totalCostUsd: prev.totalCostUsd + msg.estimatedCostUsd,
              totalTokens: prev.totalTokens + msg.usage.totalTokens,
            };
          });
          break;
        case 'budget:alert':
          setAlerts((prev) => {
            const existing = prev.findIndex((a) => a.id === msg.alert.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = msg.alert;
              return next;
            }
            return [...prev, msg.alert];
          });
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Request full usage on connect/reconnect to prevent drift
  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'usage:request', period: 'daily' });
    }
  }, [connectionState, send]);

  // Periodic full re-sync every 5 minutes to correct incremental drift
  useEffect(() => {
    if (connectionState !== 'connected') return;
    const timer = setInterval(() => {
      send({ type: 'usage:request', period: 'daily' });
    }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [connectionState, send]);

  const connectionStateRef = useRef(connectionState);
  connectionStateRef.current = connectionState;

  const requestRefresh = useCallback(() => {
    if (connectionStateRef.current === 'connected') {
      send({ type: 'usage:request', period: 'daily' });
    }
  }, [send]);

  return { summary, alerts, requestRefresh };
}
