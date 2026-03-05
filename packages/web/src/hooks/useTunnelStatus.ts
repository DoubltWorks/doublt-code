import { useEffect, useState } from 'react';
import type { ServerMessage } from '@doublt/shared';

interface TunnelState {
  url: string | null;
  provider: string;
  status: 'active' | 'stopped' | 'error';
}

export function useTunnelStatus(
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
) {
  const [tunnel, setTunnel] = useState<TunnelState>({
    url: null,
    provider: '',
    status: 'stopped',
  });

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'tunnel:status') {
        setTunnel({
          url: msg.url,
          provider: msg.provider,
          status: msg.status,
        });
      }
    });
    return unsubscribe;
  }, [subscribe]);

  return tunnel;
}
