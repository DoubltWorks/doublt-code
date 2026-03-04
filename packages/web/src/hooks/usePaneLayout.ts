import { useState, useCallback } from 'react';

export type PaneNode =
  | { type: 'terminal'; id: string; sessionId: string }
  | { type: 'split'; id: string; direction: 'horizontal' | 'vertical'; children: [PaneNode, PaneNode]; ratio: number };

let paneIdCounter = 0;
function nextPaneId(): string {
  return `pane-${++paneIdCounter}`;
}

interface UsePaneLayoutReturn {
  root: PaneNode;
  activePaneId: string;
  setActivePaneId: (id: string) => void;
  splitPane: (direction: 'horizontal' | 'vertical', newSessionId: string) => void;
  closePane: (paneId: string) => void;
  resizePane: (splitId: string, ratio: number) => void;
  setRootSessionId: (sessionId: string) => void;
}

export function usePaneLayout(initialSessionId: string): UsePaneLayoutReturn {
  const [root, setRoot] = useState<PaneNode>(() => {
    const id = nextPaneId();
    return { type: 'terminal', id, sessionId: initialSessionId };
  });
  const [activePaneId, setActivePaneId] = useState(root.id);

  const setRootSessionId = useCallback((sessionId: string) => {
    setRoot((prev) => {
      if (prev.type === 'terminal') {
        return { ...prev, sessionId };
      }
      return prev;
    });
  }, []);

  const splitPane = useCallback(
    (direction: 'horizontal' | 'vertical', newSessionId: string) => {
      setRoot((prev) => {
        const splitNode = (node: PaneNode): PaneNode => {
          if (node.id === activePaneId && node.type === 'terminal') {
            const newPane: PaneNode = {
              type: 'terminal',
              id: nextPaneId(),
              sessionId: newSessionId,
            };
            return {
              type: 'split',
              id: nextPaneId(),
              direction,
              children: [node, newPane],
              ratio: 0.5,
            };
          }
          if (node.type === 'split') {
            return {
              ...node,
              children: [splitNode(node.children[0]), splitNode(node.children[1])],
            };
          }
          return node;
        };
        return splitNode(prev);
      });
    },
    [activePaneId],
  );

  const closePane = useCallback(
    (paneId: string) => {
      setRoot((prev) => {
        const removePane = (node: PaneNode): PaneNode | null => {
          if (node.type === 'terminal') {
            return node.id === paneId ? null : node;
          }
          const [left, right] = node.children;
          if (left.id === paneId || (left.type === 'terminal' && left.id === paneId)) {
            return right;
          }
          if (right.id === paneId || (right.type === 'terminal' && right.id === paneId)) {
            return left;
          }
          const newLeft = removePane(left);
          const newRight = removePane(right);
          if (!newLeft) return newRight;
          if (!newRight) return newLeft;
          return { ...node, children: [newLeft, newRight] };
        };
        return removePane(prev) ?? prev;
      });
    },
    [],
  );

  const resizePane = useCallback((splitId: string, ratio: number) => {
    const clamped = Math.max(0.1, Math.min(0.9, ratio));
    setRoot((prev) => {
      const updateRatio = (node: PaneNode): PaneNode => {
        if (node.type === 'split') {
          if (node.id === splitId) {
            return { ...node, ratio: clamped };
          }
          return {
            ...node,
            children: [updateRatio(node.children[0]), updateRatio(node.children[1])],
          };
        }
        return node;
      };
      return updateRatio(prev);
    });
  }, []);

  return { root, activePaneId, setActivePaneId, splitPane, closePane, resizePane, setRootSessionId };
}
