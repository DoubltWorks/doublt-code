import { useState, useCallback, useEffect } from 'react';

export interface SidebarState {
  isOpen: boolean;
  width: number;
  expandedPanels: Record<string, boolean>;
}

const STORAGE_KEY = 'doublt-sidebar';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

function loadState(): SidebarState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[useSidebar] Failed to load state:', e);
  }
  return { isOpen: true, width: DEFAULT_WIDTH, expandedPanels: {} };
}

function saveState(state: SidebarState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[useSidebar] Failed to save state:', e);
  }
}

export function useSidebar() {
  const [state, setState] = useState<SidebarState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggle = useCallback(() => {
    setState((s) => ({ ...s, isOpen: !s.isOpen }));
  }, []);

  const setWidth = useCallback((width: number) => {
    setState((s) => ({
      ...s,
      width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
    }));
  }, []);

  const togglePanel = useCallback((panelId: string) => {
    setState((s) => ({
      ...s,
      expandedPanels: {
        ...s.expandedPanels,
        [panelId]: !s.expandedPanels[panelId],
      },
    }));
  }, []);

  const isPanelExpanded = useCallback(
    (panelId: string, defaultOpen = true) => {
      return state.expandedPanels[panelId] ?? defaultOpen;
    },
    [state.expandedPanels],
  );

  return {
    isOpen: state.isOpen,
    width: state.width,
    toggle,
    setWidth,
    togglePanel,
    isPanelExpanded,
  };
}
