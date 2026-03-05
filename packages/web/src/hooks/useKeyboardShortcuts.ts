import { useEffect, useRef, useCallback } from 'react';
import type { OverlayType } from './useOverlay';

interface KeyboardActions {
  onNewSession: () => void;
  onNextSession: () => void;
  onPrevSession: () => void;
  onOpenOverlay: (type: NonNullable<OverlayType>) => void;
  onCloseOverlay: () => void;
  onToggleSidebar: () => void;
  activeOverlay: OverlayType;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const prefixActiveRef = useRef(false);
  const prefixTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const clearPrefix = useCallback(() => {
    prefixActiveRef.current = false;
    clearTimeout(prefixTimerRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const a = actionsRef.current;

      // Close overlay on Escape
      if (e.key === 'Escape' && a.activeOverlay) {
        e.preventDefault();
        a.onCloseOverlay();
        return;
      }

      // Ctrl+K: command palette
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        a.onOpenOverlay('commandPalette');
        return;
      }

      // Ctrl+B: set prefix mode
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        prefixActiveRef.current = true;
        // Auto-clear after 2 seconds
        clearTimeout(prefixTimerRef.current);
        prefixTimerRef.current = setTimeout(clearPrefix, 2000);
        return;
      }

      // Handle prefix keys (Ctrl+B then ...)
      if (prefixActiveRef.current) {
        clearPrefix();
        e.preventDefault();

        switch (e.key) {
          case 'c': // new session
            a.onNewSession();
            break;
          case 'n': // next session
            a.onNextSession();
            break;
          case 'p': // prev session
            a.onPrevSession();
            break;
          case 'w': // session list
            a.onOpenOverlay('sessionList');
            break;
          case 'm': // mobile pair
            a.onOpenOverlay('pairingQR');
            break;
          case '?': // help
            a.onOpenOverlay('help');
            break;
          case 'd': // toggle sidebar (detach-like)
            a.onToggleSidebar();
            break;
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(prefixTimerRef.current);
    };
  }, [clearPrefix]);
}
