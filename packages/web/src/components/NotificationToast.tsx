import { useState, useEffect, useCallback, useRef } from 'react';
import type { ServerMessage } from '@doublt/shared';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
}

const TOAST_DURATION = 5000;
const MAX_TOASTS = 5;

const TYPE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  info: { bg: 'rgba(137, 180, 250, 0.1)', border: 'var(--accent)', color: 'var(--accent)' },
  warning: { bg: 'rgba(249, 226, 175, 0.1)', border: 'var(--yellow)', color: 'var(--yellow)' },
  error: { bg: 'rgba(243, 139, 168, 0.1)', border: 'var(--red)', color: 'var(--red)' },
  success: { bg: 'rgba(166, 227, 161, 0.1)', border: 'var(--green)', color: 'var(--green)' },
};

export function useNotificationToast(
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type, timestamp: Date.now() }]);
    // Per-toast auto-dismiss via individual setTimeout
    const timer = setTimeout(() => {
      removeToast(id);
    }, TOAST_DURATION);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // Subscribe to server events that should produce toasts
  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      switch (msg.type) {
        case 'budget:alert':
          addToast(msg.alert.message, 'warning');
          break;
        case 'approval:needed':
          addToast(`Approval needed: ${msg.item.toolName}`, 'warning');
          break;
        case 'handoff:ready':
          addToast(`Handoff ready: ${msg.handoffSummary.slice(0, 60)}`, 'info');
          break;
        case 'error':
          addToast(msg.message, 'error');
          break;
      }
    });
    return unsubscribe;
  }, [subscribe, addToast]);

  return { toasts, addToast, removeToast };
}

interface NotificationToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 2000,
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            style={{
              padding: '8px 12px',
              background: style.bg,
              border: `1px solid ${style.border}`,
              borderRadius: 6,
              fontSize: 12,
              color: style.color,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.2s ease-out',
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
