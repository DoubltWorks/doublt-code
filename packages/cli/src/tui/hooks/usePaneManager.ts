import { useState, useEffect, useCallback } from 'react';
import type { PaneManager } from '../../cmux/PaneManager.js';
import type { SessionPane } from '../../cmux/SessionPane.js';

export function usePaneManager(paneManager: PaneManager) {
  const [panes, setPanes] = useState<SessionPane[]>(paneManager.getAllPanes());
  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    const sync = () => {
      setPanes(paneManager.getAllPanes());
      const allPanes = paneManager.getAllPanes();
      const focusedIdx = allPanes.findIndex(p => p.focused);
      setActiveIndex(focusedIdx >= 0 ? focusedIdx : 0);
    };

    paneManager.on('pane:created', sync);
    paneManager.on('pane:removed', sync);
    paneManager.on('pane:focused', sync);

    return () => {
      paneManager.off('pane:created', sync);
      paneManager.off('pane:removed', sync);
      paneManager.off('pane:focused', sync);
    };
  }, [paneManager]);

  const createPane = useCallback((sessionId: string) => {
    return paneManager.createPane(sessionId);
  }, [paneManager]);

  const removePane = useCallback((index: number) => {
    return paneManager.removePane(index);
  }, [paneManager]);

  const focusPane = useCallback((index: number) => {
    return paneManager.focusPane(index);
  }, [paneManager]);

  const nextPane = useCallback(() => {
    paneManager.nextPane();
  }, [paneManager]);

  const previousPane = useCallback(() => {
    paneManager.previousPane();
  }, [paneManager]);

  return {
    panes,
    activeIndex,
    activePane: paneManager.activePane,
    createPane,
    removePane,
    focusPane,
    nextPane,
    previousPane,
  };
}
