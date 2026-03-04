import { useEffect, useRef, useState, useCallback } from 'react';
import { encodeMessage, decodeMessage, type ClientMessage, type ServerMessage } from '@doublt/shared';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketReturn {
  send: (msg: ClientMessage) => void;
  connectionState: ConnectionState;
  lastMessage: ServerMessage | null;
  subscribe: (handler: (msg: ServerMessage) => void) => () => void;
}

const MAX_RECONNECT_ATTEMPTS = 15;

export function useWebSocket(url: string, token: string): UseWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<(msg: ServerMessage) => void>>(new Set());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    shouldReconnectRef.current = true;
    setConnectionState(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      // Authenticate immediately
      const authMsg: ClientMessage = {
        type: 'authenticate',
        token,
        clientType: 'cli',
        deviceInfo: `web-${navigator.userAgent.slice(0, 40)}`,
      };
      ws.send(encodeMessage(authMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = decodeMessage(event.data as string) as ServerMessage;

        if (msg.type === 'auth:result') {
          if (msg.success) {
            setConnectionState('connected');
          } else {
            setConnectionState('disconnected');
            shouldReconnectRef.current = false;
            ws.close();
            return;
          }
        }

        setLastMessage(msg);
        for (const handler of handlersRef.current) {
          handler(msg);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      if (!shouldReconnectRef.current || reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      // Exponential backoff reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
      reconnectAttemptRef.current++;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(encodeMessage(msg));
    }
  }, []);

  const subscribe = useCallback((handler: (msg: ServerMessage) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return { send, connectionState, lastMessage, subscribe };
}
